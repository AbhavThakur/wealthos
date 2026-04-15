import { useState, useEffect, useRef, useMemo } from "react";
import { Search, ArrowRight } from "lucide-react";

const PAGES = [
  { id: "dashboard", label: "Dashboard", keywords: "home pulse overview" },
  { id: "budget", label: "Budget", keywords: "expenses income spending" },
  {
    id: "investments",
    label: "Investments",
    keywords: "sip mutual fund stock",
  },
  { id: "goals", label: "Goals", keywords: "target savings dream" },
  { id: "networth", label: "Net Worth", keywords: "assets liabilities wealth" },
  { id: "debts", label: "Debts & EMIs", keywords: "loan emi mortgage" },
  { id: "cashflow", label: "Cash Flow", keywords: "transactions money flow" },
  { id: "insurance", label: "Insurance", keywords: "policy health life term" },
  {
    id: "subscriptions",
    label: "Subscriptions",
    keywords: "ott netflix streaming",
  },
  { id: "alerts", label: "Budget Alerts", keywords: "limit warning spending" },
  {
    id: "tax",
    label: "Tax Planner",
    keywords: "80c deduction hra old new regime",
  },
  { id: "settings", label: "Settings", keywords: "profile pin export backup" },
];

function buildIndex(p1, p2, shared, personNames) {
  const items = [];
  const addPerson = (data, name, key) => {
    for (const exp of data?.expenses || []) {
      items.push({
        type: "expense",
        label: exp.name,
        detail: `${name} · ${exp.category || ""}`,
        page: "budget",
        profile: key,
      });
    }
    for (const inc of data?.incomes || []) {
      items.push({
        type: "income",
        label: inc.name,
        detail: `${name} · ${inc.type || ""}`,
        page: "budget",
        profile: key,
      });
    }
    for (const inv of data?.investments || []) {
      items.push({
        type: "investment",
        label: inv.name,
        detail: `${name} · ${inv.type || inv.frequency || ""}`,
        page: "investments",
        profile: key,
      });
    }
    for (const sub of data?.subscriptions || []) {
      items.push({
        type: "subscription",
        label: sub.name,
        detail: `${name} · ${sub.category || ""}`,
        page: "subscriptions",
        profile: key,
      });
    }
    for (const g of data?.goals || []) {
      items.push({
        type: "goal",
        label: g.name,
        detail: `${name} · Personal goal`,
        page: "goals",
        profile: key,
      });
    }
    for (const d of data?.debts || []) {
      items.push({
        type: "debt",
        label: d.name,
        detail: `${name} · EMI ₹${d.emi}`,
        page: "debts",
        profile: key,
      });
    }
  };
  addPerson(p1, personNames?.p1 || "Person 1", "p1");
  addPerson(p2, personNames?.p2 || "Person 2", "p2");

  for (const g of shared?.goals || []) {
    items.push({
      type: "goal",
      label: g.name,
      detail: "Shared household goal",
      page: "goals",
      profile: "household",
    });
  }
  return items;
}

export default function SearchPalette({
  p1,
  p2,
  shared,
  personNames,
  setPage,
  setProfile,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const dataItems = useMemo(
    () => buildIndex(p1, p2, shared, personNames),
    [p1, p2, shared, personNames],
  );

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return PAGES.slice(0, 6);
    const matched = [];

    for (const p of PAGES) {
      if (p.label.toLowerCase().includes(q) || p.keywords.includes(q)) {
        matched.push({ ...p, isPage: true });
      }
    }

    for (const item of dataItems) {
      if (
        item.label.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
      ) {
        matched.push(item);
      }
    }
    return matched.slice(0, 12);
  }, [query, dataItems]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((p) => {
          if (!p) {
            setQuery("");
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
          return !p;
        });
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const navigate = (r) => {
    if (r.isPage) {
      setPage(r.id);
    } else {
      setPage(r.page);
      if (r.profile) setProfile(r.profile);
    }
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      navigate(results[selectedIdx]);
    }
  };

  if (!open) return null;

  const TYPE_EMOJI = {
    expense: "💸",
    income: "💰",
    investment: "📈",
    subscription: "🔄",
    goal: "🎯",
    debt: "💳",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "min(20vh, 120px)",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 16px)",
          width: "100%",
          maxWidth: 520,
          margin: "0 16px",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Search
            size={18}
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, expenses, investments..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 15,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-card2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: 340, overflowY: "auto", padding: "6px 0" }}
        >
          {results.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No results found
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.label}-${r.detail || r.id}-${i}`}
              onClick={() => navigate(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background:
                  i === selectedIdx ? "rgba(201,168,76,0.1)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                {r.isPage ? "📄" : TYPE_EMOJI[r.type] || "📋"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.label}
                </div>
                {r.detail && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.detail}
                  </div>
                )}
              </div>
              {i === selectedIdx && (
                <ArrowRight
                  size={14}
                  style={{ color: "var(--gold)", flexShrink: 0 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "8px 16px",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>esc Close</span>
        </div>
      </div>
    </div>
  );
}
