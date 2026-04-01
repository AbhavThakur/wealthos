import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Chart, DonutChart } from "../components/Chart";
import {
  fmt,
  fmtCr,
  nextId,
  INVESTMENT_TYPES,
  totalCorpus,
  ppfCorpus,
  fdCorpus,
  ltcgTax,
  lumpCorpus,
  freqToMonthly,
  sipCorpus,
  weekdayCountInMonth,
} from "../utils/finance";
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Download,
  Pause,
  Play,
} from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { useData } from "../context/DataContext";
import { fetchAllMFNavs } from "../utils/marketData";
import {
  INVESTMENT_APPS,
  BANK_LIST,
  ordinalSuffix,
  isFD,
  hasSIPFreq,
  hasDeductionDate,
  hasDeductionMonth,
  hasInvestmentApp,
  DEDUCTION_DAYS,
  WEEKDAYS,
  MONTHS,
  computeInvRow,
  getInvested,
} from "./investmentHelpers";

// ─── mfapi.in helpers ────────────────────────────────────────────────────────
async function mfSearch(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`,
    );
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

async function mfLatestNAV(schemeCode) {
  try {
    const res = await fetch(
      `https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`,
    );
    const json = await res.json();
    if (json.status === "SUCCESS" && json.data?.[0]) {
      return { nav: parseFloat(json.data[0].nav), date: json.data[0].date };
    }
    return null;
  } catch {
    return null;
  }
}

import { InfoModal } from "../components/InfoModal";
export { InfoModal } from "../components/InfoModal";

export const SIPCard = memo(function SIPCard({
  inv,
  onUpdate,
  onDelete,
  personColor,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(inv);
  const [projYears, setProjYears] = useState(20);
  const { confirm, dialog } = useConfirm();
  const [navLoading, setNavLoading] = useState(false);
  const [navMsg, setNavMsg] = useState("");
  const [showLogValue, setShowLogValue] = useState(false);
  const [logEntry, setLogEntry] = useState({
    date: new Date().toISOString().slice(0, 10),
    value: "",
    note: "",
  });
  const [showHistory, setShowHistory] = useState(false);
  const [chartView, setChartView] = useState("projection"); // "projection" | "breakdown" | "actual"
  const [showReal, setShowReal] = useState(false); // inflation-adjusted toggle
  const INFLATION = 6; // India CPI avg ~6%

  const corpusHistory = inv.corpusHistory || [];
  const sortedHistory = [...corpusHistory].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  const historyChartData = [...corpusHistory]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((h) => ({ date: h.date.slice(0, 7), value: h.value }));

  const logValue = () => {
    if (!logEntry.value) return;
    const newEntry = {
      date: logEntry.date,
      value: Number(logEntry.value),
      note: logEntry.note,
    };
    onUpdate({
      ...inv,
      corpusHistory: [...corpusHistory, newEntry],
      existingCorpus: Number(logEntry.value),
    });
    setLogEntry({
      date: new Date().toISOString().slice(0, 10),
      value: "",
      note: "",
    });
    setShowLogValue(false);
  };

  const isFDInv = isFD(inv.type);
  const isOneTimeInv = inv.frequency === "onetime";
  const isPPF = inv.type === "PPF";
  const effMonthly =
    isFDInv || isOneTimeInv ? 0 : freqToMonthly(inv.amount, inv.frequency);
  // For weekly SIPs: exact count of the deduction weekday in the current month
  const thisMonthCount =
    inv.frequency === "weekly" && inv.deductionDay
      ? weekdayCountInMonth(inv.deductionDay)
      : null;
  const thisMonthAmount =
    thisMonthCount !== null ? inv.amount * thisMonthCount : null;

  // FD/onetime: compound growth on lump-sum principal; others: SIP-based auto corpus
  const fdYrsElapsed =
    (isFDInv || isOneTimeInv) && inv.startDate
      ? Math.max(
          0,
          (new Date() - new Date(inv.startDate)) / (365.25 * 24 * 3600 * 1000),
        )
      : 0;
  // FD uses exact 365-day year + quarterly compounding to match Indian bank calc
  const fdElapsedExact =
    isFDInv && inv.startDate
      ? Math.max(
          0,
          (new Date() - new Date(inv.startDate)) / (365 * 24 * 3600 * 1000),
        )
      : 0;
  const currentVal = isFDInv
    ? fdCorpus(inv.amount || 0, inv.returnPct || 0, fdElapsedExact)
    : isOneTimeInv
      ? // If user entered current market value from app, use that; else project forward
        inv.existingCorpus > 0
        ? inv.existingCorpus
        : lumpCorpus(inv.amount || 0, inv.returnPct || 0, fdYrsElapsed)
      : inv.existingCorpus || 0; // actual current value from investment app

  // FD maturity value (based on start + end date)
  const fdTenureYrs =
    isFDInv && inv.startDate && inv.endDate
      ? Math.max(
          0,
          (new Date(inv.endDate) - new Date(inv.startDate)) /
            (365 * 24 * 3600 * 1000),
        )
      : null;
  const fdMaturityVal =
    fdTenureYrs !== null
      ? fdCorpus(inv.amount || 0, inv.returnPct || 0, fdTenureYrs)
      : null;

  // Actual performance
  const totalInvested = getInvested(inv);
  const isAutoInvested =
    !isFDInv && !isOneTimeInv && !(Number(inv.totalInvested) > 0);
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
  // Flexible projection (projYears state)
  const corpusN = isFDInv
    ? null
    : isOneTimeInv
      ? lumpCorpus(currentVal, inv.returnPct || 0, projYears)
      : totalCorpus(
          inv.existingCorpus || 0,
          effMonthly,
          inv.returnPct || 0,
          projYears,
        );
  const gainsN =
    corpusN != null
      ? corpusN -
        ((isOneTimeInv
          ? (inv.existingCorpus || 0) + (inv.amount || 0)
          : inv.existingCorpus || 0) +
          effMonthly * 12 * projYears)
      : 0;
  const taxOnGains =
    !isFDInv && (inv.type === "Mutual Fund" || inv.type === "Stocks")
      ? ltcgTax(gainsN)
      : 0;
  const postTaxN = corpusN != null ? corpusN - taxOnGains : 0;
  // Insight: monthly SIP needed to reach ₹1Cr in projYears (at same return rate)
  const targetCr = 1_00_00_000;
  const r = (inv.returnPct || 12) / 100 / 12;
  const n = projYears * 12;
  const sipNeededForCr =
    !isFDInv && !isOneTimeInv && !isPPF && r > 0
      ? (targetCr * r) / (Math.pow(1 + r, n) - 1)
      : null;

  // PPF fixed milestones (tax-free, 15-yr account)
  const ppfRate = inv.returnPct || 7.1;
  const ppfYearly = effMonthly * 12;
  const ppf5yr = isPPF
    ? ppfCorpus(inv.existingCorpus || 0, ppfYearly, ppfRate, 5)
    : 0;
  const ppf10yr = isPPF
    ? ppfCorpus(inv.existingCorpus || 0, ppfYearly, ppfRate, 10)
    : 0;
  const ppf15yr = isPPF
    ? ppfCorpus(inv.existingCorpus || 0, ppfYearly, ppfRate, 15)
    : 0;
  // PPF maturity: years remaining from today to maturityDate
  const ppfYearsToMaturity =
    isPPF && inv.maturityDate
      ? Math.max(
          0,
          (new Date(inv.maturityDate) - new Date()) /
            (365.25 * 24 * 3600 * 1000),
        )
      : null;
  const ppfMaturityCorpus =
    ppfYearsToMaturity !== null
      ? ppfCorpus(
          inv.existingCorpus || 0,
          ppfYearly,
          ppfRate,
          ppfYearsToMaturity,
        )
      : null;

  // Chart: FD shows yearly compound growth to maturity; onetime: lump sum growth; others: 20yr SIP projection
  const chartData = (() => {
    if (isFDInv) {
      const tenureYrs = Math.max(1, Math.ceil(fdTenureYrs ?? 5));
      return Array.from({ length: tenureYrs + 1 }, (_, i) => ({
        year: `Y${i}`,
        corpus: Math.round(fdCorpus(inv.amount || 0, inv.returnPct || 0, i)),
        invested: Math.round(inv.amount || 0),
      }));
    }
    if (isOneTimeInv) {
      const base = currentVal;
      return Array.from({ length: 21 }, (_, i) => ({
        year: `Y${i}`,
        corpus: Math.round(lumpCorpus(base, inv.returnPct || 0, i)),
        invested: Math.round(base),
      }));
    }
    const _now = new Date();
    const elapsedYrs = inv.startDate
      ? Math.max(
          0,
          (_now - new Date(inv.startDate)) / (365.25 * 24 * 3600 * 1000),
        )
      : 0;
    const idealNow =
      elapsedYrs > 0
        ? sipCorpus(effMonthly, inv.returnPct || 0, elapsedYrs)
        : inv.existingCorpus || 0;
    const actualBase = inv.existingCorpus || 0;
    const totalInv = getInvested(inv);
    const pts = [
      {
        year: "Now",
        corpus: Math.round(actualBase),
        expected: Math.round(idealNow),
        invested: Math.round(totalInv),
      },
    ];
    for (let y = 1; y <= 20; y++) {
      pts.push({
        year: `Y${y}`,
        corpus: Math.round(
          totalCorpus(actualBase, effMonthly, inv.returnPct || 0, y),
        ),
        expected: Math.round(
          totalCorpus(idealNow, effMonthly, inv.returnPct || 0, y),
        ),
        invested: Math.round(totalInv + effMonthly * 12 * y),
      });
    }
    return pts;
  })();

  // Apply inflation discount for "real value" view
  const deflate = (val, years) =>
    showReal ? val / Math.pow(1 + INFLATION / 100, years) : val;
  const displayChartData = chartData.map((d, i) => ({
    ...d,
    corpus: Math.round(deflate(d.corpus, i)),
    invested: Math.round(deflate(d.invested, i)),
    ...(d.expected != null
      ? { expected: Math.round(deflate(d.expected, i)) }
      : {}),
  }));

  // Breakdown chart: invested vs gains stacked per year
  const breakdownData =
    !isFDInv && !isOneTimeInv
      ? Array.from({ length: projYears }, (_, i) => {
          const y = i + 1;
          const totalInv0 = getInvested(inv);
          const totalInvY = Math.round(totalInv0 + effMonthly * 12 * y);
          const corpusY = Math.round(
            totalCorpus(
              inv.existingCorpus || 0,
              effMonthly,
              inv.returnPct || 0,
              y,
            ),
          );
          return {
            year: `Y${y}`,
            invested: totalInvY,
            gains: Math.max(0, corpusY - totalInvY),
          };
        })
      : [];

  const save = useCallback(() => {
    onUpdate({
      ...form,
      amount: Number(form.amount),
      returnPct: Number(form.returnPct),
      existingCorpus: isFD(form.type) ? 0 : Number(form.existingCorpus),
      deductionDate: form.deductionDate ? Number(form.deductionDate) : "",
      units: form.units ? Number(form.units) : 0,
    });
    setEditing(false);
  }, [form, onUpdate]);

  return (
    <div
      className="card section-gap"
      style={{
        borderLeft: `3px solid ${personColor}`,
        ...(inv.paused ? { opacity: 0.55 } : {}),
      }}
    >
      {inv.paused && (
        <div
          style={{
            display: "inline-block",
            background: "var(--gold)",
            color: "#000",
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            marginBottom: 8,
            letterSpacing: 0.5,
          }}
        >
          PAUSED
        </div>
      )}
      {editing ? (
        <div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            {[
              // Edit form fields
              { key: "name", label: "Investment name", type: "text" },
              {
                key: "amount",
                label: isFD(form.type)
                  ? "Principal (₹)"
                  : form.frequency === "onetime"
                    ? "Amount invested / Purchase price (₹)"
                    : form.frequency === "weekly"
                      ? "Weekly SIP (₹)"
                      : form.frequency === "yearly"
                        ? "Yearly SIP (₹)"
                        : "Monthly SIP (₹)",
                type: "number",
              },
              ...(!isFD(form.type)
                ? [
                    {
                      key: "existingCorpus",
                      label:
                        form.frequency === "onetime"
                          ? "Current market value (₹)"
                          : "Current corpus (₹)",
                      type: "number",
                      placeholder:
                        form.frequency === "onetime"
                          ? "From your app — update manually"
                          : "",
                    },
                  ]
                : []),
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
              ...(!isFD(form.type) && form.frequency !== "onetime"
                ? [
                    {
                      key: "totalInvested",
                      label: "Total invested override (₹)",
                      type: "number",
                      placeholder: "Auto-calculated if empty",
                    },
                  ]
                : []),
              ...(form.type === "Mutual Fund"
                ? [
                    {
                      key: "units",
                      label: "Units held",
                      type: "number",
                      step: 0.001,
                      placeholder: "From your app — enables auto valuation",
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
                  {...(f.key === "bankName" ? { list: "bank-list-edit" } : {})}
                />
                {f.key === "bankName" && (
                  <datalist id="bank-list-edit">
                    {BANK_LIST.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                )}
                {["amount", "existingCorpus", "totalInvested"].includes(
                  f.key,
                ) &&
                  Number(form[f.key]) > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 3,
                      }}
                    >
                      = {fmt(Number(form[f.key]))}
                    </div>
                  )}
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
                  <option value="yearly">Yearly</option>
                  <option value="onetime">One-time</option>
                </select>
              </div>
            )}
            {(form.type === "Mutual Fund" || form.type === "Stocks") && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Fund category
                </label>
                <select
                  value={form.capCategory || ""}
                  onChange={(e) =>
                    setForm({ ...form, capCategory: e.target.value })
                  }
                >
                  {MF_CAP_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
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
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => {
                  const t = e.target.value;
                  setForm({
                    ...form,
                    type: t,
                    frequency:
                      t === "PPF" || t === "ULIP"
                        ? "yearly"
                        : t === "FD"
                          ? "onetime"
                          : form.frequency === "yearly" ||
                              form.frequency === "onetime"
                            ? "monthly"
                            : form.frequency,
                  });
                }}
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
            {form.type === "PPF" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  PPF maturity date
                </label>
                <input
                  type="date"
                  value={form.maturityDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, maturityDate: e.target.value })
                  }
                />
              </div>
            )}
            {hasDeductionDate(form.type, form.frequency) && (
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
                  {DEDUCTION_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {ordinalSuffix(d)} of month
                    </option>
                  ))}
                </select>
              </div>
            )}
            {hasDeductionMonth(form.frequency) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP deduction month
                </label>
                <select
                  value={form.deductionMonth ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      deductionMonth:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Not set (Jan)</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {["Mutual Fund", "Stocks", "Gold", "NPS", "ULIP"].includes(
              form.type,
            ) &&
              form.frequency === "weekly" && (
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    SIP day of week
                  </label>
                  <select
                    value={form.deductionDay || ""}
                    onChange={(e) =>
                      setForm({ ...form, deductionDay: e.target.value })
                    }
                  >
                    <option value="">Not set</option>
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
          {form.type === "Mutual Fund" && (
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Scheme code (mfapi.in)
                </label>
                <input
                  placeholder="e.g. 125497 — search at mfapi.in"
                  value={form.schemeCode || ""}
                  onChange={(e) => {
                    setForm({ ...form, schemeCode: e.target.value });
                    setNavMsg("");
                  }}
                />
              </div>
              <button
                className="btn-ghost"
                style={{ whiteSpace: "nowrap", opacity: navLoading ? 0.6 : 1 }}
                disabled={navLoading || !form.schemeCode}
                onClick={async () => {
                  if (!form.schemeCode) return;
                  setNavLoading(true);
                  setNavMsg("");
                  const result = await mfLatestNAV(form.schemeCode);
                  setNavLoading(false);
                  if (result) {
                    setForm((f) => {
                      const updated = {
                        ...f,
                        latestNav: result.nav,
                        navDate: result.date,
                      };
                      const units =
                        Number(f.units) > 0
                          ? f.units
                          : Number(f.existingCorpus) > 0 &&
                              Number(f.latestNav) > 0
                            ? Math.round(
                                (f.existingCorpus / f.latestNav) * 10000,
                              ) / 10000
                            : 0;
                      if (units > 0) {
                        updated.units = units;
                        updated.existingCorpus =
                          Math.round(units * result.nav * 100) / 100;
                      }
                      return updated;
                    });
                    const derivedUnits =
                      Number(form.units) > 0
                        ? form.units
                        : Number(form.existingCorpus) > 0 &&
                            Number(form.latestNav) > 0
                          ? Math.round(
                              (form.existingCorpus / form.latestNav) * 10000,
                            ) / 10000
                          : 0;
                    setNavMsg(
                      `\u2713 NAV \u20b9${result.nav} as of ${result.date}${derivedUnits > 0 ? ` \u2192 Value \u20b9${Math.round(derivedUnits * result.nav)}` : ""}`,
                    );
                  } else {
                    setNavMsg("Not found — check scheme code");
                  }
                }}
              >
                {navLoading ? "Fetching\u2026" : "Fetch live NAV"}
              </button>
            </div>
          )}
          {navMsg && (
            <div
              style={{
                fontSize: 12,
                marginBottom: 10,
                color: navMsg.startsWith("\u2713")
                  ? "var(--green)"
                  : "var(--red, #e55)",
              }}
            >
              {navMsg}
            </div>
          )}
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
                ) : isOneTimeInv ? (
                  <span
                    className="tag"
                    style={{
                      background: "var(--purple-dim)",
                      color: "var(--purple)",
                    }}
                  >
                    ₹{inv.amount.toLocaleString("en-IN")} one-time
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
                  {inv.capCategory && capCategoryMap[inv.capCategory] && (
                    <span
                      className="tag"
                      style={{
                        background: "rgba(91,156,246,0.1)",
                        color: "#7eb3f8",
                      }}
                    >
                      {capCategoryMap[inv.capCategory].label}
                    </span>
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
                  {!isFDInv &&
                    !isOneTimeInv &&
                    inv.frequency === "weekly" &&
                    inv.deductionDay && (
                      <span
                        className="tag"
                        style={{
                          background: "var(--bg-card2)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Every {inv.deductionDay}
                      </span>
                    )}
                  {!isFDInv &&
                    !isOneTimeInv &&
                    inv.frequency !== "weekly" &&
                    inv.deductionDate && (
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
                  {inv.latestNav && inv.navDate && (
                    <span
                      className="tag"
                      style={{
                        background: "rgba(76,175,130,0.1)",
                        color: "var(--green)",
                      }}
                    >
                      NAV ₹{inv.latestNav} · {inv.navDate}
                      {Number(inv.units) > 0 && ` · ${inv.units} units`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {!isFDInv && !isOneTimeInv && (
                <button
                  className="btn-icon"
                  aria-label={inv.paused ? "Resume SIP" : "Pause SIP"}
                  title={inv.paused ? "Resume SIP" : "Pause SIP"}
                  onClick={() => onUpdate({ ...inv, paused: !inv.paused })}
                  style={inv.paused ? { color: "var(--gold)" } : {}}
                >
                  {inv.paused ? <Play size={13} /> : <Pause size={13} />}
                </button>
              )}
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
                {isFDInv
                  ? "Principal"
                  : isOneTimeInv
                    ? "Purchase price"
                    : "Current Value"}
              </div>
              <div
                className="metric-value"
                style={{ fontSize: 18, color: personColor }}
              >
                {isFDInv
                  ? fmt(inv.amount || 0)
                  : isOneTimeInv
                    ? fmt(inv.amount || 0)
                    : fmt(Math.round(currentVal))}
              </div>
              <div className="metric-sub">
                {isFDInv
                  ? "Deposited"
                  : isOneTimeInv
                    ? "Original cost"
                    : "Your actual value"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">
                {isFDInv || isOneTimeInv
                  ? "Value today"
                  : isPPF
                    ? "Yearly contrib."
                    : "Monthly equiv."}
              </div>
              <div
                className="metric-value"
                style={{
                  fontSize: 18,
                  color: isFDInv || isOneTimeInv ? "var(--gold)" : undefined,
                }}
              >
                {isFDInv || isOneTimeInv
                  ? fmt(Math.round(currentVal))
                  : isPPF
                    ? fmt(effMonthly * 12)
                    : thisMonthAmount !== null
                      ? fmt(thisMonthAmount)
                      : fmt(effMonthly)}
              </div>
              <div className="metric-sub">
                {isFDInv
                  ? "With growth"
                  : isOneTimeInv
                    ? inv.existingCorpus > 0
                      ? "From your app"
                      : "Projected"
                    : isPPF
                      ? `${Math.min(100, Math.round(((effMonthly * 12) / 150000) * 100))}% of ₹1.5L/yr limit`
                      : thisMonthCount !== null
                        ? `${thisMonthCount} ${inv.deductionDay}s this month`
                        : inv.frequency}
              </div>
            </div>
            {/* ── Interactive projection card ── */}
            <div
              className="metric-card"
              style={{
                gridColumn: isPPF ? "span 2" : isFDInv ? undefined : "span 1",
              }}
            >
              <div className="metric-label">
                {isFDInv
                  ? "Maturity value"
                  : isPPF
                    ? "PPF Milestones"
                    : `${projYears}-year value`}
              </div>
              {isPPF ? (
                <div style={{ marginTop: 4 }}>
                  {ppfMaturityCorpus !== null && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "7px 0 5px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                        Maturity{" "}
                        <span style={{ fontWeight: 400, fontSize: 11 }}>
                          (
                          {new Date(inv.maturityDate).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}
                          )
                        </span>
                      </span>
                      <strong style={{ color: "var(--gold)" }}>
                        {fmt(Math.round(ppfMaturityCorpus))}
                      </strong>
                    </div>
                  )}
                  {[
                    [5, ppf5yr],
                    [10, ppf10yr],
                    [15, ppf15yr],
                  ].map(([yrs, val]) => (
                    <div
                      key={yrs}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        +{yrs} yr from now
                      </span>
                      <strong style={{ color: "var(--blue)" }}>
                        {fmt(Math.round(val))}
                      </strong>
                    </div>
                  ))}
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 6,
                    }}
                  >
                    At {ppfRate}% p.a. · tax-free
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="metric-value"
                    style={{ fontSize: 18, color: "var(--blue)" }}
                  >
                    {isFDInv
                      ? fdMaturityVal !== null
                        ? fmt(fdMaturityVal)
                        : "Set end date"
                      : fmtCr(corpusN)}
                  </div>
                  {isFDInv && inv.endDate && (
                    <div className="metric-sub">on {inv.endDate}</div>
                  )}
                  {!isFDInv && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="range"
                        min={1}
                        max={40}
                        value={projYears}
                        onChange={(e) => setProjYears(Number(e.target.value))}
                        style={{
                          width: "100%",
                          accentColor: "var(--blue)",
                          cursor: "pointer",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        <span>1yr</span>
                        <span style={{ color: "var(--blue)", fontWeight: 600 }}>
                          {projYears} yrs
                        </span>
                        <span>40yr</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Insight card ── */}
            {!isPPF && (
              <div className="metric-card">
                {isFDInv ? (
                  <>
                    <div className="metric-label">Interest earned</div>
                    <div
                      className="metric-value"
                      style={{ fontSize: 18, color: "var(--green)" }}
                    >
                      {fdMaturityVal !== null
                        ? fmt(fdMaturityVal - (inv.amount || 0))
                        : "—"}
                    </div>
                    <div className="metric-sub">Total gain at maturity</div>
                  </>
                ) : isOneTimeInv ? (
                  <>
                    <div className="metric-label">Post-tax ({projYears}yr)</div>
                    <div
                      className="metric-value"
                      style={{ fontSize: 18, color: "var(--green)" }}
                    >
                      {fmtCr(postTaxN)}
                    </div>
                    <div className="metric-sub">
                      {taxOnGains > 0
                        ? `After ${fmtCr(taxOnGains)} LTCG`
                        : "No LTCG applicable"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metric-label">SIP for ₹1 Cr</div>
                    <div
                      className="metric-value"
                      style={{ fontSize: 18, color: "var(--gold)" }}
                    >
                      {sipNeededForCr !== null
                        ? fmt(Math.round(sipNeededForCr))
                        : "—"}
                    </div>
                    <div className="metric-sub">
                      /month in {projYears} yrs at {inv.returnPct}%
                    </div>
                  </>
                )}
              </div>
            )}
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
                {isAutoInvested && (
                  <span
                    style={{
                      textTransform: "none",
                      letterSpacing: 0,
                      fontWeight: 400,
                      marginLeft: 6,
                      opacity: 0.6,
                    }}
                  >
                    (invested is estimated — enter exact from app for accuracy)
                  </span>
                )}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Invested:{" "}
                <strong style={{ color: "var(--text-primary, #fff)" }}>
                  {isAutoInvested && "~"}
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
                LTCG tax ({projYears}yr):{" "}
                <strong style={{ color: "var(--red)" }}>
                  {fmtCr(taxOnGains)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Post-tax corpus:{" "}
                <strong style={{ color: "var(--green)" }}>
                  {fmtCr(postTaxN)}
                </strong>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Tax rate: 10% on gains above ₹1L (LTCG)
              </span>
            </div>
          )}

          {/* ── Value history ── */}
          {!isFDInv && !isOneTimeInv && (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: showLogValue ? "0.75rem" : 0,
                }}
              >
                <button
                  className="btn-ghost"
                  style={{
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  onClick={() => {
                    setShowLogValue((s) => !s);
                    setShowHistory(false);
                  }}
                >
                  <span style={{ fontSize: 14 }}>+</span> Log value
                </button>
                {corpusHistory.length > 0 && (
                  <button
                    className="btn-ghost"
                    style={{
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      color: "var(--text-muted)",
                    }}
                    onClick={() => {
                      setShowHistory((s) => !s);
                      setShowLogValue(false);
                    }}
                  >
                    📈 {showHistory ? "Hide" : "Show"} history (
                    {corpusHistory.length})
                  </button>
                )}
              </div>

              {showLogValue && (
                <div
                  style={{
                    background: "var(--bg-card2)",
                    borderRadius: "var(--radius)",
                    padding: "0.875rem",
                    marginTop: "0.5rem",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: "0.625rem",
                    }}
                  >
                    Log current portfolio value — this updates your corpus and
                    saves the entry to history.
                  </div>
                  <div className="grid-2" style={{ marginBottom: 10 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Date
                      </label>
                      <input
                        type="date"
                        value={logEntry.date}
                        onChange={(e) =>
                          setLogEntry({ ...logEntry, date: e.target.value })
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
                        Current value (₹)
                      </label>
                      <input
                        type="number"
                        placeholder={`Current: ${fmt(inv.existingCorpus || 0)}`}
                        value={logEntry.value}
                        onChange={(e) =>
                          setLogEntry({ ...logEntry, value: e.target.value })
                        }
                        autoFocus
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Note (optional)
                      </label>
                      <input
                        placeholder="e.g. From Coin app, post-market close"
                        value={logEntry.note}
                        onChange={(e) =>
                          setLogEntry({ ...logEntry, note: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={logValue}>
                      Save
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setShowLogValue(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showHistory && corpusHistory.length > 0 && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                  }}
                >
                  {historyChartData.length > 1 && (
                    <div style={{ height: 120, padding: "0.75rem 0.5rem 0" }}>
                      <Chart
                        categories={historyChartData.map((d) => d.date)}
                        series={[
                          {
                            name: "Value",
                            type: "area",
                            data: historyChartData.map((d) => d.value),
                            color: personColor,
                            areaOpacity: 0.3,
                          },
                        ]}
                        tooltip={(params) =>
                          params.length ? `${fmtCr(params[0].value)}` : ""
                        }
                        grid={{ right: 4, bottom: 20 }}
                        labelSize={9}
                        labelColor="#555"
                      />
                    </div>
                  )}
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {sortedHistory.map((h, i) => {
                      const prev = sortedHistory[i + 1];
                      const change = prev ? h.value - prev.value : null;
                      const changePct =
                        prev && prev.value > 0
                          ? ((change / prev.value) * 100).toFixed(1)
                          : null;
                      return (
                        <div
                          key={`${h.date}-${i}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 12px",
                            borderBottom: "1px solid var(--border)",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>
                              {fmtCr(h.value)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {h.date}
                              {h.note ? ` · ${h.note}` : ""}
                            </div>
                          </div>
                          {change !== null && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color:
                                  change >= 0 ? "var(--green)" : "var(--red)",
                              }}
                            >
                              {change >= 0 ? "+" : ""}
                              {fmtCr(change)}
                              {changePct !== null && (
                                <span style={{ fontSize: 10, opacity: 0.75 }}>
                                  {" "}
                                  ({change >= 0 ? "+" : ""}
                                  {changePct}%)
                                </span>
                              )}
                            </span>
                          )}
                          <button
                            className="btn-danger"
                            aria-label="Delete entry"
                            style={{ padding: "3px 6px" }}
                            onClick={async () => {
                              if (
                                await confirm(
                                  "Delete entry?",
                                  `Remove logged value for ${h.date}?`,
                                )
                              ) {
                                const idx = corpusHistory.findIndex(
                                  (x, j) =>
                                    x.date === h.date &&
                                    x.value === h.value &&
                                    j === corpusHistory.length - 1 - i,
                                );
                                const newHist = corpusHistory.filter(
                                  (_, j) =>
                                    j !==
                                    (idx === -1
                                      ? corpusHistory.length - 1 - i
                                      : idx),
                                );
                                onUpdate({ ...inv, corpusHistory: newHist });
                              }
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Growth chart — tabbed */}
          {!isFDInv && (
            <div>
              {/* Tab bar */}
              <div
                style={{
                  display: "flex",
                  gap: 2,
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 7,
                  padding: 2,
                  width: "fit-content",
                }}
              >
                {[
                  { id: "projection", label: "Projection" },
                  ...(!isOneTimeInv
                    ? [{ id: "breakdown", label: "Breakdown" }]
                    : []),
                  ...(historyChartData.length >= 2
                    ? [{ id: "actual", label: "Actual" }]
                    : []),
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setChartView(id)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 11,
                      borderRadius: 5,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: chartView === id ? 600 : 400,
                      background:
                        chartView === id ? "rgba(255,255,255,0.1)" : "none",
                      color:
                        chartView === id
                          ? "var(--text-primary, #fff)"
                          : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Inflation toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showReal}
                    onChange={() => setShowReal(!showReal)}
                    style={{ width: 14, height: 14 }}
                  />
                  Inflation-adjusted ({INFLATION}%)
                </label>
              </div>

              {/* Projection chart */}
              {chartView === "projection" && (
                <div style={{ height: 180 }}>
                  <Chart
                    categories={displayChartData.map((d) => d.year)}
                    series={[
                      {
                        name: !isOneTimeInv ? "Your trajectory" : "Corpus",
                        type: "area",
                        data: displayChartData.map((d) => d.corpus),
                        color: personColor,
                      },
                      ...(!isOneTimeInv
                        ? [
                            {
                              name: "Ideal (no missed SIPs)",
                              type: "line",
                              data: displayChartData.map((d) => d.expected),
                              color: "#c9a84c",
                              dashed: true,
                              lineWidth: 1.5,
                            },
                          ]
                        : []),
                      {
                        name: "Invested",
                        type: "line",
                        data: displayChartData.map((d) => d.invested),
                        color: "#55535e",
                        dashed: true,
                        lineWidth: 1.5,
                      },
                    ]}
                    fmt={fmtCr}
                    labelInterval={3}
                    labelSize={10}
                  />
                </div>
              )}

              {/* Breakdown chart: stacked invested + gains per year */}
              {chartView === "breakdown" && (
                <div style={{ height: 180 }}>
                  <Chart
                    categories={breakdownData.map((d) => d.year)}
                    series={[
                      {
                        name: "invested",
                        type: "bar",
                        data: breakdownData.map((d) => d.invested),
                        color: "#3a3a4a",
                        stack: "a",
                        barRadius: [0, 0, 3, 3],
                        barMaxWidth: Math.max(4, Math.floor(260 / projYears)),
                      },
                      {
                        name: "gains",
                        type: "bar",
                        data: breakdownData.map((d) => d.gains),
                        color: personColor,
                        stack: "a",
                        barRadius: [3, 3, 0, 0],
                        barMaxWidth: Math.max(4, Math.floor(260 / projYears)),
                      },
                    ]}
                    tooltip={(params) =>
                      params
                        .map(
                          (p) =>
                            `${p.marker} ${p.seriesName === "invested" ? "Your money" : "Growth"}: ${fmtCr(p.value)}`,
                        )
                        .join("<br/>")
                    }
                    labelInterval={Math.floor(projYears / 7)}
                    labelSize={10}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      justifyContent: "center",
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#55535e",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: "#3a3a4a",
                          display: "inline-block",
                        }}
                      />{" "}
                      Your money
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: personColor,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: personColor,
                          display: "inline-block",
                        }}
                      />{" "}
                      Growth
                    </span>
                  </div>
                </div>
              )}

              {/* Actual chart: logged corpus history */}
              {chartView === "actual" && historyChartData.length >= 2 && (
                <div style={{ height: 180 }}>
                  <Chart
                    categories={historyChartData.map((d) => d.date)}
                    series={[
                      {
                        name: "Actual value",
                        type: "area",
                        data: historyChartData.map((d) => d.value),
                        color: personColor,
                        areaOpacity: 0.3,
                        symbol: "circle",
                      },
                    ]}
                    tooltip={(params) =>
                      params.length ? `${fmtCr(params[0].value)}` : ""
                    }
                    grid={{ right: 4 }}
                    labelSize={10}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    Real values from your logs · {corpusHistory.length} data
                    point{corpusHistory.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>
          )}
          {isFDInv && (
            <div style={{ height: 180 }}>
              <Chart
                categories={chartData.map((d) => d.year)}
                series={[
                  {
                    name: "Corpus",
                    type: "area",
                    data: chartData.map((d) => d.corpus),
                    color: personColor,
                  },
                  {
                    name: "Invested",
                    type: "line",
                    data: chartData.map((d) => d.invested),
                    color: "#55535e",
                    dashed: true,
                    lineWidth: 1.5,
                  },
                ]}
                fmt={fmtCr}
                labelInterval={3}
                labelSize={10}
              />
            </div>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
});

// ─── Type colour palette ────────────────────────────────────────────────────
const TYPE_COLORS = {
  "Mutual Fund": "#5b9cf6",
  Stocks: "#a78bfa",
  Gold: "#fbbf24",
  FD: "#34d399",
  NPS: "#22d3ee",
  ULIP: "#f97316",
  PPF: "#10b981",
};
const typeColor = (t) => TYPE_COLORS[t] || "#888888";

// ─── Mutual Fund cap categories ──────────────────────────────────────────────
// Each entry: { value (stored), label (shown), buckets (cap weights), isActive }
export const MF_CAP_CATEGORIES = [
  { value: "", label: "Not specified", buckets: null, isActive: null },
  {
    value: "large_index",
    label: "Large Cap — Index",
    buckets: { large: 1 },
    isActive: false,
  },
  {
    value: "large_active",
    label: "Large Cap — Active",
    buckets: { large: 1 },
    isActive: true,
  },
  {
    value: "mid_index",
    label: "Mid Cap — Index",
    buckets: { mid: 1 },
    isActive: false,
  },
  {
    value: "mid_active",
    label: "Mid Cap — Active",
    buckets: { mid: 1 },
    isActive: true,
  },
  {
    value: "small_index",
    label: "Small Cap — Index",
    buckets: { small: 1 },
    isActive: false,
  },
  {
    value: "small_active",
    label: "Small Cap — Active",
    buckets: { small: 1 },
    isActive: true,
  },
  {
    value: "largemid",
    label: "Large & Mid Cap",
    buckets: { large: 0.5, mid: 0.5 },
    isActive: null,
  },
  {
    value: "flexi",
    label: "Flexi Cap",
    buckets: { large: 0.4, mid: 0.35, small: 0.25 },
    isActive: null,
  },
  {
    value: "multi",
    label: "Multi Cap",
    buckets: { large: 0.33, mid: 0.33, small: 0.33 },
    isActive: null,
  },
  {
    value: "elss",
    label: "ELSS (Tax Saving)",
    buckets: { large: 0.6, mid: 0.3, small: 0.1 },
    isActive: null,
  },
  {
    value: "focused",
    label: "Focused Fund",
    buckets: { large: 0.5, mid: 0.3, small: 0.2 },
    isActive: true,
  },
  {
    value: "sectoral",
    label: "Sectoral / Thematic",
    buckets: { large: 0.7, mid: 0.3 },
    isActive: true,
  },
  {
    value: "international",
    label: "International / Global",
    buckets: null,
    isActive: null,
  },
  {
    value: "hybrid_equity",
    label: "Hybrid — Equity oriented",
    buckets: { large: 0.4, mid: 0.2 },
    isActive: null,
  },
  {
    value: "hybrid_debt",
    label: "Hybrid — Debt oriented",
    buckets: null,
    isActive: null,
  },
];

const capCategoryMap = Object.fromEntries(
  MF_CAP_CATEGORIES.map((c) => [c.value, c]),
);

// Fallback: infer buckets from fund name when capCategory not set
const NAME_CAP_WEIGHTS = {
  largecap: { large: 1 },
  "large cap": { large: 1 },
  "large-midcap": { large: 0.5, mid: 0.5 },
  largemidcap: { large: 0.5, mid: 0.5 },
  "next 50": { large: 0.8, mid: 0.2 },
  "nifty 50": { large: 1 },
  midcap: { mid: 1 },
  "mid cap": { mid: 1 },
  smallcap: { small: 1 },
  "small cap": { small: 1 },
  flexicap: { large: 0.4, mid: 0.35, small: 0.25 },
  "flexi cap": { large: 0.4, mid: 0.35, small: 0.25 },
  multicap: { large: 0.33, mid: 0.33, small: 0.33 },
  "multi cap": { large: 0.33, mid: 0.33, small: 0.33 },
  elss: { large: 0.6, mid: 0.3, small: 0.1 },
};

function capBucketsForFund(name, capCategory) {
  // Prefer explicit category
  if (capCategory && capCategoryMap[capCategory]?.buckets) {
    return capCategoryMap[capCategory].buckets;
  }
  // Fallback to name inference
  const lower = (name || "").toLowerCase();
  for (const [kw, weights] of Object.entries(NAME_CAP_WEIGHTS)) {
    if (lower.includes(kw)) return weights;
  }
  return null;
}

// Ideal target allocation bands (% of equity SIP)
const IDEAL_ALLOCATION = [
  { label: "Large Cap", key: "large", ideal: 40, color: "#5b9cf6" },
  { label: "Mid Cap", key: "mid", ideal: 30, color: "#a78bfa" },
  { label: "Small Cap", key: "small", ideal: 20, color: "#f97316" },
  { label: "Gold / Commodity", key: "gold", ideal: 10, color: "#fbbf24" },
];

function computeHealthData(rows) {
  const equityRows = rows.filter(
    (r) => ["Mutual Fund", "Stocks", "ULIP"].includes(r.type) && r.monthly > 0,
  );
  const goldMonthly = rows
    .filter((r) => r.type === "Gold" && r.monthly > 0)
    .reduce((s, r) => s + r.monthly, 0);
  const equityMonthly = equityRows.reduce((s, r) => s + r.monthly, 0);
  const totalSIP = equityMonthly + goldMonthly;

  if (totalSIP === 0 || equityRows.length === 0) return null;

  // Actual cap exposure — use explicit capCategory first, then name fallback
  const capExposure = { large: 0, mid: 0, small: 0 };
  const unknownRows = [];
  equityRows.forEach((r) => {
    const buckets = capBucketsForFund(r.name, r.capCategory);
    if (buckets) {
      Object.entries(buckets).forEach(([cap, w]) => {
        capExposure[cap] = (capExposure[cap] || 0) + r.monthly * w;
      });
    } else {
      unknownRows.push(r.name);
    }
  });

  const allocationBands = IDEAL_ALLOCATION.map((band) => {
    let actual;
    if (band.key === "gold") {
      actual = totalSIP > 0 ? (goldMonthly / totalSIP) * 100 : 0;
    } else {
      actual = totalSIP > 0 ? (capExposure[band.key] / totalSIP) * 100 : 0;
    }
    const diff = actual - band.ideal;
    const status = Math.abs(diff) <= 8 ? "ok" : diff > 0 ? "over" : "under";
    return {
      ...band,
      actual: Math.round(actual),
      diff: Math.round(diff),
      status,
    };
  });

  // Overlap: pairs of equity funds with ≥30% shared cap exposure
  const overlaps = [];
  for (let i = 0; i < equityRows.length; i++) {
    for (let j = i + 1; j < equityRows.length; j++) {
      const a = capBucketsForFund(
        equityRows[i].name,
        equityRows[i].capCategory,
      );
      const b = capBucketsForFund(
        equityRows[j].name,
        equityRows[j].capCategory,
      );
      if (!a || !b) continue;
      const shared = ["large", "mid", "small"].reduce(
        (s, cap) => s + Math.min(a[cap] || 0, b[cap] || 0),
        0,
      );
      if (shared >= 0.3) {
        overlaps.push({
          a: equityRows[i].name,
          b: equityRows[j].name,
          aCat: equityRows[i].capCategory,
          bCat: equityRows[j].capCategory,
          pct: Math.round(shared * 100),
        });
      }
    }
  }

  // ── Category-specific risk checks ──
  const activeLargeCaps = equityRows.filter((r) => {
    const cat = capCategoryMap[r.capCategory];
    if (cat) return cat.isActive === true && cat.buckets?.large >= 0.7;
    // name fallback
    const lower = (r.name || "").toLowerCase();
    return (
      lower.includes("large cap") &&
      !lower.includes("index") &&
      !lower.includes("nifty") &&
      !lower.includes("next 50")
    );
  });

  const sectoralFunds = equityRows.filter((r) => r.capCategory === "sectoral");

  const internationalFunds = equityRows.filter(
    (r) => r.capCategory === "international",
  );

  // Too many funds = over-diversification
  const distinctFunds = equityRows.length;

  // Concentration: single fund > 35% of total SIP
  const concentrationRisks = equityRows.filter(
    (r) => totalSIP > 0 && r.monthly / totalSIP > 0.35,
  );

  // ── Warnings ──
  const warnings = [];
  const hasDebt = rows.some((r) => ["FD", "NPS", "PPF"].includes(r.type));
  const hasGold = rows.some((r) => r.type === "Gold");
  const hasSmallCap = capExposure.small > 0;
  const totalActive = rows.reduce((s, r) => s + r.cur, 0);

  if (!hasDebt)
    warnings.push({
      level: "warn",
      msg: "No debt allocation — NPS gives an extra ₹50K tax deduction (80CCD(1B)). PPF returns 7.1% p.a. tax-free.",
    });
  if (!hasGold)
    warnings.push({
      level: "info",
      msg: "No gold in portfolio — 5–10% gold allocation reduces volatility during equity crashes (gold often moves inversely to equity).",
    });
  if (equityRows.length >= 3 && !hasSmallCap)
    warnings.push({
      level: "info",
      msg: "No small cap exposure — historically small caps have outperformed large caps over 10+ year horizons despite higher short-term volatility.",
    });
  if (totalActive < 10_00_000 && goldMonthly / (totalSIP || 1) > 0.15)
    warnings.push({
      level: "warn",
      msg: "Gold is >15% of your monthly SIP — gold is a hedge, not a primary growth asset. It averages 8–9% p.a. vs 12–14% for equity long-term.",
    });
  activeLargeCaps.forEach((r) =>
    warnings.push({
      level: "warn",
      msg: `"${r.name}" is an active large-cap fund — SEBI data shows 80%+ of active large-cap funds underperform the Nifty 50 index after fees over 5 years. Consider switching to a Nifty 50 or Nifty Next 50 index fund.`,
    }),
  );
  if (distinctFunds >= 7)
    warnings.push({
      level: "warn",
      msg: `You have ${distinctFunds} equity funds — over-diversification beyond 4–5 funds adds no new diversification but makes tracking harder. Consider consolidating.`,
    });
  concentrationRisks.forEach((r) => {
    const pct = Math.round((r.monthly / totalSIP) * 100);
    warnings.push({
      level: "warn",
      msg: `"${r.name}" is ${pct}% of your total SIP — concentration >35% in a single fund increases risk. Consider distributing across fund categories.`,
    });
  });
  sectoralFunds.forEach((r) =>
    warnings.push({
      level: "warn",
      msg: `"${r.name}" is a sectoral/thematic fund — these are high-risk, cyclical bets. Limit to <10% of portfolio unless you have strong conviction.`,
    }),
  );
  if (internationalFunds.length === 0 && totalActive > 5_00_000)
    warnings.push({
      level: "info",
      msg: "No international diversification — 5–10% in a global/US index fund (e.g. Motilal Oswal Nasdaq 100) reduces INR currency risk and adds US tech exposure.",
    });

  // Score: 100 − (penalties)
  let score = 100;
  if (!hasDebt) score -= 20;
  if (!hasGold) score -= 10;
  if (!hasSmallCap && equityRows.length >= 3) score -= 10;
  if (activeLargeCaps.length > 0) score -= activeLargeCaps.length * 8;
  if (overlaps.length > 0) score -= overlaps.length * 10;
  if (distinctFunds >= 7) score -= 10;
  if (unknownRows.length > 0) score -= 5;
  score = Math.max(0, score);

  const scoreLabel =
    score >= 80 ? "Good" : score >= 60 ? "Needs work" : "At risk";
  const scoreColor =
    score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : "#f87171";

  return {
    allocationBands,
    overlaps,
    warnings,
    unknownRows,
    totalSIP,
    score,
    scoreLabel,
    scoreColor,
  };
}

// ─── Portfolio overview charts + health panel ────────────────────────────────
export function PortfolioCharts({ rows, isHousehold }) {
  const { personNames } = useData();
  const [tab, setTab] = useState("snapshot"); // "snapshot" | "health"

  // ── Snapshot data ──
  const allocationData = useMemo(() => {
    const typeMap = {};
    rows.forEach((r) => {
      if (r.cur > 0) typeMap[r.type] = (typeMap[r.type] || 0) + r.cur;
    });
    return Object.entries(typeMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const plData = useMemo(
    () =>
      rows
        .filter((r) => r.invested > 0)
        .map((r) => ({
          name: r.name.length > 18 ? r.name.slice(0, 16) + "\u2026" : r.name,
          gain: Math.round(r.cur - r.invested),
        }))
        .sort((a, b) => b.gain - a.gain),
    [rows],
  );

  const splitData = useMemo(
    () =>
      isHousehold
        ? [
            {
              name: personNames?.abhav || "Person 1",
              value: Math.round(
                rows
                  .filter((r) => r.owner === "abhav")
                  .reduce((s, r) => s + r.cur, 0),
              ),
              color: "var(--abhav)",
            },
            {
              name: personNames?.aanya || "Person 2",
              value: Math.round(
                rows
                  .filter((r) => r.owner === "aanya")
                  .reduce((s, r) => s + r.cur, 0),
              ),
              color: "var(--aanya)",
            },
          ].filter((d) => d.value > 0)
        : null,
    [rows, isHousehold, personNames],
  );
  const hasSplit = splitData && splitData.length === 2;
  const splitTotal = hasSplit ? splitData.reduce((s, d) => s + d.value, 0) : 0;

  // ── Health data ──
  const health = useMemo(() => computeHealthData(rows), [rows]);

  if (rows.length < 2) return null;

  const TAB_STYLE = (active) => ({
    padding: "5px 14px",
    fontSize: 12,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    background: active ? "rgba(255,255,255,0.1)" : "none",
    color: active ? "var(--text-primary, #fff)" : "var(--text-muted)",
    transition: "background 0.15s",
  });

  return (
    <div className="card section-gap" style={{ marginBottom: "1.25rem" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {tab === "snapshot" ? "Portfolio Snapshot" : "Portfolio Health"}
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            padding: 2,
          }}
        >
          <button
            style={TAB_STYLE(tab === "snapshot")}
            onClick={() => setTab("snapshot")}
          >
            Snapshot
          </button>
          <button
            style={TAB_STYLE(tab === "health")}
            onClick={() => setTab("health")}
          >
            Health
            {health &&
            (health.overlaps.length > 0 ||
              health.warnings.some((w) => w.level === "warn"))
              ? " ⚠"
              : ""}
          </button>
        </div>
      </div>

      {/* ══ SNAPSHOT TAB ══ */}
      {tab === "snapshot" && (
        <>
          <div
            className="portfolio-snapshot-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                allocationData.length > 0 && plData.length > 0
                  ? "1fr 1fr"
                  : "1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {allocationData.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Allocation by type
                </div>
                <DonutChart
                  data={allocationData.map((d) => ({
                    name: d.name,
                    value: d.value,
                    color: typeColor(d.name),
                  }))}
                  fmt={fmtCr}
                  height={190}
                  innerRadius="43%"
                  outerRadius="65%"
                  center={["50%", "42%"]}
                  padAngle={2}
                  legend
                />
              </div>
            )}
            {plData.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Gain / Loss per investment
                </div>
                <Chart
                  categories={plData.map((d) => d.name)}
                  series={[
                    {
                      type: "bar",
                      data: plData.map((d) => ({
                        value: d.gain,
                        color: d.gain >= 0 ? "#4ade80" : "#f87171",
                      })),
                      color: "#888",
                      barRadius: [0, 4, 4, 0],
                    },
                  ]}
                  horizontal
                  height={Math.max(120, plData.length * 32)}
                  tooltip={(p) =>
                    `${p.name}: ${p.value >= 0 ? "+" : "\u2212"}${fmtCr(Math.abs(p.value))}`
                  }
                  grid={{ top: 0, right: 16, bottom: 0, left: 90 }}
                  labelSize={10}
                  labelColor="#666"
                />
              </div>
            )}
          </div>

          {hasSplit && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                Portfolio split
              </div>
              {splitData.map((d) => {
                const pct =
                  splitTotal > 0
                    ? ((d.value / splitTotal) * 100).toFixed(1)
                    : 0;
                return (
                  <div key={d.name} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: d.color }}>{d.name}</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {fmtCr(d.value)}&nbsp;({pct}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--bg-card2)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: d.color,
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══ HEALTH TAB ══ */}
      {tab === "health" && (
        <div>
          {!health ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Add SIP investments to see portfolio health analysis.
            </div>
          ) : (
            <>
              {/* Score banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: `${health.scoreColor}14`,
                  border: `1px solid ${health.scoreColor}40`,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: health.scoreColor,
                    lineHeight: 1,
                    minWidth: 48,
                    textAlign: "center",
                  }}
                >
                  {health.score}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: health.scoreColor,
                      fontSize: 14,
                    }}
                  >
                    {health.scoreLabel}
                  </div>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Portfolio health score out of 100 ·{" "}
                    {health.warnings.filter((w) => w.level === "warn").length}{" "}
                    warning
                    {health.warnings.filter((w) => w.level === "warn")
                      .length !== 1
                      ? "s"
                      : ""}
                    , {health.overlaps.length} overlap
                    {health.overlaps.length !== 1 ? "s" : ""} detected
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 6,
                      background: "var(--bg-card2)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${health.score}%`,
                        background: health.scoreColor,
                        borderRadius: 3,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Warnings & flags */}
              {health.warnings.length > 0 && (
                <div
                  style={{
                    marginBottom: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {health.warnings.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background:
                          w.level === "warn"
                            ? "rgba(251,191,36,0.07)"
                            : "rgba(91,156,246,0.07)",
                        border: `1px solid ${w.level === "warn" ? "rgba(251,191,36,0.2)" : "rgba(91,156,246,0.2)"}`,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span style={{ fontSize: 15, marginTop: 1 }}>
                        {w.level === "warn" ? "⚠️" : "💡"}
                      </span>
                      <span>{w.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Overlap detection */}
              {health.overlaps.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}
                  >
                    Fund Overlap Detected
                  </div>
                  {health.overlaps.map((o, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        marginBottom: 8,
                        borderRadius: 8,
                        background: "rgba(248,113,113,0.07)",
                        border: "1px solid rgba(248,113,113,0.2)",
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#f87171" }}>
                            {o.pct}% overlap
                          </strong>
                          <div
                            style={{ color: "var(--text-muted)", marginTop: 2 }}
                          >
                            <span style={{ color: "var(--text-secondary)" }}>
                              {o.a}
                            </span>
                            <span style={{ margin: "0 6px", color: "#555" }}>
                              ×
                            </span>
                            <span style={{ color: "var(--text-secondary)" }}>
                              {o.b}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{ marginTop: 6, color: "#888", fontSize: 11 }}
                      >
                        These funds invest in the same market-cap segment.
                        Consider stopping the lower-conviction one.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ideal vs actual allocation */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  Ideal vs Actual SIP Allocation
                </div>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>
                  Based on ₹
                  {Math.round(health.totalSIP).toLocaleString("en-IN")}/month
                  total SIP
                </div>
                {health.allocationBands.map((band) => (
                  <div key={band.key} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        {band.label}
                      </span>
                      <span>
                        <span
                          style={{
                            color:
                              band.status === "ok"
                                ? "#4ade80"
                                : band.status === "over"
                                  ? "#fbbf24"
                                  : "#f87171",
                            fontWeight: 600,
                          }}
                        >
                          {band.actual}%
                        </span>
                        <span style={{ color: "#555", marginLeft: 4 }}>
                          / ideal {band.ideal}%
                        </span>
                        {band.status !== "ok" && (
                          <span
                            style={{
                              color:
                                band.status === "over" ? "#fbbf24" : "#f87171",
                              marginLeft: 6,
                              fontSize: 11,
                            }}
                          >
                            {band.diff > 0 ? "+" : ""}
                            {band.diff}%
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Stacked bar: Actual (coloured) vs Ideal marker */}
                    <div
                      style={{
                        position: "relative",
                        height: 8,
                        background: "var(--bg-card2)",
                        borderRadius: 4,
                        overflow: "visible",
                      }}
                    >
                      {/* Actual fill */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          height: "100%",
                          width: `${Math.min(band.actual, 100)}%`,
                          background: band.color,
                          borderRadius: 4,
                          opacity: 0.85,
                          transition: "width 0.5s ease",
                        }}
                      />
                      {/* Ideal marker line */}
                      <div
                        style={{
                          position: "absolute",
                          left: `${band.ideal}%`,
                          top: -3,
                          width: 2,
                          height: 14,
                          background: "rgba(255,255,255,0.35)",
                          borderRadius: 1,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    fontSize: 11,
                    color: "#444",
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  White marker = ideal target. Ideal bands: 40% Large · 30% Mid
                  · 20% Small · 10% Gold. Adjust to your risk appetite.
                </div>
                {health.unknownRows.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "#555" }}>
                    Could not classify: {health.unknownRows.join(", ")} — these
                    are excluded from the above analysis.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export menu ────────────────────────────────────────────────────────────
export function ExportMenu({ rows, rawData, totals, title, filename }) {
  const { personNames } = useData();
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  const trigger = (content, name, mime) => {
    // Prepend BOM so Excel opens UTF-8 CSV correctly
    const blob = new Blob(["\uFEFF" + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const isHH = rows.some((r) => r.owner !== undefined);

  const downloadCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      ...(isHH ? ["Person"] : []),
      "Name",
      "Type",
      "Frequency",
      "Amount (Rs)",
      "Current Value (Rs)",
      "Total Invested (Rs)",
      "Monthly Equiv (Rs)",
      "20-yr Projection (Rs)",
      "Return (% pa)",
      "Bank",
      "App",
      "Start Date",
    ];
    const dataRows = rows.map((r, i) => {
      const x = rawData[i];
      const cells = [
        ...(isHH ? [personNames?.[r.owner] || r.owner] : []),
        r.name,
        r.type,
        r.frequency,
        x.amount || "",
        r.cur > 0 ? Math.round(r.cur) : "",
        r.invested > 0 ? r.invested : "",
        r.monthly > 0 ? Math.round(r.monthly) : "",
        r.yr20 !== null ? Math.round(r.yr20) : "",
        x.returnPct || "",
        x.bankName || "",
        x.appName || "",
        x.startDate || "",
      ];
      return cells.map(esc).join(",");
    });
    trigger(
      [headers.map(esc).join(","), ...dataRows].join("\n"),
      `${filename}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const downloadTXT = () => {
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const line = "\u2500".repeat(50);
    const thick = "\u2550".repeat(50);
    const fmtN = (n) =>
      n != null
        ? `\u20b9${Math.round(Math.abs(n)).toLocaleString("en-IN")}`
        : "\u2014";

    const out = [
      thick,
      `  WealthOS \u2014 ${title}`,
      `  Exported: ${today}`,
      thick,
      "",
      "SUMMARY",
      `  Monthly contribution  : ${fmtN(totals.monthly)}`,
      `  Current portfolio     : ${fmtN(totals.current)}`,
      `  20-year projection    : ${fmtN(totals.yr20)}`,
      `  Overall P&L           : ${
        totals.gain != null
          ? `${totals.gain >= 0 ? "+" : "\u2212"}${fmtN(totals.gain)} (${totals.gainPct >= 0 ? "+" : ""}${totals.gainPct.toFixed(1)}%)`
          : "\u2014"
      }`,
      "",
      `INVESTMENTS (${rows.length} shown)`,
    ];

    rows.forEach((r, i) => {
      const x = rawData[i];
      const gain = r.invested > 0 ? r.cur - r.invested : null;
      const gainPct = gain !== null ? (gain / r.invested) * 100 : null;
      out.push(line);
      out.push(
        `${i + 1}. ${r.name}${isHH ? `  [${personNames?.[r.owner] || r.owner}]` : ""}`,
      );
      out.push(`   Type: ${r.type}  |  Frequency: ${r.frequency}`);
      if (r.monthly > 0) {
        out.push(
          `   SIP: ${fmtN(r.monthly)}/month (${r.frequency})  |  Return: ${x.returnPct}% p.a.`,
        );
      } else {
        out.push(
          `   Amount: ${fmtN(x.amount)}  |  Return: ${x.returnPct}% p.a.`,
        );
      }
      out.push(`   Current value: ${fmtN(r.cur)}`);
      if (r.invested > 0) {
        out.push(
          `   Invested: ${fmtN(r.invested)}  |  P&L: ${gain >= 0 ? "+" : "\u2212"}${fmtN(gain)} (${gainPct.toFixed(1)}%)`,
        );
      }
      if (r.yr20 !== null) {
        out.push(`   20-year projection: ${fmtN(r.yr20)}`);
      }
      const meta = [
        x.bankName,
        x.appName,
        x.startDate ? `Started ${x.startDate}` : null,
      ].filter(Boolean);
      if (meta.length) out.push(`   ${meta.join("  |  ")}`);
    });

    out.push(line);
    out.push("");
    out.push("Generated by WealthOS");
    trigger(out.join("\n"), `${filename}.txt`, "text/plain;charset=utf-8;");
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          fontSize: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-card2)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <Download size={13} />
        Export
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: "#1a1a24",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              overflow: "hidden",
              zIndex: 100,
              minWidth: 155,
              boxShadow: "0 8px 24px rgba(0,0,0,.5)",
            }}
          >
            {[
              { label: "Download CSV", action: downloadCSV },
              { label: "Download TXT", action: downloadTXT },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  background: "none",
                  border: "none",
                  color: "#eeeae4",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,.07)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Investments({
  data,
  personName,
  personColor,
  updatePerson,
}) {
  const investments = useMemo(
    () => data?.investments || [],
    [data?.investments],
  );
  const [showAdd, setShowAdd] = useState(false);
  const [filterApp, setFilterApp] = useState("All");
  const [filterBank, setFilterBank] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const allApps = useMemo(
    () => [...new Set(investments.map((x) => x.appName).filter(Boolean))],
    [investments],
  );
  const allBanks = useMemo(
    () => [...new Set(investments.map((x) => x.bankName).filter(Boolean))],
    [investments],
  );
  const filteredInvestments = useMemo(
    () =>
      investments
        .filter((x) => filterApp === "All" || x.appName === filterApp)
        .filter((x) => filterBank === "All" || x.bankName === filterBank)
        .filter((x) => filterType === "All" || x.type === filterType),
    [investments, filterApp, filterBank, filterType],
  );
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
    deductionDay: "",
    totalInvested: "",
    units: "",
    capCategory: "",
    schemeCode: "",
  });
  const [mfResults, setMfResults] = useState([]);
  const [mfSearching, setMfSearching] = useState(false);
  const [showMfDropdown, setShowMfDropdown] = useState(false);
  const [navFetching, setNavFetching] = useState(false);
  const [navFetchMsg, setNavFetchMsg] = useState("");
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState(null);
  useEffect(() => {
    if (
      newInv.type !== "Mutual Fund" ||
      !newInv.name ||
      newInv.name.length < 2
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      setMfSearching(true);
      const results = await mfSearch(newInv.name);
      setMfResults(results.slice(0, 8));
      setMfSearching(false);
      if (results.length > 0) setShowMfDropdown(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [newInv.name, newInv.type]);

  // Auto-sync MF NAVs on page load (once per session, silently in background)
  useEffect(() => {
    const hasMFs = investments.some(
      (x) => x.type === "Mutual Fund" && x.schemeCode,
    );
    if (!hasMFs) return;
    // Only auto-sync once per session
    const key = "wos_nav_auto_synced";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    let cancelled = false;
    (async () => {
      try {
        setBatchSyncing(true);
        const navs = await fetchAllMFNavs(investments);
        if (cancelled || !navs.size) return;
        let updated = 0;
        const newList = investments.map((inv) => {
          if (inv.type !== "Mutual Fund" || !inv.schemeCode) return inv;
          const nd = navs.get(inv.schemeCode);
          if (!nd) return inv;
          updated++;
          const patch = { ...inv, latestNav: nd.nav, navDate: nd.date };
          const units =
            Number(inv.units) > 0
              ? inv.units
              : Number(inv.existingCorpus) > 0 && Number(inv.latestNav) > 0
                ? Math.round((inv.existingCorpus / inv.latestNav) * 10000) /
                  10000
                : 0;
          if (units > 0) {
            patch.units = units;
            patch.existingCorpus = Math.round(units * nd.nav * 100) / 100;
          }
          return patch;
        });
        if (updated > 0) updatePerson("investments", newList);
        setBatchSyncResult(
          `Auto-synced ${updated} NAV${updated !== 1 ? "s" : ""}`,
        );
        setTimeout(() => setBatchSyncResult(null), 4000);
      } catch (err) {
        console.error("[Auto-sync NAV]", err);
      } finally {
        setBatchSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        units: newInv.units ? Number(newInv.units) : 0,
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
      deductionDay: "",
      totalInvested: "",
      units: "",
      capCategory: "",
      schemeCode: "",
    });
    setMfResults([]);
    setNavFetchMsg("");
    setShowAdd(false);
  };

  const totalMonthly = filteredInvestments.reduce(
    (s, x) => (isFD(x.type) ? s : s + freqToMonthly(x.amount, x.frequency)),
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
    if (x.frequency === "onetime") {
      const _yrs = x.startDate
        ? Math.max(
            0,
            (new Date() - new Date(x.startDate)) / (365.25 * 24 * 3600 * 1000),
          )
        : 0;
      return (
        s +
        (x.existingCorpus > 0
          ? x.existingCorpus
          : lumpCorpus(x.amount || 0, x.returnPct || 0, _yrs))
      );
    }
    return s + (x.existingCorpus || 0);
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
    if (x.frequency === "onetime") {
      return (
        s +
        lumpCorpus(
          x.existingCorpus > 0 ? x.existingCorpus : x.amount || 0,
          x.returnPct,
          20,
        )
      );
    }
    return (
      s +
      totalCorpus(
        x.existingCorpus || 0,
        freqToMonthly(x.amount, x.frequency),
        x.returnPct,
        20,
      )
    );
  }, 0);

  // Overall P&L: only count investments where cost basis is known
  const { totalCostBasis, totalCurrentForGain } = filteredInvestments.reduce(
    (acc, x) => {
      if (isFD(x.type)) {
        const yrs = x.startDate
          ? Math.max(
              0,
              (new Date() - new Date(x.startDate)) /
                (365.25 * 24 * 3600 * 1000),
            )
          : 0;
        return {
          totalCostBasis: acc.totalCostBasis + (x.amount || 0),
          totalCurrentForGain:
            acc.totalCurrentForGain +
            lumpCorpus(x.amount || 0, x.returnPct || 0, yrs),
        };
      }
      if (x.frequency === "onetime") {
        const _yrs = x.startDate
          ? Math.max(
              0,
              (new Date() - new Date(x.startDate)) /
                (365.25 * 24 * 3600 * 1000),
            )
          : 0;
        return {
          totalCostBasis: acc.totalCostBasis + (x.amount || 0),
          totalCurrentForGain:
            acc.totalCurrentForGain +
            (x.existingCorpus > 0
              ? x.existingCorpus
              : lumpCorpus(x.amount || 0, x.returnPct || 0, _yrs)),
        };
      }
      const ti = getInvested(x);
      if (ti > 0)
        return {
          totalCostBasis: acc.totalCostBasis + ti,
          totalCurrentForGain:
            acc.totalCurrentForGain + (x.existingCorpus || 0),
        };
      return acc;
    },
    { totalCostBasis: 0, totalCurrentForGain: 0 },
  );
  const totalGain =
    totalCostBasis > 0 ? totalCurrentForGain - totalCostBasis : null;
  const totalGainPct =
    totalGain !== null ? (totalGain / totalCostBasis) * 100 : null;

  // Per-investment rows used in info modals
  const invRows = useMemo(
    () => filteredInvestments.map(computeInvRow),
    [filteredInvestments],
  );

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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Invested auto-updates from SIP start date. Current value auto-syncs
          from live MF NAVs.
        </span>
        {investments.some((x) => x.type === "Mutual Fund" && x.schemeCode) && (
          <button
            className="btn-ghost"
            disabled={batchSyncing}
            onClick={async () => {
              setBatchSyncing(true);
              setBatchSyncResult(null);
              try {
                const navs = await fetchAllMFNavs(investments);
                let updated = 0;
                const newList = investments.map((inv) => {
                  if (inv.type !== "Mutual Fund" || !inv.schemeCode) return inv;
                  const nd = navs.get(inv.schemeCode);
                  if (!nd) return inv;
                  updated++;
                  const patch = { ...inv, latestNav: nd.nav, navDate: nd.date };
                  const units =
                    Number(inv.units) > 0
                      ? inv.units
                      : Number(inv.existingCorpus) > 0 &&
                          Number(inv.latestNav) > 0
                        ? Math.round(
                            (inv.existingCorpus / inv.latestNav) * 10000,
                          ) / 10000
                        : 0;
                  if (units > 0) {
                    patch.units = units;
                    patch.existingCorpus =
                      Math.round(units * nd.nav * 100) / 100;
                  }
                  return patch;
                });
                if (updated > 0) updatePerson("investments", newList);
                setBatchSyncResult(
                  `${updated} NAV${updated !== 1 ? "s" : ""} synced`,
                );
              } catch (err) {
                setBatchSyncResult("❌ Sync failed — check your connection");
                console.error("[NAV Sync]", err);
              } finally {
                setBatchSyncing(false);
                setTimeout(() => setBatchSyncResult(null), 4000);
              }
            }}
            style={{
              whiteSpace: "nowrap",
              opacity: batchSyncing ? 0.5 : 1,
              fontSize: 12,
              padding: "4px 10px",
            }}
          >
            {batchSyncing ? "Syncing…" : "⟳ Sync All MF NAVs"}
          </button>
        )}
      </div>
      {batchSyncResult && (
        <div
          style={{
            fontSize: 12,
            color: "var(--green)",
            marginBottom: 12,
            marginTop: -8,
          }}
        >
          ✓ {batchSyncResult}
        </div>
      )}

      <div className="grid-4 section-gap">
        <div className="metric-card">
          <div className="metric-label">
            Monthly contribution
            <InfoModal title="Monthly contribution">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total: {fmt(totalMonthly)} / month
                </strong>
              </div>
              {invRows.filter((r) => r.monthly > 0).length === 0 ? (
                <div style={{ color: "#888" }}>No active SIPs yet.</div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "#666",
                      paddingBottom: 4,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 2,
                    }}
                  >
                    <span>Investment</span>
                    <span>Monthly equiv.</span>
                  </div>
                  {invRows
                    .filter((r) => r.monthly > 0)
                    .map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "3px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <span
                          style={{ color: "#b0aab8", flex: 1, marginRight: 8 }}
                        >
                          {r.name}
                        </span>
                        <span style={{ color: "#eeeae4", fontWeight: 500 }}>
                          {fmt(r.monthly)}
                        </span>
                      </div>
                    ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0 0",
                      marginTop: 2,
                    }}
                  >
                    <span style={{ color: "#888" }}>
                      Weekly SIPs are converted: amount × 52 ÷ 12
                    </span>
                  </div>
                </div>
              )}
            </InfoModal>
          </div>
          <div className="metric-value" style={{ color: personColor }}>
            {fmt(totalMonthly)}
          </div>
          <div className="metric-sub">
            {filteredInvestments.filter((x) => x.frequency === "weekly")
              .length > 0 &&
              `${filteredInvestments.filter((x) => x.frequency === "weekly").length} weekly · `}
            {
              filteredInvestments.filter(
                (x) =>
                  !isFD(x.type) &&
                  x.frequency !== "weekly" &&
                  x.frequency !== "onetime",
              ).length
            }{" "}
            monthly
            {filteredInvestments.filter((x) => x.frequency === "onetime")
              .length > 0 &&
              ` · ${filteredInvestments.filter((x) => x.frequency === "onetime").length} one-time`}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Current portfolio value
            <InfoModal title="Current portfolio value">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total: {fmtCr(totalCurrent)}
                </strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#666",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 2,
                  }}
                >
                  <span>Investment</span>
                  <span>Current value</span>
                </div>
                {invRows.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ color: "#b0aab8", flex: 1, marginRight: 8 }}>
                      {r.name}
                    </span>
                    <span
                      style={{
                        color: r.cur > 0 ? "#eeeae4" : "#666",
                        fontWeight: 500,
                      }}
                    >
                      {r.cur > 0 ? fmtCr(r.cur) : "Not set"}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                SIP &amp; one-time values come from what you enter from your
                app. FDs are auto-calculated.
              </div>
            </InfoModal>
          </div>
          <div className="metric-value gold-text">
            {fmt(Math.round(totalCurrent))}
          </div>
          <div className="metric-sub">From your investment apps</div>
          {totalCostBasis > 0 && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}
            >
              Invested: {fmt(totalCostBasis)}
            </div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">
            20-year projection
            <InfoModal title="20-year projection">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total in 20 years: {fmtCr(total20)}
                </strong>
                <span style={{ color: "#666", fontSize: 12, marginLeft: 8 }}>
                  from {fmtCr(totalCurrent)} today
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#666",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 2,
                  }}
                >
                  <span>Investment</span>
                  <span>20yr value</span>
                </div>
                {invRows
                  .filter((r) => r.yr20 !== null)
                  .map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span
                        style={{ color: "#b0aab8", flex: 1, marginRight: 8 }}
                      >
                        {r.name}
                      </span>
                      <span style={{ color: "#4ade80", fontWeight: 500 }}>
                        {fmtCr(r.yr20)}
                      </span>
                    </div>
                  ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Assumes same SIP rate &amp; each investment earns its expected
                annual return.
              </div>
            </InfoModal>
          </div>
          <div className="metric-value green-text">{fmtCr(total20)}</div>
          <div className="metric-sub">At avg. weighted return</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Overall P&amp;L
            <InfoModal title="Overall P&L (Profit & Loss)">
              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: "#888" }}>Current value</span>
                  <span style={{ color: "#eeeae4", fontWeight: 600 }}>
                    {fmt(totalCurrentForGain)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#888" }}>Total invested</span>
                  <span style={{ color: "#eeeae4", fontWeight: 600 }}>
                    − {fmt(totalCostBasis)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: "#888" }}>Gain / Loss</span>
                  <span
                    style={{
                      color:
                        totalGain === null
                          ? "#666"
                          : totalGain >= 0
                            ? "#4ade80"
                            : "#f87171",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {totalGain === null
                      ? "—"
                      : `${totalGain >= 0 ? "+" : "−"}${fmt(totalGain)}`}
                    {totalGainPct !== null && (
                      <span
                        style={{ fontSize: 12, marginLeft: 6, fontWeight: 400 }}
                      >
                        ({totalGainPct >= 0 ? "+" : ""}
                        {totalGainPct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 11,
                    color: "#666",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 2,
                    gap: 8,
                  }}
                >
                  <span style={{ flex: 1 }}>Investment</span>
                  <span style={{ width: 70, textAlign: "right" }}>
                    Invested
                  </span>
                  <span style={{ width: 70, textAlign: "right" }}>Current</span>
                  <span style={{ width: 60, textAlign: "right" }}>P&amp;L</span>
                </div>
                {invRows.map((r, i) => {
                  const gain = r.invested > 0 ? r.cur - r.invested : null;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#b0aab8", flex: 1 }}>
                        {r.name}
                      </span>
                      <span
                        style={{ width: 70, textAlign: "right", color: "#888" }}
                      >
                        {r.invested > 0 ? (
                          fmtCr(r.invested)
                        ) : (
                          <span style={{ color: "#555" }}>—</span>
                        )}
                      </span>
                      <span
                        style={{
                          width: 70,
                          textAlign: "right",
                          color: "#eeeae4",
                        }}
                      >
                        {r.cur > 0 ? (
                          fmtCr(r.cur)
                        ) : (
                          <span style={{ color: "#555" }}>—</span>
                        )}
                      </span>
                      <span
                        style={{
                          width: 60,
                          textAlign: "right",
                          color:
                            gain === null
                              ? "#555"
                              : gain >= 0
                                ? "#4ade80"
                                : "#f87171",
                          fontWeight: 500,
                        }}
                      >
                        {gain === null
                          ? "—"
                          : `${gain >= 0 ? "+" : "−"}${fmtCr(gain)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                SIPs without "Total invested" filled in show — and are excluded
                from the total.
              </div>
            </InfoModal>
          </div>
          <div
            className="metric-value"
            style={{
              fontSize: 18,
              color:
                totalGain === null
                  ? "var(--text-muted)"
                  : totalGain >= 0
                    ? "var(--green)"
                    : "var(--red)",
            }}
          >
            {totalGain === null
              ? "—"
              : `${totalGain >= 0 ? "+" : "−"}${fmtCr(totalGain)}`}
          </div>
          <div className="metric-sub">
            {totalGainPct !== null
              ? `${totalGainPct >= 0 ? "+" : ""}${totalGainPct.toFixed(1)}% overall return`
              : 'Add "total invested" to SIPs'}
          </div>
        </div>
      </div>

      <PortfolioCharts rows={invRows} isHousehold={false} />

      {(allApps.length > 0 ||
        allBanks.length > 0 ||
        investments.length > 1) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: "1rem",
          }}
        >
          {investments.length > 1 &&
            (() => {
              const types = ["All", ...new Set(investments.map((x) => x.type))];
              if (types.length <= 2) return null;
              return (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginRight: 2,
                    }}
                  >
                    Type:
                  </span>
                  {types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      style={{
                        padding: "4px 12px",
                        fontSize: 12,
                        borderRadius: 99,
                        border:
                          filterType === t
                            ? "1px solid var(--gold)"
                            : "1px solid var(--border)",
                        background:
                          filterType === t ? "var(--gold-dim)" : "transparent",
                        color:
                          filterType === t
                            ? "var(--gold)"
                            : "var(--text-secondary)",
                        cursor: "pointer",
                        fontWeight: filterType === t ? 500 : 400,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              );
            })()}
          {allApps.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginRight: 2,
                }}
              >
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
                    border:
                      filterApp === app
                        ? "1px solid var(--gold)"
                        : "1px solid var(--border)",
                    background:
                      filterApp === app ? "var(--gold-dim)" : "transparent",
                    color:
                      filterApp === app
                        ? "var(--gold)"
                        : "var(--text-secondary)",
                    cursor: "pointer",
                    fontWeight: filterApp === app ? 500 : 400,
                  }}
                >
                  {app}
                </button>
              ))}
            </div>
          )}
          {allBanks.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginRight: 2,
                }}
              >
                Bank:
              </span>
              {["All", ...allBanks].map((bank) => (
                <button
                  key={bank}
                  onClick={() => setFilterBank(bank)}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    borderRadius: 99,
                    border:
                      filterBank === bank
                        ? "1px solid var(--blue)"
                        : "1px solid var(--border)",
                    background:
                      filterBank === bank
                        ? "var(--blue-dim, rgba(91,156,246,.12))"
                        : "transparent",
                    color:
                      filterBank === bank
                        ? "var(--blue)"
                        : "var(--text-secondary)",
                    cursor: "pointer",
                    fontWeight: filterBank === bank ? 500 : 400,
                  }}
                >
                  {bank}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredInvestments.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "0.75rem",
          }}
        >
          <ExportMenu
            rows={invRows}
            rawData={filteredInvestments}
            totals={{
              monthly: totalMonthly,
              current: totalCurrent,
              yr20: total20,
              gain: totalGain,
              gainPct: totalGainPct,
            }}
            title={`${personName}'s Investments`}
            filename={`${personName.toLowerCase()}-investments`}
          />
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
            <div style={{ position: "relative" }}>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {newInv.type === "Mutual Fund" ? "Search fund name" : "Name"}
              </label>
              <input
                placeholder={
                  newInv.type === "Mutual Fund"
                    ? "Type to search e.g. Mirae ELSS\u2026"
                    : "e.g. HDFC PPF"
                }
                value={newInv.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewInv({ ...newInv, name: v, schemeCode: "" });
                  if (v.length < 2) {
                    setMfResults([]);
                    setShowMfDropdown(false);
                  } else {
                    setShowMfDropdown(true);
                  }
                }}
                onFocus={() => mfResults.length > 0 && setShowMfDropdown(true)}
                onBlur={() => setTimeout(() => setShowMfDropdown(false), 150)}
              />
              {newInv.type === "Mutual Fund" && mfSearching && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 3,
                  }}
                >
                  Searching\u2026
                </div>
              )}
              {showMfDropdown && mfResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 2px)",
                    left: 0,
                    right: 0,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    zIndex: 200,
                    maxHeight: 220,
                    overflowY: "auto",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {mfResults.map((r) => (
                    <div
                      key={r.schemeCode}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 13,
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseDown={() => {
                        setNewInv({
                          ...newInv,
                          name: r.schemeName,
                          schemeCode: String(r.schemeCode),
                        });
                        setShowMfDropdown(false);
                      }}
                    >
                      <div style={{ fontWeight: 500, lineHeight: 1.3 }}>
                        {r.schemeName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        #{r.schemeCode}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                onChange={(e) => {
                  const t = e.target.value;
                  setNewInv({
                    ...newInv,
                    type: t,
                    frequency:
                      t === "PPF" || t === "ULIP"
                        ? "yearly"
                        : t === "FD"
                          ? "onetime"
                          : newInv.frequency === "yearly" ||
                              newInv.frequency === "onetime"
                            ? "monthly"
                            : newInv.frequency,
                  });
                }}
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
                  <option value="yearly">Yearly SIP</option>
                  <option value="onetime">One-time purchase</option>
                </select>
              </div>
            )}
            {(newInv.type === "Mutual Fund" || newInv.type === "Stocks") && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Fund category
                </label>
                <select
                  value={newInv.capCategory || ""}
                  onChange={(e) =>
                    setNewInv({ ...newInv, capCategory: e.target.value })
                  }
                >
                  {MF_CAP_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
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
                {isFD(newInv.type)
                  ? "Principal (\u20b9)"
                  : newInv.frequency === "onetime"
                    ? "Purchase amount (\u20b9)"
                    : newInv.frequency === "weekly"
                      ? "Weekly SIP amount (\u20b9)"
                      : newInv.frequency === "yearly"
                        ? "Yearly SIP amount (\u20b9)"
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
              {Number(newInv.amount) > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 3,
                  }}
                >
                  = {fmt(Number(newInv.amount))}
                </div>
              )}
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
                  {newInv.frequency === "onetime"
                    ? "Current market value (\u20b9)"
                    : "Current corpus already invested (\u20b9)"}
                </label>
                <input
                  type="number"
                  placeholder={
                    newInv.frequency === "onetime"
                      ? "From your app (optional)"
                      : "e.g. 20000"
                  }
                  value={newInv.existingCorpus}
                  onChange={(e) =>
                    setNewInv({ ...newInv, existingCorpus: e.target.value })
                  }
                />
                {Number(newInv.existingCorpus) > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 3,
                    }}
                  >
                    = {fmt(Number(newInv.existingCorpus))}
                  </div>
                )}
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
                {isFD(newInv.type)
                  ? "FD start date"
                  : newInv.frequency === "onetime"
                    ? "Purchase date"
                    : "SIP start date"}
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
            {newInv.type === "PPF" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  PPF maturity date
                </label>
                <input
                  type="date"
                  value={newInv.maturityDate || ""}
                  onChange={(e) =>
                    setNewInv({ ...newInv, maturityDate: e.target.value })
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
                placeholder="e.g. HDFC Bank, SBI, Axis"
                list="bank-list-add"
                value={newInv.bankName}
                onChange={(e) =>
                  setNewInv({ ...newInv, bankName: e.target.value })
                }
              />
              <datalist id="bank-list-add">
                {BANK_LIST.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            {hasDeductionDate(newInv.type, newInv.frequency) && (
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
                  {DEDUCTION_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {ordinalSuffix(d)} of month
                    </option>
                  ))}
                </select>
              </div>
            )}
            {hasDeductionMonth(newInv.frequency) && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  SIP deduction month
                </label>
                <select
                  value={newInv.deductionMonth ?? ""}
                  onChange={(e) =>
                    setNewInv({
                      ...newInv,
                      deductionMonth:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Not set (Jan)</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {["Mutual Fund", "Stocks", "Gold", "NPS"].includes(newInv.type) &&
              newInv.frequency === "weekly" && (
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    SIP day of week
                  </label>
                  <select
                    value={newInv.deductionDay || ""}
                    onChange={(e) =>
                      setNewInv({ ...newInv, deductionDay: e.target.value })
                    }
                  >
                    <option value="">Not set</option>
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            {!isFD(newInv.type) && newInv.frequency !== "onetime" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Total invested override (\u20b9)
                </label>
                <input
                  type="number"
                  placeholder="Auto-calculated if empty"
                  value={newInv.totalInvested}
                  onChange={(e) =>
                    setNewInv({ ...newInv, totalInvested: e.target.value })
                  }
                />
                {Number(newInv.totalInvested) > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 3,
                    }}
                  >
                    = {fmt(Number(newInv.totalInvested))}
                  </div>
                )}
              </div>
            )}
            {newInv.type === "Mutual Fund" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Units held
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="From your app — enables auto valuation"
                  value={newInv.units}
                  onChange={(e) =>
                    setNewInv({ ...newInv, units: e.target.value })
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
              ) : newInv.frequency === "onetime" ? (
                <>
                  <span>
                    Purchase:{" "}
                    <strong style={{ color: personColor }}>
                      {fmt(Number(newInv.amount))}
                    </strong>
                  </span>
                  <span>
                    20yr value:{" "}
                    <strong style={{ color: "var(--green)" }}>
                      {fmtCr(
                        lumpCorpus(
                          Number(newInv.amount),
                          Number(newInv.returnPct),
                          20,
                        ),
                      )}
                    </strong>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Monthly equiv:{" "}
                    <strong style={{ color: personColor }}>
                      {fmt(freqToMonthly(newInv.amount, newInv.frequency))}
                    </strong>
                  </span>
                  <span>
                    20yr corpus:{" "}
                    <strong style={{ color: "var(--green)" }}>
                      {fmtCr(
                        totalCorpus(
                          Number(newInv.existingCorpus),
                          freqToMonthly(
                            Number(newInv.amount),
                            newInv.frequency,
                          ),
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
          {newInv.type === "Mutual Fund" && newInv.schemeCode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Scheme #{newInv.schemeCode}
              </span>
              <button
                className="btn-ghost"
                style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  opacity: navFetching ? 0.6 : 1,
                }}
                disabled={navFetching}
                onClick={async () => {
                  setNavFetching(true);
                  setNavFetchMsg("");
                  const result = await mfLatestNAV(newInv.schemeCode);
                  setNavFetching(false);
                  if (result) {
                    setNewInv((n) => ({ ...n, existingCorpus: result.nav }));
                    setNavFetchMsg(
                      `\u2713 NAV \u20b9${result.nav} as of ${result.date}`,
                    );
                  } else {
                    setNavFetchMsg("Scheme not found");
                  }
                }}
              >
                {navFetching ? "Fetching\u2026" : "\u21bb Fetch live NAV"}
              </button>
              {navFetchMsg && (
                <span
                  style={{
                    fontSize: 12,
                    color: navFetchMsg.startsWith("\u2713")
                      ? "var(--green)"
                      : "var(--red, #e55)",
                  }}
                >
                  {navFetchMsg}
                </span>
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

// Re-export HouseholdInvestments (extracted to HouseholdInvestments.jsx)
export { HouseholdInvestments } from "./HouseholdInvestments";
