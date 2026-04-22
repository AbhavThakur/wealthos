// Google Sheets integration card — shown in Settings page
// Handles connect/disconnect and full sync (all 8 tabs).
// Pull (import from Sheet) shows a row-count preview before importing.

import { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Loader2,
  Sheet,
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
  const { p1, p2, shared } = useData();
  const [syncMsg, setSyncMsg] = useState(null);
  const [pullPreview, setPullPreview] = useState(null); // { sheetName, rows }
  const [pulling, setPulling] = useState(false);

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
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          Sync your WealthOS data to a Google Sheet — share with your CA, do
          custom analysis, or add transactions directly in the sheet.
        </p>
        {error && (
          <p
            style={{
              fontSize: 12,
              color: "var(--red)",
              marginBottom: 10,
            }}
          >
            ⚠ {error}
          </p>
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
      const total = await syncAll(p1, p2, shared);
      setSyncMsg({ ok: true, text: `✓ Synced ${total} rows across 8 tabs` });
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

  return (
    <div style={card}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Google Sheets</span>
        <span style={badge("#22c55e")}>Connected</span>
      </div>

      {/* Sheet link */}
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
          marginBottom: 14,
        }}
      >
        <ExternalLink size={12} />
        Open WealthOS Finance sheet
      </a>

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
        <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 10 }}>
          ⚠ {error}
        </p>
      )}

      {/* Sync All button */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
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
          {syncing ? "Syncing..." : "Sync All to Sheet"}
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
            fontSize: 13,
          }}
        >
          <LogOut size={13} />
          Disconnect
        </button>
      </div>

      {/* Pull (import) section */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 12,
          marginTop: 4,
        }}
      >
        <span style={label}>Import from Sheet (preview before applying)</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Transactions_P1", "Transactions_P2", "Goals"].map((tab) => (
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
          marginTop: 10,
        }}
      >
        Connected {new Date(integration.connectedAt).toLocaleDateString()} ·
        Firestore is always the source of truth
      </p>
    </div>
  );
}
