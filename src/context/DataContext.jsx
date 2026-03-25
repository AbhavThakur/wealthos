import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { autoRecurringRules } from "../utils/autoRecurringRules";
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, IS_DEV } from "../firebase";
import { lumpCorpus, freqToMonthly } from "../utils/finance";
import { useAuth } from "./AuthContext";

// Firestore paths — dev uses "dev_data" subcollection; prod uses "data"
const COL_HOUSEHOLDS = "households";
const SUBCOL_DATA = IS_DEV ? "dev_data" : "data";

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
  insurances: [],
  subscriptions: [],
  dismissedAutoTxns: [],
};

const EMPTY_SHARED = {
  goals: [],
  trips: [],
  profile: {
    householdName: "",
    city: "",
    savingsTarget: 25,
    person1Name: "",
    person2Name: "",
  },
  netWorthHistory: [],
};

const DEFAULTS = {
  abhav: { ...EMPTY_PERSON },
  aanya: { ...EMPTY_PERSON },
  shared: { ...EMPTY_SHARED },
};

// ── One-time migration: backfill expenseType on legacy expenses ─────────────
// Runs on load. Tags old expenses that have no expenseType field.
// - recurrence "once" → expenseType "onetime"
// - everything else → expenseType "monthly"
function migrateExpenseTypes(data) {
  const exps = data.expenses;
  if (!exps || exps.length === 0) return data;
  const needsMigration = exps.some((e) => !e.expenseType);
  if (!needsMigration) return data;
  return {
    ...data,
    expenses: exps.map((e) => {
      if (e.expenseType) return e;
      return {
        ...e,
        expenseType: e.recurrence === "once" ? "onetime" : "monthly",
      };
    }),
  };
}

// Builds virtual recurring rules from incomes, expenses, and SIP investments.
// These are derived at runtime — no need to store them in Firestore.

function applyRecurring(data) {
  const transactions = data.transactions || [];
  const dismissed = data.dismissedAutoTxns || [];
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

    // ── Recurrence gating ──────────────────────────────────────────────
    const rec =
      rule.recurrence || (rule.frequency === "yearly" ? "yearly" : "monthly");
    const nowMonth = now.getMonth(); // 0-based

    if (rec === "once" || rec === "variable") continue; // no auto transaction

    if (rec === "yearly") {
      // Fire only in the configured month (default Jan=0)
      const dueMonth = rule.recurrenceMonth ?? 0;
      if (nowMonth !== dueMonth) continue;
    }

    if (rec === "quarterly") {
      // Fire in months 0,3,6,9 by default, or configured months
      const dueMonths = rule.recurrenceMonths ?? [0, 3, 6, 9];
      if (!dueMonths.includes(nowMonth)) continue;
    }
    // "monthly" falls through — always fires
    // ──────────────────────────────────────────────────────────────────

    const dateStr = `${ym}-${String(rule.dayOfMonth).padStart(2, "0")}`;
    if (new Date(dateStr) > now) continue;

    const key = `${dateStr}|${rule.desc}`;
    const isDismissed = dismissed.includes(key);
    const exists = result.some(
      (t) => t.date === dateStr && t.desc === rule.desc && t.auto,
    );
    if (!exists && !isDismissed) {
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
      const ref = doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, docId);
      getDoc(ref).then((snap) => {
        if (!snap.exists()) setDoc(ref, defaultData);
      });
      const unsub = onSnapshot(ref, (snap) => {
        let data = snap.exists() ? snap.data() : defaultData;
        // Migrate legacy expenses without expenseType
        const migrated = migrateExpenseTypes(data);
        if (migrated !== data) {
          data = migrated;
          setDoc(ref, data);
        }
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

  // ── Max backups to keep per document ────────────────────────────────────
  const MAX_BACKUPS = 50;

  // Save a backup snapshot of the current document before overwriting it.
  // Stored in households/{uid}/backups/{docId}_{timestamp}
  const backupBeforeSave = useCallback(
    async (docId) => {
      if (!user) return;
      const ref = doc(db, COL_HOUSEHOLDS, user.uid, SUBCOL_DATA, docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const current = snap.data();
      // Don't backup empty docs
      const hasData = Object.values(current).some(
        (v) => Array.isArray(v) && v.length > 0,
      );
      if (!hasData && docId !== "shared") return;

      const backupsCol = collection(db, COL_HOUSEHOLDS, user.uid, "backups");
      await addDoc(backupsCol, {
        docId,
        data: current,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString(),
      });

      // Prune old backups — keep only the latest MAX_BACKUPS per docId
      const allBackups = await getDocs(
        query(backupsCol, orderBy("createdAt", "desc")),
      );
      const forDoc = allBackups.docs.filter((d) => d.data().docId === docId);
      if (forDoc.length > MAX_BACKUPS) {
        const toDelete = forDoc.slice(MAX_BACKUPS);
        await Promise.all(toDelete.map((d) => deleteDoc(d.ref)));
      }
    },
    [user],
  );

  // Write guard: reject writes that would wipe important arrays.
  // Returns true if the write looks safe; false if suspicious.
  const isWriteSafe = useCallback(
    (docId, newData) => {
      const current =
        docId === "abhav" ? abhav : docId === "aanya" ? aanya : shared;
      if (!current) return true; // first write, allow
      // Check key arrays — if current has data but new is empty, block
      const keys =
        docId === "shared"
          ? ["trips", "goals", "netWorthHistory"]
          : ["incomes", "expenses", "investments", "debts", "goals"];
      for (const key of keys) {
        const curLen = (current[key] || []).length;
        const newLen = (newData[key] || []).length;
        // Block if current has 3+ items and new has 0 (bulk wipe)
        if (curLen >= 3 && newLen === 0) {
          console.error(
            `[DataGuard] BLOCKED write to "${docId}.${key}": ` +
              `would delete all ${curLen} items. This looks like a bug.`,
          );
          return false;
        }
      }
      return true;
    },
    [abhav, aanya, shared],
  );

  // Debounce backup: only backup once every 30s per docId
  const lastBackupRef = useRef({});

  const save = useCallback(
    async (docId, data) => {
      if (!user) return;
      // Write guard
      if (!isWriteSafe(docId, data)) {
        console.error(
          `[DataGuard] Write to "${docId}" rejected. Data preserved.`,
        );
        return;
      }
      // Auto-backup (throttled: max once per 30s per doc)
      const now = Date.now();
      const lastTime = lastBackupRef.current[docId] || 0;
      if (now - lastTime > 30_000) {
        lastBackupRef.current[docId] = now;
        // Fire-and-forget — don't block the save
        backupBeforeSave(docId).catch((err) =>
          console.warn("[Backup] Failed:", err),
        );
      }
      await setDoc(doc(db, COL_HOUSEHOLDS, user.uid, SUBCOL_DATA, docId), data);
    },
    [user, isWriteSafe, backupBeforeSave],
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
      setDoc(doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, "abhav"), emptyAbhav),
      setDoc(doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, "aanya"), emptyAanya),
      setDoc(doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, "shared"), emptyShared),
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
      // Savings accounts (tracked separately on NetWorth page)
      const savingsTotal = (data.savingsAccounts || []).reduce(
        (s, a) => s + (a.balance || 0),
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
      return invTotal + manualAssets + savingsTotal - (debtTotal + manualLiab);
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
      sharedTripExpenses: (shared?.trips || []).reduce(
        (s, x) => s + (x.amount || 0),
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

  // ── Auto-snapshot once per month on app load ────────────────────────────
  const autoSnappedRef = useRef(false);
  useEffect(() => {
    if (loading || autoSnappedRef.current) return;
    if (!abhav || !aanya || !shared) return;
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const alreadyHas = (shared.netWorthHistory || []).some(
      (s) => s.month === curMonth && s.year === curYear,
    );
    if (!alreadyHas) {
      autoSnappedRef.current = true; // prevent double-fire
      setTimeout(takeSnapshot, 0);
    } else {
      autoSnappedRef.current = true;
    }
  }, [loading, abhav, aanya, shared, takeSnapshot]);

  // ── Backup listing & restore ────────────────────────────────────────────
  const listBackups = useCallback(
    async (docId) => {
      if (!user) return [];
      const backupsCol = collection(db, COL_HOUSEHOLDS, user.uid, "backups");
      const snap = await getDocs(
        query(backupsCol, orderBy("createdAt", "desc"), limit(100)),
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => !docId || b.docId === docId);
    },
    [user],
  );

  const restoreBackup = useCallback(
    async (backupId) => {
      if (!user) return;
      const backupRef = doc(db, COL_HOUSEHOLDS, user.uid, "backups", backupId);
      const snap = await getDoc(backupRef);
      if (!snap.exists()) throw new Error("Backup not found");
      const { docId, data } = snap.data();
      // Backup current state BEFORE restoring (so restore is itself reversible)
      await backupBeforeSave(docId);
      // Write the backed-up data directly to the doc
      const ref = doc(db, COL_HOUSEHOLDS, user.uid, SUBCOL_DATA, docId);
      await setDoc(ref, data);
      // Update local state
      if (docId === "abhav") setAbhav(data);
      else if (docId === "aanya") setAanya(data);
      else if (docId === "shared") setShared(data);
    },
    [user, backupBeforeSave],
  );

  // Manual backup: save all 3 docs right now (not throttled)
  const createManualBackup = useCallback(
    async (note = "manual backup") => {
      if (!user) return;
      const DOCS = ["abhav", "aanya", "shared"];
      const results = [];
      for (const docId of DOCS) {
        const ref = doc(db, COL_HOUSEHOLDS, user.uid, SUBCOL_DATA, docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data();
        const backupsCol = collection(db, COL_HOUSEHOLDS, user.uid, "backups");
        await addDoc(backupsCol, {
          docId,
          data,
          createdAt: serverTimestamp(),
          timestamp: new Date().toISOString(),
          note,
        });
        results.push(docId);
      }
      return results;
    },
    [user],
  );

  // Copy production data into dev subcollection (both under "households")
  const seedDevFromProd = useCallback(async () => {
    if (!user) return;
    const DOCS = ["abhav", "aanya", "shared"];
    const results = [];
    for (const docId of DOCS) {
      // Read from prod (always "data" subcollection)
      const prodRef = doc(db, "households", user.uid, "data", docId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) continue;
      const data = snap.data();
      // Write to dev ("dev_data" subcollection under same households collection)
      const devRef = doc(db, "households", user.uid, "dev_data", docId);
      await setDoc(devRef, data);
      results.push(docId);
    }
    return results;
  }, [user]);

  // Push dev data into production (dev_data → data). Backs up prod first.
  const pushDevToProd = useCallback(async () => {
    if (!user) return;
    const DOCS = ["abhav", "aanya", "shared"];
    const results = [];
    for (const docId of DOCS) {
      // Read from dev
      const devRef = doc(db, "households", user.uid, "dev_data", docId);
      const snap = await getDoc(devRef);
      if (!snap.exists()) continue;
      const data = snap.data();
      // Backup current prod before overwriting
      const prodRef = doc(db, "households", user.uid, "data", docId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const backupsCol = collection(db, "households", user.uid, "backups");
        await addDoc(backupsCol, {
          docId,
          data: prodSnap.data(),
          createdAt: serverTimestamp(),
          timestamp: new Date().toISOString(),
          note: "auto-backup before dev→prod push",
        });
      }
      // Write dev data to prod
      await setDoc(prodRef, data);
      results.push(docId);
    }
    return results;
  }, [user]);

  // Configurable person display names (fallback to "Person 1"/"Person 2")
  const personNames = {
    abhav: shared?.profile?.person1Name || "Person 1",
    aanya: shared?.profile?.person2Name || "Person 2",
  };

  return (
    <DataContext.Provider
      value={{
        abhav,
        aanya,
        shared,
        loading,
        needsOnboarding,
        personNames,
        updatePerson,
        batchUpdatePerson,
        updateShared,
        takeSnapshot,
        resetData,
        listBackups,
        restoreBackup,
        createManualBackup,
        seedDevFromProd,
        pushDevToProd,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);

// ── Demo mode provider (read-only, no Firebase) ─────────────────────────
export function DemoDataProvider({ children }) {
  const [abhav, setAbhav] = useState(null);
  const [aanya, setAanya] = useState(null);
  const [shared, setShared] = useState(null);

  useEffect(() => {
    // Lazy-load demo data to keep main bundle lean
    import("../data/demoData.js").then((mod) => {
      setAbhav({ ...mod.DEMO_PERSON1 });
      setAanya({ ...mod.DEMO_PERSON2 });
      setShared({ ...mod.DEMO_SHARED });
    });
  }, []);

  const loading = !abhav || !aanya || !shared;

  const personNames = {
    abhav: shared?.profile?.person1Name || "Rahul",
    aanya: shared?.profile?.person2Name || "Priya",
  };

  const noop = () => {};
  const noopAsync = async () => {};

  return (
    <DataContext.Provider
      value={{
        abhav,
        aanya,
        shared,
        loading,
        needsOnboarding: false,
        personNames,
        updatePerson: noop,
        batchUpdatePerson: noop,
        updateShared: noop,
        takeSnapshot: noop,
        resetData: noopAsync,
        listBackups: async () => [],
        restoreBackup: noopAsync,
        createManualBackup: noopAsync,
        seedDevFromProd: noopAsync,
        pushDevToProd: noopAsync,
        isDemo: true,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
