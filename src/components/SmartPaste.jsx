/* ── SmartPaste — SMS-to-Expense Pipeline ─────────────────────────────────────
 *  Multi-step bottom-sheet:  Paste → Parse → Review → Commit
 *  Parses Indian bank / UPI SMS, matches to expense cards, lets user confirm.
 *
 *  Props:
 *    open         : boolean
 *    onClose      : () => void
 *    expenses     : array — current expense cards
 *    updatePerson : (key, value) => void — DataContext updater
 *    merchantMap  : object — learned merchant→cardId map
 *    onMerchantMapUpdate : (newMap) => void — persist merchant map
 *    personName   : string
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ClipboardPaste,
  Check,
  ArrowRight,
  AlertTriangle,
  Trash2,
  CreditCard,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { parseTransactionSMS, markDuplicates } from "../utils/smsParser";
import {
  matchAllTransactions,
  updateMerchantMap,
} from "../utils/merchantMatcher";
import { fmt, nextId, EXPENSE_CATEGORIES } from "../utils/finance";

// ── Styles (inline, consistent with app's dark theme vars) ──────────────────
const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 99990,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 0 0",
    width: "100%",
    maxWidth: 540,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 12px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px 20px",
  },
  footer: {
    padding: "12px 20px 16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: 12,
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: "0.88rem",
    fontFamily: "var(--font-body)",
    resize: "vertical",
    outline: "none",
  },
  btn: (variant = "primary") => ({
    padding: "8px 18px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    fontSize: "0.88rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    ...(variant === "primary"
      ? { background: "var(--gold)", color: "#000" }
      : variant === "danger"
        ? { background: "var(--red-dim)", color: "var(--red)" }
        : { background: "var(--bg-input)", color: "var(--text-secondary)" }),
  }),
  badge: (color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 99,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
  }),
  txnCard: {
    background: "var(--bg-card2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
    marginBottom: 10,
  },
  txnRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  select: {
    padding: "6px 10px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: "0.82rem",
    cursor: "pointer",
    maxWidth: 200,
  },
  input: {
    padding: "6px 10px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: "0.82rem",
    outline: "none",
    width: "100%",
  },
  muted: {
    fontSize: "0.78rem",
    color: "var(--text-muted)",
  },
  stat: {
    display: "flex",
    gap: 16,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  statItem: (color) => ({
    padding: "8px 14px",
    borderRadius: "var(--radius)",
    background: `color-mix(in srgb, ${color} 8%, var(--bg-card2))`,
    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
    fontSize: "0.82rem",
    color: "var(--text-primary)",
  }),
};

// Module-level entry ID counter for new entries
let _pasteEntrySeq = Date.now();
const genPasteEntryId = () => ++_pasteEntrySeq;

// ── Step 1: Paste ───────────────────────────────────────────────────────────
function PasteStep({ rawText, setRawText, pasteError }) {
  const [clipboardErr, setClipboardErr] = useState(false);
  const handlePaste = async () => {
    setClipboardErr(false);
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawText(text);
      else setClipboardErr(true);
    } catch {
      setClipboardErr(true);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <ClipboardPaste size={16} style={{ color: "var(--gold)" }} />
          <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
            Paste SMS messages
          </span>
        </div>
        <p style={{ ...S.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Copy transaction SMS from your messaging app and paste below. Multiple
          messages will be auto-detected and split.
        </p>
        <textarea
          style={S.textarea}
          placeholder={`e.g.\nAlert: Your A/c no. XX0000 is debited for Rs. 500.00 on 2026-04-15 by UPI Ref no 123456789012.\n\nPaid Rs. 100 to Swiggy via UPI. Ref: 123456789012. Check PhonePe app for details.`}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          autoFocus
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button style={S.btn("ghost")} onClick={handlePaste} type="button">
          <ClipboardPaste size={14} /> Paste from clipboard
        </button>
        {clipboardErr && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Clipboard not available — use Ctrl+V / long-press to paste
          </span>
        )}
      </div>
      {pasteError && (
        <p style={{ color: "var(--red)", fontSize: "0.82rem", marginTop: 8 }}>
          <AlertTriangle
            size={14}
            style={{ verticalAlign: "middle", marginRight: 4 }}
          />
          {pasteError}
        </p>
      )}
    </>
  );
}

// ── Step 2: Review ──────────────────────────────────────────────────────────
function ReviewStep({
  matched,
  expenses,
  assignments,
  setAssignments,
  dismissed,
  setDismissed,
  newCards,
  setNewCards,
}) {
  const debits = matched.reduce((acc, m, idx) => {
    if (m.txn.direction === "debit") acc.push(idx);
    return acc;
  }, []);
  const credits = matched.reduce((acc, m, idx) => {
    if (m.txn.direction === "credit") acc.push(idx);
    return acc;
  }, []);
  const duplicates = matched.reduce((acc, m, idx) => {
    if (m.txn.isDuplicate) acc.push(idx);
    return acc;
  }, []);
  const activeDebitTotal = debits
    .filter((idx) => !dismissed.has(idx))
    .reduce((s, idx) => s + matched[idx].txn.amount, 0);

  // Count how many debits still need a card assigned
  const unassignedCount = debits.filter(
    (idx) => !dismissed.has(idx) && !assignments[idx]?.targetId,
  ).length;

  const setAssignment = (idx, patch) => {
    setAssignments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const toggleDismiss = (idx) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const addNewCard = (idx) => {
    const m = matched[idx];
    const name = m.txn.merchant || "New expense";
    const cat = m.suggestedCategory;
    const cardKey = `new_${idx}`;
    setNewCards((prev) => ({
      ...prev,
      [cardKey]: {
        name,
        category: cat.category,
        subCategory: cat.sub || "",
        expenseType: "onetime",
      },
    }));
    setAssignment(idx, { targetId: cardKey, isNew: true });
  };

  // ── Bulk assign: apply a single card to all unassigned debit transactions
  const handleBulkAssign = (targetId) => {
    setAssignments((prev) => {
      const next = [...prev];
      debits.forEach((idx) => {
        if (!dismissed.has(idx) && !next[idx]?.targetId) {
          next[idx] = { targetId: Number(targetId), isNew: false };
        }
      });
      return next;
    });
  };

  // Combined list of selectable cards (existing + newly created in this session)
  const cardOptions = [
    ...expenses.filter(
      (e) => e.expenseType === "monthly" || e.expenseType === "onetime",
    ),
    ...Object.entries(newCards).map(([key, def]) => ({
      id: key,
      name: def.name,
      category: def.category,
      _isNew: true,
    })),
  ];

  return (
    <>
      {/* Stats bar */}
      <div style={S.stat}>
        <div style={S.statItem("var(--red)")}>
          <strong>{debits.length}</strong> debit{debits.length !== 1 ? "s" : ""}{" "}
          — {fmt(activeDebitTotal)}
        </div>
        {credits.length > 0 && (
          <div style={S.statItem("var(--green)")}>
            <strong>{credits.length}</strong> credit
            {credits.length !== 1 ? "s" : ""} (auto-skipped)
          </div>
        )}
        {duplicates.length > 0 && (
          <div style={S.statItem("var(--gold)")}>
            <strong>{duplicates.length}</strong> duplicate
            {duplicates.length !== 1 ? "s" : ""} (already added)
          </div>
        )}
        <div style={S.statItem("var(--text-muted)")}>
          {matched.length} total parsed
        </div>
      </div>

      {/* Bulk assign shortcut */}
      {unassignedCount > 1 && cardOptions.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            marginBottom: 12,
            background: "var(--blue-dim)",
            border:
              "1px solid color-mix(in srgb, var(--blue) 25%, transparent)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.82rem",
          }}
        >
          <ListChecks
            size={14}
            style={{ color: "var(--blue)", flexShrink: 0 }}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            Assign {unassignedCount} unassigned to:
          </span>
          <select
            style={{ ...S.select, flex: 1 }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleBulkAssign(e.target.value);
            }}
          >
            <option value="">— Pick card —</option>
            {cardOptions
              .filter((e) => !e._isNew)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.category})
                </option>
              ))}
          </select>
        </div>
      )}

      <p style={{ ...S.muted, marginBottom: 12, lineHeight: 1.5 }}>
        Review each transaction. Assign to an existing expense card or create a
        new one. Dismiss items you don&apos;t want to add.
      </p>

      {matched.map((m, idx) => {
        const isDismissed = dismissed.has(idx);
        const assignment = assignments[idx] || {};
        const isCredit = m.txn.direction === "credit";

        return (
          <div
            key={idx}
            style={{
              ...S.txnCard,
              opacity: isDismissed || isCredit ? 0.45 : 1,
              position: "relative",
            }}
          >
            {/* Row 1: Amount + merchant + direction */}
            <div style={S.txnRow}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span style={S.badge(isCredit ? "var(--green)" : "var(--red)")}>
                  {isCredit ? "↓ CR" : "↑ DR"}
                </span>
                <strong
                  style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}
                >
                  {fmt(m.txn.amount)}
                </strong>
                {m.txn.merchant && (
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.82rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.txn.merchant}
                  </span>
                )}
              </div>
              {isCredit ? (
                <span
                  style={{
                    ...S.badge("var(--text-muted)"),
                    fontSize: "0.7rem",
                  }}
                >
                  auto-skipped
                </span>
              ) : m.txn.isDuplicate ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      ...S.badge("var(--gold)"),
                      fontSize: "0.7rem",
                    }}
                  >
                    duplicate
                  </span>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: isDismissed ? "var(--green)" : "var(--text-muted)",
                      padding: 4,
                    }}
                    onClick={() => toggleDismiss(idx)}
                    title={isDismissed ? "Restore (add anyway)" : "Dismiss"}
                  >
                    {isDismissed ? <Check size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
              ) : (
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isDismissed ? "var(--green)" : "var(--text-muted)",
                    padding: 4,
                  }}
                  onClick={() => toggleDismiss(idx)}
                  title={isDismissed ? "Restore" : "Dismiss"}
                >
                  {isDismissed ? <Check size={16} /> : <Trash2 size={16} />}
                </button>
              )}
            </div>

            {/* Row 2: Date + source */}
            <div style={{ ...S.muted, marginTop: 4, display: "flex", gap: 12 }}>
              <span>{m.txn.date}</span>
              <span>{m.txn.source.name}</span>
              {m.txn.refId && <span>Ref: {m.txn.refId.slice(-6)}</span>}
            </div>

            {/* Row 3: Card assignment (only for debits, not dismissed) */}
            {!isDismissed && !isCredit && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <CreditCard size={14} style={{ color: "var(--text-muted)" }} />
                <select
                  style={S.select}
                  value={assignment.targetId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__new__") {
                      addNewCard(idx);
                    } else if (val.startsWith?.("new_")) {
                      // Selecting an already-created new card from another txn
                      setAssignment(idx, { targetId: val, isNew: true });
                    } else {
                      setAssignment(idx, {
                        targetId: val ? Number(val) : "",
                        isNew: false,
                      });
                    }
                  }}
                >
                  <option value="">— Select card —</option>
                  {expenses
                    .filter(
                      (e) =>
                        e.expenseType === "monthly" ||
                        e.expenseType === "onetime",
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.category})
                      </option>
                    ))}
                  {/* Show new cards created in this session */}
                  {Object.entries(newCards).length > 0 && (
                    <optgroup label="New (this session)">
                      {Object.entries(newCards).map(([key, def]) => (
                        <option key={key} value={key}>
                          {def.name} ({def.category}) ★
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__new__">+ Create new card</option>
                </select>

                {/* If creating new card, show inline edit */}
                {assignment.isNew && newCards[assignment.targetId] && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flex: 1,
                      minWidth: 200,
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      style={{ ...S.input, maxWidth: 150 }}
                      value={newCards[assignment.targetId].name}
                      onChange={(e) =>
                        setNewCards((prev) => ({
                          ...prev,
                          [assignment.targetId]: {
                            ...prev[assignment.targetId],
                            name: e.target.value,
                          },
                        }))
                      }
                      placeholder="Card name"
                    />
                    <select
                      style={{ ...S.select, maxWidth: 130 }}
                      value={newCards[assignment.targetId].category}
                      onChange={(e) =>
                        setNewCards((prev) => ({
                          ...prev,
                          [assignment.targetId]: {
                            ...prev[assignment.targetId],
                            category: e.target.value,
                          },
                        }))
                      }
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Match confidence indicator */}
                {m.match.score > 0 && !assignment.isNew && (
                  <span
                    style={{
                      ...S.muted,
                      fontSize: "0.72rem",
                      color:
                        m.match.score >= 60 ? "var(--green)" : "var(--gold)",
                    }}
                  >
                    {m.match.score >= 60 ? "✓ auto-matched" : "~ suggested"}
                  </span>
                )}
              </div>
            )}

            {/* Collapsed source text */}
            <details style={{ marginTop: 6 }}>
              <summary
                style={{ ...S.muted, cursor: "pointer", fontSize: "0.72rem" }}
              >
                Show original SMS
              </summary>
              <p
                style={{
                  ...S.muted,
                  marginTop: 4,
                  padding: 8,
                  background: "var(--bg-input)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                {m.txn.sourceText}
              </p>
            </details>
          </div>
        );
      })}
    </>
  );
}

// ── Step 3: Done ────────────────────────────────────────────────────────────
function DoneStep({ result }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 0" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--green-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <Check size={28} style={{ color: "var(--green)" }} />
      </div>
      <p
        style={{
          fontSize: "1.05rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {result.added} transaction{result.added !== 1 ? "s" : ""} added
      </p>
      {result.newCards > 0 && (
        <p style={S.muted}>
          {result.newCards} new expense card{result.newCards !== 1 ? "s" : ""}{" "}
          created
        </p>
      )}
      {result.skipped > 0 && (
        <p style={S.muted}>
          {result.skipped} dismissed / duplicate
          {result.skipped !== 1 ? "s" : ""}
        </p>
      )}
      {result.credits > 0 && (
        <p style={S.muted}>
          {result.credits} credit{result.credits !== 1 ? "s" : ""} noted (not
          added to expenses)
        </p>
      )}
    </div>
  );
}

// ── Main SmartPaste Component ───────────────────────────────────────────────
export default function SmartPaste({
  open,
  onClose,
  expenses,
  updatePerson,
  merchantMap = {},
  onMerchantMapUpdate,
}) {
  const [step, setStep] = useState("paste"); // paste | review | done
  const [rawText, setRawText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [matched, setMatched] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [newCards, setNewCards] = useState({});
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setStep("paste");
    setRawText("");
    setPasteError("");
    setMatched([]);
    setAssignments([]);
    setDismissed(new Set());
    setNewCards({});
    setResult(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Parse & match ─────────────────────────────────────────────────────────
  const handleParse = useCallback(() => {
    setPasteError("");
    const parsed = parseTransactionSMS(rawText);
    if (!parsed.length) {
      setPasteError(
        "No transactions found. Make sure you pasted bank/UPI SMS messages.",
      );
      return;
    }

    // Mark duplicates (show them as pre-dismissed rather than hiding)
    const tagged = markDuplicates(parsed, expenses);

    // Match to expense cards
    const results = matchAllTransactions(tagged, expenses, merchantMap);
    setMatched(results);

    // Pre-fill assignments from auto-match; pre-dismiss duplicates
    const autoDismissed = new Set();
    const autoAssignments = results.map((m, idx) => {
      if (m.txn.isDuplicate) autoDismissed.add(idx);
      if (m.match.expense && m.match.score >= 25) {
        return { targetId: m.match.expense.id, isNew: false };
      }
      return { targetId: "", isNew: false };
    });
    setAssignments(autoAssignments);
    setDismissed(autoDismissed);
    setStep("review");
  }, [rawText, expenses, merchantMap]);

  // ── Commit entries to expense cards ───────────────────────────────────────
  const handleCommit = useCallback(() => {
    let updatedExpenses = [...expenses];
    let addedCount = 0;
    let newCardCount = 0;
    let skippedCount = 0;
    let creditCount = 0;
    const merchantUpdates = [];

    // First, create any new cards (deduplicate — multiple txns may share one)
    const newCardIdMap = {}; // cardKey → actual id
    const createdKeys = new Set();
    // Collect which new cards are actually referenced
    for (const assignment of assignments) {
      if (
        assignment?.isNew &&
        assignment.targetId &&
        !createdKeys.has(assignment.targetId)
      ) {
        createdKeys.add(assignment.targetId);
      }
    }
    for (const cardKey of createdKeys) {
      const cardDef = newCards[cardKey];
      if (!cardDef) continue;
      const newId = nextId(updatedExpenses);
      updatedExpenses = [
        {
          id: newId,
          expenseType: cardDef.expenseType || "onetime",
          name: cardDef.name,
          amount: 0,
          category: cardDef.category,
          subCategory: cardDef.subCategory || "",
          date: new Date().toISOString().slice(0, 10),
          recurrence: cardDef.expenseType === "monthly" ? "monthly" : "once",
          entries: [],
        },
        ...updatedExpenses,
      ];
      newCardIdMap[cardKey] = newId;
      newCardCount++;
    }

    // Now add entries to cards
    matched.forEach((m, idx) => {
      if (dismissed.has(idx)) {
        skippedCount++;
        return;
      }
      if (m.txn.direction === "credit") {
        creditCount++;
        return;
      }

      const assignment = assignments[idx];
      if (!assignment || !assignment.targetId) {
        skippedCount++;
        return;
      }

      // Resolve actual expense ID (string "new_X" → mapped id, number → as-is)
      const targetId =
        typeof assignment.targetId === "string" &&
        assignment.targetId.startsWith("new_")
          ? newCardIdMap[assignment.targetId]
          : assignment.targetId;

      if (!targetId) {
        skippedCount++;
        return;
      }

      const entry = {
        id: genPasteEntryId(),
        date: m.txn.date,
        amount: m.txn.amount,
        note: [
          m.txn.merchant || "",
          m.txn.source.name !== "Unknown" ? `via ${m.txn.source.name}` : "",
          m.txn.refId ? `Ref:${m.txn.refId.slice(-6)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };

      updatedExpenses = updatedExpenses.map((exp) => {
        if (exp.id !== targetId) return exp;
        return { ...exp, entries: [...(exp.entries || []), entry] };
      });

      addedCount++;

      if (m.txn.merchant) {
        merchantUpdates.push({ merchant: m.txn.merchant, expenseId: targetId });
      }
    });

    updatePerson("expenses", updatedExpenses);

    if (merchantUpdates.length && onMerchantMapUpdate) {
      const newMap = updateMerchantMap(merchantMap, merchantUpdates);
      onMerchantMapUpdate(newMap);
    }

    // Toast feedback
    if (addedCount > 0) {
      toast.success(
        `${addedCount} transaction${addedCount !== 1 ? "s" : ""} added via Smart Paste`,
      );
    }

    setResult({
      added: addedCount,
      newCards: newCardCount,
      skipped: skippedCount,
      credits: creditCount,
    });
    setStep("done");
  }, [
    expenses,
    matched,
    assignments,
    dismissed,
    newCards,
    updatePerson,
    merchantMap,
    onMerchantMapUpdate,
  ]);

  if (!open) return null;

  const canCommit =
    step === "review" &&
    matched.some((m, i) => {
      if (dismissed.has(i) || m.txn.direction === "credit") return false;
      return assignments[i]?.targetId;
    });

  return createPortal(
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.title}>
            <ClipboardPaste size={18} style={{ color: "var(--gold)" }} />
            {step === "paste" && "Smart Paste"}
            {step === "review" && "Review Transactions"}
            {step === "done" && "Done!"}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {step === "paste" && (
            <PasteStep
              rawText={rawText}
              setRawText={setRawText}
              pasteError={pasteError}
            />
          )}
          {step === "review" && (
            <ReviewStep
              matched={matched}
              expenses={expenses}
              assignments={assignments}
              setAssignments={setAssignments}
              dismissed={dismissed}
              setDismissed={setDismissed}
              newCards={newCards}
              setNewCards={setNewCards}
            />
          )}
          {step === "done" && <DoneStep result={result} />}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {step === "paste" && (
            <button
              style={{
                ...S.btn("primary"),
                ...(!rawText.trim()
                  ? { opacity: 0.4, pointerEvents: "none" }
                  : {}),
              }}
              onClick={handleParse}
              type="button"
            >
              Parse Messages <ArrowRight size={14} />
            </button>
          )}
          {step === "review" && (
            <>
              <button
                style={S.btn("ghost")}
                onClick={() => setStep("paste")}
                type="button"
              >
                Back
              </button>
              <button
                style={{
                  ...S.btn("primary"),
                  opacity: canCommit ? 1 : 0.4,
                  pointerEvents: canCommit ? "auto" : "none",
                }}
                onClick={handleCommit}
                type="button"
              >
                <Check size={14} />
                Add{" "}
                {
                  matched.filter(
                    (_, i) =>
                      !dismissed.has(i) &&
                      assignments[i]?.targetId &&
                      matched[i].txn.direction === "debit",
                  ).length
                }{" "}
                entries
              </button>
            </>
          )}
          {step === "done" && (
            <>
              <button style={S.btn("ghost")} onClick={reset} type="button">
                Paste More
              </button>
              <button
                style={S.btn("primary")}
                onClick={handleClose}
                type="button"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
