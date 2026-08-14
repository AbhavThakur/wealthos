// ── Mutual Fund & Asset Class Auto-Categorizer & Benchmark Engine ─────────────
// Automatically infers SEBI category, cap category, and historical CAGR return benchmark
// from mutual fund scheme names, AMC details, and asset types.

/**
 * SEBI & Market Benchmark Returns (Historical 10-15 Year CAGRs for India)
 */
export const ASSET_BENCHMARK_RETURNS = {
  // Equity Mutual Funds
  large_index: { returnPct: 12.0, label: "Large Cap — Index (Nifty 50 / Sensex)", cagrNote: "10-15Y Nifty 50 CAGR ~12%" },
  large_active: { returnPct: 12.5, label: "Large Cap — Active", cagrNote: "10Y Large Cap Active avg ~12.5%" },
  mid_index: { returnPct: 13.5, label: "Mid Cap — Index (Nifty Midcap 150)", cagrNote: "10Y Midcap Index CAGR ~13.5%" },
  mid_active: { returnPct: 14.0, label: "Mid Cap — Active", cagrNote: "10Y Mid Cap Active avg ~14%" },
  small_index: { returnPct: 14.5, label: "Small Cap — Index (Nifty Smallcap 250)", cagrNote: "10Y Smallcap Index CAGR ~14.5%" },
  small_active: { returnPct: 15.0, label: "Small Cap — Active", cagrNote: "10Y Small Cap Active avg ~15-16%" },
  largemid: { returnPct: 13.5, label: "Large & Mid Cap", cagrNote: "10Y Large & Mid Cap avg ~13.5%" },
  flexi: { returnPct: 13.0, label: "Flexi Cap", cagrNote: "10Y Flexi Cap avg ~13-14%" },
  multi: { returnPct: 13.5, label: "Multi Cap", cagrNote: "10Y Multi Cap avg ~13.5%" },
  elss: { returnPct: 13.0, label: "ELSS (Tax Saving)", cagrNote: "10Y ELSS avg ~13%" },
  focused: { returnPct: 13.5, label: "Focused Fund", cagrNote: "10Y Focused Fund avg ~13.5%" },
  sectoral: { returnPct: 14.0, label: "Sectoral / Thematic", cagrNote: "10Y Sectoral avg ~13-15% (Higher Volatility)" },
  international: { returnPct: 11.5, label: "International / Global / US Tech", cagrNote: "10Y S&P 500 / Global avg in INR ~11.5%" },
  hybrid_equity: { returnPct: 10.5, label: "Hybrid — Equity Oriented / Balanced Advantage", cagrNote: "10Y Balanced Advantage avg ~10.5%" },
  hybrid_debt: { returnPct: 7.5, label: "Hybrid — Debt Oriented / Conservative", cagrNote: "10Y Conservative Hybrid avg ~7.5%" },
  debt_liquid: { returnPct: 6.8, label: "Liquid / Overnight / Ultra Short Term", cagrNote: "Short term debt yields ~6.5-7%" },
  gold: { returnPct: 9.5, label: "Gold / Precious Metals ETF", cagrNote: "15Y Gold CAGR ~9.5-10% in INR" },

  // Other Asset Classes
  Stocks: { returnPct: 13.5, label: "Direct Stocks / Equities", cagrNote: "Direct Equity benchmark ~13.5%" },
  FD: { returnPct: 7.2, label: "Fixed Deposit / Term Deposit", cagrNote: "Current 1-5Y Bank FD rates ~7-7.5%" },
  PPF: { returnPct: 7.1, label: "Public Provident Fund", cagrNote: "Govt PPF statutory rate 7.1% p.a." },
  EPF: { returnPct: 8.25, label: "Employee Provident Fund", cagrNote: "EPFO statutory interest rate 8.25% p.a." },
  NPS: { returnPct: 10.0, label: "National Pension Scheme", cagrNote: "NPS Tier 1 Auto Choice 10Y avg ~10%" },
  "Real Estate": { returnPct: 8.5, label: "Real Estate Property", cagrNote: "Long term residential appreciation + yield ~8.5%" },
  Crypto: { returnPct: 18.0, label: "Cryptocurrency / Digital Assets", cagrNote: "High risk & high volatility asset class" },
  ULIP: { returnPct: 9.0, label: "Unit Linked Insurance Plan", cagrNote: "ULIP net of charges ~8.5-9.5%" },
  Other: { returnPct: 10.0, label: "Other Investment", cagrNote: "Standard blended investment benchmark" },
};

/**
 * Infer SEBI Cap Category and Expected Annual Return % from Scheme Name, Category, and Type.
 * @param {string} schemeName - e.g. "Parag Parikh Flexi Cap Fund Direct Growth"
 * @param {string} schemeCategory - e.g. "Equity Scheme - Small Cap Fund" (optional from AMFI)
 * @param {string} investmentType - e.g. "Mutual Fund", "Stocks", "FD" (optional)
 * @returns {object} { capCategory, categoryLabel, recommendedReturnPct, confidence, cagrNote, reason }
 */
export function inferMFCapCategoryAndReturn(schemeName = "", schemeCategory = "", investmentType = "Mutual Fund") {
  const normType = (investmentType || "").trim();
  const lowerName = (schemeName || "").toLowerCase();
  const lowerCat = (schemeCategory || "").toLowerCase();
  const combined = `${lowerName} ${lowerCat}`;

  // 1. Non-Mutual Fund Asset Types
  if (normType && normType !== "Mutual Fund") {
    const assetMeta = ASSET_BENCHMARK_RETURNS[normType] || ASSET_BENCHMARK_RETURNS.Other;
    return {
      capCategory: "",
      categoryLabel: assetMeta.label,
      recommendedReturnPct: assetMeta.returnPct,
      confidence: "high",
      cagrNote: assetMeta.cagrNote,
      reason: `Standard benchmark for ${normType}`,
    };
  }

  // 2. Liquid, Overnight, Arbitrage, Money Market & Debt Funds
  if (
    combined.includes("liquid") ||
    combined.includes("overnight") ||
    combined.includes("ultra short") ||
    combined.includes("money market") ||
    combined.includes("low duration") ||
    combined.includes("short term debt") ||
    combined.includes("corporate bond") ||
    combined.includes("banking & psu") ||
    combined.includes("gilt") ||
    combined.includes("arbitrage") ||
    combined.includes("debt scheme")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.debt_liquid;
    return {
      capCategory: "hybrid_debt",
      categoryLabel: "Debt / Liquid / Arbitrage",
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Fixed Income / Debt / Liquid Scheme",
    };
  }

  // 3. Gold & Silver Funds / ETFs
  if (
    combined.includes("gold") ||
    combined.includes("silver") ||
    combined.includes("precious metal") ||
    combined.includes("commodity")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.gold;
    return {
      capCategory: "hybrid_equity",
      categoryLabel: "Gold & Commodities",
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Gold / Commodity ETF or Fund",
    };
  }

  // 4. International / US Equities / Global Feeder Funds
  if (
    combined.includes("nasdaq") ||
    combined.includes("s&p 500") ||
    combined.includes("us equity") ||
    combined.includes("us tech") ||
    combined.includes("global") ||
    combined.includes("fang+") ||
    combined.includes("fang") ||
    combined.includes("overseas") ||
    combined.includes("international") ||
    combined.includes("greater china")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.international;
    return {
      capCategory: "international",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected International / Global Equity Fund",
    };
  }

  // 5. Hybrid & Balanced Advantage & Dynamic Asset Allocation
  if (
    combined.includes("balanced advantage") ||
    combined.includes("dynamic asset") ||
    combined.includes("aggressive hybrid") ||
    combined.includes("equity savings") ||
    combined.includes("multi asset") ||
    combined.includes("hybrid")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.hybrid_equity;
    return {
      capCategory: "hybrid_equity",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Hybrid / Balanced Advantage Allocation",
    };
  }

  // 6. ELSS / Tax Saver
  if (
    combined.includes("elss") ||
    combined.includes("tax saver") ||
    combined.includes("tax advantage") ||
    combined.includes("tax relief") ||
    combined.includes("long term equity")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.elss;
    return {
      capCategory: "elss",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Section 80C ELSS Tax Saver Scheme",
    };
  }

  // 7. Small Cap Funds (Active & Index)
  if (combined.includes("smallcap") || combined.includes("small cap") || combined.includes("microcap")) {
    const isIndex = combined.includes("index") || combined.includes("etf");
    const key = isIndex ? "small_index" : "small_active";
    const meta = ASSET_BENCHMARK_RETURNS[key];
    return {
      capCategory: key,
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: `Detected Small Cap ${isIndex ? "Index" : "Active"} Scheme`,
    };
  }

  // 8. Mid Cap Funds (Active & Index)
  if (
    combined.includes("midcap") ||
    combined.includes("mid cap") ||
    combined.includes("mid-cap") ||
    combined.includes("emerging businesses") ||
    combined.includes("discovery")
  ) {
    const isIndex = combined.includes("index") || combined.includes("etf");
    const key = isIndex ? "mid_index" : "mid_active";
    const meta = ASSET_BENCHMARK_RETURNS[key];
    return {
      capCategory: key,
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: `Detected Mid Cap ${isIndex ? "Index" : "Active"} Scheme`,
    };
  }

  // 9. Large & Mid Cap
  if (
    combined.includes("large & mid") ||
    combined.includes("large and mid") ||
    combined.includes("growth opportunities")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.largemid;
    return {
      capCategory: "largemid",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Large & Mid Cap Blend",
    };
  }

  // 10. Large Cap / Nifty 50 / Sensex / Bluechip
  if (
    combined.includes("nifty 50") ||
    combined.includes("sensex") ||
    combined.includes("nifty next 50") ||
    combined.includes("largecap") ||
    combined.includes("large cap") ||
    combined.includes("bluechip") ||
    combined.includes("top 100") ||
    combined.includes("frontline") ||
    combined.includes("bse 100")
  ) {
    const isIndex = combined.includes("index") || combined.includes("etf") || combined.includes("nifty") || combined.includes("sensex");
    const key = isIndex ? "large_index" : "large_active";
    const meta = ASSET_BENCHMARK_RETURNS[key];
    return {
      capCategory: key,
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: `Detected Large Cap / Bluechip ${isIndex ? "Index" : "Active"} Scheme`,
    };
  }

  // 11. Flexi Cap
  if (combined.includes("flexicap") || combined.includes("flexi cap") || combined.includes("flexi")) {
    const meta = ASSET_BENCHMARK_RETURNS.flexi;
    return {
      capCategory: "flexi",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Flexi Cap Scheme",
    };
  }

  // 12. Multi Cap
  if (combined.includes("multicap") || combined.includes("multi cap")) {
    const meta = ASSET_BENCHMARK_RETURNS.multi;
    return {
      capCategory: "multi",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Multi Cap Scheme (25:25:25 mandated split)",
    };
  }

  // 13. Focused Fund
  if (combined.includes("focused") || combined.includes("focus 25") || combined.includes("focus 30")) {
    const meta = ASSET_BENCHMARK_RETURNS.focused;
    return {
      capCategory: "focused",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Focused Equity Scheme (max 30 stocks)",
    };
  }

  // 14. Sectoral / Thematic
  if (
    combined.includes("tech") ||
    combined.includes("digital") ||
    combined.includes("pharma") ||
    combined.includes("healthcare") ||
    combined.includes("banking") ||
    combined.includes("financial") ||
    combined.includes("infra") ||
    combined.includes("manufacturing") ||
    combined.includes("consumption") ||
    combined.includes("energy") ||
    combined.includes("auto") ||
    combined.includes("thematic") ||
    combined.includes("sectoral")
  ) {
    const meta = ASSET_BENCHMARK_RETURNS.sectoral;
    return {
      capCategory: "sectoral",
      categoryLabel: meta.label,
      recommendedReturnPct: meta.returnPct,
      confidence: "high",
      cagrNote: meta.cagrNote,
      reason: "Detected Sectoral / Thematic Fund",
    };
  }

  // 15. Default Fallback for unspecified mutual fund
  const meta = ASSET_BENCHMARK_RETURNS.flexi;
  return {
    capCategory: "flexi",
    categoryLabel: "Flexi / Diversified Equity",
    recommendedReturnPct: meta.returnPct,
    confidence: "fallback",
    cagrNote: meta.cagrNote,
    reason: "Standard diversified Indian equity benchmark",
  };
}

/**
 * Return qualitative rating and commentary on an investment's expected return.
 * @param {number} returnPct - e.g. 15
 * @param {string} capCategory - e.g. "large_index", "small_active"
 * @param {string} type - e.g. "Mutual Fund", "FD"
 * @returns {object} { status: "realistic"|"conservative"|"aggressive"|"unspecified", badgeText, color, hint }
 */
export function getReturnGuidance(returnPct = 12, capCategory = "", type = "Mutual Fund") {
  const num = Number(returnPct) || 0;
  const inferred = inferMFCapCategoryAndReturn("", capCategory, type);
  const benchmark = inferred.recommendedReturnPct;

  if (num === 0) {
    return {
      status: "unspecified",
      badgeText: "Expected Return Not Set",
      color: "var(--text-muted, #9896a0)",
      hint: `Recommended benchmark: ${benchmark}% p.a. (${inferred.categoryLabel})`,
    };
  }

  const diff = num - benchmark;

  if (Math.abs(diff) <= 1.5) {
    return {
      status: "realistic",
      badgeText: "🎯 In Line with Historical Market Benchmark",
      color: "var(--green, #10b981)",
      hint: `${inferred.categoryLabel} benchmark is ~${benchmark}% p.a. ${inferred.cagrNote}`,
    };
  }

  if (diff < -1.5) {
    return {
      status: "conservative",
      badgeText: "🛡️ Conservative Return Assumption",
      color: "var(--blue, #3b82f6)",
      hint: `Lower than historical average of ${benchmark}% p.a. Provides a safe margin of safety.`,
    };
  }

  return {
    status: "aggressive",
    badgeText: "🚀 High Growth Expectation",
    color: "var(--gold, #c9a84c)",
    hint: `Higher than category 10Y average (${benchmark}% p.a.). Ensure this aligns with risk tolerance.`,
  };
}

/**
 * Visual Color Themes & Icons for each Investment Type
 */
export const ASSET_TYPE_THEMES = {
  "Mutual Fund": {
    color: "#3b82f6",
    border: "#3b82f6",
    bgTint: "rgba(59, 130, 246, 0.05)",
    badgeBg: "rgba(59, 130, 246, 0.15)",
    badgeColor: "#60a5fa",
    label: "Mutual Fund",
    icon: "📈",
    risk: "medium",
    beginnerTip: "A pool of money from many investors, managed by professionals. Great way to start investing with as little as ₹500/month.",
  },
  Stocks: {
    color: "#8b5cf6",
    border: "#8b5cf6",
    bgTint: "rgba(139, 92, 246, 0.05)",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    badgeColor: "#a78bfa",
    label: "Direct Equity",
    icon: "📊",
    risk: "high",
    beginnerTip: "Buying shares of individual companies. Higher potential returns but requires research and carries more risk.",
  },
  FD: {
    color: "#f59e0b",
    border: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.06)",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeColor: "#fbbf24",
    label: "Fixed Deposit",
    icon: "🏦",
    risk: "low",
    beginnerTip: "You deposit money in a bank for a fixed period and earn guaranteed interest. Safest option, but returns may not beat inflation.",
  },
  PPF: {
    color: "#10b981",
    border: "#10b981",
    bgTint: "rgba(16, 185, 129, 0.05)",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeColor: "#34d399",
    label: "Public Provident Fund",
    icon: "🛡️",
    risk: "low",
    beginnerTip: "Government-backed savings scheme with tax benefits under Section 80C. 15-year lock-in but very safe.",
  },
  Gold: {
    color: "#eab308",
    border: "#eab308",
    bgTint: "rgba(234, 179, 8, 0.06)",
    badgeBg: "rgba(234, 179, 8, 0.18)",
    badgeColor: "#fde047",
    label: "Gold / Silver",
    icon: "🪙",
    risk: "medium",
    beginnerTip: "Physical or digital gold as an inflation hedge. Doesn't generate income but tends to hold value during market downturns.",
  },
  NPS: {
    color: "#06b6d4",
    border: "#06b6d4",
    bgTint: "rgba(6, 182, 212, 0.05)",
    badgeBg: "rgba(6, 182, 212, 0.15)",
    badgeColor: "#22d3ee",
    label: "National Pension Scheme",
    icon: "👴",
    risk: "medium",
    beginnerTip: "Government pension scheme with extra tax benefit (₹50K under 80CCD). Locked until age 60 but builds a retirement corpus.",
  },
  EPF: {
    color: "#14b8a6",
    border: "#14b8a6",
    bgTint: "rgba(20, 184, 166, 0.05)",
    badgeBg: "rgba(20, 184, 166, 0.15)",
    badgeColor: "#2dd4bf",
    label: "Employee Provident Fund",
    icon: "💼",
    risk: "low",
    beginnerTip: "Your employer deducts 12% of basic salary and matches it. Very safe, tax-free, and earns ~8.25% interest.",
  },
  ULIP: {
    color: "#ec4899",
    border: "#ec4899",
    bgTint: "rgba(236, 72, 153, 0.05)",
    badgeBg: "rgba(236, 72, 153, 0.15)",
    badgeColor: "#f472b6",
    label: "ULIP Insurance",
    icon: "☂️",
    risk: "medium",
    beginnerTip: "Combines insurance + investment. Has higher charges in early years. Generally, separate term insurance + mutual funds is better.",
  },
  Other: {
    color: "#94a3b8",
    border: "#94a3b8",
    bgTint: "rgba(148, 163, 184, 0.05)",
    badgeBg: "rgba(148, 163, 184, 0.15)",
    badgeColor: "#cbd5e1",
    label: "Other Investment",
    icon: "📦",
    risk: "medium",
    beginnerTip: "Any other investment not listed above.",
  },
};

/**
 * Beginner-friendly glossary of investment terms.
 * Key = term shown in UI, value = plain-English explanation.
 */
export const INVESTMENT_GLOSSARY = {
  SIP: "Systematic Investment Plan — investing a fixed amount every month (like ₹5,000) automatically. It's the easiest way to build wealth over time.",
  CAGR: "Compound Annual Growth Rate — the average yearly return of an investment over multiple years. A 12% CAGR means your money roughly doubles every 6 years.",
  Corpus: "The total value of your investment today, including all gains and contributions. Think of it as 'how much is my investment worth right now?'",
  "Expected Return": "The annual percentage your investment is expected to grow. Higher returns usually come with higher risk.",
  "Cap Category": "SEBI classifies mutual funds by the size of companies they invest in — Large Cap (big stable companies), Mid Cap (medium growing companies), Small Cap (small high-growth companies).",
  NAV: "Net Asset Value — the current price of one unit of a mutual fund. When NAV goes up, your investment value goes up.",
  ISIN: "A 12-character code (like INF109K01Z48) that uniquely identifies a mutual fund or stock. You can find it on your broker app.",
  "Maturity Date": "The date when your FD or PPF investment period ends and you can withdraw your money.",
  "Deduction Date": "The day of the month when your SIP amount is automatically deducted from your bank account.",
  "Tax Saving (80C)": "Section 80C of Income Tax Act lets you save up to ₹1.5 lakh/year in tax by investing in ELSS, PPF, EPF, etc.",
  Folio: "An account number assigned by the mutual fund company to track your holdings. One folio can have multiple schemes.",
  "Step-Up SIP": "Increasing your SIP amount every year (e.g., by 10%). This dramatically improves long-term wealth building as your income grows.",
};

/**
 * Returns a risk badge with color, label, and icon for a given investment type.
 */
export function getRiskBadge(investmentType) {
  const theme = ASSET_TYPE_THEMES[investmentType] || ASSET_TYPE_THEMES.Other;
  const risk = theme.risk || "medium";

  const RISK_META = {
    low: {
      label: "🛡️ Low Risk",
      color: "var(--green, #10b981)",
      bg: "rgba(16, 185, 129, 0.12)",
      border: "1px solid rgba(16, 185, 129, 0.3)",
      description: "Capital is generally safe. Returns may be lower but predictable.",
    },
    medium: {
      label: "⚖️ Moderate Risk",
      color: "var(--blue, #3b82f6)",
      bg: "rgba(59, 130, 246, 0.12)",
      border: "1px solid rgba(59, 130, 246, 0.3)",
      description: "Balance of growth and safety. Value can fluctuate in the short term.",
    },
    high: {
      label: "🔥 High Risk",
      color: "var(--gold, #f59e0b)",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "1px solid rgba(245, 158, 11, 0.3)",
      description: "Potential for high returns but significant short-term volatility. Invest only what you can afford to hold for 5+ years.",
    },
  };

  return RISK_META[risk] || RISK_META.medium;
}

/**
 * Calculate days remaining until maturity.
 */
export function getMaturityDays(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * Generate formatted maturity badge with urgency colors.
 */
export function getMaturityBadge(dateStr, labelPrefix = "Matures") {
  const days = getMaturityDays(dateStr);
  if (days === null) return null;

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      status: "matured",
      badgeText: `⚠️ Matured ${overdue}d ago — Action needed`,
      color: "var(--red, #ef4444)",
      bg: "rgba(239, 68, 68, 0.15)",
      border: "1px solid rgba(239, 68, 68, 0.35)",
      days,
    };
  }

  if (days <= 30) {
    return {
      status: "soon_30",
      badgeText: `⚡ ${labelPrefix} in ${days} days (${dateStr})`,
      color: "var(--gold, #f59e0b)",
      bg: "rgba(245, 158, 11, 0.18)",
      border: "1px solid rgba(245, 158, 11, 0.4)",
      days,
    };
  }

  if (days <= 90) {
    return {
      status: "soon_90",
      badgeText: `⚡ ${labelPrefix} in ${Math.round(days / 30)} months (${dateStr})`,
      color: "var(--gold, #f59e0b)",
      bg: "rgba(245, 158, 11, 0.15)",
      border: "1px solid rgba(245, 158, 11, 0.3)",
      days,
    };
  }

  if (days <= 365) {
    return {
      status: "mid_365",
      badgeText: `⏳ ${labelPrefix} in ${Math.round(days / 30)} months (${dateStr})`,
      color: "var(--blue, #3b82f6)",
      bg: "rgba(59, 130, 246, 0.12)",
      border: "1px solid rgba(59, 130, 246, 0.25)",
      days,
    };
  }

  const yrs = (days / 365.25).toFixed(1);
  return {
    status: "long",
    badgeText: `🗓️ ${labelPrefix} ${dateStr} (${yrs} yrs)`,
    color: "var(--text-secondary, #94a3b8)",
    bg: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    days,
  };
}
