import { useState, useEffect } from "react";

const TIPS = [
  {
    title: "Welcome to WealthOS! 🎉",
    text: "Your household finance tracker. Let's take a quick tour of the key features.",
    position: "center",
  },
  {
    title: "Dashboard",
    text: "Your financial pulse — income, expenses, savings rate, and wealth projections all in one view.",
    position: "center",
  },
  {
    title: "Budget",
    text: "Track monthly expenses, one-time purchases, and trips. Set budget rules like 50/30/20.",
    position: "center",
  },
  {
    title: "Quick Add (Ctrl+E)",
    text: "Quickly add expenses from anywhere. On mobile, tap the + button in the bottom nav.",
    position: "center",
  },
  {
    title: "Search (Ctrl+K)",
    text: "Find any expense, investment, goal, or page instantly with the command palette.",
    position: "center",
  },
  {
    title: "Profile Switcher",
    text: "Switch between Household view and individual profiles using the pills at the top.",
    position: "center",
  },
  {
    title: "You're all set! ✨",
    text: "Explore at your own pace. Visit Settings for theme, PIN lock, and data export.",
    position: "center",
  },
];

const LS_KEY = "wealthos-tour-done";

export default function OnboardingTour({ show }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && !localStorage.getItem(LS_KEY)) {
      // Delay slightly so the app renders first
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  const tip = TIPS[step];
  const isLast = step === TIPS.length - 1;

  const finish = () => {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "fadeIn 0.3s ease",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius-lg, 16px)",
          padding: "24px 28px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
          animation: "goalCelebrate 0.4s ease-out",
        }}
      >
        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {TIPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? "var(--gold)" : "var(--border)",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          {tip.title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {tip.text}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {step > 0 && (
            <button
              className="btn-ghost"
              onClick={() => setStep((s) => s - 1)}
              style={{ padding: "8px 20px", fontSize: 13 }}
            >
              Back
            </button>
          )}
          {!isLast ? (
            <button
              className="btn-primary"
              onClick={() => setStep((s) => s + 1)}
              style={{ padding: "8px 24px", fontSize: 13 }}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={finish}
              style={{ padding: "8px 24px", fontSize: 13 }}
            >
              Get Started
            </button>
          )}
        </div>

        <button
          onClick={finish}
          style={{
            marginTop: 12,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
