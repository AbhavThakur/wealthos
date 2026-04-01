import { useState } from "react";
import {
  fmt,
  fmtCr,
  nextId,
  INVESTMENT_TYPES,
  totalCorpus,
  lumpCorpus,
  freqToMonthly,
} from "../utils/finance";
import { Plus, Trash2, Edit3, Check, X, Download } from "lucide-react";
import { useData } from "../context/DataContext";
import {
  SIPCard,
  PortfolioCharts,
  ExportMenu,
  InfoModal,
  MF_CAP_CATEGORIES,
} from "./Investments";
import {
  computeInvRow,
  getInvested,
  isFD,
  INVESTMENT_APPS,
  BANK_LIST,
  hasSIPFreq,
  hasDeductionDate,
  hasDeductionMonth,
  hasInvestmentApp,
  DEDUCTION_DAYS,
  WEEKDAYS,
  MONTHS,
  ordinalSuffix,
} from "./investmentHelpers";

export function HouseholdInvestments({ abhav, aanya, updatePerson }) {
  const { personNames } = useData() || {};
  const [filterPerson, setFilterPerson] = useState("All");
  const [filterApp, setFilterApp] = useState("All");
  const [filterBank, setFilterBank] = useState("All");
  const [filterType, setFilterType] = useState("All");
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
    maturityDate: "",
    appName: "",
    bankName: "",
    deductionDate: "",
    deductionDay: "",
    totalInvested: "",
    capCategory: "",
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
  const allBanks = [
    ...new Set(allInvestments.map((x) => x.bankName).filter(Boolean)),
  ];

  let filtered =
    filterPerson === "All"
      ? allInvestments
      : filterPerson === "abhav"
        ? abhavInvs
        : aanyaInvs;
  if (filterApp !== "All")
    filtered = filtered.filter((x) => x.appName === filterApp);
  if (filterBank !== "All")
    filtered = filtered.filter((x) => x.bankName === filterBank);
  if (filterType !== "All")
    filtered = filtered.filter((x) => x.type === filterType);

  const calcM = (list) => {
    const monthly = list.reduce(
      (s, x) => (isFD(x.type) ? s : s + freqToMonthly(x.amount, x.frequency)),
      0,
    );
    const current = list.reduce((s, x) => {
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
      if (x.frequency === "onetime") {
        const _yrs = x.startDate
          ? Math.max(
              0,
              (new Date() - new Date(x.startDate)) /
                (365.25 * 24 * 3600 * 1000),
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
    const yr20 = list.reduce((s, x) => {
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
    const { cost, currentForGain } = list.reduce(
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
            cost: acc.cost + (x.amount || 0),
            currentForGain:
              acc.currentForGain +
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
            cost: acc.cost + (x.amount || 0),
            currentForGain:
              acc.currentForGain +
              (x.existingCorpus > 0
                ? x.existingCorpus
                : lumpCorpus(x.amount || 0, x.returnPct || 0, _yrs)),
          };
        }
        const ti = getInvested(x);
        if (ti > 0)
          return {
            cost: acc.cost + ti,
            currentForGain: acc.currentForGain + (x.existingCorpus || 0),
          };
        return acc;
      },
      { cost: 0, currentForGain: 0 },
    );
    return {
      monthly,
      current,
      yr20,
      cost,
      gain: cost > 0 ? currentForGain - cost : null,
      gainPct: cost > 0 ? ((currentForGain - cost) / cost) * 100 : null,
    };
  };
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
  const pLabel = (o) => personNames?.[o] || o;

  // Per-investment rows used in info modals (household)
  const hhInvRows = filtered.map((x) => ({
    ...computeInvRow(x),
    owner: x._owner,
  }));

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
      <div className="grid-4 section-gap">
        <div className="metric-card">
          <div className="metric-label">
            Monthly contribution
            <InfoModal title="Monthly contribution">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total: {fmt(m.monthly)} / month
                </strong>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {" "}
                  (Abhav {fmt(mA.monthly)} + Aanya {fmt(mAn.monthly)})
                </span>
              </div>
              {hhInvRows.filter((r) => r.monthly > 0).length === 0 ? (
                <div style={{ color: "#888" }}>No active SIPs yet.</div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
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
                    <span style={{ width: 50 }}>Who</span>
                    <span style={{ width: 80, textAlign: "right" }}>
                      Monthly
                    </span>
                  </div>
                  {hhInvRows
                    .filter((r) => r.monthly > 0)
                    .map((r, i) => (
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
                          style={{
                            width: 50,
                            color:
                              r.owner === "abhav"
                                ? "var(--abhav)"
                                : "var(--aanya)",
                            fontSize: 11,
                          }}
                        >
                          {pLabel(r.owner)}
                        </span>
                        <span
                          style={{
                            width: 80,
                            textAlign: "right",
                            color: "#eeeae4",
                            fontWeight: 500,
                          }}
                        >
                          {fmt(r.monthly)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </InfoModal>
          </div>
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
          <div className="metric-label">
            Current portfolio value
            <InfoModal title="Current portfolio value">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total: {fmtCr(m.current)}
                </strong>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {" "}
                  (Abhav {fmtCr(mA.current)} + Aanya {fmtCr(mAn.current)})
                </span>
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
                  <span style={{ width: 50 }}>Who</span>
                  <span style={{ width: 80, textAlign: "right" }}>Value</span>
                </div>
                {hhInvRows.map((r, i) => (
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
                    <span style={{ color: "#b0aab8", flex: 1 }}>{r.name}</span>
                    <span
                      style={{
                        width: 50,
                        color:
                          r.owner === "abhav" ? "var(--abhav)" : "var(--aanya)",
                        fontSize: 11,
                      }}
                    >
                      {pLabel(r.owner)}
                    </span>
                    <span
                      style={{
                        width: 80,
                        textAlign: "right",
                        color: r.cur > 0 ? "#eeeae4" : "#555",
                        fontWeight: 500,
                      }}
                    >
                      {r.cur > 0 ? fmtCr(r.cur) : "Not set"}
                    </span>
                  </div>
                ))}
              </div>
            </InfoModal>
          </div>
          <div className="metric-value gold-text">
            {fmt(Math.round(m.current))}
          </div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>
              {fmt(Math.round(mA.current))}
            </span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>
              {fmt(Math.round(mAn.current))}
            </span>
          </div>
          {m.cost > 0 && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}
            >
              Invested: {fmt(m.cost)}
            </div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">
            20-year projection
            <InfoModal title="20-year projection">
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: "#eeeae4" }}>
                  Total in 20 years: {fmtCr(m.yr20)}
                </strong>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {" "}
                  from {fmtCr(m.current)} today
                </span>
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
                  <span style={{ width: 50 }}>Who</span>
                  <span style={{ width: 80, textAlign: "right" }}>
                    20yr value
                  </span>
                </div>
                {hhInvRows
                  .filter((r) => r.yr20 !== null)
                  .map((r, i) => (
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
                        style={{
                          width: 50,
                          color:
                            r.owner === "abhav"
                              ? "var(--abhav)"
                              : "var(--aanya)",
                          fontSize: 11,
                        }}
                      >
                        {pLabel(r.owner)}
                      </span>
                      <span
                        style={{
                          width: 80,
                          textAlign: "right",
                          color: "#4ade80",
                          fontWeight: 500,
                        }}
                      >
                        {fmtCr(r.yr20)}
                      </span>
                    </div>
                  ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Assumes same SIP rate &amp; expected returns are sustained.
              </div>
            </InfoModal>
          </div>
          <div className="metric-value green-text">{fmtCr(m.yr20)}</div>
          <div className="metric-sub">
            <span style={{ color: "var(--abhav)" }}>{fmtCr(mA.yr20)}</span>
            {" · "}
            <span style={{ color: "var(--aanya)" }}>{fmtCr(mAn.yr20)}</span>
          </div>
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
                    {fmt(m.gain !== null ? m.gain + m.current : m.current)}
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
                    − {m.gain !== null ? fmt(m.current - m.gain) : "—"}
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
                        m.gain === null
                          ? "#666"
                          : m.gain >= 0
                            ? "#4ade80"
                            : "#f87171",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {m.gain === null
                      ? "—"
                      : `${m.gain >= 0 ? "+" : "−"}${fmt(m.gain)}`}
                    {m.gainPct !== null && (
                      <span
                        style={{ fontSize: 12, marginLeft: 6, fontWeight: 400 }}
                      >
                        ({m.gainPct >= 0 ? "+" : ""}
                        {m.gainPct.toFixed(1)}%)
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
                  <span style={{ width: 40 }}>Who</span>
                  <span style={{ width: 65, textAlign: "right" }}>
                    Invested
                  </span>
                  <span style={{ width: 65, textAlign: "right" }}>Current</span>
                  <span style={{ width: 55, textAlign: "right" }}>P&amp;L</span>
                </div>
                {hhInvRows.map((r, i) => {
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
                        style={{
                          width: 40,
                          color:
                            r.owner === "abhav"
                              ? "var(--abhav)"
                              : "var(--aanya)",
                          fontSize: 11,
                        }}
                      >
                        {(pLabel(r.owner) || "?")[0]}
                      </span>
                      <span
                        style={{ width: 65, textAlign: "right", color: "#888" }}
                      >
                        {r.invested > 0 ? (
                          fmtCr(r.invested)
                        ) : (
                          <span style={{ color: "#555" }}>—</span>
                        )}
                      </span>
                      <span
                        style={{
                          width: 65,
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
                          width: 55,
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
                m.gain === null
                  ? "var(--text-muted)"
                  : m.gain >= 0
                    ? "var(--green)"
                    : "var(--red)",
            }}
          >
            {m.gain === null
              ? "—"
              : `${m.gain >= 0 ? "+" : "−"}${fmtCr(m.gain)}`}
          </div>
          <div className="metric-sub">
            {m.gainPct !== null ? (
              <>
                {m.gainPct >= 0 ? "+" : ""}
                {m.gainPct.toFixed(1)}% return
                {mA.gainPct !== null && mAn.gainPct !== null && (
                  <>
                    {" "}
                    ·{" "}
                    <span style={{ color: "var(--abhav)" }}>
                      {mA.gainPct >= 0 ? "+" : ""}
                      {mA.gainPct.toFixed(1)}%
                    </span>
                    {" / "}
                    <span style={{ color: "var(--aanya)" }}>
                      {mAn.gainPct >= 0 ? "+" : ""}
                      {mAn.gainPct.toFixed(1)}%
                    </span>
                  </>
                )}
              </>
            ) : (
              'Add "total invested" to SIPs'
            )}
          </div>
        </div>
      </div>

      <PortfolioCharts rows={hhInvRows} isHousehold={true} />

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
            {
              id: "abhav",
              label: personNames?.abhav || "Person 1",
              color: "var(--abhav)",
            },
            {
              id: "aanya",
              label: personNames?.aanya || "Person 2",
              color: "var(--aanya)",
            },
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
        {allBanks.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
                  cursor: "pointer",
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
                  fontWeight: filterBank === bank ? 500 : 400,
                }}
              >
                {bank}
              </button>
            ))}
          </div>
        )}
        {(() => {
          const types = ["All", ...new Set(allInvestments.map((x) => x.type))];
          if (types.length <= 2) return null;
          return (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
                    cursor: "pointer",
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
                    fontWeight: filterType === t ? 500 : 400,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {filtered.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "0.75rem",
          }}
        >
          <ExportMenu
            rows={hhInvRows}
            rawData={filtered}
            totals={{
              monthly: m.monthly,
              current: m.current,
              yr20: m.yr20,
              gain: m.gain,
              gainPct: m.gainPct,
            }}
            title="Household Investments"
            filename="household-investments"
          />
        </div>
      )}

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
              {
                id: "abhav",
                label: personNames?.abhav || "Person 1",
                color: "var(--abhav)",
              },
              {
                id: "aanya",
                label: personNames?.aanya || "Person 2",
                color: "var(--aanya)",
              },
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
                      label:
                        newInv.frequency === "onetime"
                          ? "Current market value (₹)"
                          : "Current corpus (₹)",
                      type: "number",
                      placeholder:
                        newInv.frequency === "onetime"
                          ? "From your app (optional)"
                          : "",
                    },
                  ]
                : []),
              {
                key: "amount",
                label: isFD(newInv.type)
                  ? "Principal (₹)"
                  : newInv.frequency === "onetime"
                    ? "Purchase amount (₹)"
                    : newInv.frequency === "weekly"
                      ? "Weekly SIP (₹)"
                      : newInv.frequency === "yearly"
                        ? "Yearly SIP (₹)"
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
              ...(!isFD(newInv.type) && newInv.frequency !== "onetime"
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
                  {...(f.key === "bankName" ? { list: "bank-list-hh" } : {})}
                />
                {f.key === "bankName" && (
                  <datalist id="bank-list-hh">
                    {BANK_LIST.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                )}
                {["amount", "existingCorpus", "totalInvested"].includes(
                  f.key,
                ) &&
                  Number(newInv[f.key]) > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 3,
                      }}
                    >
                      = {fmt(Number(newInv[f.key]))}
                    </div>
                  )}
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
                  <option value="onetime">One-time</option>
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
              ) : newInv.frequency === "onetime" ? (
                <>
                  <span>
                    Purchase:{" "}
                    <strong style={{ color: pColor(addFor) }}>
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
                    <strong style={{ color: pColor(addFor) }}>
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
