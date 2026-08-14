import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Zap, Send, ArrowRight } from "lucide-react";
import useDraggable from "../hooks/useDraggable";
import { haptic } from "../utils/haptic";
import { parseQuickLogText } from "../utils/quickLog";
import { useData } from "../context/DataContext";
import { toast } from "sonner";
import { fmt, nextId } from "../utils/finance";
import { localDateISO, localYearMonth } from "../utils/date";

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
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(localYearMonth());
  const { updatePerson, p1, p2 } = useData() || {};
  const pushedHistoryRef = useRef(false);

  const open = externalOpen || internalOpen;
  const close = useCallback(() => {
    setInternalOpen(false);
    setQuickText("");
    setSelectedPerson(null);
    setSelectedMonth(localYearMonth());
    if (setExternalOpen) setExternalOpen(false);
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, [setExternalOpen]);

  const toggle = useCallback(() => {
    if (externalOpen || internalOpen) {
      close();
    } else {
      setInternalOpen(true);
    }
  }, [externalOpen, internalOpen, close]);

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

  // PWA: intercept the mobile back button so it closes the modal instead of the app
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ quickAddModal: true }, "");
    pushedHistoryRef.current = true;
    const handlePopState = () => {
      pushedHistoryRef.current = false;
      setInternalOpen(false);
      setQuickText("");
      setSelectedPerson(null);
      setSelectedMonth(localYearMonth());
      if (setExternalOpen) setExternalOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const navigate = (person) => {
    haptic("medium");
    setProfile(person);
    setPage("budget");
    sessionStorage.setItem("budget-open-tab", "onetime");
    close();
  };

  // Preview parsed text in real-time — text tags (P1/P2) still override if present
  const parsedPreview = quickText.trim()
    ? parseQuickLogText(quickText, selectedPerson || "p1", personNames)
    : null;
  const effectivePerson = selectedPerson || parsedPreview?.person || "p1";

  // Clamp today's day-of-month into the chosen month (e.g. logging for a shorter month)
  const dateForMonth = (ym) => {
    if (!ym || ym === localYearMonth()) return localDateISO();
    const [y, m] = ym.split("-").map(Number);
    const day = Math.min(new Date().getDate(), new Date(y, m, 0).getDate());
    return `${ym}-${String(day).padStart(2, "0")}`;
  };

  const handleQuickSubmit = (e) => {
    e?.preventDefault();
    if (!parsedPreview) return;

    haptic("success");
    const targetPerson = effectivePerson === "p2" ? "p2" : "p1";
    const existingTxns =
      (targetPerson === "p2" ? p2?.transactions : p1?.transactions) || [];
    const finalTxn = {
      id: nextId(existingTxns),
      date: dateForMonth(selectedMonth),
      desc: parsedPreview.name,
      amount: -Math.abs(parsedPreview.amount),
      type: "expense",
      category: parsedPreview.category,
    };

    if (updatePerson) {
      updatePerson(targetPerson, "transactions", [finalTxn, ...existingTxns]);
      toast.success(
        `Logged ${fmt(parsedPreview.amount)} for ${parsedPreview.name} (${parsedPreview.category}) for ${personNames?.[targetPerson] || targetPerson.toUpperCase()}!`,
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

            {/* Who + which month */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                alignItems: "flex-end",
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  For
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["p1", "p2"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setSelectedPerson((cur) => (cur === p ? null : p))
                      }
                      className={
                        "profile-pill" +
                        (effectivePerson === p ? " active" : "")
                      }
                      style={{
                        "--pill-color": p === "p1" ? "var(--p1)" : "var(--p2)",
                        "--pill-dim":
                          p === "p1" ? "var(--p1-dim)" : "var(--p2-dim)",
                        flex: 1,
                        justifyContent: "center",
                        padding: "6px 8px",
                        fontSize: 12,
                      }}
                    >
                      <span className="profile-pill-dot" />
                      {personNames?.[p] || p}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
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
                    {fmt(parsedPreview.amount)} ·{" "}
                    {personNames?.[effectivePerson] ||
                      effectivePerson.toUpperCase()}
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
                    "--pill-dim":
                      p === "p1" ? "var(--p1-dim)" : "var(--p2-dim)",
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
