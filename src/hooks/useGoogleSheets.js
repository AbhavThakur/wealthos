// Hook — Google Sheets integration state and actions
//
// Reads live integration status from Firestore (onSnapshot — zero polling).
// Exposes: connect, disconnect, push, pull, syncAll
//
// connect() — opens OAuth popup; Firestore updates automatically on success
// disconnect() — revokes token + deletes Firestore doc
// push(sheetName, rows) — write rows to a specific tab
// pull(sheetName) — read rows from a specific tab
// syncAll(p1, p2, shared) — push all 8 tabs at once

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// ── Row transformers — convert WealthOS objects → flat Sheet rows ─────────────
export function toTransactionRows(transactions) {
  return (transactions || []).map((t) => ({
    _id: t.id ?? "",
    date: t.date ?? "",
    desc: t.desc ?? "",
    amount: t.amount ?? 0,
    type: t.type ?? "",
    category: t.category ?? "",
  }));
}

export function toBudgetRows(expenses) {
  return (expenses || []).map((e) => ({
    _id: e.id ?? "",
    name: e.name ?? "",
    category: e.category ?? "",
    allocated: e.allocated ?? 0,
    type: e.type ?? "",
    recurrence: e.recurrence ?? "monthly",
  }));
}

export function toInvestmentRows(investments) {
  return (investments || []).map((inv) => ({
    _id: inv.id ?? "",
    name: inv.name ?? "",
    type: inv.type ?? "",
    sipMonthly: inv.sipMonthly ?? 0,
    corpus: inv.corpus ?? 0,
    startDate: inv.startDate ?? "",
  }));
}

export function toGoalRows(goals) {
  return (goals || []).map((g) => ({
    _id: g.id ?? "",
    name: g.name ?? "",
    target: g.target ?? 0,
    deadline: g.deadline ?? "",
    // Support both old field names (abhavSaved/aanyaSaved) and new (p1Saved/p2Saved)
    p1Saved: g.p1Saved ?? g.abhavSaved ?? 0,
    p2Saved: g.p2Saved ?? g.aanyaSaved ?? 0,
  }));
}

export function toNetWorthRows(history) {
  return (history || []).map((h) => ({
    date: h.date ?? "",
    totalAssets: h.assets ?? 0,
    totalLiabilities: h.liabilities ?? 0,
    netWorth: (h.assets ?? 0) - (h.liabilities ?? 0),
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useGoogleSheets() {
  const { user } = useAuth();
  // undefined = loading, null = disconnected, object = connected
  const [integration, setIntegration] = useState(undefined);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Live-watch the Firestore integration doc
  useEffect(() => {
    if (!user || user.isDemo) {
      setIntegration(null);
      return;
    }
    const ref = doc(db, "households", user.uid, "integrations", "google");
    return onSnapshot(
      ref,
      (snap) => setIntegration(snap.exists() ? snap.data() : null),
      () => setIntegration(null),
    );
  }, [user]);

  // Listen for postMessage from OAuth popup so we can show a toast in parent
  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "SHEETS_OAUTH") return;
      // Firestore onSnapshot will update integration state automatically.
      // The parent App handles the toast via URL param inspection.
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Opens Google OAuth in a popup (falls back to redirect if popup blocked)
  const connect = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/google-auth?action=url&uid=${encodeURIComponent(user.uid)}`,
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to get OAuth URL");

      // Open popup — don't use noopener so window.opener works for postMessage
      const popup = window.open(
        data.url,
        "wealthos-google-auth",
        "width=520,height=660,scrollbars=yes,resizable=yes",
      );
      if (!popup) {
        // Popup blocked — fall back to full-page redirect
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  // Revokes Google token and removes the Firestore doc
  const disconnect = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/google-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", uid: user.uid }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Disconnect failed");
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // Push an array of row objects to a specific sheet tab
  const push = useCallback(
    async (sheetName, rows) => {
      if (!user || !integration) return 0;
      const res = await fetch("/api/sheets-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, sheetName, rows }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Push failed");
      return data.updatedRows ?? 0;
    },
    [user, integration],
  );

  // Pull rows from a specific sheet tab
  const pull = useCallback(
    async (sheetName) => {
      if (!user || !integration) return [];
      const res = await fetch("/api/sheets-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, sheetName }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Pull failed");
      return data.rows || [];
    },
    [user, integration],
  );

  // Push all 8 tabs from the current WealthOS data snapshot
  const syncAll = useCallback(
    async (p1, p2, shared) => {
      if (!user || !integration) return 0;
      setSyncing(true);
      setError(null);
      try {
        const results = await Promise.all([
          push("Transactions_P1", toTransactionRows(p1?.transactions)),
          push("Transactions_P2", toTransactionRows(p2?.transactions)),
          push("Budget_P1", toBudgetRows(p1?.expenses)),
          push("Budget_P2", toBudgetRows(p2?.expenses)),
          push("Investments_P1", toInvestmentRows(p1?.investments)),
          push("Investments_P2", toInvestmentRows(p2?.investments)),
          push("Goals", toGoalRows(shared?.goals)),
          push("NetWorth", toNetWorthRows(shared?.netWorthHistory)),
        ]);
        return results.reduce((sum, n) => sum + n, 0);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [user, integration, push],
  );

  return {
    /** { spreadsheetId, spreadsheetUrl, connectedAt } or null when disconnected */
    integration,
    connected: !!integration,
    /** true while the initial Firestore snapshot is loading */
    loading: integration === undefined,
    syncing,
    error,
    connect,
    disconnect,
    push,
    pull,
    syncAll,
  };
}
