import { useState } from "react";
import { useData } from "../context/DataContext";
import { INCOME_TYPES } from "../utils/finance";

const ALL_STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "household", label: "Setup" },
  { key: "person1", label: "You" },
  { key: "person2", label: "Partner" }, // skipped in solo mode
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

  // Mode: "solo" (just me) | "couple" (two people)
  const [mode, setMode] = useState(""); // empty until chosen
  const isSolo = mode === "solo";

  // Build active steps based on mode
  const STEPS = isSolo
    ? ALL_STEPS.filter((s) => s.key !== "person2")
    : ALL_STEPS;

  const current = STEPS[step];

  // Form state
  const [householdName, setHouseholdName] = useState("");
  const [city, setCity] = useState("");
  const [savingsTarget, setSavingsTarget] = useState(25);

  const [person1Name, setPerson1Name] = useState("");
  const [person2Name, setPerson2Name] = useState("");

  const [p1Income, setP1Income] = useState("");
  const [p1IncomeType, setP1IncomeType] = useState("salary");
  const [p1Savings, setP1Savings] = useState("");

  const [p2Income, setP2Income] = useState("");
  const [p2IncomeType, setP2IncomeType] = useState("salary");
  const [p2Savings, setP2Savings] = useState("");

  const [p1Expenses, setP1Expenses] = useState(
    QUICK_EXPENSES.map((e) => ({ ...e, amount: "" })),
  );
  const [p2Expenses, setP2Expenses] = useState(
    QUICK_EXPENSES.map((e) => ({ ...e, amount: "" })),
  );

  const canNext = () => {
    if (current.key === "household") return householdName.trim().length > 0;
    if (current.key === "person1")
      return person1Name.trim().length > 0 && Number(p1Income) > 0;
    if (current.key === "person2")
      return person2Name.trim().length > 0 && Number(p2Income) > 0;
    return true;
  };

  const next = () => step < STEPS.length - 1 && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const finish = async () => {
    setSaving(true);

    // Person 1 data
    const p1Incomes = [
      {
        id: 1,
        name: p1IncomeType === "salary" ? "Salary" : "Income",
        amount: Number(p1Income),
        type: p1IncomeType,
      },
    ];
    const p1Exp = p1Expenses
      .filter((e) => Number(e.amount) > 0)
      .map((e, i) => ({
        id: i + 1,
        name: e.label,
        amount: Number(e.amount),
        category: e.category,
        expenseType: "monthly",
      }));
    const p1Assets =
      Number(p1Savings) > 0
        ? [
            {
              id: 1,
              name: "Savings Account",
              value: Number(p1Savings),
              type: "cash",
            },
          ]
        : [];

    batchUpdatePerson("p1", {
      incomes: p1Incomes,
      expenses: p1Exp,
      assets: p1Assets,
    });

    // Person 2 data — only in couple mode
    if (!isSolo) {
      const p2Incomes = [
        {
          id: 1,
          name: p2IncomeType === "salary" ? "Salary" : "Income",
          amount: Number(p2Income),
          type: p2IncomeType,
        },
      ];
      const p2Exp = p2Expenses
        .filter((e) => Number(e.amount) > 0)
        .map((e, i) => ({
          id: i + 1,
          name: e.label,
          amount: Number(e.amount),
          category: e.category,
          expenseType: "monthly",
        }));
      const p2Assets =
        Number(p2Savings) > 0
          ? [
              {
                id: 1,
                name: "Savings Account",
                value: Number(p2Savings),
                type: "cash",
              },
            ]
          : [];
      batchUpdatePerson("p2", {
        incomes: p2Incomes,
        expenses: p2Exp,
        assets: p2Assets,
      });
    }

    updateShared("profile", {
      householdName: householdName.trim(),
      city: city.trim(),
      savingsTarget: Number(savingsTarget) || 25,
      person1Name: person1Name.trim(),
      person2Name: isSolo ? "" : person2Name.trim(),
      householdMode: mode || "couple",
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
              Your personal finance tracker. Let's set things up in a couple of
              minutes — you can always edit everything later.
            </p>

            {/* Mode selector */}
            <p
              style={{
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 12,
                color: "var(--text-primary)",
              }}
            >
              Who's tracking finances?
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              {[
                {
                  id: "solo",
                  emoji: "🧑",
                  label: "Just me",
                  sub: "Solo tracking",
                },
                {
                  id: "couple",
                  emoji: "👫",
                  label: "Two people",
                  sub: "Couple / partner",
                },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    background:
                      mode === m.id ? "var(--gold-dim)" : "var(--bg-card2)",
                    border:
                      mode === m.id
                        ? "2px solid var(--gold)"
                        : "2px solid var(--border)",
                    borderRadius: 12,
                    padding: "16px 24px",
                    cursor: "pointer",
                    textAlign: "center",
                    minWidth: 130,
                    transition: "all .15s",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{m.emoji}</div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color:
                        mode === m.id ? "var(--gold)" : "var(--text-primary)",
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {m.sub}
                  </div>
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={next}
              disabled={!mode}
              style={{ padding: "10px 32px", opacity: mode ? 1 : 0.45 }}
            >
              Let's go →
            </button>
          </div>
        )}

        {/* Household / setup */}
        {current.key === "household" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {isSolo ? "🧑" : "🏠"}
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              {isSolo ? "Your Setup" : "Household"}
            </h2>
            <p className="onboarding-hint">
              {isSolo
                ? "Give your account a name so everything feels personal."
                : "Name your household and add basic details."}
            </p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                {isSolo ? "Your name / account label *" : "Household Name *"}
                <input
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder={
                    isSolo ? "e.g. Rahul's Finances" : "e.g. The Sharmas"
                  }
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

        {/* Person 1 income */}
        {current.key === "person1" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              {isSolo ? "Your Income" : `${person1Name || "Person 1"}'s Income`}
            </h2>
            <p className="onboarding-hint">Name and primary monthly income.</p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                {isSolo ? "Your name *" : "Name *"}
                <input
                  value={person1Name}
                  onChange={(e) => setPerson1Name(e.target.value)}
                  placeholder="e.g. Rahul"
                  autoFocus
                />
              </label>
              <label className="onboarding-label">
                Income Type
                <select
                  value={p1IncomeType}
                  onChange={(e) => setP1IncomeType(e.target.value)}
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
                  value={p1Income}
                  onChange={(e) => setP1Income(e.target.value)}
                  placeholder="e.g. 80000"
                />
              </label>
              <label className="onboarding-label">
                Current Savings (₹)
                <input
                  type="number"
                  min={0}
                  value={p1Savings}
                  onChange={(e) => setP1Savings(e.target.value)}
                  placeholder="Bank balance (optional)"
                />
              </label>
              {p1Income > 0 && (
                <div className="onboarding-preview">
                  Take-home: <strong>{fmt(p1Income)}</strong>/mo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Person 2 income — couple mode only */}
        {current.key === "person2" && (
          <div className="onboarding-step">
            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
            <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              {person2Name || "Person 2"}&apos;s Income
            </h2>
            <p className="onboarding-hint">Name and primary monthly income.</p>

            <div className="onboarding-fields">
              <label className="onboarding-label">
                Name *
                <input
                  value={person2Name}
                  onChange={(e) => setPerson2Name(e.target.value)}
                  placeholder="e.g. Priya"
                  autoFocus
                />
              </label>
              <label className="onboarding-label">
                Income Type
                <select
                  value={p2IncomeType}
                  onChange={(e) => setP2IncomeType(e.target.value)}
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
                  value={p2Income}
                  onChange={(e) => setP2Income(e.target.value)}
                  placeholder="e.g. 65000"
                />
              </label>
              <label className="onboarding-label">
                Current Savings (₹)
                <input
                  type="number"
                  min={0}
                  value={p2Savings}
                  onChange={(e) => setP2Savings(e.target.value)}
                  placeholder="Bank balance (optional)"
                />
              </label>
              {p2Income > 0 && (
                <div className="onboarding-preview">
                  Take-home: <strong>{fmt(p2Income)}</strong>/mo
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

            {isSolo ? (
              /* Single column for solo mode */
              <div style={{ maxWidth: 320, margin: "0 auto" }}>
                {p1Expenses.map((e, i) => (
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
                        const copy = [...p1Expenses];
                        copy[i] = { ...copy[i], amount: ev.target.value };
                        setP1Expenses(copy);
                      }}
                      placeholder="₹"
                    />
                  </label>
                ))}
                {totalExp(p1Expenses) > 0 && (
                  <div className="onboarding-preview" style={{ marginTop: 8 }}>
                    Total: <strong>{fmt(totalExp(p1Expenses))}</strong>/mo
                  </div>
                )}
              </div>
            ) : (
              /* Two-column grid for couple mode */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <div className="onboarding-sublabel">
                    {person1Name || "Person 1"}
                  </div>
                  {p1Expenses.map((e, i) => (
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
                          const copy = [...p1Expenses];
                          copy[i] = { ...copy[i], amount: ev.target.value };
                          setP1Expenses(copy);
                        }}
                        placeholder="₹"
                      />
                    </label>
                  ))}
                  {totalExp(p1Expenses) > 0 && (
                    <div
                      className="onboarding-preview"
                      style={{ marginTop: 8 }}
                    >
                      Total: <strong>{fmt(totalExp(p1Expenses))}</strong>/mo
                    </div>
                  )}
                </div>

                <div>
                  <div className="onboarding-sublabel">
                    {person2Name || "Person 2"}
                  </div>
                  {p2Expenses.map((e, i) => (
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
                          const copy = [...p2Expenses];
                          copy[i] = { ...copy[i], amount: ev.target.value };
                          setP2Expenses(copy);
                        }}
                        placeholder="₹"
                      />
                    </label>
                  ))}
                  {totalExp(p2Expenses) > 0 && (
                    <div
                      className="onboarding-preview"
                      style={{ marginTop: 8 }}
                    >
                      Total: <strong>{fmt(totalExp(p2Expenses))}</strong>/mo
                    </div>
                  )}
                </div>
              </div>
            )}
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
              Here&apos;s a quick summary. You can always edit everything from
              within the app.
            </p>

            <div className="onboarding-summary">
              <div className="onboarding-summary-row">
                <span>{isSolo ? "Account" : "Household"}</span>
                <strong>{householdName || "—"}</strong>
              </div>
              {city && (
                <div className="onboarding-summary-row">
                  <span>City</span>
                  <strong>{city}</strong>
                </div>
              )}
              <div className="onboarding-summary-row">
                <span>{person1Name || "Your"} Income</span>
                <strong>{fmt(p1Income) || "—"}/mo</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>{person1Name || "Your"} Expenses</span>
                <strong>
                  {totalExp(p1Expenses) > 0
                    ? `${fmt(totalExp(p1Expenses))}/mo`
                    : "—"}
                </strong>
              </div>
              {Number(p1Savings) > 0 && (
                <div className="onboarding-summary-row">
                  <span>Savings</span>
                  <strong>{fmt(p1Savings)}</strong>
                </div>
              )}
              {!isSolo && (
                <>
                  <div className="onboarding-summary-row">
                    <span>{person2Name || "Person 2"} Income</span>
                    <strong>{fmt(p2Income) || "—"}/mo</strong>
                  </div>
                  <div className="onboarding-summary-row">
                    <span>{person2Name || "Person 2"} Expenses</span>
                    <strong>
                      {totalExp(p2Expenses) > 0
                        ? `${fmt(totalExp(p2Expenses))}/mo`
                        : "—"}
                    </strong>
                  </div>
                  {Number(p2Savings) > 0 && (
                    <div className="onboarding-summary-row">
                      <span>{person2Name || "Person 2"} Savings</span>
                      <strong>{fmt(p2Savings)}</strong>
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
                    <span>Combined Income</span>
                    <strong style={{ color: "var(--green)" }}>
                      {fmt(Number(p1Income) + Number(p2Income))}/mo
                    </strong>
                  </div>
                </>
              )}
            </div>

            <button
              className="btn-primary"
              onClick={finish}
              disabled={saving}
              style={{ padding: "10px 32px", marginTop: "1rem" }}
            >
              {saving ? "Saving\u2026" : "Launch WealthOS 🚀"}
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
