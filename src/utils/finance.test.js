/**
 * Unit tests for finance.js — critical calculation accuracy.
 * These tests ensure financial calculations are correct before deployment.
 */
import { describe, it, expect } from "vitest";
import {
  fmt,
  fmtCr,
  nextId,
  sipCorpus,
  lumpCorpus,
  totalCorpus,
  ppfCorpus,
  fdCorpus,
  freqToMonthly,
} from "./finance";

describe("fmt — Indian currency formatting", () => {
  it("formats positive numbers with ₹ prefix", () => {
    expect(fmt(1000)).toBe("₹1,000");
    expect(fmt(100000)).toBe("₹1,00,000");
    expect(fmt(10000000)).toBe("₹1,00,00,000");
  });

  it("handles negative numbers as absolute value", () => {
    expect(fmt(-5000)).toBe("₹5,000");
  });

  it("handles zero and undefined", () => {
    expect(fmt(0)).toBe("₹0");
    expect(fmt()).toBe("₹0");
  });
});

describe("fmtCr — crore/lakh formatting", () => {
  it("formats values >= 1 Cr", () => {
    expect(fmtCr(10000000)).toBe("₹1.00 Cr");
    expect(fmtCr(25000000)).toBe("₹2.50 Cr");
  });

  it("formats values >= 1 L but < 1 Cr", () => {
    expect(fmtCr(100000)).toBe("₹1.0 L");
    expect(fmtCr(500000)).toBe("₹5.0 L");
  });

  it("formats values < 1 L as regular fmt()", () => {
    expect(fmtCr(50000)).toBe("₹50,000");
  });
});

describe("nextId — unique ID generator", () => {
  it("returns 1 for empty array", () => {
    expect(nextId([])).toBe(1);
  });

  it("returns max + 1 for existing items", () => {
    expect(nextId([{ id: 1 }, { id: 5 }, { id: 3 }])).toBe(6);
  });

  it("handles items without id field", () => {
    expect(nextId([{}, { id: 2 }])).toBe(3);
  });
});

describe("sipCorpus — SIP growth calculation", () => {
  it("calculates SIP corpus with compound interest", () => {
    // ₹10,000/month at 12% for 10 years
    const corpus = sipCorpus(10000, 12, 10);
    // Expected: ~₹23.23 lakhs (verified with multiple calculators)
    expect(corpus).toBeGreaterThan(2300000);
    expect(corpus).toBeLessThan(2400000);
  });

  it("returns simple multiplication when rate is 0", () => {
    expect(sipCorpus(10000, 0, 10)).toBe(10000 * 120);
  });
});

describe("lumpCorpus — lump sum growth", () => {
  it("calculates compound growth correctly", () => {
    // ₹1,00,000 at 10% for 5 years = ₹1,61,051
    const corpus = lumpCorpus(100000, 10, 5);
    expect(Math.round(corpus)).toBe(161051);
  });

  it("returns principal when rate is 0", () => {
    expect(lumpCorpus(100000, 0, 10)).toBe(100000);
  });
});

describe("totalCorpus — combined existing + SIP", () => {
  it("combines lump sum and SIP growth", () => {
    const total = totalCorpus(100000, 10000, 12, 10);
    const lump = lumpCorpus(100000, 12, 10);
    const sip = sipCorpus(10000, 12, 10);
    expect(total).toBeCloseTo(lump + sip, 0);
  });
});

describe("ppfCorpus — PPF calculation", () => {
  it("calculates PPF with annual compounding", () => {
    // ₹1,50,000/year at 7.1% for 15 years
    const corpus = ppfCorpus(0, 150000, 7.1, 15);
    // Expected: ~₹40.68 lakhs (standard PPF calc)
    expect(corpus).toBeGreaterThan(4000000);
    expect(corpus).toBeLessThan(4200000);
  });
});

describe("fdCorpus — FD calculation (quarterly compounding)", () => {
  it("calculates FD with quarterly compounding", () => {
    // ₹1,00,000 at 7% for 5 years
    const corpus = fdCorpus(100000, 7, 5);
    // Expected: ~₹1,41,478 with quarterly compounding
    expect(Math.round(corpus)).toBeGreaterThan(141000);
    expect(Math.round(corpus)).toBeLessThan(142000);
  });
});

describe("freqToMonthly — frequency conversion", () => {
  it("converts weekly to monthly", () => {
    expect(freqToMonthly(1000, "weekly")).toBeCloseTo(1000 * (52 / 12), 2);
  });

  it("converts yearly to monthly", () => {
    expect(freqToMonthly(12000, "yearly")).toBe(1000);
  });

  it("returns 0 for onetime", () => {
    expect(freqToMonthly(100000, "onetime")).toBe(0);
  });

  it("returns same amount for monthly", () => {
    expect(freqToMonthly(5000, "monthly")).toBe(5000);
  });
});
