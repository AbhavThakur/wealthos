import { useState, useMemo, useRef } from "react";
import { parseCASText, diffCASHoldings, mergeCASHoldings } from "../utils/casParser";
import { fmt } from "../utils/finance";
import {
  Upload,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  X,
} from "lucide-react";

export default function CASImportModal({
  open,
  onClose,
  p1,
  p2,
  personNames = { p1: "Partner 1", p2: "Partner 2" },
  updatePerson,
  onSuccessToast,
}) {
  const [targetPerson, setTargetPerson] = useState("p1");
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState("upload"); // "upload" | "review" | "done"
  const [importStats, setImportStats] = useState(null);
  const fileInputRef = useRef(null);

  const existingInvestments = useMemo(() => {
    return targetPerson === "p1" ? p1?.investments || [] : p2?.investments || [];
  }, [targetPerson, p1?.investments, p2?.investments]);

  const parsedHoldings = useMemo(() => {
    if (!rawText) return [];
    return parseCASText(rawText);
  }, [rawText]);

  const diffResult = useMemo(() => {
    if (parsedHoldings.length === 0) return { toAdd: [], toUpdate: [], unchanged: [] };
    return diffCASHoldings(parsedHoldings, existingInvestments);
  }, [parsedHoldings, existingInvestments]);

  const allDiffItems = useMemo(() => {
    return [...diffResult.toAdd, ...diffResult.toUpdate];
  }, [diffResult]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result || "";
      setRawText(text);
      setStep("review");
    };
    reader.readAsText(file);
  };

  const loadSampleCAS = () => {
    const sample = `
Scheme Name,Folio Number,Closing Balance,Current NAV,Cost Value,Current Value
Parag Parikh Flexi Cap Fund Direct Growth,12491/88,1450.25,76.40,75000,110799
UTI Nifty 50 Index Fund Direct Growth,98213/44,820.50,168.10,95000,137926
Mirae Asset Midcap Fund Direct Growth,45120/12,510.00,38.90,15000,19839
Nippon India Small Cap Fund Direct,78120/33,640.00,145.20,50000,92928
HDFC Liquid Fund Direct Plan Growth,33190/90,200.00,4500.00,850000,900000
    `.trim();
    setRawText(sample);
    setStep("review");
  };

  const handleCommitImport = () => {
    const approvedItems = allDiffItems;
    const merged = mergeCASHoldings(existingInvestments, approvedItems);
    
    if (typeof updatePerson === "function") {
      if (updatePerson.length === 2) {
        updatePerson("investments", merged);
      } else {
        updatePerson(targetPerson, "investments", merged);
      }
    }

    setImportStats({
      added: diffResult.toAdd.length,
      updated: diffResult.toUpdate.length,
      totalVal: approvedItems.reduce((s, i) => s + (i.currentValue || 0), 0),
    });
    setStep("done");

    if (onSuccessToast) {
      onSuccessToast(`Imported ${diffResult.toAdd.length} new & updated ${diffResult.toUpdate.length} mutual funds into ${personNames[targetPerson]}'s portfolio!`);
    }
  };

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
          maxWidth: 780,
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
                background: "rgba(234, 179, 8, 0.15)",
                color: "var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                1-Click CAS eCAS Portfolio Ingestion
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Import CAMS / KFintech / CDSL / NSDL statements into WealthOS
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
                  Select Portfolio Owner:
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
                <Upload size={32} style={{ color: "var(--gold)", margin: "0 auto 12px", opacity: 0.8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  Drop your CAMS / KFintech CAS Statement (.csv or .txt)
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  or click to browse from your computer
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Don't have a CAS file handy? </span>
                <button
                  onClick={loadSampleCAS}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--gold)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Load 5 Sample Indian Mutual Funds
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div>
              {/* Diff summary pills */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "var(--green)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={14} /> {diffResult.toAdd.length} New Holdings
                </div>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(59, 130, 246, 0.12)",
                    color: "var(--p1)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} /> {diffResult.toUpdate.length} Updated Valuations
                </div>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {diffResult.unchanged.length} Unchanged
                </div>
              </div>

              {/* Review Table */}
              <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 255, 255, 0.04)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Scheme / Fund</th>
                      <th style={{ padding: "10px 12px" }}>Category</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Units</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Current Value</th>
                      <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDiffItems.map((item, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                          <div>{item.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Folio: {item.folio || "N/A"}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "rgba(255, 255, 255, 0.06)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {item.units ? item.units.toLocaleString("en-IN") : "-"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>
                          {fmt(item.currentValue)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {item.action === "add" ? (
                            <span style={{ color: "var(--green)", fontWeight: 600, fontSize: 11 }}>+ NEW</span>
                          ) : (
                            <span style={{ color: "var(--p1)", fontWeight: 600, fontSize: 11 }}>↻ UPDATE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "done" && importStats && (
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
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
                Portfolio Synchronized Successfully!
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 460, margin: "0 auto 20px" }}>
                Added {importStats.added} new holdings and updated {importStats.updated} mutual funds worth {fmt(importStats.totalVal)}.
              </p>
              <button onClick={onClose} className="btn-primary" style={{ padding: "8px 24px" }}>
                Done & View Portfolio
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
              onClick={handleCommitImport}
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
            >
              Import {allDiffItems.length} Holdings into {personNames[targetPerson]} <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
