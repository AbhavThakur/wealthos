import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  fmt,
  fmtCr,
  nextId,
  INVESTMENT_TYPES,
  totalCorpus,
  autoCorpus,
  projectionData,
  ltcgTax,
  lumpCorpus,
} from "../utils/finance";
import { Plus, Trash2, Edit3, Check, X } from "lucide-react";
import { useConfirm } from "../App";

const INVESTMENT_APPS = [
  "Zerodha / Kite",
  "Groww",
  "Jio Finance",
  "myCams",
  "smallcase",
  "Coin",
];

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Field visibility helpers by investment type
const isFD = (t) => t === "FD";
// Weekly SIP: market instruments only
const hasSIPFreq = (t) => ["Mutual Fund", "Stocks", "Gold"].includes(t);
// Deduction date: auto-debit SIPs and NPS
const hasDeductionDate = (t) =>
  ["Mutual Fund", "Stocks", "Gold", "NPS"].includes(t);
// Investment app (Zerodha, Groww etc.): market instruments only
const hasInvestmentApp = (t) => ["Mutual Fund", "Stocks", "Gold"].includes(t);

function SIPCard({ inv, onUpdate, onDelete, personColor }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(inv);
  const { confirm, dialog } = useConfirm();

  const isFDInv = isFD(inv.type);
  const effMonthly = isFDInv
    ? 0
    : inv.amount * (inv.frequency === "weekly" ? 4.33 : 1);

  // FD: compound growth on lump-sum principal; others: SIP-based auto corpus
  const fdYrsElapsed =
    isFDInv && inv.startDate
      ? Math.max(
          0,
          (new Date() - new Date(inv.startDate)) / (365.25 * 24 * 3600 * 1000),
        )
      : 0;
  const currentVal = isFDInv
    ? lumpCorpus(inv.amount || 0, inv.returnPct || 0, fdYrsElapsed)
    : autoCorpus(
        inv.existingCorpus || 0,
        inv.amount,
        inv.returnPct,
        inv.startDate,
        inv.frequency,
      );

  // FD maturity value (based on start + end date)
  const fdTenureYrs =
    isFDInv && inv.startDate && inv.endDate
      ? Math.max(
          0,
          (new Date(inv.endDate) - new Date(inv.startDate)) /
            (365.25 * 24 * 3600 * 1000),
        )
      : null;
  const fdMaturityVal =
    fdTenureYrs !== null
      ? lumpCorpus(inv.amount || 0, inv.returnPct || 0, fdTenureYrs)
      : null;

  // Actual performance
  const totalInvested = isFDInv
    ? inv.amount || 0
    : Number(inv.totalInvested) || 0;
  const actualGain = totalInvested > 0 ? currentVal - totalInvested : null;
  const actualReturnPct =
    totalInvested > 0
      ? ((currentVal - totalInvested) / totalInvested) * 100
      : null;
  let cagr = null;
  if (totalInvested > 0 && inv.startDate) {
    const years =
      (new Date() - new Date(inv.startDate)) / (365.25 * 24 * 3600 * 1000);
    if (years >= 0.08) {
      cagr = (Math.pow(currentVal / totalInvested, 1 / years) - 1) * 100;
    }
  }
  const corpus10 = isFDInv
    ? null
    : totalCorpus(inv.existingCorpus || 0, effMonthly, inv.returnPct, 10);
  const corpus20 = isFDInv
    ? null
    : totalCorpus(inv.existingCorpus || 0, effMonthly, inv.returnPct, 20);
  const gains20 =
    corpus20 != null
      ? corpus20 - ((inv.existingCorpus || 0) + effMonthly * 12 * 20)
      : 0;
  const taxOnGains =
    !isFDInv && (inv.type === "Mutual Fund" || inv.type === "Stocks")
      ? ltcgTax(gains20)
      : 0;
  const postTax20 = corpus20 != null ? corpus20 - taxOnGains : 0;

  // Chart: FD shows yearly compound growth to maturity; others: 20yr SIP projection
  const chartData = isFDInv
    ? (() => {
        const tenureYrs = Math.max(1, Math.ceil(fdTenureYrs ?? 5));
        return Array.from({ length: tenureYrs + 1 }, (_, i) => ({
          year: `Y${i}`,
          corpus: Math.round(
            lumpCorpus(inv.amount || 0, inv.returnPct || 0, i),
          ),
          invested: Math.round(inv.amount || 0),
        }));
      })()
    : projectionData(
        inv.existingCorpus || 0,
        inv.amount,
        inv.returnPct,
        20,
        inv.frequency,
      );

  const save = () => {
    onUpdate({
      ...form,
      amount: Number(form.amount),
      returnPct: Number(form.returnPct),
      existingCorpus: isFD(form.type) ? 0 : Number(form.existingCorpus),
      deductionDate: form.deductionDate ? Number(form.deductionDate) : "",
    });
    setEditing(false);
  };

  return (
    <div
      className="card section-gap"
      style={{ borderLeft: `3px solid ${personColor}` }}
    >
      {editing ? (
        <div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            {[
              { key: "name", label: "Investment name", type: "text" },
              ...(!isFD(form.type)
                ? [
                    {
                      key: "existingCorpus",
                      label: "Current corpus (₹)",
                      type: "number",
                    },
                  ]
                : []),
              {
                key: "amount",
                label: isFD(form.type)
                  ? "Principal (₹)"
                  : form.frequency === "weekly"
                    ? "Weekly SIP (₹)"
                    : "Monthly SIP (₹)",
                type: "number",
              },
              {
                key: "returnPct",
                label: isFD(form.type)
                  ? "Interest rate (% p.a.)"
                  : "Expected return (%)",
                type: "number",
                step: 0.1,
              },
              {
                key: "bankName",
                label: "Bank / institution",
                type: "text",
                placeholder: "e.g. HDFC, SBI",
              },
              ...(!isFD(form.type)
                ? [
                    {
                      key: "totalInvested",
                      label: "Total invested so far (₹)",
                      type: "number",
                      placeholder: "Your actual principal / cost basis",
                    },
                  ]
                : []),
            ].map((f) => (
              <div key={f.key}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {f.label}
                </label>
                <input
                  type={f.type}
                  step={f.step}
                  value={form[f.key] ?? ""}
                  placeholder={f.placeholder || ""}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              </div>
            ))}
            {hasInvestmentApp(form.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Investment app
                </label>
                <select
                  value={form.appName || ""}
                  onChange={(e) =>
                    setForm({ ...form, appName: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {INVESTMENT_APPS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}
            {hasSIPFreq(form.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP frequency
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm({ ...form, frequency: e.target.value })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(form.type) ? "FD start date" : "Start date"}
              </label>
              <input
                type="date"
                value={form.startDate || ""}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </div>
            {isFD(form.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Maturity date
                </label>
                <input
                  type="date"
                  value={form.endDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            )}
            {hasDeductionDate(form.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP deduction date
                </label>
                <select
                  value={form.deductionDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, deductionDate: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinalSuffix(d)} of month
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={save}
            >
              <Check size={13} /> Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>
                {inv.name}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag tag-blue">{inv.type}</span>
                <span
                  className="tag"
                  style={{
                    background: "var(--gold-dim)",
                    color: "var(--gold)",
                  }}
                >
                  {inv.returnPct}% p.a.
                </span>
                {isFDInv ? (
                  <span
                    className="tag"
                    style={{
                      background: "var(--blue-dim, rgba(91,156,246,.12))",
                      color: "var(--blue)",
                    }}
                  >
                    ₹{inv.amount.toLocaleString("en-IN")} principal
                  </span>
                ) : (
                  <span
                    className="tag"
                    style={{
                      background:
                        inv.frequency === "weekly"
                          ? "var(--purple-dim)"
                          : "var(--green-dim)",
                      color:
                        inv.frequency === "weekly"
                          ? "var(--purple)"
                          : "var(--green)",
                    }}
                  >
                    {inv.frequency === "weekly"
                      ? `₹${inv.amount.toLocaleString("en-IN")}/week`
                      : `₹${inv.amount.toLocaleString("en-IN")}/month`}
                  </span>
                )}
              </div>
              {(inv.appName ||
                inv.bankName ||
                inv.deductionDate ||
                inv.endDate) && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  {inv.appName && (
                    <span className="tag tag-blue">{inv.appName}</span>
                  )}
                  {inv.bankName && (
                    <span
                      className="tag"
                      style={{
                        background: "var(--bg-card2)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {inv.bankName}
                    </span>
                  )}
                  {!isFDInv && inv.deductionDate && (
                    <span
                      className="tag"
                      style={{
                        background: "var(--bg-card2)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Due {ordinalSuffix(Number(inv.deductionDate))}
                    </span>
                  )}
                  {isFDInv && inv.endDate && (
                    <span
                      className="tag"
                      style={{
                        background: "var(--blue-dim, rgba(91,156,246,.12))",
                        color: "var(--blue)",
                      }}
                    >
                      Matures {inv.endDate}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="btn-icon"
                aria-label={`Edit ${inv.name}`}
                onClick={() => {
                  setForm(inv);
                  setEditing(true);
                }}
              >
                <Edit3 size={13} />
              </button>
              <button
                className="btn-icon"
                aria-label={`Delete ${inv.name}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Delete investment?",
                      `Remove "${inv.name}" and its projection data?`,
                    )
                  )
                    onDelete();
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Key numbers */}
          <div className="grid-4" style={{ marginBottom: "1rem" }}>
            <div className="metric-card">
              <div className="metric-label">
                {isFDInv ? "Principal" : "Current Value"}
              </div>
              <div
                className="metric-value"
                style={{ fontSize: 18, color: personColor }}
              >
                {isFDInv ? fmt(inv.amount || 0) : fmtCr(currentVal)}
              </div>
              <div className="metric-sub">
                {isFDInv ? "Deposited" : "Auto-calculated"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">
                {isFDInv ? "Value today" : "Monthly equiv."}
              </div>
              <div
                className="metric-value"
                style={{
                  fontSize: 18,
                  color: isFDInv ? "var(--gold)" : undefined,
                }}
              >
                {isFDInv ? fmtCr(currentVal) : fmt(effMonthly)}
              </div>
              <div className="metric-sub">
                {isFDInv ? "With interest" : inv.frequency}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">
                {isFDInv ? "Maturity value" : "10-year corpus"}
              </div>
              <div
                className="metric-value"
                style={{ fontSize: 18, color: "var(--blue)" }}
              >
                {isFDInv
                  ? fdMaturityVal !== null
                    ? fmtCr(fdMaturityVal)
                    : "Set end date"
                  : fmtCr(corpus10)}
              </div>
              {isFDInv && inv.endDate && (
                <div className="metric-sub">on {inv.endDate}</div>
              )}
            </div>
            <div className="metric-card">
              <div className="metric-label">
                {isFDInv ? "Interest earned" : "20-year corpus"}
              </div>
              <div
                className="metric-value"
                style={{ fontSize: 18, color: "var(--green)" }}
              >
                {isFDInv
                  ? fdMaturityVal !== null
                    ? fmtCr(fdMaturityVal - (inv.amount || 0))
                    : "—"
                  : fmtCr(corpus20)}
              </div>
            </div>
          </div>

          {/* Actual performance */}
          {actualGain !== null && (
            <div
              style={{
                background:
                  actualGain >= 0
                    ? "var(--green-dim, rgba(74,222,128,.08))"
                    : "var(--red-dim)",
                border: `1px solid ${
                  actualGain >= 0 ? "rgba(74,222,128,.2)" : "rgba(224,92,92,.2)"
                }`,
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: "1rem",
                fontSize: 13,
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  flexBasis: "100%",
                  marginBottom: -4,
                }}
              >
                Actual performance
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Invested:{" "}
                <strong style={{ color: "var(--text-primary, #fff)" }}>
                  {fmtCr(totalInvested)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Gain:{" "}
                <strong
                  style={{
                    color: actualGain >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {actualGain >= 0 ? "+" : ""}
                  {fmtCr(actualGain)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Return:{" "}
                <strong
                  style={{
                    color: actualReturnPct >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {actualReturnPct >= 0 ? "+" : ""}
                  {actualReturnPct.toFixed(1)}%
                </strong>
                {cagr !== null && (
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 400,
                      fontSize: 12,
                    }}
                  >
                    {" "}
                    ({cagr >= 0 ? "+" : ""}
                    {cagr.toFixed(1)}% p.a.)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Tax impact */}
          {taxOnGains > 0 && (
            <div
              style={{
                background: "var(--red-dim)",
                border: "1px solid rgba(224,92,92,.2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: "1rem",
                fontSize: 13,
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                LTCG tax (20yr):{" "}
                <strong style={{ color: "var(--red)" }}>
                  {fmtCr(taxOnGains)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Post-tax corpus:{" "}
                <strong style={{ color: "var(--green)" }}>
                  {fmtCr(postTax20)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Tax rate: 10% on gains above ₹1L (LTCG)
              </span>
            </div>
          )}

          {/* Growth chart */}
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`grad-${inv.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={personColor}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={personColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#55535e" }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis hide />
                <Tooltip
                  formatter={fmtCr}
                  contentStyle={{
                    background: "#13131a",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="corpus"
                  name="Corpus"
                  stroke={personColor}
                  strokeWidth={2}
                  fill={`url(#grad-${inv.id})`}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  name="Invested"
                  stroke="#55535e"
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default function Investments({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const investments = data?.investments || [];
  const [showAdd, setShowAdd] = useState(false);
  const [filterApp, setFilterApp] = useState("All");
  const allApps = [
    ...new Set(investments.map((x) => x.appName).filter(Boolean)),
  ];
  const filteredInvestments =
    filterApp === "All"
      ? investments
      : investments.filter((x) => x.appName === filterApp);
  const [newInv, setNewInv] = useState({
    name: "",
    amount: "",
    returnPct: 12,
    existingCorpus: 0,
    type: "Mutual Fund",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    appName: "",
    bankName: "",
    deductionDate: "",
    totalInvested: "",
  });

  const add = () => {
    if (!newInv.name || !newInv.amount) return;
    const updated = [
      ...investments,
      {
        ...newInv,
        id: nextId(investments),
        amount: Number(newInv.amount),
        returnPct: Number(newInv.returnPct),
        existingCorpus: Number(newInv.existingCorpus),
        deductionDate: newInv.deductionDate ? Number(newInv.deductionDate) : "",
        totalInvested: newInv.totalInvested ? Number(newInv.totalInvested) : 0,
      },
    ];
    updatePerson("investments", updated);
    setNewInv({
      name: "",
      amount: "",
      returnPct: 12,
      existingCorpus: 0,
      type: "Mutual Fund",
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      appName: "",
      bankName: "",
      deductionDate: "",
      totalInvested: "",
    });
    setShowAdd(false);
  };

  const totalMonthly = filteredInvestments.reduce(
    (s, x) =>
      isFD(x.type) ? s : s + x.amount * (x.frequency === "weekly" ? 4.33 : 1),
    0,
  );
  const totalCurrent = filteredInvestments.reduce((s, x) => {
    if (isFD(x.type)) {
      const yrs = x.startDate
        ? Math.max(
            0,
            (new Date() - new Date(x.startDate)) / (365.25 * 24 * 3600 * 1000),
          )
        : 0;
      return s + lumpCorpus(x.amount || 0, x.returnPct || 0, yrs);
    }
    return (
      s +
      autoCorpus(
        x.existingCorpus || 0,
        x.amount,
        x.returnPct,
        x.startDate,
        x.frequency,
      )
    );
  }, 0);
  const total20 = filteredInvestments.reduce((s, x) => {
    if (isFD(x.type)) {
      const tenureYrs =
        x.startDate && x.endDate
          ? Math.max(
              0,
              (new Date(x.endDate) - new Date(x.startDate)) /
                (365.25 * 24 * 3600 * 1000),
            )
          : 5;
      return s + lumpCorpus(x.amount || 0, x.returnPct || 0, tenureYrs);
    }
    return (
      s +
      totalCorpus(
        x.existingCorpus || 0,
        x.amount * (x.frequency === "weekly" ? 4.33 : 1),
        x.returnPct,
        20,
      )
    );
  }, 0);

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ color: personColor }}>{personName}'s</span> Investments
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
        }}
      >
        Corpus auto-updates monthly based on SIP start date and contributions.
      </div>

      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Monthly contribution</div>
          <div className="metric-value" style={{ color: personColor }}>
            {fmt(totalMonthly)}
          </div>
          <div className="metric-sub">
            {filteredInvestments.filter((x) => x.frequency === "weekly").length}{" "}
            weekly ·{" "}
            {filteredInvestments.filter((x) => x.frequency !== "weekly").length}{" "}
            monthly
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Current portfolio value</div>
          <div className="metric-value gold-text">{fmtCr(totalCurrent)}</div>
          <div className="metric-sub">Auto-calculated today</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">20-year projection</div>
          <div className="metric-value green-text">{fmtCr(total20)}</div>
          <div className="metric-sub">At avg. weighted return</div>
        </div>
      </div>

      {allApps.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 2 }}
          >
            Filter by app:
          </span>
          {["All", ...allApps].map((app) => (
            <button
              key={app}
              onClick={() => setFilterApp(app)}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                borderRadius: 99,
                border:
                  filterApp === app
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
                background:
                  filterApp === app ? "var(--gold-dim)" : "transparent",
                color:
                  filterApp === app ? "var(--gold)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: filterApp === app ? 500 : 400,
              }}
            >
              {app}
            </button>
          ))}
        </div>
      )}

      {filteredInvestments.map((inv) => (
        <SIPCard
          key={inv.id}
          inv={inv}
          personColor={personColor}
          onUpdate={(updated) =>
            updatePerson(
              "investments",
              investments.map((x) => (x.id === updated.id ? updated : x)),
            )
          }
          onDelete={() =>
            updatePerson(
              "investments",
              investments.filter((x) => x.id !== inv.id),
            )
          }
        />
      ))}

      {showAdd ? (
        <div className="card section-gap">
          <div className="card-title">Add Investment</div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Name
              </label>
              <input
                placeholder="e.g. Mirae Asset ELSS"
                value={newInv.name}
                onChange={(e) => setNewInv({ ...newInv, name: e.target.value })}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Type
              </label>
              <select
                value={newInv.type}
                onChange={(e) => setNewInv({ ...newInv, type: e.target.value })}
              >
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {hasSIPFreq(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Frequency
                </label>
                <select
                  value={newInv.frequency}
                  onChange={(e) =>
                    setNewInv({ ...newInv, frequency: e.target.value })
                  }
                >
                  <option value="monthly">Monthly SIP</option>
                  <option value="weekly">Weekly SIP</option>
                </select>
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(newInv.type)
                  ? "Principal (\u20b9)"
                  : newInv.frequency === "weekly"
                    ? "Weekly SIP amount (\u20b9)"
                    : "Monthly SIP amount (\u20b9)"}
              </label>
              <input
                type="number"
                placeholder={isFD(newInv.type) ? "e.g. 100000" : "e.g. 5000"}
                value={newInv.amount}
                onChange={(e) =>
                  setNewInv({ ...newInv, amount: e.target.value })
                }
              />
            </div>
            {!isFD(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Current corpus already invested (\u20b9)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 20000"
                  value={newInv.existingCorpus}
                  onChange={(e) =>
                    setNewInv({ ...newInv, existingCorpus: e.target.value })
                  }
                />
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(newInv.type)
                  ? "Interest rate (% p.a.)"
                  : "Expected annual return (%)"}
              </label>
              <input
                type="number"
                step="0.1"
                value={newInv.returnPct}
                onChange={(e) =>
                  setNewInv({ ...newInv, returnPct: e.target.value })
                }
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(newInv.type) ? "FD start date" : "SIP start date"}
              </label>
              <input
                type="date"
                value={newInv.startDate}
                onChange={(e) =>
                  setNewInv({ ...newInv, startDate: e.target.value })
                }
              />
            </div>
            {isFD(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Maturity date
                </label>
                <input
                  type="date"
                  value={newInv.endDate}
                  onChange={(e) =>
                    setNewInv({ ...newInv, endDate: e.target.value })
                  }
                />
              </div>
            )}
            {hasInvestmentApp(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Investment app
                </label>
                <select
                  value={newInv.appName}
                  onChange={(e) =>
                    setNewInv({ ...newInv, appName: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {INVESTMENT_APPS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(newInv.type) ? "Bank / institution" : "Bank account"}
              </label>
              <input
                placeholder="e.g. HDFC, SBI, Axis"
                value={newInv.bankName}
                onChange={(e) =>
                  setNewInv({ ...newInv, bankName: e.target.value })
                }
              />
            </div>
            {hasDeductionDate(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP deduction date
                </label>
                <select
                  value={newInv.deductionDate}
                  onChange={(e) =>
                    setNewInv({ ...newInv, deductionDate: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinalSuffix(d)} of month
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isFD(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Total invested so far (\u20b9)
                </label>
                <input
                  type="number"
                  placeholder="Your actual principal / cost basis"
                  value={newInv.totalInvested}
                  onChange={(e) =>
                    setNewInv({ ...newInv, totalInvested: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          {newInv.amount && (
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 13,
                display: "flex",
                gap: "1.5rem",
              }}
            >
              {isFD(newInv.type) ? (
                <>
                  <span>
                    Principal:{" "}
                    <strong style={{ color: personColor }}>
                      {fmt(Number(newInv.amount))}
                    </strong>
                  </span>
                  {newInv.endDate && newInv.startDate && (
                    <span>
                      Maturity:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {fmtCr(
                          lumpCorpus(
                            Number(newInv.amount),
                            Number(newInv.returnPct),
                            Math.max(
                              0,
                              (new Date(newInv.endDate) -
                                new Date(newInv.startDate)) /
                                (365.25 * 24 * 3600 * 1000),
                            ),
                          ),
                        )}
                      </strong>
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span>
                    Monthly equiv:{" "}
                    <strong style={{ color: personColor }}>
                      {fmt(
                        newInv.amount *
                          (newInv.frequency === "weekly" ? 4.33 : 1),
                      )}
                    </strong>
                  </span>
                  <span>
                    20yr corpus:{" "}
                    <strong style={{ color: "var(--green)" }}>
                      {fmtCr(
                        totalCorpus(
                          Number(newInv.existingCorpus),
                          Number(newInv.amount) *
                            (newInv.frequency === "weekly" ? 4.33 : 1),
                          Number(newInv.returnPct),
                          20,
                        ),
                      )}
                    </strong>
                  </span>
                </>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={add}>
              Add Investment
            </button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-ghost"
          style={{
            width: "100%",
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Investment
        </button>
      )}
    </div>
  );
}

export function HouseholdInvestments({ abhav, aanya, updatePerson }) {
  const [filterPerson, setFilterPerson] = useState("All");
  const [filterApp, setFilterApp] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [addFor, setAddFor] = useState("abhav");
  const emptyNew = {
    name: "",
    amount: "",
    returnPct: 12,
    existingCorpus: 0,
    type: "Mutual Fund",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    appName: "",
    bankName: "",
    deductionDate: "",
    totalInvested: "",
  };
  const [newInv, setNewInv] = useState(emptyNew);

  const abhavInvs = (abhav?.investments || []).map((x) => ({
    ...x,
    _owner: "abhav",
  }));
  const aanyaInvs = (aanya?.investments || []).map((x) => ({
    ...x,
    _owner: "aanya",
  }));
  const allInvestments = [...abhavInvs, ...aanyaInvs];
  const allApps = [
    ...new Set(allInvestments.map((x) => x.appName).filter(Boolean)),
  ];

  let filtered =
    filterPerson === "All"
      ? allInvestments
      : filterPerson === "abhav"
        ? abhavInvs
        : aanyaInvs;
  if (filterApp !== "All")
    filtered = filtered.filter((x) => x.appName === filterApp);

  const calcM = (list) => ({
    monthly: list.reduce(
      (s, x) =>
        isFD(x.type) ? s : s + x.amount * (x.frequency === "weekly" ? 4.33 : 1),
      0,
    ),
    current: list.reduce((s, x) => {
      if (isFD(x.type)) {
        const yrs = x.startDate
          ? Math.max(
              0,
              (new Date() - new Date(x.startDate)) /
                (365.25 * 24 * 3600 * 1000),
            )
          : 0;
        return s + lumpCorpus(x.amount || 0, x.returnPct || 0, yrs);
      }
      return (
        s +
        autoCorpus(
          x.existingCorpus || 0,
          x.amount,
          x.returnPct,
          x.startDate,
          x.frequency,
        )
      );
    }, 0),
    yr20: list.reduce((s, x) => {
      if (isFD(x.type)) {
        const tenureYrs =
          x.startDate && x.endDate
            ? Math.max(
                0,
                (new Date(x.endDate) - new Date(x.startDate)) /
                  (365.25 * 24 * 3600 * 1000),
              )
            : 5;
        return s + lumpCorpus(x.amount || 0, x.returnPct || 0, tenureYrs);
      }
      return (
        s +
        totalCorpus(
          x.existingCorpus || 0,
          x.amount * (x.frequency === "weekly" ? 4.33 : 1),
          x.returnPct,
          20,
        )
      );
    }, 0),
  });
  const m = calcM(filtered);
  const mA = calcM(abhavInvs);
  const mAn = calcM(aanyaInvs);

  const add = () => {
    if (!newInv.name || !newInv.amount) return;
    const ownerData = addFor === "abhav" ? abhav : aanya;
    const existing = ownerData?.investments || [];
    updatePerson(addFor, "investments", [
      ...existing,
      {
        ...newInv,
        id: nextId(existing),
        amount: Number(newInv.amount),
        returnPct: Number(newInv.returnPct),
        existingCorpus: Number(newInv.existingCorpus),
        deductionDate: newInv.deductionDate ? Number(newInv.deductionDate) : "",
        totalInvested: newInv.totalInvested ? Number(newInv.totalInvested) : 0,
      },
    ]);
    setNewInv(emptyNew);
    setShowAdd(false);
  };

  const pColor = (o) => (o === "abhav" ? "var(--abhav)" : "var(--aanya)");
  const pLabel = (o) => (o === "abhav" ? "Abhav" : "Aanya");

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ color: "var(--gold)" }}>Household</span> Investments
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: "1.25rem",
        }}
      >
        Combined view across both profiles.
      </div>

      {/* Summary metrics */}
      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Monthly contribution</div>
          <div className="metric-value" style={{ color: "var(--gold)" }}>
            {fmt(m.monthly)}
          </div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>
              Abhav {fmt(mA.monthly)}
            </span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>
              Aanya {fmt(mAn.monthly)}
            </span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Current portfolio value</div>
          <div className="metric-value gold-text">{fmtCr(m.current)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmtCr(mA.current)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmtCr(mAn.current)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">20-year projection</div>
          <div className="metric-value green-text">{fmtCr(m.yr20)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmtCr(mA.yr20)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmtCr(mAn.yr20)}</span>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Person:
          </span>
          {[
            { id: "All", label: "All", color: "var(--gold)" },
            { id: "abhav", label: "Abhav", color: "var(--abhav)" },
            { id: "aanya", label: "Aanya", color: "var(--aanya)" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterPerson(p.id)}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                borderRadius: 99,
                cursor: "pointer",
                border:
                  filterPerson === p.id
                    ? `1px solid ${p.color}`
                    : "1px solid var(--border)",
                background:
                  filterPerson === p.id ? `${p.color}22` : "transparent",
                color:
                  filterPerson === p.id ? p.color : "var(--text-secondary)",
                fontWeight: filterPerson === p.id ? 500 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {allApps.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              App:
            </span>
            {["All", ...allApps].map((app) => (
              <button
                key={app}
                onClick={() => setFilterApp(app)}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  borderRadius: 99,
                  cursor: "pointer",
                  border:
                    filterApp === app
                      ? "1px solid var(--gold)"
                      : "1px solid var(--border)",
                  background:
                    filterApp === app ? "var(--gold-dim)" : "transparent",
                  color:
                    filterApp === app ? "var(--gold)" : "var(--text-secondary)",
                  fontWeight: filterApp === app ? 500 : 400,
                }}
              >
                {app}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      {filtered.map((inv) => {
        const owner = inv._owner;
        const ownerData = owner === "abhav" ? abhav : aanya;
        const { _owner, ...cleanInv } = inv;
        return (
          <div key={`${owner}-${inv.id}`} style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 1,
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 99,
                background: `${pColor(owner)}1a`,
                color: pColor(owner),
                border: `1px solid ${pColor(owner)}44`,
                pointerEvents: "none",
              }}
            >
              {pLabel(owner)}
            </div>
            <SIPCard
              inv={cleanInv}
              personColor={pColor(owner)}
              onUpdate={(updated) => {
                const list = ownerData?.investments || [];
                updatePerson(
                  owner,
                  "investments",
                  list.map((x) => (x.id === updated.id ? updated : x)),
                );
              }}
              onDelete={() => {
                const list = ownerData?.investments || [];
                updatePerson(
                  owner,
                  "investments",
                  list.filter((x) => x.id !== inv.id),
                );
              }}
            />
          </div>
        );
      })}

      {/* Add */}
      {showAdd ? (
        <div className="card section-gap">
          <div className="card-title">Add Investment</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { id: "abhav", label: "Abhav", color: "var(--abhav)" },
              { id: "aanya", label: "Aanya", color: "var(--aanya)" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setAddFor(p.id)}
                style={{
                  padding: "6px 18px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  cursor: "pointer",
                  border:
                    addFor === p.id
                      ? `1px solid ${p.color}`
                      : "1px solid var(--border)",
                  background: addFor === p.id ? `${p.color}22` : "transparent",
                  color: addFor === p.id ? p.color : "var(--text-secondary)",
                  fontWeight: addFor === p.id ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            {[
              { key: "name", label: "Investment name", type: "text" },
              ...(!isFD(newInv.type)
                ? [
                    {
                      key: "existingCorpus",
                      label: "Current corpus (₹)",
                      type: "number",
                    },
                  ]
                : []),
              {
                key: "amount",
                label: isFD(newInv.type)
                  ? "Principal (₹)"
                  : newInv.frequency === "weekly"
                    ? "Weekly SIP (₹)"
                    : "Monthly SIP (₹)",
                type: "number",
              },
              {
                key: "returnPct",
                label: isFD(newInv.type)
                  ? "Interest rate (% p.a.)"
                  : "Expected return (%)",
                type: "number",
                step: 0.1,
              },
              {
                key: "bankName",
                label: isFD(newInv.type)
                  ? "Bank / institution"
                  : "Bank account",
                type: "text",
                placeholder: "e.g. HDFC, SBI, Axis",
              },
              ...(!isFD(newInv.type)
                ? [
                    {
                      key: "totalInvested",
                      label: "Total invested so far (₹)",
                      type: "number",
                      placeholder: "Actual principal / cost basis",
                    },
                  ]
                : []),
            ].map((f) => (
              <div key={f.key}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {f.label}
                </label>
                <input
                  type={f.type}
                  step={f.step}
                  value={newInv[f.key] ?? ""}
                  placeholder={f.placeholder || ""}
                  onChange={(e) =>
                    setNewInv({ ...newInv, [f.key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Type
              </label>
              <select
                value={newInv.type}
                onChange={(e) => setNewInv({ ...newInv, type: e.target.value })}
              >
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {hasSIPFreq(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Frequency
                </label>
                <select
                  value={newInv.frequency}
                  onChange={(e) =>
                    setNewInv({ ...newInv, frequency: e.target.value })
                  }
                >
                  <option value="monthly">Monthly SIP</option>
                  <option value="weekly">Weekly SIP</option>
                </select>
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {isFD(newInv.type) ? "FD start date" : "SIP start date"}
              </label>
              <input
                type="date"
                value={newInv.startDate}
                onChange={(e) =>
                  setNewInv({ ...newInv, startDate: e.target.value })
                }
              />
            </div>
            {isFD(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Maturity date
                </label>
                <input
                  type="date"
                  value={newInv.endDate}
                  onChange={(e) =>
                    setNewInv({ ...newInv, endDate: e.target.value })
                  }
                />
              </div>
            )}
            {hasInvestmentApp(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Investment app
                </label>
                <select
                  value={newInv.appName}
                  onChange={(e) =>
                    setNewInv({ ...newInv, appName: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {INVESTMENT_APPS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}
            {hasDeductionDate(newInv.type) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP deduction date
                </label>
                <select
                  value={newInv.deductionDate}
                  onChange={(e) =>
                    setNewInv({ ...newInv, deductionDate: e.target.value })
                  }
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinalSuffix(d)} of month
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {newInv.amount && (
            <div
              style={{
                background: "var(--bg-card2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 13,
                display: "flex",
                gap: "1.5rem",
              }}
            >
              {isFD(newInv.type) ? (
                <>
                  <span>
                    Principal:{" "}
                    <strong style={{ color: pColor(addFor) }}>
                      {fmt(Number(newInv.amount))}
                    </strong>
                  </span>
                  {newInv.endDate && newInv.startDate && (
                    <span>
                      Maturity:{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {fmtCr(
                          lumpCorpus(
                            Number(newInv.amount),
                            Number(newInv.returnPct),
                            Math.max(
                              0,
                              (new Date(newInv.endDate) -
                                new Date(newInv.startDate)) /
                                (365.25 * 24 * 3600 * 1000),
                            ),
                          ),
                        )}
                      </strong>
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span>
                    Monthly equiv:{" "}
                    <strong style={{ color: pColor(addFor) }}>
                      {fmt(
                        newInv.amount *
                          (newInv.frequency === "weekly" ? 4.33 : 1),
                      )}
                    </strong>
                  </span>
                  <span>
                    20yr corpus:{" "}
                    <strong style={{ color: "var(--green)" }}>
                      {fmtCr(
                        totalCorpus(
                          Number(newInv.existingCorpus),
                          Number(newInv.amount) *
                            (newInv.frequency === "weekly" ? 4.33 : 1),
                          Number(newInv.returnPct),
                          20,
                        ),
                      )}
                    </strong>
                  </span>
                </>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              onClick={add}
              style={{ background: pColor(addFor) }}
            >
              Add to {pLabel(addFor)}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setNewInv(emptyNew);
                setShowAdd(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-ghost"
          style={{
            width: "100%",
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Investment
        </button>
      )}
    </div>
  );
}
