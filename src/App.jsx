import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData, DemoDataProvider } from "./context/DataContext";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Budget, { HouseholdBudget } from "./pages/Budget";
import Investments, { HouseholdInvestments } from "./pages/Investments";
import Goals from "./pages/Goals";
import NetWorth from "./pages/NetWorth";
import { BudgetAlerts } from "./pages/Recurring";
import {
  Debts,
  TaxPlanner,
  Settings,
  HouseholdDebts,
  CashFlow,
  HouseholdCashFlow,
} from "./pages/OtherPages";
import {
  Insurance,
  HouseholdInsurance,
  Subscriptions,
  HouseholdSubscriptions,
} from "./pages/MorePages";
import { exportAllData } from "./utils/exportData";
import Onboarding from "./pages/Onboarding";
import PinLockScreen from "./components/PinLockScreen";
import useIdleTimer from "./hooks/useIdleTimer";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  budget: "Budget",
  investments: "Investments",
  goals: "Goals",
  networth: "Net Worth",
  debts: "Debts & EMIs",
  cashflow: "Cash Flow",
  insurance: "Insurance",
  subscriptions: "Subscriptions",
  alerts: "Budget Alerts",
  tax: "Tax Planner",
  settings: "Settings",
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
  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
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
  const { logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [profile, setProfile] = useState("household");

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

  useEffect(() => {
    document.title = `${PAGE_TITLES[page] || "WealthOS"} — WealthOS`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

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
            updatePerson={updatePerson}
            logout={logout}
            resetData={resetData}
            listBackups={listBackups}
            restoreBackup={restoreBackup}
            createManualBackup={createManualBackup}
            seedDevFromProd={seedDevFromProd}
            pushDevToProd={pushDevToProd}
            onExport={() => exportAllData(abhav, aanya, shared, personNames)}
          />
        );
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
      />
      <div className="app-layout">
        <main
          className="main-content"
          style={{ flex: 1, padding: "2rem", maxWidth: 1100, overflow: "auto" }}
        >
          <div key={page} className="page-enter">
            {pageEl}
          </div>
        </main>
      </div>
    </>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
