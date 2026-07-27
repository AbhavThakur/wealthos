import { describe, expect, it } from "vitest";
import { calculateNetWorth } from "./netWorth";

describe("calculateNetWorth", () => {
  it("combines investment, savings, manual assets, debts and liabilities", () => {
    const result = calculateNetWorth(
      {
        investments: [
          {
            name: "Index fund",
            type: "Mutual Fund",
            frequency: "monthly",
            existingCorpus: 100000.25,
          },
        ],
        savingsAccounts: [{ balance: 50000.1 }, { balance: 0.2 }],
        assets: [{ name: "Property", value: 5000000 }],
        debts: [{ name: "Home loan", outstanding: 1000000.25 }],
        liabilities: [{ name: "Card", value: 10000.1 }],
      },
      new Date("2026-07-27T00:00:00Z"),
    );

    expect(result.assets).toBe(5150000.3);
    expect(result.liabilities).toBe(1010000.35);
    expect(result.net).toBe(4139999.95);
  });

  it("uses an entered current value for one-time holdings", () => {
    const result = calculateNetWorth({
      investments: [
        {
          name: "One-time fund",
          type: "Mutual Fund",
          frequency: "onetime",
          amount: 80000,
          existingCorpus: 100000,
          returnPct: 12,
          startDate: "2020-01-01",
        },
      ],
    });

    expect(result.assets).toBe(100000);
  });
});
