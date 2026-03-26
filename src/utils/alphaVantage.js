// ── Alpha Vantage Market Intelligence ────────────────────────────────────────
// Free tier: 25 requests/day. We cache aggressively (4hr TTL) and fetch only
// what's needed: market news + sentiment, top US movers, gold spot backup.

const AV_BASE = "https://www.alphavantage.co/query";
const CACHE_PREFIX = "wos_av_";
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getKey() {
  return import.meta.env.VITE_ALPHAVANTAGE_KEY || "";
}

// ── Cache helpers (sessionStorage, survives page refresh within tab) ────────
function getCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
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
    /* quota exceeded */
  }
}

async function avFetch(params) {
  const key = getKey();
  if (!key) return null;
  const url = `${AV_BASE}?${new URLSearchParams({ ...params, apikey: key })}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    // Alpha Vantage returns { "Note": "..." } or { "Information": "..." } on limit
    if (json.Note || json.Information) {
      console.warn(
        "[AlphaVantage] Rate limited:",
        json.Note || json.Information,
      );
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

// ── Market News & Sentiment ─────────────────────────────────────────────────
// Returns up to 10 latest financial market news articles with sentiment scores.
export async function fetchMarketNews() {
  const cached = getCache("news");
  if (cached) return cached;

  const json = await avFetch({
    function: "NEWS_SENTIMENT",
    topics: "financial_markets",
    sort: "LATEST",
    limit: "10",
  });

  if (!json?.feed?.length) return null;

  const articles = json.feed.slice(0, 10).map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    publishedAt: a.time_published,
    summary: a.summary?.slice(0, 200),
    sentiment: a.overall_sentiment_label, // Bullish, Bearish, Neutral, etc.
    sentimentScore: a.overall_sentiment_score, // -1 to 1
    bannerImage: a.banner_image,
  }));

  setCache("news", articles);
  return articles;
}

// ── Top Gainers / Losers (US Market) ────────────────────────────────────────
export async function fetchTopMovers() {
  const cached = getCache("movers");
  if (cached) return cached;

  const json = await avFetch({ function: "TOP_GAINERS_LOSERS" });
  if (!json?.top_gainers) return null;

  const result = {
    date: json.last_updated || new Date().toISOString(),
    gainers: json.top_gainers.slice(0, 5).map((t) => ({
      ticker: t.ticker,
      price: t.price,
      change: t.change_amount,
      changePct: t.change_percentage,
      volume: t.volume,
    })),
    losers: json.top_losers.slice(0, 5).map((t) => ({
      ticker: t.ticker,
      price: t.price,
      change: t.change_amount,
      changePct: t.change_percentage,
      volume: t.volume,
    })),
    mostActive: json.most_actively_traded.slice(0, 5).map((t) => ({
      ticker: t.ticker,
      price: t.price,
      change: t.change_amount,
      changePct: t.change_percentage,
      volume: t.volume,
    })),
  };

  setCache("movers", result);
  return result;
}

// ── BSE Stock Quote (Indian) ────────────────────────────────────────────────
export async function fetchStockQuote(symbol) {
  const cacheKey = `quote_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const json = await avFetch({
    function: "GLOBAL_QUOTE",
    symbol,
  });

  const q = json?.["Global Quote"];
  if (!q || !q["05. price"]) return null;

  const result = {
    symbol: q["01. symbol"],
    price: parseFloat(q["05. price"]),
    change: parseFloat(q["09. change"]),
    changePct: q["10. change percent"],
    volume: parseInt(q["06. volume"], 10),
    date: q["07. latest trading day"],
  };

  setCache(cacheKey, result);
  return result;
}
