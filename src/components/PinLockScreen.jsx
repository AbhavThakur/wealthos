import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { hashPin } from "../utils/hashPin";

const LOCKOUT_SECONDS = 30;
const MAX_ATTEMPTS = 3;

export default function PinLockScreen({ pin, onUnlock }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const ref0 = useRef();
  const ref1 = useRef();
  const ref2 = useRef();
  const ref3 = useRef();
  const refs = useMemo(() => [ref0, ref1, ref2, ref3], []);
  const attemptsRef = useRef(0);

  // Derive locked state from lockoutRemaining (pure, no Date.now())
  const isLocked = lockoutRemaining > 0;

  // Focus first digit on mount
  useEffect(() => {
    refs[0].current?.focus();
  }, [refs]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutEnd <= Date.now()) return;
    const id = setInterval(() => {
      const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutRemaining(0);
        setLockoutEnd(0);
        attemptsRef.current = 0;
        setError("");
        setDigits(["", "", "", ""]);
        refs[0].current?.focus();
        clearInterval(id);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 250);
    return () => clearInterval(id);
  }, [lockoutEnd, refs]);

  // verifyPin declared before handleChange to avoid "accessed before declaration"
  const verifyPin = useCallback(
    async (enteredPin) => {
      const hashed = await hashPin(enteredPin);

      if (hashed === pin) {
        sessionStorage.setItem("wealthos_unlocked", "household");
        sessionStorage.setItem("wealthos_unlock_ts", String(Date.now()));
        onUnlock("household");
        return;
      }

      // Wrong PIN
      attemptsRef.current += 1;
      const newAttempts = attemptsRef.current;
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (newAttempts >= MAX_ATTEMPTS) {
        const end = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutEnd(end);
        setLockoutRemaining(LOCKOUT_SECONDS);
        setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS}s.`);
      } else {
        setError(
          `Wrong PIN (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts > 1 ? "s" : ""} left)`,
        );
      }

      setDigits(["", "", "", ""]);
      refs[0].current?.focus();
    },
    [pin, onUnlock, refs],
  );

  const handleChange = useCallback(
    (index, value) => {
      if (isLocked) return;
      // Only single digit
      const d = value.replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[index] = d;
      setDigits(next);
      setError("");

      if (d && index < 3) {
        refs[index + 1].current?.focus();
      }

      // Auto-submit when all 4 filled
      if (d && index === 3 && next.every((x) => x !== "")) {
        const enteredPin = next.join("");
        verifyPin(enteredPin);
      }
    },
    [digits, isLocked, refs, verifyPin],
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        refs[index - 1].current?.focus();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
      }
    },
    [digits, refs],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: "1rem",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 340,
          width: "100%",
        }}
      >
        {/* Logo/Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "var(--gold-dim)",
            border: "1px solid var(--gold-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: 28,
          }}
        >
          🔒
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          WealthOS
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: "2rem",
          }}
        >
          Enter your 4-digit PIN to continue
        </div>

        {/* PIN digits */}
        <div
          className={shake ? "pin-shake" : ""}
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginBottom: "1.5rem",
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isLocked}
              autoComplete="off"
              style={{
                width: 52,
                height: 60,
                textAlign: "center",
                fontSize: 24,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                background: d ? "var(--gold-dim)" : "var(--bg-card)",
                border: `2px solid ${error ? "var(--red)" : d ? "var(--gold-border)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.15s, background 0.15s",
                opacity: isLocked ? 0.4 : 1,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--gold)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = d
                  ? "var(--gold-border)"
                  : "var(--border)";
              }}
            />
          ))}
        </div>

        {/* Error / lockout */}
        {error && (
          <div
            style={{
              fontSize: 13,
              color: "var(--red)",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span>⚠</span>
            <span>
              {isLocked ? `Locked. Retry in ${lockoutRemaining}s` : error}
            </span>
          </div>
        )}

        {/* Hint */}
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: "2rem",
          }}
        >
          Enter your household PIN to unlock.
        </div>
      </div>
    </div>
  );
}
