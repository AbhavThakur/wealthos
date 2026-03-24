import { useState, useCallback } from "react";

function useSessionState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const s = sessionStorage.getItem(key);
      return s !== null ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v) => {
      setVal(v);
      try {
        sessionStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* empty */
      }
    },
    [key],
  );
  return [val, set];
}

import {
  fmt,
  nextId,
  EXPENSE_CATEGORIES,
  calcEMI,
  lumpCorpus,
} from "../utils/finance";
import { Plus, Trash2, Search, RefreshCw, Bell, BellOff } from "lucide-react";
import { useConfirm, useUndoToast } from "../App";
import { autoRecurringRules } from "../context/DataContext";

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

  const grossAnnual = grossMonthly * 12;

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

      {/* Gross Salary Breakdown from Payslip */}
      {grossMonthly > 0 && (
        <div className="card section-gap">
          <div className="card-title">📋 Salary Breakdown (from payslip)</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "6px 16px",
              fontSize: 13,
            }}
          >
            {[
              ["Basic", t.basicSalary],
              ["HRA", t.hra],
              ["Special Allowance", t.specialAllowance],
              ["LTA", t.lta],
              ["Communication", t.communicationAllowance],
            ]
              .filter(([, v]) => v > 0)
              .map(([label, val]) => [
                <span
                  key={label + "l"}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {label}
                </span>,
                <span key={label + "v"} style={{ textAlign: "right" }}>
                  {fmt(val)}/mo
                </span>,
              ])}
            <div
              style={{
                gridColumn: "1/-1",
                borderTop: "1px solid var(--border)",
                margin: "4px 0",
              }}
            />
            <span style={{ fontWeight: 600 }}>Gross monthly</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {fmt(grossMonthly)}
            </span>
            <span style={{ fontWeight: 600 }}>Gross annual</span>
            <span
              style={{
                textAlign: "right",
                fontWeight: 600,
                color: "var(--gold)",
              }}
            >
              {fmt(grossMonthly * 12)}
            </span>
          </div>
          {annualIncome > 0 && annualIncome !== grossMonthly * 12 && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}
            >
              ⚠ Your Budget income ({fmt(annualIncome)}/yr) differs from payslip
              gross ({fmt(grossMonthly * 12)}/yr). Tax is calculated on Budget
              income (take-home × 12).
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
  const pLabel = (o) => (o === "abhav" ? "Abhav" : "Aanya");

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
            { id: "abhav", label: "Abhav", color: "var(--abhav)" },
            { id: "aanya", label: "Aanya", color: "var(--aanya)" },
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
                  { id: "abhav", label: "Abhav", color: "var(--abhav)" },
                  { id: "aanya", label: "Aanya", color: "var(--aanya)" },
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
  const pLabel = (o) => (o === "abhav" ? "Abhav" : "Aanya");

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
                { id: "abhav", label: "Abhav", color: "var(--abhav)" },
                { id: "aanya", label: "Aanya", color: "var(--aanya)" },
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
}) {
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
        }}
      >
        Settings
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
      <div className="card section-gap">
        <div className="card-title">About WealthOS</div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.8,
          }}
        >
          <div>Personal finance tracker for Abhav & Aanya.</div>
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
          <div className="card-title">📋 Apply Salary Slip — Dec 2025</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            One-click apply Abhav's salary slip data (BBY Services, Dec 2025).
            Sets income to ₹1,84,601 take-home and fills Tax Planner fields.
          </p>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            <div>Basic: ₹96,545 · HRA: ₹38,618 · LTA: ₹8,042</div>
            <div>PF: ₹11,585 · Prof Tax: ₹200 · Income Tax: ₹33,341</div>
            <div>
              Gross: ₹2,29,777 · Deductions: ₹45,176 ·{" "}
              <strong style={{ color: "var(--green)" }}>Net: ₹1,84,601</strong>
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
              });
              setBackupMsg(
                "✓ Abhav's income & tax planner updated from salary slip",
              );
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
            a manual backup or restore any previous state.
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
              <button
                className="btn-primary"
                onClick={async () => {
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
                disabled={backingUp}
              >
                {backingUp ? "Saving…" : "💾 Backup Now"}
              </button>
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
                        ? "Abhav"
                        : b.docId === "aanya"
                          ? "Aanya"
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

      {/* Danger zone */}
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
          This will permanently delete <strong>all</strong> your data — incomes,
          expenses, investments, goals, debts, transactions, and net worth
          history. You'll be taken back to the onboarding flow.
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
    </div>
  );
}

// ─── Cash Flow (merged Transactions + Recurring) ───────────────────────────

const SOURCE_LABELS = {
  income: "Budget → Income",
  expense: "Budget → Expenses",
  investment: "Investments",
  debt: "Debts → EMI",
};

function CashFlowScheduleRow({ r, isAuto, personBadge }) {
  const typeColor =
    r.type === "income"
      ? "var(--green)"
      : r.type === "investment"
        ? "var(--gold)"
        : "var(--red)";
  const typeDim =
    r.type === "income"
      ? "var(--green-dim)"
      : r.type === "investment"
        ? "var(--gold-dim)"
        : "var(--red-dim)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: typeDim,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: typeColor,
            lineHeight: 1,
          }}
        >
          {r.dayOfMonth || 1}
        </div>
        <div style={{ fontSize: 9, color: typeColor, opacity: 0.7 }}>day</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.desc}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {r.category}
          {isAuto && r.sourceType && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                background: "var(--bg-card2)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              {SOURCE_LABELS[r.sourceType] || "auto-synced"}
            </span>
          )}
        </div>
      </div>
      {personBadge}
      <span
        className={`tag ${r.type === "income" ? "tag-green" : r.type === "investment" ? "tag-gold" : "tag-red"}`}
      >
        {r.type}
      </span>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: typeColor,
          minWidth: 80,
          textAlign: "right",
        }}
      >
        {r.amount > 0 ? "+" : ""}
        {fmt(r.amount)}
      </div>
    </div>
  );
}

const CF_TABS = [
  ["schedule", "📅 Schedule"],
  ["history", "🧾 History"],
  ["rules", "🔁 Rules"],
];

export function CashFlow({ data, personName, personColor, updatePerson }) {
  const [tab, setTab] = useState("schedule");
  const [search, setSearch] = useSessionState(`cf_search_${personName}`, "");
  const [filterType, setFilterType] = useSessionState(
    `cf_filter_${personName}`,
    "all",
  );
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [expandedSchedCats, setExpandedSchedCats] = useState({});
  const [expandedHistCats, setExpandedHistCats] = useState({});
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const [newRule, setNewRule] = useState({
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
    dayOfMonth: 1,
    active: true,
  });
  const { confirm, dialog } = useConfirm();

  const transactions = data?.transactions || [];
  const manualRules = (data?.recurringRules || []).filter((r) => !r.auto);
  const autoRules = autoRecurringRules(data || {});
  const allActiveRules = [
    ...autoRules,
    ...manualRules.filter((r) => r.active !== false),
  ];

  const now = new Date();
  const today = now.getDate();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthName = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const monthTx = transactions.filter((t) => t.date?.startsWith(ym));
  const loggedIn = monthTx
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const loggedOut = monthTx
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const scheduledIn = allActiveRules
    .filter((r) => r.amount > 0)
    .reduce((s, r) => s + r.amount, 0);
  const scheduledOut = allActiveRules
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount), 0);

  const scheduleItems = [...allActiveRules].sort(
    (a, b) => (a.dayOfMonth || 1) - (b.dayOfMonth || 1),
  );
  const dueItems = scheduleItems.filter((r) => (r.dayOfMonth || 1) <= today);
  const upcomingItems = scheduleItems.filter(
    (r) => (r.dayOfMonth || 1) > today,
  );

  const filtered = transactions
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

  const addTx = () => {
    if (!newTx.desc || !newTx.amount) return;
    const amt =
      newTx.type === "income"
        ? Math.abs(Number(newTx.amount))
        : -Math.abs(Number(newTx.amount));
    updatePerson("transactions", [
      { ...newTx, id: nextId(transactions), amount: amt },
      ...transactions,
    ]);
    setNewTx({
      date: new Date().toISOString().slice(0, 10),
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
    });
    setShowAddTx(false);
  };

  const addRule = () => {
    if (!newRule.desc || !newRule.amount) return;
    const amt =
      newRule.type === "income"
        ? Math.abs(Number(newRule.amount))
        : -Math.abs(Number(newRule.amount));
    updatePerson("recurringRules", [
      ...manualRules,
      {
        ...newRule,
        id: nextId(manualRules),
        amount: amt,
        dayOfMonth: Number(newRule.dayOfMonth),
      },
    ]);
    setNewRule({
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
      dayOfMonth: 1,
      active: true,
    });
    setShowAddRule(false);
  };

  const toggleRule = (id) =>
    updatePerson(
      "recurringRules",
      manualRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );

  const deleteRule = async (id) => {
    const rule = manualRules.find((r) => r.id === id);
    if (await confirm("Delete rule?", `Remove "${rule?.desc}" recurring rule?`))
      updatePerson(
        "recurringRules",
        manualRules.filter((r) => r.id !== id),
      );
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Cash Flow
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
        }}
      >
        {monthName} · {allActiveRules.length} recurring items ·{" "}
        {transactions.length} transactions logged
      </div>

      {/* 4-metric strip */}
      <div className="grid-4 section-gap">
        <div className="metric-card">
          <div className="metric-label">Scheduled in</div>
          <div className="metric-value green-text">{fmt(scheduledIn)}</div>
          <div className="metric-sub">per month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Scheduled out</div>
          <div className="metric-value red-text">{fmt(scheduledOut)}</div>
          <div className="metric-sub">per month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Logged in</div>
          <div className="metric-value green-text">{fmt(loggedIn)}</div>
          <div className="metric-sub">{monthName}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Logged out</div>
          <div className="metric-value red-text">{fmt(loggedOut)}</div>
          <div className="metric-sub">{monthName}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        {CF_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              background: tab === id ? "var(--gold-dim)" : "transparent",
              color: tab === id ? "var(--gold)" : "var(--text-secondary)",
              border:
                tab === id
                  ? "1px solid var(--gold-border)"
                  : "1px solid var(--border)",
              fontSize: 13,
              fontWeight: tab === id ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Schedule tab ── */}
      {tab === "schedule" && (
        <div>
          {scheduleItems.length === 0 && (
            <div className="tip">
              No recurring items found. Add income, expenses, or investments in
              Budget to see them here. Use the Rules tab to add custom items
              like subscriptions.
            </div>
          )}
          {dueItems.length > 0 && (
            <div className="card section-gap">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Already due · day 1–{today}
                </div>
                <span className="tag tag-gold">{dueItems.length} items</span>
              </div>
              {(() => {
                const groups = {};
                for (const r of dueItems) {
                  const cat = r.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(r);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, r) => s + Math.abs(r.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const key = `due::${cat}`;
                    const isOpen = expandedSchedCats[key] !== false;
                    return (
                      <div key={cat} style={{ marginBottom: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "7px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() =>
                            setExpandedSchedCats((s) => ({
                              ...s,
                              [key]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((r, i) => (
                            <CashFlowScheduleRow
                              key={i}
                              r={r}
                              isAuto={!!r.auto}
                            />
                          ))}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
          {upcomingItems.length > 0 && (
            <div className="card section-gap">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Coming up · day {today + 1}–end of month
                </div>
                <span className="tag tag-green">
                  {upcomingItems.length} items
                </span>
              </div>
              {(() => {
                const groups = {};
                for (const r of upcomingItems) {
                  const cat = r.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(r);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, r) => s + Math.abs(r.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const key = `up::${cat}`;
                    const isOpen = expandedSchedCats[key] !== false;
                    return (
                      <div key={cat} style={{ marginBottom: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "7px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() =>
                            setExpandedSchedCats((s) => ({
                              ...s,
                              [key]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((r, i) => (
                            <CashFlowScheduleRow
                              key={i}
                              r={r}
                              isAuto={!!r.auto}
                            />
                          ))}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
          {scheduledIn > scheduledOut && (
            <div className="tip">
              💰 Expected net savings this month:{" "}
              {fmt(scheduledIn - scheduledOut)} (
              {Math.round(((scheduledIn - scheduledOut) / scheduledIn) * 100)}%
              of income)
            </div>
          )}
          {/* ── FD Maturities ── */}
          {(() => {
            const fdInvs = (data?.investments || []).filter(
              (inv) => inv.type === "FD" && inv.endDate,
            );
            if (fdInvs.length === 0) return null;
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(today).padStart(2, "0")}`;
            const sorted = [...fdInvs].sort((a, b) =>
              a.endDate.localeCompare(b.endDate),
            );
            return (
              <div className="card section-gap">
                <div className="card-title">🏦 FD Maturities</div>
                {sorted.map((inv) => {
                  const isMatured = inv.endDate < todayStr;
                  const isThisMonth = !isMatured && inv.endDate.startsWith(ym);
                  const tenureYrs = inv.startDate
                    ? Math.max(
                        0,
                        (new Date(inv.endDate) - new Date(inv.startDate)) /
                          (365.25 * 24 * 3600 * 1000),
                      )
                    : null;
                  const matVal =
                    tenureYrs !== null
                      ? lumpCorpus(
                          inv.amount || 0,
                          inv.returnPct || 0,
                          tenureYrs,
                        )
                      : null;
                  return (
                    <div
                      key={inv.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {inv.name}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          Principal: {fmt(inv.amount || 0)} · {inv.returnPct}% ·
                          matures {inv.endDate}
                        </div>
                      </div>
                      {isMatured && (
                        <span className="tag tag-red">✓ Matured</span>
                      )}
                      {isThisMonth && (
                        <span className="tag tag-gold">⏰ This month</span>
                      )}
                      {!isMatured && !isThisMonth && (
                        <span className="tag">📅 Upcoming</span>
                      )}
                      {matVal !== null && (
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--green)",
                            minWidth: 90,
                            textAlign: "right",
                          }}
                        >
                          {fmt(Math.round(matVal))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div>
          <div className="grid-3 section-gap">
            <div className="metric-card">
              <div className="metric-label">In (filtered)</div>
              <div className="metric-value green-text">{fmt(totalIn)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Out (filtered)</div>
              <div className="metric-value red-text">{fmt(totalOut)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net</div>
              <div
                className="metric-value"
                style={{
                  color:
                    totalIn - totalOut >= 0 ? "var(--green)" : "var(--red)",
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
                  onClick={() => setFilterType(f)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    background:
                      filterType === f ? "var(--gold-dim)" : "transparent",
                    color:
                      filterType === f
                        ? "var(--gold)"
                        : "var(--text-secondary)",
                    border:
                      filterType === f
                        ? "1px solid var(--gold-border)"
                        : "1px solid var(--border)",
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
              <button
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowAddTx((s) => !s)}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            {showAddTx && (
              <div
                style={{
                  background: "var(--bg-card2)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div className="grid-2" style={{ marginBottom: 10 }}>
                  {[
                    ["date", "Date", "date"],
                    ["desc", "Description", "text"],
                    ["amount", "Amount (₹)", "number"],
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
                        value={newTx[key]}
                        onChange={(e) =>
                          setNewTx({ ...newTx, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
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
                      value={newTx.type}
                      onChange={(e) =>
                        setNewTx({ ...newTx, type: e.target.value })
                      }
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
                      value={newTx.category}
                      onChange={(e) =>
                        setNewTx({ ...newTx, category: e.target.value })
                      }
                    >
                      {ALL_CATS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={addTx}>
                    Add
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowAddTx(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {filtered.length === 0 ? (
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
            ) : (
              (() => {
                const groups = {};
                for (const tx of filtered) {
                  const cat = tx.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(tx);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, tx) => s + Math.abs(tx.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const isOpen = expandedHistCats[cat] !== false;
                    return (
                      <div key={cat}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                            background: "var(--bg-card)",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                          onClick={() =>
                            setExpandedHistCats((s) => ({
                              ...s,
                              [cat]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((tx) => (
                            <div
                              key={tx.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 0 8px 12px",
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
                                <div style={{ fontSize: 13, fontWeight: 500 }}>
                                  {tx.desc}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {tx.date}
                                </div>
                              </div>
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
                                    await confirm(
                                      "Delete transaction?",
                                      `Remove "${tx.desc}"?`,
                                    )
                                  )
                                    updatePerson(
                                      "transactions",
                                      transactions.filter(
                                        (x) => x.id !== tx.id,
                                      ),
                                    );
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                      </div>
                    );
                  });
              })()
            )}
          </div>
        </div>
      )}

      {/* ── Rules tab ── */}
      {tab === "rules" && (
        <div>
          {autoRules.length > 0 && (
            <div className="card section-gap">
              <div className="card-title" style={{ marginBottom: "0.5rem" }}>
                🔗 Auto-synced ({autoRules.length})
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                Derived from Budget, Investments, and Debts. Edit them there to
                update here automatically.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {autoRules.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--bg-card2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "5px 10px",
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background:
                          r.type === "income"
                            ? "var(--green)"
                            : r.type === "investment"
                              ? "var(--gold)"
                              : "var(--red)",
                      }}
                    />
                    <span style={{ fontWeight: 500 }}>{r.desc}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {fmt(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card section-gap">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div className="card-title" style={{ marginBottom: 0 }}>
                Custom rules
              </div>
              <button
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowAddRule((s) => !s)}
              >
                <Plus size={13} /> Add rule
              </button>
            </div>

            {showAddRule && (
              <div
                style={{
                  background: "var(--bg-card2)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div className="grid-2" style={{ marginBottom: 10 }}>
                  {[
                    ["desc", "Description", "text"],
                    ["amount", "Amount (₹)", "number"],
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
                        placeholder={
                          key === "desc" ? "e.g. Netflix" : "e.g. 649"
                        }
                        value={newRule[key]}
                        onChange={(e) =>
                          setNewRule({ ...newRule, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
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
                      value={newRule.type}
                      onChange={(e) =>
                        setNewRule({ ...newRule, type: e.target.value })
                      }
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
                      value={newRule.category}
                      onChange={(e) =>
                        setNewRule({ ...newRule, category: e.target.value })
                      }
                    >
                      {ALL_CATS.map((c) => (
                        <option key={c}>{c}</option>
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
                      Day of month (1–28)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={newRule.dayOfMonth}
                      onChange={(e) =>
                        setNewRule({ ...newRule, dayOfMonth: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={addRule}>
                    Add
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowAddRule(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {manualRules.length === 0 && !showAddRule && (
              <div
                style={{
                  textAlign: "center",
                  padding: "1.5rem",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No custom rules yet. Add subscriptions like Netflix, Spotify,
                gym etc. that aren't tracked in Budget.
              </div>
            )}

            {manualRules.map((r) => {
              const typeColor =
                r.type === "income"
                  ? "var(--green)"
                  : r.type === "investment"
                    ? "var(--gold)"
                    : "var(--red)";
              const typeDim =
                r.type === "income"
                  ? "var(--green-dim)"
                  : r.type === "investment"
                    ? "var(--gold-dim)"
                    : "var(--red-dim)";
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    opacity: r.active ? 1 : 0.45,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: typeDim,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <RefreshCw size={14} color={typeColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {r.desc}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Day {r.dayOfMonth} every month · {r.category}
                    </div>
                  </div>
                  <span
                    className={`tag ${r.type === "income" ? "tag-green" : r.type === "investment" ? "tag-gold" : "tag-red"}`}
                  >
                    {r.type}
                  </span>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: typeColor,
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {r.amount > 0 ? "+" : ""}
                    {fmt(r.amount)}
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => toggleRule(r.id)}
                    aria-label={
                      r.active ? `Pause ${r.desc}` : `Resume ${r.desc}`
                    }
                  >
                    {r.active ? (
                      <Bell size={14} color="var(--green)" />
                    ) : (
                      <BellOff size={14} />
                    )}
                  </button>
                  <button
                    className="btn-danger"
                    aria-label={`Delete ${r.desc}`}
                    onClick={() => deleteRule(r.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="tip">
            💡 Custom rules are for subscriptions or payments not tracked in
            Budget, Investments, or Debts.
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
}

export function HouseholdCashFlow({ abhav, aanya, updatePerson }) {
  const [tab, setTab] = useState("schedule");
  const [search, setSearch] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showAddTx, setShowAddTx] = useState(false);
  const [addFor, setAddFor] = useState("abhav");
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const { confirm, dialog } = useConfirm();
  const [expandedSchedCats, setExpandedSchedCats] = useState({});
  const [expandedHistCats, setExpandedHistCats] = useState({});

  const abhavAutoRules = autoRecurringRules(abhav || {}).map((r) => ({
    ...r,
    _owner: "abhav",
  }));
  const aanyaAutoRules = autoRecurringRules(aanya || {}).map((r) => ({
    ...r,
    _owner: "aanya",
  }));
  const abhavManualRules = (abhav?.recurringRules || []).filter((r) => !r.auto);
  const aanyaManualRules = (aanya?.recurringRules || []).filter((r) => !r.auto);

  const allActiveRules = [
    ...abhavAutoRules,
    ...abhavManualRules
      .filter((r) => r.active !== false)
      .map((r) => ({ ...r, _owner: "abhav" })),
    ...aanyaAutoRules,
    ...aanyaManualRules
      .filter((r) => r.active !== false)
      .map((r) => ({ ...r, _owner: "aanya" })),
  ];

  const now = new Date();
  const today = now.getDate();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthName = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const abhavTx = (abhav?.transactions || []).map((x) => ({
    ...x,
    _owner: "abhav",
  }));
  const aanyaTx = (aanya?.transactions || []).map((x) => ({
    ...x,
    _owner: "aanya",
  }));
  const monthTx = [...abhavTx, ...aanyaTx].filter((t) =>
    t.date?.startsWith(ym),
  );
  const loggedIn = monthTx
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const loggedOut = monthTx
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const scheduledIn = allActiveRules
    .filter((r) => r.amount > 0)
    .reduce((s, r) => s + r.amount, 0);
  const scheduledOut = allActiveRules
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount), 0);

  const scheduleItems = [...allActiveRules].sort(
    (a, b) => (a.dayOfMonth || 1) - (b.dayOfMonth || 1),
  );
  const dueItems = scheduleItems.filter((r) => (r.dayOfMonth || 1) <= today);
  const upcomingItems = scheduleItems.filter(
    (r) => (r.dayOfMonth || 1) > today,
  );

  const pColor = (o) => (o === "abhav" ? "var(--abhav)" : "var(--aanya)");
  const pLabel = (o) => (o === "abhav" ? "Abhav" : "Aanya");

  const personBadge = (owner) => (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: pColor(owner),
        background: `color-mix(in srgb, ${pColor(owner)} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${pColor(owner)} 30%, transparent)`,
        borderRadius: "var(--radius-sm)",
        padding: "2px 7px",
        flexShrink: 0,
      }}
    >
      {pLabel(owner)}
    </span>
  );

  const sourceTx =
    filterPerson === "all"
      ? [...abhavTx, ...aanyaTx]
      : filterPerson === "abhav"
        ? abhavTx
        : aanyaTx;

  const filtered = sourceTx
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

  const addTx = () => {
    if (!newTx.desc || !newTx.amount) return;
    const amt =
      newTx.type === "income"
        ? Math.abs(Number(newTx.amount))
        : -Math.abs(Number(newTx.amount));
    const ownerData = addFor === "abhav" ? abhav : aanya;
    const txs = ownerData?.transactions || [];
    updatePerson(addFor, "transactions", [
      { ...newTx, id: nextId(txs), amount: amt },
      ...txs,
    ]);
    setNewTx({
      date: new Date().toISOString().slice(0, 10),
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
    });
    setShowAddTx(false);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Cash Flow
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
        }}
      >
        {monthName} · {allActiveRules.length} combined recurring items
      </div>

      <div className="grid-4 section-gap">
        <div className="metric-card">
          <div className="metric-label">Scheduled in</div>
          <div className="metric-value green-text">{fmt(scheduledIn)}</div>
          <div className="metric-sub">per month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Scheduled out</div>
          <div className="metric-value red-text">{fmt(scheduledOut)}</div>
          <div className="metric-sub">per month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Logged in</div>
          <div className="metric-value green-text">{fmt(loggedIn)}</div>
          <div className="metric-sub">{monthName}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Logged out</div>
          <div className="metric-value red-text">{fmt(loggedOut)}</div>
          <div className="metric-sub">{monthName}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        {CF_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              background: tab === id ? "var(--gold-dim)" : "transparent",
              color: tab === id ? "var(--gold)" : "var(--text-secondary)",
              border:
                tab === id
                  ? "1px solid var(--gold-border)"
                  : "1px solid var(--border)",
              fontSize: 13,
              fontWeight: tab === id ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Schedule ── */}
      {tab === "schedule" && (
        <div>
          {dueItems.length > 0 && (
            <div className="card section-gap">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Already due · day 1–{today}
                </div>
                <span className="tag tag-gold">{dueItems.length} items</span>
              </div>
              {(() => {
                const groups = {};
                for (const r of dueItems) {
                  const cat = r.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(r);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, r) => s + Math.abs(r.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const key = `hh-due::${cat}`;
                    const isOpen = expandedSchedCats[key] !== false;
                    return (
                      <div key={cat} style={{ marginBottom: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "7px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() =>
                            setExpandedSchedCats((s) => ({
                              ...s,
                              [key]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((r, i) => (
                            <CashFlowScheduleRow
                              key={i}
                              r={r}
                              isAuto={!!r.auto}
                              personBadge={
                                r._owner ? personBadge(r._owner) : null
                              }
                            />
                          ))}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
          {upcomingItems.length > 0 && (
            <div className="card section-gap">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Coming up · day {today + 1}–end of month
                </div>
                <span className="tag tag-green">
                  {upcomingItems.length} items
                </span>
              </div>
              {(() => {
                const groups = {};
                for (const r of upcomingItems) {
                  const cat = r.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(r);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, r) => s + Math.abs(r.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const key = `hh-up::${cat}`;
                    const isOpen = expandedSchedCats[key] !== false;
                    return (
                      <div key={cat} style={{ marginBottom: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "7px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() =>
                            setExpandedSchedCats((s) => ({
                              ...s,
                              [key]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((r, i) => (
                            <CashFlowScheduleRow
                              key={i}
                              r={r}
                              isAuto={!!r.auto}
                              personBadge={
                                r._owner ? personBadge(r._owner) : null
                              }
                            />
                          ))}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
          {scheduleItems.length === 0 && (
            <div className="tip">
              No recurring items found. Add income, expenses, and investments in
              each person's Budget view.
            </div>
          )}
          {scheduledIn > scheduledOut && (
            <div className="tip">
              💰 Household expected monthly savings:{" "}
              {fmt(scheduledIn - scheduledOut)}
            </div>
          )}
          {/* ── FD Maturities ── */}
          {(() => {
            const allFdInvs = [
              ...(abhav?.investments || []).map((inv) => ({
                ...inv,
                _owner: "abhav",
              })),
              ...(aanya?.investments || []).map((inv) => ({
                ...inv,
                _owner: "aanya",
              })),
            ].filter((inv) => inv.type === "FD" && inv.endDate);
            if (allFdInvs.length === 0) return null;
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(today).padStart(2, "0")}`;
            const sorted = [...allFdInvs].sort((a, b) =>
              a.endDate.localeCompare(b.endDate),
            );
            return (
              <div className="card section-gap">
                <div className="card-title">🏦 FD Maturities</div>
                {sorted.map((inv) => {
                  const isMatured = inv.endDate < todayStr;
                  const isThisMonth = !isMatured && inv.endDate.startsWith(ym);
                  const tenureYrs = inv.startDate
                    ? Math.max(
                        0,
                        (new Date(inv.endDate) - new Date(inv.startDate)) /
                          (365.25 * 24 * 3600 * 1000),
                      )
                    : null;
                  const matVal =
                    tenureYrs !== null
                      ? lumpCorpus(
                          inv.amount || 0,
                          inv.returnPct || 0,
                          tenureYrs,
                        )
                      : null;
                  return (
                    <div
                      key={`${inv._owner}-${inv.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {inv.name}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          Principal: {fmt(inv.amount || 0)} · {inv.returnPct}% ·
                          matures {inv.endDate}
                        </div>
                      </div>
                      {personBadge(inv._owner)}
                      {isMatured && (
                        <span className="tag tag-red">✓ Matured</span>
                      )}
                      {isThisMonth && (
                        <span className="tag tag-gold">⏰ This month</span>
                      )}
                      {!isMatured && !isThisMonth && (
                        <span className="tag">📅 Upcoming</span>
                      )}
                      {matVal !== null && (
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--green)",
                            minWidth: 90,
                            textAlign: "right",
                          }}
                        >
                          {fmt(Math.round(matVal))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <div>
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
                  color:
                    totalIn - totalOut >= 0 ? "var(--green)" : "var(--red)",
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
                { id: "all", label: "All" },
                { id: "abhav", label: "Abhav" },
                { id: "aanya", label: "Aanya" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilterPerson(id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    background:
                      filterPerson === id ? "var(--gold-dim)" : "transparent",
                    color:
                      filterPerson === id
                        ? "var(--gold)"
                        : "var(--text-secondary)",
                    border:
                      filterPerson === id
                        ? "1px solid var(--gold-border)"
                        : "1px solid var(--border)",
                    cursor: "pointer",
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
                      filterType === f
                        ? "var(--gold)"
                        : "var(--text-secondary)",
                    border:
                      filterType === f
                        ? "1px solid var(--gold-border)"
                        : "1px solid var(--border)",
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
              <button
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowAddTx((s) => !s)}
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {showAddTx && (
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
                        label: "Abhav",
                        color: "var(--abhav)",
                      },
                      {
                        id: "aanya",
                        label: "Aanya",
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
                          color:
                            addFor === id ? color : "var(--text-secondary)",
                          border: `1px solid ${addFor === id ? color : "var(--border)"}`,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid-2" style={{ marginBottom: 10 }}>
                  {[
                    ["date", "Date", "date"],
                    ["desc", "Description", "text"],
                    ["amount", "Amount (₹)", "number"],
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
                        value={newTx[key]}
                        onChange={(e) =>
                          setNewTx({ ...newTx, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
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
                      value={newTx.type}
                      onChange={(e) =>
                        setNewTx({ ...newTx, type: e.target.value })
                      }
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
                      value={newTx.category}
                      onChange={(e) =>
                        setNewTx({ ...newTx, category: e.target.value })
                      }
                    >
                      {ALL_CATS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={addTx}>
                    Add
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowAddTx(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
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
            ) : (
              (() => {
                const groups = {};
                for (const tx of filtered) {
                  const cat = tx.category || "Other";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(tx);
                }
                return Object.entries(groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, items]) => {
                    const total = items.reduce(
                      (s, tx) => s + Math.abs(tx.amount),
                      0,
                    );
                    const catColor =
                      items[0].type === "income"
                        ? "var(--green)"
                        : items[0].type === "investment"
                          ? "var(--gold)"
                          : "var(--red)";
                    const isOpen = expandedHistCats[cat] !== false;
                    return (
                      <div key={cat}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            userSelect: "none",
                            background: "var(--bg-card)",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                          onClick={() =>
                            setExpandedHistCats((s) => ({
                              ...s,
                              [cat]: !isOpen,
                            }))
                          }
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {cat}
                            <span
                              style={{
                                fontWeight: 400,
                                marginLeft: 5,
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              ({items.length})
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: catColor,
                            }}
                          >
                            {fmt(total)}
                          </span>
                        </div>
                        {isOpen &&
                          items.map((tx) => (
                            <div
                              key={`${tx._owner}-${tx.id}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 0 8px 12px",
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
                                <div style={{ fontSize: 13, fontWeight: 500 }}>
                                  {tx.desc}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {tx.date}
                                </div>
                              </div>
                              {personBadge(tx._owner)}
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
                                    await confirm(
                                      "Delete transaction?",
                                      `Remove "${tx.desc}"?`,
                                    )
                                  ) {
                                    const ownerData =
                                      tx._owner === "abhav" ? abhav : aanya;
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
                      </div>
                    );
                  });
              })()
            )}
          </div>
        </div>
      )}

      {/* ── Rules ── */}
      {tab === "rules" && (
        <div className="grid-2" style={{ gap: "1.25rem" }}>
          {[
            {
              owner: "abhav",
              pData: abhav,
              color: "var(--abhav)",
              label: "Abhav",
              manualRules: abhavManualRules,
            },
            {
              owner: "aanya",
              pData: aanya,
              color: "var(--aanya)",
              label: "Aanya",
              manualRules: aanyaManualRules,
            },
          ].map(({ owner, pData, color, label, manualRules: rules }) => (
            <div key={owner} className="card">
              <div
                className="card-title"
                style={{ color, marginBottom: "0.5rem" }}
              >
                {label}'s Rules
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                {autoRecurringRules(pData || {}).length} auto-synced ·{" "}
                {rules.length} custom
              </div>
              {rules.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  No custom rules
                </div>
              )}
              {rules.map((r) => {
                const typeColor =
                  r.type === "income"
                    ? "var(--green)"
                    : r.type === "investment"
                      ? "var(--gold)"
                      : "var(--red)";
                const typeDim =
                  r.type === "income"
                    ? "var(--green-dim)"
                    : r.type === "investment"
                      ? "var(--gold-dim)"
                      : "var(--red-dim)";
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      opacity: r.active ? 1 : 0.45,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: typeDim,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <RefreshCw size={12} color={typeColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {r.desc}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Day {r.dayOfMonth}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: typeColor,
                      }}
                    >
                      {fmt(r.amount)}
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() =>
                        updatePerson(
                          owner,
                          "recurringRules",
                          (pData?.recurringRules || [])
                            .filter((x) => !x.auto)
                            .map((x) =>
                              x.id === r.id ? { ...x, active: !x.active } : x,
                            ),
                        )
                      }
                      aria-label={r.active ? "Pause" : "Resume"}
                    >
                      {r.active ? (
                        <Bell size={13} color="var(--green)" />
                      ) : (
                        <BellOff size={13} />
                      )}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (
                          await confirm("Delete rule?", `Remove "${r.desc}"?`)
                        )
                          updatePerson(
                            owner,
                            "recurringRules",
                            (pData?.recurringRules || []).filter(
                              (x) => !x.auto && x.id !== r.id,
                            ),
                          );
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {dialog}
    </div>
  );
}
