import { describe, expect, it } from "vitest";
import { parseAmfiSchemeByISIN } from "../../api/mf-lookup";

describe("parseAmfiSchemeByISIN", () => {
  it("returns only the scheme whose official AMFI ISIN matches", () => {
    const feed = [
      "Open Ended Schemes (Other Scheme - Index Funds)",
      "120716;INF789F01XA0;;UTI Nifty 50 Index Fund - Growth Option- Direct;167.18070;;;24-Jul-2026",
      "143341;INF789F01XX9;;UTI Nifty Next 50 Index Fund - Direct Plan - Growth Option;25.42;;;24-Jul-2026",
    ].join("\n");

    expect(parseAmfiSchemeByISIN(feed, "inf789f01xa0")).toEqual({
      schemeCode: "120716",
      schemeName: "UTI Nifty 50 Index Fund - Growth Option- Direct",
      isin: "INF789F01XA0",
      matchedOn: "growth",
      nav: 167.1807,
      navDate: "24-Jul-2026",
    });
  });

  it("rejects folio numbers because they are not scheme identifiers", () => {
    expect(parseAmfiSchemeByISIN("", "588390458976")).toBeNull();
  });
});
