import { useState, useMemo } from "react";
import { calculateLTCGHarvestingPlan, LTCG_ANNUAL_EXEMPTION_LIMIT } from "../utils/taxHarvesting";
import { fmt } from "../utils/finance";
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Info,
  ShieldCheck,
} from "lucide-react";

export default function TaxHarvestingCard({
  investments = [],
  harvestedSoFar = 0,
  personName = "Abhav",
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => {
    return calculateLTCGHarvestingPlan(investments, harvestedSoFar);
  }, [investments, harvestedSoFar]);

  const handleCopySummary = () => {
    if (plan.recommendations.length === 0) return;
    const text = [
      `📊 LTCG ₹1.25L Tax Harvesting Plan for ${personName} (FY 2024-25 / 2025-26):`,
      `• Total Harvestable LTCG: ${fmt(plan.totalHarvestableGain)}`,
      `• Estimated Tax Saved: ${fmt(plan.totalTaxSaved)} (at 12.5% LTCG)`,
      ``,
      `Execution Steps:`,
      ...plan.recommendations.map(
        (r, idx) =>
          `${idx + 1}. ${r.name} (Folio: ${r.folio})\n   - Redeem: ${r.unitsToRedeem} units (${fmt(r.redemptionValue)})\n   - Harvests: ${fmt(r.gainToHarvest)} zero-tax profit\n   - Action: Reinvest immediately to reset cost basis.`
      ),
    ].join("\n");

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (investments.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        padding: 20,
        marginBottom: 20,
        background: "linear-gradient(135deg, rgba(34, 197, 94, 0.04) 0%, rgba(59, 130, 246, 0.04) 100%)",
        border: "1px solid rgba(34, 197, 94, 0.25)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Banner Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(34, 197, 94, 0.15)",
              color: "var(--green)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                LTCG ₹1.25 Lakh Tax Harvesting Advisor
              </h3>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "var(--green)",
                  fontWeight: 600,
                }}
              >
                Section 112A
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Harvest up to ₹1,25,000 in zero-tax long-term profits before March 31 to reset your purchase cost basis
            </p>
          </div>
        </div>

        {plan.totalTaxSaved > 0 && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              padding: "6px 14px",
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "block" }}>Tax Saving Opportunity</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--green)" }}>+ {fmt(plan.totalTaxSaved)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar & Stats */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: "var(--text-secondary)" }}>
            Available LTCG to Harvest: <strong style={{ color: "#fff" }}>{fmt(plan.totalHarvestableGain)}</strong> / {fmt(LTCG_ANNUAL_EXEMPTION_LIMIT)}
          </span>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>
            {plan.percentUtilized}% utilized
          </span>
        </div>

        {/* Visual Track */}
        <div
          style={{
            width: "100%",
            height: 8,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${plan.percentUtilized}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--p1) 0%, var(--green) 100%)",
              borderRadius: 999,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Toggle Details & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 8px" }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Hide Harvesting Plan" : `View ${plan.recommendations.length} Recommended Fund Redemptions`}
        </button>

        {plan.recommendations.length > 0 && (
          <button
            onClick={handleCopySummary}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 12px" }}
          >
            {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
            {copied ? "Copied Plan!" : "Copy Execution Summary"}
          </button>
        )}
      </div>

      {/* Expandable Breakdown Table */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {plan.recommendations.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0" }}>
              No mutual funds with long-term unrealized gains (&gt; 1 year holding) found in this portfolio yet.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                💡 <strong>How to execute:</strong> Place a redemption order for the exact units below, then immediately reinvest the proceeds into the same fund or an equivalent index fund on the same day.
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "6px 8px" }}>Mutual Fund / Stock</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Units to Redeem</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Redemption Value</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Harvested Gain</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Tax Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.recommendations.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 8px" }}>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Folio: {r.folio}</div>
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "right" }}>
                          {r.unitsToRedeem > 0 ? r.unitsToRedeem.toLocaleString("en-IN") : "-"}
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 600 }}>
                          {fmt(r.redemptionValue)}
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                          {fmt(r.gainToHarvest)}
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--green)", fontWeight: 700 }}>
                          +{fmt(r.estimatedTaxSaved)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
