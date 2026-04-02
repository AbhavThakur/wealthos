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
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Focus trap + Escape key for mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => {
      drawerRef.current?.querySelector("button")?.focus();
    });
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          className="btn-icon"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          style={{ padding: 8 }}
        >
          <Menu size={20} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                profile === "abhav"
                  ? "var(--abhav)"
                  : profile === "aanya"
                    ? "var(--aanya)"
                    : "var(--gold)",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {NAV_FLAT.find((n) => n.id === page)?.label || "WealthOS"}
          </div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background:
              profile === "abhav"
                ? "var(--abhav-dim)"
                : profile === "aanya"
                  ? "var(--aanya-dim)"
                  : "var(--gold-dim)",
            border: `1px solid ${
              profile === "abhav"
                ? "var(--abhav)"
                : profile === "aanya"
                  ? "var(--aanya)"
                  : "var(--gold)"
            }44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color:
              profile === "abhav"
                ? "var(--abhav)"
                : profile === "aanya"
                  ? "var(--aanya)"
                  : "var(--gold)",
            flexShrink: 0,
          }}
          onClick={() => setMobileOpen(true)}
        >
          {profile === "household"
            ? "H"
            : (personNames?.[profile] || profile)[0].toUpperCase()}
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="mobile-drawer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setMobileOpen(false)}
          />
          <div ref={drawerRef} className="mobile-drawer-panel">
            <SidebarContent
              page={page}
              setPage={setPage}
              profile={profile}
              setProfile={setProfile}
              logout={logout}
              onClose={() => setMobileOpen(false)}
              badges={badges}
              personNames={personNames}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
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
