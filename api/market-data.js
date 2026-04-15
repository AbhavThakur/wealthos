// Vercel Serverless Function — fetches live market quotes via Yahoo Finance v8 chart API.
// No API key needed. Returns Nifty, Sensex, Gold, USD/INR snapshot.
// Called by MarketPulse page. Cached 5 min at edge.
//
// GET /api/market-data
// Response: { ok: true, data: [...quotes], ts: number }

const SYMBOLS = [
  { symbol: "^NSEI", name: "Nifty 50", currency: "INR" },
  { symbol: "^BSESN", name: "Sensex", currency: "INR" },
  { symbol: "GC=F", name: "Gold", currency: "USD" },
  { symbol: "INR=X", name: "USD / INR", currency: "INR" },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Fetch a single symbol's price via Yahoo Finance v8 chart endpoint.
 * This endpoint does not require crumb/cookie authentication.
 */
async function fetchQuote(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym.symbol)}?range=1d&interval=1d&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePct =
    change != null && prevClose ? (change / prevClose) * 100 : null;

  return {
    symbol: sym.symbol,
    name: sym.name,
    price,
    prevClose,
    change: change != null ? Math.round(change * 100) / 100 : null,
    changePct: changePct != null ? Math.round(changePct * 100) / 100 : null,
    currency: sym.currency,
  };
}

export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const results = await Promise.allSettled(SYMBOLS.map(fetchQuote));
    const data = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);

    if (!data.length) {
      return res
        .status(502)
        .json({ ok: false, error: "All Yahoo Finance requests failed" });
    }

    // 5-minute cache at CDN edge
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60",
    );
    return res.json({ ok: true, data, ts: Date.now() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
