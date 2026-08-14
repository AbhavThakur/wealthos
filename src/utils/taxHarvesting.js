// ── LTCG ₹1.25 Lakh Tax Harvesting Advisor (Budget 2024 / FY 2024-25) ────────

export const LTCG_ANNUAL_EXEMPTION_LIMIT = 125000; // ₹1.25 Lakh
export const LTCG_TAX_RATE = 0.125; // 12.5% Section 112A

/**
 * Checks if an investment holding is eligible for Long Term Capital Gains (> 365 days for Equity)
 */
export function isLongTermHolding(inv, referenceDate = new Date()) {
  if (!inv) return false;
  // Non-equity investments (Debt/Liquid/FD) are taxed at slab rates and not Section 112A
  const isEquity = !inv.type || inv.type === "Mutual Fund" || inv.type === "Stock" || inv.type === "Equity";
  if (!isEquity) return false;

  if (!inv.startDate) return true; // Default to eligible if holding date not specified

  const start = new Date(inv.startDate);
  if (isNaN(start.getTime())) return true;

  const diffMs = referenceDate.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 365;
}

/**
 * Analyzes investment portfolio and generates optimal LTCG Tax Harvesting plan
 */
export function calculateLTCGHarvestingPlan(investments = [], harvestedSoFarThisFY = 0) {
  const remainingLimit = Math.max(0, LTCG_ANNUAL_EXEMPTION_LIMIT - harvestedSoFarThisFY);

  let totalUnrealizedLTCG = 0;
  const eligibleHoldings = [];

  for (const inv of investments) {
    const curVal = Number(inv.existingCorpus) || Number(inv.currentValue) || Number(inv.cur) || 0;
    let costBasis = Number(inv.invested) || Number(inv.costBasis) || 0;
    if (!costBasis && Number(inv.amount) > 0 && inv.frequency === "onetime") {
      costBasis = Number(inv.amount);
    }
    const units = Number(inv.units) || (curVal > 0 && Number(inv.latestNav) > 0 ? curVal / Number(inv.latestNav) : 0);
    const latestNav = Number(inv.latestNav) || (units > 0 ? curVal / units : 0);

    const gain = curVal > costBasis && costBasis > 0 ? curVal - costBasis : 0;
    const isLongTerm = isLongTermHolding(inv);

    if (gain > 0 && isLongTerm) {
      totalUnrealizedLTCG += gain;
      const gainRatio = costBasis > 0 ? gain / costBasis : 0;
      const gainPerUnit = units > 0 ? gain / units : 0;

      eligibleHoldings.push({
        id: inv.id,
        name: inv.name,
        type: inv.type || "Mutual Fund",
        folio: inv.folio || "N/A",
        units,
        latestNav,
        curVal,
        costBasis,
        gain,
        gainRatio,
        gainPerUnit,
      });
    }
  }

  // Sort by highest unrealized gain to harvest most efficient holdings first
  eligibleHoldings.sort((a, b) => b.gain - a.gain);

  let allocatedGain = 0;
  const recommendations = [];

  for (const item of eligibleHoldings) {
    if (allocatedGain >= remainingLimit) break;

    const availableRoom = remainingLimit - allocatedGain;
    const harvestableGainFromThis = Math.min(item.gain, availableRoom);

    let unitsToRedeem = item.units;
    let redemptionValue = item.curVal;

    if (harvestableGainFromThis < item.gain && item.gainPerUnit > 0) {
      unitsToRedeem = Math.round((harvestableGainFromThis / item.gainPerUnit) * 100) / 100;
      redemptionValue = Math.round(unitsToRedeem * item.latestNav);
    }

    allocatedGain += harvestableGainFromThis;

    recommendations.push({
      id: item.id,
      name: item.name,
      folio: item.folio,
      gainToHarvest: Math.round(harvestableGainFromThis),
      unitsToRedeem,
      redemptionValue: Math.round(redemptionValue),
      estimatedTaxSaved: Math.round(harvestableGainFromThis * LTCG_TAX_RATE),
      action: "Redeem and immediately reinvest to step-up cost basis to current NAV.",
    });
  }

  const totalHarvestableGain = Math.round(allocatedGain);
  const totalTaxSaved = Math.round(totalHarvestableGain * LTCG_TAX_RATE);
  const percentUtilized = Math.min(100, Math.round((totalHarvestableGain / LTCG_ANNUAL_EXEMPTION_LIMIT) * 100));

  return {
    annualExemptionLimit: LTCG_ANNUAL_EXEMPTION_LIMIT,
    harvestedSoFarThisFY,
    remainingLimit,
    totalUnrealizedLTCG: Math.round(totalUnrealizedLTCG),
    totalHarvestableGain,
    totalTaxSaved,
    percentUtilized,
    recommendations,
    eligibleHoldingsCount: eligibleHoldings.length,
  };
}
