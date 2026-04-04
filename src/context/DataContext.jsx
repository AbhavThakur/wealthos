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
  where,
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

// ── Firestore document ID mapping ─────────────────────────────────────────
// Internal code uses "abhav"/"aanya" as state keys (kept to avoid 100+ file changes).
// Firestore uses generic "person1"/"person2" so every household looks the same.
const DOC_P1 = "person1";
const DOC_P2 = "person2";
const toDocId = (id) =>
  id === "abhav" ? DOC_P1 : id === "aanya" ? DOC_P2 : id;
const fromDocId = (id) =>
  id === DOC_P1 ? "abhav" : id === DOC_P2 ? "aanya" : id;

// One-time migration: copy legacy "abhav"/"aanya" docs → "person1"/"person2".
// After a verified copy, the old doc is deleted to save Firestore storage.
async function migrateDocNames(uid, subcol) {
  const pairs = [
    { old: "abhav", new: DOC_P1 },
    { old: "aanya", new: DOC_P2 },
  ];
  for (const { old: oldId, new: newId } of pairs) {
    const newRef = doc(db, COL_HOUSEHOLDS, uid, subcol, newId);
    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) {
      // Already migrated — clean up leftover old doc if it still exists
      const oldRef = doc(db, COL_HOUSEHOLDS, uid, subcol, oldId);
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists()) {
        await deleteDoc(oldRef);
        console.log(`[Migration] Cleaned up leftover "${oldId}" in ${subcol}`);
      }
      continue;
    }
    const oldRef = doc(db, COL_HOUSEHOLDS, uid, subcol, oldId);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) {
      await setDoc(newRef, oldSnap.data());
      // Verify the copy before deleting
      const verifySnap = await getDoc(newRef);
      if (verifySnap.exists()) {
        await deleteDoc(oldRef);
        console.log(`[Migration] Moved "${oldId}" → "${newId}" in ${subcol}`);
      } else {
        console.warn(
          `[Migration] Copy verification failed for "${newId}", keeping "${oldId}"`,
        );
      }
    }
  }
}

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

// ── Storage optimization: prune stale data before writing ────────────────
// Keeps Firestore docs lean on the free 1GB tier.
const MAX_HISTORY_MONTHS = 120; // cap netWorthHistory at 10 years

function prunePersonData(data) {
  let changed = false;
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Prune dismissedAutoTxns — only current month keys matter
  const dismissed = data.dismissedAutoTxns || [];
  if (dismissed.length > 0) {
    const pruned = dismissed.filter((k) => k.startsWith(curYm));
    if (pruned.length !== dismissed.length) {
      data = { ...data, dismissedAutoTxns: pruned };
      changed = true;
    }
  }

  // 2. Prune auto-generated transactions older than 6 months
  const txns = data.transactions || [];
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const cutoffYm = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
  const prunedTxns = txns.filter(
    (t) => !t.auto || !t.date || t.date.slice(0, 7) >= cutoffYm,
  );
  if (prunedTxns.length !== txns.length) {
    data = { ...data, transactions: prunedTxns };
    changed = true;
  }

  return { data, changed };
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
      const unsub = onSnapshot(ref, (snap) => {
        // On a new device the local cache is empty. If this snapshot is from
        // cache and the doc appears missing, do NOT write defaults — wait for
        // the server round-trip to confirm the doc truly doesn't exist.
        if (!snap.exists() && snap.metadata.fromCache) return;

        if (!snap.exists()) {
          // Genuinely new user — doc doesn't exist on server. Create it once.
          setDoc(ref, defaultData);
          return; // onSnapshot will fire again with the created data
        }

        let data = snap.data();

        // Migrate legacy expenses without expenseType
        const migrated = migrateExpenseTypes(data);
        if (migrated !== data) {
          data = migrated;
        }

        // Prune stale data BEFORE applyRecurring so the sequence is stable
        const pruned = prunePersonData(data);
        if (pruned.changed) {
          data = pruned.data;
        }

        // Auto-derive recurring transactions from incomes/expenses/investments/debts
        const updated = applyRecurring(data);
        if (updated.length !== (data.transactions || []).length) {
          data = { ...data, transactions: updated };
        }

        setter(data);
      });
      unsubs.push(unsub);
    };

    // Migrate old "abhav"/"aanya" doc names → "person1"/"person2", then watch
    let cancelled = false;
    migrateDocNames(uid, SUBCOL_DATA)
      .catch((err) => console.warn("[Migration] Failed:", err))
      .finally(() => {
        if (cancelled) return;
        watch(DOC_P1, setAbhav, DEFAULTS.abhav);
        watch(DOC_P2, setAanya, DEFAULTS.aanya);
        watch("shared", setShared, DEFAULTS.shared);
      });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user]);

  // ── Max backups to keep per document ────────────────────────────────────
  const MAX_BACKUPS = 10;

  // Save a backup snapshot of the current document before overwriting it.
  // Stored in households/{uid}/backups/{docId}_{timestamp}
  const backupBeforeSave = useCallback(
    async (docId) => {
      if (!user) return;
      const ref = doc(
        db,
        COL_HOUSEHOLDS,
        user.uid,
        SUBCOL_DATA,
        toDocId(docId),
      );
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
      // Uses where() to only read this doc's backups (saves read quota)
      const docBackups = await getDocs(
        query(
          backupsCol,
          where("docId", "==", docId),
          orderBy("createdAt", "desc"),
        ),
      );
      if (docBackups.size > MAX_BACKUPS) {
        const toDelete = docBackups.docs.slice(MAX_BACKUPS);
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
      // Reject if newData is missing most expected keys (spread of null)
      const expectedKeys =
        docId === "shared"
          ? ["trips", "goals", "profile", "netWorthHistory"]
          : ["incomes", "expenses", "investments", "debts", "transactions"];
      const presentKeys = expectedKeys.filter((k) => k in newData);
      if (presentKeys.length < 2) {
        console.error(
          `[DataGuard] BLOCKED write to "${docId}": ` +
            `only ${presentKeys.length}/${expectedKeys.length} expected keys present. Likely a null-spread bug.`,
        );
        return false;
      }
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
      await setDoc(
        doc(db, COL_HOUSEHOLDS, user.uid, SUBCOL_DATA, toDocId(docId)),
        data,
      );
    },
    [user, isWriteSafe, backupBeforeSave],
  );

  const updatePerson = useCallback(
    (person, key, value) => {
      const current = person === "abhav" ? abhav : aanya;
      if (!current) {
        console.error(
          `[DataGuard] updatePerson("${person}") skipped — data not loaded yet.`,
        );
        return;
      }
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
      if (!current) {
        console.error(
          `[DataGuard] batchUpdatePerson("${person}") skipped — data not loaded yet.`,
        );
        return;
      }
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
      if (!shared) {
        console.error(
          `[DataGuard] updateShared("${key}") skipped — data not loaded yet.`,
        );
        return;
      }
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
      setDoc(doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, DOC_P1), emptyAbhav),
      setDoc(doc(db, COL_HOUSEHOLDS, uid, SUBCOL_DATA, DOC_P2), emptyAanya),
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
    // Don't take a snapshot if data is still empty / loading
    const hasData =
      (abhav.investments?.length || 0) > 0 ||
      (abhav.assets?.length || 0) > 0 ||
      (abhav.savingsAccounts?.length || 0) > 0 ||
      (aanya.investments?.length || 0) > 0 ||
      (aanya.assets?.length || 0) > 0 ||
      (aanya.savingsAccounts?.length || 0) > 0;
    if (!hasData) return;
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
      abhavExpenses: (abhav.expenses || []).reduce(
        (s, x) =>
          s +
          (x.expenseType === "onetime"
            ? (x.entries || []).reduce((es, e) => es + (e.amount || 0), 0)
            : x.amount),
        0,
      ),
      abhavInvestments: (abhav.investments || []).reduce(
        (s, x) => s + freqToMonthly(x.amount, x.frequency),
        0,
      ),
      aanyaIncome: (aanya.incomes || []).reduce((s, x) => s + x.amount, 0),
      aanyaExpenses: (aanya.expenses || []).reduce(
        (s, x) =>
          s +
          (x.expenseType === "onetime"
            ? (x.entries || []).reduce((es, e) => es + (e.amount || 0), 0)
            : x.amount),
        0,
      ),
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
    // Cap history at MAX_HISTORY_MONTHS (keep most recent)
    const merged = [...history, snap]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-MAX_HISTORY_MONTHS);
    updateShared("netWorthHistory", merged);
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

  // ── One-time deferred persist: write pruned/migrated data back ──────────
  // Runs once after initial load. Separated from watch() so the first render
  // cycle completes without triggering onSnapshot re-fires that crash recharts.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (loading || persistedRef.current || !user) return;
    if (!abhav || !aanya || !shared) return;
    persistedRef.current = true;
    const uid = user.uid;
    const persist = async () => {
      for (const [internalId, data] of [
        ["abhav", abhav],
        ["aanya", aanya],
      ]) {
        const ref = doc(
          db,
          COL_HOUSEHOLDS,
          uid,
          SUBCOL_DATA,
          toDocId(internalId),
        );
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const stored = snap.data();
        // Only write if the stored data differs (needs migration/pruning)
        const storedTxLen = (stored.transactions || []).length;
        const localTxLen = (data.transactions || []).length;
        const storedDismLen = (stored.dismissedAutoTxns || []).length;
        const localDismLen = (data.dismissedAutoTxns || []).length;
        const needsMigrate = stored.expenses?.some((e) => !e.expenseType);
        if (
          storedTxLen !== localTxLen ||
          storedDismLen !== localDismLen ||
          needsMigrate
        ) {
          await setDoc(ref, data).catch((err) =>
            console.warn(`[Persist] Failed for ${internalId}:`, err),
          );
        }
      }
    };
    // Defer 2s so all charts are mounted and stable
    const timer = setTimeout(persist, 2000);
    return () => clearTimeout(timer);
  }, [loading, user, abhav, aanya, shared]);

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
      const { docId: rawDocId, data } = snap.data();
      // Handle both legacy ("abhav"/"aanya") and new ("person1"/"person2") backup IDs
      const internalId = fromDocId(rawDocId);
      // Backup current state BEFORE restoring (so restore is itself reversible)
      await backupBeforeSave(internalId);
      // Write the backed-up data directly to the doc
      const ref = doc(
        db,
        COL_HOUSEHOLDS,
        user.uid,
        SUBCOL_DATA,
        toDocId(internalId),
      );
      await setDoc(ref, data);
      // Update local state
      if (internalId === "abhav") setAbhav(data);
      else if (internalId === "aanya") setAanya(data);
      else if (internalId === "shared") setShared(data);
    },
    [user, backupBeforeSave],
  );

  // Manual backup: save all 3 docs right now (not throttled)
  // Keeps only the latest MAX_MANUAL_BACKUPS per document, deletes older ones.
  const MAX_MANUAL_BACKUPS = 3;
  const createManualBackup = useCallback(
    async (note = "manual backup") => {
      if (!user) return;
      const DOCS = ["abhav", "aanya", "shared"];
      const results = [];
      const backupsCol = collection(db, COL_HOUSEHOLDS, user.uid, "backups");
      for (const docId of DOCS) {
        const ref = doc(
          db,
          COL_HOUSEHOLDS,
          user.uid,
          SUBCOL_DATA,
          toDocId(docId),
        );
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data();
        await addDoc(backupsCol, {
          docId,
          data,
          createdAt: serverTimestamp(),
          timestamp: new Date().toISOString(),
          note,
        });
        results.push(docId);
      }
      // Prune: keep only latest MAX_MANUAL_BACKUPS manual backups per doc
      const allBackups = await getDocs(
        query(backupsCol, orderBy("createdAt", "desc")),
      );
      for (const docId of DOCS) {
        const manual = allBackups.docs.filter((d) => {
          const bd = d.data();
          return bd.docId === docId && bd.note;
        });
        if (manual.length > MAX_MANUAL_BACKUPS) {
          const toDelete = manual.slice(MAX_MANUAL_BACKUPS);
          await Promise.all(toDelete.map((d) => deleteDoc(d.ref)));
        }
      }
      return results;
    },
    [user],
  );

  // Copy production data into dev subcollection (both under "households")
  const seedDevFromProd = useCallback(async () => {
    if (!user) return;
    // Ensure prod docs are migrated to new names before reading
    await migrateDocNames(user.uid, "data").catch(() => {});
    const DOCS = ["abhav", "aanya", "shared"];
    const results = [];
    for (const docId of DOCS) {
      const fsId = toDocId(docId);
      // Read from prod (always "data" subcollection)
      const prodRef = doc(db, "households", user.uid, "data", fsId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) continue;
      const data = snap.data();
      // Write to dev ("dev_data" subcollection under same households collection)
      const devRef = doc(db, "households", user.uid, "dev_data", fsId);
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
      const fsId = toDocId(docId);
      // Read from dev
      const devRef = doc(db, "households", user.uid, "dev_data", fsId);
      const snap = await getDoc(devRef);
      if (!snap.exists()) continue;
      const data = snap.data();
      // Backup current prod before overwriting
      const prodRef = doc(db, "households", user.uid, "data", fsId);
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
