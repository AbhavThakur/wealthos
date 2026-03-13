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
  fmt,
  fmtCr,
  totalCorpus,
  lumpCorpus,
  CAT_COLORS,
  freqToMonthly,
} from "../utils/finance";
import { TrendingUp, TrendingDown } from "lucide-react";

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

function buildCashFlow(abhavTxns, aanyaTxns) {
  const map = {}; // key: "2026-03" → { income, expenses, investments, emis }

  const process = (txns) => {
    for (const t of txns || []) {
      if (!t.date) continue;
      const ym = t.date.slice(0, 7); // "YYYY-MM"
      if (!map[ym])
        map[ym] = { income: 0, expenses: 0, investments: 0, emis: 0 };
      const amt = Math.abs(t.amount);
      if (t.amount > 0) {
        map[ym].income += amt;
      } else if (t.type === "investment") {
        map[ym].investments += amt;
      } else if (t.category === "EMI") {
        map[ym].emis += amt;
      } else {
        map[ym].expenses += amt;
      }
    }
  };

  process(abhavTxns);
  process(aanyaTxns);

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, d]) => {
      const [y, m] = ym.split("-");
      const net = d.income - d.expenses - d.investments - d.emis;
      return {
        label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`,
        ym,
        ...d,
        outflows: d.expenses + d.investments + d.emis,
        net,
      };
    });
}

function MonthlyCashFlow({ abhav, aanya }) {
  const data = buildCashFlow(abhav?.transactions, aanya?.transactions);
  if (data.length === 0) return null;

  // Savings streak: consecutive months with positive net (from latest)
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].net > 0) streak++;
    else break;
  }

  const latest = data[data.length - 1];

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
      {latest && (
        <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
          <div className="metric-card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Income
            </div>
            <div
              style={{ fontSize: 15, fontWeight: 600, color: "var(--green)" }}
            >
              {fmt(latest.income)}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Expenses
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--red)" }}>
              {fmt(latest.expenses)}
            </div>
          </div>
          <div className="metric-card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Invest + EMIs
            </div>
            <div
              style={{ fontSize: 15, fontWeight: 600, color: "var(--gold)" }}
            >
              {fmt(latest.investments + latest.emis)}
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
                color: latest.net >= 0 ? "var(--green)" : "var(--red)",
              }}
            >
              {latest.net >= 0 ? "+" : "−"}
              {fmt(Math.abs(latest.net))}
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
          <div
            key={d.ym}
            className="data-row"
            style={{
              padding: "8px 4px",
              minWidth: 480,
              borderRadius: 4,
            }}
          >
            <span style={{ width: 60, fontWeight: 500 }}>{d.label}</span>
            <span
              style={{ flex: 1, textAlign: "right", color: "var(--green)" }}
            >
              {fmt(d.income)}
            </span>
            <span style={{ flex: 1, textAlign: "right", color: "var(--red)" }}>
              {fmt(d.expenses)}
            </span>
            <span style={{ flex: 1, textAlign: "right", color: "var(--gold)" }}>
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

export default function Dashboard({ abhav, aanya, shared }) {
  const a = personStats(abhav);
  const b = personStats(aanya);

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

  // Spending pie combined
  const spendMap = {};
  [...(abhav?.expenses || []), ...(aanya?.expenses || [])].forEach((e) => {
    spendMap[e.category] = (spendMap[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(spendMap)
    .sort((x, y) => y[1] - x[1])
    .map(([name, value]) => ({
      name,
      value,
      fill: CAT_COLORS[name] || "#6b6b7a",
    }));

  // Shared goals
  const sharedGoals = shared?.goals || [];

  return (
    <div>
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
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Combined household overview
        </div>
      </div>

      {/* Household metrics */}
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

      {/* Side-by-side personal stats */}
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
              { label: "Income", val: p.stats.income, color: "var(--green)" },
              { label: "Expenses", val: p.stats.expenses, color: "var(--red)" },
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
                    p.stats.savingsRate >= 20 ? "var(--green)" : "var(--gold)",
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

      {/* Shared Goals */}
      {sharedGoals.length > 0 && (
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
                        style={{ fontSize: 12, color: "var(--text-secondary)" }}
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
                        style={{ color: "var(--text-muted)", fontWeight: 400 }}
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
      )}

      {/* Household projection */}
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

      {/* Monthly Cash Flow */}
      <MonthlyCashFlow abhav={abhav} aanya={aanya} />
    </div>
  );
}
