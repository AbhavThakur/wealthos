import { useState } from "react";
import { fmt, nextId, EXPENSE_CATEGORIES, lumpCorpus } from "../utils/finance";
import {
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { autoRecurringRules } from "../utils/autoRecurringRules";
import { useData } from "../context/DataContext";
import { useSessionState } from "../hooks/useSessionState";
import { InfoModal } from "../components/InfoModal";

// All transaction categories (income + expense)
const ALL_CATS = ["Salary", "Investment", ...EXPENSE_CATEGORIES];

// ─── Cash Flow (merged Transactions + Recurring) ───────────────────────────

// Filter rules to only those that actually occur in the given month
function rulesForMonth(rules, year, month) {
  return rules.filter((r) => {
    // Skip one-time and variable expenses — they don't recur
    const rec = r.recurrence;
    if (rec === "once" || rec === "variable") return false;

    // Check recurrence-based gating (for autoRecurringRules expenses)
    if (rec === "yearly") {
      const dueMonth = r.recurrenceMonth ?? 0;
      return month === dueMonth;
    }
    if (rec === "quarterly") {
      const dueMonths = r.recurrenceMonths ?? [0, 3, 6, 9];
      return dueMonths.includes(month);
    }

    // Investment frequency gating
    const freq = r.frequency || "monthly";
    if (freq === "monthly" || freq === "weekly") return true;
    if (freq === "yearly" && r.startDate) {
      const startMonth = new Date(r.startDate).getMonth();
      return month === startMonth;
    }
    if (freq === "yearly" && r.recurrenceMonth != null) {
      return month === r.recurrenceMonth;
    }
    if (freq === "quarterly" && r.startDate) {
      const startMonth = new Date(r.startDate).getMonth();
      return ((month - startMonth + 12) % 12) % 3 === 0;
    }
    // non-investment rules (expenses, income) default to monthly
    if (!r.frequency) return true;
    return true;
  });
}

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
  // History month selector - defaults to current month
  const now = new Date();
  const [historyMonth, setHistoryMonth] = useSessionState(
    `cf_history_month_${personName}`,
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
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
  const allRulesRaw = [
    ...autoRules,
    ...manualRules.filter((r) => r.active !== false),
  ];

  const today = now.getDate();
  const allActiveRules = rulesForMonth(
    allRulesRaw,
    now.getFullYear(),
    now.getMonth(),
  );
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthName = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // History month navigation helpers
  const historyDate = new Date(historyMonth + "-01");
  const historyMonthName = historyDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const prevMonth = () => {
    const d = new Date(historyDate);
    d.setMonth(d.getMonth() - 1);
    setHistoryMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const nextMonth = () => {
    const d = new Date(historyDate);
    d.setMonth(d.getMonth() + 1);
    setHistoryMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const isCurrentMonth = historyMonth === ym;

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
        t.date?.startsWith(historyMonth) &&
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
          <div className="metric-label">
            Scheduled out
            <InfoModal title={`Scheduled outflows — ${monthName}`}>
              {allActiveRules
                .filter((r) => r.amount < 0)
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {r.desc}
                      {r.source && (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: 10,
                            marginLeft: 6,
                          }}
                        >
                          {r.source}
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--red)" }}>
                      {fmt(Math.abs(r.amount))}
                    </span>
                  </div>
                ))}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  marginTop: 6,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                <span>Total</span>
                <span>{fmt(scheduledOut)}</span>
              </div>
            </InfoModal>
          </div>
          <div className="metric-value red-text">{fmt(scheduledOut)}</div>
          <div className="metric-sub">per month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Logged in</div>
          <div className="metric-value green-text">{fmt(loggedIn)}</div>
          <div className="metric-sub">{monthName}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Logged out
            <InfoModal title={`Logged outflows — ${monthName}`}>
              {monthTx
                .filter((t) => t.amount < 0)
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {t.desc}
                      {t.category && (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: 10,
                            marginLeft: 6,
                          }}
                        >
                          {t.category}
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--red)" }}>
                      {fmt(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              {monthTx.filter((t) => t.amount < 0).length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: 12,
                  }}
                >
                  No outflow transactions logged yet
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  marginTop: 6,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                <span>Total</span>
                <span>{fmt(loggedOut)}</span>
              </div>
            </InfoModal>
          </div>
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
          {/* Month navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: "1rem",
              padding: "10px 0",
            }}
          >
            <button
              onClick={prevMonth}
              style={{
                background: "var(--bg-card2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                minWidth: 150,
                textAlign: "center",
              }}
            >
              {historyMonthName}
            </div>
            <button
              onClick={nextMonth}
              style={{
                background: "var(--bg-card2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={() => setHistoryMonth(ym)}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                Today
              </button>
            )}
          </div>
          <div className="grid-3 section-gap">
            <div className="metric-card">
              <div className="metric-label">In ({historyMonthName})</div>
              <div className="metric-value green-text">{fmt(totalIn)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Out ({historyMonthName})</div>
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
  const { personNames } = useData() || {};
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

  // ── Month selector ─────────────────────────────────────────────────────
  const _cfNow = new Date();
  const _cfCurYm = `${_cfNow.getFullYear()}-${String(_cfNow.getMonth() + 1).padStart(2, "0")}`;
  const [schedMonth, setSchedMonth] = useState(_cfCurYm);
  const schedMonthDate = new Date(schedMonth + "-01");
  const schedMonthLabel = schedMonthDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const schedPrevMonth = () => {
    const d = new Date(schedMonthDate);
    d.setMonth(d.getMonth() - 1);
    setSchedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const schedNextMonth = () => {
    const d = new Date(schedMonthDate);
    d.setMonth(d.getMonth() + 1);
    setSchedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const isCurrentMonth = schedMonth === _cfCurYm;
  const today = isCurrentMonth ? _cfNow.getDate() : 0; // only mark due/upcoming for current month

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

  const allRulesRaw = [
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
  const allActiveRules = rulesForMonth(
    allRulesRaw,
    schedMonthDate.getFullYear(),
    schedMonthDate.getMonth(),
  );
  const ym = schedMonth;
  const monthName = schedMonthLabel;

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
  const pLabel = (o) => personNames?.[o] || o;

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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
          <span style={{ color: "var(--gold)" }}>Household</span> Cash Flow
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-card2)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
          }}
        >
          <button
            className="btn-icon"
            onClick={schedPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            style={{
              minWidth: 120,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {schedMonthLabel}
          </span>
          <button
            className="btn-icon"
            onClick={schedNextMonth}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
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
                { id: "abhav", label: personNames?.abhav || "Person 1" },
                { id: "aanya", label: personNames?.aanya || "Person 2" },
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
              label: personNames?.abhav || "Person 1",
              manualRules: abhavManualRules,
            },
            {
              owner: "aanya",
              pData: aanya,
              color: "var(--aanya)",
              label: personNames?.aanya || "Person 2",
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
