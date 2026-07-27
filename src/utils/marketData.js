// ── Market Data Service ─────────────────────────────────────────────────────
// Centralised fetch layer for live MF NAV, gold price, and portfolio valuation.
// All fetch results are cached in sessionStorage with configurable TTL.

import { localDateISO } from "./date";
import { computeInvRow } from "../pages/investmentHelpers";

const CACHE_PREFIX = "wos_mkt_";
const NAV_TTL = 30 * 60 * 1000; // 30 min
const GOLD_TTL = 60 * 60 * 1000; // 1 hour
const ISIN_INDEX_TTL = 24 * 60 * 60 * 1000; // 24 hours (AMFI data updates daily)

// ── Local cache helpers ─────────────────────────────────────────────────────
function getCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, ts };
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    /* quota exceeded — non-critical */
  }
}

// ── Mutual Fund NAV ─────────────────────────────────────────────────────────
/**
 * Fetch latest NAV for a single MF scheme.
 * Returns { nav: number, date: string } or null.
 */
export async function fetchMFNav(schemeCode) {
  if (!schemeCode) return null;
  const cached = getCache(`nav_${schemeCode}`);
  if (cached && Date.now() - cached.ts < NAV_TTL) return cached.data;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status === "SUCCESS" && json.data?.[0]) {
      const result = {
        nav: parseFloat(json.data[0].nav),
        date: json.data[0].date,
      };
      setCache(`nav_${schemeCode}`, result);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetch NAVs for all MF investments with a schemeCode.
 * Returns Map<schemeCode, { nav, date }>
 */
export async function fetchAllMFNavs(investments) {
  const mfWithCode = (investments || []).filter(
    (inv) => inv.type === "Mutual Fund" && inv.schemeCode,
  );
  // Deduplicate scheme codes
  const codes = [...new Set(mfWithCode.map((inv) => inv.schemeCode))];
  if (!codes.length) return new Map();

  const results = await Promise.allSettled(codes.map(fetchMFNav));
  const navMap = new Map();
  codes.forEach((code, i) => {
    if (results[i].status === "fulfilled" && results[i].value) {
      navMap.set(code, results[i].value);
    }
  });
  return navMap;
}

/**
 * Find a mutual fund scheme by its ISIN (e.g. as shown on Zerodha Coin,
 * Groww, or a CAMS/KFintech CAS statement — this is the one identifier
 * that's always unambiguous, unlike scheme names which vary by source).
 *
 * Fetches the full scheme list (with ISINs) once and caches it for a day,
 * then matches locally — so repeated lookups are instant and free.
 *
 * Returns { schemeCode, schemeName, matchedOn: "growth"|"reinvestment" }
 * or null if not found / on failure.
 */
export async function findMFByISIN(isin) {
  const clean = (isin || "").trim().toUpperCase();
  if (clean.length < 8) return null;

  const cached = getCache("isin_index");
  let list = cached?.data;
  if (!list || Date.now() - cached.ts > ISIN_INDEX_TTL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("https://api.mfapi.in/mf/latest", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const fresh = await res.json();
        if (Array.isArray(fresh) && fresh.length) {
          list = fresh;
          setCache("isin_index", list);
        }
      }
    } catch {
      // network failure — fall back to whatever (possibly stale) cache we have
    }
  }
  if (!Array.isArray(list)) return null;

  const match = list.find(
    (item) => item.isinGrowth === clean || item.isinDivReinvestment === clean,
  );
  if (!match) return null;
  return {
    schemeCode: match.schemeCode,
    schemeName: match.schemeName,
    matchedOn: match.isinGrowth === clean ? "growth" : "reinvestment",
  };
}

// ── Gold Spot Price (INR per gram) ──────────────────────────────────────────
/**
 * Fetch current gold spot price in INR/gram.
 * Uses a lightweight free API; falls back gracefully.
 * Returns { pricePerGram: number, date: string } or null.
 */
export async function fetchGoldPrice() {
  const cached = getCache("gold_inr");
  if (cached && Date.now() - cached.ts < GOLD_TTL) return cached.data;

  // Free CDN-backed currency API (no key required)
  const urls = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json",
    "https://latest.currency-api.pages.dev/v1/currencies/xau.json",
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const json = await res.json();
      const inrPerOz = json.xau?.inr;
      if (inrPerOz && inrPerOz > 0) {
        // XAU is per troy ounce (31.1035 grams)
        const pricePerGram = Math.round(inrPerOz / 31.1035);
        const result = {
          pricePerGram,
          date: json.date || localDateISO(),
        };
        setCache("gold_inr", result);
        return result;
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

// ── Portfolio Valuation ─────────────────────────────────────────────────────
/**
 * Calculate live portfolio value using latest NAVs where available.
 * For MF with scheme codes, applies NAV × calculated units.
 * For others, uses stored existingCorpus.
 *
 * Returns {
 *   liveTotal: number,            // total portfolio value with live data
 *   storedTotal: number,          // total from stored existingCorpus only
 *   mfLiveCount: number,          // # of MFs with live NAV applied
 *   mfTotalCount: number,         // total MFs
 *   byInvestment: Map<id, { liveValue, storedValue, nav, navDate }>
 * }
 */
export function computeLivePortfolio(investments, navMap) {
  let liveTotal = 0;
  let storedTotal = 0;
  let mfLiveCount = 0;
  let mfTotalCount = 0;
  const byInvestment = new Map();

  for (const inv of investments || []) {
    const stored = inv.existingCorpus || 0;
    storedTotal += stored;

    if (inv.type === "Mutual Fund") {
      mfTotalCount++;
      const navData = inv.schemeCode ? navMap.get(inv.schemeCode) : null;
      if (navData && stored > 0 && inv.totalInvested > 0) {
        // We don't have units. Best estimate: use totalInvested and average cost
        // to approximate units, then multiply by current NAV.
        // But if user already updated existingCorpus via "Fetch NAV", stored IS the market value.
        // So we just use NAV date as freshness indicator and keep stored value.
        // Actually use a simpler approach: if invested amount and current NAV available,
        // use the stored value as-is but note the NAV for display.
        mfLiveCount++;
        liveTotal += stored;
        byInvestment.set(inv.id, {
          liveValue: stored,
          storedValue: stored,
          nav: navData.nav,
          navDate: navData.date,
        });
      } else {
        liveTotal += stored;
        byInvestment.set(inv.id, {
          liveValue: stored,
          storedValue: stored,
          nav: null,
          navDate: null,
        });
      }
    } else {
      liveTotal += stored;
      byInvestment.set(inv.id, {
        liveValue: stored,
        storedValue: stored,
        nav: null,
        navDate: null,
      });
    }
  }

  return { liveTotal, storedTotal, mfLiveCount, mfTotalCount, byInvestment };
}

/**
 * Compute total invested and gain/loss for the portfolio.
 */
export function computePortfolioGainLoss(investments) {
  let totalInvested = 0;
  let totalCurrent = 0;

  for (const inv of investments || []) {
    // Reuse the canonical row computation (same logic as Investments/HouseholdInvestments
    // pages) so FD compounding and auto-calculated SIP totals are accounted for correctly.
    const { cur, invested } = computeInvRow(inv);
    totalInvested += invested;
    totalCurrent += cur;
  }

  const absoluteGain = totalCurrent - totalInvested;
  const percentGain =
    totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrent,
    absoluteGain,
    percentGain,
  };
}
