import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMarketNews, fetchTopMovers } from "../utils/alphaVantage";
import { askAdvisor } from "../utils/aiAdvisor";

const INSIGHT_CACHE_KEY = "wos_av_ai_insight";
const INSIGHT_TTL = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Hook for Market Intelligence — fetches news, movers, and optional AI insight.
 * Calls Alpha Vantage only once per session (4hr cache in sessionStorage).
 * Gemini AI analysis is opportunistic — works when available, gracefully absent when not.
 */
export function useMarketPulse() {
  const [news, setNews] = useState(null);
  const [movers, setMovers] = useState(null);
  const [aiInsight, setAiInsight] = useState(() => {
    try {
      const raw = sessionStorage.getItem(INSIGHT_CACHE_KEY);
      if (raw) {
        const { text, ts } = JSON.parse(raw);
        if (Date.now() - ts < INSIGHT_TTL) return text;
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const fetched = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const [newsData, moversData] = await Promise.allSettled([
        fetchMarketNews(),
        fetchTopMovers(),
      ]);
      const n = newsData.status === "fulfilled" ? newsData.value : null;
      const m = moversData.status === "fulfilled" ? moversData.value : null;
      if (n) setNews(n);
      if (m) setMovers(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // AI insight — only if we have news data and no cached insight
  const generateInsight = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const newsForAI = news
        ? news
            .slice(0, 6)
            .map(
              (a, i) =>
                `${i + 1}. ${a.title} (${a.sentiment}, score: ${a.sentimentScore})`,
            )
            .join("\n")
        : "No news data available";

      const moversForAI = movers
        ? `Top gainers: ${movers.gainers.map((g) => `${g.ticker} ${g.changePct}`).join(", ")}\nTop losers: ${movers.losers.map((l) => `${l.ticker} ${l.changePct}`).join(", ")}`
        : "";

      const prompt = `Based on today's market data:

${newsForAI}

${moversForAI}

Give me a brief market outlook (2-3 lines) and suggest top 3 actions an Indian investor should consider today. Focus on Indian mutual funds, Nifty, and gold. Be specific with fund categories (large-cap, flexi-cap, debt, gold ETF, etc). Keep it under 100 words.`;

      const result = await askAdvisor(prompt, {
        note: "Market intelligence request — no personal data needed",
      });

      if (result && !result.startsWith("⚠️") && !result.startsWith("❌")) {
        setAiInsight(result);
        sessionStorage.setItem(
          INSIGHT_CACHE_KEY,
          JSON.stringify({ text: result, ts: Date.now() }),
        );
      }
    } catch {
      // AI is optional, silently fail
    } finally {
      setAiLoading(false);
    }
  }, [news, movers, aiLoading]);

  return {
    news,
    movers,
    aiInsight,
    loading,
    aiLoading,
    generateInsight,
  };
}
