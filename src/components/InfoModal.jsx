import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Info } from "lucide-react";

export function InfoModal({ title, children }) {
  const [open, setOpen] = useState(false);
  const overlay = open
    ? createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 99999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "max(24px, 5vh) 24px 24px",
            overflowY: "auto",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "#1a1a24",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "24px 28px",
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
              color: "#eeeae4",
              maxHeight: "85dvh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, color: "#eeeae4" }}>
                {title}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "none",
                  cursor: "pointer",
                  color: "#aaa",
                  padding: "4px 6px",
                  borderRadius: 6,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#b0aab8",
                lineHeight: 1.8,
              }}
            >
              {children}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          color: "#888",
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          marginLeft: 5,
        }}
        title={`About ${title}`}
        aria-label={`Info about ${title}`}
      >
        <Info size={13} />
      </button>
      {overlay}
    </>
  );
}
