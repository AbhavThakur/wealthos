import { useState, useRef, useEffect, memo } from "react";

/**
 * A small ⓘ icon that shows a tooltip on hover/tap with beginner-friendly
 * explanations of investment terms.
 * 
 * Usage: <InfoTooltip term="SIP" glossary={INVESTMENT_GLOSSARY} />
 */
const InfoTooltip = memo(function InfoTooltip({ term, glossary, customText }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const text = customText || (glossary && glossary[term]) || "";

  // Close on outside click (mobile-friendly)
  useEffect(() => {
    if (!show) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [show]);

  if (!text) return null;

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShow((p) => !p);
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.08)",
          color: "var(--text-secondary, #999)",
          fontSize: 10,
          fontWeight: 700,
          cursor: "help",
          marginLeft: 4,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.12)",
          transition: "all 0.2s ease",
          ...(show ? { background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", borderColor: "#3b82f644" } : {}),
        }}
        aria-label={`What is ${term}?`}
        role="button"
        tabIndex={0}
      >
        i
      </span>
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(30, 30, 40, 0.97)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#e0dde6",
            width: "min(280px, 80vw)",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            pointerEvents: "auto",
            animation: "tooltipFadeIn 0.15s ease-out",
          }}
        >
          <strong style={{ color: "#fff", fontSize: 12, display: "block", marginBottom: 3 }}>
            {term}
          </strong>
          {text}
          {/* Arrow */}
          <span
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "rgba(30, 30, 40, 0.97)",
              borderRight: "1px solid rgba(255,255,255,0.15)",
              borderBottom: "1px solid rgba(255,255,255,0.15)",
            }}
          />
        </span>
      )}
    </span>
  );
});

export default InfoTooltip;
