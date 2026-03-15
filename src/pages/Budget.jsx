import { useState } from "react";

// Module-level counter for entry IDs — avoids impure Date.now() in render scope
let _entryIdSeq = 0;
const genEntryId = () => ++_entryIdSeq;
import {
  fmt,
  nextId,
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES,
  INCOME_TYPES,
} from "../utils/finance";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  X,
} from "lucide-react";
import { useConfirm } from "../App";

// ─── Budget rule engine ──────────────────────────────────────────────────────
const BUDGET_RULES = {
  "50/30/20": {
    label: "50 / 30 / 20",
    blurb:
      "Split take-home into three buckets: ≤50% on Needs (essentials), ≤30% on Wants (lifestyle), and keep 20%+ as savings or investments. The most popular framework for most income levels.",
    buckets: [
      {
        key: "needs",
        emoji: "🏠",
        label: "Needs",
        targetPct: 50,
        color: "var(--blue)",
        desc: "Essentials you can't skip — housing, food, transport, bills, healthcare",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
        ],
      },
      {
        key: "wants",
        emoji: "🎉",
        label: "Wants",
        targetPct: 30,
        color: "var(--purple)",
        desc: "Lifestyle choices you can adjust — dining out, shopping, entertainment",
        cats: ["Entertainment", "Shopping", "Personal Care", "Others"],
      },
      {
        key: "savings",
        emoji: "💰",
        label: "Savings & Invest",
        targetPct: 20,
        color: "var(--green)",
        desc: "Money kept — SIPs, emergency fund, loan prepayment",
        virtual: true,
      },
    ],
  },
  "70/20/10": {
    label: "70 / 20 / 10",
    blurb:
      "More relaxed: 70% covers all living costs (needs + wants together), 20% goes into savings and EMI payoff, 10% toward big goals or giving. Easier to stick to than 50/30/20.",
    buckets: [
      {
        key: "living",
        emoji: "🏡",
        label: "Living",
        targetPct: 70,
        color: "var(--blue)",
        desc: "All day-to-day spending — needs and lifestyle combined",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
          "Entertainment",
          "Shopping",
          "Personal Care",
          "Others",
        ],
      },
      {
        key: "savings",
        emoji: "🏦",
        label: "Savings",
        targetPct: 20,
        color: "var(--green)",
        desc: "Investments, emergency corpus, debt snowball",
        virtual: true,
      },
      {
        key: "goals",
        emoji: "🎯",
        label: "Goals & Giving",
        targetPct: 10,
        color: "var(--gold)",
        desc: "Long-term goals, big purchases, charity donations",
        virtual: "goals",
      },
    ],
  },
  payFirst: {
    label: "Pay Yourself First",
    blurb:
      "Lock away savings automatically before spending begins. The remaining 80% is fully yours — no category tracking needed. Best for people who find budgeting stressful.",
    buckets: [
      {
        key: "savings",
        emoji: "💰",
        label: "Save First",
        targetPct: 20,
        color: "var(--green)",
        desc: "Auto-debited at salary credit — SIPs, RDs, emergency fund",
        virtual: true,
      },
      {
        key: "spending",
        emoji: "🛍️",
        label: "Spend Freely",
        targetPct: 80,
        color: "var(--purple)",
        desc: "All remaining money — no guilt, no micro-managing",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
          "Entertainment",
          "Shopping",
          "Personal Care",
          "Others",
        ],
      },
    ],
  },
};

function BudgetRuleSection({
  rule,
  setRule,
  income,
  expByCategory,
  savingsAmt,
}) {
  const def = BUDGET_RULES[rule];
  return (
    <div className="card section-gap">
      {/* Rule picker */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Budget Rule
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {def.blurb}
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}
        >
          {Object.entries(BUDGET_RULES).map(([key, d]) => (
            <button
              key={key}
              onClick={() => setRule(key)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                borderRadius: 6,
                border:
                  key === rule
                    ? "1px solid var(--gold-border)"
                    : "1px solid var(--border)",
                background: key === rule ? "var(--gold-dim)" : "transparent",
                color: key === rule ? "var(--gold)" : "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Buckets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {def.buckets.map((bucket) => {
          const actual =
            bucket.virtual === true
              ? savingsAmt
              : bucket.virtual === "goals"
                ? null
                : (bucket.cats || []).reduce(
                    (s, c) => s + (expByCategory[c] || 0),
                    0,
                  );
          const target = income > 0 ? income * (bucket.targetPct / 100) : 0;
          const actualPct =
            income > 0 && actual !== null
              ? Math.round((actual / income) * 100)
              : 0;
          const isSavings = !!bucket.virtual;
          const isGood = isSavings ? actual >= target : actual <= target;
          const nearLimit =
            !isSavings && actual !== null
              ? actual > target * 0.9 && actual <= target
              : false;
          const diff =
            actual !== null
              ? isSavings
                ? actual - target
                : target - actual
              : null;
          const statusColor =
            bucket.virtual === "goals"
              ? "var(--gold)"
              : isGood
                ? "var(--green)"
                : nearLimit
                  ? "var(--gold)"
                  : "var(--red)";

          return (
            <div
              key={bucket.key}
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                borderLeft: `3px solid ${bucket.color}`,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1.2 }}>
                  {bucket.emoji}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {bucket.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-muted)",
                      }}
                    >
                      target {bucket.targetPct}% of income
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {bucket.desc}
                  </div>
                </div>
              </div>

              {bucket.virtual === "goals" ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  Track contributions in Goals &amp; Investments.{" "}
                  <span style={{ color: "var(--gold)", fontStyle: "normal" }}>
                    Budget: {fmt(target)}/mo
                  </span>
                </div>
              ) : (
                <>
                  {/* Numbers row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1.5rem",
                      marginBottom: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 2,
                        }}
                      >
                        {isSavings ? "Saved" : "Spent"}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: statusColor,
                          lineHeight: 1.1,
                        }}
                      >
                        {fmt(actual)}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            marginLeft: 5,
                            color: statusColor,
                          }}
                        >
                          {actualPct}% of income
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 2,
                        }}
                      >
                        Target budget
                      </div>
                      <div style={{ fontSize: 15 }}>
                        {fmt(target)}
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginLeft: 5,
                          }}
                        >
                          ({bucket.targetPct}%)
                        </span>
                      </div>
                    </div>
                    {diff !== null && income > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginBottom: 2,
                          }}
                        >
                          {isSavings
                            ? diff >= 0
                              ? "✓ Ahead by"
                              : "⚠ Short by"
                            : diff >= 0
                              ? "✓ Headroom"
                              : "⚠ Over by"}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: statusColor,
                          }}
                        >
                          {diff >= 0 ? "+" : "−"}
                          {fmt(Math.abs(diff))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar — bar = 0..income, fill = actual, tick = target */}
                  {income > 0 && (
                    <div style={{ marginBottom: bucket.cats ? 10 : 0 }}>
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.07)",
                          overflow: "visible",
                        }}
                      >
                        <div
                          style={{
                            width: Math.min(100, actualPct) + "%",
                            height: "100%",
                            background: statusColor,
                            borderRadius: 4,
                            transition: "width 0.4s",
                          }}
                        />
                        {/* White tick at target% */}
                        <div
                          style={{
                            position: "absolute",
                            top: -3,
                            left: bucket.targetPct + "%",
                            transform: "translateX(-50%)",
                            width: 2,
                            height: 14,
                            background: "rgba(255,255,255,0.45)",
                            borderRadius: 1,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 3,
                        }}
                      >
                        <span>0%</span>
                        <span
                          style={{
                            position: "relative",
                            left: `calc(${bucket.targetPct}% - 50%)`,
                          }}
                        >
                          ↑ {bucket.targetPct}% limit
                        </span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {/* Category pills */}
                  {bucket.cats && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginTop: 6,
                      }}
                    >
                      {bucket.cats.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background:
                              (expByCategory[c] || 0) > 0
                                ? "rgba(255,255,255,0.09)"
                                : "rgba(255,255,255,0.02)",
                            color:
                              (expByCategory[c] || 0) > 0
                                ? "var(--text-secondary)"
                                : "var(--text-muted)",
                          }}
                        >
                          {c}
                          {(expByCategory[c] || 0) > 0 && (
                            <span style={{ marginLeft: 4, opacity: 0.65 }}>
                              {fmt(expByCategory[c])}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Budget({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const incomes = data?.incomes || [];
  const expenses = data?.expenses || [];
  const [tab, setTab] = useState("overview");
  const [rule, setRule] = useState("50/30/20");
  const { confirm, dialog } = useConfirm();
  // per-income-id expanded state + pending salary-change form
  const [expandedHistory, setExpandedHistory] = useState({});
  const [salaryForm, setSalaryForm] = useState({}); // id → { newAmount, note, date }
  // expense entries (dated purchase log)
  const [expandedExp, setExpandedExp] = useState({});
  const [entryForm, setEntryForm] = useState({}); // expId → { date, amount, note }
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const toggleExpandExp = (id) =>
    setExpandedExp((s) => ({ ...s, [id]: !s[id] }));
  const getEntryForm = (id) =>
    entryForm[id] || { date: todayStr(), amount: "", note: "" };
  const setEF = (id, patch) =>
    setEntryForm((s) => ({ ...s, [id]: { ...getEntryForm(id), ...patch } }));
  const addEntry = (exp) => {
    const f = getEntryForm(exp.id);
    if (!f.date || !f.amount) return;
    const entry = {
      id: genEntryId(),
      date: f.date,
      amount: Number(f.amount),
      note: f.note.trim(),
    };
    const newEntries = [...(exp.entries || []), entry];
    const newAmount = newEntries.reduce((s, e) => s + e.amount, 0);
    updatePerson(
      "expenses",
      expenses.map((x) =>
        x.id === exp.id ? { ...x, entries: newEntries, amount: newAmount } : x,
      ),
    );
    setEntryForm((s) => ({
      ...s,
      [exp.id]: { date: todayStr(), amount: "", note: "" },
    }));
  };
  const deleteEntry = (exp, entryId) => {
    const newEntries = (exp.entries || []).filter((e) => e.id !== entryId);
    const newAmount = newEntries.reduce((s, e) => s + e.amount, 0);
    updatePerson(
      "expenses",
      expenses.map((x) =>
        x.id === exp.id ? { ...x, entries: newEntries, amount: newAmount } : x,
      ),
    );
  };

  // ── Variable income entries (bonus, freelance, dividend, etc.) ─────────
  const [expandedInc, setExpandedInc] = useState({});
  const [incEntryForm, setIncEntryForm] = useState({}); // incId → { date, amount, note, type }
  const toggleExpandInc = (id) =>
    setExpandedInc((s) => ({ ...s, [id]: !s[id] }));
  const getIncEF = (id) =>
    incEntryForm[id] || {
      date: todayStr(),
      amount: "",
      note: "",
      type: "bonus",
    };
  const setIEF = (id, patch) =>
    setIncEntryForm((s) => ({ ...s, [id]: { ...getIncEF(id), ...patch } }));
  const addIncEntry = (inc) => {
    const f = getIncEF(inc.id);
    if (!f.date || !f.amount) return;
    const entry = {
      id: genEntryId(),
      date: f.date,
      amount: Number(f.amount),
      note: f.note.trim(),
      type: f.type,
    };
    updatePerson(
      "incomes",
      incomes.map((x) =>
        x.id === inc.id
          ? { ...x, incomeEntries: [...(x.incomeEntries || []), entry] }
          : x,
      ),
    );
    setIncEntryForm((s) => ({
      ...s,
      [inc.id]: { date: todayStr(), amount: "", note: "", type: "bonus" },
    }));
  };
  const deleteIncEntry = (inc, entryId) => {
    updatePerson(
      "incomes",
      incomes.map((x) =>
        x.id === inc.id
          ? {
              ...x,
              incomeEntries: (x.incomeEntries || []).filter(
                (e) => e.id !== entryId,
              ),
            }
          : x,
      ),
    );
  };

  const INC_ENTRY_TYPES = [
    "bonus",
    "freelance",
    "dividend",
    "refund",
    "gift",
    "other",
  ];

  const toggleHistory = (id) =>
    setExpandedHistory((s) => ({ ...s, [id]: !s[id] }));

  const openSalaryChange = (inc) =>
    setSalaryForm((s) => ({
      ...s,
      [inc.id]: {
        newAmount: String(inc.amount),
        note: "",
        date: new Date().toISOString().slice(0, 10),
      },
    }));

  const cancelSalaryChange = (id) =>
    setSalaryForm((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

  const commitSalaryChange = (inc) => {
    const f = salaryForm[inc.id];
    if (!f || !f.newAmount) return;
    const newAmt = Number(f.newAmount);
    if (newAmt === inc.amount) {
      cancelSalaryChange(inc.id);
      return;
    }
    const prevHistory = inc.salaryHistory || [];
    const updatedInc = {
      ...inc,
      amount: newAmt,
      salaryHistory: [
        ...prevHistory,
        {
          date: f.date || new Date().toISOString().slice(0, 10),
          from: inc.amount,
          to: newAmt,
          note: f.note.trim(),
        },
      ],
    };
    updatePerson(
      "incomes",
      incomes.map((x) => (x.id === inc.id ? updatedInc : x)),
    );
    cancelSalaryChange(inc.id);
  };

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  const expByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  // Grouped: { Food: { total, subs: { Groceries: X, "Dining Out": Y, "": Z } } }
  const expGrouped = expenses.reduce((acc, e) => {
    const cat = e.category;
    if (!acc[cat]) acc[cat] = { total: 0, subs: {} };
    acc[cat].total += e.amount;
    const sub = e.subCategory || "";
    acc[cat].subs[sub] = (acc[cat].subs[sub] || 0) + e.amount;
    return acc;
  }, {});

  const addIncome = () =>
    updatePerson("incomes", [
      ...incomes,
      { id: nextId(incomes), name: "New income", amount: 0, type: "salary" },
    ]);
  const addExpense = () =>
    updatePerson("expenses", [
      ...expenses,
      {
        id: nextId(expenses),
        name: "New expense",
        amount: 0,
        category: "Others",
        entries: [],
      },
    ]);

  const tabs = ["overview", "income", "expenses"];

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Budget
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: "1.25rem" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              background: tab === t ? "var(--gold-dim)" : "transparent",
              color: tab === t ? "var(--gold)" : "var(--text-secondary)",
              border:
                tab === t
                  ? "1px solid var(--gold-border)"
                  : "1px solid var(--border)",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="grid-3 section-gap">
            <div className="metric-card">
              <div className="metric-label">Income</div>
              <div className="metric-value green-text">{fmt(totalIncome)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Expenses</div>
              <div className="metric-value red-text">{fmt(totalExpenses)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pre-invest savings</div>
              <div
                className="metric-value"
                style={{
                  color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
                }}
              >
                {savingsRate}%
              </div>
            </div>
          </div>
          <BudgetRuleSection
            rule={rule}
            setRule={setRule}
            income={totalIncome}
            expByCategory={expByCategory}
            savingsAmt={totalIncome - totalExpenses}
          />
          <div className="card">
            <div className="card-title">Expenses by category</div>
            {Object.entries(expGrouped)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([cat, { total, subs }]) => {
                const subEntries = Object.entries(subs)
                  .filter(([k]) => k !== "")
                  .sort((a, b) => b[1] - a[1]);
                const uncategorised = subs[""] || 0;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: subEntries.length > 0 ? 4 : 0,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: subEntries.length > 0 ? 600 : 400,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {cat}
                      </span>
                      <div style={{ flex: 2 }}>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width:
                                Math.round((total / totalExpenses) * 100) + "%",
                              background: personColor,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          minWidth: 80,
                          textAlign: "right",
                        }}
                      >
                        {fmt(total)}
                      </span>
                    </div>
                    {subEntries.map(([sub, amt]) => (
                      <div
                        key={sub}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          paddingLeft: 14,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          ↳ {sub}
                        </span>
                        <div style={{ flex: 2 }}>
                          <div className="progress-track" style={{ height: 3 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: Math.round((amt / total) * 100) + "%",
                                background: personColor,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            minWidth: 80,
                            textAlign: "right",
                          }}
                        >
                          {fmt(amt)}
                        </span>
                      </div>
                    ))}
                    {uncategorised > 0 && subEntries.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          paddingLeft: 14,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          ↳ General
                        </span>
                        <div style={{ flex: 2 }} />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            minWidth: 80,
                            textAlign: "right",
                          }}
                        >
                          {fmt(uncategorised)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {tab === "income" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Income sources
            </div>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={addIncome}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {incomes.map((inc) => {
            const incEntries = inc.incomeEntries || [];
            const isIncOpen = !!expandedInc[inc.id];
            const ief = getIncEF(inc.id);
            const thisMonth = new Date().toISOString().slice(0, 7);
            const varThisMonth = incEntries
              .filter((e) => e.date?.slice(0, 7) === thisMonth)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <div key={inc.id} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: isIncOpen
                      ? "none"
                      : "1px solid var(--border)",
                  }}
                >
                  <input
                    value={inc.name}
                    onChange={(e) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    style={{ flex: 3 }}
                  />
                  <select
                    value={inc.type}
                    onChange={(e) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id ? { ...x, type: e.target.value } : x,
                        ),
                      )
                    }
                    style={{ flex: 1.5 }}
                  >
                    {INCOME_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={inc.amount}
                    onChange={(e) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id
                            ? { ...x, amount: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                    style={{ flex: 1 }}
                    min="0"
                  />
                  {/* Variable income log toggle */}
                  <button
                    onClick={() => toggleExpandInc(inc.id)}
                    title="Log variable income (bonus, freelance, dividend…)"
                    style={{
                      background:
                        incEntries.length > 0
                          ? "var(--green-dim)"
                          : "rgba(255,255,255,0.06)",
                      border:
                        incEntries.length > 0
                          ? "1px solid rgba(76,175,130,0.3)"
                          : "1px solid var(--border)",
                      color:
                        incEntries.length > 0
                          ? "var(--green)"
                          : "var(--text-muted)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <CalendarDays size={11} />
                    {incEntries.length > 0 ? incEntries.length : "+"}
                  </button>
                  <button
                    className="btn-danger"
                    aria-label={`Delete ${inc.name}`}
                    onClick={async () => {
                      if (
                        await confirm(
                          "Delete income?",
                          `Remove "${inc.name}" from your income sources?`,
                        )
                      )
                        updatePerson(
                          "incomes",
                          incomes.filter((x) => x.id !== inc.id),
                        );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Variable income entries panel */}
                {isIncOpen && (
                  <div
                    style={{
                      margin: "0 0 10px 12px",
                      padding: "10px 12px",
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `3px solid var(--green)`,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      Variable income log — bonus, freelance, dividend, refund,
                      etc.
                      {varThisMonth > 0 && (
                        <span
                          style={{
                            marginLeft: 8,
                            color: "var(--green)",
                            fontWeight: 600,
                            textTransform: "none",
                          }}
                        >
                          +{fmt(varThisMonth)} this month
                        </span>
                      )}
                    </div>

                    {incEntries.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {[...incEntries]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((e) => (
                            <div
                              key={e.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                                borderBottom: "1px solid var(--border)",
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  flexShrink: 0,
                                  width: 72,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {e.date.slice(5).replace("-", " ")}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(76,175,130,0.12)",
                                  color: "var(--green)",
                                  flexShrink: 0,
                                  textTransform: "capitalize",
                                }}
                              >
                                {e.type}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {e.note || "—"}
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "var(--green)",
                                  flexShrink: 0,
                                }}
                              >
                                +{fmt(e.amount)}
                              </span>
                              <button
                                onClick={() => deleteIncEntry(inc, e.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-muted)",
                                  padding: 2,
                                  flexShrink: 0,
                                }}
                                title="Remove entry"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="date"
                        value={ief.date}
                        onChange={(e) =>
                          setIEF(inc.id, { date: e.target.value })
                        }
                        style={{ flex: "0 0 130px" }}
                      />
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={ief.amount}
                        onChange={(e) =>
                          setIEF(inc.id, { amount: e.target.value })
                        }
                        style={{ flex: "0 0 110px" }}
                        min="0"
                      />
                      <select
                        value={ief.type}
                        onChange={(e) =>
                          setIEF(inc.id, { type: e.target.value })
                        }
                        style={{ flex: "0 0 100px", fontSize: 12 }}
                      >
                        {INC_ENTRY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Note (e.g. Q1 bonus)"
                        value={ief.note}
                        onChange={(e) =>
                          setIEF(inc.id, { note: e.target.value })
                        }
                        style={{ flex: 1, minWidth: 100 }}
                      />
                      <button
                        className="btn-primary"
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => addIncEntry(inc)}
                        disabled={!ief.amount || !ief.date}
                      >
                        <Plus size={11} /> Log
                      </button>
                    </div>
                  </div>
                )}

                {/* Salary change form (existing) */}
                {salaryForm[inc.id] ? (
                  <div
                    style={{
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 14px",
                      marginTop: 4,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 10,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Log salary change
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1.5fr",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          New amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={salaryForm[inc.id].newAmount}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: {
                                ...s[inc.id],
                                newAmount: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          Effective date
                        </label>
                        <input
                          type="date"
                          value={salaryForm[inc.id].date}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: { ...s[inc.id], date: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          Reason (optional)
                        </label>
                        <input
                          placeholder="e.g. Promotion, Job change"
                          value={salaryForm[inc.id].note}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: { ...s[inc.id], note: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    {salaryForm[inc.id].newAmount &&
                      Number(salaryForm[inc.id].newAmount) !== inc.amount && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginBottom: 8,
                          }}
                        >
                          {fmt(inc.amount)} →{" "}
                          <strong
                            style={{
                              color:
                                Number(salaryForm[inc.id].newAmount) >
                                inc.amount
                                  ? "var(--green)"
                                  : "var(--red)",
                            }}
                          >
                            {fmt(Number(salaryForm[inc.id].newAmount))}
                          </strong>
                          {inc.amount > 0 && (
                            <span
                              style={{
                                marginLeft: 6,
                                color:
                                  Number(salaryForm[inc.id].newAmount) >
                                  inc.amount
                                    ? "var(--green)"
                                    : "var(--red)",
                              }}
                            >
                              (
                              {((Number(salaryForm[inc.id].newAmount) -
                                inc.amount) /
                                inc.amount) *
                                100 >
                              0
                                ? "+"
                                : ""}
                              {(
                                ((Number(salaryForm[inc.id].newAmount) -
                                  inc.amount) /
                                  inc.amount) *
                                100
                              ).toFixed(1)}
                              %)
                            </span>
                          )}
                        </div>
                      )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() => commitSalaryChange(inc)}
                      >
                        Save change
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => cancelSalaryChange(inc.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "3px 10px" }}
                      onClick={() => openSalaryChange(inc)}
                    >
                      ↑ Log salary change
                    </button>
                    {(inc.salaryHistory?.length ?? 0) > 0 && (
                      <button
                        className="btn-ghost"
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => toggleHistory(inc.id)}
                      >
                        History ({inc.salaryHistory.length})
                        {expandedHistory[inc.id] ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* History timeline */}
                {expandedHistory[inc.id] &&
                  (inc.salaryHistory?.length ?? 0) > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${personColor}`,
                      }}
                    >
                      {[...inc.salaryHistory].reverse().map((h, i) => {
                        const pct =
                          h.from > 0
                            ? (((h.to - h.from) / h.from) * 100).toFixed(1)
                            : null;
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "6px 0",
                              borderBottom: "1px solid var(--border)",
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                              }}
                            >
                              <span style={{ color: "var(--text-muted)" }}>
                                {h.date}
                              </span>
                              <span>
                                {fmt(h.from)} →{" "}
                                <strong
                                  style={{
                                    color:
                                      h.to >= h.from
                                        ? "var(--green)"
                                        : "var(--red)",
                                  }}
                                >
                                  {fmt(h.to)}
                                </strong>
                                {pct !== null && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      color:
                                        h.to >= h.from
                                          ? "var(--green)"
                                          : "var(--red)",
                                    }}
                                  >
                                    ({h.to >= h.from ? "+" : ""}
                                    {pct}%)
                                  </span>
                                )}
                              </span>
                            </div>
                            {h.note && (
                              <div
                                style={{
                                  color: "var(--text-muted)",
                                  marginTop: 2,
                                  fontStyle: "italic",
                                }}
                              >
                                {h.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}
          <div style={{ textAlign: "right", paddingTop: 12, fontWeight: 600 }}>
            Total: <span className="green-text">{fmt(totalIncome)}</span>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Expenses
            </div>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={addExpense}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {expenses.map((exp) => {
            const entries = exp.entries || [];
            const isOpen = !!expandedExp[exp.id];
            const ef = getEntryForm(exp.id);
            const thisMonth = new Date().toISOString().slice(0, 7);
            const spentThisMonth = entries
              .filter((e) => e.date?.slice(0, 7) === thisMonth)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <div
                key={exp.id}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                {/* Main row */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 0",
                  }}
                >
                  <input
                    value={exp.name}
                    onChange={(e) =>
                      updatePerson(
                        "expenses",
                        expenses.map((x) =>
                          x.id === exp.id ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    style={{ flex: 3, minWidth: 80 }}
                  />
                  <select
                    value={exp.category}
                    onChange={(e) =>
                      updatePerson(
                        "expenses",
                        expenses.map((x) =>
                          x.id === exp.id
                            ? {
                                ...x,
                                category: e.target.value,
                                subCategory: "",
                              }
                            : x,
                        ),
                      )
                    }
                    style={{ flex: 1.5 }}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  {EXPENSE_SUBCATEGORIES[exp.category] && (
                    <select
                      value={exp.subCategory || ""}
                      onChange={(e) =>
                        updatePerson(
                          "expenses",
                          expenses.map((x) =>
                            x.id === exp.id
                              ? { ...x, subCategory: e.target.value }
                              : x,
                          ),
                        )
                      }
                      style={{ flex: 1.5 }}
                    >
                      <option value="">— sub-category —</option>
                      {EXPENSE_SUBCATEGORIES[exp.category].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {/* Recurrence selector */}
                  <select
                    value={exp.recurrence || "monthly"}
                    onChange={(e) =>
                      updatePerson(
                        "expenses",
                        expenses.map((x) =>
                          x.id === exp.id
                            ? { ...x, recurrence: e.target.value }
                            : x,
                        ),
                      )
                    }
                    title="How often this expense recurs"
                    style={{
                      flex: "0 0 100px",
                      fontSize: 12,
                      color:
                        (exp.recurrence || "monthly") === "monthly"
                          ? "var(--text-secondary)"
                          : exp.recurrence === "variable"
                            ? "var(--accent-blue, #60a5fa)"
                            : "var(--gold)",
                      borderColor:
                        exp.recurrence === "variable"
                          ? "var(--accent-blue, #60a5fa)"
                          : (exp.recurrence || "monthly") !== "monthly"
                            ? "var(--gold-border)"
                            : undefined,
                    }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="variable">Variable</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="once">One-off</option>
                  </select>
                  {/* Due-month picker for yearly */}
                  {exp.recurrence === "yearly" && (
                    <select
                      value={exp.recurrenceMonth ?? 0}
                      onChange={(e) =>
                        updatePerson(
                          "expenses",
                          expenses.map((x) =>
                            x.id === exp.id
                              ? {
                                  ...x,
                                  recurrenceMonth: Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                      title="Month in which this expense falls"
                      style={{ flex: "0 0 80px", fontSize: 12 }}
                    >
                      {[
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec",
                      ].map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* Quarter start month for quarterly */}
                  {exp.recurrence === "quarterly" && (
                    <select
                      value={(exp.recurrenceMonths ?? [0, 3, 6, 9])[0]}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        updatePerson(
                          "expenses",
                          expenses.map((x) =>
                            x.id === exp.id
                              ? {
                                  ...x,
                                  recurrenceMonths: [
                                    start,
                                    (start + 3) % 12,
                                    (start + 6) % 12,
                                    (start + 9) % 12,
                                  ],
                                }
                              : x,
                          ),
                        );
                      }}
                      title="First month of the quarter cycle"
                      style={{ flex: "0 0 80px", fontSize: 12 }}
                    >
                      {["Jan", "Feb", "Mar"].map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  {entries.length > 0 ? (
                    <div
                      style={{
                        flex: 1,
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {fmt(exp.amount)}
                      {spentThisMonth > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontWeight: 400,
                          }}
                        >
                          {fmt(spentThisMonth)} this mo.
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={exp.amount}
                      onChange={(e) =>
                        updatePerson(
                          "expenses",
                          expenses.map((x) =>
                            x.id === exp.id
                              ? { ...x, amount: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                      style={{ flex: 1 }}
                      min="0"
                    />
                  )}
                  {/* Log entries toggle */}
                  <button
                    onClick={() => {
                      toggleExpandExp(exp.id);
                      if (!isOpen) setEF(exp.id, {});
                    }}
                    title="Log purchases with dates"
                    style={{
                      background:
                        entries.length > 0
                          ? "var(--gold-dim)"
                          : "rgba(255,255,255,0.06)",
                      border:
                        entries.length > 0
                          ? "1px solid var(--gold-border)"
                          : "1px solid var(--border)",
                      color:
                        entries.length > 0
                          ? "var(--gold)"
                          : "var(--text-muted)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <CalendarDays size={11} />
                    {entries.length > 0 ? entries.length : "Log"}
                  </button>
                  <button
                    className="btn-danger"
                    aria-label={`Delete ${exp.name}`}
                    onClick={async () => {
                      if (
                        await confirm(
                          "Delete expense?",
                          `Remove "${exp.name}" from your expenses?`,
                        )
                      )
                        updatePerson(
                          "expenses",
                          expenses.filter((x) => x.id !== exp.id),
                        );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Entries panel */}
                {isOpen && (
                  <div
                    style={{
                      margin: "0 0 10px 12px",
                      padding: "10px 12px",
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `3px solid ${personColor}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      Purchase log — each entry shows in Cash Flow by its actual
                      date
                    </div>

                    {/* Entry list */}
                    {entries.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {[...entries]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((e) => (
                            <div
                              key={e.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                                borderBottom: "1px solid var(--border)",
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontVariantNumeric: "tabular-nums",
                                  flexShrink: 0,
                                  width: 72,
                                }}
                              >
                                {e.date.slice(5).replace("-", " ")}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {e.note || "—"}
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "var(--red)",
                                  flexShrink: 0,
                                }}
                              >
                                {fmt(e.amount)}
                              </span>
                              <button
                                onClick={() => deleteEntry(exp, e.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-muted)",
                                  padding: 2,
                                  flexShrink: 0,
                                }}
                                title="Remove entry"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Add entry form */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="date"
                        value={ef.date}
                        onChange={(e) =>
                          setEF(exp.id, { date: e.target.value })
                        }
                        style={{ flex: "0 0 130px" }}
                      />
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={ef.amount}
                        onChange={(e) =>
                          setEF(exp.id, { amount: e.target.value })
                        }
                        style={{ flex: "0 0 110px" }}
                        min="0"
                      />
                      <input
                        type="text"
                        placeholder="Vendor / note  (e.g. Amazon Now)"
                        value={ef.note}
                        onChange={(e) =>
                          setEF(exp.id, { note: e.target.value })
                        }
                        style={{ flex: 1, minWidth: 120 }}
                      />
                      <button
                        className="btn-primary"
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => addEntry(exp)}
                        disabled={!ef.amount || !ef.date}
                      >
                        <Plus size={11} /> Log
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ textAlign: "right", paddingTop: 12, fontWeight: 600 }}>
            Total: <span className="red-text">{fmt(totalExpenses)}</span>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export function HouseholdBudget({ abhav, aanya }) {
  const abhavIncome = (abhav?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const aanyaIncome = (aanya?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const totalIncome = abhavIncome + aanyaIncome;

  const abhavExpenses = (abhav?.expenses || []).reduce(
    (s, x) => s + x.amount,
    0,
  );
  const aanyaExpenses = (aanya?.expenses || []).reduce(
    (s, x) => s + x.amount,
    0,
  );
  const totalExpenses = abhavExpenses + aanyaExpenses;

  const surplus = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;

  // { cat: { total, abhav, aanya, subs: { sub: { total, abhav, aanya } } } }
  const mergeGrouped = (data, key) =>
    (data?.expenses || []).reduce((acc, e) => {
      const cat = e.category;
      if (!acc[cat]) acc[cat] = { total: 0, abhav: 0, aanya: 0, subs: {} };
      acc[cat].total += e.amount;
      acc[cat][key] = (acc[cat][key] || 0) + e.amount;
      const sub = e.subCategory || "";
      if (!acc[cat].subs[sub])
        acc[cat].subs[sub] = { total: 0, abhav: 0, aanya: 0 };
      acc[cat].subs[sub].total += e.amount;
      acc[cat].subs[sub][key] = (acc[cat].subs[sub][key] || 0) + e.amount;
      return acc;
    }, {});

  const aGrouped = mergeGrouped(abhav, "abhav");
  const anGrouped = mergeGrouped(aanya, "aanya");

  // Merge both into a single map for display
  const grouped = {};
  for (const [cat, vals] of Object.entries(aGrouped)) {
    if (!grouped[cat])
      grouped[cat] = { total: 0, abhav: 0, aanya: 0, subs: {} };
    grouped[cat].total += vals.total;
    grouped[cat].abhav += vals.abhav || 0;
    Object.entries(vals.subs).forEach(([sub, sv]) => {
      if (!grouped[cat].subs[sub])
        grouped[cat].subs[sub] = { total: 0, abhav: 0, aanya: 0 };
      grouped[cat].subs[sub].total += sv.total;
      grouped[cat].subs[sub].abhav += sv.abhav || 0;
    });
  }
  for (const [cat, vals] of Object.entries(anGrouped)) {
    if (!grouped[cat])
      grouped[cat] = { total: 0, abhav: 0, aanya: 0, subs: {} };
    grouped[cat].total += vals.total;
    grouped[cat].aanya += vals.aanya || 0;
    Object.entries(vals.subs).forEach(([sub, sv]) => {
      if (!grouped[cat].subs[sub])
        grouped[cat].subs[sub] = { total: 0, abhav: 0, aanya: 0 };
      grouped[cat].subs[sub].total += sv.total;
      grouped[cat].subs[sub].aanya += sv.aanya || 0;
    });
  }

  // Keep flat versions for budget rule section
  const aCats = Object.fromEntries(
    Object.entries(aGrouped).map(([c, v]) => [c, v.total]),
  );
  const anCats = Object.fromEntries(
    Object.entries(anGrouped).map(([c, v]) => [c, v.total]),
  );
  const allCats = Object.keys(grouped).sort(
    (a, b) => grouped[b].total - grouped[a].total,
  );
  // Combined flat map for BudgetRuleSection
  const hhExpByCategory = Object.fromEntries(
    [...new Set([...Object.keys(aCats), ...Object.keys(anCats)])].map((c) => [
      c,
      (aCats[c] || 0) + (anCats[c] || 0),
    ]),
  );

  const [rule, setRule] = useState("50/30/20");

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Budget
      </div>

      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Combined income</div>
          <div className="metric-value green-text">{fmt(totalIncome)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmt(abhavIncome)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmt(aanyaIncome)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Combined expenses</div>
          <div className="metric-value red-text">{fmt(totalExpenses)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmt(abhavExpenses)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmt(aanyaExpenses)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Surplus · Savings rate</div>
          <div
            className="metric-value"
            style={{
              color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
            }}
          >
            {fmt(surplus)}
          </div>
          <div className="metric-sub">{savingsRate}% of combined income</div>
        </div>
      </div>

      <BudgetRuleSection
        rule={rule}
        setRule={setRule}
        income={totalIncome}
        expByCategory={hhExpByCategory}
        savingsAmt={surplus}
      />

      <div className="card">
        <div className="card-title">Expenses by category</div>
        {allCats.map((cat) => {
          const { total, abhav: av, aanya: anv, subs } = grouped[cat];
          const subEntries = Object.entries(subs)
            .filter(([k]) => k !== "")
            .sort((a, b) => b[1].total - a[1].total);
          return (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: subEntries.length > 0 ? 600 : 400,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{cat}</span>
                <span style={{ fontWeight: 500 }}>{fmt(total)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "var(--border)",
                  gap: 1,
                }}
              >
                {(av || 0) > 0 && (
                  <div
                    style={{
                      width: `${((av || 0) / totalExpenses) * 100}%`,
                      background: "var(--abhav)",
                      borderRadius: "3px 0 0 3px",
                    }}
                  />
                )}
                {(anv || 0) > 0 && (
                  <div
                    style={{
                      width: `${((anv || 0) / totalExpenses) * 100}%`,
                      background: "var(--aanya)",
                      borderRadius: (av || 0) > 0 ? "0 3px 3px 0" : 3,
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 3,
                  marginBottom: subEntries.length > 0 ? 6 : 0,
                }}
              >
                {(av || 0) > 0 && (
                  <span>
                    <span style={{ color: "var(--abhav)" }}>●</span> Abhav{" "}
                    {fmt(av || 0)}
                  </span>
                )}
                {(anv || 0) > 0 && (
                  <span>
                    <span style={{ color: "var(--aanya)" }}>●</span> Aanya{" "}
                    {fmt(anv || 0)}
                  </span>
                )}
              </div>
              {subEntries.map(([sub, sv]) => (
                <div
                  key={sub}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingLeft: 14,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    ↳ {sub}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--abhav)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {(sv.abhav || 0) > 0 ? fmt(sv.abhav) : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--aanya)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {(sv.aanya || 0) > 0 ? fmt(sv.aanya) : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      minWidth: 70,
                      textAlign: "right",
                    }}
                  >
                    {fmt(sv.total)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
