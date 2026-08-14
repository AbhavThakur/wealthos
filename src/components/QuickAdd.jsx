import { useState, useEffect, useCallback } from "react";
import { Plus, Zap, Send, ArrowRight } from "lucide-react";
import useDraggable from "../hooks/useDraggable";
import { haptic } from "../utils/haptic";
import { parseQuickLogText } from "../utils/quickLog";
import { useData } from "../context/DataContext";
import { toast } from "sonner";
import { fmt } from "../utils/finance";

export default function QuickAdd({
  setPage,
  setProfile,
  personNames,
  externalOpen,
  setExternalOpen,
}) {
  const drag = useDraggable("quickadd", { bottom: 148, right: 28 });
  const [internalOpen, setInternalOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const { updatePerson1, updatePerson2, p1, p2 } = useData() || {};

  const open = externalOpen || internalOpen;
  const close = useCallback(() => {
    setInternalOpen(false);
    setQuickText("");
    if (setExternalOpen) setExternalOpen(false);
  }, [setExternalOpen]);

  const toggle = useCallback(() => {
    if (externalOpen || internalOpen) {
      setInternalOpen(false);
      setQuickText("");
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
    sessionStorage.setItem("budget-open-tab", "onetime");
    close();
  };

  // Preview parsed text in real-time
  const parsedPreview = quickText.trim() ? parseQuickLogText(quickText, "p1", personNames) : null;

  const handleQuickSubmit = (e) => {
    e?.preventDefault();
    if (!parsedPreview) return;

    haptic("success");
    const targetPerson = parsedPreview.person === "p2" ? "p2" : "p1";
    const updateFn = targetPerson === "p2" ? updatePerson2 : updatePerson1;
    const existingTxns = (targetPerson === "p2" ? p2?.transactions : p1?.transactions) || [];

    if (updateFn) {
      updateFn("transactions", [parsedPreview, ...existingTxns]);
      toast.success(
        `Logged ${fmt(parsedPreview.amount)} for ${parsedPreview.name} (${parsedPreview.category}) for ${personNames?.[targetPerson] || targetPerson.toUpperCase()}!`
      );
    }

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
          <div
            className="quick-add-modal"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-display)",
                fontSize: 16,
                marginBottom: 12,
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="var(--gold)" />
              <span>Instant Quick-Log</span>
            </div>

            {/* Natural language Quick Input */}
            <form onSubmit={handleQuickSubmit} style={{ marginBottom: 16 }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  autoFocus
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder="e.g. 450 Swiggy P1 or Petrol 2000 P2"
                  style={{
                    width: "100%",
                    padding: "10px 42px 10px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius, 8px)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  disabled={!parsedPreview}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    bottom: 4,
                    background: parsedPreview ? "var(--gold)" : "transparent",
                    color: parsedPreview ? "#000" : "var(--text-muted)",
                    border: "none",
                    borderRadius: 6,
                    padding: "0 10px",
                    cursor: parsedPreview ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Send size={14} />
                </button>
              </div>

              {parsedPreview && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(234,179,8,0.1)",
                    border: "1px solid var(--gold-border)",
                    borderRadius: 6,
                    fontSize: 11,
                    display: "flex",
                    justifyContent: "space-between",
                    color: "var(--gold)",
                  }}
                >
                  <span>
                    ✓ {parsedPreview.name} ({parsedPreview.category})
                  </span>
                  <strong>
                    {fmt(parsedPreview.amount)} · {personNames?.[parsedPreview.person] || parsedPreview.person.toUpperCase()}
                  </strong>
                </div>
              )}
            </form>

            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Or open full budget manager for:
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {["p1", "p2"].map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(p)}
                  className="profile-pill active"
                  style={{
                    "--pill-color": p === "p1" ? "var(--p1)" : "var(--p2)",
                    "--pill-dim": p === "p1" ? "var(--p1-dim)" : "var(--p2-dim)",
                    flex: 1,
                    justifyContent: "center",
                    padding: "10px 14px",
                    fontSize: 13,
                  }}
                >
                  <span className="profile-pill-dot" />
                  {personNames?.[p] || p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
