import { memo } from "react";
import { ASSET_TYPE_THEMES, INVESTMENT_GLOSSARY, getRiskBadge } from "../utils/mfCategorizer";

/**
 * Shown when a user has zero investments.
 * Provides beginner-friendly guidance on where to start.
 */
const InvestmentEmptyState = memo(function InvestmentEmptyState({ onAddClick }) {
  const STARTER_TYPES = [
    {
      type: "Mutual Fund",
      why: "Best for beginners. Start a SIP with ₹500/month and let professionals manage your money.",
      action: "Start a SIP →",
    },
    {
      type: "FD",
      why: "If you want guaranteed returns with zero risk. Park emergency funds here.",
      action: "Add an FD →",
    },
    {
      type: "PPF",
      why: "Best for long-term tax-free savings. Government backed, 15-year lock-in.",
      action: "Add PPF →",
    },
    {
      type: "EPF",
      why: "Already contributing via salary? Track it here to see your full net worth.",
      action: "Track EPF →",
    },
  ];

  return (
    <div
      className="card"
      style={{
        textAlign: "center",
        padding: "40px 24px",
        background: "linear-gradient(135deg, rgba(59,130,246,0.05), rgba(16,185,129,0.04), rgba(18,18,24,0.98))",
        border: "1px dashed rgba(255,255,255,0.15)",
        borderRadius: 16,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
      <h3
        style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Start Your Investment Journey
      </h3>
      <p
        style={{
          color: "var(--text-secondary, #999)",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 480,
          margin: "0 auto 24px",
        }}
      >
        Track all your investments in one place — mutual funds, FDs, PPF, stocks, and more.
        See how your money grows over time with projections, actual returns, and smart insights.
      </p>

      {/* Quick Start Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
          textAlign: "left",
        }}
      >
        {STARTER_TYPES.map(({ type, why, action }) => {
          const theme = ASSET_TYPE_THEMES[type];
          const risk = getRiskBadge(type);
          return (
            <div
              key={type}
              onClick={onAddClick}
              style={{
                background: `linear-gradient(135deg, ${theme.bgTint}, rgba(18,18,24,0.95))`,
                border: `1px solid ${theme.color}33`,
                borderLeft: `4px solid ${theme.color}`,
                borderRadius: 12,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = `${theme.color}66`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = `${theme.color}33`;
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{theme.icon}</span>
                <strong style={{ color: "#fff", fontSize: 14 }}>{type}</strong>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: risk.bg,
                    color: risk.color,
                    border: risk.border,
                    fontWeight: 600,
                    marginLeft: "auto",
                  }}
                >
                  {risk.label}
                </span>
              </div>
              <div style={{ color: "var(--text-secondary, #999)", fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                {why}
              </div>
              <div style={{ color: theme.color, fontSize: 12, fontWeight: 600 }}>{action}</div>
            </div>
          );
        })}
      </div>

      {/* Glossary Preview */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "16px 20px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📖 Quick Glossary — Terms You&apos;ll See Here
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {["SIP", "CAGR", "Corpus", "Expected Return", "NAV", "Tax Saving (80C)"].map((term) => (
            <div key={term} style={{ fontSize: 12, lineHeight: 1.5 }}>
              <strong style={{ color: "var(--blue, #60a5fa)" }}>{term}:</strong>{" "}
              <span style={{ color: "var(--text-secondary, #999)" }}>{INVESTMENT_GLOSSARY[term]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main CTA */}
      <button
        className="btn-primary"
        onClick={onAddClick}
        style={{
          marginTop: 24,
          padding: "12px 32px",
          fontSize: 15,
          fontWeight: 700,
          borderRadius: 12,
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
          transition: "all 0.2s ease",
        }}
      >
        ➕ Add Your First Investment
      </button>
    </div>
  );
});

export default InvestmentEmptyState;
