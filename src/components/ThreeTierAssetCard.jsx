import { useMemo } from "react";
import { fmt, fmtCr } from "../utils/finance";
import { calculateThreeTierWealth } from "../utils/financialDiagnostics";
import { InfoModal } from "./InfoModal";
import { ShieldCheck, Rocket, Wallet, Sparkles } from "lucide-react";

/**
 * ThreeTierAssetCard — Visual "Where is My Money?" Breakdown
 *
 * Explains net worth in 3 human-friendly buckets with transparent InfoModals:
 * 1. 💵 Liquid Cash (Daily bank accounts & emergency fund)
 * 2. 🚀 Wealth Growers (Mutual funds & equity SIPs for compounding)
 * 3. 🛡️ Guaranteed & Safe (FDs, PPF, Gold, EPF for security)
 */
export default function ThreeTierAssetCard({ p1, p2, shared, personNames }) {
  const tiers = useMemo(() => {
    const wealth = calculateThreeTierWealth({
      p1,
      p2,
      shared,
      personNames,
    });

    const {
      total,
      liquidCash,
      liquidPct,
      liquidItems,
      wealthGrowers,
      growersPct,
      growersItems,
      guaranteedSafe,
      safePct,
      safeItems,
    } = wealth;

    let allocationAdvice = "Your wealth is well-balanced across growth and guaranteed safety.";
    if (growersPct < 30 && total > 50000) {
      allocationAdvice = "You have a high share in fixed/safe assets. Consider allocating more to Flexi Cap SIPs for long-term inflation beating.";
    } else if (growersPct > 80 && total > 50000) {
      allocationAdvice = "High equity growth engine! Ensure you maintain 3-6 months in liquid cash for emergencies.";
    }

    return {
      total,
      liquidCash,
      liquidPct,
      liquidItems,
      wealthGrowers,
      growersPct,
      growersItems,
      guaranteedSafe,
      safePct,
      safeItems,
      allocationAdvice,
    };
  }, [p1, p2, shared, personNames]);

  if (tiers.total === 0) return null;

  return (
    <div
      className="card section-gap"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(18,18,24,0.98))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--gold)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
            Where is My Money? (3-Tier Wealth Structure)
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
          Total: {fmtCr(tiers.total)}
        </span>
      </div>

      {/* 3-Color Segmented Allocation Bar */}
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 99,
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
          marginBottom: 14,
        }}
      >
        {tiers.liquidPct > 0 && (
          <div
            title={`Liquid Cash: ${tiers.liquidPct}%`}
            style={{ width: `${tiers.liquidPct}%`, background: "var(--blue, #3b82f6)" }}
          />
        )}
        {tiers.growersPct > 0 && (
          <div
            title={`Wealth Growers: ${tiers.growersPct}%`}
            style={{ width: `${tiers.growersPct}%`, background: "var(--green, #10b981)" }}
          />
        )}
        {tiers.safePct > 0 && (
          <div
            title={`Guaranteed & Safe: ${tiers.safePct}%`}
            style={{ width: `${tiers.safePct}%`, background: "var(--gold, #fbbf24)" }}
          />
        )}
      </div>

      {/* 3 Bucket Cards with InfoModals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {/* Tier 1: Liquid Cash */}
        <div
          style={{
            background: "rgba(59, 130, 246, 0.04)",
            border: "1px solid rgba(59, 130, 246, 0.15)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Wallet size={13} color="var(--blue, #3b82f6)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--blue, #3b82f6)" }}>
                1. Liquid & Daily Cash
              </span>
            </div>
            {tiers.liquidItems.length > 0 && (
              <InfoModal title="Liquid Cash & Bank Balances">
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {tiers.liquidItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span>
                        {item.name} ({item.person})
                      </span>
                      <strong style={{ color: "var(--blue, #60a5fa)" }}>{fmt(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </InfoModal>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {fmt(tiers.liquidCash)}{" "}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              ({tiers.liquidPct}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            Instant bank funds & savings ready for bills & emergencies.
          </div>
        </div>

        {/* Tier 2: Wealth Growers */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.04)",
            border: "1px solid rgba(16, 185, 129, 0.15)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Rocket size={13} color="var(--green, #10b981)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green, #10b981)" }}>
                2. Wealth Growers (Equity)
              </span>
            </div>
            {tiers.growersItems.length > 0 && (
              <InfoModal title="Wealth Growers & Equity Portfolio">
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {tiers.growersItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span>
                        {item.name} ({item.person})
                      </span>
                      <strong style={{ color: "var(--green)" }}>{fmt(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </InfoModal>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {fmt(tiers.wealthGrowers)}{" "}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              ({tiers.growersPct}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            Mutual funds & SIPs actively compounding to beat inflation.
          </div>
        </div>

        {/* Tier 3: Guaranteed Safe */}
        <div
          style={{
            background: "rgba(251, 191, 36, 0.04)",
            border: "1px solid rgba(251, 191, 36, 0.15)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={13} color="var(--gold, #fbbf24)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gold, #fbbf24)" }}>
                3. Guaranteed & Safe
              </span>
            </div>
            {tiers.safeItems.length > 0 && (
              <InfoModal title="Guaranteed & Safe Assets">
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {tiers.safeItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span>
                        {item.name} ({item.person})
                      </span>
                      <strong style={{ color: "var(--gold)" }}>{fmt(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </InfoModal>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {fmt(tiers.guaranteedSafe)}{" "}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              ({tiers.safePct}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            FDs, PPF, EPF & Gold providing downside capital protection.
          </div>
        </div>
      </div>

      {/* Simple Guidance Note */}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "var(--text-secondary)",
          background: "rgba(255,255,255,0.02)",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px dashed rgba(255,255,255,0.06)",
        }}
      >
        💡 <strong>Guidance:</strong> {tiers.allocationAdvice}
      </div>
    </div>
  );
}
