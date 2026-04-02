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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Admin emails — must match Feedback.jsx
const ADMIN_EMAILS = ["abhav.aanya@gmail.com"];

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
    ],
  },
];

// Flat list for mobile topbar lookup
const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);

// Bottom tab bar items (mobile)
const BOTTOM_TABS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "budget", icon: Wallet, label: "Budget" },
  { id: "investments", icon: TrendingUp, label: "Invest" },
  { id: "goals", icon: Target, label: "Goals" },
  { id: "__more", icon: MoreHorizontal, label: "More" },
];

// Items shown in "More" sheet
const MORE_ITEMS = [
  { id: "cashflow", icon: Activity, label: "Cash Flow" },
  { id: "networth", icon: TrendingDown, label: "Net Worth" },
  { id: "debts", icon: CreditCard, label: "Debts & EMIs" },
  { id: "insurance", icon: Shield, label: "Insurance" },
  { id: "subscriptions", icon: RefreshCw, label: "Subscriptions" },
  { id: "alerts", icon: Bell, label: "Alerts" },
  { id: "tax", icon: Calculator, label: "Tax Planner" },
  { id: "settings", icon: Settings, label: "Settings" },
];

const PROFILES = [
  {
    id: "abhav",
    color: "var(--abhav)",
    dim: "var(--abhav-dim)",
  },
  {
    id: "aanya",
    color: "var(--aanya)",
    dim: "var(--aanya-dim)",
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
}) {
  const profiles = PROFILES.map((p) => ({
    ...p,
    label: p.label || personNames?.[p.id] || p.id,
  }));
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
}) {
  const { logout, user } = useAuth();
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreSheetRef = useRef(null);

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

  const profiles = PROFILES.map((p) => ({
    ...p,
    label: p.label || personNames?.[p.id] || p.id,
  }));

  // Is current page one of the primary bottom tabs?
  const isBottomTabPage = BOTTOM_TABS.some(
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
        {BOTTOM_TABS.map(({ id, icon: Icon, label }) => {
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
                } else {
                  setPage(id);
                  setMoreOpen(false);
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
        <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)}>
          <div
            ref={moreSheetRef}
            className="mobile-more-sheet"
            role="dialog"
            aria-label="More navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-more-handle" />
            <div className="mobile-more-grid">
              {MORE_ITEMS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`mobile-more-item${page === id ? " active" : ""}`}
                  onClick={() => {
                    setPage(id);
                    setMoreOpen(false);
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
        />
      </aside>
    </>
  );
}
