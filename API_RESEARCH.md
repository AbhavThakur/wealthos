# WealthOS - Free API Research for Indian Household Finance App

> Last verified: 26 March 2026 | Stack: React + Vite on Vercel

---

## COMPARISON TABLE: Top Recommendations by Category

| Category                | **TOP PICK**             | Free?        | CORS?             | Key?           | Limits    | Already Used?      |
| ----------------------- | ------------------------ | ------------ | ----------------- | -------------- | --------- | ------------------ |
| **Mutual Fund NAV**     | mfapi.in                 | ✅ 100% Free | ✅ Yes            | ❌ No key      | Unlimited | ✅ Yes             |
| **Gold/Silver Price**   | fawazahmed0/exchange-api | ✅ 100% Free | ✅ Yes (CDN)      | ❌ No key      | Unlimited | ✅ Yes (gold only) |
| **Indian Stock Prices** | Yahoo Finance v8 chart   | ✅ Free      | ❌ No             | ❌ No key      | ~2000/hr  | ❌ Needs proxy     |
| **Market Indices**      | Yahoo Finance v8 chart   | ✅ Free      | ❌ No             | ❌ No key      | ~2000/hr  | ❌ Needs proxy     |
| **Financial News**      | GNews API                | Freemium     | ⚠️ localhost only | ✅ Free signup | 100/day   | ❌ New             |
| **BSE Stock Data**      | Alpha Vantage            | Freemium     | ✅ Yes            | ✅ Free signup | 25/day    | ❌ New             |

### Tier Classification

- **🟢 Truly Free**: No key, no limits, CORS-friendly (mfapi.in, fawazahmed0)
- **🟡 Freemium-Usable**: Free signup, generous limits (Yahoo Finance, GNews, Alpha Vantage)
- **🔴 Needs Proxy**: Works but requires Vercel serverless proxy for CORS (NSE India, Yahoo Finance)

---

## 1. INDIAN MUTUAL FUND DATA

### 🟢 mfapi.in (ALREADY USED - TOP PICK)

| Detail               | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Base URL**         | `https://api.mfapi.in`                                               |
| **API Key**          | ❌ Not required                                                      |
| **Rate Limit**       | Unlimited (no rate limiting)                                         |
| **CORS**             | ✅ Yes                                                               |
| **Update Frequency** | 6x daily (10:05 AM, 2:05 PM, 6:05 PM, 9:05 PM, 3:09 AM, 5:05 AM IST) |
| **Format**           | JSON                                                                 |
| **Coverage**         | 10,000+ schemes, 5+ years historical                                 |

**Endpoints:**

```bash
# Search mutual funds
curl "https://api.mfapi.in/mf/search?q=axis+bluechip"

# Latest NAV for a scheme
curl "https://api.mfapi.in/mf/120503/latest"

# Full historical NAV
curl "https://api.mfapi.in/mf/120503"

# List all schemes
curl "https://api.mfapi.in/mf"
```

**Response Sample (latest NAV):**

```json
{
  "meta": {
    "fund_house": "Axis Mutual Fund",
    "scheme_type": "Open Ended Schemes",
    "scheme_category": "Equity Scheme - ELSS",
    "scheme_code": 120503,
    "scheme_name": "Axis ELSS Tax Saver Fund - Direct Plan - Growth",
    "isin_growth": "INF846K01EW2"
  },
  "data": [{ "date": "25-03-2026", "nav": "100.73190" }],
  "status": "SUCCESS"
}
```

**What's Missing**: No category rankings, no returns calculation, no top performers list. You'd need to:

- Fetch all schemes → filter by category → calculate returns from historical NAV
- Or consider supplementing with a third-party rankings source

**Docs**: https://www.mfapi.in/docs/

---

## 2. GOLD & SILVER PRICES (INR)

### 🟢 fawazahmed0/exchange-api (ALREADY USED - TOP PICK)

| Detail                 | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Base URL (primary)** | `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/` |
| **Fallback URL**       | `https://latest.currency-api.pages.dev/v1/currencies/`                         |
| **API Key**            | ❌ Not required                                                                |
| **Rate Limit**         | Unlimited (CDN-backed)                                                         |
| **CORS**               | ✅ Yes (jsDelivr CDN + Cloudflare Pages)                                       |
| **Update**             | Daily                                                                          |
| **Currencies**         | 200+ including XAU (gold), XAG (silver), XPT (platinum)                        |

**Endpoints:**

```bash
# Gold price (XAU to all currencies including INR)
curl "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json"

# Silver price (XAG to all currencies)
curl "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xag.json"

# Historical gold price for specific date
curl "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2024-03-06/v1/currencies/xau.json"

# Fallback (Cloudflare Pages)
curl "https://latest.currency-api.pages.dev/v1/currencies/xau.json"
```

**Verified Response (26 March 2026):**

```
Gold XAU→INR: ₹424,513.15/troy oz → ₹13,649/gram (÷31.1035)
Silver XAG→INR: ₹6,720.90/troy oz → ₹216/gram
```

**Response Format:**

```json
{
  "date": "2026-03-26",
  "xau": {
    "inr": 424513.15442851,
    "usd": 3021.234,
    "eur": 2890.123
  }
}
```

**Note**: XAU/XAG values are per troy ounce. Divide by 31.1035 for per-gram price.

**Current app already uses this** for gold. Silver can be added with the same pattern using `xag.json`.

---

## 3. INDIAN STOCK MARKET DATA (NSE/BSE)

### 🟡 Yahoo Finance v8 Chart API (TOP PICK - needs proxy)

| Detail             | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Base URL**       | `https://query1.finance.yahoo.com/v8/finance/chart/`        |
| **API Key**        | ❌ Not required                                             |
| **Rate Limit**     | ~2000 requests/hour (unofficial, IP-based)                  |
| **CORS**           | ❌ No CORS headers                                          |
| **Format**         | JSON                                                        |
| **Indian Symbols** | `RELIANCE.NS`, `TCS.NS`, `^NSEI` (Nifty), `^BSESN` (Sensex) |

**Verified Working (26 March 2026):**

```
RELIANCE.NS: ₹1413.10
Nifty 50 (^NSEI): 23306.45
Sensex (^BSESN): 75273.45
```

**Endpoints:**

```bash
# Single stock quote (NSE)
curl "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS"

# Nifty 50 index
curl "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI"

# Sensex index
curl "https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN"

# With range and interval
curl "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?interval=1d&range=5d"

# Multiple intervals: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo
# Ranges: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
```

**Response Sample:**

```json
{
  "chart": {
    "result": [
      {
        "meta": {
          "currency": "INR",
          "symbol": "RELIANCE.NS",
          "exchangeName": "NSI",
          "regularMarketPrice": 1413.1,
          "previousClose": 1400.5,
          "regularMarketTime": 1711447200,
          "dataGranularity": "1d",
          "range": "5d"
        },
        "timestamp": [1711360800, 1711447200],
        "indicators": {
          "quote": [
            {
              "open": [1395.0, 1410.0],
              "high": [1420.0, 1415.0],
              "low": [1390.0, 1405.0],
              "close": [1410.0, 1413.1],
              "volume": [15000000, 12000000]
            }
          ]
        }
      }
    ],
    "error": null
  }
}
```

**NSE Symbol Format**: `{SYMBOL}.NS` (e.g., `RELIANCE.NS`, `TCS.NS`, `INFY.NS`)
**BSE Symbol Format**: `{SYMBOL}.BO` (e.g., `RELIANCE.BO`)
**Index Symbols**: `^NSEI` (Nifty 50), `^BSESN` (Sensex), `^NSEBANK` (Bank Nifty)

**⚠️ CORS Issue**: No `Access-Control-Allow-Origin` header. **Must use Vercel serverless proxy.**

**Vercel Proxy (api/yahoo-finance.js):**

```js
export default async function handler(req, res) {
  const { symbol, range, interval } = req.query;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range || "1d"}&interval=${interval || "1d"}`;
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const data = await resp.json();
  res.setHeader("Cache-Control", "s-maxage=300");
  res.json(data);
}
```

---

### 🟡 Alpha Vantage (Good for BSE stocks + Gold/Silver)

| Detail            | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| **Base URL**      | `https://www.alphavantage.co/query`                           |
| **API Key**       | ✅ Required (free signup at alphavantage.co/support/#api-key) |
| **Rate Limit**    | **25 requests/day** (free tier)                               |
| **CORS**          | ✅ Yes                                                        |
| **Indian Stocks** | BSE symbols: `RELIANCE.BSE`, `TCS.BSE`, `INFY.BSE`            |

**Endpoints:**

```bash
# Daily stock price (BSE)
curl "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=RELIANCE.BSE&apikey=YOUR_KEY"

# Global quote (latest price)
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=RELIANCE.BSE&apikey=YOUR_KEY"

# Symbol search
curl "https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=reliance&apikey=YOUR_KEY"

# Gold spot price
curl "https://www.alphavantage.co/query?function=GOLD_SILVER_SPOT&symbol=GOLD&apikey=YOUR_KEY"

# Silver spot price
curl "https://www.alphavantage.co/query?function=GOLD_SILVER_SPOT&symbol=SILVER&apikey=YOUR_KEY"

# Market news with sentiment
curl "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=RELIANCE.BSE&apikey=YOUR_KEY"
```

**Verdict**: Good for backup/supplementary data. 25 requests/day is tight — best used for gold/silver spot prices and occasional stock lookups, NOT for bulk portfolio syncing.

---

### 🔴 NSE India Unofficial APIs (Needs server proxy)

| Detail          | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Base URL**    | `https://www.nseindia.com/api/`                                                          |
| **API Key**     | ❌ No key, but needs cookie session                                                      |
| **Rate Limit**  | Aggressive rate limiting, IP-based                                                       |
| **CORS**        | ❌ Absolutely not                                                                        |
| **Requirement** | Must first GET `https://www.nseindia.com` to get cookies, then use cookies for API calls |

**Endpoints (require session cookie):**

```bash
# Step 1: Get cookies
curl -c cookies.txt "https://www.nseindia.com" -H "User-Agent: Mozilla/5.0"

# Step 2: Use cookies for API calls
# All indices
curl -b cookies.txt "https://www.nseindia.com/api/allIndices"

# Market status
curl -b cookies.txt "https://www.nseindia.com/api/marketStatus"

# Stock quote
curl -b cookies.txt "https://www.nseindia.com/api/quote-equity?symbol=RELIANCE"

# Top gainers
curl -b cookies.txt "https://www.nseindia.com/api/live-analysis-variations?index=gainers"

# Top losers
curl -b cookies.txt "https://www.nseindia.com/api/live-analysis-variations?index=loosers"

# Nifty 50 constituents
curl -b cookies.txt "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
```

**⚠️ Very fragile**: NSE actively blocks automated access. Session cookies expire quickly. Headers must match browser. **NOT recommended for production** — use Yahoo Finance instead.

---

### 🟡 Twelve Data (NSE support, free tier)

| Detail            | Value                                       |
| ----------------- | ------------------------------------------- |
| **Base URL**      | `https://api.twelvedata.com`                |
| **API Key**       | ✅ Required (free signup at twelvedata.com) |
| **Rate Limit**    | 800 req/day, 8 req/minute (free)            |
| **CORS**          | ✅ Yes                                      |
| **Indian Stocks** | `RELIANCE:NSE`, `TCS:NSE`, `INFY:NSE`       |

```bash
# Real-time quote
curl "https://api.twelvedata.com/quote?symbol=RELIANCE:NSE&apikey=YOUR_KEY"

# Time series
curl "https://api.twelvedata.com/time_series?symbol=RELIANCE:NSE&interval=1day&outputsize=5&apikey=YOUR_KEY"

# Multiple symbols
curl "https://api.twelvedata.com/quote?symbol=RELIANCE:NSE,TCS:NSE,INFY:NSE&apikey=YOUR_KEY"
```

**Verdict**: Better free tier than Alpha Vantage (800 vs 25 req/day). Good alternative if Yahoo Finance proxy is too complex.

---

## 4. MARKET INDICES (Nifty 50, Sensex, Sector Indices)

### Best Options (all via Yahoo Finance v8 proxy):

| Index        | Yahoo Symbol | Verified     |
| ------------ | ------------ | ------------ |
| Nifty 50     | `^NSEI`      | ✅ 23306.45  |
| Sensex       | `^BSESN`     | ✅ 75273.45  |
| Bank Nifty   | `^NSEBANK`   | Symbol works |
| Nifty IT     | `^CNXIT`     | Symbol works |
| Nifty Pharma | `^CNXPHARMA` | Symbol works |
| Nifty Auto   | `^CNXAUTO`   | Symbol works |
| Nifty FMCG   | `^CNXFMCG`   | Symbol works |
| Nifty Metal  | `^CNXMETAL`  | Symbol works |
| Nifty Realty | `^CNXREALTY` | Symbol works |
| Nifty Energy | `^CNXENERGY` | Symbol works |
| BSE MidCap   | `^BSEMC`     | Symbol works |
| BSE SmallCap | `^BSESC`     | Symbol works |

```bash
# Fetch multiple indices in one Vercel proxy call (batch)
# Your proxy can accept comma-separated symbols
curl "https://your-app.vercel.app/api/yahoo-finance?symbol=^NSEI&range=1d"
```

---

## 5. FINANCIAL / MARKET NEWS

### 🟡 GNews API (TOP PICK for news)

| Detail           | Value                                        |
| ---------------- | -------------------------------------------- |
| **Base URL**     | `https://gnews.io/api/v4/`                   |
| **API Key**      | ✅ Required (free signup)                    |
| **Rate Limit**   | **100 req/day** (free tier)                  |
| **CORS**         | ⚠️ localhost only (free), all origins (paid) |
| **Delay**        | 12-hour delay on free tier                   |
| **Max Articles** | 10 per request (free)                        |
| **Languages**    | 41 languages including English, Hindi        |
| **Countries**    | 71 countries including India                 |

**Endpoints:**

```bash
# Search Indian market news
curl "https://gnews.io/api/v4/search?q=indian+stock+market&lang=en&country=in&max=10&apikey=YOUR_KEY"

# Top headlines - business category for India
curl "https://gnews.io/api/v4/top-headlines?category=business&lang=en&country=in&max=10&apikey=YOUR_KEY"

# Specific stock/topic news
curl "https://gnews.io/api/v4/search?q=nifty+OR+sensex+OR+RBI&lang=en&country=in&max=10&apikey=YOUR_KEY"
```

**Response Sample:**

```json
{
  "totalArticles": 81908,
  "articles": [
    {
      "title": "Sensex rallies 500 points on FII buying",
      "description": "The benchmark indices...",
      "content": "Full article text (truncated)...",
      "url": "https://source.com/article",
      "image": "https://source.com/image.jpg",
      "publishedAt": "2026-03-26T10:30:00Z",
      "source": {
        "name": "Economic Times",
        "url": "https://economictimes.com"
      }
    }
  ]
}
```

**⚠️ CORS limitation**: Free tier only allows CORS from `localhost`. For production on Vercel, you need either:

1. Upgrade to paid plan ($49.99/mo), OR
2. Use a **Vercel serverless proxy** (recommended)

---

### Alternative: RSS Feeds via Vercel Proxy (Truly Free)

These RSS feeds are 100% free with no signup, but need a server-side proxy:

| Source            | RSS URL                                                                | Content        |
| ----------------- | ---------------------------------------------------------------------- | -------------- |
| MoneyControl      | `https://www.moneycontrol.com/rss/marketreports.xml`                   | Market reports |
| Economic Times    | `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms` | Markets news   |
| LiveMint          | `https://www.livemint.com/rss/markets`                                 | Market news    |
| Business Standard | `https://www.business-standard.com/rss/markets-104.rss`                | Markets        |
| NDTV Profit       | `https://feeds.feedburner.com/ndtvprofit-latest`                       | Business news  |

These can be parsed with a simple Vercel serverless function using an XML parser.

---

### Alternative: NewsAPI.org

| Detail         | Value                                          |
| -------------- | ---------------------------------------------- |
| **Base URL**   | `https://newsapi.org/v2/`                      |
| **API Key**    | ✅ Required (free signup)                      |
| **Rate Limit** | 100 req/day free                               |
| **CORS**       | ❌ Server-side only (free plan blocks browser) |

```bash
curl "https://newsapi.org/v2/top-headlines?country=in&category=business&apiKey=YOUR_KEY"
```

Same CORS limitation as GNews on free tier — needs Vercel proxy regardless.

---

## 6. IMPLEMENTATION STRATEGY FOR WEALTHOS

### Recommended Architecture

```
Browser (React)
  ├── Direct calls (CORS-friendly):
  │   ├── mfapi.in        → Mutual fund NAV
  │   └── fawazahmed0     → Gold/Silver prices
  │
  └── Via Vercel Proxy (/api/*):
      ├── Yahoo Finance    → Stocks, Indices
      ├── GNews API        → News (with your API key server-side)
      └── NSE RSS feeds    → Backup news (XML→JSON)
```

### Vercel Serverless Functions Needed

**1. `/api/stock-quote.js`** — Proxy for Yahoo Finance

```js
// Handles: stock prices, index values, charts
// Caching: 5-min s-maxage for quotes, 1-hour for daily charts
```

**2. `/api/news.js`** — Proxy for GNews / RSS

```js
// Handles: Indian market news
// Caching: 30-min s-maxage
// Keeps API key server-side (secure)
```

### API Key Management

| API           | Store In                          | Exposed to Client?        |
| ------------- | --------------------------------- | ------------------------- |
| mfapi.in      | N/A                               | N/A (no key)              |
| fawazahmed0   | N/A                               | N/A (no key)              |
| GNews         | `GNEWS_API_KEY` in Vercel env     | ❌ No (server-side proxy) |
| Alpha Vantage | `ALPHA_VANTAGE_KEY` in Vercel env | ❌ No (server-side proxy) |
| Twelve Data   | `TWELVE_DATA_KEY` in Vercel env   | ❌ No (server-side proxy) |

### Rate Budget (per day, free tier)

| API           | Daily Limit | Usage Plan                            |
| ------------- | ----------- | ------------------------------------- |
| mfapi.in      | Unlimited   | All MF NAV syncs                      |
| fawazahmed0   | Unlimited   | Gold/silver price (cache 1hr)         |
| Yahoo Finance | ~2000/hr    | Stock quotes + indices (cache 5min)   |
| GNews         | 100/day     | 4 news refreshes × 1 request = ~4/day |
| Alpha Vantage | 25/day      | Backup for gold/silver spot only      |

---

## FULL API MATRIX

| API                  | Free Tier        | Key Required | CORS | Indian Data             | Best For                   |
| -------------------- | ---------------- | ------------ | ---- | ----------------------- | -------------------------- |
| **mfapi.in**         | 🟢 Unlimited     | No           | ✅   | MF NAV                  | MF NAV lookup              |
| **fawazahmed0**      | 🟢 Unlimited     | No           | ✅   | Gold/Silver INR         | Precious metals            |
| **Yahoo Finance v8** | 🟢 ~2000/hr      | No           | ❌   | NSE/BSE stocks, indices | Stocks + indices via proxy |
| **Alpha Vantage**    | 🟡 25/day        | Yes (free)   | ✅   | BSE stocks, gold        | Backup, gold spot          |
| **Twelve Data**      | 🟡 800/day       | Yes (free)   | ✅   | NSE stocks              | Alternative to Yahoo       |
| **GNews**            | 🟡 100/day       | Yes (free)   | ⚠️   | Indian news             | Market news                |
| **NewsAPI.org**      | 🟡 100/day       | Yes (free)   | ❌   | Indian news             | Backup news                |
| **NSE India**        | 🔴 Rate-limited  | No (cookies) | ❌   | Official NSE            | NOT recommended            |
| **Groww**            | 🔴 Private       | N/A          | ❌   | N/A                     | Not available publicly     |
| **Zerodha/Kite**     | 🔴 Paid only     | Yes (paid)   | N/A  | NSE/BSE                 | Not free                   |
| **MoneyControl**     | 🔴 No public API | N/A          | ❌   | N/A                     | RSS feeds only             |
| **Google Finance**   | 🔴 No API        | N/A          | N/A  | N/A                     | Scraping TOS violation     |

---

## APIS NOT RECOMMENDED

| API                    | Reason                                                |
| ---------------------- | ----------------------------------------------------- |
| **NSE India official** | Aggressive anti-bot, cookies expire, blocks proxies   |
| **Groww/Zerodha APIs** | Private APIs, no public access, TOS prevents scraping |
| **Google Finance**     | No official API, scraping violates TOS                |
| **MoneyControl API**   | No public API; only RSS feeds available               |
| **MetalsDev**          | Paid API, no free tier                                |
| **GoldAPI.io**         | Requires paid subscription for INR data               |
| **Currents API**       | Requires key, limited free tier, poor Indian coverage |

---

## QUICK START: Add Silver Price to Existing Gold Flow

Your app already fetches gold via fawazahmed0. Add silver with zero new dependencies:

```js
// In marketData.js - add alongside fetchGoldPrice()
export async function fetchSilverPrice() {
  const cached = getCache("silver_inr");
  if (cached && Date.now() - cached.ts < GOLD_TTL) return cached.data;

  const urls = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xag.json",
    "https://latest.currency-api.pages.dev/v1/currencies/xag.json",
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const json = await res.json();
      const inrPerOz = json.xag?.inr;
      if (inrPerOz && inrPerOz > 0) {
        const pricePerGram = Math.round((inrPerOz / 31.1035) * 100) / 100;
        const result = {
          pricePerGram,
          date: json.date || new Date().toISOString().slice(0, 10),
        };
        setCache("silver_inr", result);
        return result;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}
```
