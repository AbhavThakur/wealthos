import { useState } from "react";
import {
  fmt,
  nextId,
  EXPENSE_CATEGORIES,
  INCOME_TYPES,
} from "../utils/finance";
import { Plus, Trash2 } from "lucide-react";
import { useConfirm } from "../App";

export default function Budget({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const incomes = data?.incomes || [];
  const expenses = data?.expenses || [];
  const [tab, setTab] = useState("overview");
  const { confirm, dialog } = useConfirm();

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  const expByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const addIncome = () =>
    updatePerson("incomes", [
      ...incomes,
      { id: nextId(incomes), name: "New income", amount: 0, type: "salary" },
    ]);
  const addExpense = () =>
    updatePerson("expenses", [
      ...expenses,
      {
        id: nextId(expenses),
        name: "New expense",
        amount: 0,
        category: "Others",
      },
    ]);

  const tabs = ["overview", "income", "expenses"];

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Budget
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: "1.25rem" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              background: tab === t ? "var(--gold-dim)" : "transparent",
              color: tab === t ? "var(--gold)" : "var(--text-secondary)",
              border:
                tab === t
                  ? "1px solid var(--gold-border)"
                  : "1px solid var(--border)",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="grid-3 section-gap">
            <div className="metric-card">
              <div className="metric-label">Income</div>
              <div className="metric-value green-text">{fmt(totalIncome)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Expenses</div>
              <div className="metric-value red-text">{fmt(totalExpenses)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pre-invest savings</div>
              <div
                className="metric-value"
                style={{
                  color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
                }}
              >
                {savingsRate}%
              </div>
            </div>
          </div>
          <div className="card section-gap">
            <div className="card-title">50/30/20 Breakdown</div>
            {[
              {
                label: "Needs (50%)",
                cats: [
                  "Housing",
                  "Utilities",
                  "Transport",
                  "Healthcare",
                  "Insurance",
                  "Education",
                ],
                color: "var(--blue)",
              },
              {
                label: "Wants (30%)",
                cats: [
                  "Food",
                  "Entertainment",
                  "Shopping",
                  "Personal Care",
                  "Others",
                ],
                color: "var(--purple)",
              },
            ].map((r) => {
              const val = r.cats.reduce(
                (s, c) => s + (expByCategory[c] || 0),
                0,
              );
              const target = r.label.includes("50")
                ? totalIncome * 0.5
                : totalIncome * 0.3;
              const pctActual =
                totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;
              const over = val > target;
              return (
                <div key={r.label} style={{ marginBottom: "0.875rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{r.label}</span>
                    <span>
                      {fmt(val)} <span className="muted">/ {fmt(target)}</span>{" "}
                      <span className={`tag ${over ? "tag-red" : "tag-green"}`}>
                        {pctActual}%
                      </span>
                    </span>
                  </div>
                  <div className="progress-track" style={{ height: 5 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: Math.min(100, pctActual) + "%",
                        background: r.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div className="card-title">Expenses by category</div>
            {Object.entries(expByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div
                  key={cat}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {cat}
                  </span>
                  <div style={{ flex: 2 }}>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: Math.round((amt / totalExpenses) * 100) + "%",
                          background: personColor,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {fmt(amt)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === "income" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Income sources
            </div>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={addIncome}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {incomes.map((inc) => (
            <div
              key={inc.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <input
                value={inc.name}
                onChange={(e) =>
                  updatePerson(
                    "incomes",
                    incomes.map((x) =>
                      x.id === inc.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                style={{ flex: 3 }}
              />
              <select
                value={inc.type}
                onChange={(e) =>
                  updatePerson(
                    "incomes",
                    incomes.map((x) =>
                      x.id === inc.id ? { ...x, type: e.target.value } : x,
                    ),
                  )
                }
                style={{ flex: 1.5 }}
              >
                {INCOME_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="number"
                value={inc.amount}
                onChange={(e) =>
                  updatePerson(
                    "incomes",
                    incomes.map((x) =>
                      x.id === inc.id
                        ? { ...x, amount: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
                style={{ flex: 1 }}
                min="0"
              />
              <button
                className="btn-danger"
                aria-label={`Delete ${inc.name}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Delete income?",
                      `Remove "${inc.name}" from your income sources?`,
                    )
                  )
                    updatePerson(
                      "incomes",
                      incomes.filter((x) => x.id !== inc.id),
                    );
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: "right", paddingTop: 12, fontWeight: 600 }}>
            Total: <span className="green-text">{fmt(totalIncome)}</span>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Monthly expenses
            </div>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={addExpense}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {expenses.map((exp) => (
            <div
              key={exp.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <input
                value={exp.name}
                onChange={(e) =>
                  updatePerson(
                    "expenses",
                    expenses.map((x) =>
                      x.id === exp.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                style={{ flex: 3 }}
              />
              <select
                value={exp.category}
                onChange={(e) =>
                  updatePerson(
                    "expenses",
                    expenses.map((x) =>
                      x.id === exp.id ? { ...x, category: e.target.value } : x,
                    ),
                  )
                }
                style={{ flex: 1.5 }}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                value={exp.amount}
                onChange={(e) =>
                  updatePerson(
                    "expenses",
                    expenses.map((x) =>
                      x.id === exp.id
                        ? { ...x, amount: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
                style={{ flex: 1 }}
                min="0"
              />
              <button
                className="btn-danger"
                aria-label={`Delete ${exp.name}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Delete expense?",
                      `Remove "${exp.name}" from your expenses?`,
                    )
                  )
                    updatePerson(
                      "expenses",
                      expenses.filter((x) => x.id !== exp.id),
                    );
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: "right", paddingTop: 12, fontWeight: 600 }}>
            Total: <span className="red-text">{fmt(totalExpenses)}</span>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export function HouseholdBudget({ abhav, aanya }) {
  const abhavIncome = (abhav?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const aanyaIncome = (aanya?.incomes || []).reduce((s, x) => s + x.amount, 0);
  const totalIncome = abhavIncome + aanyaIncome;

  const abhavExpenses = (abhav?.expenses || []).reduce(
    (s, x) => s + x.amount,
    0,
  );
  const aanyaExpenses = (aanya?.expenses || []).reduce(
    (s, x) => s + x.amount,
    0,
  );
  const totalExpenses = abhavExpenses + aanyaExpenses;

  const surplus = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;

  const mergeCats = (data) =>
    (data?.expenses || []).reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});
  const aCats = mergeCats(abhav);
  const anCats = mergeCats(aanya);
  const allCats = [
    ...new Set([...Object.keys(aCats), ...Object.keys(anCats)]),
  ].sort(
    (a, b) =>
      (aCats[b] || 0) + (anCats[b] || 0) - ((aCats[a] || 0) + (anCats[a] || 0)),
  );

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Budget
      </div>

      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Combined income</div>
          <div className="metric-value green-text">{fmt(totalIncome)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmt(abhavIncome)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmt(aanyaIncome)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Combined expenses</div>
          <div className="metric-value red-text">{fmt(totalExpenses)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmt(abhavExpenses)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmt(aanyaExpenses)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Surplus · Savings rate</div>
          <div
            className="metric-value"
            style={{
              color: savingsRate >= 20 ? "var(--green)" : "var(--gold)",
            }}
          >
            {fmt(surplus)}
          </div>
          <div className="metric-sub">{savingsRate}% of combined income</div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-title">50/30/20 — Household</div>
        {[
          {
            label: "Needs (50%)",
            cats: [
              "Housing",
              "Utilities",
              "Transport",
              "Healthcare",
              "Insurance",
              "Education",
            ],
            color: "var(--blue)",
          },
          {
            label: "Wants (30%)",
            cats: [
              "Food",
              "Entertainment",
              "Shopping",
              "Personal Care",
              "Others",
            ],
            color: "var(--purple)",
          },
        ].map((r) => {
          const val = r.cats.reduce(
            (s, c) => s + (aCats[c] || 0) + (anCats[c] || 0),
            0,
          );
          const target = r.label.includes("50")
            ? totalIncome * 0.5
            : totalIncome * 0.3;
          const pct =
            totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;
          const over = val > target;
          return (
            <div key={r.label} style={{ marginBottom: "0.875rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 5,
                }}
              >
                <span style={{ fontWeight: 500 }}>{r.label}</span>
                <span>
                  {fmt(val)} <span className="muted">/ {fmt(target)}</span>{" "}
                  <span className={`tag ${over ? "tag-red" : "tag-green"}`}>
                    {pct}%
                  </span>
                </span>
              </div>
              <div className="progress-track" style={{ height: 5 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: Math.min(100, pct) + "%",
                    background: r.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">Expenses by category</div>
        {allCats.map((cat) => {
          const av = aCats[cat] || 0;
          const anv = anCats[cat] || 0;
          const total = av + anv;
          return (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{cat}</span>
                <span style={{ fontWeight: 500 }}>{fmt(total)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "var(--border)",
                  gap: 1,
                }}
              >
                {av > 0 && (
                  <div
                    style={{
                      width: `${(av / totalExpenses) * 100}%`,
                      background: "var(--abhav)",
                      borderRadius: "3px 0 0 3px",
                    }}
                  />
                )}
                {anv > 0 && (
                  <div
                    style={{
                      width: `${(anv / totalExpenses) * 100}%`,
                      background: "var(--aanya)",
                      borderRadius: av > 0 ? "0 3px 3px 0" : 3,
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
                {av > 0 && (
                  <span>
                    <span style={{ color: "var(--abhav)" }}>●</span> Abhav{" "}
                    {fmt(av)}
                  </span>
                )}
                {anv > 0 && (
                  <span>
                    <span style={{ color: "var(--aanya)" }}>●</span> Aanya{" "}
                    {fmt(anv)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
