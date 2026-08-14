import { describe, it, expect } from "vitest";
import { calcHealthScore, buildReviewTips } from "./monthlyReview";

describe("calcHealthScore", () => {
  it("gives a perfect score when all pillars are strong", () => {
    const r = calcHealthScore({
      savingsRate: 30,
      dti: 0.1,
      emergencyMonths: 8,
      hasInvestments: true,
      insAdequate: true,
    });
    expect(r.score).toBe(100);
    expect(r.label).toBe("Excellent");
  });

  it("scores weak households low and exposes per-pillar points", () => {
    const r = calcHealthScore({
      savingsRate: 5,
      dti: 0.55,
      emergencyMonths: 0,
      hasInvestments: false,
      insAdequate: false,
    });
    expect(r.score).toBe(5);
    expect(r.label).toBe("At Risk");
    expect(r.pillars).toHaveLength(5);
    expect(r.pillars.find((p) => p.key === "debt").pts).toBe(0);
  });
});

describe("buildReviewTips", () => {
  it("suggests a soft cap on the top spending category", () => {
    const tips = buildReviewTips({
      spikes: [{ category: "Dining", amount: 14000 }],
    });
    expect(tips[0]).toContain("Dining");
    expect(tips[0]).toContain("₹11,000");
  });

  it("flags deposits maturing within 45 days", () => {
    const tips = buildReviewTips({
      investments: [{ name: "HDFC FD", endDate: "2026-08-24" }],
      now: new Date(2026, 7, 14),
    });
    expect(
      tips.some((t) => t.includes("HDFC FD") && t.includes("matures")),
    ).toBe(true);
  });

  it("targets the weakest health pillar and caps output at 3 tips", () => {
    const { pillars } = calcHealthScore({
      savingsRate: 25,
      dti: 0.1,
      emergencyMonths: 0,
      hasInvestments: true,
      insAdequate: true,
    });
    const tips = buildReviewTips({
      spikes: [{ category: "Shopping", amount: 9000 }],
      pillars,
      investments: [{ name: "FD", endDate: "2026-08-20" }],
      subscriptionTotal: 2000,
      now: new Date(2026, 7, 14),
    });
    expect(tips).toHaveLength(3);
    expect(tips.some((t) => t.includes("Emergency Fund"))).toBe(true);
  });

  it("returns no tips when everything is healthy", () => {
    const { pillars } = calcHealthScore({
      savingsRate: 30,
      dti: 0,
      emergencyMonths: 12,
      hasInvestments: true,
      insAdequate: true,
    });
    expect(buildReviewTips({ pillars })).toHaveLength(0);
  });
});
