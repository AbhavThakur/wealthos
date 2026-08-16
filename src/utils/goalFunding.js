import { isFD, fdCorpus, lumpCorpus, elapsedYears } from "./finance.js";

/**
 * Calculates current value of an individual investment.
 */
export function getInvestmentCurrentValue(inv) {
  if (!inv) return 0;
  if (isFD(inv.type)) {
    const nowMs = Date.now();
    const elapsed = inv.startDate ? elapsedYears(inv.startDate, 365, nowMs) : 0;
    return Math.round(fdCorpus(inv.amount || 0, inv.returnPct || 0, elapsed));
  }
  if (inv.frequency === "onetime") {
    if (inv.existingCorpus > 0) return Number(inv.existingCorpus);
    const nowMs = Date.now();
    const elapsed = inv.startDate ? elapsedYears(inv.startDate, 365.25, nowMs) : 0;
    return Math.round(lumpCorpus(inv.amount || 0, inv.returnPct || 0, elapsed));
  }
  return Number(inv.existingCorpus || 0);
}

/**
 * Computes the total funding for a goal, combining direct cash savings
 * and linked investment assets.
 *
 * @param {Object} goal - Goal object
 * @param {Array} allInvestments - Array of all available investment objects (P1, P2, shared)
 * @returns {Object} Funding summary { cashSaved, investmentsSaved, totalSaved, target, pct, remaining, linkedDetails }
 */
export function getGoalTotalFunding(goal, allInvestments = []) {
  if (!goal) {
    return { cashSaved: 0, investmentsSaved: 0, totalSaved: 0, target: 0, pct: 0, remaining: 0, linkedDetails: [] };
  }

  const isShared = goal.shared !== false && (goal.p1Saved !== undefined || goal.p2Saved !== undefined);
  const cashSaved = isShared
    ? Number(goal.p1Saved || 0) + Number(goal.p2Saved || 0)
    : Number(goal.saved || 0);

  const linked = goal.linkedInvestments || [];
  let investmentsSaved = 0;
  const linkedDetails = [];

  linked.forEach((link) => {
    const matchedInv = allInvestments.find((x) => String(x.id) === String(link.id));
    if (matchedInv) {
      const invVal = getInvestmentCurrentValue(matchedInv);
      const allocated = link.allocatedAmount !== undefined && link.allocatedAmount !== null
        ? Math.min(invVal, Number(link.allocatedAmount))
        : invVal;

      investmentsSaved += allocated;
      linkedDetails.push({
        id: matchedInv.id,
        name: matchedInv.name,
        type: matchedInv.type,
        returnPct: matchedInv.returnPct,
        currentValue: invVal,
        allocatedAmount: allocated,
        person: link.person || matchedInv.person || "p1",
      });
    }
  });

  const target = Number(goal.target || 0);
  const totalSaved = cashSaved + investmentsSaved;
  const pct = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;
  const remaining = Math.max(0, target - totalSaved);

  return {
    cashSaved,
    investmentsSaved,
    totalSaved,
    target,
    pct,
    remaining,
    linkedDetails,
  };
}

/**
 * Scans user's investments for smart funding opportunities to recommend for this goal.
 * Finds:
 * 1. Low-yield FDs (< 6.8% return rate)
 * 2. FDs that have already matured or are expiring in < 90 days
 * 3. High-balance idle holdings not yet linked to any goal
 */
export function findGoalFundingSuggestions(allInvestments = [], goal = {}, allGoals = []) {
  if (!Array.isArray(allInvestments) || allInvestments.length === 0) return [];

  // Track already linked investments across all goals to avoid recommending fully linked assets
  const alreadyLinkedMap = new Map();
  allGoals.forEach((g) => {
    (g.linkedInvestments || []).forEach((link) => {
      const cur = alreadyLinkedMap.get(String(link.id)) || 0;
      alreadyLinkedMap.set(String(link.id), cur + (Number(link.allocatedAmount) || 0));
    });
  });

  const thisGoalLinkedIds = new Set((goal.linkedInvestments || []).map((l) => String(l.id)));
  const suggestions = [];
  const now = new Date();

  allInvestments.forEach((inv) => {
    if (!inv || thisGoalLinkedIds.has(String(inv.id))) return;

    const val = getInvestmentCurrentValue(inv);
    const alreadyAllocated = alreadyLinkedMap.get(String(inv.id)) || 0;
    const availableVal = Math.max(0, val - alreadyAllocated);

    if (availableVal <= 0) return;

    const isFDType = isFD(inv.type);
    const rate = Number(inv.returnPct || 0);

    // Check if matured
    const endDate = inv.endDate || inv.maturityDate;
    const isMatured = endDate ? new Date(endDate) < now : false;

    // Opportunity 1: Low-yield FD (< 6.8%)
    if (isFDType && rate > 0 && rate < 6.8) {
      suggestions.push({
        investment: inv,
        type: "low_yield_fd",
        badge: "⚠️ Low-Yield FD",
        badgeColor: "var(--gold, #f59e0b)",
        reason: `Earns only ${rate}% p.a. (underperforms inflation). Reallocating this can fund your goal faster.`,
        availableAmount: availableVal,
        suggestedAmount: Math.min(availableVal, goal.target ? Math.max(0, goal.target - (goal.saved || 0)) : availableVal),
      });
      return;
    }

    // Opportunity 2: Matured FD ready for redeployment
    if (isFDType && isMatured) {
      suggestions.push({
        investment: inv,
        type: "matured_fd",
        badge: "⌛ Matured FD",
        badgeColor: "var(--green, #10b981)",
        reason: `This FD has already matured on ${new Date(endDate).toLocaleDateString("en-IN")}. Deploy funds toward this goal!`,
        availableAmount: availableVal,
        suggestedAmount: Math.min(availableVal, goal.target ? Math.max(0, goal.target - (goal.saved || 0)) : availableVal),
      });
      return;
    }

    // Opportunity 3: Sub-optimal / high-balance unlinked fixed income
    if (isFDType && rate >= 6.8 && availableVal >= 25000) {
      suggestions.push({
        investment: inv,
        type: "available_fd",
        badge: "🏦 Available FD",
        badgeColor: "var(--blue, #3b82f6)",
        reason: `Fixed Deposit with ${rate}% interest available to pledge or tag to this goal.`,
        availableAmount: availableVal,
        suggestedAmount: Math.min(availableVal, goal.target ? Math.max(0, goal.target - (goal.saved || 0)) : availableVal),
      });
    }
  });

  return suggestions.slice(0, 4);
}

/**
 * Links an investment to a goal immutably.
 */
export function linkInvestmentToGoal(goal, investmentId, allocatedAmount, person) {
  const currentLinked = goal.linkedInvestments || [];
  const existsIdx = currentLinked.findIndex((l) => String(l.id) === String(investmentId));

  let nextLinked;
  if (existsIdx >= 0) {
    nextLinked = currentLinked.map((l, i) =>
      i === existsIdx ? { ...l, allocatedAmount: Number(allocatedAmount), person } : l
    );
  } else {
    nextLinked = [
      ...currentLinked,
      { id: investmentId, allocatedAmount: Number(allocatedAmount), person },
    ];
  }

  return {
    ...goal,
    linkedInvestments: nextLinked,
  };
}

/**
 * Unlinks an investment from a goal immutably.
 */
export function unlinkInvestmentFromGoal(goal, investmentId) {
  const currentLinked = goal.linkedInvestments || [];
  return {
    ...goal,
    linkedInvestments: currentLinked.filter((l) => String(l.id) !== String(investmentId)),
  };
}

/**
 * Calculates per-person portfolio capacity, available investment options,
 * and funding status for a goal.
 */
export function calculatePersonPortfolioSourcing({
  person = "p1",
  personInvestments = [],
  personCash = 0,
  targetShare = 0,
  goal = {},
  allGoals = [],
}) {
  const target = Number(targetShare || 0);
  const cash = Number(personCash || 0);
  const thisGoalId = String(goal.id || "");

  // Map already allocated amounts across other goals
  const otherGoalsAllocation = new Map();
  (allGoals || []).forEach((g) => {
    if (String(g.id) === thisGoalId) return;
    (g.linkedInvestments || []).forEach((link) => {
      const cur = otherGoalsAllocation.get(String(link.id)) || 0;
      otherGoalsAllocation.set(String(link.id), cur + (Number(link.allocatedAmount) || 0));
    });
  });

  const thisGoalLinkedMap = new Map();
  (goal.linkedInvestments || []).forEach((link) => {
    if (link.person === person || (!link.person && person === "p1")) {
      thisGoalLinkedMap.set(String(link.id), Number(link.allocatedAmount) || 0);
    }
  });

  let totalPortfolioValue = 0;
  let totalAvailableToAllocate = 0;
  let totalAllocatedToThisGoal = 0;

  const availableInvestments = (personInvestments || []).map((inv) => {
    const val = getInvestmentCurrentValue(inv);
    totalPortfolioValue += val;

    const allocatedOther = otherGoalsAllocation.get(String(inv.id)) || 0;
    const isCurrentlyLinked = thisGoalLinkedMap.has(String(inv.id));
    const linkedAmount = thisGoalLinkedMap.get(String(inv.id)) || 0;
    const availableToAllocate = Math.max(0, val - allocatedOther);

    totalAvailableToAllocate += availableToAllocate;
    totalAllocatedToThisGoal += isCurrentlyLinked ? linkedAmount : 0;

    return {
      ...inv,
      currentValue: val,
      allocatedOther,
      availableToAllocate,
      isCurrentlyLinked,
      linkedAmount,
      isFD: isFD(inv.type),
      isLowYield: isFD(inv.type) && Number(inv.returnPct || 0) < 6.8,
    };
  });

  const totalFunded = cash + totalAllocatedToThisGoal;
  const shortfall = Math.max(0, target - totalFunded);
  const isSufficient = target > 0 && totalFunded >= target;
  const canFullyFundFromPortfolio = target > 0 && (cash + totalAvailableToAllocate) >= target;

  return {
    person,
    target,
    cash,
    availableInvestments,
    totalPortfolioValue,
    totalAvailableToAllocate,
    totalAllocatedToThisGoal,
    totalFunded,
    shortfall,
    isSufficient,
    canFullyFundFromPortfolio,
  };
}
