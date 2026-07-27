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

  // The touch target (.main-content) doesn't have its own scroll container —
  // the page/window scrolls instead. Checking el.scrollTop (always 0) made the
  // hook think it was always at the top, so any downward drag anywhere on the
  // page (e.g. swiping down to scroll back up) was misread as a pull-to-refresh
  // gesture and could trigger a full page reload mid-scroll. Check the actual
  // window/document scroll position instead.
  function atPageTop() {
    return (
      window.scrollY <= 0 && (document.scrollingElement?.scrollTop ?? 0) <= 0
    );
  }

  function onTouchStart(e) {
    // Only activate when the page itself is scrolled to the top
    if (!atPageTop() || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e) {
    if (!pulling.current || refreshing) return;
    // Bail out the moment the page has scrolled away from the top — this is a
    // normal scroll, not a pull-to-refresh gesture.
    if (!atPageTop()) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
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
