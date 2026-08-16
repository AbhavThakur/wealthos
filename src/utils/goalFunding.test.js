import { describe, it, expect } from "vitest";
import {
  getInvestmentCurrentValue,
  getGoalTotalFunding,
  findGoalFundingSuggestions,
  linkInvestmentToGoal,
  unlinkInvestmentFromGoal,
  calculatePersonPortfolioSourcing,
} from "./goalFunding";

describe("goalFunding Utility", () => {
  const mockInvestments = [
    {
      id: "inv1",
      name: "SBI 1-Year FD",
      type: "FD",
      amount: 100000,
      returnPct: 5.5,
      startDate: "2024-01-01",
      endDate: "2025-01-01",
    },
    {
      id: "inv2",
      name: "HDFC High Yield FD",
      type: "FD",
      amount: 200000,
      returnPct: 7.25,
      startDate: "2025-01-01",
      endDate: "2026-01-01",
    },
    {
      id: "inv3",
      name: "Parag Parikh Flexi Cap",
      type: "Mutual Fund",
      existingCorpus: 350000,
      returnPct: 14,
    },
  ];

  it("calculates investment current value for FDs and Mutual Funds", () => {
    const fdVal = getInvestmentCurrentValue(mockInvestments[0]);
    expect(fdVal).toBeGreaterThan(100000);

    const mfVal = getInvestmentCurrentValue(mockInvestments[2]);
    expect(mfVal).toBe(350000);
  });

  it("calculates total funding combining cash savings and linked investments", () => {
    const goal = {
      id: "g1",
      name: "Europe Vacation",
      target: 300000,
      saved: 50000,
      linkedInvestments: [
        { id: "inv1", allocatedAmount: 100000 },
      ],
    };

    const funding = getGoalTotalFunding(goal, mockInvestments);
    expect(funding.cashSaved).toBe(50000);
    expect(funding.investmentsSaved).toBe(100000);
    expect(funding.totalSaved).toBe(150000);
    expect(funding.pct).toBe(50);
    expect(funding.remaining).toBe(150000);
    expect(funding.linkedDetails.length).toBe(1);
    expect(funding.linkedDetails[0].name).toBe("SBI 1-Year FD");
  });

  it("finds low-yield and matured FD suggestions for goal funding", () => {
    const goal = {
      id: "g1",
      name: "House Renovation",
      target: 500000,
      saved: 0,
      linkedInvestments: [],
    };

    const suggestions = findGoalFundingSuggestions(mockInvestments, goal, [goal]);
    expect(suggestions.length).toBeGreaterThan(0);
    const lowYield = suggestions.find((s) => s.type === "low_yield_fd" || s.type === "matured_fd");
    expect(lowYield).toBeDefined();
    expect(lowYield.investment.name).toBe("SBI 1-Year FD");
  });

  it("links and unlinks investments immutably", () => {
    const goal = { id: "g1", linkedInvestments: [] };
    const linked = linkInvestmentToGoal(goal, "inv1", 50000, "p1");
    expect(linked.linkedInvestments.length).toBe(1);
    expect(linked.linkedInvestments[0].allocatedAmount).toBe(50000);

    const unlinked = unlinkInvestmentFromGoal(linked, "inv1");
    expect(unlinked.linkedInvestments.length).toBe(0);
  });

  it("calculates per-person portfolio capacity, allocation, and sufficiency correctly", () => {
    const personInvestments = [
      { id: "inv1", name: "FD 1", type: "FD", amount: 100000, returnPct: 6 },
      { id: "inv2", name: "MF 1", type: "Mutual Fund", existingCorpus: 200000, returnPct: 12 },
    ];
    const goal = {
      id: "g1",
      linkedInvestments: [{ id: "inv1", allocatedAmount: 100000, person: "p1" }],
    };

    const res = calculatePersonPortfolioSourcing({
      person: "p1",
      personInvestments,
      personCash: 50000,
      targetShare: 250000,
      goal,
      allGoals: [goal],
    });

    expect(res.cash).toBe(50000);
    expect(res.totalAllocatedToThisGoal).toBe(100000);
    expect(res.totalFunded).toBe(150000);
    expect(res.shortfall).toBe(100000);
    expect(res.isSufficient).toBe(false);
    expect(res.canFullyFundFromPortfolio).toBe(true);
  });
});
