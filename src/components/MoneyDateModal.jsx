import { useState, useMemo, useEffect, useRef } from "react";
import { fmt, freqToMonthly, insuranceAdequacy } from "../utils/finance";
import { calcHealthScore, buildReviewTips } from "../utils/monthlyReview";
import { calculateNetWorth } from "../utils/netWorth";
import { calculateSettlement } from "../utils/settlement";
import { statsFromTxns } from "../pages/Dashboard";
import {
  Heart,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Zap,
} from "lucide-react";

/**
 * Zero-dependency lightweight canvas confetti burst
 */
function fireConfetti(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;
  const particles = [];
  const colors = ["#eab308", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
    });
  }

  function update() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.alpha -= 0.015;
      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });
    if (alive) {
      requestAnimationFrame(update);
    }
  }
  update();
}

function DeltaBadge({ delta, goodWhenUp = true, format = fmt }) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const good = up === goodWhenUp;
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        marginTop: 3,
        color: good ? "var(--green)" : "var(--red)",
      }}
    >
      {up ? "▲" : "▼"} {format(Math.abs(delta))} vs last month
    </div>
  );
}

export default function MoneyDateModal({
  open,
  onClose,
  onSaveReview,
  p1,
  p2,
  shared,
  month,
  personNames = { p1: "Partner 1", p2: "Partner 2" },
}) {
  const [step, setStep] = useState(1);
  const [reflection, setReflection] = useState({
    win: "",
    improve: "",
    nextAction: "",
  });
  const confettiCanvasRef = useRef(null);

  const currentStats1 = statsFromTxns(
    p1?.transactions,
    p1?.expenses,
    p1?.incomes,
    month,
    p1?.subscriptions,
  );
  const currentStats2 = statsFromTxns(
    p2?.transactions,
    p2?.expenses,
    p2?.incomes,
    month,
    p2?.subscriptions,
  );

  const p1Salary = (p1?.incomes || []).reduce((s, i) => s + (i.amount || 0), 0);
  const p2Salary = (p2?.incomes || []).reduce((s, i) => s + (i.amount || 0), 0);
  const p1Exps = (p1?.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const p2Exps = (p2?.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);

  const totalIncome =
    (currentStats1.income || 0) + (currentStats2.income || 0) ||
    p1Salary + p2Salary;
  const totalSpent =
    (currentStats1.expenses || 0) + (currentStats2.expenses || 0) ||
    p1Exps + p2Exps;
  const totalInvested =
    (currentStats1.investments || 0) + (currentStats2.investments || 0);
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100)
      : 0;

  // Previous month stats for MoM deltas
  const prevYm = (() => {
    const [y, m] = (month || "").split("-").map(Number);
    if (!y || !m) return null;
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const prevStats1 = statsFromTxns(
    p1?.transactions,
    p1?.expenses,
    p1?.incomes,
    prevYm,
    p1?.subscriptions,
  );
  const prevStats2 = statsFromTxns(
    p2?.transactions,
    p2?.expenses,
    p2?.incomes,
    prevYm,
    p2?.subscriptions,
  );
  const prevIncome = (prevStats1.income || 0) + (prevStats2.income || 0);
  const prevSpent = (prevStats1.expenses || 0) + (prevStats2.expenses || 0);
  const prevInvested =
    (prevStats1.investments || 0) + (prevStats2.investments || 0);
  const hasPrevData = prevIncome > 0;
  const prevSavingsRate =
    prevIncome > 0
      ? Math.round(((prevIncome - prevSpent) / prevIncome) * 100)
      : 0;

  // Net Worth stats
  const nw1 = calculateNetWorth(p1);
  const nw2 = calculateNetWorth(p2);
  const combinedNetWorth = nw1.net + nw2.net;

  const prevNWEntry = (shared?.netWorthHistory || []).find(
    (s) =>
      prevYm &&
      s.year === Number(prevYm.slice(0, 4)) &&
      s.month === Number(prevYm.slice(5, 7)),
  );
  const netWorthDelta = prevNWEntry
    ? combinedNetWorth -
      ((prevNWEntry.p1NetWorth || 0) + (prevNWEntry.p2NetWorth || 0))
    : null;

  // Settlement balance
  const settlement = useMemo(
    () => calculateSettlement(p1, p2, shared, month),
    [p1, p2, shared, month],
  );

  // Top spending spikes vs previous month
  const spendingSpikes = useMemo(() => {
    const currentCats = {};

    [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
      const cat = e.category || "General";
      currentCats[cat] = (currentCats[cat] || 0) + (e.amount || 0);
    });

    const spikes = [];
    Object.entries(currentCats).forEach(([cat, amt]) => {
      if (amt > 3000) {
        spikes.push({ category: cat, amount: amt });
      }
    });

    return spikes.sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [p1, p2]);

  // Fixable leaks: active recurring subscriptions
  const subscriptionLeaks = [
    ...(p1?.subscriptions || []),
    ...(p2?.subscriptions || []),
  ]
    .filter((s) => s.active !== false)
    .map((s) => ({
      name: s.name,
      monthly: freqToMonthly(s.amount, s.frequency),
    }))
    .sort((a, b) => b.monthly - a.monthly);
  const subscriptionTotal = subscriptionLeaks.reduce(
    (s, x) => s + x.monthly,
    0,
  );

  // Household health score — same 5-pillar model as the Dashboard
  const allInvestments = [
    ...(p1?.investments || []),
    ...(p2?.investments || []),
  ];
  const liquidCash =
    (p1?.savingsAccounts || []).reduce((s, x) => s + (x.balance || 0), 0) +
    (p2?.savingsAccounts || []).reduce((s, x) => s + (x.balance || 0), 0);
  const debtEMIs = [...(p1?.debts || []), ...(p2?.debts || [])].reduce(
    (s, d) => s + (d.emi || 0),
    0,
  );
  const hasActiveSIP =
    totalInvested > 0 ||
    allInvestments.some((inv) => inv.frequency !== "onetime" && !inv.paused);
  const health = calcHealthScore({
    savingsRate,
    dti: totalIncome > 0 ? debtEMIs / totalIncome : 0,
    emergencyMonths: totalSpent > 0 ? liquidCash / totalSpent : 0,
    hasInvestments: hasActiveSIP,
    insAdequate: insuranceAdequacy(
      [...(p1?.insurances || []), ...(p2?.insurances || [])],
      totalIncome * 12,
    ).adequate,
  });
  const tips = buildReviewTips({
    spikes: spendingSpikes,
    pillars: health.pillars,
    investments: allInvestments,
    subscriptionTotal,
  });

  const pastReviews = useMemo(
    () =>
      [...(shared?.monthlyReviews || [])].sort((a, b) =>
        (b.month || "").localeCompare(a.month || ""),
      ),
    [shared?.monthlyReviews],
  );

  const closeModal = () => {
    setStep(1);
    setReflection({ win: "", improve: "", nextAction: "" });
    onClose();
  };

  const saveReview = () => {
    onSaveReview?.({
      id: `money-date-${month}`,
      month,
      completedAt: new Date().toISOString(),
      summary: {
        totalIncome,
        totalSpent,
        totalInvested,
        savingsRate,
        combinedNetWorth,
      },
      topSpending: spendingSpikes,
      goals: (shared?.goals || []).map((goal) => ({
        id: goal.id,
        name: goal.name,
        target: goal.target || 0,
        current: goal.current || 0,
      })),
      settlement: {
        isSettled: settlement.isSettled,
        netBalance: settlement.netBalance || 0,
        debtor: settlement.debtor || null,
        creditor: settlement.creditor || null,
      },
      healthScore: { score: health.score, label: health.label },
      tips,
      reflection,
    });
    closeModal();
  };

  // Trigger confetti on step 5
  useEffect(() => {
    if (step === 5 && confettiCanvasRef.current) {
      fireConfetti(confettiCanvasRef.current);
    }
  }, [step]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 600,
          background: "var(--bg-card, #13131a)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <canvas
          ref={confettiCanvasRef}
          width={600}
          height={500}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              "linear-gradient(90deg, rgba(234,179,8,0.1), transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--gold-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gold)",
              }}
            >
              <Heart size={16} fill="var(--gold)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Monthly Money Date
              </h3>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Step {step} of 5 · {personNames.p1} & {personNames.p2}
              </span>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={closeModal}
            aria-label="Close monthly review"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Content */}
        <div
          style={{
            padding: "24px 24px 20px",
            maxHeight: "62vh",
            overflowY: "auto",
          }}
        >
          {/* Step 1: The Big Picture */}
          {step === 1 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🥂</div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  The Big Picture
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  Here is how the household performed financially this month.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  className="metric-card"
                  style={{ textAlign: "center", padding: 14 }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Combined Income
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--green)",
                      marginTop: 4,
                    }}
                  >
                    {fmt(totalIncome)}
                  </div>
                  <DeltaBadge
                    delta={hasPrevData ? totalIncome - prevIncome : null}
                  />
                </div>

                <div
                  className="metric-card"
                  style={{ textAlign: "center", padding: 14 }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Total Household Spend
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--red)",
                      marginTop: 4,
                    }}
                  >
                    {fmt(totalSpent)}
                  </div>
                  <DeltaBadge
                    delta={hasPrevData ? totalSpent - prevSpent : null}
                    goodWhenUp={false}
                  />
                </div>

                <div
                  className="metric-card"
                  style={{ textAlign: "center", padding: 14 }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Invested into Wealth
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--p1)",
                      marginTop: 4,
                    }}
                  >
                    {fmt(totalInvested)}
                  </div>
                  <DeltaBadge
                    delta={hasPrevData ? totalInvested - prevInvested : null}
                  />
                </div>

                <div
                  className="metric-card"
                  style={{ textAlign: "center", padding: 14 }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Monthly Savings Rate
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        savingsRate >= 30 ? "var(--green)" : "var(--yellow)",
                      marginTop: 4,
                    }}
                  >
                    {savingsRate}%
                  </div>
                  <DeltaBadge
                    delta={hasPrevData ? savingsRate - prevSavingsRate : null}
                    format={(v) => `${v}%`}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                Combined Net Worth:{" "}
                <strong style={{ color: "var(--gold)" }}>
                  {fmt(combinedNetWorth)}
                </strong>
                <DeltaBadge delta={netWorthDelta} />
              </div>

              {pastReviews.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}
                  >
                    Past Monthly Reviews
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {pastReviews.slice(0, 3).map((review) => (
                      <div
                        key={review.id || review.month}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <strong>{review.month}</strong>
                          {review.reflection?.win && (
                            <div
                              style={{
                                color: "var(--text-muted)",
                                marginTop: 3,
                              }}
                            >
                              Win: {review.reflection.win}
                            </div>
                          )}
                        </div>
                        <div
                          style={{ textAlign: "right", whiteSpace: "nowrap" }}
                        >
                          <strong style={{ color: "var(--green)" }}>
                            {review.summary?.savingsRate ?? 0}% saved
                            {review.healthScore
                              ? ` · ${review.healthScore.score}/100`
                              : ""}
                          </strong>
                          <div
                            style={{ color: "var(--text-muted)", marginTop: 3 }}
                          >
                            Net worth{" "}
                            {fmt(review.summary?.combinedNetWorth || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Spending Spikes */}
          {step === 2 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🔍</div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Where Did Our Money Go?
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  A look at our top spending categories this month. No judgment,
                  just awareness!
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {spendingSpikes.map((spike, idx) => (
                  <div
                    key={spike.category}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--gold)",
                          width: 18,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {spike.category}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--red)",
                      }}
                    >
                      {fmt(spike.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {subscriptionLeaks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}
                  >
                    Fixable Leaks — subscriptions cost {fmt(subscriptionTotal)}
                    /month
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {subscriptionLeaks.slice(0, 4).map((sub) => (
                      <div
                        key={sub.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      >
                        <span>{sub.name}</span>
                        <span
                          style={{ color: "var(--yellow)", fontWeight: 600 }}
                        >
                          {fmt(sub.monthly)}/mo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                "Awareness is the first step toward financial freedom."
              </div>
            </div>
          )}

          {/* Step 3: Household Health Score */}
          {step === 3 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🛡️</div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Household Health Score
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  One number for how safe and disciplined your money life is.
                </p>
              </div>

              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 800,
                    color:
                      health.score >= 65
                        ? "var(--green)"
                        : health.score >= 45
                          ? "var(--yellow)"
                          : "var(--red)",
                  }}
                >
                  {health.score}
                </span>
                <span style={{ fontSize: 15, color: "var(--text-muted)" }}>
                  /100
                </span>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {health.label}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {health.pillars.map((pillar) => (
                  <div
                    key={pillar.key}
                    style={{
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {pillar.emoji} {pillar.label}
                      </span>
                      <span
                        style={{
                          color:
                            pillar.pts >= pillar.maxPts
                              ? "var(--green)"
                              : "var(--gold)",
                        }}
                      >
                        {pillar.pts}/{pillar.maxPts}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 3,
                      }}
                    >
                      {pillar.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Shared Goals Pulse */}
          {step === 4 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🎯</div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Shared Dreams & Goals
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  Celebrating progress towards the milestones you are building
                  together.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {(
                  shared?.goals || [
                    {
                      id: "g1",
                      name: "Emergency Fund 6M",
                      target: 300000,
                      current: 240000,
                    },
                    {
                      id: "g2",
                      name: "Annual Vacation",
                      target: 150000,
                      current: 95000,
                    },
                  ]
                ).map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round(
                      ((goal.current || 0) / (goal.target || 1)) * 100,
                    ),
                  );
                  return (
                    <div
                      key={goal.id}
                      style={{
                        padding: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {goal.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--gold)",
                            fontWeight: 700,
                          }}
                        >
                          {pct}% ({fmt(goal.current || 0)} /{" "}
                          {fmt(goal.target || 0)})
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "rgba(255,255,255,0.08)",
                          borderRadius: 3,
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, var(--gold), var(--green))",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4 (continued): Couple Balance */}
          {step === 4 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🤝</div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Shared Balance & Settlement
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  Keep things transparent and zero-stress between both of you.
                </p>
              </div>

              <div
                style={{
                  padding: 16,
                  background: settlement.isSettled
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(234,179,8,0.08)",
                  border: settlement.isSettled
                    ? "1px solid rgba(34,197,94,0.25)"
                    : "1px solid rgba(234,179,8,0.25)",
                  borderRadius: 12,
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                {settlement.isSettled ? (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "var(--green)",
                        fontSize: 15,
                      }}
                    >
                      You are all settled up for this month!
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Current Outstanding
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "var(--gold)",
                        margin: "6px 0",
                      }}
                    >
                      {fmt(settlement.netBalance)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: "var(--p2)" }}>
                        {settlement.debtor === "p2"
                          ? personNames.p2
                          : personNames.p1}
                      </span>{" "}
                      owes{" "}
                      <span style={{ color: "var(--p1)" }}>
                        {settlement.creditor === "p1"
                          ? personNames.p1
                          : personNames.p2}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: High-Five & Celebration */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>🥳</div>
              <h4
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  margin: 0,
                  color: "var(--gold)",
                }}
              >
                Money Date Complete!
              </h4>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  margin: "8px auto 20px",
                  maxWidth: 400,
                  lineHeight: 1.5,
                }}
              >
                High five! You took 5 intentional minutes to stay aligned on
                your wealth, dreams, and life together.
              </p>

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  textAlign: "left",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Zap size={14} color="var(--gold)" />
                  How we can improve next month:
                </div>
                {tips.length > 0 ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    {tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    All five health pillars look strong — keep doing what you're
                    doing!
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 10, textAlign: "left" }}>
                {[
                  [
                    "win",
                    "What went well?",
                    "A habit, decision, or milestone to celebrate",
                  ],
                  [
                    "improve",
                    "What should improve?",
                    "One pattern to change next month",
                  ],
                  [
                    "nextAction",
                    "Our next action",
                    "One specific action you both agree to take",
                  ],
                ].map(([key, label, placeholder]) => (
                  <label key={key} style={{ fontSize: 12, fontWeight: 600 }}>
                    {label}
                    <textarea
                      value={reflection[key]}
                      onChange={(event) =>
                        setReflection((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      rows={2}
                      style={{
                        width: "100%",
                        marginTop: 5,
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {step > 1 ? (
            <button
              className="btn-secondary"
              onClick={() => setStep(step - 1)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              className="btn-primary"
              onClick={() => setStep(step + 1)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={saveReview}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                background: "var(--green)",
              }}
            >
              <CheckCircle2 size={14} /> Save Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
