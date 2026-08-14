import { useMemo, useState } from "react";
import { Heart, ChevronDown, ChevronUp } from "lucide-react";
import { Chart } from "../components/Chart";
import { fmt, fmtCr } from "../utils/finance";
import { upsertMonthlyReview } from "../utils/monthlyReview";
import EmptyState from "../components/EmptyState";
import MoneyDateModal from "../components/MoneyDateModal";

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function MonthlyReview({
  p1,
  p2,
  shared,
  updateShared,
  personNames,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const todayYm = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const reviews = useMemo(() => shared?.monthlyReviews || [], [shared]);
  const sortedDesc = useMemo(
    () =>
      [...reviews].sort((a, b) => (b.month || "").localeCompare(a.month || "")),
    [reviews],
  );
  const sortedAsc = useMemo(
    () =>
      [...reviews]
        .sort((a, b) => (a.month || "").localeCompare(b.month || ""))
        .slice(-12),
    [reviews],
  );
  const hasCurrentReview = reviews.some((r) => r.month === todayYm);

  const saveReview = (review) => {
    updateShared(
      "monthlyReviews",
      upsertMonthlyReview(shared?.monthlyReviews, review),
    );
  };

  return (
    <div>
      <div
        className="card section-gap"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>
            💛 Monthly Couple Review
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            5 minutes together, every month — health score, spending, goals, and
            one shared pact for what's next.
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => setReviewOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          <Heart size={14} fill="currentColor" />
          {hasCurrentReview
            ? "Redo This Month's Review"
            : "Start This Month's Review"}
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="card section-gap">
          <EmptyState
            type="generic"
            title="No monthly reviews yet"
            description="Sit down together once a month for 5 minutes — see your health score, top spends, and agree on one focus for next month."
            actionLabel="Start your first review"
            onAction={() => setReviewOpen(true)}
          />
        </div>
      ) : (
        <>
          {sortedAsc.length >= 2 && (
            <div className="card section-gap">
              <div className="card-title">📈 Trend Over Time</div>
              <div style={{ height: 180 }}>
                <Chart
                  categories={sortedAsc.map((r) => monthLabel(r.month))}
                  series={[
                    {
                      name: "Health Score",
                      type: "line",
                      data: sortedAsc.map((r) => r.healthScore?.score ?? null),
                      color: "#4caf82",
                      symbol: "circle",
                    },
                    {
                      name: "Savings Rate %",
                      type: "line",
                      data: sortedAsc.map(
                        (r) => r.summary?.savingsRate ?? null,
                      ),
                      color: "#5b9cf6",
                      symbol: "circle",
                    },
                  ]}
                  grid={{ top: 24, right: 8 }}
                />
              </div>
            </div>
          )}

          <div className="card-title section-gap" style={{ marginBottom: 8 }}>
            🗂️ Review History
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedDesc.map((review) => {
              const key = review.id || review.month;
              const expanded = expandedId === key;
              return (
                <div key={key} className="card" style={{ padding: 16 }}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : key)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {monthLabel(review.month)}
                      </div>
                      {review.reflection?.win && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          🏆 {review.reflection.win}
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 14 }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--green)",
                          }}
                        >
                          {review.summary?.savingsRate ?? 0}% saved
                        </div>
                        {review.healthScore && (
                          <div
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                          >
                            Health {review.healthScore.score}/100
                          </div>
                        )}
                      </div>
                      {expanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                          fontSize: 12,
                        }}
                      >
                        <div>
                          Income:{" "}
                          <strong>
                            {fmt(review.summary?.totalIncome || 0)}
                          </strong>
                        </div>
                        <div>
                          Spent:{" "}
                          <strong>
                            {fmt(review.summary?.totalSpent || 0)}
                          </strong>
                        </div>
                        <div>
                          Invested:{" "}
                          <strong>
                            {fmt(review.summary?.totalInvested || 0)}
                          </strong>
                        </div>
                        <div>
                          Net Worth:{" "}
                          <strong>
                            {fmtCr(review.summary?.combinedNetWorth || 0)}
                          </strong>
                        </div>
                      </div>

                      {review.topSpending?.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            Top Spending
                          </div>
                          {review.topSpending.map((s) => (
                            <div
                              key={s.category}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 12,
                                color: "var(--text-muted)",
                              }}
                            >
                              <span>{s.category}</span>
                              <span>{fmt(s.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {review.settlement && !review.settlement.isSettled && (
                        <div style={{ fontSize: 12 }}>
                          Settlement: {fmt(review.settlement.netBalance)}{" "}
                          outstanding
                        </div>
                      )}

                      {review.tips?.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            Tips given
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              fontSize: 12,
                              color: "var(--text-muted)",
                            }}
                          >
                            {review.tips.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(review.reflection?.improve ||
                        review.reflection?.nextAction) && (
                        <div style={{ fontSize: 12 }}>
                          {review.reflection.improve && (
                            <div>🔧 Improve: {review.reflection.improve}</div>
                          )}
                          {review.reflection.nextAction && (
                            <div style={{ marginTop: 4 }}>
                              ➡️ Next: {review.reflection.nextAction}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <MoneyDateModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSaveReview={saveReview}
        p1={p1}
        p2={p2}
        shared={shared}
        month={todayYm}
        personNames={personNames}
      />
    </div>
  );
}
