import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMFSchemeDetails } from "./marketData";

describe("fetchMFSchemeDetails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps an exact Direct Growth scheme to persisted identity metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "SUCCESS",
          meta: {
            fund_house: "UTI Mutual Fund",
            scheme_type: "Open Ended Schemes",
            scheme_category: "Other Scheme - Index Funds",
            scheme_code: 120716,
            scheme_name: "UTI Nifty 50 Index Fund - Growth Option- Direct",
            isin_growth: "INF789F01XA0",
            isin_div_reinvestment: null,
          },
          data: [{ date: "24-07-2026", nav: "167.18070" }],
        }),
      }),
    );

    await expect(fetchMFSchemeDetails(120716)).resolves.toEqual({
      schemeCode: "120716",
      schemeName: "UTI Nifty 50 Index Fund - Growth Option- Direct",
      fundHouse: "UTI Mutual Fund",
      category: "Other Scheme - Index Funds",
      isin: "INF789F01XA0",
      plan: "Direct",
      option: "Growth",
      nav: 167.1807,
      navDate: "24-07-2026",
    });
  });
});
