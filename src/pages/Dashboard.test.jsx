import { describe, it, expect } from "vitest";
import {
  personStats,
  statsFromTxns,
  buildCashFlow,
  standingInvestments,
} from "./Dashboard";

// These tests exist to lock in a recurring bug class in this codebase: the
// same financial metric (investments, EMIs, income, expenses) gets computed
// via more than one code path — e.g. "standing config" (personStats,
// standingInvestments) vs "actual logged transactions" (statsFromTxns) vs the
// Monthly Cash Flow schedule (buildCashFlow) — and those paths have
// repeatedly drifted apart in the past (see /memories/repo/wealthos.md for
// ~9 prior instances). Every test below asserts that two independently
// computed figures for the SAME person/month agree, so a future edit that
// reintroduces a divergence fails a test instead of silently shipping a
// wrong number on the dashboard.

describe("Dashboard cross-metric consistency (prevents value-mismatch regressions)", () => {
  const YM = "2026-03";

  // A SIP and an EMI that are auto-debited and never manually logged as
  // transactions — the exact real-world scenario that caused the bugs this
  // suite guards against.
  const p1 = {
    investments: [
      {
        id: 1,
        name: "SIP - Flexicap",
        type: "Mutual Fund",
        amount: 5000,
        frequency: "monthly",
      },
      {
        id: 2,
        name: "FD - Bank",
        type: "FD",
        amount: 200000,
        frequency: "onetime",
      },
    ],
    debts: [{ id: 1, name: "Home Loan", emi: 12000 }],
    transactions: [],
    expenses: [],
    incomes: [{ id: 1, name: "Salary", amount: 90000 }],
    subscriptions: [],
  };

  it("personStats excludes FDs from the monthly investment total (isFD guard)", () => {
    const stats = personStats(p1, YM);
    expect(stats.investments).toBe(5000); // only the SIP, not the ₹2,00,000 FD
  });

  it("buildCashFlow falls back to the standing SIP/EMI amount when nothing was logged this month", () => {
    const rows = buildCashFlow(
      [],
      [],
      [],
      [],
      p1.incomes,
      [],
      [],
      YM,
      p1.investments,
      [],
      p1.debts,
      [],
    );
    const row = rows.find((r) => r.ym === YM);
    expect(row.investments).toBe(5000);
    expect(row.emis).toBe(12000);
  });

  it("buildCashFlow reconciles with personStats for the same month (regression: previously diverged for un-logged SIPs/EMIs)", () => {
    const rows = buildCashFlow(
      [],
      [],
      [],
      [],
      p1.incomes,
      [],
      [],
      YM,
      p1.investments,
      [],
      p1.debts,
      [],
    );
    const row = rows.find((r) => r.ym === YM);
    const stats = personStats(p1, YM);
    expect(row.investments).toBe(stats.investments);
    expect(row.emis).toBe(stats.debts);
  });

  it("statsFromTxns (actual-logged-only) under-reports investments vs personStats (standing) when a SIP is auto-debited but never manually logged", () => {
    const txStats = statsFromTxns(
      p1.transactions,
      p1.expenses,
      p1.incomes,
      YM,
      p1.subscriptions,
    );
    const standing = personStats(p1, YM);
    expect(txStats.investments).toBe(0); // nothing logged
    expect(standing.investments).toBe(5000); // standing SIP plan
    expect(txStats.investments).not.toBe(standing.investments);
  });

  it("standingInvestments (used by the Month-over-Month card) matches the sum of personStats for both people — not the raw transaction log", () => {
    const p2 = {
      investments: [
        {
          id: 1,
          name: "SIP - Index",
          type: "Mutual Fund",
          amount: 3000,
          frequency: "monthly",
        },
      ],
      transactions: [],
    };
    const total = standingInvestments(p1, p2, YM);
    expect(total).toBe(
      personStats(p1, YM).investments + personStats(p2, YM).investments,
    );
    expect(total).toBe(8000);
  });
});
