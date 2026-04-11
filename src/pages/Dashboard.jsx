import { useState } from "react";
import { EmergencyFundCard } from "./MorePages";
import { Chart, DonutChart } from "../components/Chart";
import {
  fmt,
  fmtCr,
  totalCorpus,
  lumpCorpus,
  CAT_COLORS,
  freqToMonthly,
  fireRatio,
  retirementCorpus,
  requiredSIP,
  assetAllocation,
  currentCorpus,
  unused80C,
  insuranceAdequacy,
  onetimeEffective,
} from "../utils/finance";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldCheck,
  Flame,
  PiggyBank,
  Activity,
  RefreshCw,
} from "lucide-react";
import { InfoModal } from "../components/InfoModal";
import { useMarketData } from "../hooks/useMarketData";
import MonthlySummary from "../components/MonthlySummary";

function Sparkline({ data, color, width = 64, height = 24 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", marginTop: 4 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ── Month-aware stats from transactions ────────────────────────────────────

function statsFromTxns(txns, exps, incomes, ym, subs) {
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
  // Add active subscriptions as monthly expense
  for (const s of subs || []) {
    if (s.active !== false) expenses += freqToMonthly(s.amount, s.frequency);
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

const DASH_TABS = [
  { id: "pulse", label: "Pulse", icon: "📊" },
  { id: "people", label: "People", icon: "👥" },
  { id: "wealth", label: "Wealth", icon: "💰" },
];
const DASH_TAB_LS = "dashboard-active-tab";

function personStats(data, ym) {
  if (!data)
    return {
      income: 0,
      expenses: 0,
      investments: 0,
      debts: 0,
      savings: 0,
      savingsRate: 0,
    };
  const income =
    data.incomes?.reduce((s, x) => {
      let base = x.amount || 0;
      // Add variable income entries (bonus, freelance, dividend, etc.) for the selected month
      if (ym && x.incomeEntries) {
        for (const e of x.incomeEntries) {
          if (e.date && e.date.slice(0, 7) === ym) {
            base += e.amount || 0;
          }
        }
      }
      return s + base;
    }, 0) ?? 0;
  // Month-aware expense filtering:
  // - Monthly (recurring) expenses always included
  // - One-time expenses only for the matching month
  // - Trip expenses only for the matching month
  const curMonth = ym
    ? parseInt(ym.split("-")[1], 10) - 1
    : new Date().getMonth();
  const expenses = (data.expenses || []).reduce((s, x) => {
    if (x.expenseType === "onetime") {
      // Only include if date falls in selected month — use entry sum
      return s + (x.date?.slice(0, 7) === ym ? onetimeEffective(x) : 0);
    }
    if (x.expenseType === "trip") {
      // Only include if startDate falls in selected month
      return (
        s + ((x.startDate || x.date || "").slice(0, 7) === ym ? x.amount : 0)
      );
    }
    // Monthly/recurring: check recurrence gating
    if (x.recurrence === "yearly" && (x.recurrenceMonth ?? 0) !== curMonth)
      return s;
    if (x.recurrence === "quarterly") {
      const months = x.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(curMonth)) return s;
    }
    return s + x.amount;
  }, 0);
  // Include active subscriptions as monthly expenses
  const subsTotal =
    data.subscriptions?.reduce(
      (s, x) =>
        s + (x.active !== false ? freqToMonthly(x.amount, x.frequency) : 0),
      0,
    ) ?? 0;
  const investments =
    data.investments?.reduce(
      (s, x) => s + freqToMonthly(x.amount, x.frequency),
      0,
    ) ?? 0;
  const debts = data.debts?.reduce((s, x) => s + x.emi, 0) ?? 0;
  const savings = income - expenses - subsTotal - investments - debts;
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
    expenses: expenses + subsTotal,
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

// ── Financial Health Score: 5-pillar model ────────────────────────────────
function calcHealthScore({
  savingsRate,
  dti,
  emergencyMonths,
  hasInvestments,
  insAdequate,
}) {
  const pillars = [
    {
      key: "savings",
      label: "Savings Rate",
      emoji: "💰",
      maxPts: 25,
      pts:
        savingsRate >= 25
          ? 25
          : savingsRate >= 20
            ? 22
            : Math.round((savingsRate / 20) * 20),
      detail:
        savingsRate >= 20
          ? `${savingsRate}% — on target`
          : `${savingsRate}% — target 20%+`,
    },
    {
      key: "debt",
      label: "Debt Load",
      emoji: "📉",
      maxPts: 25,
      pts: dti < 0.2 ? 25 : dti < 0.3 ? 20 : dti < 0.4 ? 12 : dti < 0.5 ? 5 : 0,
      detail: `${Math.round(dti * 100)}% of income on EMIs — ${dti < 0.3 ? "healthy" : dti < 0.4 ? "manageable" : "high"}`,
    },
    {
      key: "emergency",
      label: "Emergency Fund",
      emoji: "🛡️",
      maxPts: 20,
      pts:
        emergencyMonths >= 6
          ? 20
          : Math.round((Math.min(emergencyMonths, 6) / 6) * 20),
      detail: `${emergencyMonths.toFixed(1)} months coverage — ${emergencyMonths >= 6 ? "excellent" : emergencyMonths >= 3 ? "adequate" : "build this up"}`,
    },
    {
      key: "investing",
      label: "Investing Regularly",
      emoji: "📈",
      maxPts: 20,
      pts: hasInvestments ? 20 : 0,
      detail: hasInvestments
        ? "Monthly SIPs/investments active"
        : "No investments set up yet",
    },
    {
      key: "protection",
      label: "Life Insurance",
      emoji: "🔒",
      maxPts: 10,
      pts: insAdequate ? 10 : 0,
      detail: insAdequate
        ? "Life cover is adequate"
        : "cover gap — consider a term plan",
    },
  ];
  const score = Math.min(
    100,
    pillars.reduce((s, p) => s + p.pts, 0),
  );
  const label =
    score >= 80
      ? "Excellent"
      : score >= 65
        ? "Good"
        : score >= 45
          ? "Needs Work"
          : "At Risk";
  return { score, label, pillars };
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
  sharedTrips,
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

  // Track which expenses have been covered by transactions (keyed by name)
  const txnCoveredThisMonth = new Set();
  // Track which expenses have been covered by dated entries (keyed by id)
  const entryCoveredThisMonth = new Set();

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
        txnCoveredThisMonth.add(`${t.desc}::${ym}`);
      }
    }
  };

  const processExps = (exps) => {
    for (const exp of exps || []) {
      const monthEntrySum = {}; // ym → sum of entry amounts
      for (const e of exp.entries || []) {
        if (!e.date) continue;
        const ym = e.date.slice(0, 7);
        ensure(ym);
        map[ym].detail.push({
          expName: exp.name,
          category: exp.category,
          subCategory: exp.subCategory || "",
          date: e.date,
          amount: e.amount,
          note: e.note || "",
        });
        monthEntrySum[ym] = (monthEntrySum[ym] || 0) + (e.amount || 0);
        entryCoveredThisMonth.add(`${exp.id}::${ym}`);
      }
      // For one-time expenses: use entry sum; for regular: use standing budget amount
      for (const ym of Object.keys(monthEntrySum)) {
        const amt =
          exp.expenseType === "onetime" ? monthEntrySum[ym] : exp.amount;
        if (exp.category === "EMI") {
          map[ym].emis += amt;
        } else {
          map[ym].expenses += amt;
        }
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

  // ── Include standing amounts for current month (fallback) ──────────────
  const curYm = new Date().toISOString().slice(0, 7);
  const curMonth = new Date().getMonth();

  // Standing income — for incomes without variable income entries this month
  const incomeCovered = new Set();
  for (const ym of Object.keys(map)) {
    for (const d of map[ym].detail) {
      if (d.isIncome) incomeCovered.add(`${d.expName}::${ym}`);
    }
  }
  for (const inc of [...(abhavIncs || []), ...(aanyaIncs || [])]) {
    if (incomeCovered.has(`${inc.name}::${curYm}`)) continue;
    if (inc.amount > 0) {
      ensure(curYm);
      map[curYm].income += inc.amount;
      map[curYm].detail.push({
        expName: inc.name,
        category: "Income",
        date: `${curYm}-01`,
        amount: inc.amount,
        note: "budgeted",
        isIncome: true,
      });
    }
  }

  // Standing expenses — for expenses without entries/transactions this month
  for (const exp of [...(abhavExps || []), ...(aanyaExps || [])]) {
    if (exp.expenseType === "trip" || exp.expenseType === "onetime") continue;
    // Check recurrence: skip if expense doesn't apply to current month
    if (exp.recurrence === "yearly" && (exp.recurrenceMonth ?? 0) !== curMonth)
      continue;
    if (exp.recurrence === "quarterly") {
      const months = exp.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(curMonth)) continue;
    }
    // Skip if already covered by entries (by id) or transactions (by name)
    if (entryCoveredThisMonth.has(`${exp.id}::${curYm}`)) continue;
    if (txnCoveredThisMonth.has(`${exp.name}::${curYm}`)) continue;
    if (exp.amount > 0) {
      ensure(curYm);
      map[curYm].expenses += exp.amount;
      map[curYm].detail.push({
        expName: exp.name,
        category: exp.category || "Others",
        subCategory: exp.subCategory || "",
        date: `${curYm}-01`,
        amount: exp.amount,
        note: "budgeted",
      });
    }
  }

  // ── Include trip expenses ──────────────────────────────────────────────
  // Personal trip expenses
  for (const exp of [...(abhavExps || []), ...(aanyaExps || [])]) {
    if (exp.expenseType !== "trip") continue;
    const tripDate = exp.startDate || exp.date || `${curYm}-01`;
    const ym = tripDate.slice(0, 7);
    if (exp.amount > 0) {
      ensure(ym);
      map[ym].expenses += exp.amount;
      map[ym].detail.push({
        expName: exp.name,
        category: exp.category || "Travel",
        date: tripDate,
        amount: exp.amount,
        note: "trip",
      });
    }
  }
  // Personal one-time expenses — add entry details to schedule
  // (totals already handled by processExps via entry sums)
  for (const exp of [...(abhavExps || []), ...(aanyaExps || [])]) {
    if (exp.expenseType !== "onetime") continue;
    // One-time expenses without entries have nothing to show
    if (!exp.entries?.length) continue;
    const oDate = exp.date || `${curYm}-01`;
    const ym = oDate.slice(0, 7);
    // Only add detail rows for expenses that weren't already covered by processExps
    if (entryCoveredThisMonth.has(`${exp.id}::${ym}`)) continue;
    const total = onetimeEffective(exp);
    if (total > 0) {
      ensure(ym);
      map[ym].expenses += total;
      map[ym].detail.push({
        expName: exp.name,
        category: exp.category || "Others",
        date: oDate,
        amount: total,
        note: "one-time",
      });
    }
  }
  // Shared trip expenses
  for (const trip of sharedTrips || []) {
    const tripDate = trip.startDate || `${curYm}-01`;
    const ym = tripDate.slice(0, 7);
    if (trip.amount > 0) {
      ensure(ym);
      map[ym].expenses += trip.amount;
      map[ym].detail.push({
        expName: trip.name,
        category: "Travel",
        date: tripDate,
        amount: trip.amount,
        note: "shared trip",
      });
    }
  }

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

function MonthlyCashFlow({ abhav, aanya, shared, selectedMonth }) {
  const data = buildCashFlow(
    abhav?.transactions,
    aanya?.transactions,
    abhav?.expenses,
    aanya?.expenses,
    abhav?.incomes,
    aanya?.incomes,
    shared?.trips,
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
                <InfoModal title="Cash Flow — Expenses">
                  <p>
                    This includes <strong>dated entries</strong> (purchase logs
                    and transaction records), plus{" "}
                    <strong>budgeted amounts</strong> for monthly expenses
                    without logged entries this month.
                  </p>
                  <p style={{ marginTop: 8 }}>
                    <strong>Trips</strong> (personal and shared) are also
                    included, placed in the month of their start date.
                  </p>
                  <p style={{ marginTop: 8 }}>
                    Items marked <em>"budgeted"</em> in the accordion are
                    standing budget amounts — log entries to replace them with
                    actuals.
                  </p>
                </InfoModal>
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
          <Chart
            categories={data.map((d) => d.label)}
            series={[
              {
                name: "Income",
                type: "bar",
                data: data.map((d) => d.income),
                color: "#4caf82",
                opacity: 0.7,
              },
              {
                name: "Outflows",
                type: "bar",
                data: data.map((d) => d.outflows),
                color: "#e05c5c",
                opacity: 0.7,
              },
              {
                name: "Net Cash",
                type: "line",
                data: data.map((d) => d.net),
                color: "#c9a84c",
                symbol: "circle",
              },
            ]}
            fmt={fmt}
            grid={{ top: 8 }}
          />
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

function RaiseNudge({ abhav, aanya, personNames }) {
  const candidates = [
    latestRaise(abhav, personNames?.abhav || "Person 1", "var(--abhav)"),
    latestRaise(aanya, personNames?.aanya || "Person 2", "var(--aanya)"),
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

export default function Dashboard({ abhav, aanya, shared, personNames }) {
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
    abhav?.subscriptions,
  );
  const bTxStats = statsFromTxns(
    aanya?.transactions,
    aanya?.expenses,
    aanya?.incomes,
    selectedMonth,
    aanya?.subscriptions,
  );
  // Previous month stats for month-over-month comparison
  const prevYm = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const aPrevTx = statsFromTxns(
    abhav?.transactions,
    abhav?.expenses,
    abhav?.incomes,
    prevYm,
    abhav?.subscriptions,
  );
  const bPrevTx = statsFromTxns(
    aanya?.transactions,
    aanya?.expenses,
    aanya?.incomes,
    prevYm,
    aanya?.subscriptions,
  );
  const prevHasData =
    aPrevTx.income > 0 ||
    aPrevTx.expenses > 0 ||
    bPrevTx.income > 0 ||
    bPrevTx.expenses > 0;

  const aStanding = personStats(abhav, selectedMonth); // standing config (for corpus20)
  const bStanding = personStats(aanya, selectedMonth);

  // Always use standing expenses (matches Budget page totals) so per-person
  // cards are consistent with the Budget page. Income uses actual entries
  // when available; investments/debts from standing config.
  const recalc = (standing) => {
    const { income, expenses, investments, debts } = standing;
    const savings = income - expenses - investments - debts;
    const savingsRate =
      income > 0
        ? Math.round(((investments + Math.max(0, savings)) / income) * 100)
        : 0;
    return { ...standing, savings, savingsRate };
  };
  const a = recalc(aStanding);
  const b = recalc(bStanding);

  // Shared trips (joint trips visible to both persons) — filter by selected month
  const sharedTrips = (shared?.trips || []).filter(
    (t) => (t.startDate || "").slice(0, 7) === selectedMonth,
  );
  const sharedTripTotal = sharedTrips.reduce((s, x) => s + (x.amount || 0), 0);

  // Expense breakdown for info modals — filtered by selected month
  const selMonth = parseInt(selectedMonth.split("-")[1], 10) - 1;
  const isMonthlyActive = (e) => {
    if (e.recurrence === "yearly" && (e.recurrenceMonth ?? 0) !== selMonth)
      return false;
    if (e.recurrence === "quarterly") {
      const months = e.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(selMonth)) return false;
    }
    return true;
  };
  const abhavMonthly = (abhav?.expenses || [])
    .filter(
      (e) =>
        (!e.expenseType || e.expenseType === "monthly") && isMonthlyActive(e),
    )
    .reduce((s, x) => s + x.amount, 0);
  const abhavTrips = (abhav?.expenses || [])
    .filter(
      (e) =>
        e.expenseType === "trip" &&
        (e.startDate || e.date || "").slice(0, 7) === selectedMonth,
    )
    .reduce((s, x) => s + x.amount, 0);
  const abhavOnetime = (abhav?.expenses || [])
    .filter(
      (e) =>
        e.expenseType === "onetime" &&
        (e.date || "").slice(0, 7) === selectedMonth,
    )
    .reduce((s, x) => s + onetimeEffective(x), 0);
  const aanyaMonthly = (aanya?.expenses || [])
    .filter(
      (e) =>
        (!e.expenseType || e.expenseType === "monthly") && isMonthlyActive(e),
    )
    .reduce((s, x) => s + x.amount, 0);
  const aanyaTrips = (aanya?.expenses || [])
    .filter(
      (e) =>
        e.expenseType === "trip" &&
        (e.startDate || e.date || "").slice(0, 7) === selectedMonth,
    )
    .reduce((s, x) => s + x.amount, 0);
  const aanyaOnetime = (aanya?.expenses || [])
    .filter(
      (e) =>
        e.expenseType === "onetime" &&
        (e.date || "").slice(0, 7) === selectedMonth,
    )
    .reduce((s, x) => s + onetimeEffective(x), 0);
  const aHasData =
    aTxStats.income > 0 || aTxStats.expenses > 0 || aTxStats.investments > 0;
  const bHasData =
    bTxStats.income > 0 || bTxStats.expenses > 0 || bTxStats.investments > 0;
  const usingTxData = aHasData || bHasData;

  const hIncome = a.income + b.income;
  // Use standing budget for expenses (matches Budget page) so the number is
  // always the planned monthly total, not a mix of logged entries + standing.
  const hExpenses = aStanding.expenses + bStanding.expenses + sharedTripTotal;
  const hInvest = a.investments + b.investments;
  const hDebts = a.debts + b.debts;
  const hSavings = hIncome - hExpenses - hInvest - hDebts;
  const hSavingsRate =
    hIncome > 0
      ? Math.round(((hInvest + Math.max(0, hSavings)) / hIncome) * 100)
      : 0;
  const hCorpus20 = a.corpus20 + b.corpus20;

  // ── Live market data ────────────────────────────────────────────────────
  const allInv = [...(abhav?.investments || []), ...(aanya?.investments || [])];
  const {
    navMap,
    goldPrice,
    portfolio,
    gainLoss,
    loading: mktLoading,
    lastSync,
    refresh: refreshMarket,
  } = useMarketData(allInv);

  // ── Health score inputs ────────────────────────────────────────────────
  const hLiquidCash =
    (abhav?.savingsAccounts || []).reduce((s, x) => s + (x.balance || 0), 0) +
    (aanya?.savingsAccounts || []).reduce((s, x) => s + (x.balance || 0), 0);
  const hEmergencyMonths = hExpenses > 0 ? hLiquidCash / hExpenses : 0;
  const hInsAdequacy = insuranceAdequacy(
    [...(abhav?.insurances || []), ...(aanya?.insurances || [])],
    hIncome * 12,
  );

  const hHealthData = calcHealthScore({
    savingsRate: hSavingsRate,
    dti: hIncome > 0 ? hDebts / hIncome : 0,
    emergencyMonths: hEmergencyMonths,
    hasInvestments: hInvest > 0,
    insAdequate: hInsAdequacy.adequate,
  });
  const hScore = hHealthData.score;

  const aScore = calcHealthScore({
    savingsRate: a.savingsRate,
    dti: a.income > 0 ? a.debts / a.income : 0,
    emergencyMonths: hEmergencyMonths,
    hasInvestments: a.investments > 0,
    insAdequate: hInsAdequacy.adequate,
  }).score;
  const bScore = calcHealthScore({
    savingsRate: b.savingsRate,
    dti: b.income > 0 ? b.debts / b.income : 0,
    emergencyMonths: hEmergencyMonths,
    hasInvestments: b.investments > 0,
    insAdequate: hInsAdequacy.adequate,
  }).score;

  // Comparison bar data
  const compareData = [
    { label: "Income", abhav: a.income, aanya: b.income },
    { label: "Expenses", abhav: aStanding.expenses, aanya: bStanding.expenses },
    ...(sharedTripTotal > 0
      ? [
          {
            label: "Shared Trips",
            abhav: sharedTripTotal / 2,
            aanya: sharedTripTotal / 2,
          },
        ]
      : []),
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
      if (e.expenseType === "trip") {
        for (const item of e.items || []) {
          const cat = item.category || "Others";
          spendMap[cat] = (spendMap[cat] || 0) + (item.amount || 0);
        }
      } else {
        spendMap[e.category] = (spendMap[e.category] || 0) + e.amount;
      }
    });
  }
  // Include shared trips in spending pie (always — they're budgeted amounts)
  for (const trip of sharedTrips) {
    for (const item of trip.items || []) {
      const cat = item.category || "Others";
      spendMap[cat] = (spendMap[cat] || 0) + (item.amount || 0);
    }
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

  // ── Dashboard tab (persisted in localStorage) ───────────────────────────
  const [dashTab, setDashTab] = useState(() => {
    try {
      const saved = localStorage.getItem(DASH_TAB_LS);
      if (saved && DASH_TABS.some((t) => t.id === saved)) return saved;
    } catch {
      /* ignore */
    }
    return "pulse";
  });
  const [extraSIP, setExtraSIP] = useState(0); // for retirement scenario slider
  const switchTab = (id) => {
    setDashTab(id);
    localStorage.setItem(DASH_TAB_LS, id);
  };

  // Arrow-key navigation for tab bar
  const handleTabKey = (e, idx) => {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % DASH_TABS.length;
    else if (e.key === "ArrowLeft")
      next = (idx - 1 + DASH_TABS.length) % DASH_TABS.length;
    else return;
    e.preventDefault();
    switchTab(DASH_TABS[next].id);
    document.getElementById(`tab-${DASH_TABS[next].id}`)?.focus();
  };

  // ── Sparkline data (last 6 months income/expense/savings trend) ─────────
  const sparkMonths = months.slice(-6);
  const sparkData = sparkMonths.map((m) => {
    const aS = statsFromTxns(
      abhav?.transactions,
      abhav?.expenses,
      abhav?.incomes,
      m,
      abhav?.subscriptions,
    );
    const bS = statsFromTxns(
      aanya?.transactions,
      aanya?.expenses,
      aanya?.incomes,
      m,
      aanya?.subscriptions,
    );
    const aSt = personStats(abhav, m);
    const bSt = personStats(aanya, m);
    const inc = (aS.income || aSt.income) + (bS.income || bSt.income);
    const exp = (aS.expenses || aSt.expenses) + (bS.expenses || bSt.expenses);
    return { income: inc, expenses: exp, savings: inc - exp };
  });

  // ── Section renderers ───────────────────────────────────────────────────
  const _infoRow = (label, val, color) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "3px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: color || "#eeeae4" }}>
        {fmt(val)}
      </span>
    </div>
  );

  const sections = {
    metrics: (
      <div className="grid-4 section-gap">
        <div className="metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div className="metric-label">
              Combined Income
              <InfoModal title="Combined Income">
                {_infoRow("Abhav's income", aStanding.income, "var(--abhav)")}
                {_infoRow("Aanya's income", bStanding.income, "var(--aanya)")}
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 6,
                    paddingTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    color: "var(--green)",
                  }}
                >
                  <span>Total</span>
                  <span>{fmt(aStanding.income + bStanding.income)}</span>
                </div>
                {usingTxData && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: "#777",
                      fontStyle: "italic",
                    }}
                  >
                    Currently showing actual entries logged for the selected
                    month. Standing budget total:{" "}
                    {fmt(aStanding.income + bStanding.income)}.
                  </div>
                )}
              </InfoModal>
            </div>
            <TrendingUp
              size={14}
              color="var(--green)"
              style={{ opacity: 0.7, flexShrink: 0 }}
            />
          </div>
          <div className="metric-value" style={{ color: "var(--green)" }}>
            {fmt(hIncome)}
          </div>
          <Sparkline
            data={sparkData.map((d) => d.income)}
            color="var(--green)"
          />
        </div>

        <div className="metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div className="metric-label">
              Combined Expenses
              <InfoModal title="Combined Expenses">
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--abhav)",
                    marginBottom: 4,
                  }}
                >
                  Abhav — {fmt(aStanding.expenses)}
                </div>
                {_infoRow("  Monthly", abhavMonthly)}
                {abhavTrips > 0 && _infoRow("  Trips (personal)", abhavTrips)}
                {abhavOnetime > 0 && _infoRow("  One-time", abhavOnetime)}
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--aanya)",
                    marginTop: 8,
                    marginBottom: 4,
                  }}
                >
                  Aanya — {fmt(bStanding.expenses)}
                </div>
                {_infoRow("  Monthly", aanyaMonthly)}
                {aanyaTrips > 0 && _infoRow("  Trips (personal)", aanyaTrips)}
                {aanyaOnetime > 0 && _infoRow("  One-time", aanyaOnetime)}
                {sharedTripTotal > 0 && (
                  <>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--green)",
                        marginTop: 8,
                        marginBottom: 4,
                      }}
                    >
                      Shared Trips — {fmt(sharedTripTotal)}
                    </div>
                    {sharedTrips.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "2px 0",
                        }}
                      >
                        <span>🤝 {t.name}</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmt(t.amount || 0)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 8,
                    paddingTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    color: "var(--red)",
                  }}
                >
                  <span>Total</span>
                  <span>{fmt(hExpenses)}</span>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#777",
                    fontStyle: "italic",
                  }}
                >
                  Includes all monthly, trip, one-time expenses from both
                  persons + shared trips. This is the standing budget total.
                </div>
              </InfoModal>
            </div>
            <TrendingDown
              size={14}
              color="var(--red)"
              style={{ opacity: 0.7, flexShrink: 0 }}
            />
          </div>
          <div className="metric-value" style={{ color: "var(--red)" }}>
            {fmt(hExpenses)}
          </div>
          <Sparkline
            data={sparkData.map((d) => d.expenses)}
            color="var(--red)"
          />
        </div>

        <div className="metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div className="metric-label">
              Investing / month
              <InfoModal title="Monthly Investments">
                {_infoRow("Abhav's investments", a.investments, "var(--abhav)")}
                {_infoRow("Aanya's investments", b.investments, "var(--aanya)")}
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 6,
                    paddingTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    color: "var(--gold)",
                  }}
                >
                  <span>Total</span>
                  <span>{fmt(hInvest)}</span>
                </div>
              </InfoModal>
            </div>
            <TrendingUp
              size={14}
              color="var(--gold)"
              style={{ opacity: 0.7, flexShrink: 0 }}
            />
          </div>
          <div className="metric-value" style={{ color: "var(--gold)" }}>
            {fmt(hInvest)}
          </div>
        </div>

        <div className="metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div className="metric-label">
              Household Savings Rate
              <InfoModal title="Household Savings Rate">
                <p>Savings rate = (Investments + Surplus) / Income</p>
                {_infoRow("Income", hIncome, "var(--green)")}
                {_infoRow("Expenses", hExpenses, "var(--red)")}
                {_infoRow("Investments", hInvest, "var(--gold)")}
                {_infoRow("Debts / EMIs", hDebts)}
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 6,
                    paddingTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    color: hSavingsRate >= 20 ? "var(--green)" : "var(--gold)",
                  }}
                >
                  <span>Rate</span>
                  <span>{hSavingsRate}%</span>
                </div>
              </InfoModal>
            </div>
            {hSavingsRate >= 20 ? (
              <TrendingUp
                size={14}
                color="var(--green)"
                style={{ opacity: 0.7, flexShrink: 0 }}
              />
            ) : (
              <TrendingDown
                size={14}
                color="var(--gold)"
                style={{ opacity: 0.7, flexShrink: 0 }}
              />
            )}
          </div>
          <div
            className="metric-value"
            style={{
              color: hSavingsRate >= 20 ? "var(--green)" : "var(--gold)",
            }}
          >
            {hSavingsRate}%
          </div>
        </div>
      </div>
    ),

    healthcard: (() => {
      const { score, label, pillars } = hHealthData;
      const ringColor =
        score >= 80
          ? "var(--green)"
          : score >= 65
            ? "var(--gold)"
            : score >= 45
              ? "#f97316"
              : "var(--red)";
      return (
        <div
          className="card section-gap"
          style={{ border: `1px solid ${ringColor}22` }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Activity size={18} color={ringColor} />
            <span
              className="card-title"
              style={{ margin: 0, color: ringColor }}
            >
              Financial Health Score
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* Ring */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              <HealthRing score={score} />
              <div style={{ fontSize: 12, fontWeight: 600, color: ringColor }}>
                {label}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                out of 100
              </div>
            </div>
            {/* Pillars */}
            <div
              style={{
                flex: 1,
                minWidth: 220,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {pillars.map((p) => {
                const pct = Math.round((p.pts / p.maxPts) * 100);
                const pColor =
                  p.pts === p.maxPts
                    ? "var(--green)"
                    : p.pts > 0
                      ? "var(--gold)"
                      : "var(--red)";
                return (
                  <div key={p.key}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span>{p.emoji}</span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {p.label}
                        </span>
                      </span>
                      <span
                        style={{ fontSize: 11, color: pColor, fontWeight: 600 }}
                      >
                        {p.pts}/{p.maxPts} pts
                      </span>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        height: 5,
                        borderRadius: 3,
                        background: "var(--bg-card2)",
                      }}
                    >
                      <div
                        style={{
                          width: pct + "%",
                          height: "100%",
                          borderRadius: 3,
                          background: pColor,
                          transition: "width 0.5s",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {p.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {score < 100 && (
            <div
              style={{
                marginTop: 14,
                fontSize: 12,
                color: "var(--text-muted)",
                background: "var(--bg-card2)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              💡 Focus on{" "}
              <span style={{ color: "var(--gold)" }}>
                {pillars
                  .filter((p) => p.pts < p.maxPts)
                  .map((p) => p.label)
                  .slice(0, 2)
                  .join(" and ")}
              </span>{" "}
              to improve your score
            </div>
          )}
        </div>
      );
    })(),

    moneyplan: (() => {
      const allInvestments = [
        ...(abhav?.investments || []),
        ...(aanya?.investments || []),
      ];
      const allDebts = [...(abhav?.debts || []), ...(aanya?.debts || [])];
      const allIns = [
        ...(abhav?.insurances || []),
        ...(aanya?.insurances || []),
      ];
      const corpus = currentCorpus(allInvestments);
      const allInv80c = allInvestments;
      const unused80c = unused80C(allInv80c, allIns);
      const retireAge = shared?.profile?.retireAge || 60;
      const currentAge = shared?.profile?.currentAge || 30;
      const yearsToRetire = Math.max(1, retireAge - currentAge);
      const corpusNeeded = retirementCorpus(hExpenses, yearsToRetire);
      const corpusAtRetire = totalCorpus(corpus, hInvest, 12, yearsToRetire);

      // Rank opportunities by annual ₹ impact
      const opportunities = [];

      // 1. Idle cash > emergency need → move to liquid MF
      const emergencyNeed = hExpenses * 6;
      const excessCash = Math.max(0, hLiquidCash - emergencyNeed);
      if (excessCash > 25000) {
        const annualGain = Math.round(excessCash * 0.035); // 3.5% extra vs savings
        opportunities.push({
          impact: annualGain,
          emoji: "🏦",
          title: "Move idle cash to Liquid MF",
          desc: `${fmt(excessCash)} is sitting in savings earning ~3.5%. Move to a Liquid Fund (6–7%) — earn ${fmt(annualGain)} extra/year. Over 20 years that idle cash grows to ${fmtCr(Math.round(totalCorpus(excessCash, 0, 7, 20)))}.`,
          tag: "Easy win",
          tagColor: "var(--green)",
        });
      }

      // 2. 80C tax saving
      if (unused80c > 10000) {
        const taxSaved = Math.round(unused80c * 0.3);
        opportunities.push({
          impact: taxSaved,
          emoji: "💸",
          title: "Claim full 80C benefit",
          desc: `You have ${fmt(unused80c)} of unused 80C allowance. Invest in ELSS or top up PPF to save ${fmt(taxSaved)} in tax this year — that's money you get to keep.`,
          tag: "This year",
          tagColor: "var(--gold)",
        });
      }

      // 3. SIP increase if savings rate < 20%
      if (hSavingsRate < 20 && hIncome > 0) {
        const targetSIP = Math.round(hIncome * 0.2) - hInvest;
        if (targetSIP > 0) {
          const yr20Boost = Math.round(totalCorpus(0, targetSIP, 12, 20));
          opportunities.push({
            impact: Math.round(yr20Boost / 240), // monthly equivalent for sorting
            emoji: "📈",
            title: `Increase SIP by ${fmt(targetSIP)}/mo`,
            desc: `At ${hSavingsRate}% savings rate, adding ${fmt(targetSIP)}/mo brings you to 20%. That extra SIP compounds to ${fmtCr(yr20Boost)} in 20 years — a life-changing difference.`,
            tag: "High impact",
            tagColor: "var(--blue)",
          });
        }
      }

      // 4. Debt payoff saves interest
      const highRateDebt = allDebts.filter((d) => d.rate >= 10);
      if (highRateDebt.length > 0) {
        const annualInterest = highRateDebt.reduce(
          (s, d) => s + Math.round((d.outstanding * d.rate) / 100),
          0,
        );
        opportunities.push({
          impact: annualInterest,
          emoji: "✂️",
          title: "Prepay high-interest debt",
          desc: `Your ${highRateDebt.map((d) => d.name).join(", ")} (avg ${(highRateDebt.reduce((s, d) => s + d.rate, 0) / highRateDebt.length).toFixed(1)}% interest) cost you ${fmt(annualInterest)}/year in interest. Every extra rupee paid = guaranteed ${highRateDebt[0]?.rate}% return.`,
          tag: "Guaranteed return",
          tagColor: "#f97316",
        });
      }

      // 5. Retirement gap
      const retireGap = corpusNeeded - corpusAtRetire;
      if (retireGap > 0) {
        const extraSIP = Math.round(
          requiredSIP(retireGap, 12, yearsToRetire * 12),
        );
        opportunities.push({
          impact: Math.round(retireGap / (yearsToRetire * 12)),
          emoji: "🎯",
          title: "Close retirement gap",
          desc: `You need ${fmtCr(Math.round(corpusNeeded))} to retire at ${retireAge}. Currently on track for ${fmtCr(Math.round(corpusAtRetire))}. Adding ${fmt(extraSIP)}/mo SIP closes the gap.`,
          tag: `${yearsToRetire} yrs away`,
          tagColor: "var(--purple)",
        });
      }

      // 6. No investments at all
      if (hInvest === 0) {
        opportunities.push({
          impact: Math.round(totalCorpus(0, 5000, 12, 20)),
          emoji: "🚀",
          title: "Start your first SIP today",
          desc: `Even ${fmt(5000)}/mo in a Nifty 50 index fund grows to ${fmtCr(Math.round(totalCorpus(0, 5000, 12, 20)))} in 20 years at 12% returns. The best time to start was yesterday — the second best is now.`,
          tag: "Start here",
          tagColor: "var(--gold)",
        });
      }

      if (opportunities.length === 0) return null;
      opportunities.sort((a, b) => b.impact - a.impact);

      return (
        <div className="card section-gap">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Sparkles size={18} color="var(--gold)" />
            <span className="card-title" style={{ margin: 0 }}>
              Your Money Growth Plan
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 14,
            }}
          >
            Ranked by financial impact — each one is specific to your numbers
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {opportunities.map((op, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-card2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  borderLeft: `3px solid ${op.tagColor}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 18 }}>{op.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {op.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: op.tagColor + "22",
                      color: op.tagColor,
                      flexShrink: 0,
                    }}
                  >
                    {op.tag}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    paddingLeft: 26,
                  }}
                >
                  {op.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })(),

    wealthinsights: (() => {
      // ── Wealth Intelligence Calculations ──
      const allInvestments = [
        ...(abhav?.investments || []),
        ...(aanya?.investments || []),
      ];
      const allInsurances = [
        ...(abhav?.insurances || []),
        ...(aanya?.insurances || []),
      ];
      const corpus = currentCorpus(allInvestments);
      const annualExpenses = hExpenses * 12;
      const fire = fireRatio(corpus, annualExpenses);
      const allocation = assetAllocation(allInvestments);

      // Retirement: assume retire at 60, current age ~30 (configurable)
      const retireAge = shared?.profile?.retireAge || 60;
      const currentAge = shared?.profile?.currentAge || 30;
      const yearsToRetire = Math.max(1, retireAge - currentAge);
      const monthlyExpenseToday = hExpenses;
      const corpusNeeded = retirementCorpus(monthlyExpenseToday, yearsToRetire);
      const corpusAtRetire = totalCorpus(corpus, hInvest, 12, yearsToRetire);
      const retireGap = corpusNeeded - corpusAtRetire;
      const retireOnTrack = retireGap <= 0;
      const additionalSIPNeeded =
        retireGap > 0 ? requiredSIP(retireGap, 12, yearsToRetire * 12) : 0;

      // Unused 80C tax savings
      const allInv80c = [
        ...(abhav?.investments || []),
        ...(aanya?.investments || []),
      ];
      const allIns80c = [
        ...(abhav?.insurances || []),
        ...(aanya?.insurances || []),
      ];
      const unused80c = unused80C(allInv80c, allIns80c);
      const taxSavable = Math.round(unused80c * 0.3); // 30% slab assumed

      // Insurance adequacy
      const insAdequacy = insuranceAdequacy(allInsurances, hIncome * 12);

      // Idle cash detection
      const liquidCash =
        (abhav?.savingsAccounts || []).reduce(
          (s, a) => s + (a.balance || 0),
          0,
        ) +
        (aanya?.savingsAccounts || []).reduce(
          (s, a) => s + (a.balance || 0),
          0,
        );
      const emergencyNeed = hExpenses * 6;
      const excessCash = Math.max(0, liquidCash - emergencyNeed);

      // Smart recommendations
      const tips = [];
      if (unused80c > 10000)
        tips.push({
          icon: "💸",
          text: `Invest ${fmt(unused80c)} more in ELSS/PPF to save ~${fmt(taxSavable)} in tax`,
          priority: 1,
        });
      if (!retireOnTrack)
        tips.push({
          icon: "🎯",
          text: `Increase SIP by ${fmt(Math.round(additionalSIPNeeded))}/mo to hit retirement goal`,
          priority: 2,
        });
      if (excessCash > 50000)
        tips.push({
          icon: "�",
          text: `You have ${fmtCr(excessCash)} sitting idle in your savings account earning ~3.5% interest. Move it to a Liquid Mutual Fund (earns ~6–7%, withdraw anytime) or increase your monthly SIP to grow your wealth faster.`,
          priority: 3,
        });
      if (!insAdequacy.adequate)
        tips.push({
          icon: "🛡️",
          text: `Life cover gap of ${fmtCr(insAdequacy.gap)} — consider term insurance`,
          priority: 4,
        });
      if (allocation.equity > 75)
        tips.push({
          icon: "⚖️",
          text: `${allocation.equity}% in equity — consider diversifying to debt/gold`,
          priority: 5,
        });
      if (hSavingsRate < 20 && tips.length < 4)
        tips.push({
          icon: "📈",
          text: `Savings rate ${hSavingsRate}% — target 25%+ for faster wealth growth`,
          priority: 6,
        });

      const allocColors = {
        equity: "#5b9cf6",
        debt: "#4caf82",
        gold: "#c9a84c",
        other: "#9b7fe8",
      };

      return (
        <div
          className="card"
          style={{ border: "1px solid var(--gold-border)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Sparkles size={18} color="var(--gold)" />
            <span
              className="card-title"
              style={{ margin: 0, color: "var(--gold)" }}
            >
              Financial Snapshot
            </span>
          </div>

          {/* Top metrics row */}
          <div className="grid-4 section-gap" style={{ marginBottom: 16 }}>
            {/* FIRE Ratio */}
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <Flame
                  size={13}
                  color={fire >= 25 ? "var(--green)" : "var(--gold)"}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Financial Freedom
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color:
                    fire >= 25
                      ? "var(--green)"
                      : fire >= 10
                        ? "var(--gold)"
                        : "var(--red)",
                }}
              >
                {fire.toFixed(1)}×
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {fire >= 25
                  ? "Your investments can cover all expenses! 🎉"
                  : fire >= 10
                    ? "Good progress — keep growing your investments"
                    : "Keep investing every month — it compounds fast"}
              </div>
            </div>

            {/* Retirement readiness */}
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <Target
                  size={13}
                  color={retireOnTrack ? "var(--green)" : "var(--red)"}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Retirement by {retireAge}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: retireOnTrack ? "var(--green)" : "var(--gold)",
                }}
              >
                {retireOnTrack ? "On Track ✓" : fmtCr(Math.round(retireGap))}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {retireOnTrack
                  ? `Projected to have ${fmtCr(Math.round(corpusAtRetire))}`
                  : `Short by this amount — add ${fmt(Math.round(additionalSIPNeeded))}/mo SIP`}
              </div>
            </div>

            {/* Tax savings opportunity */}
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <PiggyBank
                  size={13}
                  color={unused80c > 0 ? "var(--gold)" : "var(--green)"}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Tax Savings Left
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: unused80c > 0 ? "var(--gold)" : "var(--green)",
                }}
              >
                {unused80c > 0 ? fmt(unused80c) : "All used ✓"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {unused80c > 0
                  ? `Invest this in ELSS/PPF to save ~${fmt(taxSavable)} tax this year`
                  : "You've used your full ₹1.5L tax benefit"}
              </div>
            </div>

            {/* Insurance cover */}
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <ShieldCheck
                  size={13}
                  color={insAdequacy.adequate ? "var(--green)" : "var(--red)"}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Life Insurance
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: insAdequacy.adequate ? "var(--green)" : "var(--red)",
                }}
              >
                {insAdequacy.currentCover > 0
                  ? fmtCr(insAdequacy.currentCover)
                  : "None"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {insAdequacy.adequate
                  ? "Your family is protected"
                  : insAdequacy.gap > 0
                    ? `Cover gap of ${fmtCr(insAdequacy.gap)} — consider term plan`
                    : "No life cover — add a term insurance plan"}
              </div>
            </div>
          </div>

          {/* Asset allocation bar */}
          {allocation.total > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Where your money is invested</span>
                <span style={{ color: "var(--text-muted)" }}>
                  Total: {fmtCr(allocation.total)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 10,
                  borderRadius: 6,
                  overflow: "hidden",
                  gap: 2,
                }}
              >
                {["equity", "debt", "gold", "other"]
                  .filter((k) => allocation[k] > 0)
                  .map((k) => (
                    <div
                      key={k}
                      style={{
                        flex: allocation[k],
                        background: allocColors[k],
                        borderRadius: 3,
                      }}
                      title={`${k}: ${allocation[k]}%`}
                    />
                  ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {["equity", "debt", "gold", "other"]
                  .filter((k) => allocation[k] > 0)
                  .map((k) => (
                    <span
                      key={k}
                      style={{ fontSize: 11, color: "var(--text-muted)" }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: allocColors[k],
                          marginRight: 4,
                          verticalAlign: "middle",
                        }}
                      />
                      {k.charAt(0).toUpperCase() + k.slice(1)} {allocation[k]}%
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Portfolio Returns */}
          {gainLoss.totalInvested > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  How your investments have grown
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Invested {fmtCr(gainLoss.totalInvested)} → Current{" "}
                  {fmtCr(gainLoss.totalCurrent)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    color:
                      gainLoss.absoluteGain >= 0
                        ? "var(--green)"
                        : "var(--red)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  {gainLoss.absoluteGain >= 0 ? "+" : ""}
                  {fmtCr(Math.round(gainLoss.absoluteGain))}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color:
                      gainLoss.percentGain >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {gainLoss.percentGain >= 0 ? "+" : ""}
                  {gainLoss.percentGain.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Smart recommendations */}
          {tips.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                Things you can do right now
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tips
                  .sort((a, b) => a.priority - b.priority)
                  .slice(0, 4)
                  .map((tip, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "rgba(201,168,76,0.06)",
                        border: "1px solid rgba(201,168,76,0.12)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>
                        {tip.icon}
                      </span>
                      <span>{tip.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Retirement projection detail */}
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.8,
            }}
          >
            <strong style={{ color: "var(--text-secondary)" }}>
              How was this calculated?
            </strong>
            <br />
            Your current monthly expenses are {fmt(monthlyExpenseToday)}. By the
            time you turn {retireAge}, inflation will push that to{" "}
            {fmt(
              Math.round(monthlyExpenseToday * Math.pow(1.06, yearsToRetire)),
            )}
            /month. You'll need a total investment pool of{" "}
            {fmtCr(Math.round(corpusNeeded))} to retire comfortably. At your
            current SIP pace, you'll have {fmtCr(Math.round(corpusAtRetire))} —
            so{" "}
            {retireOnTrack
              ? "you're on track! 🎉"
              : "you need to invest a bit more each month."}
            .
            <br />
            Current investments: {fmtCr(corpus)} · Monthly SIPs: {fmt(hInvest)}
            Current invested corpus: {fmtCr(corpus)} · Monthly SIPs:{" "}
            {fmt(hInvest)}
          </div>
        </div>
      );
    })(),

    marketpulse: (
      <div
        className="card"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} color="#5b9cf6" />
            <span
              className="card-title"
              style={{ margin: 0, color: "#5b9cf6" }}
            >
              Market Pulse
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastSync && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Synced{" "}
                {lastSync.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              className="btn-ghost"
              onClick={refreshMarket}
              disabled={mktLoading}
              style={{ padding: "2px 6px", opacity: mktLoading ? 0.5 : 1 }}
              title="Refresh market data"
              aria-label="Refresh market data"
            >
              <RefreshCw size={13} className={mktLoading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Portfolio overview row */}
        <div className="grid-4 section-gap" style={{ marginBottom: 16 }}>
          {/* Total Portfolio */}
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              Portfolio Value
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color: "var(--text-primary)",
              }}
            >
              {fmtCr(gainLoss.totalCurrent)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Invested: {fmtCr(gainLoss.totalInvested)}
            </div>
          </div>

          {/* Total Gain/Loss */}
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              Total Returns
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color:
                  gainLoss.absoluteGain >= 0 ? "var(--green)" : "var(--red)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {gainLoss.absoluteGain >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              {fmtCr(Math.abs(Math.round(gainLoss.absoluteGain)))}
            </div>
            <div
              style={{
                fontSize: 10,
                color:
                  gainLoss.percentGain >= 0 ? "var(--green)" : "var(--red)",
              }}
            >
              {gainLoss.percentGain >= 0 ? "+" : ""}
              {gainLoss.percentGain.toFixed(1)}% overall
            </div>
          </div>

          {/* MF NAV Coverage */}
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              Live MF NAVs
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color:
                  portfolio.mfLiveCount > 0 ? "#5b9cf6" : "var(--text-muted)",
              }}
            >
              {portfolio.mfLiveCount}/{portfolio.mfTotalCount}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {portfolio.mfLiveCount > 0
                ? "schemes with live NAV"
                : "Add scheme codes to track"}
            </div>
          </div>

          {/* Gold Price */}
          <div
            style={{
              background: "var(--bg-card2)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              Gold Spot
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color: "var(--gold)",
              }}
            >
              {goldPrice
                ? `₹${goldPrice.pricePerGram.toLocaleString("en-IN")}`
                : "—"}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {goldPrice ? `per gram · ${goldPrice.date}` : "Fetching…"}
            </div>
          </div>
        </div>

        {/* Per-MF NAV table */}
        {navMap.size > 0 &&
          (() => {
            const mfInvs = allInv.filter(
              (inv) =>
                inv.type === "Mutual Fund" &&
                inv.schemeCode &&
                navMap.has(inv.schemeCode),
            );
            if (!mfInvs.length) return null;
            return (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Mutual Fund NAVs</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {mfInvs.length} fund{mfInvs.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div
                  style={{
                    background: "var(--bg-card2)",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                  }}
                >
                  {mfInvs.map((inv) => {
                    const nd = navMap.get(inv.schemeCode);
                    const invested = Number(inv.totalInvested) || 0;
                    const current = inv.existingCorpus || 0;
                    const gain = current - invested;
                    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
                    return (
                      <div
                        key={inv.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderBottom: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "var(--text-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {inv.name}
                          </div>
                          <div
                            style={{ color: "var(--text-muted)", fontSize: 10 }}
                          >
                            NAV ₹{nd.nav} · {nd.date}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            flexShrink: 0,
                            marginLeft: 12,
                          }}
                        >
                          <div
                            style={{
                              color: "var(--text-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {fmt(current)}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: gain >= 0 ? "var(--green)" : "var(--red)",
                            }}
                          >
                            {gain >= 0 ? "+" : ""}
                            {fmt(Math.round(gain))} ({gainPct >= 0 ? "+" : ""}
                            {gainPct.toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
      </div>
    ),

    cashflow: (
      <MonthlyCashFlow
        abhav={abhav}
        aanya={aanya}
        shared={shared}
        selectedMonth={selectedMonth}
      />
    ),

    persons: (
      <>
        <RaiseNudge abhav={abhav} aanya={aanya} personNames={personNames} />
        <div className="grid-2 section-gap">
          {[
            {
              name: personNames?.abhav || "Person 1",
              stats: a,
              score: aScore,
              color: "var(--abhav)",
              dim: "var(--abhav-dim)",
            },
            {
              name: personNames?.aanya || "Person 2",
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
                  {a.savingsRate >= b.savingsRate
                    ? personNames?.abhav || "Person 1"
                    : personNames?.aanya || "Person 2"}
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
                {personNames?.abhav || "Person 1"}:{" "}
                <strong style={{ color: "var(--abhav)" }}>
                  {a.savingsRate}%
                </strong>{" "}
                &nbsp;·&nbsp; {personNames?.aanya || "Person 2"}:{" "}
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
          <div className="card-title">
            {personNames?.abhav || "Person 1"} vs{" "}
            {personNames?.aanya || "Person 2"}
          </div>
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
              {personNames?.abhav || "Person 1"}
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
              {personNames?.aanya || "Person 2"}
            </span>
          </div>
          <div style={{ height: 180 }}>
            <Chart
              categories={compareData.map((d) => d.label)}
              series={[
                {
                  name: personNames?.abhav || "Person 1",
                  type: "bar",
                  data: compareData.map((d) => d.abhav),
                  color: "#5b9cf6",
                },
                {
                  name: personNames?.aanya || "Person 2",
                  type: "bar",
                  data: compareData.map((d) => d.aanya),
                  color: "#d46eb3",
                },
              ]}
              fmt={fmt}
            />
          </div>
        </div>

        {/* Spending pie */}
        <div className="card">
          <div className="card-title">Combined Spending</div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <DonutChart
              data={pieData.map((d) => ({
                name: d.name,
                value: d.value,
                color: d.fill,
              }))}
              fmt={fmt}
              width={110}
              height={110}
              style={{ flexShrink: 0 }}
            />
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

    personCards: (
      <div className="grid-2 section-gap">
        {[
          {
            key: "abhav",
            stats: a,
            standing: aStanding,
            color: "var(--abhav)",
            score: aScore,
          },
          {
            key: "aanya",
            stats: b,
            standing: bStanding,
            color: "var(--aanya)",
            score: bScore,
          },
        ].map(({ key, stats, standing, color, score }) => (
          <div
            className="card"
            key={key}
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color }}>
                {personNames?.[key] || key}
              </div>
              <HealthRing score={score} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Income</span>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>
                  {fmt(standing.income)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Expenses</span>
                <span style={{ color: "var(--red)", fontWeight: 600 }}>
                  {fmt(standing.expenses)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Investments</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(stats.investments)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Debts/EMIs</span>
                <span style={{ fontWeight: 600 }}>{fmt(stats.debts)}</span>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 600 }}>Savings rate</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      standing.savingsRate >= 20
                        ? "var(--green)"
                        : "var(--gold)",
                  }}
                >
                  {standing.savingsRate}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),

    monthcompare: prevHasData
      ? (() => {
          const curIncome = aTxStats.income + bTxStats.income;
          const curExp = aTxStats.expenses + bTxStats.expenses;
          const curInvest = aTxStats.investments + bTxStats.investments;
          const curSavings = curIncome - curExp - curInvest;
          const prvIncome = aPrevTx.income + bPrevTx.income;
          const prvExp = aPrevTx.expenses + bPrevTx.expenses;
          const prvInvest = aPrevTx.investments + bPrevTx.investments;
          const prvSavings = prvIncome - prvExp - prvInvest;
          const [pY, pM] = prevYm.split("-");
          const prevLabel = `${MONTH_NAMES[parseInt(pM, 10) - 1]} ${pY}`;
          const rows = [
            { label: "Income", cur: curIncome, prev: prvIncome },
            { label: "Expenses", cur: curExp, prev: prvExp },
            { label: "Investments", cur: curInvest, prev: prvInvest },
            { label: "Net Savings", cur: curSavings, prev: prvSavings },
          ];
          return (
            <div className="card section-gap">
              <div className="card-title">Month over Month</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                {selLabel} vs {prevLabel}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: "10px 16px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  Category
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textAlign: "right",
                  }}
                >
                  {prevLabel}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textAlign: "right",
                  }}
                >
                  {selLabel}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                  }}
                >
                  Change
                </span>
                {rows.map((r) => {
                  const delta = r.cur - r.prev;
                  const pct =
                    r.prev > 0
                      ? Math.round((delta / r.prev) * 100)
                      : r.cur > 0
                        ? 100
                        : 0;
                  const isGood =
                    r.label === "Expenses" ? delta <= 0 : delta >= 0;
                  return [
                    <span key={r.label + "l"} style={{ fontSize: 13 }}>
                      {r.label}
                    </span>,
                    <span
                      key={r.label + "p"}
                      style={{
                        fontSize: 13,
                        textAlign: "right",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {fmt(r.prev)}
                    </span>,
                    <span
                      key={r.label + "c"}
                      style={{
                        fontSize: 13,
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {fmt(r.cur)}
                    </span>,
                    <span
                      key={r.label + "d"}
                      style={{
                        fontSize: 12,
                        textAlign: "center",
                        color: isGood ? "var(--green)" : "var(--red)",
                        fontWeight: 500,
                      }}
                    >
                      {delta === 0
                        ? "—"
                        : `${delta > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`}
                    </span>,
                  ];
                })}
              </div>
            </div>
          );
        })()
      : null,

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

    emergency: <EmergencyFundCard abhav={abhav} aanya={aanya} />,

    cashforecast: (() => {
      const hInc = aStanding.income + bStanding.income;
      const hExp = aStanding.expenses + bStanding.expenses;
      const hInv = aStanding.investments + bStanding.investments;
      const hDebt = aStanding.debts + bStanding.debts;
      const monthlyNet = hInc - hExp - hInv - hDebt;
      const liquid =
        (abhav?.assets || [])
          .filter((a) => a.type === "cash" || a.type === "savings")
          .reduce((s, a) => s + (a.value || 0), 0) +
        (aanya?.assets || [])
          .filter((a) => a.type === "cash" || a.type === "savings")
          .reduce((s, a) => s + (a.value || 0), 0) +
        (abhav?.savingsAccounts || []).reduce(
          (s, a) => s + (a.balance || 0),
          0,
        ) +
        (aanya?.savingsAccounts || []).reduce(
          (s, a) => s + (a.balance || 0),
          0,
        );
      const MONTHS = [
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
      const now = new Date();
      const forecastData = [];
      let cumBal = liquid;
      for (let i = 0; i < 6; i++) {
        const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
        cumBal += monthlyNet;
        forecastData.push({
          month: `${MONTHS[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`,
          balance: Math.round(cumBal),
          income: Math.round(hInc),
          outflow: Math.round(hExp + hInv + hDebt),
        });
      }
      const minBal = Math.min(...forecastData.map((d) => d.balance));
      return (
        <div className="card">
          <div className="card-title">📈 6-Month Cash Flow Forecast</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Based on current income, expenses, SIPs & EMIs
          </div>
          <div style={{ height: 200 }}>
            <Chart
              categories={forecastData.map((d) => d.month)}
              series={[
                {
                  name: "Balance",
                  type: "area",
                  data: forecastData.map((d) => d.balance),
                  color: minBal < 0 ? "#ef5350" : "#4caf82",
                  areaOpacity: 0.3,
                },
              ]}
              fmt={fmt}
              grid={{ top: 8, right: 8, left: 8 }}
            />
          </div>
          {minBal < 0 && (
            <div
              className="tip"
              style={{
                background: "rgba(239,83,80,0.08)",
                borderColor: "rgba(239,83,80,0.3)",
                marginTop: 8,
              }}
            >
              ⚠️ Cash balance goes negative by{" "}
              {forecastData.find((d) => d.balance < 0)?.month}. Review spending
              or boost income.
            </div>
          )}
          {monthlyNet > 0 && minBal >= 0 && (
            <div className="tip" style={{ marginTop: 8 }}>
              💡 Surplus of {fmt(Math.round(monthlyNet))}/mo — consider
              increasing SIPs or prepaying a loan.
            </div>
          )}
        </div>
      );
    })(),
  };

  // ── Savings Rate Trend ─────────────────────────────────────────────────────
  const savingsRateTrendSection = (() => {
    const nwHist = shared?.netWorthHistory || [];
    let trendPoints = [];
    if (nwHist.length >= 2) {
      trendPoints = nwHist.slice(-8).map((s) => ({
        label: s.label || `${s.month}/${String(s.year).slice(2)}`,
        rate: s.savingsRate ?? hSavingsRate,
      }));
    }
    if (trendPoints.length < 2) {
      trendPoints = sparkData.map((d, i) => {
        const m = sparkMonths[i];
        const [y, mo] = m.split("-");
        const label = `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
        const rate =
          d.income > 0
            ? Math.round((Math.max(0, d.income - d.expenses) / d.income) * 100)
            : 0;
        return { label, rate };
      });
    }
    if (trendPoints.length < 2) return null;
    const avg = Math.round(
      trendPoints.reduce((s, p) => s + p.rate, 0) / trendPoints.length,
    );
    const latest = trendPoints[trendPoints.length - 1].rate;
    const trend = latest - trendPoints[0].rate;
    return (
      <div className="card section-gap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            📊 Savings Rate Trend
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>
              Avg: <strong style={{ color: "var(--gold)" }}>{avg}%</strong>
            </span>
            <span style={{ color: trend >= 0 ? "var(--green)" : "var(--red)" }}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% over period
            </span>
          </div>
        </div>
        <div style={{ height: 160 }}>
          <Chart
            categories={trendPoints.map((p) => p.label)}
            series={[
              {
                name: "Savings Rate %",
                type: "line",
                data: trendPoints.map((p) => p.rate),
                color: latest >= 20 ? "#4caf82" : "#c9a84c",
                symbol: "circle",
              },
              {
                name: "Target 20%",
                type: "line",
                data: trendPoints.map(() => 20),
                color: "#5b9cf655",
                lineStyle: { type: "dashed" },
                symbol: "none",
              },
            ]}
            fmt={(v) => `${v}%`}
            grid={{ top: 12, right: 8 }}
          />
        </div>
        <div className="tip" style={{ marginTop: 8 }}>
          {latest >= 20
            ? `✅ You're at ${latest}% savings rate — above the 20% target.`
            : `💡 Current rate is ${latest}%. Reaching 20% would add ${fmt(Math.round(hIncome * 0.2 - hInvest))} more/mo to investments.`}
        </div>
      </div>
    );
  })();

  // ── Fund Fee Drain Calculator ──────────────────────────────────────────────
  const feeDrainSection = (() => {
    const allInvestments = [
      ...(abhav?.investments || []),
      ...(aanya?.investments || []),
    ];
    const DEFAULT_ER = {
      "Mutual Fund": 1.2,
      "Index Fund": 0.15,
      ELSS: 1.5,
      ETF: 0.07,
      SIP: 1.0,
    };
    const fundsWithFees = allInvestments
      .map((inv) => {
        const corp = inv.existingCorpus || 0;
        const er =
          inv.expenseRatio != null
            ? Number(inv.expenseRatio)
            : DEFAULT_ER[inv.type] || 0;
        return {
          ...inv,
          er,
          annualFee: Math.round((corp * er) / 100),
          corpus: corp,
        };
      })
      .filter((inv) => inv.corpus > 0);

    if (fundsWithFees.length === 0) return null;

    const totalCorpusAll = fundsWithFees.reduce((s, f) => s + f.corpus, 0);
    const totalAnnualFee = fundsWithFees.reduce((s, f) => s + f.annualFee, 0);
    const blendedER =
      totalCorpusAll > 0
        ? ((totalAnnualFee / totalCorpusAll) * 100).toFixed(2)
        : 0;
    const feeLostOver20yr = Math.round(
      totalCorpus(0, totalAnnualFee / 12, 12, 20),
    );

    return (
      <div className="card section-gap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 18 }}>💸</span>
          <span className="card-title" style={{ margin: 0 }}>
            Fund Fee Drain
          </span>
        </div>
        <div className="grid-3 section-gap" style={{ marginBottom: 16 }}>
          {[
            {
              label: "Annual fees paid",
              value: fmt(totalAnnualFee),
              color: "var(--red)",
              sub: `${fundsWithFees.length} investments`,
            },
            {
              label: "Blended expense ratio",
              value: `${blendedER}%`,
              color: Number(blendedER) > 1 ? "var(--red)" : "var(--gold)",
              sub:
                Number(blendedER) > 1
                  ? "above average — review"
                  : "acceptable range",
            },
            {
              label: "20-yr opportunity cost",
              value: fmtCr(feeLostOver20yr),
              color: "var(--red)",
              sub: "if fees were invested instead",
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: m.color,
                }}
              >
                {m.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {m.sub}
              </div>
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: "6px 12px",
              fontSize: 12,
              alignItems: "center",
              minWidth: 380,
            }}
          >
            {["Fund", "Corpus", "Exp Ratio", "Annual Fee"].map((h) => (
              <span
                key={h}
                style={{
                  color: "var(--text-muted)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  textAlign: h === "Fund" ? "left" : "right",
                }}
              >
                {h}
              </span>
            ))}
            {[...fundsWithFees]
              .sort((a, b) => b.annualFee - a.annualFee)
              .map((f) => [
                <span
                  key={`n-${f.id}`}
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={f.name}
                >
                  {f.name}
                  {f.expenseRatio == null && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: 10,
                        marginLeft: 4,
                      }}
                    >
                      *est
                    </span>
                  )}
                </span>,
                <span
                  key={`c-${f.id}`}
                  style={{ textAlign: "right", color: "var(--text-secondary)" }}
                >
                  {fmt(f.corpus)}
                </span>,
                <span
                  key={`e-${f.id}`}
                  style={{
                    textAlign: "right",
                    color: f.er > 1 ? "var(--red)" : "var(--green)",
                    fontWeight: 500,
                  }}
                >
                  {f.er.toFixed(2)}%
                </span>,
                <span
                  key={`f-${f.id}`}
                  style={{
                    textAlign: "right",
                    color: "var(--red)",
                    fontWeight: 600,
                  }}
                >
                  {fmt(f.annualFee)}
                </span>,
              ])}
          </div>
        </div>
        <div className="tip" style={{ marginTop: 12 }}>
          * Estimated from fund type where not entered.
          {Number(blendedER) > 0.5 &&
            ` 💡 Switching high-ER funds to index funds (0.1–0.2%) could save ${fmt(Math.round(totalAnnualFee * 0.8))}/year.`}
        </div>
      </div>
    );
  })();

  // ── Retirement Scenario Planner ───────────────────────────────────────────
  const retirementScenarioSection = (() => {
    const allInvestments = [
      ...(abhav?.investments || []),
      ...(aanya?.investments || []),
    ];
    const corp = currentCorpus(allInvestments);
    const retireAge = shared?.profile?.retireAge || 60;
    const currentAge = shared?.profile?.currentAge || 30;
    const yearsToRetire = Math.max(1, retireAge - currentAge);
    const corpusNeeded = retirementCorpus(hExpenses, yearsToRetire);
    const baseSIP = hInvest + extraSIP;

    const calcRetireYears = (sip) => {
      for (let y = 1; y <= 50; y++) {
        if (totalCorpus(corp, sip, 12, y) >= corpusNeeded) return y;
      }
      return null;
    };
    const baseRetireYears = calcRetireYears(baseSIP);
    const baseRetireAge = baseRetireYears ? currentAge + baseRetireYears : null;
    const corpusAtTarget = Math.round(
      totalCorpus(corp, baseSIP, 12, yearsToRetire),
    );
    const gapAtTarget = Math.round(corpusNeeded - corpusAtTarget);
    const onTrack = gapAtTarget <= 0;

    const scenarioYears = Math.min(yearsToRetire + 5, 35);
    const scenarioLabels = [];
    const scenarioBase = [];
    const scenarioBoosted = [];
    for (let y = 0; y <= scenarioYears; y += 2) {
      scenarioLabels.push(String(currentAge + y));
      scenarioBase.push(Math.round(totalCorpus(corp, hInvest, 12, y)));
      if (extraSIP > 0) {
        scenarioBoosted.push(Math.round(totalCorpus(corp, baseSIP, 12, y)));
      }
    }

    const steps = [0, 2000, 5000, 10000, 15000, 20000, 30000, 50000];

    return (
      <div className="card section-gap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 18 }}>🎯</span>
          <span className="card-title" style={{ margin: 0 }}>
            Retirement Scenario Planner
          </span>
        </div>
        <div
          style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}
        >
          Retire at {retireAge} · Current age {currentAge} · Need{" "}
          {fmtCr(Math.round(corpusNeeded))}
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Extra SIP / month
            </span>
            <span style={{ fontWeight: 700, color: "var(--gold)" }}>
              {extraSIP === 0 ? "Current SIPs only" : `+ ${fmt(extraSIP)}/mo`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50000}
            step={500}
            value={extraSIP}
            onChange={(e) => setExtraSIP(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gold)" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            <span>₹0</span>
            <span>₹50,000</span>
          </div>
        </div>

        {/* Quick chips */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {steps.map((s) => (
            <button
              key={s}
              onClick={() => setExtraSIP(s)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 20,
                background:
                  extraSIP === s ? "var(--gold-dim)" : "var(--bg-card2)",
                border: `1px solid ${extraSIP === s ? "var(--gold-border)" : "var(--border)"}`,
                color: extraSIP === s ? "var(--gold)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: extraSIP === s ? 600 : 400,
              }}
            >
              {s === 0 ? "Current" : `+${fmt(s)}`}
            </button>
          ))}
        </div>

        {/* Result callout */}
        <div
          style={{
            background: onTrack
              ? "rgba(76,175,130,0.1)"
              : extraSIP > 0
                ? "rgba(201,168,76,0.1)"
                : "rgba(239,83,80,0.08)",
            border: `1px solid ${onTrack ? "rgba(76,175,130,0.3)" : extraSIP > 0 ? "var(--gold-border)" : "rgba(239,83,80,0.25)"}`,
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {onTrack ? (
            <div style={{ fontWeight: 600, color: "var(--green)" }}>
              ✅ On track! You'll have {fmtCr(corpusAtTarget)} by age{" "}
              {retireAge} — {fmtCr(Math.abs(gapAtTarget))} above target.
              {baseRetireAge && baseRetireAge < retireAge && (
                <span>
                  {" "}
                  You could retire at <strong>{baseRetireAge}</strong>!
                </span>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {extraSIP > 0 ? (
                  <>
                    +{fmt(extraSIP)}/mo → {fmtCr(corpusAtTarget)} by {retireAge}
                    {gapAtTarget > 0 && (
                      <span style={{ color: "var(--red)" }}>
                        {" "}
                        — {fmtCr(gapAtTarget)} short
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Current pace: {fmtCr(corpusAtTarget)} by {retireAge}
                    <span style={{ color: "var(--red)" }}>
                      {" "}
                      — {fmtCr(gapAtTarget)} short
                    </span>
                  </>
                )}
              </div>
              {baseRetireAge && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  You'll hit target at age{" "}
                  <strong style={{ color: "var(--gold)" }}>
                    {baseRetireAge}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ height: 180 }}>
          <Chart
            categories={scenarioLabels}
            series={[
              {
                name: "Current SIPs",
                type: "line",
                data: scenarioBase,
                color: "#5b9cf6",
                symbol: "circle",
              },
              ...(extraSIP > 0
                ? [
                    {
                      name: `+${fmt(extraSIP)}/mo`,
                      type: "line",
                      data: scenarioBoosted,
                      color: "#4caf82",
                      symbol: "circle",
                    },
                  ]
                : []),
              {
                name: "Target corpus",
                type: "line",
                data: scenarioLabels.map(() => Math.round(corpusNeeded)),
                color: "#c9a84c44",
                lineStyle: { type: "dashed" },
                symbol: "none",
              },
            ]}
            fmt={fmtCr}
            grid={{ top: 8, right: 8 }}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          X-axis = age · assumes 12% annual returns
        </div>
      </div>
    );
  })();

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
          <MonthlySummary
            abhav={abhav}
            aanya={aanya}
            shared={shared}
            personNames={personNames}
          />

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

      {/* ── Hero Metrics (always visible) ── */}
      {sections.metrics}

      {/* ── Tab Bar ── */}
      <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
        {DASH_TABS.map((t, i) => (
          <button
            key={t.id}
            className={`dash-tab${dashTab === t.id ? " active" : ""}`}
            onClick={() => switchTab(t.id)}
            onKeyDown={(e) => handleTabKey(e, i)}
            role="tab"
            aria-selected={dashTab === t.id}
            aria-controls={`tabpanel-${t.id}`}
            id={`tab-${t.id}`}
            tabIndex={dashTab === t.id ? 0 : -1}
          >
            <span style={{ marginRight: 5 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div
        className="dash-tab-content"
        key={dashTab}
        role="tabpanel"
        id={`tabpanel-${dashTab}`}
        aria-labelledby={`tab-${dashTab}`}
      >
        {dashTab === "pulse" && (
          <>
            {sections.cashflow}
            {sections.comparison}
            {sections.goals}
          </>
        )}

        {dashTab === "people" && (
          <>
            {sections.persons}
            {sections.monthcompare}
          </>
        )}

        {dashTab === "wealth" && (
          <>
            {sections.healthcard}
            {sections.moneyplan}
            {retirementScenarioSection}
            {savingsRateTrendSection}
            {feeDrainSection}
            {sections.wealthinsights}
            {sections.marketpulse}
            {sections.projection}
            {sections.emergency}
            {sections.cashforecast}
          </>
        )}
      </div>
    </div>
  );
}
