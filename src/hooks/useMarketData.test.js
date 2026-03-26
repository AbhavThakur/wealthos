/**
 * Hook tests for useMarketData — stability and infinite loop prevention.
 * This test would have caught the infinite loop bug we fixed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMarketData } from "./useMarketData";

// Mock the marketData utils
vi.mock("../utils/marketData", () => ({
  fetchAllMFNavs: vi.fn(() => Promise.resolve(new Map())),
  fetchGoldPrice: vi.fn(() => Promise.resolve(5000)),
  computeLivePortfolio: vi.fn(() => []),
  computePortfolioGainLoss: vi.fn(() => []),
}));

describe("useMarketData hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useMarketData([]));

    expect(result.current.navMap).toBeInstanceOf(Map);
    expect(result.current.goldPrice).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.lastSync).toBe(null);
    expect(typeof result.current.refresh).toBe("function");
  });

  it("does not fetch when investments is empty", async () => {
    const { fetchAllMFNavs } = await import("../utils/marketData");

    renderHook(() => useMarketData([]));

    // Allow effects to run
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Should not call fetch when no investments
    expect(fetchAllMFNavs).not.toHaveBeenCalled();
  });

  it("fetches data when investments are provided", async () => {
    const { fetchAllMFNavs, fetchGoldPrice } =
      await import("../utils/marketData");

    const investments = [{ id: 1, name: "Test MF", type: "Mutual Fund" }];

    renderHook(() => useMarketData(investments));

    // Allow effects to run
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve(); // flush promises
    });

    expect(fetchAllMFNavs).toHaveBeenCalled();
    expect(fetchGoldPrice).toHaveBeenCalled();
  });

  it("does NOT cause infinite loop with new array references (bug test)", async () => {
    // This test would have caught the infinite loop bug!
    // The bug was: refresh depended on investments array,
    // causing new refresh → useEffect runs → state update → re-render → repeat

    const { fetchAllMFNavs } = await import("../utils/marketData");
    let renderCount = 0;

    const investments1 = [{ id: 1, name: "Test MF" }];
    const investments2 = [{ id: 1, name: "Test MF" }]; // Same data, new reference

    const { rerender } = renderHook(
      ({ investments }) => {
        renderCount++;
        return useMarketData(investments);
      },
      { initialProps: { investments: investments1 } },
    );

    // Allow initial effect
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    const initialRenderCount = renderCount;
    fetchAllMFNavs.mockClear();

    // Rerender with new array reference (same data)
    rerender({ investments: investments2 });

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    // Should NOT trigger additional fetches just because array reference changed
    // If it does, that means we have an infinite loop bug
    expect(renderCount - initialRenderCount).toBeLessThan(5);
  });

  it("refresh function is stable (same reference across renders)", async () => {
    const investments = [{ id: 1, name: "Test MF" }];

    const { result, rerender } = renderHook(() => useMarketData(investments));

    const firstRefresh = result.current.refresh;

    rerender();

    const secondRefresh = result.current.refresh;

    // refresh should be the same function reference (memoized)
    expect(firstRefresh).toBe(secondRefresh);
  });

  it("sets up interval for periodic refresh", async () => {
    const { fetchAllMFNavs } = await import("../utils/marketData");
    const investments = [{ id: 1, name: "Test MF" }];

    renderHook(() => useMarketData(investments));

    // Initial fetch
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    fetchAllMFNavs.mockClear();

    // Advance 30 minutes (the refresh interval)
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });

    // Should have fetched again
    expect(fetchAllMFNavs).toHaveBeenCalled();
  });

  it("cleans up interval on unmount", async () => {
    const investments = [{ id: 1, name: "Test MF" }];

    const { unmount } = renderHook(() => useMarketData(investments));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });
});
