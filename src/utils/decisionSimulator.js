// ── Life Decision Simulator & What-If Projection Engine ───────────────────────

/**
 * Calculates Home Purchase feasibility, EMI schedule, and runway impact
 */
export function calculateHomePurchaseImpact({
  propertyValue = 10000000, // ₹1 Cr
  downPaymentPct = 20,
  interestRate = 8.5,
  tenureYears = 20,
  stampDutyPct = 6,
  currentLiquidCorpus = 3000000,
  monthlyIncome = 250000,
  monthlyExpenses = 80000,
}) {
  const downPayment = Math.round(propertyValue * (downPaymentPct / 100));
  const stampDuty = Math.round(propertyValue * (stampDutyPct / 100));
  const upfrontCost = downPayment + stampDuty;
  const remainingLiquidCorpus = currentLiquidCorpus - upfrontCost;

  const loanAmount = Math.max(0, propertyValue - downPayment);
  const monthlyRate = interestRate / (12 * 100);
  const totalMonths = tenureYears * 12;

  let emi = 0;
  if (loanAmount > 0 && monthlyRate > 0 && totalMonths > 0) {
    emi = Math.round(
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
    );
  }

  const totalLoanPayment = emi * totalMonths;
  const totalInterest = Math.max(0, totalLoanPayment - loanAmount);

  const baselineSurplus = monthlyIncome - monthlyExpenses;
  const baselineSavingsRate = monthlyIncome > 0 ? (baselineSurplus / monthlyIncome) * 100 : 0;

  const newMonthlyExpenses = monthlyExpenses + emi;
  const newMonthlySurplus = monthlyIncome - newMonthlyExpenses;
  const newSavingsRate = monthlyIncome > 0 ? (newMonthlySurplus / monthlyIncome) * 100 : 0;
  const emiToIncomeRatio = monthlyIncome > 0 ? (emi / monthlyIncome) * 100 : 0;

  let verdict = "safe";
  let verdictMessage = "Comfortably affordable within household cash flow.";
  let riskFactors = [];

  if (upfrontCost > currentLiquidCorpus) {
    verdict = "danger";
    verdictMessage = "Upfront down payment & stamp duty exceed total liquid corpus!";
    riskFactors.push(`Shortfall of ₹${(upfrontCost - currentLiquidCorpus).toLocaleString("en-IN")} in upfront cash.`);
  }

  if (emiToIncomeRatio > 45) {
    verdict = "danger";
    verdictMessage = "EMI exceeds 45% of monthly income (high default risk).";
    riskFactors.push(`EMI consumes ${emiToIncomeRatio.toFixed(1)}% of your monthly pay.`);
  } else if (emiToIncomeRatio > 35) {
    if (verdict !== "danger") verdict = "warning";
    riskFactors.push(`EMI is ${emiToIncomeRatio.toFixed(1)}% of income (tight budget buffer).`);
  }

  if (remainingLiquidCorpus > 0 && remainingLiquidCorpus < monthlyExpenses * 3) {
    if (verdict !== "danger") verdict = "warning";
    riskFactors.push("Emergency fund drops below 3 months of basic living expenses.");
  }

  return {
    propertyValue,
    downPayment,
    stampDuty,
    upfrontCost,
    remainingLiquidCorpus,
    loanAmount,
    emi,
    totalInterest,
    totalLoanPayment,
    emiToIncomeRatio: Math.round(emiToIncomeRatio * 10) / 10,
    baselineSavingsRate: Math.round(baselineSavingsRate * 10) / 10,
    newSavingsRate: Math.round(newSavingsRate * 10) / 10,
    newMonthlySurplus,
    verdict,
    verdictMessage,
    riskFactors,
  };
}

/**
 * Calculates Career Sabbatical / Study / Startup Runway
 */
export function calculateSabbaticalImpact({
  months = 6,
  monthlyExpenses = 80000,
  currentLiquidCorpus = 1500000,
  monthlyPassiveIncome = 0,
  bufferMarginPct = 15,
}) {
  const netMonthlyBurn = Math.max(0, monthlyExpenses - monthlyPassiveIncome);
  const bufferedBurn = netMonthlyBurn * (1 + bufferMarginPct / 100);
  const totalCost = Math.round(bufferedBurn * months);
  const remainingCorpus = currentLiquidCorpus - totalCost;
  const maxRunwayMonths = bufferedBurn > 0 ? Math.floor(currentLiquidCorpus / bufferedBurn) : 999;

  let verdict = "safe";
  let verdictMessage = `You have ${maxRunwayMonths} months of runway available for this sabbatical.`;
  let riskFactors = [];

  if (totalCost > currentLiquidCorpus) {
    verdict = "danger";
    verdictMessage = "Liquid savings are insufficient to cover this sabbatical duration!";
    riskFactors.push(`Shortfall of ₹${(totalCost - currentLiquidCorpus).toLocaleString("en-IN")}. Max safe runway is ${maxRunwayMonths} months.`);
  } else if (remainingCorpus < monthlyExpenses * 3) {
    verdict = "warning";
    verdictMessage = "Sabbatical feasible, but depletes emergency cushion below 3 months.";
    riskFactors.push(`Post-sabbatical emergency fund will be only ₹${remainingCorpus.toLocaleString("en-IN")}.`);
  }

  return {
    months,
    netMonthlyBurn,
    totalCost,
    remainingCorpus,
    maxRunwayMonths,
    verdict,
    verdictMessage,
    riskFactors,
  };
}

/**
 * Calculates Financial Independence & Retire Early (FIRE) metrics
 */
export function projectFIRETimeline({
  currentNetWorth = 5000000,
  annualExpenses = 960000,
  annualSavings = 1200000,
  expectedReturnPct = 11,
  inflationPct = 6,
  swrPct = 3.5,
}) {
  const realReturn = (1 + expectedReturnPct / 100) / (1 + inflationPct / 100) - 1;
  const targetCorpus = Math.round(annualExpenses / (swrPct / 100)); // e.g. 28.5x annual expenses for 3.5% SWR

  let corpus = currentNetWorth;
  let years = 0;
  const maxYears = 40;
  const trajectory = [{ year: 0, corpus: Math.round(corpus), target: targetCorpus }];

  while (corpus < targetCorpus && years < maxYears) {
    years++;
    corpus = corpus * (1 + realReturn) + annualSavings;
    trajectory.push({
      year: years,
      corpus: Math.round(corpus),
      target: targetCorpus,
    });
  }

  const reachedFIRE = corpus >= targetCorpus;

  return {
    targetCorpus,
    currentProgressPct: Math.min(100, Math.round((currentNetWorth / targetCorpus) * 1000) / 10),
    yearsToFIRE: reachedFIRE ? years : `> ${maxYears}`,
    trajectory,
    safeMonthlyWithdrawal: Math.round((targetCorpus * (swrPct / 100)) / 12),
  };
}
