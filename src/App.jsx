import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
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
import Onboarding from "./pages/Onboarding";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  budget: "Budget",
  investments: "Investments",
  goals: "Goals",
  networth: "Net Worth",
  debts: "Debts & EMIs",
  cashflow: "Cash Flow",
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

// Confirm dialog for destructive actions
export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger,
}) {
  if (!open) return null;
  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: "1.25rem",
            lineHeight: 1.6,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? "btn-primary" : "btn-primary"}
            onClick={onConfirm}
            style={danger ? { background: "var(--red)", color: "#fff" } : {}}
          >
            {danger ? "Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for confirm dialogs
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    danger: false,
    resolve: null,
  });
  const confirm = useCallback((title, message, danger = true) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, danger, resolve });
    });
  }, []);
  const dialog = state.open ? (
    <ConfirmDialog
      open
      title={state.title}
      message={state.message}
      danger={state.danger}
      onConfirm={() => {
        state.resolve(true);
        setState((s) => ({ ...s, open: false }));
      }}
      onCancel={() => {
        state.resolve(false);
        setState((s) => ({ ...s, open: false }));
      }}
    />
  ) : null;
  return { confirm, dialog };
}

function App() {
  const { user } = useAuth();
  if (user === undefined) return <LoadingScreen />;
  if (!user) return <Login />;
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
    updatePerson,
    updateShared,
    takeSnapshot,
    resetData,
  } = useData();
  const { logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [profile, setProfile] = useState("household");

  useEffect(() => {
    document.title = `${PAGE_TITLES[page] || "WealthOS"} — WealthOS`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  if (loading || !abhav || !aanya) return <LoadingSkeleton />;

  if (needsOnboarding) return <Onboarding />;

  const isHousehold = profile === "household";
  const personName =
    profile === "abhav" ? "Abhav" : profile === "aanya" ? "Aanya" : "Household";
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
          personName="Abhav"
          personColor="var(--abhav)"
          updatePerson={(k, v) => updatePerson("abhav", k, v)}
          {...extraProps}
        />
        <Component
          data={aanya}
          personName="Aanya"
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
        return <Dashboard abhav={abhav} aanya={aanya} shared={shared} />;
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
      case "settings":
        return (
          <Settings
            sharedData={shared}
            updateShared={updateShared}
            logout={logout}
            resetData={resetData}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <Sidebar
        page={page}
        setPage={setPage}
        profile={profile}
        setProfile={setProfile}
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
