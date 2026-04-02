import { useState, useRef } from "react";
import { fmt, freqToMonthly, EXPENSE_CATEGORIES } from "../utils/finance";

// ── Compute per-person stats for a given YYYY-MM ──────────────────────────
function monthStats(data, ym) {
  if (!data)
    return {
      income: 0,
      expenses: 0,
      investments: 0,
      debts: 0,
      savings: 0,
      categories: {},
    };
  const curMonth = parseInt(ym.split("-")[1], 10) - 1;

  let income =
    data.incomes?.reduce((s, x) => {
      let base = x.amount || 0;
      if (x.incomeEntries) {
        for (const e of x.incomeEntries) {
          if (e.date?.slice(0, 7) === ym) base += e.amount || 0;
        }
      }
      return s + base;
    }, 0) ?? 0;

  // Transaction-based income
  for (const t of data.transactions || []) {
    if (t.date?.slice(0, 7) === ym && t.amount > 0) income += t.amount;
  }

  const categories = {};
  let expenses = 0;
  for (const x of data.expenses || []) {
    let amt = 0;
    if (x.expenseType === "onetime") {
      amt = x.date?.slice(0, 7) === ym ? x.amount : 0;
    } else if (x.expenseType === "trip") {
      amt = (x.startDate || x.date || "").slice(0, 7) === ym ? x.amount : 0;
    } else {
      if (x.recurrence === "yearly" && (x.recurrenceMonth ?? 0) !== curMonth)
        amt = 0;
      else if (
        x.recurrence === "quarterly" &&
        !(x.recurrenceMonths || [0, 3, 6, 9]).includes(curMonth)
      )
        amt = 0;
      else amt = x.amount;
    }
    // Expense entries (logged actuals)
    for (const e of x.entries || []) {
      if (e.date?.slice(0, 7) === ym) amt += e.amount;
    }
    if (amt > 0) {
      expenses += amt;
      const cat = x.category || "Other";
      categories[cat] = (categories[cat] || 0) + amt;
    }
  }
  // Subscriptions
  for (const s of data.subscriptions || []) {
    if (s.active !== false) {
      const amt = freqToMonthly(s.amount, s.frequency);
      expenses += amt;
      categories["Subscriptions"] = (categories["Subscriptions"] || 0) + amt;
    }
  }
  // Transaction-based expenses
  for (const t of data.transactions || []) {
    if (t.date?.slice(0, 7) === ym && t.amount < 0 && t.type !== "investment") {
      const amt = Math.abs(t.amount);
      expenses += amt;
      const cat = t.category || "Other";
      categories[cat] = (categories[cat] || 0) + amt;
    }
  }

  const investments =
    data.investments?.reduce(
      (s, x) => s + freqToMonthly(x.amount, x.frequency),
      0,
    ) ?? 0;
  const debts = data.debts?.reduce((s, x) => s + x.emi, 0) ?? 0;
  const savings = income - expenses - investments - debts;

  return { income, expenses, investments, debts, savings, categories };
}

// Simple horizontal bar
function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      style={{
        background: "var(--bg-dim)",
        borderRadius: 4,
        height: 8,
        flex: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 4,
          background: color,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

export default function MonthlySummary({ abhav, aanya, shared, personNames }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [ym, setYm] = useState(defaultYm);
  const printRef = useRef(null);

  // Prev month
  const [y, m] = ym.split("-").map(Number);
  const prevYm =
    m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const monthLabel = new Date(y, m - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const aStats = monthStats(abhav, ym);
  const bStats = monthStats(aanya, ym);
  const aPrev = monthStats(abhav, prevYm);
  const bPrev = monthStats(aanya, prevYm);

  const total = {
    income: aStats.income + bStats.income,
    expenses: aStats.expenses + bStats.expenses,
    investments: aStats.investments + bStats.investments,
    debts: aStats.debts + bStats.debts,
    savings: aStats.savings + bStats.savings,
  };
  const prevTotal = {
    income: aPrev.income + bPrev.income,
    expenses: aPrev.expenses + bPrev.expenses,
    savings: aPrev.savings + bPrev.savings,
  };
  const savingsRate =
    total.income > 0
      ? Math.round(
          ((total.investments + Math.max(0, total.savings)) / total.income) *
            100,
        )
      : 0;

  // Merge category breakdown
  const allCats = {};
  for (const [cat, amt] of Object.entries(aStats.categories))
    allCats[cat] = (allCats[cat] || 0) + amt;
  for (const [cat, amt] of Object.entries(bStats.categories))
    allCats[cat] = (allCats[cat] || 0) + amt;
  const catEntries = Object.entries(allCats).sort((a, b) => b[1] - a[1]);
  const topCat = catEntries[0];
  const maxCatAmt = topCat?.[1] || 1;

  // Goals progress
  const goals = (shared?.goals || []).map((g) => {
    const saved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
    return {
      ...g,
      saved,
      pct: g.target > 0 ? Math.round((saved / g.target) * 100) : 0,
    };
  });

  const delta = (cur, prev) => {
    if (prev === 0) return cur > 0 ? "+100%" : "—";
    const d = Math.round(((cur - prev) / prev) * 100);
    return d >= 0 ? `+${d}%` : `${d}%`;
  };
  const deltaColor = (cur, prev, invert) => {
    const d = cur - prev;
    if (d === 0) return "var(--text-muted)";
    return (invert ? d < 0 : d > 0) ? "var(--green)" : "var(--red)";
  };

  // Month selector
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  const handleShare = async () => {
    const text = `WealthOS Monthly Summary — ${monthLabel}\n\nIncome: ${fmt(total.income)}\nExpenses: ${fmt(total.expenses)}\nInvestments: ${fmt(total.investments)}\nSavings: ${fmt(total.savings)}\nSavings Rate: ${savingsRate}%`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `WealthOS Summary — ${monthLabel}`,
          text,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Summary copied to clipboard!");
    }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    win.document
      .write(`<!DOCTYPE html><html><head><title>WealthOS Summary ${monthLabel}</title>
      <style>body{font-family:system-ui,sans-serif;padding:2rem;color:#222;max-width:700px;margin:0 auto}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
      .label{color:#666}.val{font-weight:600}.delta{font-size:12px;margin-left:8px}
      h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:20px 0 8px;color:#555}
      .bar-wrap{height:6px;background:#eee;border-radius:3px;margin-top:4px;width:100%}
      .bar-fill{height:100%;border-radius:3px}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  if (!open) {
    return (
      <button
        className="btn-ghost"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 13,
          gap: 6,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        📋 Monthly Summary
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "1.5rem",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <h2
              style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}
            >
              Monthly Summary
            </h2>
            <select
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              style={{
                marginTop: 4,
                background: "var(--bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 13,
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(
                    Number(m.split("-")[0]),
                    Number(m.split("-")[1]) - 1,
                  ).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-ghost"
              onClick={handleShare}
              title="Share"
              style={{ fontSize: 16, padding: 6 }}
            >
              📤
            </button>
            <button
              className="btn-ghost"
              onClick={handlePrint}
              title="Print / PDF"
              style={{ fontSize: 16, padding: 6 }}
            >
              🖨️
            </button>
            <button
              className="btn-ghost"
              onClick={() => setOpen(false)}
              style={{ fontSize: 18, padding: 6 }}
            >
              ✕
            </button>
          </div>
        </div>

        <div ref={printRef}>
          <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>
            WealthOS — {monthLabel}
          </h1>

          {/* Key Metrics */}
          <h2
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              margin: "20px 0 8px",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Overview
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: "Income",
                val: total.income,
                prev: prevTotal.income,
                color: "var(--green)",
              },
              {
                label: "Expenses",
                val: total.expenses,
                prev: prevTotal.expenses,
                color: "var(--red)",
                invert: true,
              },
              {
                label: "Investments",
                val: total.investments,
                color: "var(--gold)",
              },
              {
                label: "Net Savings",
                val: total.savings,
                prev: prevTotal.savings,
                color: total.savings >= 0 ? "var(--green)" : "var(--red)",
              },
            ].map(({ label, val, prev, color, invert }) => (
              <div
                key={label}
                style={{
                  padding: 12,
                  background: "var(--bg)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>
                  {fmt(val)}
                </div>
                {prev !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      color: deltaColor(val, prev, invert),
                    }}
                  >
                    {delta(val, prev)} vs prev
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Savings Rate */}
          <div
            style={{
              padding: 12,
              background: "var(--bg)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Savings Rate
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color:
                  savingsRate >= 20
                    ? "var(--green)"
                    : savingsRate >= 10
                      ? "var(--gold)"
                      : "var(--red)",
              }}
            >
              {savingsRate}%
            </div>
          </div>

          {/* Per-person split */}
          <h2
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              margin: "20px 0 8px",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            By Person
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                name: personNames?.abhav || "Person 1",
                stats: aStats,
                color: "var(--abhav)",
              },
              {
                name: personNames?.aanya || "Person 2",
                stats: bStats,
                color: "var(--aanya)",
              },
            ].map(({ name, stats, color }) => (
              <div
                key={name}
                style={{
                  padding: 12,
                  background: "var(--bg)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color,
                    marginBottom: 8,
                  }}
                >
                  {name}
                </div>
                {[
                  { l: "Income", v: stats.income },
                  { l: "Expenses", v: stats.expenses },
                  { l: "Savings", v: stats.savings },
                ].map((r) => (
                  <div
                    key={r.l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      padding: "3px 0",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>{r.l}</span>
                    <span
                      style={{ fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {fmt(r.v)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Category Breakdown */}
          {catEntries.length > 0 && (
            <>
              <h2
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  margin: "20px 0 8px",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Spending by Category
              </h2>
              <div style={{ marginBottom: 20 }}>
                {catEntries.slice(0, 8).map(([cat, amt]) => (
                  <div
                    key={cat}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        width: 100,
                        flexShrink: 0,
                      }}
                    >
                      {cat}
                    </span>
                    <Bar value={amt} max={maxCatAmt} color="var(--gold)" />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {fmt(amt)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Goals Progress */}
          {goals.length > 0 && (
            <>
              <h2
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  margin: "20px 0 8px",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Goals Progress
              </h2>
              <div style={{ marginBottom: 12 }}>
                {goals.map((g) => (
                  <div
                    key={g.id || g.name}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "var(--text-primary)" }}>
                        {g.name}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            g.pct >= 100
                              ? "var(--green)"
                              : "var(--text-primary)",
                        }}
                      >
                        {g.pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <Bar
                        value={g.saved}
                        max={g.target}
                        color={g.pct >= 100 ? "var(--green)" : "var(--gold)"}
                      />
                      <span
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
                        {fmt(g.saved)} / {fmt(g.target)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
