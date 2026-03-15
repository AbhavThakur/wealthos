import { useState } from "react";
import { fmt, nextId, EXPENSE_CATEGORIES, calcEMI } from "../utils/finance";
import { Plus, Trash2, Search, RefreshCw, Bell, BellOff } from "lucide-react";
import { useConfirm } from "../App";
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
  const { confirm, dialog } = useConfirm();

  const totalEMI = debts.reduce((s, d) => s + d.emi, 0);
  const totalOut = debts.reduce((s, d) => s + d.outstanding, 0);
  const income = data?.incomes?.reduce((s, x) => s + x.amount, 0) ?? 0;
  const dti = income > 0 ? Math.round((totalEMI / income) * 100) : 0;

  const add = () => {
    if (!n.name) return;
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
      {dialog}
    </div>
  );
}

const ALL_CATS = ["Salary", "Investment", ...EXPENSE_CATEGORIES];

export function Transactions({ data, personName, personColor, updatePerson }) {
  const transactions = data?.transactions || [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const { confirm, dialog } = useConfirm();

  const add = () => {
    if (!n.desc || !n.amount) return;
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
                onClick={async () => {
                  if (
                    await confirm("Delete transaction?", `Remove "${tx.desc}"?`)
                  )
                    updatePerson(
                      "transactions",
                      transactions.filter((x) => x.id !== tx.id),
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

export function TaxPlanner({ data, personName, personColor, updatePerson }) {
  const t = data?.taxInfo || {};
  const annualIncome =
    (data?.incomes || []).reduce((s, x) => s + x.amount, 0) * 12;
  const update = (key, val) => updatePerson("taxInfo", { ...t, [key]: val });

  const old80C = Math.min(150000, ((t.elss || 0) + (t.ppf || 0)) * 12);
  const oldHRA = Math.min(
    (t.hra || 0) * 12 * 0.5,
    (t.basicSalary || 0) * 12 * 0.4,
  );
  const oldNPS = Math.min(50000, (t.nps || 0) * 12);
  const oldMed = Math.min(25000, (t.medicalInsurance || 0) * 12);
  const oldHL = Math.min(200000, (t.homeLoanInterest || 0) * 12);
  const totalOldDed = old80C + oldHRA + 50000 + oldNPS + oldMed + oldHL;
  const oldTax = calcTax(annualIncome, OLD_SLABS, totalOldDed);
  const newTax = calcTax(annualIncome, NEW_SLABS, 75000);
  const better = oldTax <= newTax ? "old" : "new";
  const saving = Math.abs(oldTax - newTax);
  const remaining80C = Math.max(
    0,
    150000 - ((t.elss || 0) + (t.ppf || 0)) * 12,
  );

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
            {fi("medicalInsurance", "Medical insurance")}
            {fi("homeLoanInterest", "Home loan interest")}
          </div>
        </div>
      </div>
      {remaining80C > 0 && (
        <div className="tip">
          💡 ₹{remaining80C.toLocaleString("en-IN")} of 80C limit unused. Invest
          more in ELSS or PPF to save ₹
          {Math.round(remaining80C * 0.3).toLocaleString("en-IN")} in taxes.
        </div>
      )}
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

export function Settings({ sharedData, updateShared, resetData }) {
  const profile = sharedData?.profile || {};
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
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
