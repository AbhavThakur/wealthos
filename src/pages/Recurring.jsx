import { useState } from "react";
import { fmt, nextId, EXPENSE_CATEGORIES } from "../utils/finance";
import { Plus, Trash2, Bell, BellOff, RefreshCw } from "lucide-react";
import { useConfirm } from "../App";

const ALL_CATS = ["Salary", "Investment", ...EXPENSE_CATEGORIES];

export function RecurringManager({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const rules = data?.recurringRules || [];
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
      ...rules,
      {
        ...n,
        id: nextId(rules),
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
      rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
  const remove = (id) =>
    updatePerson(
      "recurringRules",
      rules.filter((r) => r.id !== id),
    );

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
        These auto-add to your transaction log each month on the set date.
        Perfect for salary, SIPs, rent, and subscriptions.
      </div>

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
            Active rules
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
                  placeholder="e.g. Salary credit"
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
                  placeholder="e.g. 5000"
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

        {rules.length === 0 && !showAdd && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No recurring rules yet. Add your salary, SIPs, and rent.
          </div>
        )}

        {rules.map((r) => (
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
                background:
                  r.type === "income"
                    ? "var(--green-dim)"
                    : r.type === "investment"
                      ? "var(--gold-dim)"
                      : "var(--red-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <RefreshCw
                size={14}
                color={
                  r.type === "income"
                    ? "var(--green)"
                    : r.type === "investment"
                      ? "var(--gold)"
                      : "var(--red)"
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{r.desc}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Every month on day {r.dayOfMonth} · {r.category}
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
            <button
              className="btn-icon"
              onClick={() => toggle(r.id)}
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
              onClick={async () => {
                if (
                  await confirm(
                    "Delete rule?",
                    `Remove "${r.desc}" recurring rule?`,
                  )
                )
                  remove(r.id);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="tip">
        💡 Recurring rules auto-fire on the correct date each month when you
        open the app. No manual entry needed for salary, SIPs, or rent.
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
