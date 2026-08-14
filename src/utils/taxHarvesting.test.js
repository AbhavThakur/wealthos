import { describe, it, expect } from "vitest";
import {
  isLongTermHolding,
  calculateLTCGHarvestingPlan,
  LTCG_ANNUAL_EXEMPTION_LIMIT,
} from "./taxHarvesting";

describe("LTCG ₹1.25L Tax Harvesting Advisor", () => {
  it("accurately detects long term equity holdings", () => {
    const oldInv = {
      type: "Mutual Fund",
      startDate: "2024-01-01",
    };
    expect(isLongTermHolding(oldInv, new Date("2026-08-14"))).toBe(true);

    const fdInv = {
      type: "Fixed Deposit",
      startDate: "2024-01-01",
    };
    expect(isLongTermHolding(fdInv)).toBe(false);
  });

  it("calculates optimal harvesting plan up to ₹1.25 Lakh limit", () => {
    const investments = [
      {
        id: 1,
        name: "Parag Parikh Flexi Cap",
        type: "Mutual Fund",
        existingCorpus: 300000,
        invested: 200000, // ₹1,00,000 gain
        units: 3000,
        startDate: "2024-01-01",
      },
      {
        id: 2,
        name: "UTI Nifty 50",
        type: "Mutual Fund",
        existingCorpus: 200000,
        invested: 150000, // ₹50,000 gain
        units: 2000,
        startDate: "2024-01-01",
      },
    ];

    const plan = calculateLTCGHarvestingPlan(investments, 0);

    expect(plan.annualExemptionLimit).toBe(LTCG_ANNUAL_EXEMPTION_LIMIT);
    expect(plan.totalUnrealizedLTCG).toBe(150000);
    expect(plan.totalHarvestableGain).toBe(125000); // capped at 1.25L
    expect(plan.totalTaxSaved).toBe(Math.round(125000 * 0.125)); // ₹15,625
    expect(plan.recommendations.length).toBe(2);
    expect(plan.recommendations[0].gainToHarvest).toBe(100000);
    expect(plan.recommendations[1].gainToHarvest).toBe(25000); // fills the remaining room
  });
});
