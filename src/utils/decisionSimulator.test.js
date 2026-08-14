import { describe, it, expect } from "vitest";
import {
  calculateHomePurchaseImpact,
  calculateSabbaticalImpact,
  projectFIRETimeline,
} from "./decisionSimulator";

describe("Life Decision Simulator Engine", () => {
  it("calculates home purchase EMI, upfront costs, and safe verdict", () => {
    const result = calculateHomePurchaseImpact({
      propertyValue: 8000000, // 80 Lakhs
      downPaymentPct: 20,
      interestRate: 8.5,
      tenureYears: 20,
      stampDutyPct: 6,
      currentLiquidCorpus: 3000000,
      monthlyIncome: 250000,
      monthlyExpenses: 80000,
    });

    expect(result.downPayment).toBe(1600000);
    expect(result.stampDuty).toBe(480000);
    expect(result.upfrontCost).toBe(2080000);
    expect(result.remainingLiquidCorpus).toBe(920000);
    expect(result.loanAmount).toBe(6400000);
    expect(result.emi).toBeGreaterThan(50000);
    expect(result.verdict).toBe("safe");
  });

  it("flags danger when upfront home costs exceed liquid savings", () => {
    const result = calculateHomePurchaseImpact({
      propertyValue: 15000000, // 1.5 Cr
      downPaymentPct: 25,
      currentLiquidCorpus: 2000000, // Only 20L
      monthlyIncome: 150000,
      monthlyExpenses: 80000,
    });

    expect(result.verdict).toBe("danger");
    expect(result.riskFactors.length).toBeGreaterThan(0);
  });

  it("calculates sabbatical burn and maximum runway months", () => {
    const result = calculateSabbaticalImpact({
      months: 6,
      monthlyExpenses: 100000,
      currentLiquidCorpus: 1200000,
      monthlyPassiveIncome: 20000,
      bufferMarginPct: 0,
    });

    expect(result.netMonthlyBurn).toBe(80000);
    expect(result.totalCost).toBe(480000);
    expect(result.remainingCorpus).toBe(720000);
    expect(result.maxRunwayMonths).toBe(15);
    expect(result.verdict).toBe("safe");
  });

  it("projects FIRE target corpus and years to financial independence", () => {
    const fire = projectFIRETimeline({
      currentNetWorth: 10000000, // 1 Cr
      annualExpenses: 1200000,
      annualSavings: 1500000,
      expectedReturnPct: 11,
      inflationPct: 6,
      swrPct: 4,
    });

    expect(fire.targetCorpus).toBe(30000000); // 3 Cr
    expect(fire.currentProgressPct).toBe(33.3);
    expect(fire.yearsToFIRE).toBeGreaterThan(0);
    expect(fire.trajectory.length).toBeGreaterThan(1);
  });
});
