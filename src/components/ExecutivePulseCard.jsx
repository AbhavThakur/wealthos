import { useState, useMemo } from "react";
import { fmt, fmtCr, isFD } from "../utils/finance";
import { getInvestmentCurrentValue } from "../utils/goalFunding";
import { calculateHouseholdMonthFinancials } from "../utils/financialDiagnostics";
import {
  generateMonthlyShareText,
  shareToWhatsApp,
  copySummaryToClipboard,
} from "../utils/shareSummary";
import { InfoModal } from "./InfoModal";
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Target,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Share2,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

/**
 * ExecutivePulseCard — 10-Second High-Level Financial Snapshot
 *
 * Answers the 3 essential questions for users:
 * 1. Is my household cashflow & budget healthy this month? (Expenses vs Income)
 * 2. Are my investments compounding properly? (SIPs & Net Worth)
 * 3. What is the single next action (if any) I should take?
 *
 * Also includes:
 * - InfoModal breakdown for complete transparency
 * - 3-Item Monthly Autopilot Checklist
 * - 1-Click WhatsApp / Couple Snapshot Share
 */
export default function ExecutivePulseCard({
  p1,
  p2,
  shared,
  currentMonthYm,
  personNames,
  onNavigate,
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const pulse = useMemo(() => {
    const ym = currentMonthYm || new Date().toISOString().slice(0, 7);

    // 1. Canonical Monthly Financials (Income vs Expenses for the selected month)
    const fin = calculateHouseholdMonthFinancials({
      p1,
      p2,
      shared,
      monthYm: ym,
      personNames,
    });

    const {
      totalIncome,
      totalExpenses,
      monthlySurplus,
      savingsRate,
      expenseRatio,
      isBudgetHealthy,
      incomeItems,
      expenseItems,
      statusTone: rawStatusTone,
      statusTitle: rawStatusTitle,
      nextActionText: rawNextActionText,
    } = fin;

    // 2. Investments & Compounding calculation
    const allInvestments = [
      ...(p1?.investments || []),
      ...(p2?.investments || []),
    ];
    let totalPortfolioVal = 0;
    let monthlySipTotal = 0;
    let lowYieldCount = 0;
    let weightedSum = 0;

    allInvestments.forEach((inv) => {
      const val = getInvestmentCurrentValue(inv);
      totalPortfolioVal += val;
      const r = Number(inv.returnPct || 0);
      weightedSum += val * r;

      if (inv.frequency === "monthly" || inv.sipMonthly) {
        monthlySipTotal += Number(inv.sipMonthly || inv.amount || 0);
      }
      if (isFD(inv.type) && r > 0 && r < 6.8) {
        lowYieldCount++;
      }
    });

    const avgReturn =
      totalPortfolioVal > 0
        ? (weightedSum / totalPortfolioVal).toFixed(1)
        : "12.0";

    // 3. Goals & Milestones
    const allGoals = [
      ...(p1?.goals || []),
      ...(p2?.goals || []),
      ...(shared?.goals || []),
    ];
    const activeGoals = allGoals.filter((g) => (g.target || 0) > 0);
    const totalGoalTarget = activeGoals.reduce(
      (s, g) => s + Number(g.target || 0),
      0,
    );
    const totalGoalSaved = activeGoals.reduce(
      (s, g) =>
        s +
        (g.saved !== undefined
          ? Number(g.saved || 0)
          : Number(g.p1Saved || 0) + Number(g.p2Saved || 0)),
      0,
    );
    const goalPct =
      totalGoalTarget > 0
        ? Math.round((totalGoalSaved / totalGoalTarget) * 100)
        : 0;

    let statusTone = rawStatusTone;
    let statusTitle = rawStatusTitle;
    let nextActionText = rawNextActionText;

    if (lowYieldCount > 0 && isBudgetHealthy) {
      statusTone = "opportunity";
      statusTitle = "Wealth Optimization Opportunity";
      nextActionText = `You have ${lowYieldCount} low-yield FD(s) earning < 6.8%. Reallocating to flexi-cap equity or goals will boost your returns.`;
    }

    return {
      ym,
      totalIncome,
      totalExpenses,
      monthlySurplus,
      savingsRate,
      expenseRatio,
      isBudgetHealthy,
      incomeItems,
      expenseItems,
      totalPortfolioVal,
      monthlySipTotal,
      avgReturn,
      activeGoalsCount: activeGoals.length,
      goalPct,
      statusTone,
      statusTitle,
      nextActionText,
      lowYieldCount,
      allInvestmentsCount: allInvestments.length,
    };
  }, [p1, p2, shared, currentMonthYm, personNames]);

  const badgeColor =
    pulse.statusTone === "positive"
      ? "var(--green, #10b981)"
      : pulse.statusTone === "opportunity"
      ? "var(--gold, #fbbf24)"
      : "var(--red, #ef4444)";

  const handleCopy = async () => {
    const text = generateMonthlyShareText({
      p1,
      p2,
      shared,
      monthYm: currentMonthYm,
      personNames,
    });
    const success = await copySummaryToClipboard(text);
    if (success) {
      setCopied(true);
      toast.success("Copied monthly snapshot to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Failed to copy snapshot.");
    }
  };

  const handleWhatsApp = () => {
    const text = generateMonthlyShareText({
      p1,
      p2,
      shared,
      monthYm: currentMonthYm,
      personNames,
    });
    shareToWhatsApp(text);
  };

  return (
    <div
      className="card section-gap"
      style={{
        background:
          "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(18,18,24,0.98))",
        border: "1px solid rgba(201,168,76,0.25)",
        borderRadius: 14,
        padding: "16px 18px",
        position: "relative",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
          onClick={() => setExpanded(!expanded)}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(201,168,76,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gold)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                10-Second Financial Health Pulse
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: `${badgeColor}22`,
                  color: badgeColor,
                  fontWeight: 600,
                  border: `1px solid ${badgeColor}44`,
                }}
              >
                {pulse.statusTitle}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Spent: <strong style={{ color: "#fff" }}>{fmt(pulse.totalExpenses)}</strong> (
              {pulse.expenseRatio}% of income) · Surplus:{" "}
              <strong style={{ color: pulse.monthlySurplus >= 0 ? "var(--green)" : "var(--red)" }}>
                {pulse.monthlySurplus >= 0 ? `+${fmt(pulse.monthlySurplus)}` : `-${fmt(Math.abs(pulse.monthlySurplus))}`}
              </strong> · Portfolio:{" "}
              <strong style={{ color: "var(--gold)" }}>{fmtCr(pulse.totalPortfolioVal)}</strong> (
              +{pulse.avgReturn}% p.a.)
            </div>
          </div>
        </div>

        {/* Action Controls: 1-Click WhatsApp & Copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={handleWhatsApp}
            className="btn-secondary"
            title="Share Monthly Snapshot on WhatsApp"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              padding: "4px 9px",
              background: "rgba(37, 211, 102, 0.12)",
              color: "#25D366",
              borderColor: "rgba(37, 211, 102, 0.3)",
              fontWeight: 600,
              borderRadius: 8,
            }}
          >
            <Share2 size={12} />
            Share on WhatsApp
          </button>
          <button
            onClick={handleCopy}
            className="btn-secondary"
            title="Copy snapshot summary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 8,
            }}
          >
            {copied ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            className="btn-icon"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse financial pulse" : "Expand financial pulse"}
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* 3 Core Pillars in Clean Scannable Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Pillar 1: Monthly Cashflow with InfoModal Breakdown */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <CreditCard size={13} color="var(--blue, #60a5fa)" />
              <span>Monthly Cashflow & Budget</span>
            </div>
            <InfoModal title="Monthly Cashflow Breakdown">
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>
                  Household Income ({fmt(pulse.totalIncome)}):
                </div>
                {pulse.incomeItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      padding: "2px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span>
                      {item.name} ({item.person})
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--green)" }}>{fmt(item.amount)}</span>
                  </div>
                ))}

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--red, #ef4444)",
                    marginTop: 12,
                    marginBottom: 6,
                  }}
                >
                  Household Expenses ({fmt(pulse.totalExpenses)}):
                </div>
                {pulse.expenseItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      padding: "2px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span>
                      {item.name} ({item.person})
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmt(item.amount)}</span>
                  </div>
                ))}

                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 10,
                    paddingTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontWeight: 700,
                    color: pulse.monthlySurplus >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  <span>Net Savings Surplus</span>
                  <span>
                    {pulse.monthlySurplus >= 0 ? `+${fmt(pulse.monthlySurplus)}` : `-${fmt(Math.abs(pulse.monthlySurplus))}`}
                  </span>
                </div>
              </div>
            </InfoModal>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {fmt(pulse.totalExpenses)}{" "}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              / {fmt(pulse.totalIncome)} income
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: pulse.isBudgetHealthy ? "var(--green)" : "var(--red)",
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            {pulse.isBudgetHealthy
              ? `✓ +${fmt(pulse.monthlySurplus)} surplus (${pulse.savingsRate}% saved)`
              : `⚠️ Over budget by ${fmt(Math.abs(pulse.monthlySurplus))}`}
          </div>
        </div>

        {/* Pillar 2: Investments */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 4,
            }}
          >
            <TrendingUp size={13} color="var(--green, #10b981)" />
            <span>Investment Engine</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {fmt(pulse.monthlySipTotal)}{" "}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              /mo active SIPs
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--green)",
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            ✓ Total {fmtCr(pulse.totalPortfolioVal)} (+{pulse.avgReturn}% CAGR)
          </div>
        </div>

        {/* Pillar 3: Goals */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 4,
            }}
          >
            <Target size={13} color="var(--gold, #fbbf24)" />
            <span>Life Goals Track</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {pulse.activeGoalsCount} Active Goal{pulse.activeGoalsCount !== 1 ? "s" : ""}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--gold)",
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            {pulse.goalPct}% average progress
          </div>
        </div>
      </div>

      {/* 3-Item Monthly Autopilot Checklist */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <ShieldCheck size={12} color="var(--gold)" />
          Monthly Autopilot Checklist:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* Check 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <CheckCircle2
              size={13}
              color={pulse.isBudgetHealthy ? "var(--green)" : "var(--red)"}
            />
            <span style={{ color: pulse.isBudgetHealthy ? "#fff" : "var(--red)" }}>
              <strong>1. Monthly Cashflow:</strong>{" "}
              {pulse.isBudgetHealthy
                ? `Positive cashflow (+${fmt(pulse.monthlySurplus)} surplus · ${pulse.savingsRate}% saved)`
                : `Deficit by ${fmt(Math.abs(pulse.monthlySurplus))} — expenses exceed income`}
            </span>
          </div>
          {/* Check 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <CheckCircle2
              size={13}
              color={pulse.monthlySipTotal > 0 ? "var(--green)" : "var(--gold)"}
            />
            <span style={{ color: "#fff" }}>
              <strong>2. SIP Compounding:</strong>{" "}
              {pulse.monthlySipTotal > 0
                ? `${fmt(pulse.monthlySipTotal)}/month auto-compounding active`
                : "No active monthly SIPs found"}
            </span>
          </div>
          {/* Check 3 */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <CheckCircle2
              size={13}
              color={pulse.lowYieldCount === 0 ? "var(--green)" : "var(--gold)"}
            />
            <span style={{ color: "#fff" }}>
              <strong>3. Asset Optimization:</strong>{" "}
              {pulse.lowYieldCount === 0
                ? "0 sub-par FD leaks detected across portfolios"
                : `${pulse.lowYieldCount} low-yield FD(s) detected — recommend reallocating to goals`}
            </span>
          </div>
        </div>
      </div>

      {/* Action Recommendation Banner */}
      <div
        style={{
          marginTop: 10,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} color={badgeColor} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <strong style={{ color: "#fff" }}>Next step:</strong> {pulse.nextActionText}
          </span>
        </div>

        {onNavigate && (
          <button
            className="btn-ghost"
            onClick={() => onNavigate(pulse.statusTone === "warning" ? "budget" : "investments")}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--gold)",
            }}
          >
            Open {pulse.statusTone === "warning" ? "Budget" : "Investments"} <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
