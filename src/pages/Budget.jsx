import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Module-level counter for entry IDs — avoids impure Date.now() in render scope
let _entryIdSeq = 0;
const genEntryId = () => ++_entryIdSeq;
import {
  fmt,
  nextId,
  onetimeEffective,
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES,
  EXPENSE_TYPES,
  TRIP_CATEGORIES,
  INCOME_TYPES,
} from "../utils/finance";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Check,
  MapPin,
  Plane,
  CreditCard,
  Repeat,
  ArrowRightLeft,
  Users,
  Info,
  Edit3,
  ClipboardPaste,
} from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { InfoModal } from "../components/InfoModal";
import EmptyState from "../components/EmptyState";
import SmartPaste from "../components/SmartPaste";
import { useData } from "../context/DataContext";

// ── Mobile-friendly input modal ──────────────────────────────────────────────
// On small screens, inputs get cropped. Tapping opens a full-width bottom sheet
// to edit the value comfortably. On desktop this is a no-op (children render inline).
function useMobileCheck() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 480,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function MobileEditModal({ label, value, onChange, type = "text", onClose }) {
  const [local, setLocal] = useState(String(value ?? ""));
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 99999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a24",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 28px",
          width: "100%",
          maxWidth: 420,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {label}
        </div>
        <input
          autoFocus
          type={type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          style={{
            width: "100%",
            fontSize: 16,
            padding: "12px 14px",
            marginBottom: 14,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(type === "number" ? Number(local) : local);
              onClose();
            }
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              onChange(type === "number" ? Number(local) : local);
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Wrapper: on mobile, tapping opens the modal; on desktop, renders an inline input.
function MobileInput({
  value,
  onChange,
  type = "text",
  label = "Edit",
  style = {},
  ...rest
}) {
  const isMobile = useMobileCheck();
  const [editing, setEditing] = useState(false);

  if (isMobile) {
    return (
      <>
        <div
          onClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            fontSize: 13,
            color: value ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            ...style,
          }}
          aria-label={label}
        >
          {value || rest.placeholder || label}
        </div>
        {editing && (
          <MobileEditModal
            label={label}
            value={value}
            onChange={onChange}
            type={type}
            onClose={() => setEditing(false)}
          />
        )}
      </>
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(type === "number" ? Number(e.target.value) : e.target.value)
      }
      style={style}
      {...rest}
    />
  );
}

// ─── Budget rule engine ──────────────────────────────────────────────────────
// Helper: compute total from trip items
const tripTotal = (trip) =>
  (trip.items || []).reduce((s, i) => s + (i.amount || 0), 0);

// Helper: aggregate ALL expenses by category (works across monthly, trip items, onetime)
const buildExpByCategory = (expenses) =>
  expenses.reduce((acc, e) => {
    if (e.expenseType === "trip") {
      // Each trip item has its own category
      for (const item of e.items || []) {
        const cat = item.category || "Others";
        acc[cat] = (acc[cat] || 0) + (item.amount || 0);
      }
    } else {
      const amt =
        e.expenseType === "onetime" ? onetimeEffective(e) : e.amount || 0;
      acc[e.category] = (acc[e.category] || 0) + amt;
    }
    return acc;
  }, {});

// Helper: build grouped view { cat: { total, subs: { sub: amount } } }
const buildExpGrouped = (expenses) =>
  expenses.reduce((acc, e) => {
    if (e.expenseType === "trip") {
      for (const item of e.items || []) {
        const cat = item.category || "Others";
        if (!acc[cat]) acc[cat] = { total: 0, subs: {} };
        acc[cat].total += item.amount || 0;
        // Use trip name as the "sub" for grouping
        const sub = e.name || "";
        acc[cat].subs[sub] = (acc[cat].subs[sub] || 0) + (item.amount || 0);
      }
    } else {
      const cat = e.category;
      if (!acc[cat]) acc[cat] = { total: 0, subs: {} };
      const amt =
        e.expenseType === "onetime" ? onetimeEffective(e) : e.amount || 0;
      acc[cat].total += amt;
      const sub = e.subCategory || "";
      acc[cat].subs[sub] = (acc[cat].subs[sub] || 0) + amt;
    }
    return acc;
  }, {});

const BUDGET_RULES = {
  "50/30/20": {
    label: "50 / 30 / 20",
    blurb:
      "Split take-home into three buckets: ≤50% on Needs (essentials), ≤30% on Wants (lifestyle), and keep 20%+ as savings or investments. The most popular framework for most income levels.",
    buckets: [
      {
        key: "needs",
        emoji: "🏠",
        label: "Needs",
        targetPct: 50,
        color: "var(--blue)",
        desc: "Essentials you can't skip — housing, food, transport, bills, healthcare",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
        ],
      },
      {
        key: "wants",
        emoji: "🎉",
        label: "Wants",
        targetPct: 30,
        color: "var(--purple)",
        desc: "Lifestyle choices you can adjust — dining out, shopping, entertainment",
        cats: ["Entertainment", "Shopping", "Personal Care", "Others"],
      },
      {
        key: "savings",
        emoji: "💰",
        label: "Savings & Invest",
        targetPct: 20,
        color: "var(--green)",
        desc: "Money kept — SIPs, emergency fund, loan prepayment",
        virtual: true,
      },
    ],
  },
  "70/20/10": {
    label: "70 / 20 / 10",
    blurb:
      "More relaxed: 70% covers all living costs (needs + wants together), 20% goes into savings and EMI payoff, 10% toward big goals or giving. Easier to stick to than 50/30/20.",
    buckets: [
      {
        key: "living",
        emoji: "🏡",
        label: "Living",
        targetPct: 70,
        color: "var(--blue)",
        desc: "All day-to-day spending — needs and lifestyle combined",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
          "Entertainment",
          "Shopping",
          "Personal Care",
          "Others",
        ],
      },
      {
        key: "savings",
        emoji: "🏦",
        label: "Savings",
        targetPct: 20,
        color: "var(--green)",
        desc: "Investments, emergency corpus, debt snowball",
        virtual: true,
      },
      {
        key: "goals",
        emoji: "🎯",
        label: "Goals & Giving",
        targetPct: 10,
        color: "var(--gold)",
        desc: "Long-term goals, big purchases, charity donations",
        virtual: "goals",
      },
    ],
  },
  payFirst: {
    label: "Pay Yourself First",
    blurb:
      "Lock away savings automatically before spending begins. The remaining 80% is fully yours — no category tracking needed. Best for people who find budgeting stressful.",
    buckets: [
      {
        key: "savings",
        emoji: "💰",
        label: "Save First",
        targetPct: 20,
        color: "var(--green)",
        desc: "Auto-debited at salary credit — SIPs, RDs, emergency fund",
        virtual: true,
      },
      {
        key: "spending",
        emoji: "🛍️",
        label: "Spend Freely",
        targetPct: 80,
        color: "var(--purple)",
        desc: "All remaining money — no guilt, no micro-managing",
        cats: [
          "Housing",
          "Food",
          "Utilities",
          "Transport",
          "Healthcare",
          "Insurance",
          "Education",
          "Entertainment",
          "Shopping",
          "Personal Care",
          "Others",
        ],
      },
    ],
  },
};

function BudgetRuleSection({
  rule,
  setRule,
  income,
  expByCategory,
  savingsAmt,
}) {
  const def = BUDGET_RULES[rule];
  return (
    <div className="card section-gap">
      {/* Rule picker */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Budget Rule
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {def.blurb}
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}
        >
          {Object.entries(BUDGET_RULES).map(([key, d]) => (
            <button
              key={key}
              onClick={() => setRule(key)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                borderRadius: 6,
                border:
                  key === rule
                    ? "1px solid var(--gold-border)"
                    : "1px solid var(--border)",
                background: key === rule ? "var(--gold-dim)" : "transparent",
                color: key === rule ? "var(--gold)" : "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Buckets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {def.buckets.map((bucket) => {
          const actual =
            bucket.virtual === true
              ? savingsAmt
              : bucket.virtual === "goals"
                ? null
                : (bucket.cats || []).reduce(
                    (s, c) => s + (expByCategory[c] || 0),
                    0,
                  );
          const target = income > 0 ? income * (bucket.targetPct / 100) : 0;
          const actualPct =
            income > 0 && actual !== null
              ? Math.round((actual / income) * 100)
              : 0;
          const isSavings = !!bucket.virtual;
          const isGood = isSavings ? actual >= target : actual <= target;
          const nearLimit =
            !isSavings && actual !== null
              ? actual > target * 0.9 && actual <= target
              : false;
          const diff =
            actual !== null
              ? isSavings
                ? actual - target
                : target - actual
              : null;
          const statusColor =
            bucket.virtual === "goals"
              ? "var(--gold)"
              : isGood
                ? "var(--green)"
                : nearLimit
                  ? "var(--gold)"
                  : "var(--red)";

          return (
            <div
              key={bucket.key}
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                borderLeft: `3px solid ${bucket.color}`,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1.2 }}>
                  {bucket.emoji}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {bucket.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-muted)",
                      }}
                    >
                      target {bucket.targetPct}% of income
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {bucket.desc}
                  </div>
                </div>
              </div>

              {bucket.virtual === "goals" ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  Track contributions in Goals &amp; Investments.{" "}
                  <span style={{ color: "var(--gold)", fontStyle: "normal" }}>
                    Budget: {fmt(target)}/mo
                  </span>
                </div>
              ) : (
                <>
                  {/* Numbers row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1.5rem",
                      marginBottom: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 2,
                        }}
                      >
                        {isSavings ? "Saved" : "Spent"}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: statusColor,
                          lineHeight: 1.1,
                        }}
                      >
                        {fmt(actual)}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            marginLeft: 5,
                            color: statusColor,
                          }}
                        >
                          {actualPct}% of income
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 2,
                        }}
                      >
                        Target budget
                      </div>
                      <div style={{ fontSize: 15 }}>
                        {fmt(target)}
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginLeft: 5,
                          }}
                        >
                          ({bucket.targetPct}%)
                        </span>
                      </div>
                    </div>
                    {diff !== null && income > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginBottom: 2,
                          }}
                        >
                          {isSavings
                            ? diff >= 0
                              ? "✓ Ahead by"
                              : "⚠ Short by"
                            : diff >= 0
                              ? "✓ Headroom"
                              : "⚠ Over by"}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: statusColor,
                          }}
                        >
                          {diff >= 0 ? "+" : "−"}
                          {fmt(Math.abs(diff))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar — bar = 0..income, fill = actual, tick = target */}
                  {income > 0 && (
                    <div style={{ marginBottom: bucket.cats ? 10 : 0 }}>
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.07)",
                          overflow: "visible",
                        }}
                      >
                        <div
                          style={{
                            width: Math.min(100, actualPct) + "%",
                            height: "100%",
                            background: statusColor,
                            borderRadius: 4,
                            transition: "width 0.4s",
                          }}
                        />
                        {/* White tick at target% */}
                        <div
                          style={{
                            position: "absolute",
                            top: -3,
                            left: bucket.targetPct + "%",
                            transform: "translateX(-50%)",
                            width: 2,
                            height: 14,
                            background: "rgba(255,255,255,0.45)",
                            borderRadius: 1,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 3,
                        }}
                      >
                        <span>0%</span>
                        <span
                          style={{
                            position: "relative",
                            left: `calc(${bucket.targetPct}% - 50%)`,
                          }}
                        >
                          ↑ {bucket.targetPct}% limit
                        </span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {/* Category pills */}
                  {bucket.cats && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginTop: 6,
                      }}
                    >
                      {bucket.cats.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background:
                              (expByCategory[c] || 0) > 0
                                ? "rgba(255,255,255,0.09)"
                                : "rgba(255,255,255,0.02)",
                            color:
                              (expByCategory[c] || 0) > 0
                                ? "var(--text-secondary)"
                                : "var(--text-muted)",
                          }}
                        >
                          {c}
                          {(expByCategory[c] || 0) > 0 && (
                            <span
                              style={{
                                marginLeft: 4,
                                color: "var(--text-muted)",
                              }}
                            >
                              {fmt(expByCategory[c])}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Budget({
  data,
  personName,
  personColor,
  updatePerson,
  shared,
  updateShared,
}) {
  const incomes = data?.incomes || [];
  const expenses = data?.expenses || [];
  const [tab, setTab] = useState(() => {
    const signal = sessionStorage.getItem("budget-open-tab");
    return signal ? "expenses" : "overview";
  });
  const [rule, setRule] = useState("50/30/20");
  const { confirm, dialog } = useConfirm();
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);

  // ── Month selector for expense tabs ────────────────────────────────────
  const _now = new Date();
  const _curYm = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
  const [expMonth, setExpMonth] = useState(_curYm);
  const expMonthDate = new Date(expMonth + "-01");
  const expMonthLabel = expMonthDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const expPrevMonth = () => {
    const d = new Date(expMonthDate);
    d.setMonth(d.getMonth() - 1);
    setExpMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const expNextMonth = () => {
    const d = new Date(expMonthDate);
    d.setMonth(d.getMonth() + 1);
    setExpMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  // ── Expense sub-tab (monthly | trips | onetime) ───────────────────────
  const [expTab, setExpTab] = useState(() => {
    const signal = sessionStorage.getItem("budget-open-tab");
    if (signal) {
      sessionStorage.removeItem("budget-open-tab");
      return signal;
    }
    return "onetime";
  });
  const [moveMenuOpen, setMoveMenuOpen] = useState(null); // expId or null
  const [moveToTripPicker, setMoveToTripPicker] = useState(null); // expId when showing trip sub-menu

  // Partition expenses by type (backfill old data as "monthly")
  const monthlyExps = expenses.filter(
    (e) => !e.expenseType || e.expenseType === "monthly",
  );
  const tripExps = expenses.filter((e) => e.expenseType === "trip");
  const onetimeExps = expenses.filter((e) => e.expenseType === "onetime");

  // Month-filtered versions for display
  const filteredOnetimeExps = onetimeExps.filter(
    (e) => (e.date || "").slice(0, 7) === expMonth,
  );
  const filteredTripExps = tripExps.filter(
    (e) => (e.startDate || e.date || "").slice(0, 7) === expMonth,
  );
  const _expMonthNum = parseInt(expMonth.split("-")[1], 10) - 1;
  const filteredMonthlyExps = monthlyExps.filter((e) => {
    if (e.recurrence === "yearly" && (e.recurrenceMonth ?? 0) !== _expMonthNum)
      return false;
    if (e.recurrence === "quarterly") {
      const months = e.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(_expMonthNum)) return false;
    }
    return true;
  });

  // Shared trips (visible to both persons)
  const sharedTrips = shared?.trips || [];
  const filteredSharedTrips = sharedTrips.filter(
    (t) => (t.startDate || "").slice(0, 7) === expMonth,
  );
  // Combined trip list for display (tagged with _isShared for rendering) — filtered by month
  const allTrips = [
    ...filteredTripExps.map((t) => ({ ...t, _isShared: false })),
    ...filteredSharedTrips.map((t) => ({ ...t, _isShared: true })),
  ];

  // ── Trip management ────────────────────────────────────────────────────
  const [expandedTrips, setExpandedTrips] = useState({});
  const [tripItemForm, setTripItemForm] = useState({}); // tripId → { name, amount, category }
  const [tripCatOpen, setTripCatOpen] = useState({}); // tripKey → Set of open categories
  const toggleTrip = (id) => setExpandedTrips((s) => ({ ...s, [id]: !s[id] }));
  const getTripIF = (id) =>
    tripItemForm[id] || { name: "", amount: "", category: "Food" };
  const setTIF = (id, patch) =>
    setTripItemForm((s) => ({
      ...s,
      [id]: { ...getTripIF(id), ...patch },
    }));
  const addTripItem = (trip, isShared = false) => {
    const key = isShared ? `shared_${trip.id}` : `${trip.id}`;
    const f = getTripIF(key);
    if (!f.name || !f.amount) return;
    const item = {
      id: genEntryId(),
      name: f.name.trim(),
      amount: Number(f.amount),
      category: f.category || "Others",
      addedBy: personName,
    };
    const newItems = [...(trip.items || []), item];
    const newAmount = newItems.reduce((s, i) => s + i.amount, 0);
    if (isShared) {
      updateShared(
        "trips",
        sharedTrips.map((x) =>
          x.id === trip.id ? { ...x, items: newItems, amount: newAmount } : x,
        ),
      );
    } else {
      updatePerson(
        "expenses",
        expenses.map((x) =>
          x.id === trip.id ? { ...x, items: newItems, amount: newAmount } : x,
        ),
      );
    }
    setTripItemForm((s) => ({
      ...s,
      [key]: { name: "", amount: "", category: "Food" },
    }));
  };
  const deleteTripItem = (trip, itemId, isShared = false) => {
    const newItems = (trip.items || []).filter((i) => i.id !== itemId);
    const newAmount = newItems.reduce((s, i) => s + i.amount, 0);
    if (isShared) {
      updateShared(
        "trips",
        sharedTrips.map((x) =>
          x.id === trip.id ? { ...x, items: newItems, amount: newAmount } : x,
        ),
      );
    } else {
      updatePerson(
        "expenses",
        expenses.map((x) =>
          x.id === trip.id ? { ...x, items: newItems, amount: newAmount } : x,
        ),
      );
    }
  };
  // per-income-id expanded state + pending salary-change form
  const [expandedHistory, setExpandedHistory] = useState({});
  const [salaryForm, setSalaryForm] = useState({}); // id → { newAmount, note, date }
  // expense entries (dated purchase log)
  const [expandedExp, setExpandedExp] = useState({});
  const [entryForm, setEntryForm] = useState({}); // expId → { date, amount, note }
  const [addingSubCat, setAddingSubCat] = useState(null); // { expId, category } | null
  const [newSubCatText, setNewSubCatText] = useState("");
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const toggleExpandExp = (id) =>
    setExpandedExp((s) => ({ ...s, [id]: !s[id] }));
  const getEntryForm = (id) =>
    entryForm[id] || { date: todayStr(), amount: "", note: "" };
  const setEF = (id, patch) =>
    setEntryForm((s) => ({ ...s, [id]: { ...getEntryForm(id), ...patch } }));
  const addEntry = (exp) => {
    const f = getEntryForm(exp.id);
    if (!f.date || !f.amount) return;
    const entry = {
      id: genEntryId(),
      date: f.date,
      amount: Number(f.amount),
      note: f.note.trim(),
    };
    const newEntries = [...(exp.entries || []), entry];
    const patch = { entries: newEntries };
    updatePerson(
      "expenses",
      expenses.map((x) => (x.id === exp.id ? { ...x, ...patch } : x)),
    );
    setEntryForm((s) => ({
      ...s,
      [exp.id]: { date: todayStr(), amount: "", note: "" },
    }));
  };
  const deleteEntry = (exp, entryId) => {
    const newEntries = (exp.entries || []).filter((e) => e.id !== entryId);
    const patch = { entries: newEntries };
    updatePerson(
      "expenses",
      expenses.map((x) => (x.id === exp.id ? { ...x, ...patch } : x)),
    );
  };
  // editEntry state: key = `${expId}_${entryId}` → { date, amount, note }
  const [editEntry, setEditEntry] = useState({});
  const startEditEntry = (exp, e) =>
    setEditEntry((s) => ({
      ...s,
      [`${exp.id}_${e.id}`]: {
        date: e.date,
        amount: String(e.amount),
        note: e.note || "",
      },
    }));
  const cancelEditEntry = (exp, e) =>
    setEditEntry((s) => {
      const n = { ...s };
      delete n[`${exp.id}_${e.id}`];
      return n;
    });
  const saveEditEntry = (exp, entryId) => {
    const key = `${exp.id}_${entryId}`;
    const f = editEntry[key];
    if (!f || !f.date || !f.amount) return;
    updatePerson(
      "expenses",
      expenses.map((x) =>
        x.id === exp.id
          ? {
              ...x,
              entries: (x.entries || []).map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      date: f.date,
                      amount: Number(f.amount),
                      note: f.note.trim(),
                    }
                  : e,
              ),
            }
          : x,
      ),
    );
    cancelEditEntry(exp, { id: entryId });
  };

  // ── Custom subcategory helpers ──────────────────────────────────────────
  const customSubCategories = shared?.customSubCategories || {};
  const getSubcats = (category) => [
    ...(EXPENSE_SUBCATEGORIES[category] || []),
    ...(customSubCategories[category] || []),
  ];
  const saveCustomSubCat = (category, rawValue, expId) => {
    const val = rawValue.trim();
    setAddingSubCat(null);
    setNewSubCatText("");
    if (!val) return;
    const existing = customSubCategories[category] || [];
    if (!existing.includes(val)) {
      updateShared("customSubCategories", {
        ...customSubCategories,
        [category]: [...existing, val],
      });
    }
    updatePerson(
      "expenses",
      expenses.map((x) => (x.id === expId ? { ...x, subCategory: val } : x)),
    );
  };

  // ── Variable income entries (bonus, freelance, dividend, etc.) ─────────
  const [expandedInc, setExpandedInc] = useState({});
  const [incEntryForm, setIncEntryForm] = useState({}); // incId → { date, amount, note, type }
  const toggleExpandInc = (id) =>
    setExpandedInc((s) => ({ ...s, [id]: !s[id] }));
  const getIncEF = (id) =>
    incEntryForm[id] || {
      date: todayStr(),
      amount: "",
      note: "",
      type: "bonus",
    };
  const setIEF = (id, patch) =>
    setIncEntryForm((s) => ({ ...s, [id]: { ...getIncEF(id), ...patch } }));
  const addIncEntry = (inc) => {
    const f = getIncEF(inc.id);
    if (!f.date || !f.amount) return;
    const entry = {
      id: genEntryId(),
      date: f.date,
      amount: Number(f.amount),
      note: f.note.trim(),
      type: f.type,
    };
    updatePerson(
      "incomes",
      incomes.map((x) =>
        x.id === inc.id
          ? { ...x, incomeEntries: [...(x.incomeEntries || []), entry] }
          : x,
      ),
    );
    setIncEntryForm((s) => ({
      ...s,
      [inc.id]: { date: todayStr(), amount: "", note: "", type: "bonus" },
    }));
  };
  const deleteIncEntry = (inc, entryId) => {
    updatePerson(
      "incomes",
      incomes.map((x) =>
        x.id === inc.id
          ? {
              ...x,
              incomeEntries: (x.incomeEntries || []).filter(
                (e) => e.id !== entryId,
              ),
            }
          : x,
      ),
    );
  };

  const INC_ENTRY_TYPES = [
    "bonus",
    "freelance",
    "dividend",
    "refund",
    "gift",
    "other",
  ];

  const toggleHistory = (id) =>
    setExpandedHistory((s) => ({ ...s, [id]: !s[id] }));

  const openSalaryChange = (inc) =>
    setSalaryForm((s) => ({
      ...s,
      [inc.id]: {
        newAmount: String(inc.amount),
        note: "",
        date: new Date().toISOString().slice(0, 10),
      },
    }));

  const cancelSalaryChange = (id) =>
    setSalaryForm((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

  const commitSalaryChange = (inc) => {
    const f = salaryForm[inc.id];
    if (!f || !f.newAmount) return;
    const newAmt = Number(f.newAmount);
    if (newAmt === inc.amount) {
      cancelSalaryChange(inc.id);
      return;
    }
    const prevHistory = inc.salaryHistory || [];
    const updatedInc = {
      ...inc,
      amount: newAmt,
      salaryHistory: [
        ...prevHistory,
        {
          date: f.date || new Date().toISOString().slice(0, 10),
          from: inc.amount,
          to: newAmt,
          note: f.note.trim(),
        },
      ],
    };
    updatePerson(
      "incomes",
      incomes.map((x) => (x.id === inc.id ? updatedInc : x)),
    );
    cancelSalaryChange(inc.id);
  };

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);

  // ── Month-filtered expense totals for overview ─────────────────────────
  const _isMonthlyActiveForOverview = (e) => {
    if (e.recurrence === "yearly" && (e.recurrenceMonth ?? 0) !== _expMonthNum)
      return false;
    if (e.recurrence === "quarterly") {
      const months = e.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(_expMonthNum)) return false;
    }
    return true;
  };
  const monthFilteredExpenses = expenses.filter((x) => {
    if (x.expenseType === "onetime")
      return (x.date || "").slice(0, 7) === expMonth;
    if (x.expenseType === "trip")
      return (x.startDate || x.date || "").slice(0, 7) === expMonth;
    // monthly: apply recurrence gating
    return _isMonthlyActiveForOverview(x);
  });
  const monthFilteredSharedTrips = sharedTrips.filter(
    (t) => (t.startDate || "").slice(0, 7) === expMonth,
  );
  const sharedTripTotal = monthFilteredSharedTrips.reduce(
    (s, x) => s + (x.amount || 0),
    0,
  );
  const totalExpenses =
    monthFilteredExpenses.reduce(
      (s, x) =>
        s + (x.expenseType === "onetime" ? onetimeEffective(x) : x.amount),
      0,
    ) + sharedTripTotal;
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  // Include shared trips in category aggregations (month-filtered)
  const allExpensesForCategories = [
    ...monthFilteredExpenses,
    ...monthFilteredSharedTrips.map((t) => ({ ...t, expenseType: "trip" })),
  ];
  const expByCategory = buildExpByCategory(allExpensesForCategories);

  // Grouped: { Food: { total, subs: { Groceries: X, "Dining Out": Y, "": Z } } }
  const expGrouped = buildExpGrouped(allExpensesForCategories);

  const addIncome = () =>
    updatePerson("incomes", [
      ...incomes,
      { id: nextId(incomes), name: "New income", amount: 0, type: "salary" },
    ]);

  // ── Typed expense creators ─────────────────────────────────────────────
  const addMonthlyExpense = () =>
    updatePerson("expenses", [
      {
        id: nextId(expenses),
        expenseType: "monthly",
        name: "New expense",
        amount: 0,
        category: "Others",
        entries: [],
        date: new Date().toISOString().slice(0, 10),
        recurrence: "monthly",
      },
      ...expenses,
    ]);
  const addTrip = () => {
    const newId = nextId(expenses);
    updatePerson("expenses", [
      {
        id: newId,
        expenseType: "trip",
        name: "New trip",
        amount: 0,
        category: "Others",
        startDate:
          expMonth === _curYm
            ? new Date().toISOString().slice(0, 10)
            : `${expMonth}-01`,
        endDate: "",
        budget: 0,
        items: [],
      },
      ...expenses,
    ]);
    setExpandedTrips((s) => ({ ...s, [newId]: true }));
  };
  const addSharedTrip = () => {
    const newId = nextId(sharedTrips);
    updateShared("trips", [
      {
        id: newId,
        name: "New shared trip",
        amount: 0,
        category: "Others",
        startDate:
          expMonth === _curYm
            ? new Date().toISOString().slice(0, 10)
            : `${expMonth}-01`,
        endDate: "",
        budget: 0,
        items: [],
      },
      ...sharedTrips,
    ]);
    setExpandedTrips((s) => ({ ...s, [`shared_${newId}`]: true }));
  };
  const convertToShared = (trip) => {
    const { _isShared, expenseType: _ET, recurrence: _R, ...tripData } = trip;
    const newId = nextId(sharedTrips);
    updateShared("trips", [...sharedTrips, { ...tripData, id: newId }]);
    updatePerson(
      "expenses",
      expenses.filter((x) => x.id !== trip.id),
    );
    setExpandedTrips((s) => ({ ...s, [`shared_${newId}`]: true }));
  };
  const convertToPersonal = (trip) => {
    const { _isShared, ...tripData } = trip;
    const newId = nextId(expenses);
    updatePerson("expenses", [
      ...expenses,
      { ...tripData, id: newId, expenseType: "trip" },
    ]);
    updateShared(
      "trips",
      sharedTrips.filter((x) => x.id !== trip.id),
    );
    setExpandedTrips((s) => ({ ...s, [newId]: true }));
  };
  const addOnetimeExpense = () => {
    const newId = nextId(expenses);
    updatePerson("expenses", [
      {
        id: newId,
        expenseType: "onetime",
        name: "New purchase",
        amount: 0,
        category: "Others",
        date:
          expMonth === _curYm
            ? new Date().toISOString().slice(0, 10)
            : `${expMonth}-01`,
        recurrence: "once",
      },
      ...expenses,
    ]);
    setExpandedExp((s) => ({ ...s, [newId]: true }));
  };

  // ── Move expense between types ─────────────────────────────────────────
  const buildItemsFromExpense = (exp) => {
    const items = [];
    if (exp.entries && exp.entries.length > 0) {
      for (const entry of exp.entries) {
        items.push({
          id: entry.id || genEntryId(),
          name: entry.note || exp.name,
          amount: entry.amount,
          category: exp.category || "Others",
        });
      }
    } else if (exp.amount > 0) {
      items.push({
        id: genEntryId(),
        name: exp.name,
        amount: exp.amount,
        category: exp.category || "Others",
      });
    }
    return items;
  };

  // Move expense into an EXISTING trip (merge as line items)
  const moveExpenseToTrip = (expId, tripId, isSharedTrip = false) => {
    const exp = expenses.find((e) => e.id === expId);
    if (!exp) return;
    const newItems = buildItemsFromExpense(exp).map((item) => ({
      ...item,
      addedBy: personName,
    }));
    if (isSharedTrip) {
      // Merge into shared trip
      updateShared(
        "trips",
        sharedTrips.map((x) => {
          if (x.id !== tripId) return x;
          const merged = [...(x.items || []), ...newItems];
          return {
            ...x,
            items: merged,
            amount: merged.reduce((s, i) => s + i.amount, 0),
          };
        }),
      );
    } else {
      // Merge into personal trip
      updatePerson(
        "expenses",
        expenses
          .filter((x) => x.id !== expId)
          .map((x) => {
            if (x.id !== tripId) return x;
            const merged = [...(x.items || []), ...newItems];
            return {
              ...x,
              items: merged,
              amount: merged.reduce((s, i) => s + i.amount, 0),
            };
          }),
      );
    }
    // Also remove the source expense (for shared trip target, remove separately)
    if (isSharedTrip) {
      updatePerson(
        "expenses",
        expenses.filter((x) => x.id !== expId),
      );
    }
    setExpandedTrips((s) => ({
      ...s,
      [isSharedTrip ? `shared_${tripId}` : tripId]: true,
    }));
    setExpTab("trip");
  };

  // Move expense to a different type (creates new entity)
  const moveExpenseTo = (expId, targetType) => {
    if (!targetType) return;
    const exp = expenses.find((e) => e.id === expId);
    if (!exp || (exp.expenseType || "monthly") === targetType) return;
    const src = exp.expenseType || "monthly";
    let moved;

    if (targetType === "trip") {
      const items = buildItemsFromExpense(exp);
      moved = {
        id: exp.id,
        expenseType: "trip",
        name: exp.name,
        amount: items.reduce((s, i) => s + i.amount, 0),
        category: exp.category || "Others",
        startDate: exp.date || new Date().toISOString().slice(0, 10),
        endDate: "",
        budget: 0,
        items,
      };
      setExpandedTrips((s) => ({ ...s, [exp.id]: true }));
    } else if (targetType === "monthly") {
      moved = {
        id: exp.id,
        expenseType: "monthly",
        name: exp.name,
        amount: exp.amount,
        category: exp.category || "Others",
        recurrence: "monthly",
        entries: exp.entries || [],
        date:
          (src === "trip" ? exp.startDate : exp.date) ||
          new Date().toISOString().slice(0, 10),
      };
    } else if (targetType === "onetime") {
      const movedDate =
        (src === "trip" ? exp.startDate : exp.date) ||
        new Date().toISOString().slice(0, 10);
      moved = {
        id: exp.id,
        expenseType: "onetime",
        name: exp.name,
        amount: exp.amount,
        category: exp.category || "Others",
        recurrence: "once",
        entries: exp.entries || [],
        date: movedDate,
      };
    }

    if (moved) {
      updatePerson(
        "expenses",
        expenses.map((x) => (x.id === expId ? moved : x)),
      );
      setExpTab(targetType);
      // Navigate to the month the expense belongs to
      const movedYm = (moved.startDate || moved.date || "").slice(0, 7);
      if (movedYm && (targetType === "onetime" || targetType === "trip")) {
        setExpMonth(movedYm);
      }
    }
  };

  // Floating context-menu button for moving expenses between types
  const _menuItemStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    padding: "7px 12px",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 4,
    whiteSpace: "nowrap",
  };
  const MoveButton = ({ expId, currentType }) => {
    const isOpen = moveMenuOpen === expId;
    const showTripPicker = moveToTripPicker === expId;
    const targets = ["monthly", "trip", "onetime"].filter(
      (t) => t !== currentType,
    );
    const close = () => {
      setMoveMenuOpen(null);
      setMoveToTripPicker(null);
    };
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) close();
            else {
              setMoveMenuOpen(expId);
              setMoveToTripPicker(null);
            }
          }}
          title="Move to…"
          style={{
            background: isOpen ? "rgba(255,255,255,0.1)" : "none",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            borderRadius: 6,
            padding: "4px 6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <ArrowRightLeft size={12} />
        </button>
        {isOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 4,
              zIndex: 50,
              minWidth: 180,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {!showTripPicker ? (
              targets.map((t) => {
                const hasAnyTrips =
                  tripExps.length > 0 || sharedTrips.length > 0;
                // If target is "trip" and existing trips exist, show sub-menu
                if (t === "trip" && hasAnyTrips) {
                  return (
                    <button
                      key={t}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveToTripPicker(expId);
                      }}
                      style={_menuItemStyle}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.07)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "none")
                      }
                    >
                      {EXPENSE_TYPES[t].emoji} Move to Trip ▸
                    </button>
                  );
                }
                return (
                  <button
                    key={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveExpenseTo(expId, t);
                      close();
                    }}
                    style={_menuItemStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.07)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    {EXPENSE_TYPES[t].emoji} Move to {EXPENSE_TYPES[t].label}
                  </button>
                );
              })
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoveToTripPicker(null);
                  }}
                  style={{
                    ..._menuItemStyle,
                    fontSize: 10,
                    color: "var(--text-muted)",
                    padding: "5px 12px",
                  }}
                >
                  ◂ Back
                </button>
                {tripExps.length > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      padding: "4px 12px 2px",
                      fontWeight: 600,
                    }}
                  >
                    My Trips
                  </div>
                )}
                {tripExps.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveExpenseToTrip(expId, trip.id, false);
                      close();
                    }}
                    style={_menuItemStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.07)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    ✈️ {trip.name}
                    <span
                      style={{
                        marginLeft: 6,
                        opacity: 0.5,
                        fontSize: 10,
                      }}
                    >
                      {(trip.items || []).length} items
                    </span>
                  </button>
                ))}
                {sharedTrips.length > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      padding: "6px 12px 2px",
                      fontWeight: 600,
                      borderTop:
                        tripExps.length > 0
                          ? "1px solid var(--border)"
                          : "none",
                      marginTop: tripExps.length > 0 ? 2 : 0,
                    }}
                  >
                    🤝 Shared Trips
                  </div>
                )}
                {sharedTrips.map((trip) => (
                  <button
                    key={`s_${trip.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveExpenseToTrip(expId, trip.id, true);
                      close();
                    }}
                    style={_menuItemStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.07)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    🤝 {trip.name}
                    <span
                      style={{
                        marginLeft: 6,
                        opacity: 0.5,
                        fontSize: 10,
                      }}
                    >
                      {(trip.items || []).length} items
                    </span>
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveExpenseTo(expId, "trip");
                    close();
                  }}
                  style={{
                    ..._menuItemStyle,
                    borderTop: "1px solid var(--border)",
                    marginTop: 2,
                    paddingTop: 8,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.07)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  ➕ Create new trip
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabs = ["overview", "income", "expenses"];

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Budget
      </div>

      <div className="dash-tabs" role="tablist" aria-label="Budget sections">
        {tabs.map((t) => (
          <button
            key={t}
            className={`dash-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            style={{ textTransform: "capitalize" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          {/* Month selector for overview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: "1rem",
              padding: "8px 0",
            }}
          >
            <button
              onClick={expPrevMonth}
              style={{
                background: "var(--bg-card2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                minWidth: 140,
                textAlign: "center",
              }}
            >
              {expMonthLabel}
            </div>
            <button
              onClick={expNextMonth}
              style={{
                background: "var(--bg-card2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            {expMonth !== _curYm && (
              <button
                onClick={() => setExpMonth(_curYm)}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                Today
              </button>
            )}
          </div>
          <div className="grid-3 section-gap">
            <div className="metric-card">
              <div className="metric-label">
                Income
                <InfoModal title="Income breakdown">
                  {incomes.map((inc) => (
                    <div
                      key={inc.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span>{inc.name}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(inc.amount)}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.12)",
                      marginTop: 6,
                      paddingTop: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      color: "var(--green)",
                    }}
                  >
                    <span>Total</span>
                    <span>{fmt(totalIncome)}</span>
                  </div>
                </InfoModal>
              </div>
              <div className="metric-value green-text">{fmt(totalIncome)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">
                Expenses
                <InfoModal title={`Expenses breakdown — ${expMonthLabel}`}>
                  {filteredMonthlyExps.length > 0 && (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        🔁 Monthly ({filteredMonthlyExps.length})
                      </div>
                      {filteredMonthlyExps.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "2px 0",
                            fontSize: 12,
                          }}
                        >
                          <span>{e.name}</span>
                          <span style={{ fontWeight: 600 }}>
                            {fmt(e.amount)}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: 600,
                          padding: "4px 0 8px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span>Monthly subtotal</span>
                        <span>
                          {fmt(
                            filteredMonthlyExps.reduce(
                              (s, x) => s + x.amount,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  {filteredTripExps.length > 0 && (
                    <>
                      <div
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 4,
                        }}
                      >
                        ✈️ My Trips ({filteredTripExps.length})
                      </div>
                      {filteredTripExps.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "2px 0",
                            fontSize: 12,
                          }}
                        >
                          <span>{e.name}</span>
                          <span style={{ fontWeight: 600 }}>
                            {fmt(e.amount)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {filteredSharedTrips.length > 0 && (
                    <>
                      <div
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 4,
                          color: "var(--green)",
                        }}
                      >
                        🤝 Shared Trips ({filteredSharedTrips.length})
                      </div>
                      {filteredSharedTrips.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "2px 0",
                            fontSize: 12,
                          }}
                        >
                          <span>{e.name}</span>
                          <span style={{ fontWeight: 600 }}>
                            {fmt(e.amount || 0)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {filteredOnetimeExps.length > 0 && (
                    <>
                      <div
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 4,
                        }}
                      >
                        💳 One-time ({filteredOnetimeExps.length})
                      </div>
                      {filteredOnetimeExps.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "2px 0",
                            fontSize: 12,
                          }}
                        >
                          <span>{e.name}</span>
                          <span style={{ fontWeight: 600 }}>
                            {fmt(onetimeEffective(e))}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.12)",
                      marginTop: 8,
                      paddingTop: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      color: "var(--red)",
                    }}
                  >
                    <span>Total</span>
                    <span>{fmt(totalExpenses)}</span>
                  </div>
                </InfoModal>
              </div>
              <div className="metric-value red-text">{fmt(totalExpenses)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pre-invest savings</div>
              <div
                className="metric-value"
                style={{
                  color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
                }}
              >
                {savingsRate}%
              </div>
            </div>
          </div>
          <BudgetRuleSection
            rule={rule}
            setRule={setRule}
            income={totalIncome}
            expByCategory={expByCategory}
            savingsAmt={totalIncome - totalExpenses}
          />
          {/* ── Budget vs Actual ──────────────────────────────────────── */}
          {(data?.budgetAlerts || []).filter((a) => a.active).length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>
                Budget vs Actual
              </div>
              {(data?.budgetAlerts || [])
                .filter((a) => a.active)
                .map((alert) => {
                  const spent = expByCategory[alert.category] || 0;
                  const limit = alert.limit || 0;
                  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const over = spent > limit;
                  const near = !over && pct >= 80;
                  const barColor = over
                    ? "var(--red)"
                    : near
                      ? "var(--gold)"
                      : "var(--green)";
                  return (
                    <div
                      key={alert.id || alert.category}
                      style={{ marginBottom: 14 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {alert.category}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: barColor,
                            fontWeight: 600,
                          }}
                        >
                          {fmt(spent)}{" "}
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            / {fmt(limit)}
                          </span>
                          {over && (
                            <span
                              style={{ marginLeft: 6, color: "var(--red)" }}
                            >
                              +{fmt(spent - limit)} over
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          borderRadius: 4,
                          background: "var(--bg-card2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: Math.min(pct, 100) + "%",
                            height: "100%",
                            borderRadius: 4,
                            background: barColor,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: barColor,
                          marginTop: 3,
                        }}
                      >
                        {pct}% used
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <div className="card">
            <div className="card-title">Expenses by category</div>
            {Object.entries(expGrouped)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([cat, { total, subs }]) => {
                const subEntries = Object.entries(subs)
                  .filter(([k]) => k !== "")
                  .sort((a, b) => b[1] - a[1]);
                const uncategorised = subs[""] || 0;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: subEntries.length > 0 ? 4 : 0,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: subEntries.length > 0 ? 600 : 400,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {cat}
                      </span>
                      <div style={{ flex: 2 }}>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width:
                                Math.round((total / totalExpenses) * 100) + "%",
                              background: personColor,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          minWidth: 80,
                          textAlign: "right",
                        }}
                      >
                        {fmt(total)}
                      </span>
                    </div>
                    {subEntries.map(([sub, amt]) => (
                      <div
                        key={sub}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          paddingLeft: 14,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          ↳ {sub}
                        </span>
                        <div style={{ flex: 2 }}>
                          <div className="progress-track" style={{ height: 3 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: Math.round((amt / total) * 100) + "%",
                                background: personColor,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            minWidth: 80,
                            textAlign: "right",
                          }}
                        >
                          {fmt(amt)}
                        </span>
                      </div>
                    ))}
                    {uncategorised > 0 && subEntries.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          paddingLeft: 14,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          ↳ General
                        </span>
                        <div style={{ flex: 2 }} />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            minWidth: 80,
                            textAlign: "right",
                          }}
                        >
                          {fmt(uncategorised)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {tab === "income" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Income sources
            </div>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={addIncome}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {incomes.map((inc) => {
            const incEntries = inc.incomeEntries || [];
            const isIncOpen = !!expandedInc[inc.id];
            const ief = getIncEF(inc.id);
            const thisMonth = new Date().toISOString().slice(0, 7);
            const varThisMonth = incEntries
              .filter((e) => e.date?.slice(0, 7) === thisMonth)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <div key={inc.id} style={{ marginBottom: 4 }}>
                <div
                  className="budget-income-row"
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: isIncOpen
                      ? "none"
                      : "1px solid var(--border)",
                  }}
                >
                  <MobileInput
                    value={inc.name}
                    label="Income name"
                    onChange={(v) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id ? { ...x, name: v } : x,
                        ),
                      )
                    }
                    style={{ flex: 3, minWidth: 0 }}
                  />
                  <select
                    value={inc.type}
                    onChange={(e) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id ? { ...x, type: e.target.value } : x,
                        ),
                      )
                    }
                    style={{ flex: 1.5 }}
                  >
                    {INCOME_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <MobileInput
                    type="number"
                    value={inc.amount}
                    label="Income amount"
                    onChange={(v) =>
                      updatePerson(
                        "incomes",
                        incomes.map((x) =>
                          x.id === inc.id ? { ...x, amount: Number(v) } : x,
                        ),
                      )
                    }
                    style={{ flex: 1, minWidth: 0 }}
                    min="0"
                  />
                  <div
                    className="budget-exp-actions"
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {/* Variable income log toggle */}
                    <button
                      onClick={() => toggleExpandInc(inc.id)}
                      title="Log variable income (bonus, freelance, dividend…)"
                      style={{
                        background:
                          incEntries.length > 0
                            ? "var(--green-dim)"
                            : "rgba(255,255,255,0.06)",
                        border:
                          incEntries.length > 0
                            ? "1px solid rgba(76,175,130,0.3)"
                            : "1px solid var(--border)",
                        color:
                          incEntries.length > 0
                            ? "var(--green)"
                            : "var(--text-muted)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <CalendarDays size={11} />
                      {incEntries.length > 0 ? incEntries.length : "+"}
                    </button>
                    <button
                      className="btn-danger"
                      aria-label={`Delete ${inc.name}`}
                      onClick={async () => {
                        if (
                          await confirm(
                            "Delete income?",
                            `Remove "${inc.name}" from your income sources?`,
                          )
                        )
                          updatePerson(
                            "incomes",
                            incomes.filter((x) => x.id !== inc.id),
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Variable income entries panel */}
                {isIncOpen && (
                  <div
                    style={{
                      margin: "0 0 10px 12px",
                      padding: "10px 12px",
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `3px solid var(--green)`,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      Variable income log — bonus, freelance, dividend, refund,
                      etc.
                      {varThisMonth > 0 && (
                        <span
                          style={{
                            marginLeft: 8,
                            color: "var(--green)",
                            fontWeight: 600,
                            textTransform: "none",
                          }}
                        >
                          +{fmt(varThisMonth)} this month
                        </span>
                      )}
                    </div>

                    {incEntries.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {[...incEntries]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((e) => (
                            <div
                              key={e.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                                borderBottom: "1px solid var(--border)",
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  flexShrink: 0,
                                  width: 72,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {e.date.slice(5).replace("-", " ")}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(76,175,130,0.12)",
                                  color: "var(--green)",
                                  flexShrink: 0,
                                  textTransform: "capitalize",
                                }}
                              >
                                {e.type}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {e.note || "—"}
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "var(--green)",
                                  flexShrink: 0,
                                }}
                              >
                                +{fmt(e.amount)}
                              </span>
                              <button
                                onClick={async () => {
                                  if (
                                    await confirm(
                                      "Delete entry?",
                                      `Remove this ${e.type || "income"} entry of ${fmt(e.amount)}?`,
                                    )
                                  )
                                    deleteIncEntry(inc, e.id);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-muted)",
                                  padding: 2,
                                  flexShrink: 0,
                                }}
                                title="Remove entry"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    <div
                      className="budget-entry-form"
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="date"
                        value={ief.date}
                        onChange={(e) =>
                          setIEF(inc.id, { date: e.target.value })
                        }
                        style={{ flex: "0 0 130px" }}
                      />
                      <MobileInput
                        type="number"
                        placeholder="Amount (₹)"
                        value={ief.amount}
                        label="Amount"
                        onChange={(v) => setIEF(inc.id, { amount: v })}
                        style={{ flex: "0 0 110px" }}
                        min="0"
                      />
                      <select
                        value={ief.type}
                        onChange={(e) =>
                          setIEF(inc.id, { type: e.target.value })
                        }
                        style={{ flex: "0 0 100px", fontSize: 12 }}
                      >
                        {INC_ENTRY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <MobileInput
                        placeholder="Note (e.g. Q1 bonus)"
                        value={ief.note}
                        label="Note"
                        onChange={(v) => setIEF(inc.id, { note: v })}
                        style={{ flex: 1, minWidth: 100 }}
                      />
                      <button
                        className="btn-primary"
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => addIncEntry(inc)}
                        disabled={!ief.amount || !ief.date}
                      >
                        <Plus size={11} /> Log
                      </button>
                    </div>
                  </div>
                )}

                {/* Salary change form (existing) */}
                {salaryForm[inc.id] ? (
                  <div
                    style={{
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 14px",
                      marginTop: 4,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 10,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Log salary change
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1.5fr",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          New amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={salaryForm[inc.id].newAmount}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: {
                                ...s[inc.id],
                                newAmount: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          Effective date
                        </label>
                        <input
                          type="date"
                          value={salaryForm[inc.id].date}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: { ...s[inc.id], date: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "block",
                            marginBottom: 3,
                          }}
                        >
                          Reason (optional)
                        </label>
                        <input
                          placeholder="e.g. Promotion, Job change"
                          value={salaryForm[inc.id].note}
                          onChange={(e) =>
                            setSalaryForm((s) => ({
                              ...s,
                              [inc.id]: { ...s[inc.id], note: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    {salaryForm[inc.id].newAmount &&
                      Number(salaryForm[inc.id].newAmount) !== inc.amount && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginBottom: 8,
                          }}
                        >
                          {fmt(inc.amount)} →{" "}
                          <strong
                            style={{
                              color:
                                Number(salaryForm[inc.id].newAmount) >
                                inc.amount
                                  ? "var(--green)"
                                  : "var(--red)",
                            }}
                          >
                            {fmt(Number(salaryForm[inc.id].newAmount))}
                          </strong>
                          {inc.amount > 0 && (
                            <span
                              style={{
                                marginLeft: 6,
                                color:
                                  Number(salaryForm[inc.id].newAmount) >
                                  inc.amount
                                    ? "var(--green)"
                                    : "var(--red)",
                              }}
                            >
                              (
                              {((Number(salaryForm[inc.id].newAmount) -
                                inc.amount) /
                                inc.amount) *
                                100 >
                              0
                                ? "+"
                                : ""}
                              {(
                                ((Number(salaryForm[inc.id].newAmount) -
                                  inc.amount) /
                                  inc.amount) *
                                100
                              ).toFixed(1)}
                              %)
                            </span>
                          )}
                        </div>
                      )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() => commitSalaryChange(inc)}
                      >
                        Save change
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => cancelSalaryChange(inc.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "3px 10px" }}
                      onClick={() => openSalaryChange(inc)}
                    >
                      ↑ Log salary change
                    </button>
                    {(inc.salaryHistory?.length ?? 0) > 0 && (
                      <button
                        className="btn-ghost"
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => toggleHistory(inc.id)}
                      >
                        History ({inc.salaryHistory.length})
                        {expandedHistory[inc.id] ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* History timeline */}
                {expandedHistory[inc.id] &&
                  (inc.salaryHistory?.length ?? 0) > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${personColor}`,
                      }}
                    >
                      {[...inc.salaryHistory].reverse().map((h, i) => {
                        const pct =
                          h.from > 0
                            ? (((h.to - h.from) / h.from) * 100).toFixed(1)
                            : null;
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "6px 0",
                              borderBottom: "1px solid var(--border)",
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                              }}
                            >
                              <span style={{ color: "var(--text-muted)" }}>
                                {h.date}
                              </span>
                              <span>
                                {fmt(h.from)} →{" "}
                                <strong
                                  style={{
                                    color:
                                      h.to >= h.from
                                        ? "var(--green)"
                                        : "var(--red)",
                                  }}
                                >
                                  {fmt(h.to)}
                                </strong>
                                {pct !== null && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      color:
                                        h.to >= h.from
                                          ? "var(--green)"
                                          : "var(--red)",
                                    }}
                                  >
                                    ({h.to >= h.from ? "+" : ""}
                                    {pct}%)
                                  </span>
                                )}
                              </span>
                            </div>
                            {h.note && (
                              <div
                                style={{
                                  color: "var(--text-muted)",
                                  marginTop: 2,
                                  fontStyle: "italic",
                                }}
                              >
                                {h.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}
          <div style={{ textAlign: "right", paddingTop: 12, fontWeight: 600 }}>
            Total: <span className="green-text">{fmt(totalIncome)}</span>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div>
          {/* ── Smart Paste + Expense sub-tabs ── */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: "1rem",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setSmartPasteOpen(true)}
              title="Paste SMS to add expenses automatically"
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--gold-dim)",
                color: "var(--gold)",
                border: "1px solid var(--gold-border)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                marginRight: 4,
                whiteSpace: "nowrap",
              }}
            >
              <ClipboardPaste size={12} /> Smart Paste
            </button>
            {[
              {
                key: "onetime",
                icon: <CreditCard size={12} />,
                count: filteredOnetimeExps.length,
              },
              {
                key: "trip",
                icon: <Plane size={12} />,
                count: filteredTripExps.length + filteredSharedTrips.length,
              },
              {
                key: "monthly",
                icon: <Repeat size={12} />,
                count: monthlyExps.length,
              },
            ].map(({ key, icon, count }) => {
              const meta = EXPENSE_TYPES[key];
              const active = expTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setExpTab(key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: active
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                    color: active ? meta.color : "var(--text-muted)",
                    border: active
                      ? `1px solid ${meta.color}33`
                      : "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {icon} {meta.label}
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: active
                          ? `${meta.color}22`
                          : "rgba(255,255,255,0.05)",
                        color: active ? meta.color : "var(--text-muted)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Month selector (for one-time and trips) ── */}
          {(expTab === "onetime" || expTab === "trip") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                marginBottom: "1rem",
                padding: "8px 0",
              }}
            >
              <button
                onClick={expPrevMonth}
                style={{
                  background: "var(--bg-card2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  minWidth: 140,
                  textAlign: "center",
                }}
              >
                {expMonthLabel}
              </div>
              <button
                onClick={expNextMonth}
                style={{
                  background: "var(--bg-card2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
              {expMonth !== _curYm && (
                <button
                  onClick={() => setExpMonth(_curYm)}
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                >
                  Today
                </button>
              )}
            </div>
          )}

          {/* ══════════════════ MONTHLY EXPENSES ══════════════════ */}
          {expTab === "monthly" && (
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <Repeat size={14} style={{ marginRight: 6, opacity: 0.5 }} />
                  Monthly Expenses
                </div>
                <button
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={addMonthlyExpense}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              {monthlyExps.length === 0 && (
                <EmptyState
                  type="budget"
                  title="No monthly expenses yet"
                  description="Add recurring costs like rent, groceries, or subscriptions."
                  actionLabel="+ Add expense"
                  onAction={addMonthlyExpense}
                />
              )}

              {monthlyExps.map((exp) => {
                const entries = exp.entries || [];
                const isOpen = !!expandedExp[exp.id];
                const ef = getEntryForm(exp.id);
                const thisMonth = new Date().toISOString().slice(0, 7);
                const spentThisMonth = entries
                  .filter((e) => e.date?.slice(0, 7) === thisMonth)
                  .reduce((s, e) => s + e.amount, 0);
                return (
                  <div
                    key={exp.id}
                    style={{
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 14px",
                      marginBottom: 8,
                      borderLeft: "3px solid var(--blue)",
                    }}
                  >
                    {/* Row 1: Name + Amount + Actions */}
                    <div
                      className="budget-exp-row"
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <MobileInput
                        value={exp.name}
                        label="Expense name"
                        onChange={(v) =>
                          updatePerson(
                            "expenses",
                            expenses.map((x) =>
                              x.id === exp.id ? { ...x, name: v } : x,
                            ),
                          )
                        }
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      {entries.length > 0 ? (
                        <div
                          style={{
                            flexShrink: 0,
                            textAlign: "right",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {fmt(exp.amount)}
                          {spentThisMonth > 0 && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                fontWeight: 400,
                              }}
                            >
                              {fmt(spentThisMonth)} this mo
                            </div>
                          )}
                        </div>
                      ) : (
                        <MobileInput
                          type="number"
                          value={exp.amount}
                          label="Amount"
                          onChange={(v) =>
                            updatePerson(
                              "expenses",
                              expenses.map((x) =>
                                x.id === exp.id
                                  ? { ...x, amount: Number(v) }
                                  : x,
                              ),
                            )
                          }
                          style={{ width: 90, flexShrink: 0 }}
                          min="0"
                          placeholder="₹"
                        />
                      )}
                      <div
                        className="budget-exp-actions"
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <button
                          onClick={() => {
                            toggleExpandExp(exp.id);
                            if (!isOpen) setEF(exp.id, {});
                          }}
                          title="Log purchases"
                          style={{
                            background:
                              entries.length > 0
                                ? "var(--gold-dim)"
                                : "rgba(255,255,255,0.06)",
                            border:
                              entries.length > 0
                                ? "1px solid var(--gold-border)"
                                : "1px solid var(--border)",
                            color:
                              entries.length > 0
                                ? "var(--gold)"
                                : "var(--text-muted)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          <CalendarDays size={11} />
                          {entries.length > 0 ? entries.length : "Log"}
                        </button>
                        <MoveButton expId={exp.id} currentType="monthly" />
                        <button
                          className="btn-danger"
                          aria-label={`Delete ${exp.name}`}
                          onClick={async () => {
                            if (
                              await confirm(
                                "Delete expense?",
                                `Remove "${exp.name}"?`,
                              )
                            )
                              updatePerson(
                                "expenses",
                                expenses.filter((x) => x.id !== exp.id),
                              );
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Category pill + Recurrence */}
                    <div
                      className="budget-exp-meta"
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <select
                        value={exp.category}
                        onChange={(e) =>
                          updatePerson(
                            "expenses",
                            expenses.map((x) =>
                              x.id === exp.id
                                ? {
                                    ...x,
                                    category: e.target.value,
                                    subCategory: "",
                                  }
                                : x,
                            ),
                          )
                        }
                        style={{ flex: "0 1 130px", fontSize: 12 }}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      {(() => {
                        const subs = getSubcats(exp.category);
                        const isAdding = addingSubCat?.expId === exp.id;
                        return (
                          <>
                            {subs.length > 0 && (
                              <select
                                value={exp.subCategory || ""}
                                onChange={(e) =>
                                  updatePerson(
                                    "expenses",
                                    expenses.map((x) =>
                                      x.id === exp.id
                                        ? { ...x, subCategory: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                style={{ flex: "0 1 130px", fontSize: 12 }}
                              >
                                <option value="">— sub —</option>
                                {subs.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            )}
                            {isAdding ? (
                              <input
                                autoFocus
                                type="text"
                                value={newSubCatText}
                                onChange={(e) =>
                                  setNewSubCatText(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    saveCustomSubCat(
                                      exp.category,
                                      newSubCatText,
                                      exp.id,
                                    );
                                  if (e.key === "Escape") {
                                    setAddingSubCat(null);
                                    setNewSubCatText("");
                                  }
                                }}
                                onBlur={() =>
                                  saveCustomSubCat(
                                    exp.category,
                                    newSubCatText,
                                    exp.id,
                                  )
                                }
                                placeholder="New subcategory…"
                                style={{
                                  flex: "0 1 120px",
                                  fontSize: 12,
                                  padding: "3px 6px",
                                }}
                              />
                            ) : (
                              <button
                                title="Add custom subcategory"
                                onClick={() => {
                                  setAddingSubCat({
                                    expId: exp.id,
                                    category: exp.category,
                                  });
                                  setNewSubCatText("");
                                }}
                                style={{
                                  background: "none",
                                  border: "1px dashed var(--border)",
                                  color: "var(--text-muted)",
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                + sub
                              </button>
                            )}
                          </>
                        );
                      })()}
                      <select
                        value={exp.recurrence || "monthly"}
                        onChange={(e) =>
                          updatePerson(
                            "expenses",
                            expenses.map((x) =>
                              x.id === exp.id
                                ? { ...x, recurrence: e.target.value }
                                : x,
                            ),
                          )
                        }
                        style={{ flex: "0 0 96px", fontSize: 12 }}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="variable">Variable</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      {exp.recurrence === "yearly" && (
                        <select
                          value={exp.recurrenceMonth ?? 0}
                          onChange={(e) =>
                            updatePerson(
                              "expenses",
                              expenses.map((x) =>
                                x.id === exp.id
                                  ? {
                                      ...x,
                                      recurrenceMonth: Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                          style={{ flex: "0 0 64px", fontSize: 12 }}
                        >
                          {[
                            "Jan",
                            "Feb",
                            "Mar",
                            "Apr",
                            "May",
                            "Jun",
                            "Jul",
                            "Aug",
                            "Sep",
                            "Oct",
                            "Nov",
                            "Dec",
                          ].map((m, i) => (
                            <option key={m} value={i}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      {exp.recurrence === "quarterly" && (
                        <select
                          value={(exp.recurrenceMonths ?? [0, 3, 6, 9])[0]}
                          onChange={(e) => {
                            const start = Number(e.target.value);
                            updatePerson(
                              "expenses",
                              expenses.map((x) =>
                                x.id === exp.id
                                  ? {
                                      ...x,
                                      recurrenceMonths: [
                                        start,
                                        (start + 3) % 12,
                                        (start + 6) % 12,
                                        (start + 9) % 12,
                                      ],
                                    }
                                  : x,
                              ),
                            );
                          }}
                          style={{ flex: "0 0 64px", fontSize: 12 }}
                        >
                          {["Jan", "Feb", "Mar"].map((m, i) => (
                            <option key={m} value={i}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="date"
                        value={exp.date || ""}
                        onChange={(e) =>
                          updatePerson(
                            "expenses",
                            expenses.map((x) =>
                              x.id === exp.id
                                ? { ...x, date: e.target.value }
                                : x,
                            ),
                          )
                        }
                        style={{ flex: "0 0 130px", fontSize: 12 }}
                        title="Expense start date"
                      />
                    </div>

                    {/* Entries panel (purchase log) */}
                    {isOpen && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          background: "var(--bg-card)",
                          borderRadius: "var(--radius-sm)",
                          borderLeft: `3px solid ${personColor}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: ".06em",
                          }}
                        >
                          Purchase log
                        </div>
                        {entries.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            {[...entries]
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((e) => {
                                const editKey = `${exp.id}_${e.id}`;
                                const isEditing = !!editEntry[editKey];
                                const ef2 = editEntry[editKey] || {};
                                if (isEditing) {
                                  return (
                                    <div
                                      key={e.id}
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        padding: "6px 0",
                                        borderBottom: "1px solid var(--border)",
                                      }}
                                    >
                                      <input
                                        type="date"
                                        value={ef2.date}
                                        onChange={(ev) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: {
                                              ...ef2,
                                              date: ev.target.value,
                                            },
                                          }))
                                        }
                                        style={{
                                          flex: "0 0 130px",
                                          fontSize: 12,
                                        }}
                                      />
                                      <MobileInput
                                        type="number"
                                        placeholder="₹"
                                        value={ef2.amount}
                                        label="Amount"
                                        onChange={(v) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: { ...ef2, amount: v },
                                          }))
                                        }
                                        style={{ flex: "0 0 90px" }}
                                        min="0"
                                      />
                                      <MobileInput
                                        placeholder="Note"
                                        value={ef2.note}
                                        label="Note"
                                        onChange={(v) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: { ...ef2, note: v },
                                          }))
                                        }
                                        style={{ flex: 1, minWidth: 80 }}
                                      />
                                      <button
                                        className="btn-primary"
                                        style={{
                                          padding: "4px 10px",
                                          fontSize: 12,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                        onClick={() => saveEditEntry(exp, e.id)}
                                        disabled={!ef2.amount || !ef2.date}
                                      >
                                        <Check size={11} /> Save
                                      </button>
                                      <button
                                        className="btn-ghost"
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: 12,
                                        }}
                                        onClick={() => cancelEditEntry(exp, e)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={e.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "4px 0",
                                      borderBottom: "1px solid var(--border)",
                                      fontSize: 12,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontVariantNumeric: "tabular-nums",
                                        flexShrink: 0,
                                        width: 72,
                                      }}
                                    >
                                      {e.date.slice(5).replace("-", " ")}
                                    </span>
                                    <span
                                      style={{
                                        flex: 1,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {e.note || "—"}
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        color: "var(--red)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {fmt(e.amount)}
                                    </span>
                                    <button
                                      onClick={() => startEditEntry(exp, e)}
                                      title="Edit"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        padding: 2,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (
                                          await confirm(
                                            "Delete entry?",
                                            `Remove this purchase log entry of ${fmt(e.amount)}?`,
                                          )
                                        )
                                          deleteEntry(exp, e.id);
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        padding: 2,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        <div
                          className="budget-entry-form"
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="date"
                            value={ef.date}
                            onChange={(e) =>
                              setEF(exp.id, { date: e.target.value })
                            }
                            style={{ flex: "0 0 130px" }}
                          />
                          <MobileInput
                            type="number"
                            placeholder="₹"
                            value={ef.amount}
                            label="Amount"
                            onChange={(v) => setEF(exp.id, { amount: v })}
                            style={{ flex: "0 0 90px" }}
                            min="0"
                          />
                          <MobileInput
                            placeholder="Note"
                            value={ef.note}
                            label="Note"
                            onChange={(v) => setEF(exp.id, { note: v })}
                            style={{ flex: 1, minWidth: 100 }}
                          />
                          <button
                            className="btn-primary"
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                            }}
                            onClick={() => addEntry(exp)}
                            disabled={!ef.amount || !ef.date}
                          >
                            <Plus size={11} /> Log
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {monthlyExps.length > 0 && (
                <div
                  style={{
                    textAlign: "right",
                    paddingTop: 8,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Monthly total:{" "}
                  <span className="red-text">
                    {fmt(monthlyExps.reduce((s, x) => s + x.amount, 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ TRIPS & EVENTS ══════════════════ */}
          {expTab === "trip" && (
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <Plane size={14} style={{ marginRight: 6, opacity: 0.5 }} />
                  Trips & Events
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    onClick={addSharedTrip}
                    title="Create a trip shared between both persons"
                  >
                    <Users size={13} /> Shared trip
                  </button>
                  <button
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    onClick={addTrip}
                  >
                    <Plus size={13} /> My trip
                  </button>
                </div>
              </div>

              {allTrips.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    padding: "1rem 0",
                    textAlign: "center",
                  }}
                >
                  No trips in {expMonthLabel}. Create one to group travel,
                  hotel, food &amp; shopping expenses together.
                </div>
              )}

              {allTrips.map((trip) => {
                const items = trip.items || [];
                const total = tripTotal(trip);
                const isShared = trip._isShared;
                const tripKey = isShared ? `shared_${trip.id}` : `${trip.id}`;
                const isOpen = !!expandedTrips[tripKey];
                const tif = getTripIF(tripKey);
                const openCats = tripCatOpen[tripKey] || new Set();
                const catGroups = {};
                items.forEach((i) => {
                  if (!catGroups[i.category]) catGroups[i.category] = [];
                  catGroups[i.category].push(i);
                });
                const sortedCats = Object.entries(catGroups).sort(
                  (a, b) =>
                    b[1].reduce((s, i) => s + i.amount, 0) -
                    a[1].reduce((s, i) => s + i.amount, 0),
                );
                const toggleCat = (cat) =>
                  setTripCatOpen((s) => {
                    const prev = new Set(s[tripKey] || []);
                    if (prev.has(cat)) prev.delete(cat);
                    else prev.add(cat);
                    return { ...s, [tripKey]: prev };
                  });
                const hasBudget = (trip.budget || 0) > 0;
                const budgetPct = hasBudget
                  ? Math.round((total / trip.budget) * 100)
                  : 0;
                const overBudget = hasBudget && total > trip.budget;
                const updateTripField = (field, value) => {
                  if (isShared) {
                    updateShared(
                      "trips",
                      sharedTrips.map((x) =>
                        x.id === trip.id ? { ...x, [field]: value } : x,
                      ),
                    );
                  } else {
                    updatePerson(
                      "expenses",
                      expenses.map((x) =>
                        x.id === trip.id ? { ...x, [field]: value } : x,
                      ),
                    );
                  }
                };

                return (
                  <div
                    key={tripKey}
                    style={{
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "14px 16px",
                      marginBottom: 10,
                      borderLeft: isShared
                        ? "3px solid var(--green)"
                        : "3px solid var(--purple)",
                    }}
                  >
                    {/* Trip header */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                        cursor: "pointer",
                      }}
                      onClick={() => toggleTrip(tripKey)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === "Enter" && toggleTrip(tripKey)
                      }
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>
                        {isShared ? "🤝" : "✈️"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {trip.name}
                          </span>
                          {isShared && (
                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "var(--green-dim)",
                                color: "var(--green)",
                                fontWeight: 600,
                              }}
                            >
                              Shared
                            </span>
                          )}
                          {trip.startDate && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              <MapPin size={10} style={{ marginRight: 3 }} />
                              {trip.startDate.slice(5).replace("-", "/")}
                              {trip.endDate
                                ? ` – ${trip.endDate.slice(5).replace("-", "/")}`
                                : ""}
                            </span>
                          )}
                          <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                          >
                            {items.length} item{items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: overBudget
                              ? "var(--red)"
                              : "var(--text-primary)",
                          }}
                        >
                          {fmt(total)}
                        </div>
                        {hasBudget && (
                          <div
                            style={{
                              fontSize: 10,
                              color: overBudget
                                ? "var(--red)"
                                : "var(--text-muted)",
                            }}
                          >
                            {budgetPct}% of {fmt(trip.budget)} budget
                          </div>
                        )}
                      </div>
                      {!isShared && (
                        <MoveButton expId={trip.id} currentType="trip" />
                      )}
                      <button
                        className="btn-danger"
                        aria-label={`Delete ${trip.name}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            await confirm(
                              "Delete trip?",
                              `Remove "${trip.name}" and all its items?`,
                            )
                          ) {
                            if (isShared) {
                              updateShared(
                                "trips",
                                sharedTrips.filter((x) => x.id !== trip.id),
                              );
                            } else {
                              updatePerson(
                                "expenses",
                                expenses.filter((x) => x.id !== trip.id),
                              );
                            }
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                      {isOpen ? (
                        <ChevronUp
                          size={14}
                          style={{ color: "var(--text-muted)", flexShrink: 0 }}
                        />
                      ) : (
                        <ChevronDown
                          size={14}
                          style={{ color: "var(--text-muted)", flexShrink: 0 }}
                        />
                      )}
                    </div>

                    {/* Budget bar */}
                    {hasBudget && (
                      <div style={{ marginBottom: isOpen ? 12 : 0 }}>
                        <div
                          style={{
                            position: "relative",
                            height: 6,
                            borderRadius: 3,
                            background: "rgba(255,255,255,0.07)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: Math.min(100, budgetPct) + "%",
                              height: "100%",
                              background: overBudget
                                ? "var(--red)"
                                : "var(--purple)",
                              borderRadius: 3,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Expanded: trip details */}
                    {isOpen && (
                      <div>
                        {/* Edit trip meta */}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <input
                            value={trip.name}
                            onChange={(e) =>
                              updateTripField("name", e.target.value)
                            }
                            placeholder="Trip name"
                            style={{ flex: "1 1 140px" }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            type="date"
                            value={trip.startDate || ""}
                            onChange={(e) =>
                              updateTripField("startDate", e.target.value)
                            }
                            style={{ flex: "0 0 130px", fontSize: 12 }}
                            title="Start date"
                          />
                          <input
                            type="date"
                            value={trip.endDate || ""}
                            onChange={(e) =>
                              updateTripField("endDate", e.target.value)
                            }
                            style={{ flex: "0 0 130px", fontSize: 12 }}
                            title="End date"
                          />
                          <input
                            type="number"
                            placeholder="Budget (₹)"
                            value={trip.budget || ""}
                            onChange={(e) =>
                              updateTripField("budget", Number(e.target.value))
                            }
                            style={{ flex: "0 0 110px", fontSize: 12 }}
                            min="0"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isShared) convertToPersonal(trip);
                              else convertToShared(trip);
                            }}
                            title={
                              isShared
                                ? "Convert to personal trip"
                                : "Convert to shared trip (visible to both)"
                            }
                            style={{
                              background: isShared
                                ? "rgba(255,255,255,0.06)"
                                : "var(--green-dim)",
                              border: isShared
                                ? "1px solid var(--border)"
                                : "1px solid rgba(76,175,130,0.3)",
                              color: isShared
                                ? "var(--text-muted)"
                                : "var(--green)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              flexShrink: 0,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Users size={11} />{" "}
                            {isShared ? "Make personal" : "Make shared"}
                          </button>
                        </div>

                        {/* Category accordion */}
                        {sortedCats.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            {sortedCats.map(([cat, catItems]) => {
                              const catTotal = catItems.reduce(
                                (s, i) => s + i.amount,
                                0,
                              );
                              const isCatOpen =
                                sortedCats.length === 1 || openCats.has(cat);
                              return (
                                <div key={cat}>
                                  <div
                                    onClick={() => {
                                      if (sortedCats.length > 1) toggleCat(cat);
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "7px 0",
                                      borderBottom: "1px solid var(--border)",
                                      cursor:
                                        sortedCats.length > 1
                                          ? "pointer"
                                          : "default",
                                      userSelect: "none",
                                    }}
                                  >
                                    {sortedCats.length > 1 && (
                                      <ChevronDown
                                        size={12}
                                        style={{
                                          transition: "transform 0.2s",
                                          transform: isCatOpen
                                            ? "rotate(0deg)"
                                            : "rotate(-90deg)",
                                          flexShrink: 0,
                                          color: "var(--text-muted)",
                                        }}
                                      />
                                    )}
                                    <span
                                      style={{
                                        fontSize: 10,
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        background: "var(--purple-dim)",
                                        color: "var(--purple)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {cat}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {catItems.length} item
                                      {catItems.length !== 1 ? "s" : ""}
                                    </span>
                                    <span style={{ flex: 1 }} />
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 12,
                                        color: "var(--red)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {fmt(catTotal)}
                                    </span>
                                    {total > 0 && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "var(--text-muted)",
                                          flexShrink: 0,
                                          minWidth: 32,
                                          textAlign: "right",
                                        }}
                                      >
                                        {Math.round((catTotal / total) * 100)}%
                                      </span>
                                    )}
                                  </div>
                                  {isCatOpen && (
                                    <div
                                      style={{
                                        paddingLeft:
                                          sortedCats.length > 1 ? 18 : 0,
                                      }}
                                    >
                                      {catItems.map((item) => (
                                        <div
                                          key={item.id}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "5px 0",
                                            borderBottom:
                                              "1px solid var(--border)",
                                            fontSize: 12,
                                          }}
                                        >
                                          <span
                                            style={{
                                              flex: 1,
                                              color: "var(--text-secondary)",
                                            }}
                                          >
                                            {item.name}
                                          </span>
                                          {isShared && item.addedBy && (
                                            <span
                                              style={{
                                                fontSize: 9,
                                                padding: "1px 5px",
                                                borderRadius: 3,
                                                background:
                                                  "rgba(255,255,255,0.06)",
                                                color: "var(--text-muted)",
                                                flexShrink: 0,
                                              }}
                                            >
                                              {item.addedBy}
                                            </span>
                                          )}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "var(--red)",
                                              flexShrink: 0,
                                            }}
                                          >
                                            {fmt(item.amount)}
                                          </span>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (
                                                await confirm(
                                                  "Delete item?",
                                                  `Remove "${item.name}" (${fmt(item.amount)}) from this trip?`,
                                                )
                                              )
                                                deleteTripItem(
                                                  trip,
                                                  item.id,
                                                  isShared,
                                                );
                                            }}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "var(--text-muted)",
                                              padding: 2,
                                              flexShrink: 0,
                                            }}
                                          >
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add item form */}
                        <div
                          className="budget-trip-item-form"
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <select
                            value={tif.category}
                            onChange={(e) =>
                              setTIF(tripKey, { category: e.target.value })
                            }
                            style={{ flex: "0 0 110px", fontSize: 12 }}
                          >
                            {TRIP_CATEGORIES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <MobileInput
                            value={tif.name}
                            label="Item name"
                            placeholder="Item (e.g. Flight tickets)"
                            onChange={(v) => setTIF(tripKey, { name: v })}
                            style={{ flex: 1, minWidth: 120 }}
                          />
                          <MobileInput
                            type="number"
                            value={tif.amount}
                            label="Amount"
                            placeholder="₹"
                            onChange={(v) => setTIF(tripKey, { amount: v })}
                            style={{ flex: "0 0 90px" }}
                            min="0"
                          />
                          <button
                            className="btn-primary"
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                            }}
                            onClick={() => addTripItem(trip, isShared)}
                            disabled={!tif.name || !tif.amount}
                          >
                            <Plus size={11} /> Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {allTrips.length > 0 && (
                <div
                  style={{
                    textAlign: "right",
                    paddingTop: 8,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Trips total:{" "}
                  <span className="red-text">
                    {fmt(
                      allTrips.reduce(
                        (s, x) => s + (x.amount || tripTotal(x)),
                        0,
                      ),
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ ONE-TIME EXPENSES ══════════════════ */}
          {expTab === "onetime" && (
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <CreditCard
                    size={14}
                    style={{ marginRight: 6, opacity: 0.5 }}
                  />
                  One-time Purchases
                </div>
                <button
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={addOnetimeExpense}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              {filteredOnetimeExps.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    padding: "1rem 0",
                    textAlign: "center",
                  }}
                >
                  No one-time expenses in {expMonthLabel}. Add big purchases
                  like electronics, furniture, or medical bills.
                </div>
              )}

              {filteredOnetimeExps.map((exp) => {
                const entries = exp.entries || [];
                const isOpen = expandedExp[exp.id];
                const ef = getEntryForm(exp.id);
                return (
                  <div
                    key={exp.id}
                    style={{
                      background: "var(--bg-card2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 14px",
                      marginBottom: 8,
                      borderLeft: "3px solid var(--gold)",
                    }}
                  >
                    {/* Row 1: Expense name */}
                    <MobileInput
                      value={exp.name}
                      label="Expense name"
                      onChange={(v) =>
                        updatePerson(
                          "expenses",
                          expenses.map((x) =>
                            x.id === exp.id ? { ...x, name: v } : x,
                          ),
                        )
                      }
                      style={{ width: "100%", marginBottom: 6 }}
                      placeholder="Expense name"
                    />
                    {/* Row 2: Category + subcategory */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <select
                        value={exp.category}
                        onChange={(e) =>
                          updatePerson(
                            "expenses",
                            expenses.map((x) =>
                              x.id === exp.id
                                ? {
                                    ...x,
                                    category: e.target.value,
                                    subCategory: "",
                                  }
                                : x,
                            ),
                          )
                        }
                        style={{ flex: "0 1 130px", fontSize: 12 }}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      {(() => {
                        const subs = getSubcats(exp.category);
                        const isAdding = addingSubCat?.expId === exp.id;
                        return (
                          <>
                            {subs.length > 0 && (
                              <select
                                value={exp.subCategory || ""}
                                onChange={(e) =>
                                  updatePerson(
                                    "expenses",
                                    expenses.map((x) =>
                                      x.id === exp.id
                                        ? { ...x, subCategory: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                style={{ flex: "0 1 130px", fontSize: 12 }}
                              >
                                <option value="">— sub —</option>
                                {subs.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            )}
                            {isAdding ? (
                              <input
                                autoFocus
                                type="text"
                                value={newSubCatText}
                                onChange={(e) =>
                                  setNewSubCatText(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    saveCustomSubCat(
                                      exp.category,
                                      newSubCatText,
                                      exp.id,
                                    );
                                  if (e.key === "Escape") {
                                    setAddingSubCat(null);
                                    setNewSubCatText("");
                                  }
                                }}
                                onBlur={() =>
                                  saveCustomSubCat(
                                    exp.category,
                                    newSubCatText,
                                    exp.id,
                                  )
                                }
                                placeholder="New subcategory…"
                                style={{
                                  flex: "0 1 120px",
                                  fontSize: 12,
                                  padding: "3px 6px",
                                }}
                              />
                            ) : (
                              <button
                                title="Add custom subcategory"
                                onClick={() => {
                                  setAddingSubCat({
                                    expId: exp.id,
                                    category: exp.category,
                                  });
                                  setNewSubCatText("");
                                }}
                                style={{
                                  background: "none",
                                  border: "1px dashed var(--border)",
                                  color: "var(--text-muted)",
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                + sub
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* Row 3: Log button */}
                    <div style={{ marginBottom: 4 }}>
                      <button
                        onClick={() => {
                          toggleExpandExp(exp.id);
                          if (!isOpen) setEF(exp.id, {});
                        }}
                        title="Log purchases"
                        style={{
                          background:
                            entries.length > 0
                              ? "var(--gold-dim)"
                              : "rgba(255,255,255,0.06)",
                          border:
                            entries.length > 0
                              ? "1px solid var(--gold-border)"
                              : "1px solid var(--border)",
                          color:
                            entries.length > 0
                              ? "var(--gold)"
                              : "var(--text-muted)",
                          borderRadius: 6,
                          padding: "5px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <CalendarDays size={12} />
                        {entries.length > 0
                          ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · tap to add more`
                          : "Add purchase log"}
                      </button>
                    </div>

                    {/* Logged total pill */}
                    {entries.length > 0 &&
                      (() => {
                        const loggedTotal = entries.reduce(
                          (s, e) => s + (e.amount || 0),
                          0,
                        );
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginTop: 8,
                              padding: "6px 10px",
                              background: "rgba(255,255,255,0.04)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "var(--text-muted)" }}>
                              Total:{" "}
                              <span
                                style={{ fontWeight: 600, color: "var(--red)" }}
                              >
                                {fmt(loggedTotal)}
                              </span>
                              <span style={{ margin: "0 6px", opacity: 0.4 }}>
                                ·
                              </span>
                              {entries.length}{" "}
                              {entries.length === 1 ? "entry" : "entries"}
                            </span>
                          </div>
                        );
                      })()}

                    {/* Purchase log panel */}
                    {isOpen && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          background: "var(--bg-card)",
                          borderRadius: "var(--radius-sm)",
                          borderLeft: `3px solid ${personColor}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: ".06em",
                          }}
                        >
                          Purchase log
                        </div>
                        {entries.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            {[...entries]
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((e) => {
                                const editKey = `${exp.id}_${e.id}`;
                                const isEditing = !!editEntry[editKey];
                                const ef2 = editEntry[editKey] || {};
                                if (isEditing) {
                                  return (
                                    <div
                                      key={e.id}
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        padding: "6px 0",
                                        borderBottom: "1px solid var(--border)",
                                      }}
                                    >
                                      <input
                                        type="date"
                                        value={ef2.date}
                                        onChange={(ev) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: {
                                              ...ef2,
                                              date: ev.target.value,
                                            },
                                          }))
                                        }
                                        style={{
                                          flex: "0 0 130px",
                                          fontSize: 12,
                                        }}
                                      />
                                      <MobileInput
                                        type="number"
                                        placeholder="₹"
                                        value={ef2.amount}
                                        label="Amount"
                                        onChange={(v) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: { ...ef2, amount: v },
                                          }))
                                        }
                                        style={{ flex: "0 0 90px" }}
                                        min="0"
                                      />
                                      <MobileInput
                                        placeholder="Note"
                                        value={ef2.note}
                                        label="Note"
                                        onChange={(v) =>
                                          setEditEntry((s) => ({
                                            ...s,
                                            [editKey]: { ...ef2, note: v },
                                          }))
                                        }
                                        style={{ flex: 1, minWidth: 80 }}
                                      />
                                      <button
                                        className="btn-primary"
                                        style={{
                                          padding: "4px 10px",
                                          fontSize: 12,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                        onClick={() => saveEditEntry(exp, e.id)}
                                        disabled={!ef2.amount || !ef2.date}
                                      >
                                        <Check size={11} /> Save
                                      </button>
                                      <button
                                        className="btn-ghost"
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: 12,
                                        }}
                                        onClick={() => cancelEditEntry(exp, e)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={e.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "4px 0",
                                      borderBottom: "1px solid var(--border)",
                                      fontSize: 12,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontVariantNumeric: "tabular-nums",
                                        flexShrink: 0,
                                        width: 72,
                                      }}
                                    >
                                      {e.date.slice(5).replace("-", " ")}
                                    </span>
                                    <span
                                      style={{
                                        flex: 1,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {e.note || "—"}
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        color: "var(--red)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {fmt(e.amount)}
                                    </span>
                                    <button
                                      onClick={() => startEditEntry(exp, e)}
                                      title="Edit"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        padding: 2,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (
                                          await confirm(
                                            "Delete entry?",
                                            `Remove this purchase log entry of ${fmt(e.amount)}?`,
                                          )
                                        )
                                          deleteEntry(exp, e.id);
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        padding: 2,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        <div
                          className="budget-entry-form"
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="date"
                            value={ef.date}
                            onChange={(e) =>
                              setEF(exp.id, { date: e.target.value })
                            }
                            style={{ flex: "0 0 130px" }}
                          />
                          <MobileInput
                            type="number"
                            placeholder="₹"
                            value={ef.amount}
                            label="Amount"
                            onChange={(v) => setEF(exp.id, { amount: v })}
                            style={{ flex: "0 0 90px" }}
                            min="0"
                          />
                          <MobileInput
                            placeholder="Note"
                            value={ef.note}
                            label="Note"
                            onChange={(v) => setEF(exp.id, { note: v })}
                            style={{ flex: 1, minWidth: 100 }}
                          />
                          <button
                            className="btn-primary"
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                            }}
                            onClick={() => addEntry(exp)}
                            disabled={!ef.amount || !ef.date}
                          >
                            <Plus size={11} /> Submit
                          </button>
                          <button
                            className="btn-ghost"
                            style={{
                              flexShrink: 0,
                              padding: "6px 12px",
                              fontSize: 12,
                            }}
                            onClick={() => toggleExpandExp(exp.id)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bottom: Move + Delete */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <MoveButton expId={exp.id} currentType="onetime" />
                      <button
                        className="btn-danger"
                        aria-label={`Delete ${exp.name}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                        }}
                        onClick={async () => {
                          if (
                            await confirm(
                              "Delete expense?",
                              `Remove "${exp.name}"?`,
                            )
                          )
                            updatePerson(
                              "expenses",
                              expenses.filter((x) => x.id !== exp.id),
                            );
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredOnetimeExps.length > 0 && (
                <div
                  style={{
                    textAlign: "right",
                    paddingTop: 8,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  One-time total:{" "}
                  <span className="red-text">
                    {fmt(
                      filteredOnetimeExps.reduce(
                        (s, x) => s + onetimeEffective(x),
                        0,
                      ),
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Overall total across all expense types */}
          <div
            style={{
              textAlign: "right",
              paddingTop: 6,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            All expenses: <span className="red-text">{fmt(totalExpenses)}</span>
          </div>
        </div>
      )}
      {dialog}
      <SmartPaste
        open={smartPasteOpen}
        onClose={() => setSmartPasteOpen(false)}
        expenses={expenses}
        updatePerson={updatePerson}
        merchantMap={shared?.merchantMap || {}}
        onMerchantMapUpdate={(newMap) => updateShared("merchantMap", newMap)}
      />
    </div>
  );
}

export function HouseholdBudget({ p1, p2, shared }) {
  const { personNames } = useData() || {};
  // ── Month selector ─────────────────────────────────────────────────────
  const _hhNow = new Date();
  const _hhCurYm = `${_hhNow.getFullYear()}-${String(_hhNow.getMonth() + 1).padStart(2, "0")}`;
  const [hhMonth, setHhMonth] = useState(_hhCurYm);
  const hhMonthDate = new Date(hhMonth + "-01");
  const hhMonthLabel = hhMonthDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const hhPrevMonth = () => {
    const d = new Date(hhMonthDate);
    d.setMonth(d.getMonth() - 1);
    setHhMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const hhNextMonth = () => {
    const d = new Date(hhMonthDate);
    d.setMonth(d.getMonth() + 1);
    setHhMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const _hhMonthNum = parseInt(hhMonth.split("-")[1], 10) - 1;

  // ── Recurrence gating helper ───────────────────────────────────────────
  const _hhIsActive = (e) => {
    if (e.recurrence === "yearly" && (e.recurrenceMonth ?? 0) !== _hhMonthNum)
      return false;
    if (e.recurrence === "quarterly") {
      const months = e.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(_hhMonthNum)) return false;
    }
    return true;
  };

  // ── Month-filtered expenses per person ─────────────────────────────────
  const filterPersonExpenses = (data) =>
    (data?.expenses || []).filter((x) => {
      if (x.expenseType === "onetime")
        return (x.date || "").slice(0, 7) === hhMonth;
      if (x.expenseType === "trip")
        return (x.startDate || x.date || "").slice(0, 7) === hhMonth;
      return _hhIsActive(x);
    });

  const p1Filtered = filterPersonExpenses(p1);
  const p2Filtered = filterPersonExpenses(p2);

  const p1Income = (p1?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const p2Income = (p2?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const totalIncome = p1Income + p2Income;

  const sharedTrips = shared?.trips || [];
  const filteredSharedTrips = sharedTrips.filter(
    (t) => (t.startDate || "").slice(0, 7) === hhMonth,
  );
  const sharedTripTotal = filteredSharedTrips.reduce(
    (s, x) => s + (x.amount || 0),
    0,
  );

  const p1Expenses = p1Filtered.reduce(
    (s, x) =>
      s + (x.expenseType === "onetime" ? onetimeEffective(x) : x.amount),
    0,
  );
  const p2Expenses = p2Filtered.reduce(
    (s, x) =>
      s + (x.expenseType === "onetime" ? onetimeEffective(x) : x.amount),
    0,
  );
  const totalExpenses = p1Expenses + p2Expenses + sharedTripTotal;

  const surplus = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;

  // { cat: { total, p1, p2, subs: { sub: { total, p1, p2 } } } }
  const mergeGrouped = (exps, key) =>
    exps.reduce((acc, e) => {
      if (e.expenseType === "trip") {
        // Expand trip items into categories
        for (const item of e.items || []) {
          const cat = item.category || "Others";
          if (!acc[cat]) acc[cat] = { total: 0, p1: 0, p2: 0, subs: {} };
          acc[cat].total += item.amount || 0;
          acc[cat][key] = (acc[cat][key] || 0) + (item.amount || 0);
          const sub = e.name || "";
          if (!acc[cat].subs[sub])
            acc[cat].subs[sub] = { total: 0, p1: 0, p2: 0 };
          acc[cat].subs[sub].total += item.amount || 0;
          acc[cat].subs[sub][key] =
            (acc[cat].subs[sub][key] || 0) + (item.amount || 0);
        }
      } else {
        const cat = e.category;
        const amt =
          e.expenseType === "onetime" ? onetimeEffective(e) : e.amount || 0;
        if (!acc[cat]) acc[cat] = { total: 0, p1: 0, p2: 0, subs: {} };
        acc[cat].total += amt;
        acc[cat][key] = (acc[cat][key] || 0) + amt;
        const sub = e.subCategory || "";
        if (!acc[cat].subs[sub])
          acc[cat].subs[sub] = { total: 0, p1: 0, p2: 0 };
        acc[cat].subs[sub].total += amt;
        acc[cat].subs[sub][key] = (acc[cat].subs[sub][key] || 0) + amt;
      }
      return acc;
    }, {});

  const aGrouped = mergeGrouped(p1Filtered, "p1");
  const anGrouped = mergeGrouped(p2Filtered, "p2");

  // Merge both into a single map for display
  const grouped = {};
  for (const [cat, vals] of Object.entries(aGrouped)) {
    if (!grouped[cat]) grouped[cat] = { total: 0, p1: 0, p2: 0, subs: {} };
    grouped[cat].total += vals.total;
    grouped[cat].p1 += vals.p1 || 0;
    Object.entries(vals.subs).forEach(([sub, sv]) => {
      if (!grouped[cat].subs[sub])
        grouped[cat].subs[sub] = { total: 0, p1: 0, p2: 0 };
      grouped[cat].subs[sub].total += sv.total;
      grouped[cat].subs[sub].p1 += sv.p1 || 0;
    });
  }
  for (const [cat, vals] of Object.entries(anGrouped)) {
    if (!grouped[cat]) grouped[cat] = { total: 0, p1: 0, p2: 0, subs: {} };
    grouped[cat].total += vals.total;
    grouped[cat].p2 += vals.p2 || 0;
    Object.entries(vals.subs).forEach(([sub, sv]) => {
      if (!grouped[cat].subs[sub])
        grouped[cat].subs[sub] = { total: 0, p1: 0, p2: 0 };
      grouped[cat].subs[sub].total += sv.total;
      grouped[cat].subs[sub].p2 += sv.p2 || 0;
    });
  }
  // Merge shared trips into grouped (attribute by addedBy)
  for (const trip of filteredSharedTrips) {
    for (const item of trip.items || []) {
      const cat = item.category || "Others";
      if (!grouped[cat]) grouped[cat] = { total: 0, p1: 0, p2: 0, subs: {} };
      grouped[cat].total += item.amount || 0;
      const personKey = (item.addedBy || "").toLowerCase().includes("p2")
        ? "p2"
        : "p1";
      grouped[cat][personKey] += item.amount || 0;
      const sub = trip.name || "";
      if (!grouped[cat].subs[sub])
        grouped[cat].subs[sub] = { total: 0, p1: 0, p2: 0 };
      grouped[cat].subs[sub].total += item.amount || 0;
      grouped[cat].subs[sub][personKey] += item.amount || 0;
    }
  }

  // Keep flat versions for budget rule section
  const _aCats = Object.fromEntries(
    Object.entries(aGrouped).map(([c, v]) => [c, v.total]),
  );
  const _anCats = Object.fromEntries(
    Object.entries(anGrouped).map(([c, v]) => [c, v.total]),
  );
  const allCats = Object.keys(grouped)
    .filter((cat) => grouped[cat].total > 0)
    .sort((a, b) => grouped[b].total - grouped[a].total);
  // Combined flat map for BudgetRuleSection (includes shared trips)
  const hhExpByCategory = Object.fromEntries(
    Object.entries(grouped).map(([c, v]) => [c, v.total]),
  );

  const [rule, setRule] = useState("50/30/20");

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
          <span style={{ color: "var(--gold)" }}>Household</span> Budget
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-card2)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
          }}
        >
          <button
            className="btn-icon"
            onClick={hhPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            style={{
              minWidth: 120,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {hhMonthLabel}
          </span>
          <button
            className="btn-icon"
            onClick={hhNextMonth}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">
            Combined income
            <InfoModal title="Combined Income">
              {(p1?.incomes || []).map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    fontSize: 12,
                  }}
                >
                  <span>
                    <span style={{ color: "var(--p1)" }}>●</span> {inc.name}
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(inc.amount)}</span>
                </div>
              ))}
              {(p2?.incomes || []).map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    fontSize: 12,
                  }}
                >
                  <span>
                    <span style={{ color: "var(--p2)" }}>●</span> {inc.name}
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(inc.amount)}</span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  marginTop: 6,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  color: "var(--green)",
                }}
              >
                <span>Total</span>
                <span>{fmt(totalIncome)}</span>
              </div>
            </InfoModal>
          </div>
          <div className="metric-value green-text">{fmt(totalIncome)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--p1)" }}>{fmt(p1Income)}</span>
            {" · "}
            <span style={{ color: "var(--p2)" }}>{fmt(p2Income)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Combined expenses
            <InfoModal title="Combined Expenses">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span>
                  <span style={{ color: "var(--p1)" }}>●</span>{" "}
                  {personNames?.p1 || "Person 1"}'s expenses
                </span>
                <span style={{ fontWeight: 600 }}>{fmt(p1Expenses)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span>
                  <span style={{ color: "var(--p2)" }}>●</span>{" "}
                  {personNames?.p2 || "Person 2"}'s expenses
                </span>
                <span style={{ fontWeight: 600 }}>{fmt(p2Expenses)}</span>
              </div>
              {sharedTripTotal > 0 && (
                <>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--green)",
                      marginTop: 8,
                      marginBottom: 4,
                    }}
                  >
                    🤝 Shared Trips
                  </div>
                  {filteredSharedTrips.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "2px 0",
                        fontSize: 12,
                      }}
                    >
                      <span>🤝 {t.name}</span>
                      <span style={{ fontWeight: 600 }}>
                        {fmt(t.amount || 0)}
                      </span>
                    </div>
                  ))}
                </>
              )}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  marginTop: 8,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                <span>Total</span>
                <span>{fmt(totalExpenses)}</span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#777",
                  fontStyle: "italic",
                }}
              >
                Includes all monthly, trip, one-time expenses from both persons
                + shared trips. This is the standing budget total.
              </div>
            </InfoModal>
          </div>
          <div className="metric-value red-text">{fmt(totalExpenses)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--p1)" }}>{fmt(p1Expenses)}</span>
            {" · "}
            <span style={{ color: "var(--p2)" }}>{fmt(p2Expenses)}</span>
            {sharedTripTotal > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--green)" }}>
                  🤝 {fmt(sharedTripTotal)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Surplus · Savings rate</div>
          <div
            className="metric-value"
            style={{
              color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
            }}
          >
            {fmt(surplus)}
          </div>
          <div className="metric-sub">{savingsRate}% of combined income</div>
        </div>
      </div>

      <BudgetRuleSection
        rule={rule}
        setRule={setRule}
        income={totalIncome}
        expByCategory={hhExpByCategory}
        savingsAmt={surplus}
      />

      <div className="card">
        <div className="card-title">Expenses by category</div>
        {allCats.map((cat) => {
          const { total, p1: av, p2: anv, subs } = grouped[cat];
          const subEntries = Object.entries(subs)
            .filter(([k, sv]) => k !== "" && sv.total > 0)
            .sort((a, b) => b[1].total - a[1].total);
          return (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: subEntries.length > 0 ? 600 : 400,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{cat}</span>
                <span style={{ fontWeight: 500 }}>{fmt(total)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "var(--border)",
                  gap: 1,
                }}
              >
                {(av || 0) > 0 && (
                  <div
                    style={{
                      width: `${((av || 0) / totalExpenses) * 100}%`,
                      background: "var(--p1)",
                      borderRadius: "3px 0 0 3px",
                    }}
                  />
                )}
                {(anv || 0) > 0 && (
                  <div
                    style={{
                      width: `${((anv || 0) / totalExpenses) * 100}%`,
                      background: "var(--p2)",
                      borderRadius: (av || 0) > 0 ? "0 3px 3px 0" : 3,
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 3,
                  marginBottom: subEntries.length > 0 ? 6 : 0,
                }}
              >
                {(av || 0) > 0 && (
                  <span>
                    <span style={{ color: "var(--p1)" }}>●</span>{" "}
                    {personNames?.p1 || "Person 1"} {fmt(av || 0)}
                  </span>
                )}
                {(anv || 0) > 0 && (
                  <span>
                    <span style={{ color: "var(--p2)" }}>●</span>{" "}
                    {personNames?.p2 || "Person 2"} {fmt(anv || 0)}
                  </span>
                )}
              </div>
              {subEntries.map(([sub, sv]) => (
                <div
                  key={sub}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingLeft: 14,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    ↳ {sub}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--p1)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {(sv.p1 || 0) > 0 ? fmt(sv.p1) : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--p2)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {(sv.p2 || 0) > 0 ? fmt(sv.p2) : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      minWidth: 70,
                      textAlign: "right",
                    }}
                  >
                    {fmt(sv.total)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
