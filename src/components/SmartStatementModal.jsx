import { useState, useRef } from "react";
import {
  parseBankStatement,
  flagDuplicateTransactions,
} from "../utils/statementParser";
import { fmt, EXPENSE_CATEGORIES } from "../utils/finance";
import {
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";

export default function SmartStatementModal({
  open,
  onClose,
  p1,
  p2,
  personNames = { p1: "Partner 1", p2: "Partner 2" },
  updatePerson,
  onSuccessToast,
}) {
  const [targetPerson, setTargetPerson] = useState("p1");
  const [step, setStep] = useState("upload"); // "upload" | "review" | "done"
  const [transactions, setTransactions] = useState([]);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef(null);

  const activePersonData = targetPerson === "p1" ? p1 : p2;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result || "";
      processStatementText(text);
    };
    reader.readAsText(file);
  };

  const processStatementText = (text) => {
    const parsed = parseBankStatement(text);
    const flagged = flagDuplicateTransactions(
      parsed,
      activePersonData?.transactions || [],
      activePersonData?.expenses || []
    );
    setTransactions(flagged);
    setStep("review");
  };

  const loadSampleStatement = () => {
    const sample = `
Date,Narration,Withdrawal,Deposit
14/08/2026,UPI-SWIGGY-192834,480.00,
14/08/2026,BLINKIT COMMERCE BANGALORE,1240.00,
13/08/2026,UBER INDIA TRIPS,320.00,
12/08/2026,NETFLIX INDIA MONTHLY,649.00,
11/08/2026,APOLLO PHARMACY INDIRANAGAR,850.00,
10/08/2026,HDFC HOUSING LOAN AUTO DEBIT,45000.00,
01/08/2026,SALARY CREDIT AUG 2026, ,198555.00
    `.trim();
    processStatementText(sample);
  };

  const toggleSelectAll = (select) => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        selected: select ? !t.isDuplicate : false,
      }))
    );
  };

  const toggleItem = (index) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateCategory = (index, newCat) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, category: newCat } : t))
    );
  };

  const handleCommit = () => {
    const toImport = transactions.filter((t) => t.selected);
    if (toImport.length === 0) return;

    const existingTxns = activePersonData?.transactions || [];
    const newTxns = [
      ...existingTxns,
      ...toImport.map((t, idx) => ({
        id: Date.now() + idx,
        date: t.date,
        desc: t.desc,
        amount: t.amount,
        type: t.amount > 0 ? "income" : "expense",
        category: t.category,
        imported: true,
      })),
    ];

    if (typeof updatePerson === "function") {
      if (updatePerson.length === 2) {
        updatePerson("transactions", newTxns);
      } else {
        updatePerson(targetPerson, "transactions", newTxns);
      }
    }

    setImportedCount(toImport.length);
    setStep("done");

    if (onSuccessToast) {
      onSuccessToast(`Imported ${toImport.length} transactions into ${personNames[targetPerson]}'s statement!`);
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(10px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(59, 130, 246, 0.15)",
                color: "var(--p1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Smart Bank Statement Ingestion
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Auto-categorize transactions and detect duplicate entries with zero hassle
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {step === "upload" && (
            <div>
              {/* Target Person Selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, display: "block" }}>
                  Select Account Owner:
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className={`profile-pill ${targetPerson === "p1" ? "active" : ""}`}
                    onClick={() => setTargetPerson("p1")}
                    style={{
                      "--pill-color": "var(--p1)",
                      "--pill-dim": "var(--p1-dim)",
                      padding: "8px 16px",
                      fontSize: 13,
                    }}
                  >
                    <span className="profile-pill-dot" />
                    {personNames.p1}
                  </button>
                  <button
                    className={`profile-pill ${targetPerson === "p2" ? "active" : ""}`}
                    onClick={() => setTargetPerson("p2")}
                    style={{
                      "--pill-color": "var(--p2)",
                      "--pill-dim": "var(--p2-dim)",
                      padding: "8px 16px",
                      fontSize: 13,
                    }}
                  >
                    <span className="profile-pill-dot" />
                    {personNames.p2}
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "rgba(255, 255, 255, 0.02)",
                  transition: "all 0.2s ease",
                  marginBottom: 16,
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  style={{ display: "none" }}
                />
                <Upload size={32} style={{ color: "var(--p1)", margin: "0 auto 12px", opacity: 0.8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  Drop Bank Statement (.csv or .txt from HDFC, ICICI, SBI, Axis, Kotak)
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  or click to select from your files
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Want to try a demo statement? </span>
                <button
                  onClick={loadSampleStatement}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--p1)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Load 7 Sample Bank Transactions
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div>
              {/* Batch selection toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedCount} of {transactions.length} selected
                  </span>
                  {duplicateCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(245, 158, 11, 0.12)",
                        color: "var(--yellow)",
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ {duplicateCount} duplicate{duplicateCount > 1 ? "s" : ""} skipped
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => toggleSelectAll(true)} className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}>
                    Select Non-Duplicates
                  </button>
                  <button onClick={() => toggleSelectAll(false)} className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}>
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Transactions Review Table */}
              <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 255, 255, 0.04)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ width: 36, padding: "10px 10px", textAlign: "center" }}>✓</th>
                      <th style={{ padding: "10px 10px" }}>Date</th>
                      <th style={{ padding: "10px 10px" }}>Narration</th>
                      <th style={{ padding: "10px 10px" }}>Category</th>
                      <th style={{ padding: "10px 10px", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr
                        key={i}
                        style={{
                          borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                          opacity: t.isDuplicate ? 0.65 : 1,
                          background: t.selected ? "rgba(59, 130, 246, 0.03)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={t.selected}
                            onChange={() => toggleItem(i)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                          {t.date}
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 500, maxWidth: 220 }}>
                          <div>{t.desc}</div>
                          {t.isDuplicate && (
                            <div style={{ fontSize: 10, color: "var(--yellow)", marginTop: 2 }}>
                              ⚠️ {t.duplicateReason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <select
                            value={t.category}
                            onChange={(e) => updateCategory(i, e.target.value)}
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              background: "var(--bg-card2)",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                            }}
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="Income">Income</option>
                          </select>
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: t.amount > 0 ? "var(--green)" : "var(--red)",
                          }}
                        >
                          {t.amount > 0 ? `+${fmt(t.amount)}` : `-${fmt(Math.abs(t.amount))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "var(--green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
                Statement Imported Successfully!
              </h4>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
                {importedCount} transactions have been added to {personNames[targetPerson]}'s statement ledger.
              </p>
              <button onClick={onClose} className="btn-primary" style={{ padding: "8px 24px" }}>
                Done & View Budget
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.2)",
            }}
          >
            <button onClick={() => setStep("upload")} className="btn-ghost" style={{ fontSize: 12 }}>
              ← Back
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                opacity: selectedCount === 0 ? 0.5 : 1,
              }}
            >
              Import {selectedCount} Transactions into {personNames[targetPerson]} <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
