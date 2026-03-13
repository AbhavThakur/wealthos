import { useState } from "react";
import { fmt, nextId, EXPENSE_CATEGORIES, calcEMI } from "../utils/finance";
import { Plus, Trash2, Search } from "lucide-react";
import { useConfirm } from "../App";

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

export function Settings({ sharedData, updateShared }) {
  const profile = sharedData?.profile || {};
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);

  const save = () => {
    updateShared("profile", p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    </div>
  );
}
