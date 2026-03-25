import { useState, useCallback } from "react";

// Confirm dialog for destructive actions
function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: "1.25rem",
            lineHeight: 1.6,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? "btn-primary" : "btn-primary"}
            onClick={onConfirm}
            style={danger ? { background: "var(--red)", color: "#fff" } : {}}
          >
            {danger ? "Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    danger: false,
    resolve: null,
  });
  const confirm = useCallback((title, message, danger = true) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, danger, resolve });
    });
  }, []);
  const dialog = state.open ? (
    <ConfirmDialog
      open
      title={state.title}
      message={state.message}
      danger={state.danger}
      onConfirm={() => {
        state.resolve(true);
        setState((s) => ({ ...s, open: false }));
      }}
      onCancel={() => {
        state.resolve(false);
        setState((s) => ({ ...s, open: false }));
      }}
    />
  ) : null;
  return { confirm, dialog };
}
