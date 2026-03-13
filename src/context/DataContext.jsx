import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

const DEFAULTS = {
  abhav: {
    incomes: [{ id: 1, name: "Salary", amount: 80000, type: "salary" }],
    expenses: [
      { id: 1, name: "Rent share", amount: 12000, category: "Housing" },
      { id: 2, name: "Groceries", amount: 4000, category: "Food" },
      { id: 3, name: "Transport", amount: 3000, category: "Transport" },
      { id: 4, name: "Entertainment", amount: 2000, category: "Entertainment" },
    ],
    investments: [
      {
        id: 1,
        name: "Nifty 50 SIP",
        amount: 10000,
        type: "Mutual Fund",
        returnPct: 12,
        frequency: "monthly",
        existingCorpus: 20000,
        startDate: "2024-01-01",
      },
      {
        id: 2,
        name: "PPF",
        amount: 4000,
        type: "PPF",
        returnPct: 7.1,
        frequency: "monthly",
        existingCorpus: 50000,
        startDate: "2023-04-01",
      },
    ],
    goals: [
      {
        id: 1,
        name: "Emergency Fund",
        target: 300000,
        saved: 80000,
        emoji: "🛡️",
        color: "#e05c5c",
        deadline: "2026-06",
      },
      {
        id: 2,
        name: "New Car",
        target: 800000,
        saved: 20000,
        emoji: "🚗",
        color: "#9b7fe8",
        deadline: "2028-01",
      },
    ],
    debts: [
      {
        id: 1,
        name: "Personal Loan",
        outstanding: 200000,
        emi: 8500,
        rate: 12,
        tenure: 24,
      },
    ],
    transactions: [
      {
        id: 1,
        date: "2025-02-28",
        desc: "Salary credit",
        amount: 80000,
        type: "income",
        category: "Salary",
      },
      {
        id: 2,
        date: "2025-02-15",
        desc: "SIP - Nifty 50",
        amount: -10000,
        type: "investment",
        category: "Investment",
      },
      {
        id: 3,
        date: "2025-02-01",
        desc: "Rent share",
        amount: -12000,
        type: "expense",
        category: "Housing",
      },
    ],
    recurringRules: [
      {
        id: 1,
        desc: "Salary credit",
        amount: 80000,
        type: "income",
        category: "Salary",
        dayOfMonth: 28,
        active: true,
      },
      {
        id: 2,
        desc: "Nifty 50 SIP",
        amount: -10000,
        type: "investment",
        category: "Investment",
        dayOfMonth: 15,
        active: true,
      },
      {
        id: 3,
        desc: "Rent share",
        amount: -12000,
        type: "expense",
        category: "Housing",
        dayOfMonth: 1,
        active: true,
      },
    ],
    budgetAlerts: [
      { id: 1, category: "Food", limit: 8000, active: true },
      { id: 2, category: "Entertainment", limit: 3000, active: true },
      { id: 3, category: "Shopping", limit: 5000, active: true },
    ],
    assets: [
      { id: 1, name: "Savings Account", value: 150000, type: "cash" },
      { id: 2, name: "Nifty 50 corpus", value: 20000, type: "investment" },
      { id: 3, name: "PPF corpus", value: 50000, type: "investment" },
    ],
    liabilities: [
      { id: 1, name: "Personal Loan", value: 200000, type: "loan" },
    ],
    taxInfo: {
      regime: "new",
      basicSalary: 80000,
      hra: 15000,
      lta: 5000,
      elss: 10000,
      ppf: 4000,
      nps: 2000,
      homeLoanInterest: 0,
      medicalInsurance: 3000,
    },
  },
  aanya: {
    incomes: [{ id: 1, name: "Salary", amount: 65000, type: "salary" }],
    expenses: [
      { id: 1, name: "Rent share", amount: 12000, category: "Housing" },
      { id: 2, name: "Groceries", amount: 4000, category: "Food" },
      { id: 3, name: "Personal care", amount: 3000, category: "Personal Care" },
      { id: 4, name: "Online shopping", amount: 3000, category: "Shopping" },
    ],
    investments: [
      {
        id: 1,
        name: "ELSS SIP",
        amount: 8000,
        type: "Mutual Fund",
        returnPct: 13,
        frequency: "monthly",
        existingCorpus: 15000,
        startDate: "2024-03-01",
      },
      {
        id: 2,
        name: "Gold ETF",
        amount: 2000,
        type: "Gold",
        returnPct: 8,
        frequency: "weekly",
        existingCorpus: 10000,
        startDate: "2024-06-01",
      },
    ],
    goals: [
      {
        id: 1,
        name: "Emergency Fund",
        target: 300000,
        saved: 60000,
        emoji: "🛡️",
        color: "#e05c5c",
        deadline: "2026-06",
      },
      {
        id: 2,
        name: "Anniversary Trip",
        target: 200000,
        saved: 30000,
        emoji: "✈️",
        color: "#c9a84c",
        deadline: "2025-12",
      },
    ],
    debts: [],
    transactions: [
      {
        id: 1,
        date: "2025-02-28",
        desc: "Salary credit",
        amount: 65000,
        type: "income",
        category: "Salary",
      },
      {
        id: 2,
        date: "2025-02-15",
        desc: "ELSS SIP",
        amount: -8000,
        type: "investment",
        category: "Investment",
      },
      {
        id: 3,
        date: "2025-02-01",
        desc: "Rent share",
        amount: -12000,
        type: "expense",
        category: "Housing",
      },
    ],
    recurringRules: [
      {
        id: 1,
        desc: "Salary credit",
        amount: 65000,
        type: "income",
        category: "Salary",
        dayOfMonth: 28,
        active: true,
      },
      {
        id: 2,
        desc: "ELSS SIP",
        amount: -8000,
        type: "investment",
        category: "Investment",
        dayOfMonth: 15,
        active: true,
      },
    ],
    budgetAlerts: [
      { id: 1, category: "Shopping", limit: 4000, active: true },
      { id: 2, category: "Food", limit: 7000, active: true },
    ],
    assets: [
      { id: 1, name: "Savings Account", value: 120000, type: "cash" },
      { id: 2, name: "ELSS corpus", value: 15000, type: "investment" },
      { id: 3, name: "Gold ETF", value: 10000, type: "investment" },
    ],
    liabilities: [],
    taxInfo: {
      regime: "new",
      basicSalary: 65000,
      hra: 12000,
      lta: 4000,
      elss: 8000,
      ppf: 0,
      nps: 0,
      homeLoanInterest: 0,
      medicalInsurance: 3000,
    },
  },
  shared: {
    goals: [
      {
        id: 1,
        name: "Home Down Payment",
        target: 2000000,
        abhavSaved: 100000,
        aanyaSaved: 80000,
        emoji: "🏠",
        color: "#4caf82",
        deadline: "2030-01",
      },
      {
        id: 2,
        name: "Child Education Fund",
        target: 3000000,
        abhavSaved: 0,
        aanyaSaved: 0,
        emoji: "👶",
        color: "#5b9cf6",
        deadline: "2040-01",
      },
      {
        id: 3,
        name: "Europe Trip",
        target: 350000,
        abhavSaved: 50000,
        aanyaSaved: 30000,
        emoji: "🌍",
        color: "#c9a84c",
        deadline: "2025-12",
      },
    ],
    profile: {
      householdName: "Abhav & Aanya",
      city: "Bengaluru",
      savingsTarget: 25,
    },
    netWorthHistory: [],
  },
};

function applyRecurring(transactions, rules) {
  if (!rules || !rules.length) return transactions;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = [...transactions];
  let maxId = Math.max(0, ...transactions.map((t) => t.id ?? 0));
  for (const rule of rules) {
    if (!rule.active) continue;
    const dateStr = `${ym}-${String(rule.dayOfMonth).padStart(2, "0")}`;
    if (new Date(dateStr) > now) continue;
    const exists = transactions.some(
      (t) =>
        t.date === dateStr && t.desc === rule.desc && t.recurringId === rule.id,
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
        if (data.recurringRules && data.transactions) {
          const updated = applyRecurring(
            data.transactions,
            data.recurringRules,
          );
          if (updated.length !== data.transactions.length) {
            const newData = { ...data, transactions: updated };
            setter(newData);
            setDoc(ref, newData);
            return;
          }
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
      const updated = { ...current, [key]: value };
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

  const takeSnapshot = useCallback(() => {
    if (!abhav || !aanya) return;
    const now = new Date();
    const label = `${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`;
    const netWorth = (data) => {
      const assets = (data.assets || []).reduce(
        (s, a) => s + (a.value || 0),
        0,
      );
      const liabilities = (data.liabilities || []).reduce(
        (s, l) => s + (l.value || 0),
        0,
      );
      return assets - liabilities;
    };
    const snap = {
      label,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      timestamp: now.toISOString(),
      abhavIncome: (abhav.incomes || []).reduce((s, x) => s + x.amount, 0),
      abhavExpenses: (abhav.expenses || []).reduce((s, x) => s + x.amount, 0),
      abhavInvestments: (abhav.investments || []).reduce(
        (s, x) => s + x.amount * (x.frequency === "weekly" ? 4.33 : 1),
        0,
      ),
      aanyaIncome: (aanya.incomes || []).reduce((s, x) => s + x.amount, 0),
      aanyaExpenses: (aanya.expenses || []).reduce((s, x) => s + x.amount, 0),
      aanyaInvestments: (aanya.investments || []).reduce(
        (s, x) => s + x.amount * (x.frequency === "weekly" ? 4.33 : 1),
        0,
      ),
      abhavNetWorth: netWorth(abhav),
      aanyaNetWorth: netWorth(aanya),
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
        updatePerson,
        updateShared,
        takeSnapshot,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
