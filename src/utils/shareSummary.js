import { fmt, fmtCr } from "./finance.js";
import { getInvestmentCurrentValue } from "./goalFunding.js";
import { calculateHouseholdMonthFinancials } from "./financialDiagnostics.js";

/**
 * Generates a clean, friendly WhatsApp/Telegram snapshot for couple monthly review.
 */
export function generateMonthlyShareText({
  p1,
  p2,
  shared,
  monthYm,
  personNames = { p1: "Person 1", p2: "Person 2" },
}) {
  const ym = monthYm || new Date().toISOString().slice(0, 7);
  const [year, monthNum] = ym.split("-");
  const monthName = new Date(Number(year), Number(monthNum) - 1, 1).toLocaleString("en-IN", {
    month: "long",
  });

  // 1. Budget & Spending from canonical engine
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
  } = fin;

  // 2. Investments
  const allInvestments = [
    ...(p1?.investments || []),
    ...(p2?.investments || []),
  ];
  let totalPortfolioVal = 0;
  let monthlySipTotal = 0;
  let weightedSum = 0;

  allInvestments.forEach((inv) => {
    const val = getInvestmentCurrentValue(inv);
    totalPortfolioVal += val;
    const r = Number(inv.returnPct || 0);
    weightedSum += val * r;

    if (inv.frequency === "monthly" || inv.sipMonthly) {
      monthlySipTotal += Number(inv.sipMonthly || inv.amount || 0);
    }
  });

  const avgReturn = totalPortfolioVal > 0 ? (weightedSum / totalPortfolioVal).toFixed(1) : "12.0";

  // 3. Goals
  const allGoals = [
    ...(p1?.goals || []),
    ...(p2?.goals || []),
    ...(shared?.goals || []),
  ];
  const topGoal = allGoals.find((g) => Number(g.target || 0) > 0);
  let goalText = "";
  if (topGoal) {
    const saved = topGoal.saved !== undefined ? Number(topGoal.saved || 0) : Number(topGoal.p1Saved || 0) + Number(topGoal.p2Saved || 0);
    const target = Number(topGoal.target || 1);
    const pct = Math.round((saved / target) * 100);
    goalText = `🎯 *Top Goal*: ${topGoal.name} is ${pct}% funded (${fmt(saved)} / ${fmt(target)})\n`;
  }

  // 4. Couple Settlement
  const p1Name = personNames.p1 || "Person 1";
  const p2Name = personNames.p2 || "Person 2";

  return `🏡 *WealthOS Monthly Snapshot (${monthName} ${year})*
━━━━━━━━━━━━━━━━━━━━━━
💳 *Monthly Cashflow*: ${fmt(totalExpenses)} spent / ${fmt(totalIncome)} income (${expenseRatio}%)
${monthlySurplus >= 0 ? `🎉 *Net Savings*: +${fmt(monthlySurplus)} saved (${savingsRate}% savings rate)!\n` : `⚠️ *Deficit*: -${fmt(Math.abs(monthlySurplus))}\n`}
📈 *Investments*: ${fmt(monthlySipTotal)}/mo active SIPs
💼 *Total Wealth Portfolio*: ${fmtCr(totalPortfolioVal)} (+${avgReturn}% p.a.)

${goalText}✨ *Review Status*: ${p1Name} & ${p2Name} are compounding wealth together!
━━━━━━━━━━━━━━━━━━━━━━
_Sent via WealthOS_`;
}

/**
 * Opens WhatsApp web / mobile app with the pre-filled summary message.
 */
export function shareToWhatsApp(text) {
  if (!text) return;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Copies text to system clipboard.
 */
export async function copySummaryToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn("Clipboard copy failed:", err);
    return false;
  }
}
