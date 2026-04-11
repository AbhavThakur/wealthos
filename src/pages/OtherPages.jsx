import { useState } from "react";
import { hashPin } from "../utils/hashPin";
import { useSessionState } from "../hooks/useSessionState";
import { fmt, nextId, EXPENSE_CATEGORIES, calcEMI } from "../utils/finance";
import { Plus, Trash2, Search, Sparkles, Calendar } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { useUndoToast } from "../hooks/useUndoToast";
import { useData } from "../context/DataContext";
import ThemeToggle from "../components/ThemeToggle";
import RELEASE_NOTES from "../data/releaseNotes";
import { APP_VERSION } from "../components/UpdateBanner";
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  enrollBiometric,
  removeBiometric,
} from "../utils/biometric";
import CSVImport from "../components/CSVImport";

export function Debts({ data, personName, personColor, updatePerson }) {
  const debts = data?.debts || [];
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    name: "",
    outstanding: "",
    rate: "",
    tenure: "",
  });
  const [prepay, setPrepay] = useState({ loanId: "", amount: "" });
  const { confirm, dialog } = useConfirm();

  const totalEMI = debts.reduce((s, d) => s + d.emi, 0);
  const totalOut = debts.reduce((s, d) => s + d.outstanding, 0);
  const income = data?.incomes?.reduce((s, x) => s + x.amount, 0) ?? 0;
  const dti = income > 0 ? Math.round((totalEMI / income) * 100) : 0;

  const add = () => {
    if (!n.name || !n.outstanding || !n.rate || !n.tenure) return;
    if (
      Number(n.outstanding) <= 0 ||
      Number(n.rate) <= 0 ||
      Number(n.tenure) <= 0
    )
      return;
    const emi = calcEMI(
      Number(n.outstanding),
      Number(n.rate),
      Number(n.tenure),
    );
    updatePerson("debts", [
      ...debts,
      {
        ...n,
        id: nextId(debts),
        outstanding: Number(n.outstanding),
        emi,
        rate: Number(n.rate),
        tenure: Number(n.tenure),
      },
    ]);
    setN({ name: "", outstanding: "", rate: "", tenure: "" });
    setShowAdd(false);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Debts & EMIs
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Total outstanding</div>
          <div className="metric-value red-text">{fmt(totalOut)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly EMI</div>
          <div
            className="metric-value"
            style={{ color: dti > 30 ? "var(--red)" : "var(--gold)" }}
          >
            {fmt(totalEMI)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Debt-to-income</div>
          <div
            className="metric-value"
            style={{ color: dti > 30 ? "var(--red)" : "var(--green)" }}
          >
            {dti}%
          </div>
          <div className="metric-sub">
            {dti > 30 ? "⚠️ Above 30%" : "✓ Safe"}
          </div>
        </div>
      </div>
      {debts.length > 0 && (
        <div className="card section-gap">
          <div className="card-title">Active loans</div>
          {debts.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 2 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {d.rate}% · {d.tenure} months remaining
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13 }}>
                  Outstanding:{" "}
                  <strong style={{ color: "var(--red)" }}>
                    {fmt(d.outstanding)}
                  </strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  EMI: <strong>{fmt(d.emi)}</strong>
                </div>
              </div>
              <button
                className="btn-danger"
                aria-label={`Delete ${d.name}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Delete loan?",
                      `Remove "${d.name}" and its EMI?`,
                    )
                  )
                    updatePerson(
                      "debts",
                      debts.filter((x) => x.id !== d.id),
                    );
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Paydown Timeline ──────────────────────────────────────────── */}
      {debts.length > 0 && (
        <div className="card section-gap">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Calendar size={15} color="var(--gold)" />
            <span className="card-title" style={{ margin: 0 }}>
              📅 Paydown Timeline
            </span>
          </div>

          {/* Find the earliest end date to set the bar scale */}
          {(() => {
            const now = new Date();
            const debtRows = [...debts]
              .sort((a, b) => a.tenure - b.tenure)
              .map((d) => {
                const endDate = new Date(
                  now.getFullYear(),
                  now.getMonth() + d.tenure,
                  1,
                );
                const totalInterest = Math.round(
                  d.emi * d.tenure - d.outstanding,
                );
                const endLabel = endDate.toLocaleDateString("en-IN", {
                  month: "short",
                  year: "numeric",
                });
                return { ...d, endDate, endLabel, totalInterest };
              });
            const maxTenure = Math.max(...debtRows.map((d) => d.tenure), 1);
            const totalInterestAll = debtRows.reduce(
              (s, d) => s + Math.max(0, d.totalInterest),
              0,
            );

            return (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  {debtRows.map((d, idx) => {
                    const pct = Math.round((d.tenure / maxTenure) * 100);
                    const barColors = [
                      "var(--red)",
                      "#f97316",
                      "var(--gold)",
                      "var(--green)",
                    ];
                    const color = barColors[idx % barColors.length];
                    return (
                      <div key={d.id}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                            gap: 8,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {d.name}
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: color + "22",
                                  color,
                                }}
                              >
                                {d.rate}%
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                marginTop: 2,
                              }}
                            >
                              Ends {d.endLabel} · {d.tenure} months left · Total
                              interest:{" "}
                              <span style={{ color: "var(--red)" }}>
                                {fmt(Math.max(0, d.totalInterest))}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                color: "var(--red)",
                              }}
                            >
                              {fmt(d.outstanding)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {fmt(d.emi)}/mo
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: "var(--bg-card2)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: pct + "%",
                              height: "100%",
                              background: color,
                              borderRadius: 4,
                              transition: "width 0.5s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total interest summary */}
                <div
                  style={{
                    background: "var(--bg-card2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Total interest you'll pay across all loans
                  </span>
                  <strong style={{ color: "var(--red)", fontSize: 15 }}>
                    {fmt(totalInterestAll)}
                  </strong>
                </div>
                <div className="tip" style={{ marginTop: 10 }}>
                  💡 Even a single prepayment on the highest-rate loan above can
                  save {fmt(Math.round(debtRows[0]?.totalInterest * 0.15 || 0))}{" "}
                  in interest — use the Prepayment Calculator below.
                </div>
              </>
            );
          })()}
        </div>
      )}
      {showAdd ? (
        <div className="card section-gap">
          <div className="card-title">Add Loan</div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            {[
              ["name", "Loan name", "text"],
              ["outstanding", "Outstanding (₹)", "number"],
              ["rate", "Interest rate (% p.a.)", "number"],
              ["tenure", "Remaining months", "number"],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  value={n[key]}
                  onChange={(e) => setN({ ...n, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {n.outstanding && n.rate && n.tenure && (
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              EMI:{" "}
              <strong>
                {fmt(
                  calcEMI(
                    Number(n.outstanding),
                    Number(n.rate),
                    Number(n.tenure),
                  ),
                )}
              </strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={add}>
              Add
            </button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-ghost"
          style={{
            width: "100%",
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Loan / EMI
        </button>
      )}
      {debts.length > 1 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div className="card-title">
            🏔️ Debt Avalanche (pay highest rate first)
          </div>
          {[...debts]
            .sort((a, b) => b.rate - a.rate)
            .map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: i === 0 ? "var(--red-dim)" : "var(--bg-card2)",
                    border: `1px solid ${i === 0 ? "var(--red)" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: i === 0 ? "var(--red)" : "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{d.name}</div>
                <span className={`tag ${d.rate > 12 ? "tag-red" : "tag-gold"}`}>
                  {d.rate}%
                </span>
                {i === 0 && <span className="tag tag-red">Pay first!</span>}
              </div>
            ))}
        </div>
      )}
      {debts.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div className="card-title">🧮 Prepayment Calculator</div>
          <div className="grid-2" style={{ marginBottom: 12, gap: 8 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Loan
              </label>
              <select
                value={prepay.loanId}
                onChange={(e) =>
                  setPrepay({ ...prepay, loanId: e.target.value })
                }
              >
                <option value="">Select loan</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Prepay amount (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 200000"
                value={prepay.amount}
                onChange={(e) =>
                  setPrepay({ ...prepay, amount: e.target.value })
                }
              />
            </div>
          </div>
          {(() => {
            const loan = debts.find(
              (d) => String(d.id) === String(prepay.loanId),
            );
            const amt = Number(prepay.amount);
            if (!loan || !amt || amt <= 0)
              return (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Select a loan and enter a prepayment amount to see impact.
                </div>
              );
            const newOut = Math.max(0, loan.outstanding - amt);
            const oldEMI = loan.emi;
            const oldTenure = loan.tenure;
            const totalOldInterest = oldEMI * oldTenure - loan.outstanding;
            const mr = loan.rate / 100 / 12;
            const newTenure =
              mr > 0
                ? Math.ceil(
                    Math.log(oldEMI / (oldEMI - newOut * mr)) /
                      Math.log(1 + mr),
                  )
                : Math.ceil(newOut / oldEMI);
            const totalNewInterest1 = oldEMI * newTenure - newOut;
            const newEMI = calcEMI(newOut, loan.rate, oldTenure);
            const totalNewInterest2 = newEMI * oldTenure - newOut;
            return (
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      Option A: Reduce tenure
                    </div>
                    <div style={{ fontSize: 13 }}>
                      New tenure:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {newTenure} months
                      </strong>{" "}
                      <span
                        style={{ color: "var(--text-muted)", fontSize: 11 }}
                      >
                        (was {oldTenure})
                      </span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Save:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {fmt(
                          Math.round(
                            Math.max(0, totalOldInterest - totalNewInterest1),
                          ),
                        )}
                      </strong>{" "}
                      interest
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      Option B: Reduce EMI
                    </div>
                    <div style={{ fontSize: 13 }}>
                      New EMI:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {fmt(newEMI)}
                      </strong>{" "}
                      <span
                        style={{ color: "var(--text-muted)", fontSize: 11 }}
                      >
                        (was {fmt(oldEMI)})
                      </span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Save:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {fmt(
                          Math.round(
                            Math.max(0, totalOldInterest - totalNewInterest2),
                          ),
                        )}
                      </strong>{" "}
                      interest
                    </div>
                  </div>
                </div>
                <div className="tip">
                  💡 Reducing tenure saves more interest. Reducing EMI improves
                  monthly cash flow.
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {dialog}
    </div>
  );
}

const ALL_CATS = ["Salary", "Investment", ...EXPENSE_CATEGORIES];

export function Transactions({ data, personName, personColor, updatePerson }) {
  const transactions = data?.transactions || [];
  const [search, setSearch] = useSessionState(`txn_search_${personName}`, "");
  const [filter, setFilter] = useSessionState(
    `txn_filter_${personName}`,
    "all",
  );
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const { dialog } = useConfirm();
  const { showUndo, toastEl } = useUndoToast();

  const add = () => {
    if (!n.desc || !n.amount) return;
    if (Number(n.amount) <= 0) return;
    const amt =
      n.type === "income"
        ? Math.abs(Number(n.amount))
        : -Math.abs(Number(n.amount));
    updatePerson("transactions", [
      { ...n, id: nextId(transactions), amount: amt },
      ...transactions,
    ]);
    setN({
      date: new Date().toISOString().slice(0, 10),
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
    });
    setShowAdd(false);
  };

  const filtered = transactions
    .filter(
      (t) =>
        (filter === "all" || t.type === filter) &&
        (t.desc.toLowerCase().includes(search.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIn = filtered
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Transactions
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">In</div>
          <div className="metric-value green-text">{fmt(totalIn)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Out</div>
          <div className="metric-value red-text">{fmt(totalOut)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net</div>
          <div
            className="metric-value"
            style={{
              color: totalIn - totalOut >= 0 ? "var(--green)" : "var(--red)",
            }}
          >
            {fmt(totalIn - totalOut)}
          </div>
        </div>
      </div>
      <div className="card">
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div style={{ flex: 1, position: "relative", minWidth: 160 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>
          {["all", "income", "expense", "investment"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background: filter === f ? "var(--gold-dim)" : "transparent",
                color: filter === f ? "var(--gold)" : "var(--text-secondary)",
                border:
                  filter === f
                    ? "1px solid var(--gold-border)"
                    : "1px solid var(--border)",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {showAdd && (
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={n.date}
                  onChange={(e) => setN({ ...n, date: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Description
                </label>
                <input
                  value={n.desc}
                  onChange={(e) => setN({ ...n, desc: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={n.amount}
                  onChange={(e) => setN({ ...n, amount: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Type
                </label>
                <select
                  value={n.type}
                  onChange={(e) => setN({ ...n, type: e.target.value })}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="investment">Investment</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Category
                </label>
                <select
                  value={n.category}
                  onChange={(e) => setN({ ...n, category: e.target.value })}
                >
                  {ALL_CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={add}>
                Add
              </button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {filtered.map((tx) => {
          const typeLabel =
            tx.type === "income"
              ? "↑ In"
              : tx.type === "investment"
                ? "→ Inv"
                : "↓ Out";
          return (
            <div
              key={tx.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background:
                    tx.type === "income"
                      ? "var(--green)"
                      : tx.type === "investment"
                        ? "var(--gold)"
                        : "var(--red)",
                }}
                title={typeLabel}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.desc}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {tx.date} · {tx.category}
                </div>
              </div>
              <span
                className={`tag ${tx.type === "income" ? "tag-green" : tx.type === "investment" ? "tag-gold" : "tag-red"}`}
              >
                {tx.type}
              </span>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color:
                    tx.amount > 0
                      ? "var(--green)"
                      : tx.type === "investment"
                        ? "var(--gold)"
                        : "var(--red)",
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {tx.amount > 0 ? "+" : ""}
                {fmt(tx.amount)}
              </div>
              <button
                className="btn-danger"
                aria-label={`Delete ${tx.desc}`}
                onClick={() => {
                  const prev = [...transactions];
                  updatePerson(
                    "transactions",
                    transactions.filter((x) => x.id !== tx.id),
                  );
                  if (tx.auto) {
                    const key = `${tx.date}|${tx.desc}`;
                    const dismissed = data?.dismissedAutoTxns || [];
                    if (!dismissed.includes(key))
                      updatePerson("dismissedAutoTxns", [...dismissed, key]);
                  }
                  showUndo(`Deleted "${tx.desc}"`, () =>
                    updatePerson("transactions", prev),
                  );
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No transactions found
          </div>
        )}
      </div>
      {dialog}
      {toastEl}
    </div>
  );
}

const NEW_SLABS = [
  [0, 400000, 0],
  [400000, 800000, 5],
  [800000, 1200000, 10],
  [1200000, 1600000, 15],
  [1600000, 2000000, 20],
  [2000000, 2400000, 25],
  [2400000, Infinity, 30],
];
const OLD_SLABS = [
  [0, 250000, 0],
  [250000, 500000, 5],
  [500000, 1000000, 20],
  [1000000, Infinity, 30],
];

function calcTax(income, slabs, ded = 0) {
  const taxable = Math.max(0, income - ded);
  let tax = slabs.reduce(
    (s, [from, to, rate]) =>
      s + (Math.max(0, Math.min(taxable, to) - from) * rate) / 100,
    0,
  );
  if (income <= 700000 && slabs === NEW_SLABS) tax = 0;
  if (income <= 500000 && slabs === OLD_SLABS) tax = 0;
  return Math.round(tax * 1.04);
}

function slabBreakdown(income, slabs, ded = 0) {
  const taxable = Math.max(0, income - ded);
  return slabs
    .map(([from, to, rate]) => {
      const chunk = Math.max(0, Math.min(taxable, to) - from);
      return { from, to, rate, chunk, tax: Math.round((chunk * rate) / 100) };
    })
    .filter((r) => r.chunk > 0);
}

export function TaxPlanner({ data, personName, personColor, updatePerson }) {
  const t = data?.taxInfo || {};
  const annualIncome =
    (data?.incomes || []).reduce((s, x) => s + x.amount, 0) * 12;
  const update = (key, val) => updatePerson("taxInfo", { ...t, [key]: val });

  // Auto-detect ELSS & PPF SIPs from investments if user hasn't entered manually
  const invs = data?.investments || [];
  const autoELSS = invs
    .filter((i) => i.type === "Mutual Fund" && /elss/i.test(i.name || ""))
    .reduce((s, i) => s + (i.amount || 0), 0);
  const autoPPF = invs
    .filter((i) => i.type === "PPF")
    .reduce((s, i) => s + (i.amount || 0), 0);
  const autoEPF = invs
    .filter((i) => i.type === "EPF")
    .reduce((s, i) => s + (i.amount || 0), 0);

  // Auto-detect insurance premiums from Insurance tracker
  const insurances = data?.insurances || [];
  const autoHealthIns = insurances
    .filter((i) => /health|critical/i.test(i.type || ""))
    .reduce((s, i) => {
      const annual =
        i.premiumFreq === "monthly"
          ? (i.premium || 0) * 12
          : i.premiumFreq === "quarterly"
            ? (i.premium || 0) * 4
            : i.premium || 0;
      return s + annual;
    }, 0);
  const autoLifeIns = insurances
    .filter((i) => /life|term/i.test(i.type || ""))
    .reduce((s, i) => {
      const annual =
        i.premiumFreq === "monthly"
          ? (i.premium || 0) * 12
          : i.premiumFreq === "quarterly"
            ? (i.premium || 0) * 4
            : i.premium || 0;
      return s + annual;
    }, 0);

  // PF from payslip if user set basicSalary (12% of basic is employee EPF)
  const payslipEPF = t.basicSalary
    ? Math.min(1800, Math.round(t.basicSalary * 0.12)) * 12
    : 0;
  // Use whichever is available: manual EPF investment, or payslip-derived
  const effectiveEPF = autoEPF > 0 ? autoEPF * 12 : payslipEPF || 0;
  const elssMonthly = t.elss || autoELSS;
  const ppfMonthly = t.ppf || autoPPF;

  // 80C: ELSS + PPF + EPF + life insurance premiums (capped ₹1.5L)
  const lifePremium = (t.lifeInsurance || 0) * 12 + autoLifeIns;
  const old80C = Math.min(
    150000,
    elssMonthly * 12 + ppfMonthly * 12 + effectiveEPF + lifePremium,
  );
  // HRA exemption: min of (actual HRA, 50% of basic for metro, rent - 10% basic)
  const annualHRA = (t.hra || 0) * 12;
  const annualBasic = (t.basicSalary || 0) * 12;
  const annualRent = (t.monthlyRent || 0) * 12;
  const hraExempt =
    annualHRA > 0
      ? Math.min(
          annualHRA,
          annualBasic * 0.5, // metro city (Bangalore)
          Math.max(0, annualRent - annualBasic * 0.1),
        )
      : 0;
  const oldHRA = hraExempt;
  const oldNPS = Math.min(50000, (t.nps || 0) * 12);
  // 80D: self + family (₹25k) + parents (₹25k / ₹50k if senior)
  const healthInsAnnual = (t.medicalInsurance || 0) * 12 + autoHealthIns;
  const med80DSelf = Math.min(25000, healthInsAnnual);
  const med80DParents = Math.min(
    t.parentsSenior ? 50000 : 25000,
    (t.parentsInsurance || 0) * 12,
  );
  const oldMed = med80DSelf + med80DParents;
  const oldHL = Math.min(200000, (t.homeLoanInterest || 0) * 12);
  // 80E: education loan interest (no cap)
  const old80E = (t.educationLoanInterest || 0) * 12;
  const totalOldDed =
    old80C + oldHRA + 50000 + oldNPS + oldMed + oldHL + old80E;
  const oldTax = calcTax(annualIncome, OLD_SLABS, totalOldDed);
  const newTax = calcTax(annualIncome, NEW_SLABS, 75000);
  const better = oldTax <= newTax ? "old" : "new";
  const saving = Math.abs(oldTax - newTax);
  const remaining80C = Math.max(
    0,
    150000 - (elssMonthly * 12 + ppfMonthly * 12 + effectiveEPF + lifePremium),
  );

  // Gross salary breakdown from payslip
  const grossMonthly =
    (t.basicSalary || 0) +
    (t.hra || 0) +
    (t.specialAllowance || 0) +
    (t.lta || 0) +
    (t.communicationAllowance || 0);

  // Annual incentives (Sep ₹71,542 + Mar ₹1,69,039.69 = ₹2,40,581.69)
  const annualIncentives = t.annualIncentives || 0;
  const grossAnnual = grossMonthly * 12 + annualIncentives;

  // New Regime detailed breakdown (this year FY 2025-26)
  const newStdDed = 75000;
  const newTaxableIncome = Math.max(0, grossAnnual - newStdDed);
  const newSlabs = slabBreakdown(grossAnnual, NEW_SLABS, newStdDed);
  const newBaseTax = newSlabs.reduce((s, r) => s + r.tax, 0);
  const newRebate = grossAnnual <= 700000 ? newBaseTax : 0;
  const newTaxAfterRebate = newBaseTax - newRebate;
  const newCess = Math.round(newTaxAfterRebate * 0.04);
  const newFinalTax = newTaxAfterRebate + newCess;

  // Last year Form 16 data (FY 2024-25, AY 2025-26)
  const lastYearForm16 = {
    gross: 1261833,
    stdDed: 75000,
    taxable: 1186833,
    baseTax: 78025,
    cess: 3121,
    total: 81146,
    tds: 81145,
    period: "Apr 2024 – Mar 2025",
    employer: "BBY Services India LLP",
  };

  // Deductions breakdown for display
  const dedRows = [
    { section: "80C", label: "ELSS SIPs", amount: elssMonthly * 12, cap: null },
    { section: "80C", label: "PPF", amount: ppfMonthly * 12, cap: null },
    {
      section: "80C",
      label: "EPF (PF contribution)",
      amount: effectiveEPF,
      cap: null,
    },
    {
      section: "80C",
      label: "Life insurance premium",
      amount: lifePremium,
      cap: null,
    },
    {
      section: "80C",
      label: "80C Total (capped ₹1.5L)",
      amount: old80C,
      cap: 150000,
      isTotal: true,
    },
    { section: "HRA", label: "HRA Exemption", amount: oldHRA, cap: null },
    { section: "Std", label: "Standard Deduction", amount: 50000, cap: 50000 },
    { section: "80CCD", label: "NPS (80CCD1B)", amount: oldNPS, cap: 50000 },
    {
      section: "80D",
      label: "Health insurance — self",
      amount: med80DSelf,
      cap: 25000,
    },
    {
      section: "80D",
      label: "Health insurance — parents",
      amount: med80DParents,
      cap: t.parentsSenior ? 50000 : 25000,
    },
    { section: "24b", label: "Home loan interest", amount: oldHL, cap: 200000 },
    {
      section: "80E",
      label: "Education loan interest",
      amount: old80E,
      cap: null,
    },
  ].filter((r) => r.amount > 0 || r.isTotal);

  const fi = (key, label) => (
    <div>
      <label
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          display: "block",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={t[key] || ""}
        onChange={(e) => update(key, Number(e.target.value))}
        placeholder="Monthly ₹"
      />
    </div>
  );

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Tax Planner
      </div>
      <div className="grid-2 section-gap">
        {[
          {
            title: "New Regime",
            tax: newTax,
            ded: 75000,
            better: better === "new",
            desc: "Simpler. ₹75k standard deduction. Best if investments are low.",
          },
          {
            title: "Old Regime",
            tax: oldTax,
            ded: totalOldDed,
            better: better === "old",
            desc: "More deductions. Better if you max 80C, HRA, NPS.",
          },
        ].map((r) => (
          <div
            key={r.title}
            className="card"
            style={{
              border: r.better
                ? "1px solid var(--green)"
                : "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <div className="card-title" style={{ marginBottom: 0 }}>
                {r.title}
              </div>
              {r.better && (
                <span className="tag tag-green">✓ Better for you</span>
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: "0.75rem",
              }}
            >
              {r.desc}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span className="muted">Deductions</span>
              <span className="green-text">−{fmt(r.ded)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span className="muted">Taxable income</span>
              <span>{fmt(Math.max(0, annualIncome - r.ded))}</span>
            </div>
            <div className="divider" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <span>Tax (incl. cess)</span>
              <span style={{ color: r.better ? "var(--green)" : "var(--red)" }}>
                {fmt(r.tax)}
              </span>
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}
            >
              Monthly: {fmt(Math.round(r.tax / 12))}
            </div>
          </div>
        ))}
      </div>
      {saving > 0 && (
        <div
          style={{
            background: "var(--green-dim)",
            border: "1px solid rgba(76,175,130,.3)",
            borderRadius: "var(--radius)",
            padding: "1rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div
              style={{
                fontWeight: 500,
                color: "var(--green)",
                marginBottom: 2,
              }}
            >
              Switch to {better} regime → save {fmt(saving)}/year
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              That's {fmt(Math.round(saving / 12))}/month more to invest.
            </div>
          </div>
        </div>
      )}

      {/* This Year Tax — New Regime Breakdown */}
      {grossAnnual > 0 && (
        <div
          className="card section-gap"
          style={{ border: "1px solid var(--abhav)" }}
        >
          <div className="card-title">
            🧾 This Year's Tax — New Regime (FY 2025-26)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "8px 16px",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Gross Salary (from payslip)
            </span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {fmt(grossAnnual)}
            </span>

            <span style={{ color: "var(--text-secondary)" }}>
              Less: Standard Deduction
            </span>
            <span style={{ textAlign: "right", color: "var(--green)" }}>
              −{fmt(newStdDed)}
            </span>

            <div
              style={{
                gridColumn: "1/-1",
                borderTop: "1px solid var(--border)",
                margin: "2px 0",
              }}
            />

            <span style={{ fontWeight: 600 }}>Taxable Income</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {fmt(newTaxableIncome)}
            </span>
          </div>

          <div
            style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}
          >
            Slab-wise tax:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "4px 12px",
              fontSize: 12,
              marginTop: 6,
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
              Slab
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              Income
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              Tax
            </span>
            {newSlabs.map((r, i) => [
              <span key={i + "s"} style={{ color: "var(--text-secondary)" }}>
                {fmt(r.from)}–{r.to === Infinity ? "∞" : fmt(r.to)} @ {r.rate}%
              </span>,
              <span key={i + "c"} style={{ textAlign: "right" }}>
                {fmt(r.chunk)}
              </span>,
              <span
                key={i + "t"}
                style={{ textAlign: "right", color: "var(--red)" }}
              >
                {fmt(r.tax)}
              </span>,
            ])}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "6px 16px",
              fontSize: 13,
              marginTop: 12,
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Tax before cess
            </span>
            <span style={{ textAlign: "right" }}>{fmt(newBaseTax)}</span>

            {newRebate > 0 && (
              <>
                <span style={{ color: "var(--green)" }}>
                  Less: Rebate u/s 87A
                </span>
                <span style={{ textAlign: "right", color: "var(--green)" }}>
                  −{fmt(newRebate)}
                </span>
              </>
            )}

            <span style={{ color: "var(--text-secondary)" }}>
              Health &amp; Education Cess (4%)
            </span>
            <span style={{ textAlign: "right" }}>{fmt(newCess)}</span>

            <div
              style={{
                gridColumn: "1/-1",
                borderTop: "1px solid var(--border)",
                margin: "2px 0",
              }}
            />

            <span style={{ fontWeight: 700, fontSize: 15 }}>
              Total Tax Payable
            </span>
            <span
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontSize: 15,
                color: "var(--red)",
              }}
            >
              {fmt(newFinalTax)}
            </span>

            <span style={{ color: "var(--text-secondary)" }}>
              Monthly TDS (approx.)
            </span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {fmt(Math.round(newFinalTax / 12))}/mo
            </span>
          </div>

          {annualIncome > 0 && annualIncome !== grossAnnual && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}
            >
              💡 Using payslip gross ({fmt(grossAnnual)}/yr) for this
              calculation. Your Budget income is {fmt(annualIncome)}/yr
              (take-home).
            </div>
          )}
        </div>
      )}

      {/* Last Year Form 16 Reference */}
      <div className="card section-gap" style={{ opacity: 0.85 }}>
        <div className="card-title">
          📄 Last Year — FY 2024-25 (from Form 16)
        </div>
        <div
          style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}
        >
          {lastYearForm16.employer} · {lastYearForm16.period} · New Regime
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "5px 16px",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Gross Salary</span>
          <span style={{ textAlign: "right" }}>
            {fmt(lastYearForm16.gross)}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            Standard Deduction
          </span>
          <span style={{ textAlign: "right", color: "var(--green)" }}>
            −{fmt(lastYearForm16.stdDed)}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>Taxable Income</span>
          <span style={{ textAlign: "right" }}>
            {fmt(lastYearForm16.taxable)}
          </span>

          <div
            style={{
              gridColumn: "1/-1",
              borderTop: "1px solid var(--border)",
              margin: "2px 0",
            }}
          />

          <span style={{ color: "var(--text-secondary)" }}>Tax</span>
          <span style={{ textAlign: "right" }}>
            {fmt(lastYearForm16.baseTax)}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>Cess (4%)</span>
          <span style={{ textAlign: "right" }}>{fmt(lastYearForm16.cess)}</span>

          <span style={{ fontWeight: 600 }}>Total Tax</span>
          <span
            style={{ textAlign: "right", fontWeight: 600, color: "var(--red)" }}
          >
            {fmt(lastYearForm16.total)}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>TDS Deducted</span>
          <span style={{ textAlign: "right", color: "var(--green)" }}>
            {fmt(lastYearForm16.tds)}
          </span>
        </div>
        {grossAnnual > lastYearForm16.gross && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--gold)" }}>
            📈 Salary increased by {fmt(grossAnnual - lastYearForm16.gross)}/yr
            (
            {Math.round(
              ((grossAnnual - lastYearForm16.gross) / lastYearForm16.gross) *
                100,
            )}
            %) compared to last year.
          </div>
        )}
      </div>
      <div className="card section-gap">
        <div className="card-title">Your details (monthly amounts)</div>
        <div className="grid-2">
          <div
            style={{
              borderRight: "1px solid var(--border)",
              paddingRight: "1rem",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 10,
              }}
            >
              Salary components
            </div>
            {fi("basicSalary", "Basic salary")}
            {fi("hra", "HRA")}
            {fi("lta", "LTA")}
            {fi("specialAllowance", "Special allowance")}
            {fi("communicationAllowance", "Communication allowance")}
            {fi("monthlyRent", "Monthly rent paid (for HRA calc)")}
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 10,
              }}
            >
              Investments
            </div>
            {fi("elss", "ELSS SIP (80C)")}
            {fi("ppf", "PPF (80C)")}
            {fi("nps", "NPS (80CCD)")}
            {fi("lifeInsurance", "Life insurance premium (80C)")}
            {fi("medicalInsurance", "Health insurance — self (80D)")}
            {fi("parentsInsurance", "Health insurance — parents (80D)")}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={!!t.parentsSenior}
                  onChange={(e) => update("parentsSenior", e.target.checked)}
                />
                Parents are senior citizens (60+)
              </label>
            </div>
            {fi("homeLoanInterest", "Home loan interest (24b)")}
            {fi("educationLoanInterest", "Education loan interest (80E)")}
          </div>
        </div>
        {(autoELSS > 0 ||
          autoPPF > 0 ||
          autoEPF > 0 ||
          autoHealthIns > 0 ||
          autoLifeIns > 0) && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(76,175,130,0.08)",
              border: "1px solid rgba(76,175,130,0.2)",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            💡 Auto-detected: {autoELSS > 0 && `ELSS ${fmt(autoELSS)}/mo `}
            {autoPPF > 0 && `PPF ${fmt(autoPPF)}/mo `}
            {autoEPF > 0 && `EPF ${fmt(autoEPF)}/mo `}
            {autoHealthIns > 0 && `Health ins ${fmt(autoHealthIns)}/yr `}
            {autoLifeIns > 0 && `Life ins ${fmt(autoLifeIns)}/yr`}
          </div>
        )}
      </div>

      {/* Gross Salary Breakdown — FY 2025-26 */}
      {grossMonthly > 0 && (
        <div className="card section-gap">
          <div className="card-title">📋 Salary Breakdown — FY 2025-26</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "6px 16px",
              fontSize: 13,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                fontSize: 11,
              }}
            >
              Component
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                fontSize: 11,
                textAlign: "right",
              }}
            >
              Monthly
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                fontSize: 11,
                textAlign: "right",
              }}
            >
              Annual
            </span>
            {[
              ["Basic Salary", t.basicSalary, (t.basicSalary || 0) * 12],
              ["HRA", t.hra, (t.hra || 0) * 12],
              [
                "Special Allowance",
                t.specialAllowance,
                (t.specialAllowance || 0) * 12,
              ],
              ["LTA", t.lta, (t.lta || 0) * 12],
              [
                "Communication",
                t.communicationAllowance,
                (t.communicationAllowance || 0) * 12,
              ],
            ]
              .filter(([, v]) => v > 0)
              .map(([label, monthly, annual]) => [
                <span
                  key={label + "l"}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {label}
                </span>,
                <span key={label + "m"} style={{ textAlign: "right" }}>
                  {fmt(monthly)}
                </span>,
                <span key={label + "a"} style={{ textAlign: "right" }}>
                  {fmt(annual)}
                </span>,
              ])}
            {annualIncentives > 0 && [
              <span key="inc-l" style={{ color: "var(--gold)" }}>
                Incentives (Sep + Mar)
              </span>,
              <span
                key="inc-m"
                style={{ textAlign: "right", color: "var(--text-muted)" }}
              >
                —
              </span>,
              <span
                key="inc-a"
                style={{ textAlign: "right", color: "var(--gold)" }}
              >
                {fmt(annualIncentives)}
              </span>,
            ]}
            <div
              style={{
                gridColumn: "1/-1",
                borderTop: "1px solid var(--border)",
                margin: "4px 0",
              }}
            />
            <span style={{ fontWeight: 600 }}>Gross Salary</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {fmt(grossMonthly)}
            </span>
            <span
              style={{
                textAlign: "right",
                fontWeight: 700,
                color: "var(--gold)",
              }}
            >
              {fmt(grossAnnual)}
            </span>
          </div>
          {annualIncentives > 0 && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}
            >
              💡 Incentives: ₹71,542 (Sep) + ₹1,69,040 (Mar) = ₹2,40,582 added
              to annual gross for tax calculation.
            </div>
          )}
        </div>
      )}

      {/* Deductions Breakdown (Old Regime) */}
      {dedRows.length > 0 && (
        <div className="card section-gap">
          <div className="card-title">📊 Deductions Breakdown (Old Regime)</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              gap: "6px 12px",
              fontSize: 12,
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
              Section
            </span>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
              Deduction
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              Amount
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              Limit
            </span>
            {dedRows.map((r, i) => [
              <span
                key={i + "s"}
                className={`tag ${r.isTotal ? "tag-green" : ""}`}
                style={{ fontSize: 10 }}
              >
                {r.section}
              </span>,
              <span
                key={i + "l"}
                style={{ fontSize: 13, fontWeight: r.isTotal ? 600 : 400 }}
              >
                {r.label}
              </span>,
              <span
                key={i + "a"}
                style={{
                  textAlign: "right",
                  fontSize: 13,
                  fontWeight: r.isTotal ? 600 : 400,
                  color: r.amount > 0 ? "var(--green)" : "var(--text-muted)",
                }}
              >
                {fmt(r.amount)}
              </span>,
              <span
                key={i + "c"}
                style={{
                  textAlign: "right",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {r.cap ? fmt(r.cap) : "—"}
              </span>,
            ])}
            <div
              style={{
                gridColumn: "1/-1",
                borderTop: "1px solid var(--border)",
                margin: "4px 0",
              }}
            />
            <span />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              Total deductions
            </span>
            <span
              style={{
                textAlign: "right",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--green)",
              }}
            >
              {fmt(totalOldDed)}
            </span>
            <span />
          </div>
        </div>
      )}

      {remaining80C > 0 && (
        <div className="tip">
          💡 ₹{remaining80C.toLocaleString("en-IN")} of 80C limit unused. Invest
          more in ELSS or PPF to save ₹
          {Math.round(remaining80C * 0.3).toLocaleString("en-IN")} in taxes.
        </div>
      )}

      {/* Tax Guidance */}
      <div className="card section-gap">
        <div className="card-title">🧭 Tax-Saving Guidance</div>
        {(() => {
          const tips = [];
          // 80C gap
          if (remaining80C > 0)
            tips.push({
              priority: "high",
              text: `Invest ₹${remaining80C.toLocaleString("en-IN")} more in ELSS/PPF to max 80C. Monthly SIP of ₹${Math.round(remaining80C / 12).toLocaleString("en-IN")} would do it.`,
            });
          // NPS
          if (!t.nps || t.nps === 0)
            tips.push({
              priority: "high",
              text: "Start NPS contributions for extra ₹50,000 deduction under 80CCD(1B) — beyond the ₹1.5L 80C limit.",
            });
          // Health insurance
          if (med80DSelf < 25000)
            tips.push({
              priority: "medium",
              text: `Your health insurance premium is ₹${med80DSelf.toLocaleString("en-IN")}/yr. You can claim up to ₹25,000 under 80D. Consider a top-up health plan.`,
            });
          // Parents insurance
          if (med80DParents === 0)
            tips.push({
              priority: "medium",
              text: "Buy health insurance for parents — claim up to ₹50,000/yr (senior) or ₹25,000 (non-senior) under 80D.",
            });
          // HRA
          if (t.hra > 0 && (!t.monthlyRent || t.monthlyRent === 0))
            tips.push({
              priority: "high",
              text: "Enter your monthly rent to calculate HRA exemption. This can save ₹50,000–₹2,00,000+ in taxable income.",
            });
          // Home loan
          if (oldHL === 0)
            tips.push({
              priority: "low",
              text: "Home loan interest up to ₹2L/yr is deductible under Section 24(b) — relevant when you purchase a property.",
            });
          // Regime advice
          if (better === "new" && totalOldDed < 200000)
            tips.push({
              priority: "info",
              text: "New regime is better for you because your deductions are low. Focus on investing for growth rather than tax-saving.",
            });
          if (better === "old" && saving > 20000)
            tips.push({
              priority: "info",
              text: `Old regime saves you ${fmt(saving)}/yr. Make sure to declare all deductions to your employer to reduce TDS.`,
            });
          // Advance tax
          if (annualIncome > 0) {
            const betterTax = Math.min(oldTax, newTax);
            const monthlyTDS = Math.round(betterTax / 12);
            tips.push({
              priority: "info",
              text: `Estimated annual tax: ${fmt(betterTax)}. That's ~${fmt(monthlyTDS)}/mo in TDS. Verify with your Form 16 / 26AS on the income tax portal.`,
            });
          }
          // Key dates
          tips.push({
            priority: "info",
            text: "📅 Key dates: Declare investments to employer by Jan. File ITR by Jul 31. Advance tax: Jun 15, Sep 15, Dec 15, Mar 15.",
          });

          const colors = {
            high: "var(--red)",
            medium: "var(--gold)",
            low: "var(--text-secondary)",
            info: "var(--abhav)",
          };
          const icons = { high: "🔴", medium: "🟡", low: "⚪", info: "ℹ️" };
          return tips.map((tip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 0",
                borderBottom:
                  i < tips.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                {icons[tip.priority]}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: colors[tip.priority],
                  lineHeight: 1.5,
                }}
              >
                {tip.text}
              </span>
            </div>
          ));
        })()}
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-card2)",
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          📎 Verify on:{" "}
          <a
            href="https://eportal.incometax.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--abhav)" }}
          >
            incometax.gov.in
          </a>{" "}
          (26AS/AIS) ·{" "}
          <a
            href="https://cleartax.in/s/income-tax-calculator"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--abhav)" }}
          >
            ClearTax Calculator
          </a>{" "}
          ·{" "}
          <a
            href="https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--abhav)" }}
          >
            ITR Filing Guide
          </a>
        </div>
      </div>
    </div>
  );
}

export function HouseholdTransactions({ abhav, aanya, updatePerson }) {
  const { personNames } = useData();
  const abhavTx = (abhav?.transactions || []).map((x) => ({
    ...x,
    _owner: "abhav",
  }));
  const aanyaTx = (aanya?.transactions || []).map((x) => ({
    ...x,
    _owner: "aanya",
  }));

  const [search, setSearch] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [addFor, setAddFor] = useState("abhav");
  const [n, setN] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const { confirm, dialog } = useConfirm();

  const pColor = (o) => (o === "abhav" ? "var(--abhav)" : "var(--aanya)");
  const pLabel = (o) => personNames?.[o] || o;

  const source =
    filterPerson === "all"
      ? [...abhavTx, ...aanyaTx]
      : filterPerson === "abhav"
        ? abhavTx
        : aanyaTx;

  const filtered = source
    .filter(
      (t) =>
        (filterType === "all" || t.type === filterType) &&
        (t.desc.toLowerCase().includes(search.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIn = filtered
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const add = () => {
    if (!n.desc || !n.amount) return;
    const amt =
      n.type === "income"
        ? Math.abs(Number(n.amount))
        : -Math.abs(Number(n.amount));
    const ownerData = addFor === "abhav" ? abhav : aanya;
    const txs = ownerData?.transactions || [];
    updatePerson(addFor, "transactions", [
      { ...n, id: nextId(txs), amount: amt },
      ...txs,
    ]);
    setN({
      date: new Date().toISOString().slice(0, 10),
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
    });
    setShowAdd(false);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Transactions
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Total in</div>
          <div className="metric-value green-text">{fmt(totalIn)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total out</div>
          <div className="metric-value red-text">{fmt(totalOut)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net</div>
          <div
            className="metric-value"
            style={{
              color: totalIn - totalOut >= 0 ? "var(--green)" : "var(--red)",
            }}
          >
            {fmt(totalIn - totalOut)}
          </div>
        </div>
      </div>
      <div className="card">
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div style={{ flex: 1, position: "relative", minWidth: 160 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>
          {[
            { id: "all", label: "All", color: "var(--gold)" },
            {
              id: "abhav",
              label: personNames?.abhav || "Person 1",
              color: "var(--abhav)",
            },
            {
              id: "aanya",
              label: personNames?.aanya || "Person 2",
              color: "var(--aanya)",
            },
          ].map(({ id, label, color }) => (
            <button
              key={id}
              onClick={() => setFilterPerson(id)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background:
                  filterPerson === id
                    ? `color-mix(in srgb, ${color} 15%, transparent)`
                    : "transparent",
                color: filterPerson === id ? color : "var(--text-secondary)",
                border: `1px solid ${filterPerson === id ? color : "var(--border)"}`,
              }}
            >
              {label}
            </button>
          ))}
          {["all", "income", "expense", "investment"].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background:
                  filterType === f ? "var(--gold-dim)" : "transparent",
                color:
                  filterType === f ? "var(--gold)" : "var(--text-secondary)",
                border:
                  filterType === f
                    ? "1px solid var(--gold-border)"
                    : "1px solid var(--border)",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {showAdd && (
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Add for
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  {
                    id: "abhav",
                    label: personNames?.abhav || "Person 1",
                    color: "var(--abhav)",
                  },
                  {
                    id: "aanya",
                    label: personNames?.aanya || "Person 2",
                    color: "var(--aanya)",
                  },
                ].map(({ id, label, color }) => (
                  <button
                    key={id}
                    onClick={() => setAddFor(id)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "var(--radius-sm)",
                      background:
                        addFor === id
                          ? `color-mix(in srgb, ${color} 15%, transparent)`
                          : "transparent",
                      color: addFor === id ? color : "var(--text-secondary)",
                      border: `1px solid ${addFor === id ? color : "var(--border)"}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={n.date}
                  onChange={(e) => setN({ ...n, date: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Description
                </label>
                <input
                  value={n.desc}
                  onChange={(e) => setN({ ...n, desc: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={n.amount}
                  onChange={(e) => setN({ ...n, amount: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Type
                </label>
                <select
                  value={n.type}
                  onChange={(e) => setN({ ...n, type: e.target.value })}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="investment">Investment</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Category
                </label>
                <select
                  value={n.category}
                  onChange={(e) => setN({ ...n, category: e.target.value })}
                >
                  {ALL_CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={add}>
                Add
              </button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {filtered.map((tx) => (
          <div
            key={`${tx._owner}-${tx.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                background:
                  tx.type === "income"
                    ? "var(--green)"
                    : tx.type === "investment"
                      ? "var(--gold)"
                      : "var(--red)",
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.desc}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {tx.date} · {tx.category}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: pColor(tx._owner),
                background: `color-mix(in srgb, ${pColor(tx._owner)} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${pColor(tx._owner)} 30%, transparent)`,
                borderRadius: "var(--radius-sm)",
                padding: "2px 7px",
                flexShrink: 0,
              }}
            >
              {pLabel(tx._owner)}
            </span>
            <span
              className={`tag ${tx.type === "income" ? "tag-green" : tx.type === "investment" ? "tag-gold" : "tag-red"}`}
            >
              {tx.type}
            </span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color:
                  tx.amount > 0
                    ? "var(--green)"
                    : tx.type === "investment"
                      ? "var(--gold)"
                      : "var(--red)",
                minWidth: 80,
                textAlign: "right",
              }}
            >
              {tx.amount > 0 ? "+" : ""}
              {fmt(tx.amount)}
            </div>
            <button
              className="btn-danger"
              aria-label={`Delete ${tx.desc}`}
              onClick={async () => {
                if (
                  await confirm("Delete transaction?", `Remove "${tx.desc}"?`)
                ) {
                  const ownerData = tx._owner === "abhav" ? abhav : aanya;
                  const txs = ownerData?.transactions || [];
                  updatePerson(
                    tx._owner,
                    "transactions",
                    txs.filter((x) => x.id !== tx.id),
                  );
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No transactions found
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}

export function HouseholdDebts({ abhav, aanya, updatePerson }) {
  const { personNames } = useData();
  const abhavDebts = (abhav?.debts || []).map((d) => ({
    ...d,
    _owner: "abhav",
  }));
  const aanyaDebts = (aanya?.debts || []).map((d) => ({
    ...d,
    _owner: "aanya",
  }));
  const allDebts = [...abhavDebts, ...aanyaDebts];

  const [showAdd, setShowAdd] = useState(false);
  const [addFor, setAddFor] = useState("abhav");
  const [n, setN] = useState({
    name: "",
    outstanding: "",
    rate: "",
    tenure: "",
  });
  const { confirm, dialog } = useConfirm();

  const pColor = (o) => (o === "abhav" ? "var(--abhav)" : "var(--aanya)");
  const pLabel = (o) => personNames?.[o] || o;

  const totalEMI = allDebts.reduce((s, d) => s + d.emi, 0);
  const totalOut = allDebts.reduce((s, d) => s + d.outstanding, 0);
  const abhavIncome = (abhav?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const aanyaIncome = (aanya?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const totalIncome = abhavIncome + aanyaIncome;
  const dti = totalIncome > 0 ? Math.round((totalEMI / totalIncome) * 100) : 0;

  const add = () => {
    if (!n.name) return;
    const emi = calcEMI(
      Number(n.outstanding),
      Number(n.rate),
      Number(n.tenure),
    );
    const ownerData = addFor === "abhav" ? abhav : aanya;
    const debts = ownerData?.debts || [];
    updatePerson(addFor, "debts", [
      ...debts,
      {
        ...n,
        id: nextId(debts),
        outstanding: Number(n.outstanding),
        emi,
        rate: Number(n.rate),
        tenure: Number(n.tenure),
      },
    ]);
    setN({ name: "", outstanding: "", rate: "", tenure: "" });
    setShowAdd(false);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Debts & EMIs
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Total outstanding</div>
          <div className="metric-value red-text">{fmt(totalOut)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Combined EMI</div>
          <div
            className="metric-value"
            style={{ color: dti > 30 ? "var(--red)" : "var(--gold)" }}
          >
            {fmt(totalEMI)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Household DTI</div>
          <div
            className="metric-value"
            style={{ color: dti > 30 ? "var(--red)" : "var(--green)" }}
          >
            {dti}%
          </div>
          <div className="metric-sub">
            {dti > 30 ? "⚠️ Above 30%" : "✓ Safe"}
          </div>
        </div>
      </div>
      {allDebts.length > 0 && (
        <div className="card section-gap">
          <div className="card-title">All loans</div>
          {allDebts.map((d) => (
            <div
              key={`${d._owner}-${d.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 2 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {d.rate}% · {d.tenure} months remaining
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: pColor(d._owner),
                  background: `color-mix(in srgb, ${pColor(d._owner)} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${pColor(d._owner)} 30%, transparent)`,
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 7px",
                  flexShrink: 0,
                }}
              >
                {pLabel(d._owner)}
              </span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13 }}>
                  Outstanding:{" "}
                  <strong style={{ color: "var(--red)" }}>
                    {fmt(d.outstanding)}
                  </strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  EMI: <strong>{fmt(d.emi)}</strong>
                </div>
              </div>
              <button
                className="btn-danger"
                aria-label={`Delete ${d.name}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Delete loan?",
                      `Remove "${d.name}" and its EMI?`,
                    )
                  ) {
                    const ownerData = d._owner === "abhav" ? abhav : aanya;
                    const debts = ownerData?.debts || [];
                    updatePerson(
                      d._owner,
                      "debts",
                      debts.filter((x) => x.id !== d.id),
                    );
                  }
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {showAdd ? (
        <div className="card section-gap">
          <div className="card-title">Add Loan</div>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Add for
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                {
                  id: "abhav",
                  label: personNames?.abhav || "Person 1",
                  color: "var(--abhav)",
                },
                {
                  id: "aanya",
                  label: personNames?.aanya || "Person 2",
                  color: "var(--aanya)",
                },
              ].map(({ id, label, color }) => (
                <button
                  key={id}
                  onClick={() => setAddFor(id)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "var(--radius-sm)",
                    background:
                      addFor === id
                        ? `color-mix(in srgb, ${color} 15%, transparent)`
                        : "transparent",
                    color: addFor === id ? color : "var(--text-secondary)",
                    border: `1px solid ${addFor === id ? color : "var(--border)"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            {[
              ["name", "Loan name", "text"],
              ["outstanding", "Outstanding (₹)", "number"],
              ["rate", "Interest rate (% p.a.)", "number"],
              ["tenure", "Remaining months", "number"],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  value={n[key]}
                  onChange={(e) => setN({ ...n, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {n.outstanding && n.rate && n.tenure && (
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              EMI:{" "}
              <strong>
                {fmt(
                  calcEMI(
                    Number(n.outstanding),
                    Number(n.rate),
                    Number(n.tenure),
                  ),
                )}
              </strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={add}>
              Add
            </button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-ghost"
          style={{
            width: "100%",
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Loan / EMI
        </button>
      )}
      {allDebts.length > 1 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div className="card-title">
            🏔️ Household Debt Avalanche (pay highest rate first)
          </div>
          {[...allDebts]
            .sort((a, b) => b.rate - a.rate)
            .map((d, i) => (
              <div
                key={`${d._owner}-${d.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: i === 0 ? "var(--red-dim)" : "var(--bg-card2)",
                    border: `1px solid ${i === 0 ? "var(--red)" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: i === 0 ? "var(--red)" : "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: pColor(d._owner),
                    flexShrink: 0,
                  }}
                >
                  {pLabel(d._owner)}
                </span>
                <div style={{ flex: 1, fontSize: 13 }}>{d.name}</div>
                <span className={`tag ${d.rate > 12 ? "tag-red" : "tag-gold"}`}>
                  {d.rate}%
                </span>
                {i === 0 && <span className="tag tag-red">Pay first!</span>}
              </div>
            ))}
        </div>
      )}
      {dialog}
    </div>
  );
}

const REMINDER_FREQS = [
  { value: "daily", label: "Daily", desc: "Every morning at 7am" },
  { value: "weekly", label: "Weekly", desc: "Every Monday morning" },
  {
    value: "monthly",
    label: "Monthly",
    desc: "1st of each month · includes full snapshot",
  },
];

function ReminderEmailSetting({ sharedData, updateShared }) {
  const saved = sharedData?.reminderEmail || "";
  const enabled = sharedData?.reminderEnabled !== false;
  const frequency = sharedData?.reminderFrequency || "daily";
  const [draft, setDraft] = useState(saved);
  const [saveStatus, setSaveStatus] = useState("");
  const [sendStatus, setSendStatus] = useState("");

  function handleSave() {
    const trimmed = draft.trim();
    updateShared("reminderEmail", trimmed);
    setSaveStatus(trimmed ? "saved" : "cleared");
    setTimeout(() => setSaveStatus(""), 2500);
  }

  function toggleEnabled() {
    updateShared("reminderEnabled", !enabled);
  }

  const isDev = import.meta.env.DEV;

  async function handleSendNow() {
    if (isDev) {
      setSendStatus("dev");
      return;
    }
    setSendStatus("sending");
    try {
      const res = await fetch("/api/send-reminders?test=1");
      const json = await res.json().catch(() => ({}));
      setSendStatus(res.ok && json.sent > 0 ? "sent" : "error");
    } catch {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus(""), 5000);
  }

  const isActive = !!saved && enabled;
  const isDirty = draft.trim() !== saved;
  const freqDesc =
    REMINDER_FREQS.find((f) => f.value === frequency)?.desc || "";

  const labelStyle = {
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 18 }}>📧</span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
          Email Reminders
        </span>
        {saved && (
          <button
            onClick={toggleEnabled}
            style={{
              padding: "4px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: isActive ? "var(--green)" : "var(--border)",
              background: isActive ? "rgba(76,175,130,0.1)" : "transparent",
              color: isActive ? "var(--green)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {isActive ? "● ON" : "○ OFF"}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={labelStyle}>Send to</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isDirty && handleSave()}
            placeholder="your@email.com"
            style={{
              flex: 1,
              background: "var(--card-bg, #18181c)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={handleSave}
            disabled={!isDirty}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: isDirty ? "var(--gold, #c9a84c)" : "var(--border)",
              color: isDirty ? "#0c0c0f" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: 13,
              cursor: isDirty ? "pointer" : "default",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {saveStatus === "saved"
              ? "Saved ✓"
              : saveStatus === "cleared"
                ? "Cleared"
                : "Save"}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Frequency</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REMINDER_FREQS.map((f) => (
              <button
                key={f.value}
                onClick={() => updateShared("reminderFrequency", f.value)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor:
                    frequency === f.value
                      ? "var(--gold, #c9a84c)"
                      : "var(--border)",
                  background:
                    frequency === f.value
                      ? "rgba(201,168,76,0.1)"
                      : "transparent",
                  color:
                    frequency === f.value
                      ? "var(--gold, #c9a84c)"
                      : "var(--text-secondary)",
                  fontWeight: frequency === f.value ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div
            style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}
          >
            {freqDesc}
          </div>
        </div>
      )}

      {saved && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(150,150,150,0.04)",
            border: "1px solid var(--border)",
            marginBottom: 14,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.9,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            What&apos;s included in each email
          </div>
          · Insurance renewals due within 7 days
          <br />
          · Goal deadlines approaching in 14 days
          <br />· Budget categories over spending limit
          {frequency === "monthly" && (
            <>
              <br />· Full financial snapshot — savings, investments &amp; net
              worth
            </>
          )}
        </div>
      )}

      {saved && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleSendNow}
              disabled={sendStatus === "sending"}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color:
                  sendStatus === "sent"
                    ? "var(--green)"
                    : sendStatus === "error"
                      ? "var(--red, #e05b5b)"
                      : sendStatus === "dev"
                        ? "var(--gold, #c9a84c)"
                        : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: 12,
                cursor: sendStatus === "sending" ? "default" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {sendStatus === "sending"
                ? "Sending…"
                : sendStatus === "sent"
                  ? "✓ Email sent!"
                  : sendStatus === "error"
                    ? "✕ Failed"
                    : "Send Now"}
            </button>
            {!sendStatus && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Sends immediately to {saved}
              </span>
            )}
          </div>
          {sendStatus === "dev" && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(201,168,76,0.07)",
                border: "1px solid rgba(201,168,76,0.2)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "var(--gold, #c9a84c)" }}>
                Local dev detected
              </strong>{" "}
              — the API endpoint only runs on Vercel.
              <br />
              To test instantly, run in your terminal:
              <br />
              <code
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  padding: "4px 10px",
                  borderRadius: 5,
                  background: "rgba(0,0,0,0.3)",
                  color: "#eeeae4",
                  fontSize: 12,
                  fontFamily: "monospace",
                  userSelect: "all",
                }}
              >
                node scripts/test-email.js
              </code>
            </div>
          )}
          {sendStatus === "error" && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--red, #e05b5b)",
              }}
            >
              Check Vercel → Functions → send-reminders logs for details
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
        Powered by Resend · 3,000 emails/month free
      </div>
    </div>
  );
}

function BiometricSetup() {
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState(isBiometricEnrolled());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useState(() => {
    isBiometricAvailable().then(setAvailable);
  });

  if (!available) return null;

  const handleEnroll = async () => {
    setBusy(true);
    setMsg("");
    const ok = await enrollBiometric();
    setBusy(false);
    if (ok) {
      setEnrolled(true);
      setMsg("✓ Biometric unlock enabled");
    } else {
      setMsg("Enrollment failed or was cancelled.");
    }
    setTimeout(() => setMsg(""), 4000);
  };

  const handleRemove = () => {
    removeBiometric();
    setEnrolled(false);
    setMsg("Biometric unlock removed");
    setTimeout(() => setMsg(""), 3000);
  };

  const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const label = isApple ? "Face ID / Touch ID" : "Fingerprint / Biometric";

  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-card2)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{isApple ? "🫥" : "👆"}</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {enrolled
                ? "Unlock the app without entering your PIN"
                : "Use biometrics instead of PIN"}
            </div>
          </div>
        </div>
        {enrolled ? (
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px", color: "var(--red)" }}
            onClick={handleRemove}
          >
            Remove
          </button>
        ) : (
          <button
            className="btn-primary"
            style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={handleEnroll}
            disabled={busy}
          >
            {busy ? "Setting up…" : "Enable"}
          </button>
        )}
      </div>
      {msg && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: msg.startsWith("✓") ? "var(--green)" : "var(--red)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function PinSetup({ sharedData, updateShared }) {
  const pin = sharedData?.pin || ""; // single hashed PIN for household
  const pinEnabled = sharedData?.pinEnabled !== false;
  const hasPin = !!pin;
  const [editing, setEditing] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinMsg, setPinMsg] = useState("");

  const handleSetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMsg("PIN must be exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg("PINs don't match");
      return;
    }
    const hashed = await hashPin(newPin);
    updateShared("pin", hashed);
    setEditing(false);
    setNewPin("");
    setConfirmPin("");
    setShowPin(false);
    setPinMsg("✓ Household PIN set");
    setTimeout(() => setPinMsg(""), 3000);
  };

  const handleRemovePin = () => {
    updateShared("pin", "");
    setPinMsg("PIN removed");
    setTimeout(() => setPinMsg(""), 3000);
  };

  const inputType = showPin ? "text" : "password";

  return (
    <div className="card section-gap">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="card-title" style={{ marginBottom: 0 }}>
          🔒 PIN Lock
        </div>
        {hasPin && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color: pinEnabled ? "var(--green)" : "var(--text-muted)",
              }}
            >
              {pinEnabled ? "Enabled" : "Disabled"}
            </span>
            <div
              onClick={() => updateShared("pinEnabled", !pinEnabled)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: pinEnabled ? "var(--green)" : "var(--bg-card2)",
                border:
                  "1px solid " +
                  (pinEnabled ? "var(--green)" : "var(--border)"),
                position: "relative",
                transition: "all 0.2s",
              }}
              role="switch"
              aria-checked={pinEnabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  updateShared("pinEnabled", !pinEnabled);
                }
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 1,
                  left: pinEnabled ? 17 : 1,
                  transition: "left 0.2s",
                }}
              />
            </div>
          </label>
        )}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        Set a single 4-digit PIN for the household. Anyone opening the app
        enters this PIN to access your data.
      </div>

      {/* Current status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-card2)",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--gold)",
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Household PIN</span>
          {hasPin ? (
            <span className="tag tag-green" style={{ fontSize: 10 }}>
              PIN set
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              No PIN
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => {
              setEditing(!editing);
              setNewPin("");
              setConfirmPin("");
              setShowPin(false);
              setPinMsg("");
            }}
          >
            {hasPin ? "Change" : "Set PIN"}
          </button>
          {hasPin && (
            <button
              className="btn-ghost"
              style={{
                fontSize: 12,
                padding: "4px 10px",
                color: "var(--red)",
              }}
              onClick={handleRemovePin}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div
          style={{
            marginTop: 12,
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-card2)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
            {hasPin ? "Change" : "Set"} Household PIN
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type={inputType}
              inputMode="numeric"
              maxLength={4}
              placeholder="New PIN"
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              style={{
                width: 90,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
              }}
              autoComplete="off"
            />
            <input
              type={inputType}
              inputMode="numeric"
              maxLength={4}
              placeholder="Confirm"
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              style={{
                width: 90,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
              }}
              autoComplete="off"
            />
            <button
              className="btn-ghost"
              style={{ fontSize: 14, padding: "4px 8px", lineHeight: 1 }}
              onClick={() => setShowPin(!showPin)}
              title={showPin ? "Hide PIN" : "Show PIN"}
              type="button"
            >
              {showPin ? "🙈" : "👁️"}
            </button>
            <button
              className="btn-primary"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={handleSetPin}
            >
              Save
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: "6px 10px" }}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pinMsg && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: pinMsg.startsWith("✓") ? "var(--green)" : "var(--red)",
          }}
        >
          {pinMsg}
        </div>
      )}

      {hasPin && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          🛡️ App will lock on open and after 5 min of inactivity. PIN is hashed
          — never stored in plain text.
        </div>
      )}

      {/* Biometric unlock setup */}
      {hasPin && <BiometricSetup />}
    </div>
  );
}

export function Settings({
  sharedData,
  updateShared,
  updatePerson,
  resetData,
  listBackups,
  restoreBackup,
  createManualBackup,
  seedDevFromProd,
  pushDevToProd,
  onExport,
  isAdmin,
}) {
  const { personNames } = useData();
  const profile = sharedData?.profile || {};
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [backups, setBackups] = useState(null); // null = not loaded
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const [pushConfirmText, setPushConfirmText] = useState("");

  const save = () => {
    updateShared("profile", p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setResetting(true);
    await resetData();
    setShowReset(false);
    setResetting(false);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        Settings
        {isAdmin && (
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--gold-dim)",
              color: "var(--gold)",
              fontWeight: 600,
              letterSpacing: ".05em",
              textTransform: "uppercase",
            }}
          >
            Admin
          </span>
        )}
      </div>
      <div className="card section-gap">
        <div className="card-title">Household profile</div>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Person 1 name
            </label>
            <input
              value={p.person1Name || ""}
              onChange={(e) => setP({ ...p, person1Name: e.target.value })}
              placeholder="Person 1"
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Person 2 name
            </label>
            <input
              value={p.person2Name || ""}
              onChange={(e) => setP({ ...p, person2Name: e.target.value })}
              placeholder="Person 2"
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Household name
            </label>
            <input
              value={p.householdName || ""}
              onChange={(e) => setP({ ...p, householdName: e.target.value })}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              City
            </label>
            <input
              value={p.city || ""}
              onChange={(e) => setP({ ...p, city: e.target.value })}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Savings target (%)
            </label>
            <input
              type="number"
              value={p.savingsTarget || 25}
              onChange={(e) =>
                setP({ ...p, savingsTarget: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <button className="btn-primary" onClick={save}>
          {saved ? "✓ Saved!" : "Save"}
        </button>
      </div>

      {/* Theme Toggle */}
      <div className="card section-gap">
        <div className="card-title">Appearance</div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 12,
          }}
        >
          Choose your preferred color scheme.
        </div>
        <ThemeToggle />
      </div>

      {/* Notifications */}
      <div className="card section-gap">
        <div className="card-title">Notifications</div>
        <ReminderEmailSetting
          sharedData={sharedData}
          updateShared={updateShared}
        />
      </div>

      {/* PIN Lock Setup */}
      <PinSetup sharedData={sharedData} updateShared={updateShared} />

      {/* What's New — Release Notes */}
      <div className="card section-gap">
        <div
          className="card-title"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Sparkles size={16} style={{ color: "var(--gold)" }} />
          What&apos;s New
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {RELEASE_NOTES.map((release, idx) => (
            <div
              key={release.version}
              style={{
                padding: "12px 14px",
                background: idx === 0 ? "var(--gold-dim)" : "var(--bg-card2)",
                border:
                  idx === 0
                    ? "1px solid var(--gold-border)"
                    : "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background:
                      idx === 0 ? "var(--gold)" : "rgba(255,255,255,0.08)",
                    color: idx === 0 ? "#000" : "var(--text-muted)",
                  }}
                >
                  v{release.version}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {new Date(release.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {idx === 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--gold)",
                      fontWeight: 600,
                    }}
                  >
                    LATEST
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {release.title}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                {release.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-title">About WealthOS</div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Personal household finance tracker.
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--gold-dim)",
                border: "1px solid var(--gold-border)",
                color: "var(--gold)",
              }}
            >
              v{APP_VERSION}
            </span>
          </div>
          <div>Data synced securely via Firebase Firestore.</div>
          <div
            style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}
          >
            Stack: React + Vite + Firebase + Recharts
          </div>
        </div>
      </div>

      {/* Apply Payslip Data */}
      {updatePerson && (
        <div className="card section-gap">
          <div className="card-title">📋 Apply Salary Data — FY 2025-26</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            One-click apply Abhav's full FY 2025-26 salary data (BBY Services).
            Sets income to ₹1,84,601/mo take-home and fills Tax Planner with all
            components including incentives.
          </p>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 12,
              lineHeight: 1.7,
            }}
          >
            <div>Basic: ₹96,545 · HRA: ₹38,618 · Special: ₹84,572</div>
            <div>LTA: ₹8,042 · Communication: ₹2,000</div>
            <div>Incentives: ₹2,40,582 (Sep ₹71,542 + Mar ₹1,69,040)</div>
            <div>
              Annual Gross:{" "}
              <strong style={{ color: "var(--gold)" }}>₹29,97,906</strong>
              {" · "}Monthly Net:{" "}
              <strong style={{ color: "var(--green)" }}>₹1,84,601</strong>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              updatePerson("abhav", "incomes", [
                {
                  id: 1,
                  name: "BBY Services Salary",
                  amount: 184601,
                  type: "salary",
                },
              ]);
              updatePerson("abhav", "taxInfo", {
                basicSalary: 96545,
                hra: 38618,
                lta: 8042,
                specialAllowance: 84572,
                communicationAllowance: 2000,
                annualIncentives: 240582,
              });
              setBackupMsg("✓ Abhav's FY 2025-26 salary & tax data applied");
              setTimeout(() => setBackupMsg(""), 4000);
            }}
          >
            Apply to Abhav's Profile
          </button>
        </div>
      )}

      {/* Data Export */}
      {onExport && (
        <div className="card section-gap">
          <div className="card-title">📤 Data Export</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            Download all your data as CSV files (incomes, expenses, investments,
            transactions, debts, insurance, subscriptions, goals, net worth
            history).
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              const count = onExport();
              setBackupMsg(`✓ Exported ${count} CSV files`);
              setTimeout(() => setBackupMsg(""), 4000);
            }}
          >
            📥 Export All Data (CSV)
          </button>
        </div>
      )}

      {/* CSV Bank Statement Import */}
      {updatePerson && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <CSVImport
            personName={personNames?.abhav || "Person 1"}
            onImport={(txns) => {
              const existing = [];
              updatePerson("abhav", "transactions", [...existing, ...txns]);
              setBackupMsg(
                `✓ Imported ${txns.length} transactions for ${personNames?.abhav || "Person 1"}`,
              );
              setTimeout(() => setBackupMsg(""), 4000);
            }}
          />
          <CSVImport
            personName={personNames?.aanya || "Person 2"}
            onImport={(txns) => {
              updatePerson("aanya", "transactions", [...txns]);
              setBackupMsg(
                `✓ Imported ${txns.length} transactions for ${personNames?.aanya || "Person 2"}`,
              );
              setTimeout(() => setBackupMsg(""), 4000);
            }}
          />
        </div>
      )}

      {/* Data Backups & Restore */}
      {listBackups && (
        <div className="card section-gap">
          <div className="card-title">🛡️ Data Backups</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            Automatic backups are created before every save. You can also create
            a manual backup or restore any previous state. Only the latest 3
            manual backups are kept per document — older ones are automatically
            deleted.
          </p>
          {backupMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--green-dim)",
                border: "1px solid rgba(76,175,130,0.3)",
                color: "var(--green)",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {backupMsg}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {createManualBackup && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => setShowBackupConfirm(true)}
                  disabled={backingUp}
                >
                  {backingUp ? "Saving…" : "💾 Backup Now"}
                </button>
                {showBackupConfirm && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 9999,
                    }}
                    onClick={() => setShowBackupConfirm(false)}
                  >
                    <div
                      style={{
                        background: "var(--card-bg, #1a1a2e)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-lg)",
                        padding: "1.5rem",
                        maxWidth: 400,
                        width: "90%",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4 style={{ margin: "0 0 8px", fontSize: 15 }}>
                        Create Manual Backup?
                      </h4>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          margin: "0 0 16px",
                        }}
                      >
                        This will snapshot all your data (abhav, aanya, shared).
                        <br />
                        <br />
                        <strong style={{ color: "var(--gold)" }}>
                          Only the latest 3 manual backups are kept.
                        </strong>{" "}
                        Older manual backups will be automatically deleted to
                        save space. Automatic backups (created on every save)
                        are unaffected.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="btn-ghost"
                          onClick={() => setShowBackupConfirm(false)}
                          style={{ fontSize: 13 }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          disabled={backingUp}
                          onClick={async () => {
                            setShowBackupConfirm(false);
                            setBackingUp(true);
                            try {
                              const docs = await createManualBackup(
                                "manual backup — " +
                                  new Date().toLocaleDateString("en-IN"),
                              );
                              setBackupMsg(`✓ Backed up: ${docs.join(", ")}`);
                              setTimeout(() => setBackupMsg(""), 4000);
                            } catch (err) {
                              setBackupMsg(`Error: ${err.message}`);
                            }
                            setBackingUp(false);
                          }}
                        >
                          Yes, Backup Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {seedDevFromProd && (
              <button
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 16px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Copy production data into the dev collection? This will overwrite dev data.",
                    )
                  )
                    return;
                  setSeeding(true);
                  try {
                    const docs = await seedDevFromProd();
                    setBackupMsg(`✓ Copied prod → dev: ${docs.join(", ")}`);
                    setTimeout(() => setBackupMsg(""), 4000);
                  } catch (err) {
                    setBackupMsg(`Error: ${err.message}`);
                  }
                  setSeeding(false);
                }}
                disabled={seeding}
              >
                {seeding ? "Copying…" : "📋 Copy Prod → Dev"}
              </button>
            )}
            {pushDevToProd && (
              <button
                style={{
                  background: "rgba(239,83,80,0.1)",
                  border: "1px solid rgba(239,83,80,0.3)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 16px",
                  fontSize: 13,
                  color: "#ef5350",
                  cursor: "pointer",
                }}
                onClick={() => setShowPushConfirm(true)}
                disabled={pushing}
              >
                {pushing ? "Pushing…" : "🚀 Push Dev → Prod"}
              </button>
            )}
          </div>
          {/* Double-confirmation dialog for Dev → Prod push */}
          {showPushConfirm && (
            <div
              style={{
                padding: 16,
                borderRadius: "var(--radius-sm)",
                background: "rgba(239,83,80,0.08)",
                border: "1px solid rgba(239,83,80,0.25)",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#ef5350",
                  marginBottom: 8,
                }}
              >
                ⚠️ This will overwrite PRODUCTION data
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  lineHeight: 1.6,
                }}
              >
                Your current dev data will replace all production data (abhav,
                aanya, shared). A backup of prod will be created automatically
                before overwriting.
                <br />
                Type <strong>PUSH</strong> to confirm:
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={pushConfirmText}
                  onChange={(e) => setPushConfirmText(e.target.value)}
                  placeholder="Type PUSH"
                  style={{ width: 120, textTransform: "uppercase" }}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  style={{
                    background:
                      pushConfirmText.trim().toUpperCase() === "PUSH"
                        ? "#ef5350"
                        : "var(--border)",
                    cursor:
                      pushConfirmText.trim().toUpperCase() === "PUSH"
                        ? "pointer"
                        : "not-allowed",
                  }}
                  disabled={
                    pushConfirmText.trim().toUpperCase() !== "PUSH" || pushing
                  }
                  onClick={async () => {
                    setPushing(true);
                    try {
                      const docs = await pushDevToProd();
                      setBackupMsg(`✓ Pushed dev → prod: ${docs.join(", ")}`);
                      setTimeout(() => setBackupMsg(""), 4000);
                    } catch (err) {
                      setBackupMsg(`Error: ${err.message}`);
                    }
                    setPushing(false);
                    setShowPushConfirm(false);
                    setPushConfirmText("");
                  }}
                >
                  {pushing ? "Pushing…" : "Confirm Push"}
                </button>
                <button
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 16px",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setShowPushConfirm(false);
                    setPushConfirmText("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!backups ? (
            <button
              className="btn-primary"
              onClick={async () => {
                setLoadingBackups(true);
                const b = await listBackups();
                setBackups(b);
                setLoadingBackups(false);
              }}
              disabled={loadingBackups}
            >
              {loadingBackups ? "Loading…" : "View Backups"}
            </button>
          ) : (
            <>
              {restoreMsg && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--green-dim)",
                    border: "1px solid rgba(76,175,130,0.3)",
                    color: "var(--green)",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {restoreMsg}
                </div>
              )}
              {backups.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    padding: "12px 0",
                  }}
                >
                  No backups yet. Backups are created automatically as you use
                  the app.
                </div>
              ) : (
                <div style={{ maxHeight: 350, overflowY: "auto" }}>
                  {backups.map((b) => {
                    const ts = b.timestamp ? new Date(b.timestamp) : null;
                    const label = ts
                      ? ts.toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown time";
                    const docLabel =
                      b.docId === "abhav"
                        ? personNames?.abhav || "Person 1"
                        : b.docId === "aanya"
                          ? personNames?.aanya || "Person 2"
                          : "Shared";
                    const d = b.data || {};
                    const preview =
                      b.docId === "shared"
                        ? `${(d.trips || []).length} trips, ${(d.goals || []).length} goals`
                        : `${(d.incomes || []).length} incomes, ${(d.expenses || []).length} expenses, ${(d.investments || []).length} investments`;
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 0",
                          borderBottom: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background:
                              b.docId === "shared"
                                ? "var(--green-dim)"
                                : b.docId === "abhav"
                                  ? "var(--abhav-dim, rgba(96,165,250,0.12))"
                                  : "var(--aanya-dim, rgba(244,114,182,0.12))",
                            color:
                              b.docId === "shared"
                                ? "var(--green)"
                                : b.docId === "abhav"
                                  ? "var(--abhav, #60a5fa)"
                                  : "var(--aanya, #f472b6)",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {docLabel}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "var(--text-secondary)" }}>
                            {label}
                          </div>
                          <div
                            style={{ color: "var(--text-muted)", fontSize: 11 }}
                          >
                            {preview}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Restore ${docLabel} data from ${label}? Your current data will be backed up first.`,
                              )
                            )
                              return;
                            setRestoringId(b.id);
                            try {
                              await restoreBackup(b.id);
                              setRestoreMsg(
                                `✓ Restored ${docLabel} data from ${label}`,
                              );
                              setTimeout(() => setRestoreMsg(""), 4000);
                            } catch (err) {
                              setRestoreMsg(`Error: ${err.message}`);
                            }
                            setRestoringId(null);
                          }}
                          disabled={restoringId === b.id}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "4px 10px",
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {restoringId === b.id ? "Restoring…" : "Restore"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                className="btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => setBackups(null)}
              >
                Close
              </button>
            </>
          )}
        </div>
      )}

      {/* Danger zone — admin only */}
      {isAdmin && (
        <div
          className="card section-gap"
          style={{ border: "1px solid var(--red, #e05c5c)" }}
        >
          <div className="card-title" style={{ color: "var(--red, #e05c5c)" }}>
            Danger Zone
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            This will permanently delete <strong>all</strong> your data —
            incomes, expenses, investments, goals, debts, transactions, and net
            worth history. You'll be taken back to the onboarding flow.
          </p>
          {!showReset ? (
            <button
              onClick={() => setShowReset(true)}
              style={{
                background: "transparent",
                color: "var(--red, #e05c5c)",
                border: "1px solid var(--red, #e05c5c)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 20px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Reset All Data
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--red, #e05c5c)" }}>
                Are you sure?
              </span>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  background: "var(--red, #e05c5c)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 20px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {resetting ? "Resetting…" : "Yes, delete everything"}
              </button>
              <button className="btn-ghost" onClick={() => setShowReset(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Re-export CashFlow components (extracted to CashFlow.jsx)
export { CashFlow, HouseholdCashFlow } from "./CashFlow";
