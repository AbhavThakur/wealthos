/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ViewModeContext = createContext({
  viewMode: "pro", // "simple" | "pro"
  setViewMode: () => {},
  toggleViewMode: () => {},
  isSimple: false,
});

const STORAGE_KEY = "wealthos_view_mode";

export function ViewModeProvider({ children }) {
  const [viewMode, setViewModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "simple" || saved === "pro") return saved;
    } catch {
      /* ignore */
    }
    return "pro";
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-view-mode", viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((current) => {
      const next = current === "simple" ? "pro" : "simple";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = {
    viewMode,
    setViewMode,
    toggleViewMode,
    isSimple: viewMode === "simple",
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    return {
      viewMode: "pro",
      setViewMode: () => {},
      toggleViewMode: () => {},
      isSimple: false,
    };
  }
  return ctx;
}
