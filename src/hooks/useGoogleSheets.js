// Hook — Google Sheets integration state and actions
//
// Reads live integration status from Firestore (onSnapshot — zero polling).
// Exposes: connect, disconnect, push, pull, syncAll
//
// connect() — opens OAuth popup; Firestore updates automatically on success
// disconnect() — revokes token + deletes Firestore doc
// push(sheetName, rows) — write rows to a specific tab
// pull(sheetName) — read rows from a specific tab
// syncAll(p1, p2, shared, personNames) — push all 7 AI-ready tabs

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, IS_DEV } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  toMonthlySummaryRows,
  toUnifiedTransactionRows,
  toBudgetVsActualRows,
  toInvestmentAssetRows,
  toGoalsTrackerRows,
  toNetWorthTimelineRows,
  toAIPromptsRows,
} from "../utils/sheetsTransformers";

// Re-export transformers for convenience & testability
export {
  toMonthlySummaryRows,
  toUnifiedTransactionRows,
  toBudgetVsActualRows,
  toInvestmentAssetRows,
  toGoalsTrackerRows,
  toNetWorthTimelineRows,
  toAIPromptsRows,
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useGoogleSheets() {
  const { user } = useAuth();
  // undefined = loading, null = disconnected, object = connected
  const [integration, setIntegration] = useState(undefined);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const docName = IS_DEV ? "google_dev" : "google";
  const envParam = IS_DEV ? "dev" : "prod";

  // Live-watch the environment-isolated Firestore integration doc
  useEffect(() => {
    if (!user || user.isDemo) {
      setIntegration(null);
      return;
    }
    const ref = doc(db, "households", user.uid, "integrations", docName);
    return onSnapshot(
      ref,
      (snap) => setIntegration(snap.exists() ? snap.data() : null),
      () => setIntegration(null),
    );
  }, [user, docName]);

  // Listen for postMessage from OAuth popup so we can show a toast in parent
  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "SHEETS_OAUTH") return;
      // Firestore onSnapshot will update integration state automatically.
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function safeJson(res) {
    const text = await res.text().catch(() => "");
    if (!text) {
      if (res.status === 404) {
        return {
          ok: false,
          error: "Google Sheets sync API endpoint is not reachable (HTTP 404). Please verify backend deployment and environment variables.",
        };
      }
      return {
        ok: false,
        error: `Empty response from server (HTTP ${res.status || "Unknown"})`,
      };
    }
    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: `Server response error (HTTP ${res.status}): ${text.slice(0, 120)}`,
      };
    }
  }

  // Opens Google OAuth in a popup (falls back to redirect if popup blocked)
  const connect = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/google-auth?action=url&uid=${encodeURIComponent(user.uid)}&env=${envParam}`,
      );
      const data = await safeJson(res);
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
  }, [user, envParam]);

  // Revokes Google token and removes the environment-specific Firestore doc
  const disconnect = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/google-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", uid: user.uid, env: envParam }),
      });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || "Disconnect failed");
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [user, envParam]);

  // Push an array of row objects to a specific sheet tab
  const push = useCallback(
    async (sheetName, rows) => {
      if (!user || !integration) return 0;
      const res = await fetch("/api/sheets-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, sheetName, rows, env: envParam }),
      });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || "Push failed");
      return data.updatedRows ?? 0;
    },
    [user, integration, envParam],
  );

  // Pull rows from a specific sheet tab
  const pull = useCallback(
    async (sheetName) => {
      if (!user || !integration) return [];
      const res = await fetch("/api/sheets-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, sheetName, env: envParam }),
      });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || "Pull failed");
      return data.rows || [];
    },
    [user, integration, envParam],
  );

  // Push all 7 AI-ready tabs from current WealthOS state
  const syncAll = useCallback(
    async (p1, p2, shared, personNames = { p1: "Person 1", p2: "Person 2" }) => {
      if (!user || !integration) return 0;
      setSyncing(true);
      setError(null);
      try {
        const monthlySummary = toMonthlySummaryRows(p1, p2, shared, personNames);
        const transactions = toUnifiedTransactionRows(p1, p2, shared, personNames);
        const budgetVsActual = toBudgetVsActualRows(p1, p2, shared, personNames);
        const investments = toInvestmentAssetRows(p1, p2, shared, personNames);
        const goals = toGoalsTrackerRows(p1, p2, shared, personNames);
        const netWorth = toNetWorthTimelineRows(p1, p2, shared);
        const aiPrompts = toAIPromptsRows();

        const results = await Promise.all([
          push("Monthly_Summary", monthlySummary),
          push("All_Transactions", transactions),
          push("Budget_vs_Actual", budgetVsActual),
          push("Investments_&_Assets", investments),
          push("Goals_Tracker", goals),
          push("Net_Worth_History", netWorth),
          push("AI_Prompts_&_Formulas", aiPrompts),
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
    isDev: IS_DEV,
    connect,
    disconnect,
    push,
    pull,
    syncAll,
  };
}
