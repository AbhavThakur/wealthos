/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo } from "react";
import { SankeyChart } from "./Chart";
import { fmt, onetimeEffective, freqToMonthly } from "../utils/finance";
import { personStats } from "../pages/Dashboard";
import { Maximize2 } from "lucide-react";
import ExpandableChartModal from "./ExpandableChartModal";

// Effective amount of an expense for a given "YYYY-MM" month — mirrors the
// monthly/onetime/trip + yearly/quarterly recurrence gating used elsewhere
// (Dashboard.jsx isMonthlyActive/personStats) so this stays month-aware
// instead of always summing the flat standing amount.
function expenseAmountForMonth(exp, ym) {
  if (exp.expenseType === "onetime") {
    return (exp.date || "").slice(0, 7) === ym ? onetimeEffective(exp) : 0;
  }
  if (exp.expenseType === "trip") {
    return (exp.startDate || exp.date || "").slice(0, 7) === ym
      ? exp.amount || 0
      : 0;
  }
  const curMonth = ym
    ? parseInt(ym.split("-")[1], 10) - 1
    : new Date().getMonth();
  if (exp.recurrence === "yearly" && (exp.recurrenceMonth ?? 0) !== curMonth)
    return 0;
  if (exp.recurrence === "quarterly") {
    const months = exp.recurrenceMonths || [0, 3, 6, 9];
    if (!months.includes(curMonth)) return 0;
  }
  return exp.amount || 0;
}

// Distinct color tokens for Sankey nodes
const SANKEY_COLORS = {
  incomeP1: "#22c55e",
  incomeP2: "#10b981",
  totalIncome: "#10b981",
  needs: "#3b82f6",
  wants: "#f59e0b",
  investments: "#8b5cf6",
  debts: "#fb7185",
  surplus: "#06b6d4",
  deficit: "#ef4444",
  Housing: "#60a5fa",
  Groceries: "#34d399",
  Utilities: "#38bdf8",
  Transport: "#fbbf24",
  Health: "#f87171",
  Entertainment: "#f472b6",
  Dining: "#fb923c",
  Shopping: "#a78bfa",
  Travel: "#38bdf8",
  Investment: "#c084fc",
  Other: "#94a3b8",
};

/**
 * Maps standard categories into 3 core buckets: Needs, Wants, Investments
 */
function getBucketForCategory(category) {
  const c = (category || "").toLowerCase();
  if (
    c.includes("invest") ||
    c.includes("sip") ||
    c.includes("mutual") ||
    c.includes("stock") ||
    c.includes("epf") ||
    c.includes("ppf")
  ) {
    return "Investments";
  }
  if (
    c.includes("rent") ||
    c.includes("housing") ||
    c.includes("grocer") ||
    c.includes("util") ||
    c.includes("bill") ||
    c.includes("emi") ||
    c.includes("loan") ||
    c.includes("insurance") ||
    c.includes("health") ||
    c.includes("medical") ||
    c.includes("transport") ||
    c.includes("fuel") ||
    c.includes("maid") ||
    c.includes("school")
  ) {
    return "Needs & Essentials";
  }
  return "Lifestyle & Wants";
}

export function buildCashFlowSankeyData(
  p1,
  p2,
  month,
  view = "household",
  personNames = { p1: "P1", p2: "P2" },
) {
  // Use the same standing-budget stats as the rest of the Dashboard
  // (Combined Income/Investments/Debts, Monthly Cash Flow) so this diagram's
  // totals never diverge from the headline numbers shown elsewhere.
  const p1Stats = personStats(p1, month);
  const p2Stats = personStats(p2, month);
  const p1EffectiveInc = p1Stats.income || 0;
  const p2EffectiveInc = p2Stats.income || 0;

  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  const addNode = (name, color, val = null) => {
    if (!nodeSet.has(name)) {
      nodeSet.add(name);
      nodes.push({ name, color, value: val });
    }
  };

  // Determine active dataset
  let totalIncome = 0;
  let expensesList = [];
  let subsList = [];
  let investmentsTotal = 0;
  let debtsTotal = 0;

  if (view === "p1") {
    totalIncome = p1EffectiveInc || 0;
    expensesList = p1?.expenses || [];
    subsList = p1?.subscriptions || [];
    investmentsTotal = p1Stats.investments || 0;
    debtsTotal = p1Stats.debts || 0;
    addNode(`${personNames.p1} Income`, SANKEY_COLORS.incomeP1, totalIncome);
  } else if (view === "p2") {
    totalIncome = p2EffectiveInc || 0;
    expensesList = p2?.expenses || [];
    subsList = p2?.subscriptions || [];
    investmentsTotal = p2Stats.investments || 0;
    debtsTotal = p2Stats.debts || 0;
    addNode(`${personNames.p2} Income`, SANKEY_COLORS.incomeP2, totalIncome);
  } else {
    // Household combined
    const p1Inc = p1EffectiveInc || 0;
    const p2Inc = p2EffectiveInc || 0;
    totalIncome = p1Inc + p2Inc;
    expensesList = [...(p1?.expenses || []), ...(p2?.expenses || [])];
    subsList = [...(p1?.subscriptions || []), ...(p2?.subscriptions || [])];
    investmentsTotal = (p1Stats.investments || 0) + (p2Stats.investments || 0);
    debtsTotal = (p1Stats.debts || 0) + (p2Stats.debts || 0);

    if (p1Inc > 0)
      addNode(`${personNames.p1} Income`, SANKEY_COLORS.incomeP1, p1Inc);
    if (p2Inc > 0)
      addNode(`${personNames.p2} Income`, SANKEY_COLORS.incomeP2, p2Inc);

    if (p1Inc > 0 && p2Inc > 0) {
      addNode("Total Household Income", SANKEY_COLORS.totalIncome, totalIncome);
      links.push({
        source: `${personNames.p1} Income`,
        target: "Total Household Income",
        value: p1Inc,
      });
      links.push({
        source: `${personNames.p2} Income`,
        target: "Total Household Income",
        value: p2Inc,
      });
    }
  }

  const incomeSourceNode =
    view === "household" && p1EffectiveInc > 0 && p2EffectiveInc > 0
      ? "Total Household Income"
      : view === "p1"
        ? `${personNames.p1} Income`
        : view === "p2"
          ? `${personNames.p2} Income`
          : p1EffectiveInc > 0
            ? `${personNames.p1} Income`
            : `${personNames.p2} Income`;

  if (totalIncome <= 0 && expensesList.length === 0) {
    return { nodes: [], links: [] };
  }

  // Aggregate expenses by category and bucket
  const bucketTotals = {
    "Needs & Essentials": 0,
    "Lifestyle & Wants": 0,
    Investments: investmentsTotal,
    "Debts & EMIs": debtsTotal,
  };

  const categoryTotals = {};

  expensesList.forEach((exp) => {
    const amt = expenseAmountForMonth(exp, month);
    if (amt <= 0) return;
    const cat = exp.category || "Other";
    const bucket = getBucketForCategory(cat);
    bucketTotals[bucket] = (bucketTotals[bucket] || 0) + amt;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  // Active subscriptions also count as monthly expenses (matches
  // personStats/Combined Expenses), grouped under their own category.
  subsList.forEach((sub) => {
    if (sub.active === false) return;
    const amt = freqToMonthly(sub.amount, sub.frequency);
    if (amt <= 0) return;
    const cat = sub.category || "Subscriptions";
    const bucket = getBucketForCategory(cat);
    bucketTotals[bucket] = (bucketTotals[bucket] || 0) + amt;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const totalSpent =
    (bucketTotals["Needs & Essentials"] || 0) +
    (bucketTotals["Lifestyle & Wants"] || 0) +
    (bucketTotals.Investments || 0) +
    (bucketTotals["Debts & EMIs"] || 0);
  const surplus = Math.max(0, totalIncome - totalSpent);
  const deficit = totalSpent > totalIncome ? totalSpent - totalIncome : 0;

  // Add Bucket Nodes
  if (bucketTotals["Needs & Essentials"] > 0) {
    addNode(
      "Needs & Essentials",
      SANKEY_COLORS.needs,
      bucketTotals["Needs & Essentials"],
    );
    links.push({
      source: incomeSourceNode,
      target: "Needs & Essentials",
      value: bucketTotals["Needs & Essentials"],
    });
  }

  if (bucketTotals["Lifestyle & Wants"] > 0) {
    addNode(
      "Lifestyle & Wants",
      SANKEY_COLORS.wants,
      bucketTotals["Lifestyle & Wants"],
    );
    links.push({
      source: incomeSourceNode,
      target: "Lifestyle & Wants",
      value: bucketTotals["Lifestyle & Wants"],
    });
  }

  if (bucketTotals.Investments > 0) {
    addNode(
      "Investments & SIPs",
      SANKEY_COLORS.investments,
      bucketTotals.Investments,
    );
    links.push({
      source: incomeSourceNode,
      target: "Investments & SIPs",
      value: bucketTotals.Investments,
    });
  }

  if (bucketTotals["Debts & EMIs"] > 0) {
    addNode("Debts & EMIs", SANKEY_COLORS.debts, bucketTotals["Debts & EMIs"]);
    links.push({
      source: incomeSourceNode,
      target: "Debts & EMIs",
      value: bucketTotals["Debts & EMIs"],
    });
  }

  if (surplus > 0) {
    addNode("Savings & Surplus", SANKEY_COLORS.surplus, surplus);
    links.push({
      source: incomeSourceNode,
      target: "Savings & Surplus",
      value: surplus,
    });
  }

  if (deficit > 0) {
    addNode("Monthly Deficit", SANKEY_COLORS.deficit, deficit);
  }

  // Tier 3: Link Buckets to Subcategories
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt <= 0) return;
    const bucket = getBucketForCategory(cat);
    const bucketNodeName =
      bucket === "Investments"
        ? "Investments & SIPs"
        : bucket === "Needs & Essentials"
          ? "Needs & Essentials"
          : "Lifestyle & Wants";

    // SankeyChart's own label formatter appends "(amount)" already —
    // don't bake it into the node name too, or it renders twice.
    const targetNodeName = cat;
    const color = SANKEY_COLORS[cat] || SANKEY_COLORS.Other;
    addNode(targetNodeName, color, amt);

    links.push({
      source: bucketNodeName,
      target: targetNodeName,
      value: amt,
    });
  });

  return { nodes, links };
}

export default function SankeyDiagram({
  p1,
  p2,
  month,
  personNames = { p1: "Person 1", p2: "Person 2" },
  height = 420,
}) {
  const [view, setView] = useState("household");
  const [isExpanded, setIsExpanded] = useState(false);

  const { nodes, links } = useMemo(
    () => buildCashFlowSankeyData(p1, p2, month, view, personNames),
    [p1, p2, month, view, personNames],
  );

  const monthLabel = (() => {
    const [y, m] = (month || "").split("-");
    if (!y || !m) return "";
    return new Date(Number(y), Number(m) - 1).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <>
      <div
        className="glass-card"
        style={{
          padding: "20px",
          borderRadius: "var(--radius-lg, 16px)",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🌊</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Cash Flow Stream
              </h3>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                margin: "4px 0 0 0",
              }}
            >
              Visual money path from income sources through essential needs,
              lifestyle, and investments
              {monthLabel && ` · ${monthLabel}`}
              {monthLabel &&
                " (change month using the picker at the top of the dashboard)"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Expand Fullscreen Button */}
            <button
              onClick={() => setIsExpanded(true)}
              title="Expand Fullscreen View"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "7px 12px",
                borderRadius: 8,
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--text-secondary, #c4c2cc)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                transition: "all 0.15s ease",
              }}
            >
              <Maximize2 size={14} color="var(--gold, #c9a84c)" />
              <span>Expand</span>
            </button>

            {/* View Toggle */}
            <div className="profile-switcher" role="radiogroup">
              <button
                className={`profile-pill${view === "household" ? " active" : ""}`}
                style={{
                  "--pill-color": "var(--gold)",
                  "--pill-dim": "var(--gold-dim)",
                }}
                onClick={() => setView("household")}
              >
                Household
              </button>
              <button
                className={`profile-pill${view === "p1" ? " active" : ""}`}
                style={{
                  "--pill-color": "var(--p1)",
                  "--pill-dim": "var(--p1-dim)",
                }}
                onClick={() => setView("p1")}
              >
                {personNames.p1}
              </button>
              <button
                className={`profile-pill${view === "p2" ? " active" : ""}`}
                style={{
                  "--pill-color": "var(--p2)",
                  "--pill-dim": "var(--p2-dim)",
                }}
                onClick={() => setView("p2")}
              >
                {personNames.p2}
              </button>
            </div>
          </div>
        </div>

        {nodes.length > 0 && links.length > 0 ? (
          <SankeyChart
            nodes={nodes}
            links={links}
            height={height}
            fmt={fmt}
            nodeGap={16}
            nodeWidth={22}
          />
        ) : (
          <div
            style={{
              height: 200,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            <span>No income or expense data available for this month</span>
          </div>
        )}
      </div>

      {/* ── Fullscreen Expand Modal ── */}
      <ExpandableChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title="Cash Flow Stream & Money Path"
        subtitle={`Viewing: ${view === "household" ? "Combined Household" : personNames[view]} · Month: ${month || "Current"}`}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 520,
          }}
        >
          {nodes.length > 0 && links.length > 0 ? (
            <SankeyChart
              nodes={nodes}
              links={links}
              height={550}
              fmt={fmt}
              nodeGap={20}
              nodeWidth={26}
            />
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              No data for this view
            </div>
          )}
        </div>
      </ExpandableChartModal>
    </>
  );
}
