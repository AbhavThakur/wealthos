import { useState, useEffect, lazy, Suspense, Component } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData, DemoDataProvider } from "./context/DataContext";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import { exportAllData } from "./utils/exportData";
import Onboarding from "./pages/Onboarding";
import PinLockScreen from "./components/PinLockScreen";
import QuickAdd from "./components/QuickAdd";
import SearchPalette from "./components/SearchPalette";
import OnboardingTour from "./components/OnboardingTour";
import { checkReminders } from "./utils/notifications";
import InstallBanner from "./components/InstallBanner";
import UpdateBanner from "./components/UpdateBanner";
import useIdleTimer from "./hooks/useIdleTimer";
import usePullToRefresh from "./hooks/usePullToRefresh";
import AIAdvisor from "./components/AIAdvisor";
import { FeedbackButton, FeedbackAdmin } from "./components/Feedback";
import NotificationBell from "./components/NotificationBell";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import ADMIN_EMAILS from "./utils/adminEmails";

// ── Error boundary to catch runtime crashes ─────────────────────────────────
class PageErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "var(--red)" }}>
          <h3>Something went wrong</h3>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              marginTop: 8,
              color: "var(--text-secondary)",
            }}
          >
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
          <button
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy-loaded page components (route-level code splitting) ────────────────
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Budget = lazy(() =>
  import("./pages/Budget").then((m) => ({ default: m.default })),
);
const HouseholdBudget = lazy(() =>
  import("./pages/Budget").then((m) => ({ default: m.HouseholdBudget })),
);
const Investments = lazy(() => import("./pages/Investments"));
const HouseholdInvestments = lazy(() =>
  import("./pages/Investments").then((m) => ({
    default: m.HouseholdInvestments,
  })),
);
const Goals = lazy(() => import("./pages/Goals"));
const NetWorth = lazy(() => import("./pages/NetWorth"));
const AIAdvisorPage = lazy(() => import("./pages/AIAdvisorPage"));
const BudgetAlerts = lazy(() =>
  import("./pages/Recurring").then((m) => ({ default: m.BudgetAlerts })),
);
const Debts = lazy(() =>
  import("./pages/OtherPages").then((m) => ({ default: m.Debts })),
);
const TaxPlanner = lazy(() =>
  import("./pages/OtherPages").then((m) => ({ default: m.TaxPlanner })),
);
const Settings = lazy(() =>
  import("./pages/OtherPages").then((m) => ({ default: m.Settings })),
);
const HouseholdDebts = lazy(() =>
  import("./pages/OtherPages").then((m) => ({ default: m.HouseholdDebts })),
);
const CashFlow = lazy(() =>
  import("./pages/OtherPages").then((m) => ({ default: m.CashFlow })),
);
const HouseholdCashFlow = lazy(() =>
  import("./pages/OtherPages").then((m) => ({
    default: m.HouseholdCashFlow,
  })),
);
const Insurance = lazy(() =>
  import("./pages/MorePages").then((m) => ({ default: m.Insurance })),
);
const HouseholdInsurance = lazy(() =>
  import("./pages/MorePages").then((m) => ({
    default: m.HouseholdInsurance,
  })),
);
const Subscriptions = lazy(() =>
  import("./pages/MorePages").then((m) => ({ default: m.Subscriptions })),
);
const HouseholdSubscriptions = lazy(() =>
  import("./pages/MorePages").then((m) => ({
    default: m.HouseholdSubscriptions,
  })),
);

const PAGE_TITLES = {
  dashboard: "Dashboard",
  budget: "Budget",
  investments: "Investments",
  goals: "Goals",
  networth: "Net Worth",
  advisor: "AI Advisor",
  debts: "Debts & EMIs",
  cashflow: "Cash Flow",
  insurance: "Insurance",
  subscriptions: "Subscriptions",
  alerts: "Budget Alerts",
  tax: "Tax Planner",
  settings: "Settings",
  feedback: "Feedback Admin",
};

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="loading-pulse"
          style={{
            width: 48,
            height: 48,
            background: "var(--gold-dim)",
            border: "1px solid var(--gold-border)",
            borderRadius: 12,
            margin: "0 auto 1rem",
          }}
        />
        <div
          className="skeleton"
          style={{ width: 100, height: 20, margin: "0 auto 8px" }}
        />
        <div
          className="skeleton"
          style={{ width: 140, height: 12, margin: "0 auto" }}
        />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const online = useOnlineStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      {(!online || slow) && (
        <div
          style={{
            background: online ? "var(--gold-dim)" : "var(--red-dim, #3a2020)",
            border: `1px solid ${online ? "var(--gold-border)" : "var(--red, #e55)"}`,
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14 }}>
            {!online
              ? "📡 You're offline. Cached data will load if available."
              : "⏳ Loading is taking longer than usual. Your connection may be slow."}
          </span>
          <button
            className="btn-ghost"
            onClick={() => window.location.reload()}
            style={{ fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}
          >
            Retry
          </button>
        </div>
      )}
      <div
        className="skeleton"
        style={{ width: 200, height: 28, marginBottom: 8 }}
      />
      <div
        className="skeleton"
        style={{ width: 280, height: 14, marginBottom: "1.5rem" }}
      />
      <div className="grid-4 section-gap">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 80, borderRadius: "var(--radius)" }}
          />
        ))}
      </div>
      <div className="grid-2 section-gap">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 200, borderRadius: "var(--radius-lg)" }}
          />
        ))}
      </div>
      <div
        className="skeleton"
        style={{
          height: 120,
          borderRadius: "var(--radius-lg)",
          marginTop: "1.25rem",
        }}
      />
    </div>
  );
}

function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let timer;
    const onOnline = () => {
      setShowReconnected(true);
      timer = setTimeout(() => setShowReconnected(false), 3000);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
      style={{
        background: online ? "#1a3a1a" : "#3a2020",
        border: `1px solid ${online ? "#4a4" : "#e55"}`,
        borderRadius: "var(--radius)",
        padding: "8px 16px",
        margin: "0 0 8px 0",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: online ? "#8f8" : "#faa",
        transition: "all 0.3s ease",
      }}
    >
      <span>
        {online
          ? "✓ Back online — changes will sync"
          : "📡 You're offline — changes will sync when reconnected"}
      </span>
    </div>
  );
}

function App() {
  const { user } = useAuth();
  if (user === undefined) return <LoadingScreen />;
  if (!user) return <Login />;
  if (user.isDemo) {
    return (
      <DemoDataProvider>
        <AppInner />
      </DemoDataProvider>
    );
  }
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}

function AppInner() {
  const {
    abhav,
    aanya,
    shared,
    loading,
    needsOnboarding,
    personNames,
    updatePerson,
    updateShared,
    takeSnapshot,
    resetData,
    listBackups,
    restoreBackup,
    createManualBackup,
    seedDevFromProd,
    pushDevToProd,
    isDemo,
  } = useData();
  const { user, logout } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("page");
    return p && PAGE_TITLES[p] ? p : "dashboard";
  });
  const [profile, setProfile] = useState("household");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // ── PIN Lock (disabled in demo mode) ──────────────────────────────────
  const pinEnabled = !isDemo && shared?.pinEnabled !== false;
  const hasPin = pinEnabled && !!shared?.pin;
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    if (!pinEnabled || !shared?.pin) return "open";
    return sessionStorage.getItem("wealthos_unlocked") || null;
  });
  useIdleTimer(
    () => {
      setPinUnlocked(null);
      sessionStorage.removeItem("wealthos_unlocked");
      sessionStorage.removeItem("wealthos_unlock_ts");
    },
    5 * 60 * 1000,
    !!pinUnlocked && hasPin,
  );
  // Sync: if pin removed or feature disabled, auto-unlock; if pin loaded, lock unless session exists
  if (!hasPin && pinUnlocked !== "open") {
    setPinUnlocked("open");
  } else if (
    hasPin &&
    pinUnlocked === "open" &&
    !sessionStorage.getItem("wealthos_unlocked")
  ) {
    setPinUnlocked(null);
  }

  // ── Pull-to-refresh (reload current page data) ──────────────────────────
  const {
    pullDistance,
    refreshing,
    handlers: pullHandlers,
  } = usePullToRefresh(() => window.location.reload());

  useEffect(() => {
    document.title = `${PAGE_TITLES[page] || "WealthOS"} — WealthOS`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  // Fire push-notification reminders once data is ready
  useEffect(() => {
    if (!loading && abhav && aanya && shared) {
      checkReminders(abhav, aanya, shared, personNames);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !abhav || !aanya) return <LoadingSkeleton />;

  if (needsOnboarding) return <Onboarding />;

  const isHousehold = profile === "household";
  const personName =
    profile === "abhav"
      ? personNames.abhav
      : profile === "aanya"
        ? personNames.aanya
        : "Household";
  const personColor =
    profile === "abhav"
      ? "var(--abhav)"
      : profile === "aanya"
        ? "var(--aanya)"
        : "var(--gold)";
  const data = isHousehold ? null : profile === "abhav" ? abhav : aanya;
  const personKey = isHousehold ? null : profile;
  const upd = (k, v) => {
    if (personKey) updatePerson(personKey, k, v);
  };

  const both = (Component, extraProps = {}) =>
    isHousehold ? (
      <div className="grid-2" style={{ gap: "1.5rem" }}>
        <Component
          data={abhav}
          personName={personNames.abhav}
          personColor="var(--abhav)"
          updatePerson={(k, v) => updatePerson("abhav", k, v)}
          {...extraProps}
        />
        <Component
          data={aanya}
          personName={personNames.aanya}
          personColor="var(--aanya)"
          updatePerson={(k, v) => updatePerson("aanya", k, v)}
          {...extraProps}
        />
      </div>
    ) : (
      <Component
        data={data}
        personName={personName}
        personColor={personColor}
        updatePerson={upd}
        {...extraProps}
      />
    );

  const pageEl = (() => {
    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            abhav={abhav}
            aanya={aanya}
            shared={shared}
            personNames={personNames}
          />
        );
      case "budget":
        return isHousehold ? (
          <HouseholdBudget abhav={abhav} aanya={aanya} shared={shared} />
        ) : (
          both(Budget, { shared, updateShared })
        );
      case "investments":
        return isHousehold ? (
          <HouseholdInvestments
            abhav={abhav}
            aanya={aanya}
            updatePerson={updatePerson}
          />
        ) : (
          both(Investments)
        );
      case "goals":
        return (
          <Goals
            data={isHousehold ? null : data}
            sharedData={shared}
            personName={personName}
            personColor={personColor}
            updatePerson={upd}
            updateShared={updateShared}
            isHousehold={isHousehold}
            personNames={personNames}
          />
        );
      case "networth":
        return (
          <NetWorth
            abhav={abhav}
            aanya={aanya}
            shared={shared}
            updatePerson={updatePerson}
            updateShared={updateShared}
            takeSnapshot={takeSnapshot}
            profile={profile}
            personNames={personNames}
          />
        );
      case "debts":
        return isHousehold ? (
          <HouseholdDebts
            abhav={abhav}
            aanya={aanya}
            updatePerson={updatePerson}
          />
        ) : (
          both(Debts)
        );
      case "cashflow":
        return isHousehold ? (
          <HouseholdCashFlow
            abhav={abhav}
            aanya={aanya}
            updatePerson={updatePerson}
          />
        ) : (
          both(CashFlow)
        );
      case "alerts":
        return both(BudgetAlerts);
      case "tax":
        return both(TaxPlanner);
      case "insurance":
        return isHousehold ? (
          <HouseholdInsurance
            abhav={abhav}
            aanya={aanya}
            updatePerson={updatePerson}
          />
        ) : (
          both(Insurance)
        );
      case "subscriptions":
        return isHousehold ? (
          <HouseholdSubscriptions
            abhav={abhav}
            aanya={aanya}
            updatePerson={updatePerson}
          />
        ) : (
          both(Subscriptions)
        );
      case "settings":
        return (
          <Settings
            sharedData={shared}
            updateShared={updateShared}
            updatePerson={isAdmin ? updatePerson : null}
            logout={logout}
            resetData={resetData}
            listBackups={isAdmin ? listBackups : null}
            restoreBackup={isAdmin ? restoreBackup : null}
            createManualBackup={isAdmin ? createManualBackup : null}
            seedDevFromProd={isAdmin ? seedDevFromProd : null}
            pushDevToProd={isAdmin ? pushDevToProd : null}
            onExport={() => exportAllData(abhav, aanya, shared, personNames)}
            isAdmin={isAdmin}
          />
        );
      case "advisor":
        return (
          <AIAdvisorPage
            abhav={abhav}
            aanya={aanya}
            shared={shared}
            profile={profile}
          />
        );
      case "feedback":
        return <FeedbackAdmin />;
      default:
        return null;
    }
  })();

  // ── Badge counts for sidebar notifications ──────────────────────────────
  const badges = {};

  if (abhav && aanya) {
    // Insurance renewals within 30 days
    const now = new Date();
    const renewals = [
      ...(abhav.insurances || []),
      ...(aanya.insurances || []),
    ].filter((i) => {
      if (!i.renewalDate) return false;
      const diff = (new Date(i.renewalDate) - now) / 86400000;
      return diff >= 0 && diff <= 30;
    });
    if (renewals.length) badges.insurance = renewals.length;

    // Budget alerts breached
    const checkAlerts = (d) =>
      (d?.budgetAlerts || []).filter((a) => {
        if (!a.active) return false;
        const spent = (d?.expenses || [])
          .filter(
            (e) => e.category === a.category && e.expenseType === "monthly",
          )
          .reduce((s, e) => s + e.amount, 0);
        return spent > a.limit;
      }).length;
    const alertCount = checkAlerts(abhav) + checkAlerts(aanya);
    if (alertCount) badges.alerts = alertCount;

    // Goals nearing deadline (within 30 days)
    const urgentGoals = (shared?.goals || []).filter((g) => {
      if (!g.deadline) return false;
      const diff = (new Date(g.deadline) - now) / 86400000;
      const saved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
      return diff >= 0 && diff <= 30 && saved < g.target;
    });
    if (urgentGoals.length) badges.goals = urgentGoals.length;
  }

  if (hasPin && !pinUnlocked) {
    return (
      <PinLockScreen pin={shared.pin} onUnlock={(v) => setPinUnlocked(v)} />
    );
  }

  return (
    <>
      {isDemo && (
        <div
          style={{
            background:
              "linear-gradient(90deg, var(--gold-dim), rgba(201,168,76,0.15))",
            borderBottom: "1px solid var(--gold-border)",
            padding: "8px 16px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--gold)",
            position: "sticky",
            top: 0,
            zIndex: 1000,
          }}
        >
          <strong>Demo Mode</strong> — exploring with sample data.{" "}
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "none",
              color: "var(--gold)",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13,
              padding: 0,
            }}
          >
            Sign in with your account →
          </button>
        </div>
      )}
      <Sidebar
        page={page}
        setPage={setPage}
        profile={profile}
        setProfile={setProfile}
        badges={badges}
        personNames={personNames}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <div className="app-layout">
        <OfflineBanner />
        {/* ── Profile switcher (always visible) ── */}
        <div className="profile-bar">
          <div
            className="profile-switcher"
            role="radiogroup"
            aria-label="Profile selection"
          >
            {[
              {
                id: "household",
                label: "Household",
                color: "var(--gold)",
                dim: "var(--gold-dim)",
              },
              {
                id: "abhav",
                label: personNames.abhav,
                color: "var(--abhav)",
                dim: "var(--abhav-dim)",
              },
              {
                id: "aanya",
                label: personNames.aanya,
                color: "var(--aanya)",
                dim: "var(--aanya-dim)",
              },
            ].map((p) => (
              <button
                key={p.id}
                className={`profile-pill${profile === p.id ? " active" : ""}`}
                style={{
                  "--pill-color": p.color,
                  "--pill-dim": p.dim,
                }}
                onClick={() => setProfile(p.id)}
                role="radio"
                aria-checked={profile === p.id}
              >
                <span className="profile-pill-dot" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <main
          className="main-content"
          style={{ flex: 1, padding: "2rem", maxWidth: 1100, overflow: "auto" }}
          {...pullHandlers}
        >
          {/* Pull-to-refresh indicator */}
          {(pullDistance > 0 || refreshing) && (
            <div
              className="pull-to-refresh-indicator"
              style={{
                height: refreshing ? 40 : pullDistance,
                opacity: refreshing ? 1 : Math.min(pullDistance / 60, 1),
              }}
            >
              <div className={`pull-spinner${refreshing ? " spinning" : ""}`}>
                ↻
              </div>
            </div>
          )}
          <div key={page} className="page-enter">
            <PageErrorBoundary resetKey={`${page}-${profile}`}>
              <Suspense fallback={<LoadingSkeleton />}>{pageEl}</Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
      <AIAdvisor setPage={setPage} />
      <QuickAdd
        setPage={setPage}
        setProfile={setProfile}
        personNames={personNames}
        externalOpen={quickAddOpen}
        setExternalOpen={setQuickAddOpen}
      />
      <FeedbackButton />
      <NotificationBell isAdmin={isAdmin} />
      <SearchPalette
        abhav={abhav}
        aanya={aanya}
        shared={shared}
        personNames={personNames}
        setPage={setPage}
        setProfile={setProfile}
      />
      <OnboardingTour show={!isDemo} />
      <InstallBanner />
    </>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <UpdateBanner />
      <App />
    </AuthProvider>
  );
}
