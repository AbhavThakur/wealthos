import { useState, useEffect, useRef } from "react";
import {
  IndianRupee,
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  CreditCard,
  Activity,
  Calculator,
  Settings,
  LogOut,
  TrendingDown,
  Bell,
  Menu,
  X,
  Shield,
  RefreshCw,
  MessageSquare,
  MoreHorizontal,
  ArrowLeftRight,
  Plus,
  BarChart2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ADMIN_EMAILS from "../utils/adminEmails";

const NAV_GROUPS = [
  {
    items: [{ id: "dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Money",
    items: [
      { id: "budget", icon: Wallet, label: "Budget" },
      { id: "cashflow", icon: Activity, label: "Cash Flow" },
    ],
  },
  {
    label: "Wealth",
    items: [
      { id: "investments", icon: TrendingUp, label: "Investments" },
      { id: "networth", icon: TrendingDown, label: "Net Worth" },
      { id: "goals", icon: Target, label: "Goals" },
    ],
  },
  {
    label: "Commitments",
    items: [
      { id: "debts", icon: CreditCard, label: "Debts & EMIs" },
      { id: "insurance", icon: Shield, label: "Insurance" },
      { id: "subscriptions", icon: RefreshCw, label: "Subscriptions" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "alerts", icon: Bell, label: "Alerts" },
      { id: "tax", icon: Calculator, label: "Tax Planner" },
      { id: "advisor", icon: MessageSquare, label: "AI Advisor" },
      { id: "marketpulse", icon: BarChart2, label: "Market Pulse" },
    ],
  },
];

// Flat list for mobile topbar lookup
const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);

// All nav items with their icons (for bottom bar + more sheet)
const ALL_NAV_ITEMS = {
  dashboard: { icon: LayoutDashboard, label: "Home" },
  budget: { icon: Wallet, label: "Budget" },
  investments: { icon: TrendingUp, label: "Invest" },
  goals: { icon: Target, label: "Goals" },
  cashflow: { icon: Activity, label: "Cash Flow" },
  networth: { icon: TrendingDown, label: "Net Worth" },
  debts: { icon: CreditCard, label: "Debts & EMIs" },
  insurance: { icon: Shield, label: "Insurance" },
  subscriptions: { icon: RefreshCw, label: "Subscriptions" },
  alerts: { icon: Bell, label: "Alerts" },
  tax: { icon: Calculator, label: "Tax Planner" },
  advisor: { icon: MessageSquare, label: "AI" },
  marketpulse: { icon: BarChart2, label: "Markets" },
  settings: { icon: Settings, label: "Settings" },
};

// Fixed tabs: Dashboard (slot 0) and More (slot 3) can't be changed
// Customizable: slots 1-2 default to budget, goals
const DEFAULT_CUSTOM_TABS = ["budget", "goals"];
const LS_KEY = "wealthos-bottom-tabs";

function getCustomTabs() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    if (
      Array.isArray(stored) &&
      stored.length === 2 &&
      stored.every((id) => ALL_NAV_ITEMS[id])
    ) {
      return stored;
    }
  } catch {
    /* ignore corrupt localStorage */
  }
  return DEFAULT_CUSTOM_TABS;
}

function buildBottomTabs(customIds) {
  return [
    { id: "dashboard", ...ALL_NAV_ITEMS.dashboard },
    ...customIds.map((id) => ({ id, ...ALL_NAV_ITEMS[id] })),
    { id: "__more", icon: MoreHorizontal, label: "More" },
  ];
}

function buildMoreItems(customIds) {
  const inBar = new Set(["dashboard", ...customIds]);
  return Object.entries(ALL_NAV_ITEMS)
    .filter(([id]) => !inBar.has(id))
    .map(([id, item]) => ({ id, ...item }));
}

const PROFILES = [
  {
    id: "p1",
    color: "var(--p1)",
    dim: "var(--p1-dim)",
  },
  {
    id: "p2",
    color: "var(--p2)",
    dim: "var(--p2-dim)",
  },
  {
    id: "household",
    label: "Household",
    color: "var(--gold)",
    dim: "var(--gold-dim)",
  },
];

function SidebarContent({
  page,
  setPage,
  profile,
  setProfile,
  logout,
  onClose,
  badges,
  personNames,
  isAdmin,
  isSolo,
}) {
  const allProfiles = PROFILES.map((p) => ({
    ...p,
    label: p.label || personNames?.[p.id] || p.id,
  }));
  const profiles = isSolo
    ? allProfiles.filter((p) => p.id === "p1")
    : allProfiles;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "1.25rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--gold-dim)",
              border: "1px solid var(--gold-border)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IndianRupee size={15} color="var(--gold)" />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
            WealthOS
          </div>
        </div>
        {onClose && (
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Mobile-only: compact profile switcher inside drawer */}
      <div className="sidebar-profile-mobile">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setProfile(p.id);
              onClose?.();
            }}
            className={`profile-pill${profile === p.id ? " active" : ""}`}
            style={{
              "--pill-color": p.color,
              "--pill-dim": p.dim,
              flex: 1,
            }}
          >
            <span className="profile-pill-dot" />
            {p.label}
          </button>
        ))}
      </div>

      <nav style={{ flex: 1, padding: "0.5rem 0.75rem", overflowY: "auto" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "nav-group" : undefined}>
            {group.label && (
              <div className="nav-group-label">{group.label}</div>
            )}
            {group.items.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  setPage(id);
                  onClose?.();
                }}
                className={`nav-item${page === id ? " active" : ""}`}
              >
                <Icon size={14} />
                {label}
                {badges?.[id] > 0 && (
                  <span className="nav-badge">{badges[id]}</span>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Admin-only: Feedback management */}
        {isAdmin && (
          <div className="nav-group">
            <div className="nav-group-label">Admin</div>
            <button
              onClick={() => {
                setPage("feedback");
                onClose?.();
              }}
              className={`nav-item${page === "feedback" ? " active" : ""}`}
            >
              <MessageSquare size={14} />
              Feedback
              {badges?.feedback > 0 && (
                <span className="nav-badge">{badges.feedback}</span>
              )}
            </button>
          </div>
        )}
      </nav>

      <div className="nav-footer">
        <button
          onClick={() => {
            setPage("settings");
            onClose?.();
          }}
          className={`nav-item${page === "settings" ? " active" : ""}`}
        >
          <Settings size={14} />
          Settings
        </button>
        <button
          className="nav-item"
          style={{ color: "var(--text-muted)" }}
          onClick={logout}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  page,
  setPage,
  profile,
  setProfile,
  badges,
  personNames,
  isSolo,
  onQuickAdd,
}) {
  const { logout, user } = useAuth();
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
  const [moreOpen, setMoreOpen] = useState(false);
  const [swapSlot, setSwapSlot] = useState(null); // which slot (1-3) is being swapped
  const moreSheetRef = useRef(null);

  // Customizable bottom tabs (slots 1-3)
  const [customTabs, setCustomTabs] = useState(getCustomTabs);

  const bottomTabs = buildBottomTabs(customTabs);
  const moreItems = buildMoreItems(customTabs);

  function handleSwap(moreItemId) {
    if (swapSlot === null) return;
    const next = [...customTabs];
    next[swapSlot - 1] = moreItemId;
    setCustomTabs(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSwapSlot(null);
    // Haptic feedback on swap
    if (navigator.vibrate) navigator.vibrate(30);
  }

  // Lock body scroll when More sheet is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  // Close More sheet on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [moreOpen]);

  const allMobileProfiles = PROFILES.map((p) => ({
    ...p,
    label: p.label || personNames?.[p.id] || p.id,
  }));
  const profiles = isSolo
    ? allMobileProfiles.filter((p) => p.id === "p1")
    : allMobileProfiles;

  // Is current page one of the primary bottom tabs?
  const isBottomTabPage = bottomTabs.some(
    (t) => t.id !== "__more" && t.id === page,
  );

  return (
    <>
      {/* ── Mobile top bar: profile pills + page title ── */}
      <div className="mobile-topbar">
        <div
          className="mobile-topbar-profiles"
          role="radiogroup"
          aria-label="Profile switcher"
        >
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              role="radio"
              aria-checked={profile === p.id}
              className={`mobile-profile-chip${profile === p.id ? " active" : ""}`}
              style={{ "--chip-color": p.color, "--chip-dim": p.dim }}
            >
              <span className="mobile-profile-chip-dot" />
              {p.label}
            </button>
          ))}
        </div>
        <div className="mobile-topbar-title">
          {NAV_FLAT.find((n) => n.id === page)?.label || "WealthOS"}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {/* Left side: Dashboard + Custom1 */}
        {bottomTabs.slice(0, 2).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`mobile-bottom-tab${page === id ? " active" : ""}`}
            aria-current={page === id ? "page" : undefined}
            onClick={() => {
              setPage(id);
              setMoreOpen(false);
              setSwapSlot(null);
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}

        {/* Center FAB with wave notch */}
        <div className="mobile-fab-wrapper">
          <svg
            className="mobile-fab-notch"
            viewBox="0 0 80 40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M0,40 C12,40 18,40 24,28 C30,14 34,4 40,4 C46,4 50,14 56,28 C62,40 68,40 80,40 Z" />
          </svg>
          <button
            className="mobile-fab"
            onClick={onQuickAdd}
            aria-label="Add expense"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Right side: Custom2 + More */}
        {bottomTabs.slice(2).map(({ id, icon: Icon, label }) => {
          const isMore = id === "__more";
          const active = isMore
            ? moreOpen || (!isBottomTabPage && !moreOpen)
            : page === id;
          return (
            <button
              key={id}
              className={`mobile-bottom-tab${active ? " active" : ""}`}
              aria-current={!isMore && active ? "page" : undefined}
              onClick={() => {
                if (isMore) {
                  setMoreOpen((v) => !v);
                  setSwapSlot(null);
                } else {
                  setPage(id);
                  setMoreOpen(false);
                  setSwapSlot(null);
                }
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <div
          className="mobile-more-overlay"
          onClick={() => {
            setMoreOpen(false);
            setSwapSlot(null);
          }}
        >
          <div
            ref={moreSheetRef}
            className="mobile-more-sheet"
            role="dialog"
            aria-label="More navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-more-handle" />

            {/* Swap mode banner */}
            {swapSlot !== null && (
              <div className="mobile-more-swap-banner">
                <ArrowLeftRight size={14} />
                <span>
                  Tap a section to swap with{" "}
                  <strong>
                    {ALL_NAV_ITEMS[customTabs[swapSlot - 1]]?.label}
                  </strong>
                </span>
                <button
                  className="mobile-more-swap-cancel"
                  onClick={() => setSwapSlot(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Customization hint + current bar preview */}
            {swapSlot === null && (
              <div className="mobile-more-customize">
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Tap <ArrowLeftRight size={11} style={{ verticalAlign: -1 }} />{" "}
                  on a tab to swap it here
                </span>
                <div className="mobile-more-bar-preview">
                  {customTabs.map((tabId, i) => {
                    const item = ALL_NAV_ITEMS[tabId];
                    if (!item) return null;
                    const TabIcon = item.icon;
                    return (
                      <button
                        key={tabId}
                        className="mobile-more-bar-item"
                        onClick={() => setSwapSlot(i + 1)}
                        title={`Swap "${item.label}" with another section`}
                      >
                        <TabIcon size={16} />
                        <span>{item.label}</span>
                        <ArrowLeftRight size={10} className="swap-icon" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mobile-more-grid">
              {moreItems.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`mobile-more-item${page === id && swapSlot === null ? " active" : ""}${swapSlot !== null ? " swap-target" : ""}`}
                  onClick={() => {
                    if (swapSlot !== null) {
                      handleSwap(id);
                    } else {
                      setPage(id);
                      setMoreOpen(false);
                    }
                  }}
                >
                  <div className="mobile-more-icon">
                    <Icon size={20} />
                  </div>
                  <span>{label}</span>
                  {badges?.[id] > 0 && (
                    <span className="nav-badge">{badges[id]}</span>
                  )}
                </button>
              ))}
              {isAdmin && (
                <button
                  className={`mobile-more-item${page === "feedback" ? " active" : ""}`}
                  onClick={() => {
                    setPage("feedback");
                    setMoreOpen(false);
                  }}
                >
                  <div className="mobile-more-icon">
                    <MessageSquare size={20} />
                  </div>
                  <span>Feedback</span>
                  {badges?.feedback > 0 && (
                    <span className="nav-badge">{badges.feedback}</span>
                  )}
                </button>
              )}
            </div>
            <button
              className="mobile-more-signout"
              onClick={() => {
                setMoreOpen(false);
                logout();
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar (unchanged) ── */}
      <aside className="desktop-sidebar">
        <SidebarContent
          page={page}
          setPage={setPage}
          profile={profile}
          setProfile={setProfile}
          logout={logout}
          badges={badges}
          personNames={personNames}
          isAdmin={isAdmin}
          isSolo={isSolo}
        />
      </aside>
    </>
  );
}
