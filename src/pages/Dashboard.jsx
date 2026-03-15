import { useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fmt,
  fmtCr,
  totalCorpus,
  lumpCorpus,
  CAT_COLORS,
  freqToMonthly,
} from "../utils/finance";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Month-aware stats from transactions ────────────────────────────────────
function statsFromTxns(txns, exps, incomes, ym) {
  let income = 0,
    expenses = 0,
    investments = 0,
    emis = 0;
  for (const t of txns || []) {
    if (!t.date || t.date.slice(0, 7) !== ym) continue;
    const amt = Math.abs(t.amount);
    if (t.amount > 0) income += amt;
    else if (t.type === "investment") investments += amt;
    else if (t.category === "EMI") emis += amt;
    else expenses += amt;
  }
  // Add expense entries for this month
  for (const exp of exps || []) {
    for (const e of exp.entries || []) {
      if (!e.date || e.date.slice(0, 7) !== ym) continue;
      if (exp.category === "EMI") emis += e.amount;
      else expenses += e.amount;
    }
  }
  // Add variable income entries for this month
  for (const inc of incomes || []) {
    for (const e of inc.incomeEntries || []) {
      if (!e.date || e.date.slice(0, 7) !== ym) continue;
      income += e.amount;
    }
  }
  const debts = emis;
  const savings = income - expenses - investments - debts;
  const savingsRate =
    income > 0
      ? Math.round(((investments + Math.max(0, savings)) / income) * 100)
      : 0;
  return {
    income,
    expenses,
    investments,
    debts,
    savings,
    savingsRate,
    corpus20: 0,
  };
}

// Collect all YYYY-MM keys that have any transaction or expense entry
function allAvailableMonths(abhav, aanya) {
  const set = new Set();
  const today = new Date();
  const curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  set.add(curYm);
  for (const p of [abhav, aanya]) {
    for (const t of p?.transactions || []) {
      if (t.date) set.add(t.date.slice(0, 7));
    }
    for (const exp of p?.expenses || []) {
      for (const e of exp.entries || []) {
        if (e.date) set.add(e.date.slice(0, 7));
      }
    }
    for (const inc of p?.incomes || []) {
      for (const e of inc.incomeEntries || []) {
        if (e.date) set.add(e.date.slice(0, 7));
      }
    }
  }
  return [...set].sort();
}

// ── Drag handle + sortable wrapper ─────────────────────────────────────────
function SortableSection({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-section">
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          background: "none",
          border: "none",
          cursor: "grab",
          color: "var(--text-muted)",
          opacity: 0,
          padding: 4,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          transition: "opacity 0.15s",
        }}
        className="drag-handle"
      >
        <GripVertical size={15} />
      </button>
      {children}
    </div>
  );
}

const LS_KEY = "dashboard-section-order";
const DEFAULT_ORDER = [
  "metrics",
  "cashflow",
  "persons",
  "comparison",
  "goals",
  "projection",
];

function personStats(data) {
  if (!data)
    return {
      income: 0,
      expenses: 0,
      investments: 0,
      debts: 0,
      savings: 0,
      savingsRate: 0,
    };
  const income = data.incomes?.reduce((s, x) => s + x.amount, 0) ?? 0;
  const expenses = data.expenses?.reduce((s, x) => s + x.amount, 0) ?? 0;
  const investments =
    data.investments?.reduce(
      (s, x) => s + freqToMonthly(x.amount, x.frequency),
      0,
    ) ?? 0;
  const debts = data.debts?.reduce((s, x) => s + x.emi, 0) ?? 0;
  const savings = income - expenses - investments - debts;
  const savingsRate =
    income > 0
      ? Math.round(((investments + Math.max(0, savings)) / income) * 100)
      : 0;
  const corpus20 =
    data.investments?.reduce((s, x) => {
      if (x.frequency === "onetime") {
        return (
          s +
          lumpCorpus((x.existingCorpus || 0) + (x.amount || 0), x.returnPct, 20)
        );
      }
      return (
        s +
        totalCorpus(
          x.existingCorpus || 0,
          freqToMonthly(x.amount, x.frequency),
          x.returnPct,
          20,
        )
      );
    }, 0) ?? 0;
  return {
    income,
    expenses,
    investments,
    debts,
    savings,
    savingsRate,
    corpus20,
  };
}

function HealthRing({ score }) {
  const color =
    score >= 75 ? "var(--green)" : score >= 50 ? "var(--gold)" : "var(--red)";
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke="var(--bg-card2)"
          strokeWidth="7"
        />
        <circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${(score / 100) * 176} 176`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontSize: 18,
          color,
        }}
      >
        {score}
      </div>
    </div>
  );
}

// ── Monthly Cash Flow aggregation ──
const MONTH_NAMES = [
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
];

function buildCashFlow(
  abhavTxns,
  aanyaTxns,
  abhavExps,
  aanyaExps,
  abhavIncs,
  aanyaIncs,
) {
  const map = {}; // key: "2026-03" → { income, expenses, investments, emis, detail }

  const ensure = (ym) => {
    if (!map[ym])
      map[ym] = { income: 0, expenses: 0, investments: 0, emis: 0, detail: [] };
  };

  // Months where an expense already has granular entries tracked —
  // skip the auto-transaction for those to avoid duplication in the schedule
  const entriesCovered = new Set();
  for (const exp of [...(abhavExps || []), ...(aanyaExps || [])]) {
    for (const e of exp.entries || []) {
      if (e.date) entriesCovered.add(`${exp.name}::${e.date.slice(0, 7)}`);
    }
  }

  const process = (txns) => {
    for (const t of txns || []) {
      if (!t.date) continue;
      const ym = t.date.slice(0, 7); // "YYYY-MM"
      ensure(ym);
      const amt = Math.abs(t.amount);
      if (t.amount > 0) {
        map[ym].income += amt;
        map[ym].detail.push({
          expName: t.desc,
          category: t.category || "Income",
          date: t.date,
          amount: amt,
          note: t.note || "",
          isIncome: true,
        });
      } else if (t.type === "investment") {
        map[ym].investments += amt;
      } else if (t.category === "EMI") {
        map[ym].emis += amt;
        map[ym].detail.push({
          expName: t.desc,
          category: "EMI",
          date: t.date,
          amount: amt,
          note: t.note || "",
        });
      } else {
        // Skip auto-transactions for expenses already tracked by dated entries
        if (t.auto && entriesCovered.has(`${t.desc}::${ym}`)) continue;
        map[ym].expenses += amt;
        map[ym].detail.push({
          expName: t.desc,
          category: t.category || "Others",
          date: t.date,
          amount: amt,
          note: t.note || "",
        });
      }
    }
  };

  // Process budget expense entries (each has its own date + note/vendor)
  const processExps = (exps) => {
    for (const exp of exps || []) {
      for (const e of exp.entries || []) {
        if (!e.date) continue;
        const ym = e.date.slice(0, 7);
        ensure(ym);
        if (exp.category === "EMI") {
          map[ym].emis += e.amount;
        } else {
          map[ym].expenses += e.amount;
        }
        map[ym].detail.push({
          expName: exp.name,
          category: exp.category,
          subCategory: exp.subCategory || "",
          date: e.date,
          amount: e.amount,
          note: e.note || "",
        });
      }
    }
  };

  // Process variable income entries (each has its own date)
  const processIncs = (incs) => {
    for (const inc of incs || []) {
      for (const e of inc.incomeEntries || []) {
        if (!e.date) continue;
        const ym = e.date.slice(0, 7);
        ensure(ym);
        map[ym].income += e.amount;
        map[ym].detail.push({
          expName: inc.name,
          category: "Income",
          subCategory: e.type || "",
          date: e.date,
          amount: e.amount,
          note: e.note || "",
          isIncome: true,
        });
      }
    }
  };

  process(abhavTxns);
  process(aanyaTxns);
  processExps(abhavExps);
  processExps(aanyaExps);
  processIncs(abhavIncs);
  processIncs(aanyaIncs);

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, d]) => {
      const [y, m] = ym.split("-");
      const net = d.income - d.expenses - d.investments - d.emis;
      return {
        label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`,
        ym,
        income: d.income,
        expenses: d.expenses,
        investments: d.investments,
        emis: d.emis,
        detail: d.detail,
        outflows: d.expenses + d.investments + d.emis,
        net,
      };
    });
}

function MonthlyCashFlow({ abhav, aanya, selectedMonth }) {
  const data = buildCashFlow(
    abhav?.transactions,
    aanya?.transactions,
    abhav?.expenses,
    aanya?.expenses,
    abhav?.incomes,
    aanya?.incomes,
  );
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  if (data.length === 0) return null;

  // Savings streak: consecutive months with positive net (from latest)
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].net > 0) streak++;
    else break;
  }

  // Show the selected month's summary (or latest if not found)
  const selected = data.find((d) => d.ym === selectedMonth);
  const latest = data[data.length - 1];
  const featured = selected || latest;
  const [featuredY, featuredM] = (featured?.ym || "").split("-");
  const featuredLabel = featured
    ? `${MONTH_NAMES[parseInt(featuredM, 10) - 1]} ${featuredY}`
    : null;

  return (
    <div className="card section-gap">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div className="card-title" style={{ marginBottom: 0 }}>
          📊 Monthly Cash Flow
        </div>
        {streak > 0 && (
          <div
            style={{
              fontSize: 12,
              background: "var(--green-dim)",
              color: "var(--green)",
              padding: "3px 10px",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            🔥 {streak} month{streak > 1 ? "s" : ""} positive streak
          </div>
        )}
      </div>

      {/* Current month summary */}
      {featured && (
        <div style={{ marginBottom: "1.25rem" }}>
          {featured.ym !== latest.ym && (
            <div
              style={{
                fontSize: 11,
                color: "var(--gold)",
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              {featuredLabel}
            </div>
          )}
          <div className="grid-4">
            <div className="metric-card" style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Income
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--green)",
                }}
              >
                {fmt(featured.income)}
              </div>
            </div>
            <div className="metric-card" style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Expenses
              </div>
              <div
                style={{ fontSize: 15, fontWeight: 600, color: "var(--red)" }}
              >
                {fmt(featured.expenses)}
              </div>
            </div>
            <div className="metric-card" style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Invest + EMIs
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--gold)",
                }}
              >
                {fmt(featured.investments + featured.emis)}
              </div>
            </div>
            <div className="metric-card" style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Net cash
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: featured.net >= 0 ? "var(--green)" : "var(--red)",
                }}
              >
                {featured.net >= 0 ? "+" : "−"}
                {fmt(Math.abs(featured.net))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {data.length > 1 && (
        <div style={{ height: 220, marginBottom: "1.25rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#55535e" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v, name) => [fmt(v), name]}
                contentStyle={{
                  background: "#13131a",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#4caf82"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
              />
              <Bar
                dataKey="outflows"
                name="Outflows"
                fill="#e05c5c"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
              />
              <Line
                dataKey="net"
                name="Net Cash"
                type="monotone"
                stroke="#c9a84c"
                strokeWidth={2}
                dot={{ r: 3, fill: "#c9a84c" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly breakdown table */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 4px 8px",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            minWidth: 480,
            position: "sticky",
            top: 0,
            background: "var(--bg-card)",
            zIndex: 1,
          }}
        >
          <span style={{ width: 60 }}>Month</span>
          <span style={{ flex: 1, textAlign: "right" }}>Income</span>
          <span style={{ flex: 1, textAlign: "right" }}>Expenses</span>
          <span style={{ flex: 1, textAlign: "right" }}>Invest</span>
          <span style={{ flex: 1, textAlign: "right" }}>EMIs</span>
          <span style={{ flex: 1, textAlign: "right" }}>Net</span>
        </div>
        {[...data].reverse().map((d) => (
          <div key={d.ym} style={{ minWidth: 480 }}>
            <div
              className="data-row"
              style={{
                padding: "8px 4px",
                borderRadius: 4,
                cursor: d.detail?.length > 0 ? "pointer" : "default",
                background:
                  d.ym === selectedMonth
                    ? "rgba(201,168,76,0.07)"
                    : expandedMonth === d.ym
                      ? "rgba(255,255,255,0.03)"
                      : undefined,
                borderLeft:
                  d.ym === selectedMonth
                    ? "3px solid var(--gold)"
                    : "3px solid transparent",
              }}
              onClick={() =>
                d.detail?.length > 0
                  ? setExpandedMonth((p) => (p === d.ym ? null : d.ym))
                  : undefined
              }
            >
              <span style={{ width: 60, fontWeight: 500 }}>{d.label}</span>
              <span
                style={{ flex: 1, textAlign: "right", color: "var(--green)" }}
              >
                {fmt(d.income)}
              </span>
              <span
                style={{ flex: 1, textAlign: "right", color: "var(--red)" }}
              >
                {fmt(d.expenses)}
              </span>
              <span
                style={{ flex: 1, textAlign: "right", color: "var(--gold)" }}
              >
                {fmt(d.investments)}
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: "right",
                  color: "var(--text-secondary)",
                }}
              >
                {fmt(d.emis)}
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: "right",
                  fontWeight: 600,
                  color: d.net >= 0 ? "var(--green)" : "var(--red)",
                }}
              >
                {d.net >= 0 ? "+" : "−"}
                {fmt(Math.abs(d.net))}
              </span>
              {d.detail?.length > 0 && (
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 10,
                    marginLeft: 4,
                    flexShrink: 0,
                  }}
                >
                  {expandedMonth === d.ym ? "▲" : "▼ schedule"}
                </span>
              )}
            </div>

            {/* Expense drill-down: grouped by category */}
            {expandedMonth === d.ym &&
              d.detail?.length > 0 &&
              (() => {
                // Group entries by category (income entries use "Income")
                const groups = {};
                for (const e of d.detail) {
                  const key = e.isIncome ? "Income" : e.category || "Others";
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(e);
                }
                // Sort categories: Income first, then by total desc
                const sortedCats = Object.entries(groups).sort(([ka], [kb]) => {
                  if (ka === "Income") return -1;
                  if (kb === "Income") return 1;
                  const ta = groups[ka].reduce((s, e) => s + e.amount, 0);
                  const tb = groups[kb].reduce((s, e) => s + e.amount, 0);
                  return tb - ta;
                });
                return (
                  <div
                    style={{
                      margin: "0 4px 8px 8px",
                      padding: "8px 10px",
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--gold)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".07em",
                        marginBottom: 8,
                      }}
                    >
                      📋 Schedule — {d.label}
                    </div>
                    {sortedCats.map(([cat, items]) => {
                      const total = items.reduce((s, e) => s + e.amount, 0);
                      const isIncomeCat = cat === "Income";
                      const catKey = `${d.ym}::${cat}`;
                      const isCatOpen = expandedCats[catKey] !== false; // default open
                      return (
                        <div key={cat} style={{ marginBottom: 6 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              fontWeight: 600,
                              borderBottom: "1px solid var(--border)",
                              paddingBottom: 4,
                              marginBottom: isCatOpen ? 4 : 0,
                              color: isIncomeCat
                                ? "var(--green)"
                                : "var(--text-secondary)",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                            onClick={() =>
                              setExpandedCats((s) => ({
                                ...s,
                                [catKey]: !isCatOpen,
                              }))
                            }
                          >
                            <span>
                              {isCatOpen ? "▾" : "▸"} {cat}
                              <span
                                style={{
                                  fontWeight: 400,
                                  marginLeft: 5,
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                }}
                              >
                                ({items.length})
                              </span>
                            </span>
                            <span
                              style={{
                                color: isIncomeCat
                                  ? "var(--green)"
                                  : "var(--red)",
                              }}
                            >
                              {isIncomeCat ? "+" : "−"}
                              {fmt(total)}
                            </span>
                          </div>
                          {isCatOpen &&
                            [...items]
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((e, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    fontSize: 11,
                                    padding: "3px 0 3px 8px",
                                    color: "var(--text-secondary)",
                                    alignItems: "baseline",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "var(--text-muted)",
                                      flexShrink: 0,
                                      width: 44,
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {e.date.slice(8)}{" "}
                                    {
                                      [
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
                                      ][parseInt(e.date.slice(5, 7), 10) - 1]
                                    }
                                  </span>
                                  <span
                                    style={{
                                      flex: 1,
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {e.expName}
                                    {e.note ? (
                                      <span
                                        style={{
                                          marginLeft: 5,
                                          color: "var(--text-muted)",
                                          opacity: 0.7,
                                        }}
                                      >
                                        · {e.note}
                                      </span>
                                    ) : e.subCategory ? (
                                      <span
                                        style={{
                                          marginLeft: 5,
                                          color: "var(--text-muted)",
                                          opacity: 0.6,
                                        }}
                                      >
                                        · {e.subCategory}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      color: isIncomeCat
                                        ? "var(--green)"
                                        : "var(--red)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {fmt(e.amount)}
                                  </span>
                                </div>
                              ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
          </div>
        ))}
      </div>

      {data.length <= 1 && (
        <div className="tip" style={{ marginTop: "0.75rem" }}>
          💡 Cash flow history builds automatically as recurring transactions
          fire each month. After 2+ months you'll see the trend chart.
        </div>
      )}
    </div>
  );
}

// ── Raise nudge ─────────────────────────────────────────────────────────────
const NUDGE_DAYS = 45; // show nudge for 45 days after a raise

function latestRaise(personData, name, color) {
  if (!personData?.incomes) return null;
  let best = null;
  for (const inc of personData.incomes) {
    for (const h of inc.salaryHistory || []) {
      if (!best || h.date > best.date) {
        best = { ...h, incName: inc.name, name, color };
      }
    }
  }
  return best;
}

function RaiseNudge({ abhav, aanya }) {
  const candidates = [
    latestRaise(abhav, "Abhav", "var(--abhav)"),
    latestRaise(aanya, "Aanya", "var(--aanya)"),
  ].filter(Boolean);

  if (candidates.length === 0) return null;

  const today = new Date();
  const recent = candidates
    .filter((r) => {
      const days = (today - new Date(r.date)) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= NUDGE_DAYS && r.to > r.from;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (recent.length === 0) return null;

  return (
    <>
      {recent.map((r) => {
        const raise = r.to - r.from;
        const pct = r.from > 0 ? ((raise / r.from) * 100).toFixed(1) : null;
        // Suggest putting ~30% of the raise into SIPs
        const suggestedSIP = Math.round((raise * 0.3) / 500) * 500;
        return (
          <div
            key={`${r.name}-${r.date}`}
            className="card section-gap"
            style={{
              background: `linear-gradient(135deg, rgba(201,168,76,0.08), transparent)`,
              border: "1px solid var(--gold-border, rgba(201,168,76,0.25))",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                🎉
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Sparkles size={14} color="var(--gold)" />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    <span style={{ color: r.color }}>{r.name}</span> got a
                    raise!
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      background: "var(--green-dim)",
                      color: "var(--green)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontWeight: 500,
                    }}
                  >
                    +{fmt(raise)}/mo{pct ? ` (+${pct}%)` : ""}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: r.note ? 4 : 0,
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    {r.incName}
                  </span>
                  : {fmt(r.from)} →{" "}
                  <strong style={{ color: r.color }}>{fmt(r.to)}</strong>
                  <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                    · {r.date}
                  </span>
                </div>
                {r.note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      marginBottom: 8,
                    }}
                  >
                    “{r.note}”
                  </div>
                )}
                {suggestedSIP > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 14px",
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      💡 Consider increasing your SIP by
                    </span>{" "}
                    <strong style={{ color: "var(--gold)" }}>
                      {fmt(suggestedSIP)}/month
                    </strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      — 30% of your raise. You’ll barely notice it and it
                      compounds to{" "}
                    </span>
                    <strong style={{ color: "var(--green)" }}>
                      {fmtCr(totalCorpus(0, suggestedSIP, 12, 20))}
                    </strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      in 20 years.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function Dashboard({ abhav, aanya, shared }) {
  // ── Month picker ────────────────────────────────────────────────────────
  const todayYm = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const [selectedMonth, setSelectedMonth] = useState(todayYm);
  const months = allAvailableMonths(abhav, aanya);
  const selIdx = months.indexOf(selectedMonth);
  const isCurrentMonth = selectedMonth === todayYm;

  const prevMonth = () => selIdx > 0 && setSelectedMonth(months[selIdx - 1]);
  const nextMonth = () =>
    selIdx < months.length - 1 && setSelectedMonth(months[selIdx + 1]);

  // Friendly label e.g. "Mar 2026" or "Mar 26 (current)"
  const [selY, selM] = selectedMonth.split("-");
  const selLabel = `${MONTH_NAMES[parseInt(selM, 10) - 1]} ${selY}`;

  // ── Stats: for the selected month use transaction-based stats ──────────
  // For the current month fall back to standing config when no transactions yet
  const aTxStats = statsFromTxns(
    abhav?.transactions,
    abhav?.expenses,
    abhav?.incomes,
    selectedMonth,
  );
  const bTxStats = statsFromTxns(
    aanya?.transactions,
    aanya?.expenses,
    aanya?.incomes,
    selectedMonth,
  );
  const aStanding = personStats(abhav); // standing config (for corpus20)
  const bStanding = personStats(aanya);

  // Use transaction stats if the month has any income/expense data, else fall back to standing
  const aHasData =
    aTxStats.income > 0 || aTxStats.expenses > 0 || aTxStats.investments > 0;
  const bHasData =
    bTxStats.income > 0 || bTxStats.expenses > 0 || bTxStats.investments > 0;
  const a = aHasData
    ? { ...aTxStats, corpus20: aStanding.corpus20 }
    : aStanding;
  const b = bHasData
    ? { ...bTxStats, corpus20: bStanding.corpus20 }
    : bStanding;

  const hIncome = a.income + b.income;
  const hExpenses = a.expenses + b.expenses;
  const hInvest = a.investments + b.investments;
  const hDebts = a.debts + b.debts;
  const hSavings = hIncome - hExpenses - hInvest - hDebts;
  const hSavingsRate =
    hIncome > 0
      ? Math.round(((hInvest + Math.max(0, hSavings)) / hIncome) * 100)
      : 0;
  const hCorpus20 = a.corpus20 + b.corpus20;

  const healthScore = (stats) =>
    Math.min(
      100,
      Math.round(
        (stats.savingsRate >= 20 ? 35 : (stats.savingsRate / 20) * 35) +
          (stats.debts / Math.max(1, stats.income) < 0.3 ? 25 : 10) +
          20 +
          20,
      ),
    );

  const aScore = healthScore(a);
  const bScore = healthScore(b);
  const hScore = healthScore({
    savingsRate: hSavingsRate,
    debts: hDebts,
    income: hIncome,
  });

  // Comparison bar data
  const compareData = [
    { label: "Income", abhav: a.income, aanya: b.income },
    { label: "Expenses", abhav: a.expenses, aanya: b.expenses },
    { label: "Investments", abhav: a.investments, aanya: b.investments },
  ];

  // Spending pie — use this month's expense entries + transactions
  const spendMap = {};
  // From expense entries for selected month
  for (const p of [abhav, aanya]) {
    for (const exp of p?.expenses || []) {
      for (const e of exp.entries || []) {
        if (e.date?.slice(0, 7) !== selectedMonth) continue;
        spendMap[exp.category] = (spendMap[exp.category] || 0) + e.amount;
      }
    }
  }
  // From transactions for selected month
  for (const p of [abhav, aanya]) {
    for (const t of p?.transactions || []) {
      if (!t.date || t.date.slice(0, 7) !== selectedMonth || t.amount >= 0)
        continue;
      if (t.type === "investment" || t.category === "EMI") continue;
      const cat = t.category || "Others";
      spendMap[cat] = (spendMap[cat] || 0) + Math.abs(t.amount);
    }
  }
  // Fall back to standing config when no transaction data at all
  if (!aHasData && !bHasData) {
    [...(abhav?.expenses || []), ...(aanya?.expenses || [])].forEach((e) => {
      spendMap[e.category] = (spendMap[e.category] || 0) + e.amount;
    });
  }
  const pieData = Object.entries(spendMap)
    .sort((x, y) => y[1] - x[1])
    .map(([name, value]) => ({
      name,
      value,
      fill: CAT_COLORS[name] || "#6b6b7a",
    }));

  // Shared goals
  const sharedGoals = shared?.goals || [];

  // ── Section order (persisted in localStorage) ──────────────────────────
  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY));
      // ensure any new sections not in saved are appended
      if (Array.isArray(saved)) {
        const merged = [...saved];
        for (const id of DEFAULT_ORDER) {
          if (!merged.includes(id)) merged.push(id);
        }
        return merged;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ORDER;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    setSectionOrder((prev) => {
      const next = arrayMove(
        prev,
        prev.indexOf(active.id),
        prev.indexOf(over.id),
      );
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Section renderers ───────────────────────────────────────────────────
  const sections = {
    metrics: (
      <div className="grid-4 section-gap">
        {[
          {
            label: "Combined Income",
            val: hIncome,
            color: "var(--green)",
            icon: "up",
          },
          {
            label: "Combined Expenses",
            val: hExpenses,
            color: "var(--red)",
            icon: "down",
          },
          {
            label: "Investing / month",
            val: hInvest,
            color: "var(--gold)",
            icon: "up",
          },
          {
            label: "Household Savings Rate",
            val: hSavingsRate + "%",
            color: hSavingsRate >= 20 ? "var(--green)" : "var(--gold)",
            icon: hSavingsRate >= 20 ? "up" : "down",
            raw: true,
          },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div className="metric-label">{m.label}</div>
              {m.icon === "up" ? (
                <TrendingUp
                  size={14}
                  color={m.color}
                  style={{ opacity: 0.7, flexShrink: 0 }}
                />
              ) : (
                <TrendingDown
                  size={14}
                  color={m.color}
                  style={{ opacity: 0.7, flexShrink: 0 }}
                />
              )}
            </div>
            <div className="metric-value" style={{ color: m.color }}>
              {m.raw ? m.val : fmt(m.val)}
            </div>
          </div>
        ))}
      </div>
    ),

    cashflow: (
      <MonthlyCashFlow
        abhav={abhav}
        aanya={aanya}
        selectedMonth={selectedMonth}
      />
    ),

    persons: (
      <>
        <RaiseNudge abhav={abhav} aanya={aanya} />
        <div className="grid-2 section-gap">
          {[
            {
              name: "Abhav",
              stats: a,
              score: aScore,
              color: "var(--abhav)",
              dim: "var(--abhav-dim)",
            },
            {
              name: "Aanya",
              stats: b,
              score: bScore,
              color: "var(--aanya)",
              dim: "var(--aanya-dim)",
            },
          ].map((p) => (
            <div
              key={p.name}
              className="card"
              style={{ borderTop: `3px solid ${p.color}` }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <div
                    style={{ fontFamily: "var(--font-display)", fontSize: 18 }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Health score
                  </div>
                </div>
                <HealthRing score={p.score} />
              </div>
              {[
                {
                  label: "Income",
                  val: p.stats.income,
                  color: "var(--green)",
                },
                {
                  label: "Expenses",
                  val: p.stats.expenses,
                  color: "var(--red)",
                },
                {
                  label: "Investments",
                  val: p.stats.investments,
                  color: p.color,
                },
                {
                  label: "20yr Corpus",
                  val: p.stats.corpus20,
                  color: "var(--gold)",
                  cr: true,
                },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "5px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {r.label}
                  </span>
                  <span style={{ color: r.color, fontWeight: 500 }}>
                    {r.cr ? fmtCr(r.val) : fmt(r.val)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Savings rate
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      p.stats.savingsRate >= 20
                        ? "var(--green)"
                        : "var(--gold)",
                  }}
                >
                  {p.stats.savingsRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* Who's saving more */}
        <div
          className="card section-gap"
          style={{
            background:
              a.savingsRate >= b.savingsRate
                ? "linear-gradient(135deg, rgba(91,156,246,0.06), transparent)"
                : "linear-gradient(135deg, rgba(212,110,179,0.06), transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: 28 }}>
              {a.savingsRate >= b.savingsRate ? "🏆" : "👑"}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>
                <span
                  style={{
                    color:
                      a.savingsRate >= b.savingsRate
                        ? "var(--abhav)"
                        : "var(--aanya)",
                  }}
                >
                  {a.savingsRate >= b.savingsRate ? "Abhav" : "Aanya"}
                </span>{" "}
                is saving more this month!
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                Abhav:{" "}
                <strong style={{ color: "var(--abhav)" }}>
                  {a.savingsRate}%
                </strong>{" "}
                &nbsp;·&nbsp; Aanya:{" "}
                <strong style={{ color: "var(--aanya)" }}>
                  {b.savingsRate}%
                </strong>{" "}
                &nbsp;·&nbsp; Household target:{" "}
                <strong style={{ color: "var(--gold)" }}>
                  {shared?.profile?.savingsTarget ?? 25}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      </>
    ),

    comparison: (
      <div className="grid-2 section-gap">
        {/* Comparison bars */}
        <div className="card">
          <div className="card-title">Abhav vs Aanya</div>
          <div
            style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--abhav)",
                  display: "inline-block",
                }}
              />
              Abhav
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--aanya)",
                  display: "inline-block",
                }}
              />
              Aanya
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={compareData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#55535e" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={fmt}
                contentStyle={{
                  background: "#13131a",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="abhav"
                fill="#5b9cf6"
                radius={[4, 4, 0, 0]}
                name="Abhav"
              />
              <Bar
                dataKey="aanya"
                fill="#d46eb3"
                radius={[4, 4, 0, 0]}
                name="Aanya"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spending pie */}
        <div className="card">
          <div className="card-title">Combined Spending</div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  dataKey="value"
                  strokeWidth={0}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {pieData.slice(0, 6).map((d) => (
                <div
                  key={d.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 1,
                      background: CAT_COLORS[d.name] || "#6b6b7a",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, color: "var(--text-secondary)" }}>
                    {d.name}
                  </span>
                  <span style={{ fontWeight: 500 }}>{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    goals:
      sharedGoals.length > 0 ? (
        <div className="card section-gap">
          <div className="card-title">🏠 Shared Goals</div>
          {sharedGoals.map((g) => {
            const totalSaved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
            const pct = Math.min(
              100,
              Math.round((totalSaved / g.target) * 100),
            );
            return (
              <div key={g.id} style={{ marginBottom: "1.25rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: 20 }}>{g.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>
                        {g.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        Abhav:{" "}
                        <span style={{ color: "var(--abhav)" }}>
                          {fmt(g.abhavSaved)}
                        </span>
                        &nbsp;·&nbsp; Aanya:{" "}
                        <span style={{ color: "var(--aanya)" }}>
                          {fmt(g.aanyaSaved)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {fmt(totalSaved)}{" "}
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontWeight: 400,
                        }}
                      >
                        / {fmt(g.target)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {pct}% done
                    </div>
                  </div>
                </div>
                <div className="progress-track" style={{ height: 6 }}>
                  <div
                    className="progress-fill"
                    style={{ width: pct + "%", background: g.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null,

    projection: (
      <div className="card">
        <div className="card-title">💰 Household Wealth Projection</div>
        <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem" }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 2,
              }}
            >
              Combined corpus in 20 years
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                color: "var(--gold)",
              }}
            >
              {fmtCr(hCorpus20)}
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
              Monthly SIP total
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
              {fmt(hInvest)}
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
              Household health
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: hScore >= 75 ? "var(--green)" : "var(--gold)",
              }}
            >
              {hScore}/100
            </div>
          </div>
        </div>
        <div className="tip">
          💡 At {fmt(hInvest)}/month combined SIPs, you're on track for{" "}
          {fmtCr(hCorpus20)} in 20 years.
          {hSavingsRate < 25 &&
            ` Boost your household savings rate to 25%+ to retire even earlier.`}
        </div>
      </div>
    ),
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            marginBottom: 4,
          }}
        >
          {shared?.profile?.householdName ?? "Household"} 🏡
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Combined household overview
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            · drag ⠿ to reorder
          </span>

          {/* Month picker */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginLeft: "auto",
              background: isCurrentMonth
                ? "var(--bg-card2)"
                : "var(--gold-dim)",
              border: isCurrentMonth
                ? "1px solid var(--border)"
                : "1px solid var(--gold-border)",
              borderRadius: 8,
              padding: "2px 4px",
            }}
          >
            <button
              onClick={prevMonth}
              disabled={selIdx <= 0}
              style={{
                background: "none",
                border: "none",
                cursor: selIdx <= 0 ? "not-allowed" : "pointer",
                color:
                  selIdx <= 0 ? "var(--text-muted)" : "var(--text-secondary)",
                padding: "3px 5px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isCurrentMonth ? "var(--text-secondary)" : "var(--gold)",
                minWidth: 72,
                textAlign: "center",
                userSelect: "none",
              }}
            >
              {selLabel}
              {isCurrentMonth && (
                <span
                  style={{
                    display: "block",
                    fontSize: 9,
                    fontWeight: 400,
                    color: "var(--text-muted)",
                    marginTop: -1,
                  }}
                >
                  current
                </span>
              )}
            </span>
            <button
              onClick={nextMonth}
              disabled={selIdx >= months.length - 1}
              style={{
                background: "none",
                border: "none",
                cursor: selIdx >= months.length - 1 ? "not-allowed" : "pointer",
                color:
                  selIdx >= months.length - 1
                    ? "var(--text-muted)"
                    : "var(--text-secondary)",
                padding: "3px 5px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={14} />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={() => setSelectedMonth(todayYm)}
                title="Back to current month"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gold)",
                  fontSize: 10,
                  padding: "3px 5px",
                  borderRadius: 4,
                }}
              >
                today
              </button>
            )}
          </div>
        </div>

        {/* Past month banner */}
        {!isCurrentMonth && (
          <div
            style={{
              marginTop: 10,
              padding: "6px 12px",
              background: "rgba(201,168,76,0.08)",
              border: "1px solid var(--gold-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--gold)",
            }}
          >
            📅 Viewing <strong>{selLabel}</strong> — numbers reflect that
            month's transactions.{" "}
            {!aHasData && !bHasData && (
              <span style={{ color: "var(--text-muted)" }}>
                No transactions found for this month — showing current budget
                config.
              </span>
            )}
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          {sectionOrder.map((id) => {
            const content = sections[id];
            if (!content) return null;
            return (
              <SortableSection key={id} id={id}>
                {content}
              </SortableSection>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
