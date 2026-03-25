import { useState } from "react";
import { fmt, fmtCr, nextId } from "../utils/finance";
import { Plus, Trash2, Shield } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { useData } from "../context/DataContext";

// ─────────────────────────────────────────────────────────────────────────────
// INSURANCE TRACKER
// ─────────────────────────────────────────────────────────────────────────────
const INSURANCE_TYPES = [
  "Term Life",
  "Health",
  "Vehicle",
  "Home",
  "Travel",
  "Critical Illness",
  "Accident",
  "Other",
];

export function Insurance({ data, personName, personColor, updatePerson }) {
  const insurances = data?.insurances || [];
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    name: "",
    type: "Health",
    provider: "",
    premium: "",
    premiumFreq: "yearly",
    coverage: "",
    startDate: "",
    renewalDate: "",
    policyNumber: "",
  });
  const { confirm, dialog } = useConfirm();

  const add = () => {
    if (!n.name || !n.premium) return;
    if (Number(n.premium) <= 0) return;
    updatePerson("insurances", [
      ...insurances,
      {
        ...n,
        id: nextId(insurances),
        premium: Number(n.premium),
        coverage: Number(n.coverage) || 0,
      },
    ]);
    setN({
      name: "",
      type: "Health",
      provider: "",
      premium: "",
      premiumFreq: "yearly",
      coverage: "",
      startDate: "",
      renewalDate: "",
      policyNumber: "",
    });
    setShowAdd(false);
  };

  const remove = async (id) => {
    const ins = insurances.find((i) => i.id === id);
    if (
      await confirm(
        `Remove "${ins?.name}"?`,
        "This cannot be undone.",
        "Remove",
      )
    )
      updatePerson(
        "insurances",
        insurances.filter((i) => i.id !== id),
      );
  };

  const totalAnnualPremium = insurances.reduce((s, i) => {
    if (i.premiumFreq === "monthly") return s + i.premium * 12;
    if (i.premiumFreq === "quarterly") return s + i.premium * 4;
    return s + i.premium;
  }, 0);
  const totalCoverage = insurances.reduce((s, i) => s + (i.coverage || 0), 0);

  // Policies renewing within 30 days
  const now = new Date();
  const upcomingRenewals = insurances.filter((i) => {
    if (!i.renewalDate) return false;
    const d = new Date(i.renewalDate);
    const diff = (d - now) / 86400000;
    return diff >= 0 && diff <= 30;
  });

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Insurance
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Policies</div>
          <div className="metric-value">{insurances.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Annual premium</div>
          <div className="metric-value">{fmt(totalAnnualPremium)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total coverage</div>
          <div className="metric-value">{fmtCr(totalCoverage)}</div>
        </div>
      </div>
      {upcomingRenewals.length > 0 && (
        <div
          className="tip"
          style={{
            background: "rgba(239,83,80,0.08)",
            borderColor: "rgba(239,83,80,0.3)",
          }}
        >
          🔔 {upcomingRenewals.length} polic
          {upcomingRenewals.length > 1 ? "ies" : "y"} renewing within 30 days:{" "}
          {upcomingRenewals.map((i) => i.name).join(", ")}
        </div>
      )}
      <div className="card section-gap">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Policies
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13} /> Add
          </button>
        </div>
        {showAdd && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Policy name"
                value={n.name}
                onChange={(e) => setN({ ...n, name: e.target.value })}
              />
              <select
                value={n.type}
                onChange={(e) => setN({ ...n, type: e.target.value })}
              >
                {INSURANCE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                placeholder="Provider"
                value={n.provider}
                onChange={(e) => setN({ ...n, provider: e.target.value })}
              />
              <input
                placeholder="Policy number"
                value={n.policyNumber}
                onChange={(e) => setN({ ...n, policyNumber: e.target.value })}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  placeholder="Premium ₹"
                  value={n.premium}
                  onChange={(e) => setN({ ...n, premium: e.target.value })}
                  style={{ flex: 1 }}
                />
                <select
                  value={n.premiumFreq}
                  onChange={(e) => setN({ ...n, premiumFreq: e.target.value })}
                  style={{ width: 100 }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <input
                type="number"
                placeholder="Coverage ₹"
                value={n.coverage}
                onChange={(e) => setN({ ...n, coverage: e.target.value })}
              />
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Start date
                </label>
                <input
                  type="date"
                  value={n.startDate}
                  onChange={(e) => setN({ ...n, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Renewal date
                </label>
                <input
                  type="date"
                  value={n.renewalDate}
                  onChange={(e) => setN({ ...n, renewalDate: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={add}>
              Save
            </button>
          </div>
        )}
        {insurances.length === 0 && !showAdd && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No policies yet. Add your first insurance policy.
          </div>
        )}
        {insurances.map((ins) => {
          const annPrem =
            ins.premiumFreq === "monthly"
              ? ins.premium * 12
              : ins.premiumFreq === "quarterly"
                ? ins.premium * 4
                : ins.premium;
          return (
            <div
              key={ins.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={14} style={{ color: personColor }} />
                  <span style={{ fontWeight: 500 }}>{ins.name}</span>
                  <span
                    className="tag"
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    {ins.type}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  {ins.provider && <span>{ins.provider} · </span>}
                  {fmt(annPrem)}/yr premium
                  {ins.coverage ? ` · ${fmtCr(ins.coverage)} cover` : ""}
                  {ins.renewalDate &&
                    ` · Renews ${new Date(ins.renewalDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </div>
              </div>
              <button className="btn-icon" onClick={() => remove(ins.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}

export function HouseholdInsurance({ abhav, aanya, updatePerson }) {
  const { personNames } = useData();
  return (
    <div className="grid-2" style={{ gap: "1.5rem" }}>
      <Insurance
        data={abhav}
        personName={personNames?.abhav || "Person 1"}
        personColor="var(--abhav)"
        updatePerson={(k, v) => updatePerson("abhav", k, v)}
      />
      <Insurance
        data={aanya}
        personName={personNames?.aanya || "Person 2"}
        personColor="var(--aanya)"
        updatePerson={(k, v) => updatePerson("aanya", k, v)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION TRACKER
// ─────────────────────────────────────────────────────────────────────────────
const SUB_CATEGORIES = [
  "Streaming",
  "Music",
  "Cloud Storage",
  "Software",
  "Fitness",
  "News/Magazines",
  "Gaming",
  "Learning",
  "Other",
];
const SUB_ICONS = {
  Streaming: "📺",
  Music: "🎵",
  "Cloud Storage": "☁️",
  Software: "💻",
  Fitness: "🏋️",
  "News/Magazines": "📰",
  Gaming: "🎮",
  Learning: "📚",
  Other: "📦",
};

export function Subscriptions({ data, personName, personColor, updatePerson }) {
  const subs = data?.subscriptions || [];
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({
    name: "",
    category: "Streaming",
    amount: "",
    frequency: "monthly",
    startDate: "",
    active: true,
  });
  const { confirm, dialog } = useConfirm();

  const add = () => {
    if (!n.name || !n.amount) return;
    if (Number(n.amount) <= 0) return;
    updatePerson("subscriptions", [
      ...subs,
      { ...n, id: nextId(subs), amount: Number(n.amount) },
    ]);
    setN({
      name: "",
      category: "Streaming",
      amount: "",
      frequency: "monthly",
      startDate: "",
      active: true,
    });
    setShowAdd(false);
  };

  const toggle = (id) =>
    updatePerson(
      "subscriptions",
      subs.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  const remove = async (id) => {
    const sub = subs.find((s) => s.id === id);
    if (
      await confirm(
        `Cancel "${sub?.name}"?`,
        "Remove this subscription?",
        "Remove",
      )
    )
      updatePerson(
        "subscriptions",
        subs.filter((s) => s.id !== id),
      );
  };

  const activeSubs = subs.filter((s) => s.active);
  const monthlyTotal = activeSubs.reduce((s, sub) => {
    if (sub.frequency === "yearly") return s + sub.amount / 12;
    if (sub.frequency === "quarterly") return s + sub.amount / 3;
    if (sub.frequency === "weekly") return s + sub.amount * (52 / 12);
    return s + sub.amount;
  }, 0);
  const yearlyTotal = monthlyTotal * 12;

  // Group by category
  const byCat = activeSubs.reduce((acc, s) => {
    acc[s.category] =
      (acc[s.category] || 0) +
      (s.frequency === "yearly"
        ? s.amount / 12
        : s.frequency === "quarterly"
          ? s.amount / 3
          : s.amount);
    return acc;
  }, {});

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Subscriptions
      </div>
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Active</div>
          <div className="metric-value">{activeSubs.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly cost</div>
          <div className="metric-value">{fmt(Math.round(monthlyTotal))}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Yearly cost</div>
          <div className="metric-value red-text">
            {fmt(Math.round(yearlyTotal))}
          </div>
        </div>
      </div>
      {/* Category breakdown */}
      {Object.keys(byCat).length > 0 && (
        <div className="card section-gap">
          <div className="card-title">Monthly by category</div>
          {Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => (
              <div
                key={cat}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  fontSize: 13,
                }}
              >
                <span>
                  {SUB_ICONS[cat] || "📦"} {cat}
                </span>
                <span style={{ fontWeight: 500 }}>
                  {fmt(Math.round(amt))}/mo
                </span>
              </div>
            ))}
        </div>
      )}
      <div className="card section-gap">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            All subscriptions
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13} /> Add
          </button>
        </div>
        {showAdd && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Service name"
                value={n.name}
                onChange={(e) => setN({ ...n, name: e.target.value })}
              />
              <select
                value={n.category}
                onChange={(e) => setN({ ...n, category: e.target.value })}
              >
                {SUB_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  placeholder="Amount ₹"
                  value={n.amount}
                  onChange={(e) => setN({ ...n, amount: e.target.value })}
                  style={{ flex: 1 }}
                />
                <select
                  value={n.frequency}
                  onChange={(e) => setN({ ...n, frequency: e.target.value })}
                  style={{ width: 100 }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Start date
                </label>
                <input
                  type="date"
                  value={n.startDate}
                  onChange={(e) => setN({ ...n, startDate: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={add}>
              Save
            </button>
          </div>
        )}
        {subs.length === 0 && !showAdd && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No subscriptions yet. Track your OTT, cloud, gym memberships.
          </div>
        )}
        {subs.map((sub) => {
          const moAmt =
            sub.frequency === "yearly"
              ? sub.amount / 12
              : sub.frequency === "quarterly"
                ? sub.amount / 3
                : sub.amount;
          return (
            <div
              key={sub.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
                opacity: sub.active ? 1 : 0.45,
              }}
            >
              <div
                style={{ flex: 1, cursor: "pointer" }}
                onClick={() => toggle(sub.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>
                    {SUB_ICONS[sub.category] || "📦"}
                  </span>
                  <span style={{ fontWeight: 500 }}>{sub.name}</span>
                  {!sub.active && (
                    <span
                      className="tag"
                      style={{
                        fontSize: 10,
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      paused
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {fmt(sub.amount)}/
                  {sub.frequency === "yearly"
                    ? "yr"
                    : sub.frequency === "quarterly"
                      ? "qtr"
                      : "mo"}
                  {sub.frequency !== "monthly" &&
                    ` (${fmt(Math.round(moAmt))}/mo)`}
                </div>
              </div>
              <button className="btn-icon" onClick={() => remove(sub.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}

export function HouseholdSubscriptions({ abhav, aanya, updatePerson }) {
  const { personNames } = useData();
  return (
    <div className="grid-2" style={{ gap: "1.5rem" }}>
      <Subscriptions
        data={abhav}
        personName={personNames?.abhav || "Person 1"}
        personColor="var(--abhav)"
        updatePerson={(k, v) => updatePerson("abhav", k, v)}
      />
      <Subscriptions
        data={aanya}
        personName={personNames?.aanya || "Person 2"}
        personColor="var(--aanya)"
        updatePerson={(k, v) => updatePerson("aanya", k, v)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY FUND TRACKER (standalone card, used on Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export function EmergencyFundCard({ abhav, aanya }) {
  // Monthly essential expenses (both persons)
  const essentialCategories = [
    "Housing",
    "Food",
    "Utilities",
    "Insurance",
    "Healthcare",
    "Transport",
    "Education",
  ];
  const calcMonthlyEssentials = (data) =>
    (data?.expenses || [])
      .filter(
        (e) =>
          e.expenseType === "monthly" &&
          essentialCategories.includes(e.category),
      )
      .reduce((s, e) => s + (e.amount || 0), 0);

  const monthlyEssentials =
    calcMonthlyEssentials(abhav) + calcMonthlyEssentials(aanya);

  // EMI payments
  const monthlyEMI =
    (abhav?.debts || []).reduce((s, d) => {
      const mr = (d.rate || 0) / 100 / 12;
      const n = d.tenure || 1;
      return (
        s +
        (mr > 0
          ? Math.round(
              (d.outstanding * mr * Math.pow(1 + mr, n)) /
                (Math.pow(1 + mr, n) - 1),
            )
          : Math.round(d.outstanding / n))
      );
    }, 0) +
    (aanya?.debts || []).reduce((s, d) => {
      const mr = (d.rate || 0) / 100 / 12;
      const n = d.tenure || 1;
      return (
        s +
        (mr > 0
          ? Math.round(
              (d.outstanding * mr * Math.pow(1 + mr, n)) /
                (Math.pow(1 + mr, n) - 1),
            )
          : Math.round(d.outstanding / n))
      );
    }, 0);

  // Insurance premiums (monthly equivalent)
  const monthlyInsurance =
    (abhav?.insurances || [])
      .filter((i) => i.active !== false)
      .reduce((s, i) => {
        if (i.premiumFreq === "monthly") return s + i.premium;
        if (i.premiumFreq === "quarterly") return s + i.premium / 3;
        return s + i.premium / 12;
      }, 0) +
    (aanya?.insurances || [])
      .filter((i) => i.active !== false)
      .reduce((s, i) => {
        if (i.premiumFreq === "monthly") return s + i.premium;
        if (i.premiumFreq === "quarterly") return s + i.premium / 3;
        return s + i.premium / 12;
      }, 0);

  const monthlyNeed =
    monthlyEssentials + monthlyEMI + Math.round(monthlyInsurance);

  // Liquid savings: cash assets + savings accounts from both persons
  const liquidAssets = (data) =>
    (data?.assets || [])
      .filter((a) => a.type === "cash" || a.type === "savings")
      .reduce((s, a) => s + (a.value || 0), 0);
  const totalLiquid = liquidAssets(abhav) + liquidAssets(aanya);

  const monthsCovered = monthlyNeed > 0 ? totalLiquid / monthlyNeed : 0;
  const target = 6; // 6 months is the standard recommendation
  const progress = Math.min(100, (monthsCovered / target) * 100);
  const color =
    monthsCovered >= 6
      ? "var(--green)"
      : monthsCovered >= 3
        ? "var(--gold)"
        : "var(--red)";
  const status =
    monthsCovered >= 6
      ? "Healthy"
      : monthsCovered >= 3
        ? "Building"
        : "Critical";

  if (monthlyNeed === 0) return null; // Don't show if no expenses tracked

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div className="card-title" style={{ marginBottom: 0 }}>
          🛟 Emergency Fund
        </div>
        <span
          className="tag"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          {status}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        <span className="muted">Monthly need</span>
        <span>{fmt(Math.round(monthlyNeed))}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        <span className="muted">Liquid savings</span>
        <span>{fmt(Math.round(totalLiquid))}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        <span>Runway</span>
        <span style={{ color }}>{monthsCovered.toFixed(1)} months</span>
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.3s",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>Target: 6 months ({fmt(Math.round(monthlyNeed * 6))})</span>
        <span>
          {monthsCovered >= 6
            ? "✓ Fully funded"
            : `Need ${fmt(Math.round(Math.max(0, monthlyNeed * 6 - totalLiquid)))} more`}
        </span>
      </div>
    </div>
  );
}
