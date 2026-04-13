// Vercel Serverless Function — proxies Yahoo Finance quotes
// No API key needed. Returns Nifty, Sensex, Gold, USD/INR snapshot.
// Called by MarketPulse page. Cached 5 min at edge.
//
// GET /api/market-data
// Response: { ok: true, data: [...quotes], ts: number }

const SYMBOLS = "^NSEI,^BSESN,GC=F,INR=X";
const YF_URL = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(SYMBOLS)}&fields=shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,currency`;

// Label map — plain readable names
const LABELS = {
  "^NSEI": "Nifty 50",
  "^BSESN": "Sensex",
  "GC=F": "Gold",
  "INR=X": "USD / INR",
};

export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const response = await fetch(YF_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com",
      },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res
        .status(502)
        .json({
          ok: false,
          error: `Yahoo Finance returned ${response.status}`,
        });
    }

    const json = await response.json();
    const quotes = json?.quoteResponse?.result || [];

    const data = quotes.map((q) => ({
      symbol: q.symbol,
      name: LABELS[q.symbol] || q.shortName || q.symbol,
      price: q.regularMarketPrice ?? null,
      prevClose: q.regularMarketPreviousClose ?? null,
      change: q.regularMarketChange ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      currency: q.currency ?? "USD",
    }));

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
