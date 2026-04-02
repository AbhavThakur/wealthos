import { useState, useRef } from "react";
import { Upload, Check, AlertTriangle } from "lucide-react";
import {
  parseCSV,
  autoDetectColumns,
  mapToTransactions,
} from "../utils/csvImport";
import { fmt } from "../utils/finance";

export default function CSVImport({ onImport, personName }) {
  const [step, setStep] = useState("upload"); // upload | map | preview | done
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (
      !file.name.endsWith(".csv") &&
      !file.type.includes("csv") &&
      !file.type.includes("text")
    ) {
      setResult({ error: "Please upload a .csv file" });
      return;
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setResult({ error: "File too large (max 5MB)" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const { headers, rows } = parseCSV(text);
      if (rows.length === 0) {
        setResult({ error: "No data rows found in file" });
        return;
      }
      const auto = autoDetectColumns(headers);
      setParsed({ headers, rows });
      setMapping(auto);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const doPreview = () => {
    if (!mapping.date || !mapping.description) return;
    const txns = mapToTransactions(parsed.rows, mapping);
    setPreview(txns);
    setStep("preview");
  };

  const doImport = () => {
    onImport(preview);
    setResult({ count: preview.length });
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setPreview([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="card section-gap">
      <div className="card-title">📊 Import Bank Statement</div>

      {result?.error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--red-dim)",
            border: "1px solid rgba(224,92,92,0.3)",
            color: "var(--red)",
            fontSize: 13,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertTriangle size={14} /> {result.error}
        </div>
      )}

      {step === "upload" && (
        <div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            Upload a CSV bank statement to auto-import transactions for{" "}
            {personName}. Supports most Indian bank formats.
          </p>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 16px",
              border: "2px dashed var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              transition: "border-color 0.2s",
              textAlign: "center",
            }}
          >
            <Upload size={24} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Drop a CSV file here or click to browse
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      {step === "map" && parsed && (
        <div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginBottom: 12,
            }}
          >
            Found{" "}
            <strong style={{ color: "var(--gold)" }}>
              {parsed.rows.length}
            </strong>{" "}
            rows. Map the columns to WealthOS fields:
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              { key: "date", label: "Date column" },
              { key: "description", label: "Description" },
              { key: "debit", label: "Debit / Withdrawal" },
              { key: "credit", label: "Credit / Deposit" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {label}{" "}
                  {(key === "date" || key === "description") && (
                    <span style={{ color: "var(--red)" }}>*</span>
                  )}
                </label>
                <select
                  value={mapping[key] || ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: e.target.value })
                  }
                >
                  <option value="">— Select —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={reset}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={doPreview}
              disabled={!mapping.date || !mapping.description}
            >
              Preview Import
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginBottom: 10,
            }}
          >
            <strong style={{ color: "var(--green)" }}>{preview.length}</strong>{" "}
            transactions ready to import
            {preview.length !== parsed?.rows.length && (
              <span style={{ color: "var(--text-muted)" }}>
                {" "}
                (skipped {parsed.rows.length - preview.length} invalid rows)
              </span>
            )}
          </p>
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              marginBottom: 12,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          >
            {preview.slice(0, 20).map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    color: "var(--text-muted)",
                    width: 80,
                    flexShrink: 0,
                  }}
                >
                  {t.date}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    padding: "0 8px",
                  }}
                >
                  {t.desc}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: t.amount > 0 ? "var(--green)" : "var(--red)",
                    flexShrink: 0,
                  }}
                >
                  {t.amount > 0 ? "+" : ""}
                  {fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
            {preview.length > 20 && (
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                ...and {preview.length - 20} more
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setStep("map")}>
              Back
            </button>
            <button className="btn-primary" onClick={doImport}>
              Import {preview.length} transactions
            </button>
          </div>
        </div>
      )}

      {step === "done" && result?.count && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Check size={32} style={{ color: "var(--green)", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            {result.count} transactions imported!
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Check your Cash Flow page to see the imported data.
          </div>
          <button className="btn-ghost" onClick={reset}>
            Import another
          </button>
        </div>
      )}
    </div>
  );
}
