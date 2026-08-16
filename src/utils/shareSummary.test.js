import { describe, it, expect, vi } from "vitest";
import { generateMonthlyShareText, shareToWhatsApp, copySummaryToClipboard } from "./shareSummary";

describe("shareSummary Utility", () => {
  const p1 = {
    incomes: [{ id: 1, amount: 100000 }],
    expenses: [{ id: 1, amount: 40000 }],
    investments: [
      { id: "i1", name: "Flexi Cap", existingCorpus: 300000, frequency: "monthly", sipMonthly: 15000, returnPct: 14 },
    ],
  };
  const p2 = {
    incomes: [{ id: 2, amount: 80000 }],
    expenses: [{ id: 2, amount: 30000 }],
    investments: [],
  };
  const shared = {
    goals: [{ id: "g1", name: "Europe Vacation", target: 200000, p1Saved: 50000, p2Saved: 50000 }],
  };

  it("generates structured monthly review text for WhatsApp sharing", () => {
    const text = generateMonthlyShareText({
      p1,
      p2,
      shared,
      monthYm: "2026-08",
      personNames: { p1: "Abhav", p2: "Aanya" },
    });

    expect(text).toContain("WealthOS Monthly Snapshot (August 2026)");
    expect(text).toContain("Monthly Cashflow");
    expect(text).toContain("₹70,000 spent");
    expect(text).toContain("₹1,80,000 income");
    expect(text).toContain("Investments");
    expect(text).toContain("Europe Vacation");
    expect(text).toContain("Abhav & Aanya");
  });

  it("copies summary to clipboard using navigator.clipboard", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(true),
      },
    });

    const success = await copySummaryToClipboard("Hello WealthOS");
    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hello WealthOS");
  });

  it("opens WhatsApp url when shareToWhatsApp is called", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});
    shareToWhatsApp("Hello Test");
    expect(openSpy).toHaveBeenCalledWith(
      "https://wa.me/?text=Hello%20Test",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });
});
