import { X, TrendingUp, TrendingDown } from "lucide-react";
import { Chart } from "./Chart";
import { fmt } from "../utils/finance";

// Shows how much was spent in ONE expense category across a trailing window
// of months, so a user can spot rising/falling spend trends per category.
export default function CategoryTrendModal({
  open,
  onClose,
  category,
  data = [], // [{ ym, label, amount }], oldest → newest
  color = "var(--gold)",
  range,
  onRangeChange,
}) {
  if (!open) return null;

  const amounts = data.map((d) => d.amount);
  const total = amounts.reduce((s, a) => s + a, 0);
  const average = data.length > 0 ? total / data.length : 0;
  const peakIdx = amounts.reduce(
    (best, a, i) => (a > amounts[best] ? i : best),
    0,
  );
  const peak = data[peakIdx];
  const latest = data[data.length - 1]?.amount || 0;
  const prev = data[data.length - 2]?.amount || 0;
  const trendPct = prev > 0 ? Math.round(((latest - prev) / prev) * 100) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(10px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={16} color={color} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {category} trend
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 6, display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => onRangeChange(n)}
              className="btn-ghost"
              style={{
                fontSize: 11,
                padding: "4px 10px",
                background: range === n ? color : undefined,
                color: range === n ? "#0b0b0f" : undefined,
                fontWeight: range === n ? 600 : 400,
              }}
            >
              {n}M
            </button>
          ))}
        </div>

        {data.length === 0 || total === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No spend logged for {category} in this window.
          </div>
        ) : (
          <>
            <div style={{ height: 200, marginBottom: 18 }}>
              <Chart
                categories={data.map((d) => d.label)}
                series={[{ name: category, type: "bar", data: amounts, color }]}
                fmt={fmt}
                grid={{ top: 12, right: 8 }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                  Average / month
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {fmt(average)}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                  Total ({data.length}mo)
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {fmt(total)}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                  Highest month
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {peak ? `${peak.label} · ${fmt(peak.amount)}` : "—"}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                  vs previous month
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color:
                      trendPct == null
                        ? "var(--text-secondary)"
                        : trendPct > 0
                          ? "var(--red)"
                          : trendPct < 0
                            ? "var(--green)"
                            : "var(--text-secondary)",
                  }}
                >
                  {trendPct == null ? (
                    "—"
                  ) : (
                    <>
                      {trendPct > 0 ? (
                        <TrendingUp size={13} />
                      ) : trendPct < 0 ? (
                        <TrendingDown size={13} />
                      ) : null}
                      {trendPct > 0 ? "+" : ""}
                      {trendPct}%
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
