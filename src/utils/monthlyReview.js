// Shared financial-health scoring + monthly-review tip generation.
// Used by the Dashboard health card and the MoneyDateModal couple review.
import { fmt } from "./finance";
import { parseLocalDate } from "./date";

// ── Financial Health Score: 5-pillar model ────────────────────────────────
export function calcHealthScore({
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

// One saved review per month — a re-run replaces the prior save for that month.
export function upsertMonthlyReview(existingReviews, review) {
  const others = (existingReviews || []).filter(
    (r) => r.month !== review.month,
  );
  return [review, ...others];
}

const PILLAR_ACTIONS = {
  savings: "automate one extra transfer to savings on salary day",
  debt: "prepay the highest-interest EMI first",
  emergency:
    "route this month's surplus into a liquid fund until 6 months are covered",
  investing: "start one small automatic SIP — consistency beats size",
  protection: "compare term-insurance quotes together this month",
};

const MS_PER_DAY = 24 * 3600 * 1000;

// ── "How we can improve" tips for the monthly couple review ───────────────
export function buildReviewTips({
  spikes = [],
  pillars = [],
  investments = [],
  subscriptionTotal = 0,
  now = new Date(),
} = {}) {
  const tips = [];

  const top = spikes[0];
  if (top?.amount > 0) {
    const cap = Math.round((top.amount * 0.8) / 500) * 500;
    if (cap > 0 && cap < top.amount) {
      tips.push(
        `You spent ${fmt(top.amount)} on ${top.category} — a ${fmt(cap)} soft cap frees ${fmt(top.amount - cap)} for your goals.`,
      );
    }
  }

  for (const inv of investments) {
    if (!inv?.endDate) continue;
    const end = parseLocalDate(inv.endDate);
    if (!end) continue;
    const days = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
    if (days >= 0 && days <= 45) {
      tips.push(
        `${inv.name || inv.type || "A deposit"} matures in ${days} day${days === 1 ? "" : "s"} — decide together whether to reinvest or redirect it.`,
      );
      break;
    }
  }

  const weakest = pillars
    .filter((p) => p.pts < p.maxPts)
    .sort((a, b) => a.pts / a.maxPts - b.pts / b.maxPts)[0];
  if (weakest && PILLAR_ACTIONS[weakest.key]) {
    tips.push(
      `${weakest.emoji} ${weakest.label} is your weakest pillar — ${PILLAR_ACTIONS[weakest.key]}.`,
    );
  }

  if (subscriptionTotal >= 500) {
    tips.push(
      `Subscriptions cost ${fmt(subscriptionTotal)}/month — cancel one unused service and redirect it to a shared goal.`,
    );
  }

  return tips.slice(0, 3);
}
