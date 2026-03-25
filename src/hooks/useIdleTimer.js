import { useEffect, useRef, useCallback } from "react";

const IDLE_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

/**
 * Auto-lock after `timeout` ms of inactivity.
 * Calls `onIdle()` when the user has been idle for `timeout` ms.
 * @param {Function} onIdle - callback when idle timeout reached
 * @param {number} timeout - idle timeout in ms (default 5 min)
 * @param {boolean} enabled - whether the timer is active
 */
export default function useIdleTimer(
  onIdle,
  timeout = 5 * 60 * 1000,
  enabled = true,
) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (enabled) {
      timerRef.current = setTimeout(() => onIdleRef.current(), timeout);
    }
  }, [timeout, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Start timer
    reset();

    // Reset on user activity
    const handler = () => reset();
    for (const evt of IDLE_EVENTS) {
      window.addEventListener(evt, handler, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of IDLE_EVENTS) {
        window.removeEventListener(evt, handler);
      }
    };
  }, [reset, enabled]);
}
