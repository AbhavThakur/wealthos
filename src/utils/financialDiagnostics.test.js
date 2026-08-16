import { describe, it, expect } from "vitest";
import {
  calculateHouseholdMonthFinancials,
  calculateThreeTierWealth,
  inspectDataIntegrity,
  auditWorkspaceData,
} from "./financialDiagnostics";

describe("financialDiagnostics Engine", () => {
  const p1 = {
    incomes: [
      { id: 1, name: "Salary", amount: 120000, type: "salary" },
    ],
    expenses: [
      { id: 1, name: "House Rent", amount: 35000, recurrence: "monthly", category: "Living" },
      { id: 2, name: "Groceries", amount: 15000, recurrence: "monthly", category: "Food" },
    ],
    savingsAccounts: [
      { id: "sa1", bankName: "HDFC Bank", balance: 120000 },
    ],
    investments: [
      { id: "inv1", name: "Parag Parikh Flexi Cap", type: "Mutual Fund", existingCorpus: 400000 },
      { id: "inv2", name: "SBI FD", type: "FD", amount: 150000, returnPct: 6.5 },
    ],
    subscriptions: [
      { id: "sub1", name: "Netflix", amount: 649, frequency: "monthly", active: true },
    ],
  };

  const p2 = {
    incomes: [
      { id: 2, name: "Salary", amount: 80000, type: "salary" },
    ],
    expenses: [
      { id: 3, name: "Utilities", amount: 5000, recurrence: "monthly", category: "Bills" },
    ],
    savingsAccounts: [
      { id: "sa2", bankName: "ICICI Bank", balance: 80000 },
    ],
    investments: [
      { id: "inv3", name: "PPF", type: "PPF", existingCorpus: 100000 },
    ],
  };

  const shared = {
    trips: [],
    goals: [{ id: "g1", name: "Vacation", saved: 50000, target: 100000 }],
  };

  it("calculates accurate household income, expenses, and true monthly savings surplus", () => {
    const fin = calculateHouseholdMonthFinancials({
      p1,
      p2,
      shared,
      monthYm: "2026-08",
      personNames: { p1: "Abhav", p2: "Aanya" },
    });

    // Total Income = 1.2L + 80k = 2,00,000
    expect(fin.totalIncome).toBe(200000);

    // Total Expenses = 35k rent + 15k groceries + 5k utilities + 649 netflix = 55,649
    expect(fin.totalExpenses).toBe(55649);

    // Monthly Surplus = 2,00,000 - 55,649 = 1,44,351
    expect(fin.monthlySurplus).toBe(144351);

    // Savings rate = (144351 / 200000) * 100 = 72%
    expect(fin.savingsRate).toBe(72);
    expect(fin.isBudgetHealthy).toBe(true);
    expect(fin.statusTitle).toBe("Outstanding Savings Rate!");
  });

  it("calculates complete 3-tier wealth capturing all savings bank accounts and liquid funds", () => {
    const wealth = calculateThreeTierWealth({
      p1,
      p2,
      shared,
      personNames: { p1: "Abhav", p2: "Aanya" },
    });

    // Liquid cash = 1.2L (HDFC) + 80K (ICICI) + 50K (Goal Cash) = 2,50,000
    expect(wealth.liquidCash).toBe(250000);
    expect(wealth.liquidItems.length).toBe(3);

    // Wealth growers = 4,00,000 (Parag Parikh)
    expect(wealth.wealthGrowers).toBe(400000);

    // Guaranteed safe = 1.5L (SBI FD) + 1L (PPF) = 2,50,000
    expect(wealth.guaranteedSafe).toBe(250000);

    // Total = 2.5L + 4L + 2.5L = 9,00,000
    expect(wealth.total).toBe(900000);
  });

  it("inspects data integrity and audits workspace data cleanly", () => {
    const corruptedP1 = {
      ...p1,
      savingsAccounts: [{ id: "sa_bad", bankName: "SBI", balance: -500 }],
    };
    const check = inspectDataIntegrity({ p1: corruptedP1, p2, shared });
    expect(check.isHealthy).toBe(false);
    expect(check.anomalies.length).toBe(1);

    const audit = auditWorkspaceData({ p1, p2, shared, monthYm: "2026-08" });
    expect(audit.summary.totalIncome).toBe("₹2,00,000");
    expect(audit.summary.totalExpenses).toBe("₹55,649");
    expect(audit.summary.monthlySurplus).toBe("₹1,44,351");
    expect(audit.summary.liquidCash).toBe("₹2,50,000");
  });
});
