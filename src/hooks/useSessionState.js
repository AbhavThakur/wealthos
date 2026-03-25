import { useState, useCallback } from "react";

export function useSessionState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const s = sessionStorage.getItem(key);
      return s !== null ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v) => {
      setVal(v);
      try {
        sessionStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* empty */
      }
    },
    [key],
  );
  return [val, set];
}
