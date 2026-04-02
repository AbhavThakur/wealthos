import { useState, useEffect, useRef } from "react";

/**
 * Pull-to-refresh hook for PWA.
 * Returns { pullDistance, refreshing, handlers } to attach to the scroll container.
 * Calls `onRefresh` when the user pulls down past the threshold.
 */
export default function usePullToRefresh(onRefresh, { threshold = 80 } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    if (!refreshing) return;
    let cancelled = false;

    Promise.resolve(onRefresh?.()).finally(() => {
      if (!cancelled) {
        // Haptic feedback on successful refresh
        if (navigator.vibrate) navigator.vibrate(20);
        setRefreshing(false);
        setPullDistance(0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshing, onRefresh]);

  function onTouchStart(e) {
    // Only activate when scrolled to top
    const el = e.currentTarget;
    if (el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e) {
    if (!pulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    // Dampen pull (diminishing returns past threshold)
    const damped = Math.min(dy * 0.5, threshold * 1.5);
    setPullDistance(damped);
  }

  function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      if (navigator.vibrate) navigator.vibrate(15);
    } else {
      setPullDistance(0);
    }
  }

  return {
    pullDistance,
    refreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
