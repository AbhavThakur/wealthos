import { describe, it, expect } from "vitest";
import {
  getP1ShareRatio,
  getSharedExpenses,
  calculateSettlement,
  generateSettlementShareText,
} from "./settlement";

describe("Settlement Engine", () => {
  describe("getP1ShareRatio", () => {
    it("returns 1.0 for non-split expense", () => {
      expect(getP1ShareRatio({ isSplit: false })).toBe(1.0);
    });

    it("returns 0.5 for 50:50 split mode", () => {
      expect(getP1ShareRatio({ isSplit: true, splitMode: "50:50" })).toBe(0.5);
    });

    it("returns 0.6 for 60:40 split mode", () => {
      expect(getP1ShareRatio({ isSplit: true, splitMode: "60:40" })).toBe(0.6);
    });

    it("returns 0.4 for 40:60 split mode", () => {
      expect(getP1ShareRatio({ isSplit: true, splitMode: "40:60" })).toBe(0.4);
    });

    it("returns custom percentage accurately", () => {
      expect(
        getP1ShareRatio({ isSplit: true, splitMode: "custom", p1SharePct: 75 })
      ).toBe(0.75);
    });

    it("calculates income-proportional ratio accurately", () => {
      // P1 income: 1,50,000, P2 income: 1,00,000 => Total: 2,50,000 => P1 share: 60%
      expect(
        getP1ShareRatio(
          { isSplit: true, splitMode: "income_ratio" },
          150000,
          100000
        )
      ).toBe(0.6);
    });

    it("falls back to 0.5 if income ratio has zero total income", () => {
      expect(
        getP1ShareRatio(
          { isSplit: true, splitMode: "income_ratio" },
          0,
          0
        )
      ).toBe(0.5);
    });
  });

  describe("getSharedExpenses", () => {
    it("filters and extracts split expenses with calculated obligations", () => {
      const p1 = {
        expenses: [
          { id: 1, name: "WiFi", amount: 2000, isSplit: true, splitMode: "50:50", paidBy: "p1" },
          { id: 2, name: "Personal Shoes", amount: 5000, isSplit: false, paidBy: "p1" },
        ],
      };
      const p2 = {
        expenses: [
          { id: 3, name: "Groceries", amount: 6000, isSplit: true, splitMode: "60:40", paidBy: "p2" },
        ],
      };

      const shared = getSharedExpenses(p1, p2, null);
      expect(shared.length).toBe(2);
      expect(shared[0].name).toBe("WiFi");
      expect(shared[0].p1Obligation).toBe(1000);
      expect(shared[0].p2Obligation).toBe(1000);
      expect(shared[1].name).toBe("Groceries");
      expect(shared[1].p1Obligation).toBe(3600);
      expect(shared[1].p2Obligation).toBe(2400);
    });
  });

  describe("calculateSettlement", () => {
    it("handles 50:50 equal split correctly when P1 paid more", () => {
      // P1 paid Rent ₹40,000 (50:50)
      // P2 paid Groceries ₹12,000 (50:50)
      // Total shared: ₹52,000. Each share: ₹26,000.
      // P1 paid ₹40,000 (share ₹26,000 => +₹14,000)
      // P2 owes P1 ₹14,000.
      const p1 = {
        incomes: [{ amount: 100000 }],
        expenses: [
          {
            id: 1,
            name: "Rent",
            amount: 40000,
            isSplit: true,
            splitMode: "50:50",
            paidBy: "p1",
            expenseType: "monthly",
          },
        ],
      };
      const p2 = {
        incomes: [{ amount: 100000 }],
        expenses: [
          {
            id: 2,
            name: "Groceries",
            amount: 12000,
            isSplit: true,
            splitMode: "50:50",
            paidBy: "p2",
            expenseType: "monthly",
          },
        ],
      };

      const result = calculateSettlement(p1, p2, null, "2026-08");
      expect(result.p1PaidTotal).toBe(40000);
      expect(result.p2PaidTotal).toBe(12000);
      expect(result.totalSharedAmount).toBe(52000);
      expect(result.p1ObligationTotal).toBe(26000);
      expect(result.p2ObligationTotal).toBe(26000);
      expect(result.debtor).toBe("p2");
      expect(result.creditor).toBe("p1");
      expect(result.amountOwed).toBe(14000);
      expect(result.isSettled).toBe(false);
    });

    it("handles asymmetric custom split ratios", () => {
      // P1 paid electricity ₹10,000, split 70:30 (P1 share 7000, P2 share 3000)
      const p1 = {
        incomes: [],
        expenses: [
          {
            id: 1,
            name: "Electricity",
            amount: 10000,
            isSplit: true,
            splitMode: "custom",
            p1SharePct: 70,
            paidBy: "p1",
            expenseType: "monthly",
          },
        ],
      };
      const p2 = { incomes: [], expenses: [] };

      const result = calculateSettlement(p1, p2, null, "2026-08");
      expect(result.p1PaidTotal).toBe(10000);
      expect(result.p1ObligationTotal).toBe(7000);
      expect(result.p2ObligationTotal).toBe(3000);
      expect(result.debtor).toBe("p2");
      expect(result.creditor).toBe("p1");
      expect(result.amountOwed).toBe(3000);
    });

    it("applies recorded settlement payments and marks as settled", () => {
      const p1 = {
        incomes: [],
        expenses: [
          {
            id: 1,
            name: "Dinner",
            amount: 6000,
            isSplit: true,
            splitMode: "50:50",
            paidBy: "p1",
            expenseType: "monthly",
          },
        ],
      };
      const p2 = { incomes: [], expenses: [] };

      // Gross: P2 owes P1 ₹3,000
      // Settlement: P2 paid P1 ₹3,000 via UPI
      const shared = {
        settlements: [
          {
            id: "s1",
            date: "2026-08-15",
            from: "p2",
            to: "p1",
            amount: 3000,
            note: "UPI transfer for dinner",
          },
        ],
      };

      const result = calculateSettlement(p1, p2, shared, "2026-08");
      expect(result.grossBalance).toBe(3000);
      expect(result.settlementEffect).toBe(-3000);
      expect(result.netBalance).toBe(0);
      expect(result.amountOwed).toBe(0);
      expect(result.isSettled).toBe(true);
    });
  });

  describe("generateSettlementShareText", () => {
    it("generates WhatsApp share text with amounts and names", () => {
      const settlement = {
        month: "2026-08",
        totalSharedAmount: 50000,
        p1PaidTotal: 35000,
        p2PaidTotal: 15000,
        p1ObligationTotal: 25000,
        p2ObligationTotal: 25000,
        debtor: "p2",
        creditor: "p1",
        amountOwed: 10000,
        isSettled: false,
        expenses: [
          { name: "Rent", amount: 35000, paidBy: "p1" },
          { name: "WiFi", amount: 15000, paidBy: "p2" },
        ],
      };

      const text = generateSettlementShareText(settlement, {
        p1: "Alex",
        p2: "Sam",
      });
      expect(text).toContain("WealthOS Household Settlement");
      expect(text).toContain("Alex Paid: ₹35,000");
      expect(text).toContain("Sam Paid: ₹15,000");
      expect(text).toContain("Sam* owes *Alex*: *₹10,000*");
    });
  });
});
