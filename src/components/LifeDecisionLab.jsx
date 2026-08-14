import { useState, useMemo } from "react";
import {
  calculateHomePurchaseImpact,
  calculateSabbaticalImpact,
  projectFIRETimeline,
} from "../utils/decisionSimulator";
import { fmt, fmtCr } from "../utils/finance";
import {
  Home,
  Palmtree,
  Baby,
  Flame,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
} from "lucide-react";

export default function LifeDecisionLab({
  p1,
  p2,
}) {
  const [activeScenario, setActiveScenario] = useState("home"); // "home" | "sabbatical" | "baby" | "fire"

  // Derive household baseline numbers
  const p1Income = (p1?.incomes || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const p2Income = (p2?.incomes || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalIncome = p1Income + p2Income || 250000;

  const p1Expenses = (p1?.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const p2Expenses = (p2?.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExpenses = p1Expenses + p2Expenses || 80000;

  const p1Liquid = (p1?.investments || []).reduce((s, i) => s + (Number(i.existingCorpus) || 0), 0);
  const p2Liquid = (p2?.investments || []).reduce((s, i) => s + (Number(i.existingCorpus) || 0), 0);
  const totalLiquid = p1Liquid + p2Liquid || 2500000;

  // ── Home Scenario State ──
  const [homePrice, setHomePrice] = useState(12000000); // ₹1.2 Cr
  const [downPayPct, setDownPayPct] = useState(20);
  const [loanTenure, setLoanTenure] = useState(20);
  const [interestRate, setInterestRate] = useState(8.5);

  // ── Sabbatical Scenario State ──
  const [sabbaticalMonths, setSabbaticalMonths] = useState(6);
  const [passiveIncome, setPassiveIncome] = useState(0);

  // ── Baby Scenario State ──
  const [babyUpfront, setBabyUpfront] = useState(150000);
  const [babyMonthly, setBabyMonthly] = useState(25000);

  // ── FIRE Scenario State ──
  const [expectedReturn, setExpectedReturn] = useState(11);
  const [inflationRate, setInflationRate] = useState(6);
  const [swr, setSwr] = useState(3.5);

  // Calculations
  const homeImpact = useMemo(() => {
    return calculateHomePurchaseImpact({
      propertyValue: homePrice,
      downPaymentPct: downPayPct,
      interestRate,
      tenureYears: loanTenure,
      currentLiquidCorpus: totalLiquid,
      monthlyIncome: totalIncome,
      monthlyExpenses: totalExpenses,
    });
  }, [homePrice, downPayPct, interestRate, loanTenure, totalLiquid, totalIncome, totalExpenses]);

  const sabbaticalImpact = useMemo(() => {
    return calculateSabbaticalImpact({
      months: sabbaticalMonths,
      monthlyExpenses: totalExpenses,
      currentLiquidCorpus: totalLiquid,
      monthlyPassiveIncome: passiveIncome,
    });
  }, [sabbaticalMonths, totalExpenses, totalLiquid, passiveIncome]);

  const fireProjection = useMemo(() => {
    const annualSavings = Math.max(0, (totalIncome - totalExpenses) * 12);
    return projectFIRETimeline({
      currentNetWorth: totalLiquid,
      annualExpenses: totalExpenses * 12,
      annualSavings,
      expectedReturnPct: expectedReturn,
      inflationPct: inflationRate,
      swrPct: swr,
    });
  }, [totalLiquid, totalIncome, totalExpenses, expectedReturn, inflationRate, swr]);

  return (
    <div className="card" style={{ padding: 24, marginTop: 16, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔮</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Life Decision Simulator ("Can We Afford This?")
            </h3>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Stress-test major financial choices against household cash flow and liquid runway
          </p>
        </div>
      </div>

      {/* Scenario Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveScenario("home")}
          className={`dash-tab ${activeScenario === "home" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <Home size={15} /> Buy a Home
        </button>
        <button
          onClick={() => setActiveScenario("sabbatical")}
          className={`dash-tab ${activeScenario === "sabbatical" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <Palmtree size={15} /> Career Sabbatical / Study
        </button>
        <button
          onClick={() => setActiveScenario("baby")}
          className={`dash-tab ${activeScenario === "baby" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <Baby size={15} /> New Baby
        </button>
        <button
          onClick={() => setActiveScenario("fire")}
          className={`dash-tab ${activeScenario === "fire" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <Flame size={15} /> FIRE & Early Retirement
        </button>
      </div>

      {/* ── SCENARIO 1: HOME PURCHASE ── */}
      {activeScenario === "home" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {/* Controls */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Home Parameters</h4>
            
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>Property Value</span>
                <span style={{ fontWeight: 700, color: "var(--gold)" }}>{fmtCr(homePrice)} ({fmt(homePrice)})</span>
              </div>
              <input
                type="range"
                min={3000000}
                max={40000000}
                step={500000}
                value={homePrice}
                onChange={(e) => setHomePrice(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--gold)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Down Payment %
                </label>
                <input
                  type="number"
                  value={downPayPct}
                  onChange={(e) => setDownPayPct(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Loan Tenure (Years)
                </label>
                <input
                  type="number"
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
              />
            </div>
          </div>

          {/* Results & Verdict */}
          <div>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 16,
                background:
                  homeImpact.verdict === "safe"
                    ? "rgba(34, 197, 94, 0.12)"
                    : homeImpact.verdict === "warning"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${
                  homeImpact.verdict === "safe"
                    ? "rgba(34, 197, 94, 0.3)"
                    : homeImpact.verdict === "warning"
                    ? "rgba(245, 158, 11, 0.3)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {homeImpact.verdict === "safe" ? (
                <CheckCircle2 size={24} color="var(--green)" />
              ) : homeImpact.verdict === "warning" ? (
                <AlertTriangle size={24} color="var(--yellow)" />
              ) : (
                <AlertOctagon size={24} color="var(--red)" />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {homeImpact.verdict === "safe"
                    ? "✅ Safely Affordable"
                    : homeImpact.verdict === "warning"
                    ? "⚠️ Tight Cash Flow Buffer"
                    : "❌ High Default Risk"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {homeImpact.verdictMessage}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Monthly EMI</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--p1)" }}>{fmt(homeImpact.emi)}/mo</div>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{homeImpact.emiToIncomeRatio}% of income</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Upfront Cash Needed</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>{fmt(homeImpact.upfrontCost)}</div>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Down Pay + Stamp Duty</span>
              </div>
            </div>

            {homeImpact.riskFactors.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--yellow)", background: "rgba(245, 158, 11, 0.08)", padding: 10, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Notice:</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {homeImpact.riskFactors.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCENARIO 2: CAREER SABBATICAL ── */}
      {activeScenario === "sabbatical" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Sabbatical Duration & Expenses</h4>
            
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>Break Duration</span>
                <span style={{ fontWeight: 700, color: "var(--p1)" }}>{sabbaticalMonths} Months</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                value={sabbaticalMonths}
                onChange={(e) => setSabbaticalMonths(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--p1)" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                Monthly Passive Income / Freelance (₹)
              </label>
              <input
                type="number"
                value={passiveIncome}
                onChange={(e) => setPassiveIncome(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 16,
                background:
                  sabbaticalImpact.verdict === "safe"
                    ? "rgba(34, 197, 94, 0.12)"
                    : sabbaticalImpact.verdict === "warning"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${
                  sabbaticalImpact.verdict === "safe"
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(245, 158, 11, 0.3)"
                }`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: sabbaticalImpact.verdict === "safe" ? "var(--green)" : "var(--yellow)" }}>
                {sabbaticalImpact.verdict === "safe" ? "✅ Sabbatical is Well-Funded" : "⚠️ Limited Runway"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {sabbaticalImpact.verdictMessage}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Break Cost</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--red)" }}>{fmt(sabbaticalImpact.totalCost)}</div>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Includes 15% contingency</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Remaining Cushion</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{fmt(sabbaticalImpact.remainingCorpus)}</div>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Post-sabbatical savings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCENARIO 3: NEW BABY ── */}
      {activeScenario === "baby" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Baby Expenses</h4>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                Upfront Hospital & Setup (₹)
              </label>
              <input
                type="number"
                value={babyUpfront}
                onChange={(e) => setBabyUpfront(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                Recurring Monthly Increase (Diapers, Care, Medical) (₹)
              </label>
              <input
                type="number"
                value={babyMonthly}
                onChange={(e) => setBabyMonthly(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
              />
            </div>
          </div>

          <div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>First Year Financial Impact</h4>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>Total 1st Year Cost:</span>
                <span style={{ fontWeight: 700, color: "var(--gold)" }}>{fmt(babyUpfront + babyMonthly * 12)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>Revised Monthly Surplus:</span>
                <span style={{ fontWeight: 700, color: "var(--green)" }}>{fmt(totalIncome - totalExpenses - babyMonthly)}/mo</span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                💡 Tip: Start a dedicated 529 / Mutual Fund Child Education Goal with ₹10,000/mo SIP early to harness 18 years of compound growth.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SCENARIO 4: FIRE & EARLY RETIREMENT ── */}
      {activeScenario === "fire" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>FIRE Assumptions</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Expected Return (%)
                </label>
                <input
                  type="number"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Inflation Rate (%)
                </label>
                <input
                  type="number"
                  value={inflationRate}
                  onChange={(e) => setInflationRate(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  SWR Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={swr}
                  onChange={(e) => setSwr(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Target FIRE Corpus</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{fmtCr(fireProjection.targetCorpus)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Years to Financial Independence</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>{fireProjection.yearsToFIRE} Years</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Safe Monthly Withdrawal (3.5% SWR)</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--p1)" }}>{fmt(fireProjection.safeMonthlyWithdrawal)}/mo</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
