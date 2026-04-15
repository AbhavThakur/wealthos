import { useState, useEffect, useCallback } from "react";
import { useMarketPulse } from "../hooks/useMarketPulse";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

// ── Demo data — shown when /api/market-data is unreachable (local dev, etc.) ──
const DEMO_DATA = [
  {
    symbol: "^NSEI",
    name: "Nifty 50",
    price: 24200,
    change: 135,
    changePct: 0.56,
    currency: "INR",
  },
  {
    symbol: "^BSESN",
    name: "Sensex",
    price: 79500,
    change: 410,
    changePct: 0.52,
    currency: "INR",
  },
  {
    symbol: "GC=F",
    name: "Gold",
    price: 3280,
    change: 12,
    changePct: 0.37,
    currency: "USD",
  },
  {
    symbol: "INR=X",
    name: "USD / INR",
    price: 85.6,
    change: -0.05,
    changePct: -0.06,
    currency: "INR",
  },
];

// ── Fetch live snapshot from Vercel proxy ────────────────────────────────────
function useMarketSnapshot() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  const load = useCallback(async (bustCache = false) => {
    setLoading(true);
    try {
      const url = bustCache
        ? `/api/market-data?t=${Date.now()}`
        : "/api/market-data";
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json.ok && json.data?.length) {
        setData(json.data);
        setLastSync(new Date(json.ts));
        setIsDemo(false);
      } else {
        throw new Error("empty");
      }
    } catch {
      setData(DEMO_DATA);
      setLastSync(null);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  return {
    nifty: data?.find((q) => q.symbol === "^NSEI"),
    sensex: data?.find((q) => q.symbol === "^BSESN"),
    gold: data?.find((q) => q.symbol === "GC=F"),
    usdinr: data?.find((q) => q.symbol === "INR=X"),
    loading,
    lastSync,
    isDemo,
    refresh: load,
    forceRefresh: () => load(true),
  };
}

// ── Market mood based on Nifty % change ─────────────────────────────────────
function getMood(pct) {
  if (pct == null) return null;
  if (pct >= 1.5) return "great";
  if (pct >= 0.4) return "good";
  if (pct > -0.4) return "flat";
  if (pct > -1.5) return "dip";
  return "down";
}

const MOOD_CFG = {
  great: {
    emoji: "🚀",
    color: "#4ade80",
    bg: "#0d2b1a",
    border: "#22543d",
    headline: "Markets are flying today",
    body: "Indian stocks have gained well. Your equity MFs and SIP investments are likely up significantly today. A great time to feel confident about your long-term plan.",
  },
  good: {
    emoji: "😊",
    color: "#86efac",
    bg: "#0f2318",
    border: "#166534",
    headline: "Markets are up today",
    body: "Indian stocks are in positive territory. Your equity and MF investments are likely up slightly. Continue your SIPs as planned — no action needed.",
  },
  flat: {
    emoji: "😐",
    color: "var(--text-secondary)",
    bg: "var(--surface)",
    border: "var(--border)",
    headline: "Markets are calm today",
    body: "Very little movement today — things are stable. Your investments are holding steady. Business as usual.",
  },
  dip: {
    emoji: "😌",
    color: "#fca5a5",
    bg: "#2b0d0d",
    border: "#7f1d1d",
    headline: "Markets dipped slightly",
    body: "Indian stocks fell a little today. This is completely normal — markets go up and down all the time. Don't stop your SIPs. A dip means you're buying more units at a lower price.",
  },
  down: {
    emoji: "😮",
    color: "#f87171",
    bg: "#3a0d0d",
    border: "#991b1b",
    headline: "Markets are down today",
    body: "Indian stocks have fallen sharply today. Don't panic — this happens a few times every year and markets have always recovered. Stay invested. Long-term wealth isn't built by reacting to single-day swings.",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(val, currency) {
  if (val == null) return "—";
  if (currency === "INR")
    return val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtPct(pct) {
  if (pct == null) return null;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

// ── Single stat tile ──────────────────────────────────────────────────────────
function StatTile({ quote, label, subtitle }) {
  const pct = quote?.changePct ?? null;
  const isPos = pct > 0.05;
  const isNeg = pct < -0.05;
  const color = isPos ? "#4ade80" : isNeg ? "#f87171" : "var(--text-secondary)";
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;

  return (
    <div
      className="card"
      style={{
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 2,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          color: "var(--text)",
          lineHeight: 1.2,
        }}
      >
        {quote ? (
          fmtNum(quote.price, quote.currency)
        ) : (
          <span
            className="skeleton"
            style={{
              width: 80,
              height: 22,
              display: "inline-block",
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}
      >
        {quote ? (
          <>
            <Icon size={13} style={{ color }} />
            <span style={{ fontSize: 13, color, fontWeight: 600 }}>
              {fmtPct(pct) || "—"}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              today
            </span>
          </>
        ) : (
          <div
            className="skeleton"
            style={{ width: 60, height: 14, borderRadius: 4 }}
          />
        )}
      </div>
    </div>
  );
}

// ── Sentiment badge for news ──────────────────────────────────────────────────
function SentimentBadge({ label }) {
  const map = {
    Bullish: { bg: "#0d2b1a", border: "#166534", text: "#4ade80" },
    "Somewhat-Bullish": { bg: "#0f1f10", border: "#15803d", text: "#86efac" },
    Bearish: { bg: "#2b0d0d", border: "#7f1d1d", text: "#fca5a5" },
    "Somewhat-Bearish": { bg: "#1f0e0e", border: "#991b1b", text: "#f87171" },
    Neutral: {
      bg: "var(--surface)",
      border: "var(--border)",
      text: "var(--text-secondary)",
    },
  };
  const s = map[label] || map.Neutral;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 99,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label?.replace("Somewhat-", "~") || "Neutral"}
    </span>
  );
}

// ── Quick Links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  {
    label: "Google Finance",
    url: "https://www.google.com/finance/",
    emoji: "📊",
  },
  { label: "NSE India", url: "https://www.nseindia.com/", emoji: "📈" },
  {
    label: "Moneycontrol",
    url: "https://www.moneycontrol.com/markets/",
    emoji: "💹",
  },
  { label: "Screener.in", url: "https://www.screener.in/", emoji: "🔍" },
  {
    label: "Value Research",
    url: "https://www.valueresearchonline.com/",
    emoji: "🏆",
  },
  { label: "BSE India", url: "https://www.bseindia.com/", emoji: "🏛️" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketPulse() {
  const {
    nifty,
    sensex,
    gold,
    usdinr,
    loading,
    lastSync,
    isDemo,
    forceRefresh,
  } = useMarketSnapshot();
  const {
    news,
    aiInsight,
    loading: newsLoading,
    aiLoading,
    generateInsight,
  } = useMarketPulse();

  const mood = getMood(nifty?.changePct);
  const moodCfg = mood ? MOOD_CFG[mood] : null;

  const goldNote =
    gold?.changePct != null
      ? gold.changePct > 0.5
        ? " Gold is also up today — good news for your gold holdings."
        : gold.changePct < -0.5
          ? " Gold dipped slightly today."
          : ""
      : "";

  return (
    <div style={{ maxWidth: 860 }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Market Pulse
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {lastSync
              ? `Updated ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : isDemo
                ? "Preview — live data available on production"
                : "Loading…"}
          </p>
        </div>
        <button
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            padding: "6px 12px",
            flexShrink: 0,
            marginTop: 4,
          }}
          onClick={forceRefresh}
          disabled={loading}
        >
          <RefreshCw
            size={13}
            style={loading ? { animation: "spin 1s linear infinite" } : {}}
          />
          Refresh
        </button>
      </div>

      {/* ── Market Mood Card ── */}
      {moodCfg && (
        <div
          style={{
            background: moodCfg.bg,
            border: `1px solid ${moodCfg.border}`,
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div
            style={{ fontSize: 40, lineHeight: 1, flexShrink: 0, marginTop: 2 }}
          >
            {moodCfg.emoji}
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: moodCfg.color,
                fontFamily: "var(--font-display)",
                marginBottom: 6,
              }}
            >
              {moodCfg.headline}
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--text)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {moodCfg.body}
              {goldNote}
            </p>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              💡 Tip: Short-term market moves don&apos;t derail long-term
              wealth. Stay consistent with your SIPs.
            </div>
          </div>
        </div>
      )}

      {/* ── 4 Stat Tiles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <StatTile
          quote={nifty}
          label="Nifty 50"
          subtitle="Indian large-cap index"
        />
        <StatTile
          quote={sensex}
          label="Sensex"
          subtitle="BSE top 30 companies"
        />
        <StatTile quote={gold} label="Gold" subtitle="USD per troy ounce" />
        <StatTile quote={usdinr} label="USD / INR" subtitle="Exchange rate" />
      </div>

      {/* ── AI Insight + News ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        {/* AI Insight */}
        <div className="card" style={{ padding: "1.1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={12} style={{ color: "var(--gold)" }} />
              AI Insight
            </div>
            <button
              className="btn-ghost"
              style={{
                fontSize: 11,
                padding: "3px 9px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={generateInsight}
              disabled={aiLoading || newsLoading}
            >
              <RefreshCw
                size={10}
                style={
                  aiLoading ? { animation: "spin 1s linear infinite" } : {}
                }
              />
              {aiInsight ? "Refresh" : "Generate"}
            </button>
          </div>
          {aiLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[100, 85, 70].map((w) => (
                <div
                  key={w}
                  className="skeleton"
                  style={{ height: 13, borderRadius: 4, width: `${w}%` }}
                />
              ))}
            </div>
          )}
          {!aiLoading && aiInsight && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {aiInsight}
            </p>
          )}
          {!aiLoading && !aiInsight && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              {newsLoading
                ? "Loading news data…"
                : "Tap Generate for an AI-powered outlook based on today's news."}
            </p>
          )}
        </div>

        {/* Top News stories */}
        <div className="card" style={{ padding: "1.1rem" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.75rem",
            }}
          >
            Top Stories
          </div>
          {newsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div
                    className="skeleton"
                    style={{ height: 13, borderRadius: 4, marginBottom: 4 }}
                  />
                  <div
                    className="skeleton"
                    style={{ height: 13, borderRadius: 4, width: "70%" }}
                  />
                </div>
              ))}
            </div>
          )}
          {!newsLoading && !news && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              Add a <code style={{ fontSize: 12 }}>VITE_ALPHAVANTAGE_KEY</code>{" "}
              to see live finance news with sentiment.
            </p>
          )}
          {!newsLoading && news && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {news.slice(0, 4).map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm, 6px)",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--gold-border)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        lineHeight: 1.45,
                        fontWeight: 500,
                      }}
                    >
                      {a.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 3,
                      }}
                    >
                      {a.source}
                    </div>
                  </div>
                  <SentimentBadge label={a.sentiment} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="card" style={{ padding: "1rem 1.1rem" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "0.75rem",
          }}
        >
          Explore More
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {QUICK_LINKS.map(({ label, url, emoji }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 99,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--text)",
                textDecoration: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gold-border)";
                e.currentTarget.style.background = "var(--gold-dim)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface)";
              }}
            >
              <span>{emoji}</span>
              <span>{label}</span>
              <ExternalLink
                size={10}
                style={{ color: "var(--text-secondary)" }}
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
