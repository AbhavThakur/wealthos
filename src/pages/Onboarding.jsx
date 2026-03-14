import { useState } from "react";
import { useData } from "../context/DataContext";
import { EXPENSE_CATEGORIES, INCOME_TYPES } from "../utils/finance";

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "household", label: "Household" },
  { key: "abhav", label: "Abhav" },
  { key: "aanya", label: "Aanya" },
  { key: "expenses", label: "Expenses" },
  { key: "done", label: "Done" },
];

const QUICK_EXPENSES = [
  { category: "Housing", label: "Rent / EMI" },
  { category: "Food", label: "Groceries" },
  { category: "Transport", label: "Transport" },
  { category: "Utilities", label: "Utilities" },
  { category: "Insurance", label: "Insurance" },
  { category: "Entertainment", label: "Entertainment" },
  { category: "Shopping", label: "Shopping" },
];

export default function Onboarding() {
  const { updateShared, batchUpdatePerson } = useData();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [householdName, setHouseholdName] = useState("");
  const [city, setCity] = useState("");
  const [savingsTarget, setSavingsTarget] = useState(25);

  const [abhavIncome, setAbhavIncome] = useState("");
  const [abhavIncomeType, setAbhavIncomeType] = useState("salary");
  const [abhavSavings, setAbhavSavings] = useState("");

  const [aanyaIncome, setAanyaIncome] = useState("");
  const [aanyaIncomeType, setAanyaIncomeType] = useState("salary");
  const [aanyaSavings, setAanyaSavings] = useState("");

  const [abhavExpenses, setAbhavExpenses] = useState(
    QUICK_EXPENSES.map((e) => ({ ...e, amount: "" })),
  );
  const [aanyaExpenses, setAanyaExpenses] = useState(
    QUICK_EXPENSES.map((e) => ({ ...e, amount: "" })),
  );

  const current = STEPS[step];

  const canNext = () => {
    if (current.key === "household") return householdName.trim().length > 0;
    if (current.key === "abhav") return Number(abhavIncome) > 0;
    if (current.key === "aanya") return Number(aanyaIncome) > 0;
    return true;
  };

  const next = () => step < STEPS.length - 1 && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const finish = async () => {
    setSaving(true);

    // Build Abhav data
    const abhavIncomes = [
      {
        id: 1,
        name: abhavIncomeType === "salary" ? "Salary" : "Income",
        amount: Number(abhavIncome),
        type: abhavIncomeType,
      },
    ];
    const abhavExp = abhavExpenses
      .filter((e) => Number(e.amount) > 0)
      .map((e, i) => ({
        id: i + 1,
        name: e.label,
        amount: Number(e.amount),
        category: e.category,
      }));
    const abhavAssets =
      Number(abhavSavings) > 0
        ? [
            {
              id: 1,
              name: "Savings Account",
              value: Number(abhavSavings),
              type: "cash",
            },
          ]
        : [];

    // Build Aanya data
    const aanyaIncomes = [
      {
        id: 1,
        name: aanyaIncomeType === "salary" ? "Salary" : "Income",
        amount: Number(aanyaIncome),
        type: aanyaIncomeType,
      },
    ];
    const aanyaExp = aanyaExpenses
      .filter((e) => Number(e.amount) > 0)
      .map((e, i) => ({
        id: i + 1,
        name: e.label,
        amount: Number(e.amount),
        category: e.category,
      }));
    const aanyaAssets =
      Number(aanyaSavings) > 0
        ? [
            {
              id: 1,
              name: "Savings Account",
              value: Number(aanyaSavings),
              type: "cash",
            },
          ]
        : [];

    // Save all — use batchUpdatePerson so all fields go in one write per person
    batchUpdatePerson("abhav", {
      incomes: abhavIncomes,
      expenses: abhavExp,
      assets: abhavAssets,
    });

    batchUpdatePerson("aanya", {
      incomes: aanyaIncomes,
      expenses: aanyaExp,
      assets: aanyaAssets,
    });

    updateShared("profile", {
      householdName: householdName.trim(),
      city: city.trim(),
      savingsTarget: Number(savingsTarget) || 25,
    });
  };

  const fmt = (v) => (v ? `₹${Number(v).toLocaleString("en-IN")}` : "");
  const totalExp = (list) =>
    list.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="onboarding-root">
      {/* Progress bar */}
      <div className="onboarding-progress">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`onboarding-dot${i <= step ? " active" : ""}`}
            title={s.label}
          />
        ))}
      </div>

      <div className="onboarding-card">
        {/* Welcome */}
        {current.key === "welcome" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
            <h1
              style={{
                fontSize: 28,
                fontFamily: "var(--font-serif)",
                color: "var(--gold)",
                marginBottom: 8,
              }}
            >
              Welcome to WealthOS
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                maxWidth: 440,
                margin: "0 auto 1.5rem",
              }}
            >
              Your family finance tracker. Let's set things up in a couple
              minutes — you can always edit everything later.
            </p>
            <button
              className="btn-primary"
              onClick={next}
              style={{ padding: "10px 32px" }}
            >
              Let's go →
            </button>
          </div>
        )}

        {/* Household */}
        {current.key === "household" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              Household
            </h2>
            <p className="onboarding-hint">
              Name your household and add basic details.
            </p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                Household Name *
                <input
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="e.g. Abhav & Aanya"
                  autoFocus
                />
              </label>
              <label className="onboarding-label">
                City
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
              </label>
              <label className="onboarding-label">
                Monthly savings target (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={savingsTarget}
                  onChange={(e) => setSavingsTarget(e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        {/* Abhav income */}
        {current.key === "abhav" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              Abhav's Income
            </h2>
            <p className="onboarding-hint">Primary monthly income source.</p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                Income Type
                <select
                  value={abhavIncomeType}
                  onChange={(e) => setAbhavIncomeType(e.target.value)}
                >
                  {INCOME_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="onboarding-label">
                Monthly Income (₹) *
                <input
                  type="number"
                  min={0}
                  value={abhavIncome}
                  onChange={(e) => setAbhavIncome(e.target.value)}
                  placeholder="e.g. 80000"
                  autoFocus
                />
              </label>
              <label className="onboarding-label">
                Current Savings (₹)
                <input
                  type="number"
                  min={0}
                  value={abhavSavings}
                  onChange={(e) => setAbhavSavings(e.target.value)}
                  placeholder="Bank balance (optional)"
                />
              </label>
              {abhavIncome > 0 && (
                <div className="onboarding-preview">
                  Take-home: <strong>{fmt(abhavIncome)}</strong>/mo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aanya income */}
        {current.key === "aanya" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              Aanya's Income
            </h2>
            <p className="onboarding-hint">Primary monthly income source.</p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                Income Type
                <select
                  value={aanyaIncomeType}
                  onChange={(e) => setAanyaIncomeType(e.target.value)}
                >
                  {INCOME_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="onboarding-label">
                Monthly Income (₹) *
                <input
                  type="number"
                  min={0}
                  value={aanyaIncome}
                  onChange={(e) => setAanyaIncome(e.target.value)}
                  placeholder="e.g. 65000"
                  autoFocus
                />
              </label>
              <label className="onboarding-label">
                Current Savings (₹)
                <input
                  type="number"
                  min={0}
                  value={aanyaSavings}
                  onChange={(e) => setAanyaSavings(e.target.value)}
                  placeholder="Bank balance (optional)"
                />
              </label>
              {aanyaIncome > 0 && (
                <div className="onboarding-preview">
                  Take-home: <strong>{fmt(aanyaIncome)}</strong>/mo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expenses */}
        {current.key === "expenses" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              Monthly Expenses
            </h2>
            <p className="onboarding-hint">
              Fill in the ones that apply — skip the rest.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem",
              }}
            >
              {/* Abhav expenses */}
              <div>
                <div className="onboarding-sublabel">Abhav</div>
                {abhavExpenses.map((e, i) => (
                  <label
                    key={e.category}
                    className="onboarding-label"
                    style={{ marginBottom: 6 }}
                  >
                    <span
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {e.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={e.amount}
                      onChange={(ev) => {
                        const copy = [...abhavExpenses];
                        copy[i] = { ...copy[i], amount: ev.target.value };
                        setAbhavExpenses(copy);
                      }}
                      placeholder="₹"
                    />
                  </label>
                ))}
                {totalExp(abhavExpenses) > 0 && (
                  <div className="onboarding-preview" style={{ marginTop: 8 }}>
                    Total: <strong>{fmt(totalExp(abhavExpenses))}</strong>/mo
                  </div>
                )}
              </div>

              {/* Aanya expenses */}
              <div>
                <div className="onboarding-sublabel">Aanya</div>
                {aanyaExpenses.map((e, i) => (
                  <label
                    key={e.category}
                    className="onboarding-label"
                    style={{ marginBottom: 6 }}
                  >
                    <span
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {e.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={e.amount}
                      onChange={(ev) => {
                        const copy = [...aanyaExpenses];
                        copy[i] = { ...copy[i], amount: ev.target.value };
                        setAanyaExpenses(copy);
                      }}
                      placeholder="₹"
                    />
                  </label>
                ))}
                {totalExp(aanyaExpenses) > 0 && (
                  <div className="onboarding-preview" style={{ marginTop: 8 }}>
                    Total: <strong>{fmt(totalExp(aanyaExpenses))}</strong>/mo
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {current.key === "done" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--gold)",
                marginBottom: 8,
              }}
            >
              All Set!
            </h2>
            <p className="onboarding-hint">
              Here's a quick summary. You can always edit everything from within
              the app.
            </p>

            <div className="onboarding-summary">
              <div className="onboarding-summary-row">
                <span>Household</span>
                <strong>{householdName || "—"}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>City</span>
                <strong>{city || "—"}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Abhav Income</span>
                <strong>{fmt(abhavIncome) || "—"}/mo</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Abhav Expenses</span>
                <strong>
                  {totalExp(abhavExpenses) > 0
                    ? `${fmt(totalExp(abhavExpenses))}/mo`
                    : "—"}
                </strong>
              </div>
              {Number(abhavSavings) > 0 && (
                <div className="onboarding-summary-row">
                  <span>Abhav Savings</span>
                  <strong>{fmt(abhavSavings)}</strong>
                </div>
              )}
              <div className="onboarding-summary-row">
                <span>Aanya Income</span>
                <strong>{fmt(aanyaIncome) || "—"}/mo</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Aanya Expenses</span>
                <strong>
                  {totalExp(aanyaExpenses) > 0
                    ? `${fmt(totalExp(aanyaExpenses))}/mo`
                    : "—"}
                </strong>
              </div>
              {Number(aanyaSavings) > 0 && (
                <div className="onboarding-summary-row">
                  <span>Aanya Savings</span>
                  <strong>{fmt(aanyaSavings)}</strong>
                </div>
              )}
              <div
                className="onboarding-summary-row"
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 10,
                  marginTop: 6,
                }}
              >
                <span>Household Income</span>
                <strong style={{ color: "var(--green)" }}>
                  {fmt(Number(abhavIncome) + Number(aanyaIncome))}/mo
                </strong>
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={finish}
              disabled={saving}
              style={{ padding: "10px 32px", marginTop: "1rem" }}
            >
              {saving ? "Saving…" : "Launch WealthOS 🚀"}
            </button>
          </div>
        )}

        {/* Navigation */}
        {current.key !== "welcome" && current.key !== "done" && (
          <div className="onboarding-nav">
            <button className="btn-ghost" onClick={prev}>
              ← Back
            </button>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {step} / {STEPS.length - 1}
            </span>
            <button
              className="btn-primary"
              onClick={next}
              disabled={!canNext()}
            >
              Next →
            </button>
          </div>
        )}
        {current.key === "done" && (
          <div
            className="onboarding-nav"
            style={{ justifyContent: "flex-start" }}
          >
            <button className="btn-ghost" onClick={prev}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
