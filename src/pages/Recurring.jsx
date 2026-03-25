import { useState } from "react";
import { fmt, nextId, EXPENSE_CATEGORIES } from "../utils/finance";
import { Plus, Trash2, Bell, BellOff, RefreshCw, Link } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { autoRecurringRules } from "../utils/autoRecurringRules";

const ALL_CATS = ["Salary", "Investment", ...EXPENSE_CATEGORIES];

const sourceLabel = {
  income: "from Budget → Income",
  expense: "from Budget → Expenses",
  investment: "from Investments",
  debt: "from Debts → EMI",
};

function RuleRow({ r, isAuto, onToggle, onDelete }) {
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
  const freqLabel =
    r.frequency === "weekly"
      ? "Every week"
      : r.frequency === "yearly"
        ? "Every year"
        : `Day ${r.dayOfMonth} every month`;

  return (
    <div
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
        {isAuto ? (
          <Link size={13} color={typeColor} />
        ) : (
          <RefreshCw size={14} color={typeColor} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.desc}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {freqLabel} · {r.category}
          {isAuto && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                background: "var(--bg-card2)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              {sourceLabel[r.sourceType] || "auto-synced"}
            </span>
          )}
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
          color:
            r.amount > 0
              ? "var(--green)"
              : r.type === "investment"
                ? "var(--gold)"
                : "var(--red)",
          minWidth: 80,
          textAlign: "right",
        }}
      >
        {r.amount > 0 ? "+" : ""}
        {fmt(r.amount)}
      </div>
      {!isAuto && (
        <>
          <button
            className="btn-icon"
            onClick={() => onToggle(r.id)}
            aria-label={r.active ? `Pause ${r.desc}` : `Resume ${r.desc}`}
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
            onClick={() => onDelete(r.id)}
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

export function RecurringManager({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const manualRules = (data?.recurringRules || []).filter((r) => !r.auto);
  const autoRules = autoRecurringRules(data || {});
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    desc: "",
    amount: "",
    type: "expense",
    category: "Food",
    dayOfMonth: 1,
    active: true,
  });
  const { confirm, dialog } = useConfirm();

  const add = () => {
    if (!n.desc || !n.amount) return;
    const amt =
      n.type === "income"
        ? Math.abs(Number(n.amount))
        : -Math.abs(Number(n.amount));
    updatePerson("recurringRules", [
      ...manualRules,
      {
        ...n,
        id: nextId(manualRules),
        amount: amt,
        dayOfMonth: Number(n.dayOfMonth),
      },
    ]);
    setN({
      desc: "",
      amount: "",
      type: "expense",
      category: "Food",
      dayOfMonth: 1,
      active: true,
    });
    setShowAdd(false);
  };

  const toggle = (id) =>
    updatePerson(
      "recurringRules",
      manualRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
  const remove = async (id) => {
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
        <span style={{ color: personColor }}>{personName}'s</span> Recurring
        Transactions
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
          lineHeight: 1.6,
        }}
      >
        Auto-synced from your Budget, Investments (SIPs), and Debts (EMIs). You
        can also add custom recurring items below.
      </div>

      {/* Auto-synced rules */}
      {autoRules.length > 0 && (
        <div className="card section-gap">
          <div className="card-title" style={{ marginBottom: "0.75rem" }}>
            🔗 Auto-synced rules
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: "0.75rem",
            }}
          >
            These are derived from your Budget, Investments, and Debts — update
            them there and they sync here automatically.
          </div>
          {autoRules.map((r, i) => (
            <RuleRow key={`auto-${i}`} r={r} isAuto />
          ))}
        </div>
      )}

      {/* Manual rules */}
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
            Custom recurring rules
          </div>
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={13} /> Add rule
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
                  Description
                </label>
                <input
                  placeholder="e.g. Netflix subscription"
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
                  placeholder="e.g. 649"
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
                  value={n.dayOfMonth}
                  onChange={(e) => setN({ ...n, dayOfMonth: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={add}>
                Add rule
              </button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {manualRules.length === 0 && !showAdd && (
          <div
            style={{
              textAlign: "center",
              padding: "1.5rem",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No custom rules yet. Use this for subscriptions or payments not
            tracked in Budget/Investments/Debts.
          </div>
        )}

        {manualRules.map((r) => (
          <RuleRow
            key={r.id}
            r={r}
            isAuto={false}
            onToggle={toggle}
            onDelete={remove}
          />
        ))}
      </div>

      <div className="tip">
        💡 Auto-synced rules update automatically when you change your Budget,
        Investments, or Debts. Add custom rules for subscriptions like Netflix,
        Spotify, gym memberships, etc.
      </div>
      {dialog}
    </div>
  );
}

export function BudgetAlerts({ data, personName, personColor, updatePerson }) {
  const alerts = data?.budgetAlerts || [];
  const expenses = data?.expenses || [];
  const transactions = data?.transactions || [];
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({ category: "Food", limit: "", active: true });
  const { confirm: confirmAlert, dialog: alertDialog } = useConfirm();

  // Current month spend per category from transactions
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthSpend = transactions
    .filter(
      (t) => t.date?.startsWith(ym) && t.amount < 0 && t.type === "expense",
    )
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {});

  // Also use monthly expense budget as fallback
  const expByCat = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const add = () => {
    if (!n.limit) return;
    updatePerson("budgetAlerts", [
      ...alerts,
      { ...n, id: nextId(alerts), limit: Number(n.limit) },
    ]);
    setN({ category: "Food", limit: "", active: true });
    setShowAdd(false);
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
        <span style={{ color: personColor }}>{personName}'s</span> Budget Alerts
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
        }}
      >
        Set spending limits per category. Get a visual warning when you're close
        to or over budget.
      </div>

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
            Category limits
          </div>
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={13} /> Add alert
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
                  Category
                </label>
                <select
                  value={n.category}
                  onChange={(e) => setN({ ...n, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
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
                  Monthly limit (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={n.limit}
                  onChange={(e) => setN({ ...n, limit: e.target.value })}
                />
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

        {alerts.length === 0 && !showAdd && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No alerts set. Add limits for categories you tend to overspend on.
          </div>
        )}

        {alerts.map((alert) => {
          const spent =
            monthSpend[alert.category] || expByCat[alert.category] || 0;
          const pct = Math.round((spent / alert.limit) * 100);
          const isOver = spent > alert.limit;
          const isClose = pct >= 80 && !isOver;
          const barColor = isOver
            ? "var(--red)"
            : isClose
              ? "var(--gold)"
              : "var(--green)";
          const status = isOver
            ? "Over budget!"
            : isClose
              ? "Getting close"
              : "On track";

          return (
            <div
              key={alert.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
                opacity: alert.active ? 1 : 0.45,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bell
                    size={14}
                    color={
                      isOver
                        ? "var(--red)"
                        : isClose
                          ? "var(--gold)"
                          : "var(--text-muted)"
                    }
                  />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {alert.category}
                  </span>
                  <span
                    className={`tag ${isOver ? "tag-red" : isClose ? "tag-gold" : "tag-green"}`}
                  >
                    {status}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn-icon"
                    onClick={() =>
                      updatePerson(
                        "budgetAlerts",
                        alerts.map((a) =>
                          a.id === alert.id ? { ...a, active: !a.active } : a,
                        ),
                      )
                    }
                  >
                    {alert.active ? (
                      <Bell size={13} color="var(--green)" />
                    ) : (
                      <BellOff size={13} />
                    )}
                  </button>
                  <button
                    className="btn-danger"
                    aria-label={`Delete ${alert.category} alert`}
                    onClick={async () => {
                      if (
                        await confirmAlert(
                          "Delete alert?",
                          `Remove ${alert.category} budget alert?`,
                        )
                      )
                        updatePerson(
                          "budgetAlerts",
                          alerts.filter((a) => a.id !== alert.id),
                        );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>
                  Spent this month
                </span>
                <span>
                  <span style={{ color: barColor, fontWeight: 500 }}>
                    {fmt(spent)}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    / {fmt(alert.limit)} limit
                  </span>
                  <span
                    style={{ marginLeft: 6, color: barColor, fontWeight: 600 }}
                  >
                    {pct}%
                  </span>
                </span>
              </div>
              <div className="progress-track" style={{ height: 6 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: Math.min(100, pct) + "%",
                    background: barColor,
                  }}
                />
              </div>
              {isOver && (
                <div
                  style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}
                >
                  ⚠️ Over by {fmt(spent - alert.limit)} — consider cutting{" "}
                  {alert.category.toLowerCase()} spending.
                </div>
              )}
            </div>
          );
        })}
      </div>
      {alertDialog}
    </div>
  );
}
