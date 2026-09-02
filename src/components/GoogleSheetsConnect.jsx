// Google Sheets integration card — shown in Settings page
// Handles connect/disconnect and AI-ready full sync (7 structured tabs).
// Includes Gemini in Sheets AI prompt suggestions and tab breakdown.

import { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Loader2,
  Sheet,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useGoogleSheets } from "../hooks/useGoogleSheets";
import { useData } from "../context/DataContext";

const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "1.25rem",
  marginBottom: "1rem",
};
const label = {
  fontSize: 12,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};
const badge = (color) => ({
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 4,
  background: `${color}22`,
  color,
  fontWeight: 600,
  letterSpacing: ".05em",
  textTransform: "uppercase",
});

const AI_TABS = [
  { name: "Monthly_Summary", color: "#10B981", desc: "Executive monthly rollups, savings rate & surplus" },
  { name: "All_Transactions", color: "#3B82F6", desc: "Unified ledger with person & month dimensions" },
  { name: "Budget_vs_Actual", color: "#F59E0B", desc: "Category-level variance & 50/30/20 utilization" },
  { name: "Investments_&_Assets", color: "#6366F1", desc: "Portfolio allocation, SIPs & current corpus" },
  { name: "Goals_Tracker", color: "#8B5CF6", desc: "Target progress, deadlines & monthly SIP needed" },
  { name: "Net_Worth_History", color: "#14B8A6", desc: "Assets, liabilities & MoM growth timeline" },
  { name: "AI_Prompts_&_Formulas", color: "#F43F5E", desc: "Built-in Gemini prompts & =AI() formula templates" },
];

const SAMPLE_PROMPTS = [
  {
    title: "🌟 Master Canvas: All-in-One Household Financial Command Center",
    prompt: 'Turn this entire spreadsheet into an executive visual dashboard on Sheets Canvas with 5 sections: 1) Top KPI scorecards for Total Net Worth, Monthly Savings Rate %, Monthly Surplus, and Active SIPs. 2) A multi-month bar chart from Monthly_Summary showing Incomes vs Expenses vs 50/30/20 breakdown. 3) An interactive Budget Matrix from Budget_vs_Actual with category utilization gauges and Over Budget alerts in red. 4) An Asset Allocation donut chart and MoM Net Worth growth timeline from Investments_&_Assets and Net_Worth_History. 5) Interactive goal funding progress cards from Goals_Tracker with partner splits (P1 vs P2) and deadline countdowns.',
  },
  {
    title: "🎨 Sheets Canvas: Net Worth & Monthly Health Dashboard",
    prompt: 'Create an interactive Sheets Canvas dashboard from Monthly_Summary and Net_Worth_History with KPI cards for Net Worth, Savings Rate, Active SIPs, and a monthly trend chart.',
  },
  {
    title: "🎨 Sheets Canvas: Goal Funding & Partner Split Tracker",
    prompt: 'Create a Sheets Canvas dashboard from Goals_Tracker displaying visual progress bars, partner contribution splits (P1 vs P2), and target countdowns.',
  },
  {
    title: "🎨 Sheets Canvas: Budget & 50/30/20 Spending Matrix",
    prompt: 'Create a Sheets Canvas mini-app from Budget_vs_Actual that visualizes our 50/30/20 breakdown with interactive category cards highlighting Over Budget areas in red.',
  },
  {
    title: "Executive Month Review",
    prompt: 'Summarize our financial performance from the Monthly_Summary tab over the last 3 months. Highlight our top savings wins and biggest spending anomalies in 3 bullet points.',
  },
  {
    title: "Find Spending Leaks",
    prompt: 'Analyze All_Transactions for the latest month. What are our top 5 discretionary expense categories and which single merchant took the most money?',
  },
  {
    title: "Budget Cutback Recommendations",
    prompt: 'Look at Budget_vs_Actual. For every category where status is Over Budget, recommend practical cutbacks to increase our savings rate to 35%.',
  },
  {
    title: "Net Worth Compound Growth",
    prompt: 'Based on our average monthly savings and SIP contributions in Investments_&_Assets and Monthly_Summary, estimate our Net Worth in 3 years at 12% CAGR.',
  },
];

export default function GoogleSheetsConnect() {
  const {
    integration,
    connected,
    loading,
    syncing,
    error,
    connect,
    disconnect,
    syncAll,
    pull,
  } = useGoogleSheets();
  const { p1, p2, shared, personNames } = useData();
  const [syncMsg, setSyncMsg] = useState(null);
  const [pullPreview, setPullPreview] = useState(null); // { sheetName, rows }
  const [pulling, setPulling] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  if (loading) return null;

  // ── Disconnected state ─────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Sheet size={18} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Google Sheets</span>
          <span style={badge("#a855f7")}>AI-Optimized</span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          Sync WealthOS data directly to Google Sheets in an <strong>AI-ready structured format</strong>.
          Use <strong>Gemini in Google Sheets</strong> to analyze your savings rate, find spending leaks,
          forecast net worth, and generate custom pivot tables.
        </p>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: "var(--red)",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ {error}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              To connect Google Sheets, add your Google Cloud OAuth credentials to <code>.env.local</code>:
              <pre style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 4, marginTop: 6, userSelect: "all" }}>
{`GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret`}
              </pre>
              Authorized Redirect URI in Google Cloud Console:
              <pre style={{ background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 4, marginTop: 4, userSelect: "all" }}>
{window.location.origin}/api/google-auth
              </pre>
            </div>
          </div>
        )}
        <button className="btn-primary" onClick={connect}>
          Connect Google Sheets
        </button>
      </div>
    );
  }

  // ── Connected state ────────────────────────────────────────────────────────
  const handleSyncAll = async () => {
    setSyncMsg(null);
    try {
      const total = await syncAll(p1, p2, shared, personNames);
      setSyncMsg({ ok: true, text: `✓ Successfully synced ${total} rows across 7 AI-ready tabs` });
    } catch {
      setSyncMsg({
        ok: false,
        text: "Sync failed — check connection and retry",
      });
    }
    setTimeout(() => setSyncMsg(null), 6000);
  };

  const handlePull = async (sheetName) => {
    setPulling(true);
    setPullPreview(null);
    try {
      const rows = await pull(sheetName);
      setPullPreview({ sheetName, rows });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
      setTimeout(() => setSyncMsg(null), 6000);
    } finally {
      setPulling(false);
    }
  };

  const handleCopyPrompt = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  return (
    <div style={card}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Google Sheets</span>
        <span style={badge("#22c55e")}>Connected</span>
        <span style={badge("#8b5cf6")}>
          <Sparkles size={10} style={{ display: "inline", marginRight: 3 }} />
          Gemini AI Ready
        </span>
        {integration.sheetTitle?.includes("[DEV]") ? (
          <span style={badge("#3b82f6")}>DEV SHEET</span>
        ) : (
          <span style={badge("#a855f7")}>PROD SHEET</span>
        )}
      </div>

      {/* Sheet link & Last Synced info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <a
          href={integration.spreadsheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            color: "var(--gold)",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={12} />
          Open {integration.sheetTitle || "WealthOS Finance"} sheet
        </a>
        {integration.lastSyncedAt && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            🕒 Last synced: {new Date(integration.lastSyncedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
          </span>
        )}
      </div>

      {/* Status message */}
      {syncMsg && (
        <p
          style={{
            fontSize: 12,
            color: syncMsg.ok ? "#22c55e" : "var(--red)",
            marginBottom: 10,
          }}
        >
          {syncMsg.text}
        </p>
      )}
      {error && !syncMsg && (
        <div
          style={{
            fontSize: 12,
            color: "var(--red)",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 600 }}>⚠ {error}</div>
          {error.includes("invalid_grant") || error.includes("expired") || error.includes("revoked") ? (
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Google OAuth tokens expire after 7 days if the Google Cloud app is in <em>Testing</em> mode.
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  className="btn-primary"
                  onClick={connect}
                  style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <RefreshCw size={11} /> Reconnect Google Sheets
                </button>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  (To make tokens permanent, publish your app to <strong>In Production</strong> in Google Cloud Console)
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}
      >
        <button
          className="btn-primary"
          onClick={handleSyncAll}
          disabled={syncing}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {syncing ? (
            <Loader2
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <RefreshCw size={14} />
          )}
          {syncing ? "Syncing 7 Tabs..." : "Sync All (7 AI Tabs)"}
        </button>

        <button
          className="btn-ghost"
          onClick={() => setShowPrompts(!showPrompts)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        >
          <Sparkles size={13} style={{ color: "var(--gold)" }} />
          Gemini AI Prompts
          {showPrompts ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <button
          className="btn-ghost"
          onClick={() => {
            if (
              window.confirm(
                "Disconnect Google Sheets? Your sheet data will not be deleted.",
              )
            ) {
              disconnect();
            }
          }}
          disabled={syncing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            marginLeft: "auto",
          }}
        >
          <LogOut size={13} />
          Disconnect
        </button>
      </div>

      {/* Expandable AI Prompts helper */}
      {showPrompts && (
        <div
          style={{
            background: "var(--bg-card2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--gold)",
              marginBottom: 8,
            }}
          >
            <Sparkles size={14} />
            Copy & Ask Gemini in your Google Sheet:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SAMPLE_PROMPTS.map((p, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    "{p.prompt}"
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => handleCopyPrompt(p.prompt, idx)}
                  style={{ padding: "4px 8px", fontSize: 11, flexShrink: 0 }}
                  title="Copy prompt"
                >
                  {copiedIdx === idx ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Breakdown */}
      <div style={{ marginBottom: 12 }}>
        <span style={label}>AI-Structured Tabs Included in Sync:</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 6,
            marginTop: 6,
          }}
        >
          {AI_TABS.map((t) => (
            <div
              key={t.name}
              style={{
                fontSize: 11,
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--bg-card2)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: t.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ color: "var(--text-primary)" }}>{t.name}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pull (import from sheet) */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 12,
          marginTop: 8,
        }}
      >
        <span style={label}>Import from Sheet (preview before applying)</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["All_Transactions", "Goals_Tracker", "Budget_vs_Actual"].map((tab) => (
            <button
              key={tab}
              className="btn-ghost"
              onClick={() => handlePull(tab)}
              disabled={pulling || syncing}
              style={{ fontSize: 12 }}
            >
              {pulling && pullPreview === null ? "..." : `↓ ${tab}`}
            </button>
          ))}
        </div>

        {/* Pull preview */}
        {pullPreview && (
          <div
            style={{
              marginTop: 12,
              background: "var(--bg-card2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <strong>{pullPreview.sheetName}</strong>
              <span style={{ color: "var(--text-muted)" }}>
                {pullPreview.rows.length} rows
              </span>
            </div>
            {pullPreview.rows.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Sheet tab is empty.</p>
            ) : (
              <>
                <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
                  Preview (first 3 rows):
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      fontSize: 11,
                      borderCollapse: "collapse",
                      width: "100%",
                    }}
                  >
                    <thead>
                      <tr>
                        {Object.keys(pullPreview.rows[0])
                          .filter((k) => !k.startsWith("_synced"))
                          .map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: "3px 8px",
                                color: "var(--text-muted)",
                                borderBottom: "1px solid var(--border)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pullPreview.rows.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {Object.entries(row)
                            .filter(([k]) => !k.startsWith("_synced"))
                            .map(([k, v]) => (
                              <td
                                key={k}
                                style={{
                                  padding: "3px 8px",
                                  borderBottom: "1px solid var(--border)",
                                  whiteSpace: "nowrap",
                                  maxWidth: 140,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {v}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p
                  style={{
                    color: "var(--text-muted)",
                    marginTop: 10,
                    fontStyle: "italic",
                  }}
                >
                  Import merging is coming soon. For now, use the CSV import in
                  Settings to apply Sheet data.
                </p>
              </>
            )}
            <button
              className="btn-ghost"
              onClick={() => setPullPreview(null)}
              style={{ marginTop: 8, fontSize: 11 }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 12,
        }}
      >
        Connected {new Date(integration.connectedAt).toLocaleDateString()} ·
        Firestore is always the source of truth
      </p>
    </div>
  );
}
