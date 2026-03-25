import { useState, useCallback, useRef } from "react";

export function useUndoToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showUndo = useCallback((label, onUndo) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ label, onUndo });
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const toastEl = toast ? (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 9999,
        fontSize: 13,
        color: "var(--text-primary)",
      }}
    >
      <span>{toast.label}</span>
      <button
        style={{
          background: "var(--gold-dim)",
          color: "var(--gold)",
          border: "1px solid var(--gold-border)",
          borderRadius: 4,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
        onClick={() => {
          toast.onUndo();
          setToast(null);
        }}
      >
        Undo
      </button>
      <button
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 16,
        }}
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  ) : null;

  return { showUndo, toastEl };
}
