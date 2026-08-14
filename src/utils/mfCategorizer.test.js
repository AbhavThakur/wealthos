import { describe, it, expect } from "vitest";
import {
  inferMFCapCategoryAndReturn,
  getReturnGuidance,
  getMaturityBadge,
  ASSET_BENCHMARK_RETURNS,
} from "./mfCategorizer";

describe("mfCategorizer Utility", () => {
  it("correctly identifies Small Cap active and index funds", () => {
    const active = inferMFCapCategoryAndReturn("Nippon India Small Cap Fund Direct Growth");
    expect(active.capCategory).toBe("small_active");
    expect(active.recommendedReturnPct).toBe(15.0);

    const index = inferMFCapCategoryAndReturn("Motilal Oswal Nifty Smallcap 250 Index Fund Direct Growth");
    expect(index.capCategory).toBe("small_index");
    expect(index.recommendedReturnPct).toBe(14.5);
  });

  it("correctly identifies Flexi Cap and ELSS funds", () => {
    const flexi = inferMFCapCategoryAndReturn("Parag Parikh Flexi Cap Fund Direct Growth");
    expect(flexi.capCategory).toBe("flexi");
    expect(flexi.recommendedReturnPct).toBe(13.0);

    const elss = inferMFCapCategoryAndReturn("Mirae Asset ELSS Tax Saver Fund Direct Plan Growth");
    expect(elss.capCategory).toBe("elss");
    expect(elss.recommendedReturnPct).toBe(13.0);
  });

  it("correctly identifies Nifty 50 Large Cap Index funds", () => {
    const nifty = inferMFCapCategoryAndReturn("UTI Nifty 50 Index Fund Direct Growth");
    expect(nifty.capCategory).toBe("large_index");
    expect(nifty.recommendedReturnPct).toBe(12.0);
  });

  it("correctly identifies Debt, Gold, and International funds", () => {
    const liquid = inferMFCapCategoryAndReturn("ICICI Prudential Liquid Fund Direct Growth");
    expect(liquid.recommendedReturnPct).toBe(6.8);

    const gold = inferMFCapCategoryAndReturn("Nippon India Gold ETF BeES");
    expect(gold.recommendedReturnPct).toBe(9.5);

    const usTech = inferMFCapCategoryAndReturn("Mirae Asset NYSE FANG+ ETF Fund of Fund");
    expect(usTech.capCategory).toBe("international");
    expect(usTech.recommendedReturnPct).toBe(11.5);
  });

  it("handles other asset classes like FD, PPF, EPF, Stocks", () => {
    const fd = inferMFCapCategoryAndReturn("", "", "FD");
    expect(fd.recommendedReturnPct).toBe(7.2);

    const ppf = inferMFCapCategoryAndReturn("", "", "PPF");
    expect(ppf.recommendedReturnPct).toBe(7.1);

    const stocks = inferMFCapCategoryAndReturn("", "", "Stocks");
    expect(stocks.recommendedReturnPct).toBe(13.5);
  });

  it("provides return guidance ratings (realistic, conservative, aggressive)", () => {
    const realistic = getReturnGuidance(12.5, "large_active", "Mutual Fund");
    expect(realistic.status).toBe("realistic");

    const conservative = getReturnGuidance(9.0, "small_active", "Mutual Fund");
    expect(conservative.status).toBe("conservative");

    const aggressive = getReturnGuidance(18.0, "large_index", "Mutual Fund");
    expect(aggressive.status).toBe("aggressive");
  });

  it("calculates FD and PPF maturity badges and statuses", () => {
    const today = new Date();
    const soonDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const badgeSoon = getMaturityBadge(soonDate);
    expect(badgeSoon.status).toBe("soon_30");
    expect(badgeSoon.badgeText).toContain("in 15 days");

    const pastDate = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const badgePast = getMaturityBadge(pastDate);
    expect(badgePast.status).toBe("matured");
    expect(badgePast.badgeText).toContain("Matured");
  });
});
