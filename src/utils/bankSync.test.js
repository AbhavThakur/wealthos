import { describe, it, expect } from "vitest";
import {
  computeAccountFlows,
  isSyncPending,
  applyAccountSync,
} from "./bankSync";

describe("computeAccountFlows", () => {
  it("returns all-zero flows when no accountId is given", () => {
    expect(computeAccountFlows(null, { incomes: [], investments: [] })).toEqual(
      {
        salaryCredit: 0,
        sipDebit: 0,
        swpCredit: 0,
        net: 0,
      },
    );
  });

  it("sums linked salary credit and SIP debit into a net flow", () => {
    const data = {
      incomes: [
        { id: 1, amount: 90000, linkedAccountId: "acc1" },
        { id: 2, amount: 5000, linkedAccountId: "acc2" },
      ],
      investments: [
        {
          id: 1,
          amount: 10000,
          frequency: "monthly",
          linkedAccountId: "acc1",
        },
        {
          id: 2,
          amount: 50000,
          frequency: "onetime",
          linkedAccountId: "acc1",
        },
      ],
    };
    const flows = computeAccountFlows("acc1", data);
    expect(flows.salaryCredit).toBe(90000);
    expect(flows.sipDebit).toBe(10000); // onetime lump sum excluded
    expect(flows.swpCredit).toBe(0);
    expect(flows.net).toBe(80000);
  });

  it("matches accountId across types (number id vs string linkedAccountId from a <select>)", () => {
    // Savings account ids come from nextId() (a Number), but <select> option
    // values (and therefore linkedAccountId, set via e.target.value) are
    // always strings — flows must still match across that type difference.
    const data = {
      incomes: [{ id: 1, amount: 198555, linkedAccountId: "1" }],
      investments: [
        { id: 1, amount: 5000, frequency: "monthly", linkedAccountId: "1" },
      ],
    };
    const flows = computeAccountFlows(1, data);
    expect(flows.salaryCredit).toBe(198555);
    expect(flows.sipDebit).toBe(5000);
    expect(flows.net).toBe(193555);
  });

  it("treats an isSWP investment as a monthly credit instead of a debit", () => {
    const data = {
      incomes: [],
      investments: [
        {
          id: 1,
          amount: 20000,
          frequency: "monthly",
          linkedAccountId: "acc1",
          isSWP: true,
        },
      ],
    };
    const flows = computeAccountFlows("acc1", data);
    expect(flows.swpCredit).toBe(20000);
    expect(flows.sipDebit).toBe(0);
    expect(flows.net).toBe(20000);
  });
});

describe("isSyncPending", () => {
  it("is false when net flow is zero", () => {
    expect(isSyncPending({}, { net: 0 }, "2026-08")).toBe(false);
  });

  it("is false when already synced for the given month", () => {
    const account = { lastSyncedMonth: "2026-08" };
    expect(isSyncPending(account, { net: 5000 }, "2026-08")).toBe(false);
  });

  it("is true when there is unsynced net flow for the month", () => {
    const account = { lastSyncedMonth: "2026-07" };
    expect(isSyncPending(account, { net: 5000 }, "2026-08")).toBe(true);
  });
});

describe("applyAccountSync", () => {
  it("adds net flow to balance and stamps the sync month", () => {
    const account = { id: "acc1", balance: 10000 };
    const result = applyAccountSync(account, { net: 2500.456 }, "2026-08");
    expect(result.balance).toBe(12500.46);
    expect(result.lastSyncedMonth).toBe("2026-08");
    expect(result.id).toBe("acc1");
  });
});
