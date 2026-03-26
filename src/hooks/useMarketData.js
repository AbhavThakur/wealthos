import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchAllMFNavs,
  fetchGoldPrice,
  computeLivePortfolio,
  computePortfolioGainLoss,
} from "../utils/marketData";

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 min

/**
 * Hook that auto-fetches live market data for all investments.
 *
 * @param {Array} investments - combined investments array (all persons)
 * @returns {{ navMap, goldPrice, portfolio, gainLoss, loading, lastSync, refresh }}
 */
export function useMarketData(investments) {
  const [navMap, setNavMap] = useState(new Map());
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const timerRef = useRef(null);
  const investmentsRef = useRef(investments);

  // Sync ref in effect to satisfy React 19
  useEffect(() => {
    investmentsRef.current = investments;
  }, [investments]);

  const refresh = useCallback(async () => {
    const inv = investmentsRef.current;
    if (!inv?.length) return;
    setLoading(true);
    try {
      const [navs, gold] = await Promise.all([
        fetchAllMFNavs(inv),
        fetchGoldPrice(),
      ]);
      setNavMap(navs);
      if (gold) setGoldPrice(gold);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }, []); // stable - uses ref

  // Auto-fetch on mount only; refresh on interval
  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  // Computed values
  const portfolio = computeLivePortfolio(investments, navMap);
  const gainLoss = computePortfolioGainLoss(investments);

  return {
    navMap,
    goldPrice,
    portfolio,
    gainLoss,
    loading,
    lastSync,
    refresh,
  };
}
