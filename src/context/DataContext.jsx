import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { lumpCorpus, freqToMonthly } from "../utils/finance";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

const EMPTY_PERSON = {
  incomes: [],
  expenses: [],
  investments: [],
  goals: [],
  debts: [],
  transactions: [],
  recurringRules: [],
  budgetAlerts: [],
  assets: [],
  liabilities: [],
  taxInfo: {},
};

const EMPTY_SHARED = {
  goals: [],
  profile: { householdName: "", city: "", savingsTarget: 25 },
  netWorthHistory: [],
};

const DEFAULTS = {
  abhav: { ...EMPTY_PERSON },
  aanya: { ...EMPTY_PERSON },
  shared: { ...EMPTY_SHARED },
};

// Builds virtual recurring rules from incomes, expenses, and SIP investments.
// These are derived at runtime — no need to store them in Firestore.
function autoRecurringRules(data) {
  const rules = [];
  let id = -1; // negative IDs to avoid clashing with manual rules

  // Income rules
  for (const inc of data.incomes || []) {
    rules.push({
      id: id--,
      desc: inc.name,
      amount: inc.amount,
      type: "income",
      category: "Salary",
      dayOfMonth: 1,
      active: true,
      auto: true,
      sourceType: "income",
    });
  }

  // Expense rules
  for (const exp of data.expenses || []) {
    rules.push({
      id: id--,
      desc: exp.name,
      amount: -Math.abs(exp.amount),
      type: "expense",
      category: exp.category || "Others",
      dayOfMonth: 1,
      active: true,
      auto: true,
      sourceType: "expense",
    });
  }

  // SIP investment rules (skip FD, lump-sum, and one-time types)
  for (const inv of data.investments || []) {
    if (inv.type === "FD" || inv.frequency === "onetime") continue;
    // yearly SIPs only fire once a year — still show in recurring list but
    // the transaction generation handles them differently below
    rules.push({
      id: id--,
      desc: inv.name,
      amount: -Math.abs(inv.amount),
      type: "investment",
      category: "Investment",
      dayOfMonth: inv.deductionDate || 15,
      frequency: inv.frequency || "monthly",
      active: true,
      auto: true,
      sourceType: "investment",
    });
  }

  // Debt EMI rules
  for (const debt of data.debts || []) {
    rules.push({
      id: id--,
      desc: debt.name + " EMI",
      amount: -Math.abs(debt.emi),
      type: "expense",
      category: "EMI",
      dayOfMonth: 5,
      active: true,
      auto: true,
      sourceType: "debt",
    });
  }

  return rules;
}

function applyRecurring(data) {
  const transactions = data.transactions || [];
  // Manual rules (user-created, stored in Firestore)
  const manualRules = (data.recurringRules || []).filter((r) => !r.auto);
  // Auto rules derived from budget + investments + debts
  const autoRules = autoRecurringRules(data);
  const allRules = [...autoRules, ...manualRules];

  if (!allRules.length) return transactions;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = [...transactions];
  let maxId = Math.max(0, ...transactions.map((t) => t.id ?? 0));

  for (const rule of allRules) {
    if (!rule.active) continue;
    // Skip yearly SIPs outside their month (assume January deduction)
    if (rule.frequency === "yearly" && now.getMonth() !== 0) continue;

    const dateStr = `${ym}-${String(rule.dayOfMonth).padStart(2, "0")}`;
    if (new Date(dateStr) > now) continue;

    const exists = transactions.some(
      (t) => t.date === dateStr && t.desc === rule.desc && t.auto,
    );
    if (!exists) {
      maxId++;
      result.unshift({
        id: maxId,
        date: dateStr,
        desc: rule.desc,
        amount: rule.amount,
        type: rule.type,
        category: rule.category,
        recurringId: rule.id,
        auto: true,
      });
    }
  }
  return result;
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [abhav, setAbhav] = useState(null);
  const [aanya, setAanya] = useState(null);
  const [shared, setShared] = useState(null);
  const loading = !!(user && (!abhav || !aanya || !shared));

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubs = [];

    const watch = (docId, setter, defaultData) => {
      const ref = doc(db, "households", uid, "data", docId);
      getDoc(ref).then((snap) => {
        if (!snap.exists()) setDoc(ref, defaultData);
      });
      const unsub = onSnapshot(ref, (snap) => {
        const data = snap.exists() ? snap.data() : defaultData;
        // Auto-derive recurring transactions from incomes/expenses/investments/debts
        const updated = applyRecurring(data);
        if (updated.length !== (data.transactions || []).length) {
          const newData = { ...data, transactions: updated };
          setter(newData);
          setDoc(ref, newData);
          return;
        }
        setter(data);
      });
      unsubs.push(unsub);
    };

    watch("abhav", setAbhav, DEFAULTS.abhav);
    watch("aanya", setAanya, DEFAULTS.aanya);
    watch("shared", setShared, DEFAULTS.shared);
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const save = useCallback(
    async (docId, data) => {
      if (!user) return;
      await setDoc(doc(db, "households", user.uid, "data", docId), data);
    },
    [user],
  );

  const updatePerson = useCallback(
    (person, key, value) => {
      const current = person === "abhav" ? abhav : aanya;
      let updated = { ...current, [key]: value };

      // When any data source that feeds recurring rules changes,
      // invalidate this month's auto-generated transactions and re-derive.
      if (["incomes", "expenses", "investments", "debts"].includes(key)) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const withoutAutoThisMonth = (updated.transactions || []).filter(
          (t) => !(t.auto && t.date?.startsWith(ym)),
        );
        updated = { ...updated, transactions: withoutAutoThisMonth };
        updated = { ...updated, transactions: applyRecurring(updated) };
      }

      if (person === "abhav") setAbhav(updated);
      else setAanya(updated);
      save(person, updated);
    },
    [abhav, aanya, save],
  );

  const batchUpdatePerson = useCallback(
    (person, fields) => {
      const current = person === "abhav" ? abhav : aanya;
      let updated = { ...current, ...fields };
      const sourceKeys = ["incomes", "expenses", "investments", "debts"];
      if (sourceKeys.some((k) => k in fields)) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const withoutAutoThisMonth = (updated.transactions || []).filter(
          (t) => !(t.auto && t.date?.startsWith(ym)),
        );
        updated = { ...updated, transactions: withoutAutoThisMonth };
        updated = { ...updated, transactions: applyRecurring(updated) };
      }
      if (person === "abhav") setAbhav(updated);
      else setAanya(updated);
      save(person, updated);
    },
    [abhav, aanya, save],
  );

  const updateShared = useCallback(
    (key, value) => {
      const updated = { ...shared, [key]: value };
      setShared(updated);
      save("shared", updated);
    },
    [shared, save],
  );

  const resetData = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    const emptyAbhav = { ...EMPTY_PERSON };
    const emptyAanya = { ...EMPTY_PERSON };
    const emptyShared = { ...EMPTY_SHARED };
    await Promise.all([
      setDoc(doc(db, "households", uid, "data", "abhav"), emptyAbhav),
      setDoc(doc(db, "households", uid, "data", "aanya"), emptyAanya),
      setDoc(doc(db, "households", uid, "data", "shared"), emptyShared),
    ]);
  }, [user]);

  // Need onboarding when both persons have zero incomes (fresh state)
  const needsOnboarding =
    !loading &&
    abhav &&
    aanya &&
    shared &&
    abhav.incomes?.length === 0 &&
    aanya.incomes?.length === 0 &&
    !shared.profile?.householdName;

  const takeSnapshot = useCallback(() => {
    if (!abhav || !aanya) return;
    const now = new Date();
    const label = `${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`;

    // Compute net worth the same way NetWorth page does:
    // auto-assets from investments + manual assets − auto-liabilities from debts − manual liabilities
    const computeNW = (data) => {
      // Investment corpus values (auto)
      const invTotal = (data.investments || []).reduce((s, inv) => {
        if (inv.type === "FD") {
          const start = inv.startDate ? new Date(inv.startDate) : now;
          const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
          return s + lumpCorpus(inv.amount || 0, inv.returnPct || 0, elapsed);
        }
        if (inv.frequency === "onetime") {
          const start = inv.startDate ? new Date(inv.startDate) : now;
          const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
          return (
            s +
            lumpCorpus(
              (inv.existingCorpus || 0) + (inv.amount || 0),
              inv.returnPct || 0,
              elapsed,
            )
          );
        }
        // Regular SIP: existingCorpus is the actual current portfolio value
        return s + (inv.existingCorpus || 0);
      }, 0);
      // Manual assets (savings account, property, etc.)
      const manualAssets = (data.assets || []).reduce(
        (s, a) => s + (a.value || 0),
        0,
      );
      // Debt outstanding (auto)
      const debtTotal = (data.debts || []).reduce(
        (s, d) => s + (d.outstanding || 0),
        0,
      );
      // Manual liabilities (credit card, mortgage, etc.)
      const manualLiab = (data.liabilities || []).reduce(
        (s, l) => s + (l.value || 0),
        0,
      );
      return invTotal + manualAssets - (debtTotal + manualLiab);
    };

    const snap = {
      label,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      timestamp: now.toISOString(),
      abhavIncome: (abhav.incomes || []).reduce((s, x) => s + x.amount, 0),
      abhavExpenses: (abhav.expenses || []).reduce((s, x) => s + x.amount, 0),
      abhavInvestments: (abhav.investments || []).reduce(
        (s, x) => s + freqToMonthly(x.amount, x.frequency),
        0,
      ),
      aanyaIncome: (aanya.incomes || []).reduce((s, x) => s + x.amount, 0),
      aanyaExpenses: (aanya.expenses || []).reduce((s, x) => s + x.amount, 0),
      aanyaInvestments: (aanya.investments || []).reduce(
        (s, x) => s + freqToMonthly(x.amount, x.frequency),
        0,
      ),
      abhavNetWorth: Math.round(computeNW(abhav)),
      aanyaNetWorth: Math.round(computeNW(aanya)),
    };
    const history = (shared?.netWorthHistory || []).filter(
      (s) => !(s.month === snap.month && s.year === snap.year),
    );
    updateShared(
      "netWorthHistory",
      [...history, snap].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      ),
    );
  }, [abhav, aanya, shared, updateShared]);

  return (
    <DataContext.Provider
      value={{
        abhav,
        aanya,
        shared,
        loading,
        needsOnboarding,
        updatePerson,
        batchUpdatePerson,
        updateShared,
        takeSnapshot,
        resetData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
export { autoRecurringRules };
