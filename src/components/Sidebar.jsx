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
const ADMIN_EMAILS = ["abhavsaxena10@gmail.com"];

const NAV = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "budget", icon: Wallet, label: "Budget" },
  { id: "investments", icon: TrendingUp, label: "Investments" },
  { id: "goals", icon: Target, label: "Goals" },
  { id: "networth", icon: TrendingDown, label: "Net Worth" },
  { id: "debts", icon: CreditCard, label: "Debts & EMIs" },
  { id: "cashflow", icon: Activity, label: "Cash Flow" },
  { id: "insurance", icon: Shield, label: "Insurance" },
  { id: "subscriptions", icon: RefreshCw, label: "Subscriptions" },
  { id: "alerts", icon: Bell, label: "Budget Alerts" },
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

      <div
        style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            marginBottom: 6,
            paddingLeft: 4,
          }}
        >
          Viewing
        </div>
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setProfile(p.id);
              onClose?.();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 2,
              background: profile === p.id ? p.dim : "transparent",
              color: profile === p.id ? p.color : "var(--text-secondary)",
              border:
                profile === p.id
                  ? `1px solid ${p.color}33`
                  : "1px solid transparent",
              fontWeight: profile === p.id ? 500 : 400,
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `${p.color}22`,
                border: `1px solid ${p.color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
                color: p.color,
                flexShrink: 0,
              }}
            >
              {p.label[0]}
            </div>
            {p.label}
            {profile === p.id && (
              <span
                style={{
                  marginLeft: "auto",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: p.color,
                }}
              />
            )}
          </button>
        ))}
      </div>

      <nav style={{ flex: 1, padding: "0.5rem 0.75rem", overflowY: "auto" }}>
        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => {
              setPage(id);
              onClose?.();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 2,
              background: page === id ? "var(--gold-dim)" : "transparent",
              color: page === id ? "var(--gold)" : "var(--text-secondary)",
              border:
                page === id
                  ? "1px solid var(--gold-border)"
                  : "1px solid transparent",
              fontWeight: page === id ? 500 : 400,
              fontSize: 13,
            }}
          >
            <Icon size={14} />
            {label}{" "}
            {badges?.[id] > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "var(--red)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                }}
              >
                {badges[id]}
              </span>
            )}{" "}
          </button>
        ))}

        {/* Admin-only: Feedback management */}
        {isAdmin && (
          <button
            onClick={() => {
              setPage("feedback");
              onClose?.();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 2,
              marginTop: 8,
              background:
                page === "feedback" ? "var(--gold-dim)" : "transparent",
              color:
                page === "feedback" ? "var(--gold)" : "var(--text-secondary)",
              border:
                page === "feedback"
                  ? "1px solid var(--gold-border)"
                  : "1px solid transparent",
              fontWeight: page === "feedback" ? 500 : 400,
              fontSize: 13,
            }}
          >
            <MessageSquare size={14} />
            Feedback Admin
            {badges?.feedback > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "var(--red)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                }}
              >
                {badges.feedback}
              </span>
            )}
          </button>
        )}
      </nav>

      <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
        <button
          className="btn-ghost"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            padding: "7px",
          }}
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
            {NAV.find((n) => n.id === page)?.label || "WealthOS"}
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
