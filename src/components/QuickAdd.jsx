import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import useDraggable from "../hooks/useDraggable";
import { haptic } from "../utils/haptic";

export default function QuickAdd({
  setPage,
  setProfile,
  personNames,
  externalOpen,
  setExternalOpen,
}) {
  const drag = useDraggable("quickadd", { bottom: 148, right: 28 });
  const [internalOpen, setInternalOpen] = useState(false);

  const open = externalOpen || internalOpen;
  const close = useCallback(() => {
    setInternalOpen(false);
    if (setExternalOpen) setExternalOpen(false);
  }, [setExternalOpen]);
  const toggle = useCallback(() => {
    if (externalOpen || internalOpen) {
      setInternalOpen(false);
      if (setExternalOpen) setExternalOpen(false);
    } else {
      setInternalOpen(true);
    }
  }, [externalOpen, internalOpen, setExternalOpen]);

  // Keyboard shortcut: Ctrl+E or Cmd+E
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && open) close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close, toggle]);

  const navigate = (person) => {
    haptic("medium");
    setProfile(person);
    setPage("budget");
    // Signal Budget to open the one-time expense tab
    sessionStorage.setItem("budget-open-tab", "onetime");
    close();
  };

  return (
    <>
      {/* FAB (desktop only — hidden on mobile via CSS) */}
      <button
        className="quick-add-fab"
        {...drag.handlers}
        style={drag.style}
        onClick={() => {
          if (drag.isDragging) return;
          toggle();
        }}
        title="Add expense (Ctrl+E)"
        aria-label="Add expense"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>

      {/* Person picker popup */}
      {open && (
        <div className="quick-add-overlay" onClick={close}>
          <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              Add expense for
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["abhav", "aanya"].map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(p)}
                  className={`profile-pill active`}
                  style={{
                    "--pill-color":
                      p === "abhav" ? "var(--abhav)" : "var(--aanya)",
                    "--pill-dim":
                      p === "abhav" ? "var(--abhav-dim)" : "var(--aanya-dim)",
                    flex: 1,
                    justifyContent: "center",
                    padding: "12px 16px",
                    fontSize: 14,
                  }}
                >
                  <span className="profile-pill-dot" />
                  {personNames?.[p] || p}
                </button>
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              Opens one-time expenses in Budget
            </div>
          </div>
        </div>
      )}
    </>
  );
}
