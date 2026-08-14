import { describe, it, expect } from "vitest";
import {
  parseBankStatement,
  predictStatementCategory,
  normalizeStatementDate,
  flagDuplicateTransactions,
} from "./statementParser";

describe("Smart Statement Parser & Deduplication", () => {
  it("normalizes various bank date formats", () => {
    expect(normalizeStatementDate("2026-08-15")).toBe("2026-08-15");
    expect(normalizeStatementDate("15/08/2026")).toBe("2026-08-15");
    expect(normalizeStatementDate("15-08-2026")).toBe("2026-08-15");
    expect(normalizeStatementDate("15 Aug 2026")).toBe("2026-08-15");
    expect(normalizeStatementDate("15-AUG-2026")).toBe("2026-08-15");
  });

  it("predicts categories based on merchant narrations", () => {
    expect(predictStatementCategory("UPI/Swiggy/order123", -450)).toBe("Food & Dining");
    expect(predictStatementCategory("Blinkit Commerce Pvt", -1200)).toBe("Groceries");
    expect(predictStatementCategory("Uber Trip Mumbai", -350)).toBe("Transport");
    expect(predictStatementCategory("Netflix India Subscription", -649)).toBe("Entertainment");
    expect(predictStatementCategory("Apollo Pharmacy Bangalore", -890)).toBe("Health & Medical");
    expect(predictStatementCategory("HDFC Housing Loan EMI", -45000)).toBe("EMI");
    expect(predictStatementCategory("Monthly Salary NEFT CR", 150000)).toBe("Income");
  });

  it("parses HDFC/ICICI CSV statement lines into structured transactions", () => {
    const csvData = `
Date,Narration,Withdrawal,Deposit
10/08/2026,UPI-SWIGGY-12345,450.00,
11/08/2026,UBER RIDES MUMBAI,320.00,
12/08/2026,SALARY CREDIT AUG, ,180000.00
    `.trim();

    const txns = parseBankStatement(csvData);
    expect(txns.length).toBe(3);

    expect(txns[0].date).toBe("2026-08-10");
    expect(txns[0].amount).toBe(-450);
    expect(txns[0].category).toBe("Food & Dining");

    expect(txns[1].date).toBe("2026-08-11");
    expect(txns[1].amount).toBe(-320);
    expect(txns[1].category).toBe("Transport");

    expect(txns[2].date).toBe("2026-08-12");
    expect(txns[2].amount).toBe(180000);
    expect(txns[2].category).toBe("Income");
  });

  it("flags duplicate transactions against existing ledger entries", () => {
    const parsed = [
      { date: "2026-08-10", desc: "Swiggy order", amount: -450 },
      { date: "2026-08-14", desc: "Starbucks Coffee", amount: -380 },
    ];

    const existingTxns = [
      { date: "2026-08-10", desc: "Swiggy lunch", amount: -450 },
    ];

    const flagged = flagDuplicateTransactions(parsed, existingTxns, []);
    expect(flagged.length).toBe(2);

    expect(flagged[0].isDuplicate).toBe(true);
    expect(flagged[0].selected).toBe(false);

    expect(flagged[1].isDuplicate).toBe(false);
    expect(flagged[1].selected).toBe(true);
  });
});
