import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import useDraggable from "../hooks/useDraggable";

export default function QuickAdd({ setPage, setProfile, personNames }) {
  const drag = useDraggable("quickadd", { bottom: 148, right: 28 });
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: Ctrl+E or Cmd+E
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const navigate = (person) => {
    setProfile(person);
    setPage("budget");
    // Signal Budget to open the one-time expense tab
    sessionStorage.setItem("budget-open-tab", "onetime");
    setOpen(false);
  };

  return (
    <>
      {/* FAB */}
      <button
        className="quick-add-fab"
        {...drag.handlers}
        style={drag.style}
        onClick={() => {
          if (drag.isDragging) return;
          setOpen((o) => !o);
        }}
        title="Add expense (Ctrl+E)"
        aria-label="Add expense"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>

      {/* Person picker popup */}
      {open && (
        <div className="quick-add-overlay" onClick={() => setOpen(false)}>
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
