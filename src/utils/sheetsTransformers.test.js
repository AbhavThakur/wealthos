import { describe, it, expect } from "vitest";
import {
  getCategoryRuleBucket,
  toMonthlySummaryRows,
  toUnifiedTransactionRows,
  toBudgetVsActualRows,
  toInvestmentAssetRows,
  toGoalsTrackerRows,
  toNetWorthTimelineRows,
  toAIPromptsRows,
} from "./sheetsTransformers.js";

describe("Google Sheets AI Transformers", () => {
  const mockP1 = {
    incomes: [
      { id: 1, name: "Salary", amount: 150000, type: "Salary" },
      {
        id: 2,
        name: "Consulting",
        amount: 20000,
        type: "Freelance",
        incomeEntries: [{ id: 10, date: "2026-08-10", amount: 25000, note: "Q3 Bonus" }],
      },
    ],
    expenses: [
      { id: 1, name: "Rent", category: "Housing", amount: 35000, recurrence: "monthly" },
      { id: 2, name: "Groceries", category: "Food", amount: 12000, recurrence: "monthly" },
      {
        id: 3,
        name: "Flight Tickets",
        category: "Travel",
        expenseType: "onetime",
        date: "2026-08-05",
        amount: 15000,
      },
    ],
    investments: [
      { id: 1, name: "Parag Parikh Flexi Cap", type: "Mutual Fund", amount: 25000, frequency: "monthly", totalInvested: 400000, existingCorpus: 500000, app: "Groww", returnPct: 15 },
      { id: 2, name: "PPF", type: "PPF", amount: 12500, frequency: "monthly", totalInvested: 250000, existingCorpus: 300000, app: "SBI", returnPct: 7.1 },
    ],
    savingsAccounts: [
      { id: 1, bankName: "HDFC Bank", balance: 150000 },
    ],
    transactions: [
      { id: 1, date: "2026-08-01", desc: "Supermarket", amount: 2500, category: "Food" },
      { id: 2, date: "2026-08-02", desc: "Petrol", amount: 3000, category: "Transport" },
    ],
  };

  const mockP2 = {
    incomes: [{ id: 101, name: "Salary", amount: 120000, type: "Salary" }],
    expenses: [
      { id: 101, name: "Utilities & Wifi", category: "Utilities", amount: 5000, recurrence: "monthly" },
      { id: 102, name: "Dining & Swiggy", category: "Food", amount: 8000, recurrence: "monthly" },
    ],
    investments: [
      { id: 101, name: "UTI Nifty 50 Index", type: "Mutual Fund", amount: 20000, frequency: "monthly", totalInvested: 350000, existingCorpus: 400000, app: "Zerodha / Kite", returnPct: 12 },
    ],
    savingsAccounts: [
      { id: 101, bankName: "ICICI Bank", balance: 100000 },
    ],
    transactions: [
      { id: 101, date: "2026-08-03", desc: "Zomato", amount: 850, category: "Food" },
    ],
  };

  const mockShared = {
    goals: [
      { id: 1, name: "Emergency Fund", category: "Safety", target: 500000, p1Saved: 200000, p2Saved: 150000, deadline: "2026-12" },
      { id: 2, name: "Europe Trip", category: "Travel", target: 400000, p1Saved: 100000, p2Saved: 100000, deadline: "2027-06" },
    ],
    trips: [
      {
        id: 1,
        name: "Goa Weekend",
        startDate: "2026-08-15",
        amount: 25000,
        items: [
          { name: "Resort", amount: 15000, category: "Hotel", date: "2026-08-15" },
          { name: "Dinner", amount: 10000, category: "Food", date: "2026-08-16" },
        ],
      },
    ],
    netWorthHistory: [
      { date: "2026-08", assets: 2500000, liabilities: 400000 },
      { date: "2026-07", assets: 2400000, liabilities: 420000 },
      { date: "2026-06", assets: 2280000, liabilities: 440000 },
    ],
  };

  const mockPersonNames = { p1: "Abhav", p2: "Aanya" };

  it("classifies 50/30/20 rule buckets accurately", () => {
    expect(getCategoryRuleBucket("Housing")).toBe("Needs");
    expect(getCategoryRuleBucket("Food")).toBe("Needs");
    expect(getCategoryRuleBucket("Transport")).toBe("Needs");
    expect(getCategoryRuleBucket("Healthcare")).toBe("Needs");
    expect(getCategoryRuleBucket("Entertainment")).toBe("Wants");
    expect(getCategoryRuleBucket("Shopping")).toBe("Wants");
    expect(getCategoryRuleBucket("Investments")).toBe("Savings");
    expect(getCategoryRuleBucket("Mutual Fund")).toBe("Savings");
  });

  it("generates Monthly_Summary rows with full executive rollups", () => {
    const rows = toMonthlySummaryRows(mockP1, mockP2, mockShared, mockPersonNames);
    expect(rows.length).toBeGreaterThan(0);

    const augRow = rows.find((r) => r.month === "2026-08");
    expect(augRow).toBeDefined();
    expect(augRow.year).toBe(2026);
    expect(augRow.totalIncome).toBeGreaterThan(0);
    expect(augRow.totalExpenses).toBeGreaterThan(0);
    expect(augRow.p1Income).toBeGreaterThan(0);
    expect(augRow.p2Income).toBeGreaterThan(0);
    expect(augRow.needsSpent).toBeGreaterThan(0);
    expect(augRow).toHaveProperty("needsPct");
    expect(augRow).toHaveProperty("wantsPct");
    expect(augRow).toHaveProperty("monthlySurplus");
    expect(augRow.totalSips).toBe(57500); // 25000 + 12500 + 20000
    expect(augRow.netWorth).toBe(2100000); // 2500000 - 400000
  });

  it("generates All_Transactions unified ledger correctly", () => {
    const rows = toUnifiedTransactionRows(mockP1, mockP2, mockShared, mockPersonNames);
    expect(rows.length).toBeGreaterThan(0);

    const sample = rows[0];
    expect(sample).toHaveProperty("date");
    expect(sample).toHaveProperty("month");
    expect(sample).toHaveProperty("person");
    expect(sample).toHaveProperty("type");
    expect(sample).toHaveProperty("category");
    expect(sample).toHaveProperty("amount");
    expect(sample).toHaveProperty("budgetBucket");

    const tripItem = rows.find((r) => r.subcategory === "Goa Weekend");
    expect(tripItem).toBeDefined();
    expect(tripItem.person).toBe("Household");
  });

  it("generates Budget_vs_Actual matrix with variances and unbudgeted alerts", () => {
    const rows = toBudgetVsActualRows(mockP1, mockP2, mockShared, mockPersonNames);
    expect(rows.length).toBeGreaterThan(0);

    const foodRow = rows.find((r) => r.category === "Food" && r.month === "2026-08");
    expect(foodRow).toBeDefined();
    expect(foodRow.budgetedLimit).toBe(20000); // 12000 + 8000
    expect(foodRow.ruleBucket).toBe("Needs");
    expect(foodRow).toHaveProperty("status");
  });

  it("generates Investments_&_Assets with investedCorpus, currentCorpus, unrealizedGain, and returnPct", () => {
    const rows = toInvestmentAssetRows(mockP1, mockP2, mockShared, mockPersonNames);
    // 3 investments + 2 savings accounts = 5 rows
    expect(rows.length).toBe(5);

    const flexiCap = rows.find((r) => r.assetName === "Parag Parikh Flexi Cap");
    expect(flexiCap).toBeDefined();
    expect(flexiCap.owner).toBe("Abhav");
    expect(flexiCap.assetClass).toBe("Equity");
    expect(flexiCap.monthlySip).toBe(25000);
    expect(flexiCap.investedCorpus).toBe(400000);
    expect(flexiCap.currentCorpus).toBe(500000);
    expect(flexiCap.unrealizedGain).toBe(100000);
    expect(flexiCap.returnPct).toBe(15);
    expect(flexiCap).toHaveProperty("subType");
    expect(flexiCap).toHaveProperty("frequency");
    expect(flexiCap.platform).toBe("Groww");

    const ppf = rows.find((r) => r.assetName === "PPF");
    expect(ppf).toBeDefined();
    expect(ppf.assetClass).toBe("Debt / Fixed Income");
    expect(ppf.investedCorpus).toBe(250000);
    expect(ppf.currentCorpus).toBe(300000);
    expect(ppf.unrealizedGain).toBe(50000);

    const hdfc = rows.find((r) => r.assetName === "HDFC Bank Savings Account");
    expect(hdfc).toBeDefined();
    expect(hdfc.assetClass).toBe("Liquid Cash");
    expect(hdfc.investedCorpus).toBe(150000);
    expect(hdfc.currentCorpus).toBe(150000);
  });

  it("generates Goals_Tracker with completion progress, category, months remaining, and required monthly contributions", () => {
    const rows = toGoalsTrackerRows(mockP1, mockP2, mockShared);
    expect(rows.length).toBe(2);

    const emergGoal = rows.find((r) => r.goalName === "Emergency Fund");
    expect(emergGoal).toBeDefined();
    expect(emergGoal.category).toBe("Safety");
    expect(emergGoal.targetAmount).toBe(500000);
    expect(emergGoal.currentSaved).toBe(350000); // 200000 + 150000
    expect(emergGoal.progressPct).toBe(70);
    expect(emergGoal.remainingAmount).toBe(150000);
    expect(emergGoal).toHaveProperty("monthsRemaining");
    expect(emergGoal.monthlyContributionNeeded).toBeGreaterThan(0);
  });

  it("generates Net_Worth_History with MoM growth and amount calculations", () => {
    const rows = toNetWorthTimelineRows(mockP1, mockP2, mockShared);
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const aug = rows.find((r) => r.month === "2026-08");
    const jul = rows.find((r) => r.month === "2026-07");
    expect(aug).toBeDefined();
    expect(jul).toBeDefined();
    expect(aug.netWorth).toBe(2100000);
    expect(jul.netWorth).toBe(1980000);
    expect(aug.momGrowthPct).toBeCloseTo(6.1, 1);
    expect(aug.momGrowthAmount).toBe(120000); // 2100000 - 1980000
  });

  it("provides AI_Prompts_&_Formulas cheat sheet rows", () => {
    const rows = toAIPromptsRows();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows[0]).toHaveProperty("category");
    expect(rows[0]).toHaveProperty("useCase");
    expect(rows[0]).toHaveProperty("promptOrFormula");
    expect(rows[0]).toHaveProperty("targetRange");
    expect(rows[0]).toHaveProperty("expectedOutput");
  });
});
