import { useState, useMemo } from "react";
import { fmt, isFD, lumpCorpus } from "../utils/finance";
import { getInvestmentCurrentValue } from "../utils/goalFunding";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function PortfolioAuditCard({
  investments = [],
  onFilterByType,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const audit = useMemo(() => {
    if (!investments || investments.length === 0) return null;

    let totalVal = 0;
    let weightedReturnSum = 0;
    const now = new Date();

    const topPerformers = [];
    const lowYieldFDs = [];
    const maturedFDs = [];
    const equityFunds = [];

    investments.forEach((inv) => {
      const val = getInvestmentCurrentValue(inv);
      totalVal += val;
      const r = Number(inv.returnPct || 0);
      weightedReturnSum += val * r;

      const isFDType = isFD(inv.type);
      const isMFType = inv.type === "Mutual Fund" || inv.type === "Stocks";

      // Check maturity
      const endDate = inv.endDate || inv.maturityDate;
      const isMatured = isFDType && endDate ? new Date(endDate) < now : false;

      if (isFDType) {
        if (isMatured) {
          maturedFDs.push({ ...inv, currentValue: val });
        } else if (r > 0 && r < 6.8) {
          lowYieldFDs.push({ ...inv, currentValue: val, gapPct: (6.8 - r).toFixed(1) });
        }
      }

      if (isMFType) {
        equityFunds.push({ ...inv, currentValue: val });
        if (r >= 12) {
          topPerformers.push({ ...inv, currentValue: val });
        }
      }
    });

    const avgReturn = totalVal > 0 ? (weightedReturnSum / totalVal).toFixed(1) : 0;
    topPerformers.sort((a, b) => (b.returnPct || 0) - (a.returnPct || 0));
    lowYieldFDs.sort((a, b) => (a.returnPct || 0) - (b.returnPct || 0));

    // Calculate potential 5-year gain if low yield FDs are reallocated to balanced 12% equity
    const lowYieldTotal = lowYieldFDs.reduce((s, x) => s + x.currentValue, 0);
    const fd5YrGain = lowYieldFDs.reduce(
      (s, x) => s + lumpCorpus(x.currentValue, x.returnPct || 5.5, 5),
      0,
    );
    const equity5YrGain = lumpCorpus(lowYieldTotal, 12, 5);
    const potentialGainBoost = Math.max(0, equity5YrGain - fd5YrGain);

    const issuesCount = lowYieldFDs.length + maturedFDs.length;

    let healthStatus = "Optimal";
    let healthColor = "var(--green, #10b981)";
    let healthLabel = "Strong Compounding Engine";

    if (issuesCount > 0) {
      healthStatus = "Opportunity Available";
      healthColor = "var(--gold, #fbbf24)";
      healthLabel = `${issuesCount} Asset Optimization${issuesCount > 1 ? "s" : ""} Found`;
    }

    return {
      totalVal,
      avgReturn,
      topPerformers: topPerformers.slice(0, 3),
      lowYieldFDs,
      maturedFDs,
      issuesCount,
      lowYieldTotal,
      potentialGainBoost,
      healthStatus,
      healthColor,
      healthLabel,
    };
  }, [investments]);

  if (!audit) return null;

  return (
    <div
      className="card section-gap"
      style={{
        background: "linear-gradient(135deg, rgba(201,168,76,0.06), rgba(18,18,24,0.98))",
        border: "1px solid rgba(201,168,76,0.25)",
        borderRadius: 14,
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(201,168,76,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gold)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                Portfolio Health & Audit Summary
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: audit.healthColor + "22",
                  color: audit.healthColor,
                  fontWeight: 600,
                  border: `1px solid ${audit.healthColor}44`,
                }}
              >
                {audit.healthLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Portfolio Value: <strong style={{ color: "#fff" }}>{fmt(audit.totalVal)}</strong> · Weighted Expected Return:{" "}
              <strong style={{ color: "var(--gold)" }}>{audit.avgReturn}% p.a.</strong>
            </div>
          </div>
        </div>

        <button
          className="btn-icon"
          aria-label={collapsed ? "Expand portfolio audit" : "Collapse portfolio audit"}
          style={{ color: "var(--text-muted)" }}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Expanded Audit Insights */}
      {!collapsed && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {/* Column 1: Star Performers */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--green, #10b981)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <TrendingUp size={14} />
                🌟 Top Wealth Compounders ({audit.topPerformers.length})
              </div>
              {audit.topPerformers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {audit.topPerformers.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        padding: "4px 0",
                      }}
                    >
                      <span style={{ color: "#fff", fontWeight: 500 }}>{p.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--text-muted)" }}>{fmt(p.currentValue)}</span>
                        <span
                          style={{
                            color: "var(--green)",
                            fontWeight: 700,
                            background: "rgba(16, 185, 129, 0.1)",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {p.returnPct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  No equity/mutual funds configured yet.
                </div>
              )}
            </div>

            {/* Column 2: Low-Yield & Matured FDs */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: audit.issuesCount > 0 ? "var(--gold, #fbbf24)" : "var(--green)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {audit.issuesCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                ⚠️ FD Optimization & Matured Alerts ({audit.issuesCount})
              </div>

              {audit.issuesCount > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {audit.maturedFDs.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        background: "rgba(16, 185, 129, 0.08)",
                        padding: "5px 8px",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={12} color="var(--green)" />
                        <span style={{ color: "#fff", fontWeight: 600 }}>{m.name} (Matured)</span>
                      </div>
                      <strong style={{ color: "var(--green)" }}>{fmt(m.currentValue)}</strong>
                    </div>
                  ))}

                  {audit.lowYieldFDs.map((fd) => (
                    <div
                      key={fd.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        padding: "4px 0",
                      }}
                    >
                      <div>
                        <span style={{ color: "#fff" }}>{fd.name}</span>
                        <div style={{ fontSize: 10, color: "var(--gold)" }}>
                          Only {fd.returnPct}% p.a. ({fd.gapPct}% below benchmark)
                        </div>
                      </div>
                      <strong style={{ color: "var(--gold)" }}>{fmt(fd.currentValue)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  ✓ All your FDs have healthy interest rates above the inflation benchmark!
                </div>
              )}
            </div>
          </div>

          {/* Actionable Advice Banner */}
          {audit.potentialGainBoost > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "linear-gradient(90deg, rgba(201,168,76,0.12), rgba(16,185,129,0.08))",
                border: "1px solid rgba(201,168,76,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} color="var(--gold)" />
                <span style={{ fontSize: 12, color: "#fff" }}>
                  💡 <strong>Opportunity:</strong> Shifting {fmt(audit.lowYieldTotal)} from sub-par FDs to balanced equity/index SIPs can generate{" "}
                  <strong style={{ color: "var(--green)" }}>+{fmt(audit.potentialGainBoost)} extra wealth</strong> over 5 years.
                </span>
              </div>

              {onFilterByType && (
                <button
                  className="btn-secondary"
                  onClick={() => onFilterByType("FD")}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Review FDs <ArrowRight size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
