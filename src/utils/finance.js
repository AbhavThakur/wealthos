export const fmt = (n = 0) =>
  "₹" + Math.abs(Math.round(Number(n) || 0)).toLocaleString("en-IN");

export const fmtCr = (n = 0) => {
  const a = Math.abs(Number(n) || 0);
  if (a >= 10000000) return "₹" + (a / 10000000).toFixed(2) + " Cr";
  if (a >= 100000) return "₹" + (a / 100000).toFixed(1) + " L";
  return fmt(n);
};

export const nextId = (arr) => Math.max(0, ...arr.map((x) => x.id ?? 0)) + 1;

/** For one-time expenses the effective amount is the sum of log entries only. */
export const onetimeEffective = (exp) => {
  if (exp.expenseType !== "onetime") return exp.amount || 0;
  return (exp.entries || []).reduce((s, e) => s + (e.amount || 0), 0);
};

export const sipCorpus = (monthly, rateAnnual, years) => {
  const r = rateAnnual / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
};

export const lumpCorpus = (principal, rateAnnual, years) =>
  principal * Math.pow(1 + rateAnnual / 100, years);

export const totalCorpus = (existingCorpus, monthly, rateAnnual, years) =>
  lumpCorpus(existingCorpus, rateAnnual, years) +
  sipCorpus(monthly, rateAnnual, years);

// PPF: annual compounding with yearly deposits made at the start of each year.
// This matches the Groww / NSDL PPF calculator formula.
export const ppfCorpus = (existingCorpus, yearlyContrib, rateAnnual, years) => {
  const r = rateAnnual / 100;
  const sip =
    yearlyContrib > 0 && r > 0
      ? yearlyContrib * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
      : yearlyContrib * years;
  return lumpCorpus(existingCorpus, rateAnnual, years) + sip;
};

// FD: quarterly compounding (Indian bank standard: A = P × (1 + r/4)^(4n)).
// Use days/365 for tenure to match bank calculations exactly.
export const fdCorpus = (principal, rateAnnual, years) =>
  principal * Math.pow(1 + rateAnnual / 100 / 4, 4 * years);

// Count how many times a given weekday ("Monday"…"Sunday") occurs in a month.
// year/month default to the current month if omitted.
export const weekdayCountInMonth = (weekdayName, year, month) => {
  const NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const target = NAMES.indexOf(weekdayName);
  if (target === -1) return 0;
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth(); // 0-based
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDay = new Date(y, m, 1).getDay();
  // How many full weeks + extras
  const offset = (target - firstDay + 7) % 7;
  return offset >= daysInMonth
    ? 0
    : Math.floor((daysInMonth - offset - 1) / 7) + 1;
};

// Convert any SIP frequency to monthly equivalent multiplier
export const freqToMonthly = (amount, frequency) => {
  if (frequency === "weekly") return amount * (52 / 12);
  if (frequency === "yearly") return amount / 12;
  if (frequency === "onetime") return 0;
  return amount; // monthly (default)
};

export const autoCorpus = (
  initialCorpus,
  monthly,
  rateAnnual,
  startDate,
  frequency = "monthly",
) => {
  // For one-time, treat monthly param as additional lump sum principal
  const base =
    frequency === "onetime" ? initialCorpus + (monthly || 0) : initialCorpus;
  if (!startDate) return base;
  const now = new Date();
  const start = new Date(startDate);
  const mo = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()),
  );
  const eff = freqToMonthly(monthly, frequency); // 0 for onetime
  return (
    lumpCorpus(base, rateAnnual, mo / 12) + sipCorpus(eff, rateAnnual, mo / 12)
  );
};

export const projectionData = (
  existingCorpus,
  monthly,
  rateAnnual,
  years,
  frequency = "monthly",
) => {
  const base =
    frequency === "onetime" ? existingCorpus + (monthly || 0) : existingCorpus;
  const eff = freqToMonthly(monthly, frequency); // 0 for onetime
  return Array.from({ length: years }, (_, i) => {
    const y = i + 1;
    const corpus = totalCorpus(base, eff, rateAnnual, y);
    const invested = base + eff * 12 * y;
    return {
      year: `Y${y}`,
      corpus: Math.round(corpus),
      invested: Math.round(invested),
      gains: Math.round(corpus - invested),
    };
  });
};

export const ltcgTax = (gains) => Math.max(0, (gains - 100000) * 0.1);

export const calcEMI = (p, r, n) => {
  if (!p || !r || !n) return 0;
  const mr = r / 100 / 12;
  return Math.round((p * mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1));
};

export const EXPENSE_CATEGORIES = [
  "Housing",
  "Food",
  "Transport",
  "Utilities",
  "Insurance",
  "Healthcare",
  "Entertainment",
  "Shopping",
  "Education",
  "Personal Care",
  "Others",
];

// Sub-categories keyed by parent category.
// Expenses with a matching category will show a sub-category picker.
export const EXPENSE_SUBCATEGORIES = {
  Food: ["Groceries", "Dining Out", "Coffee / Snacks", "Food Delivery"],
  Transport: [
    "Fuel",
    "Cab / Auto",
    "Public Transport",
    "Vehicle EMI",
    "Parking",
  ],
  Housing: ["Rent / EMI", "Maintenance", "Furnishing", "Household Help"],
  Utilities: ["Electricity", "Internet", "Mobile Recharge", "Gas / Water"],
  Entertainment: ["OTT / Streaming", "Movies / Events", "Games", "Hobbies"],
  Healthcare: ["Doctor / Clinic", "Medicines", "Lab Tests", "Gym / Wellness"],
  Shopping: ["Clothing", "Electronics", "Home & Kitchen", "Accessories"],
  Education: ["Fees / Tuition", "Books / Courses", "Stationery"],
  "Personal Care": ["Salon / Grooming", "Skincare / Cosmetics"],
};

// ── Expense type system ──────────────────────────────────────────────────────
export const EXPENSE_TYPES = {
  monthly: { label: "Monthly", emoji: "🔄", color: "var(--blue)" },
  trip: { label: "Trips", emoji: "✈️", color: "var(--purple)" },
  onetime: { label: "One-time", emoji: "💳", color: "var(--gold)" },
};

// Quick-add categories for trip line items
export const TRIP_CATEGORIES = [
  "Transport",
  "Hotel",
  "Food",
  "Shopping",
  "Entertainment",
  "Others",
];

export const INVESTMENT_TYPES = [
  "Mutual Fund",
  "PPF",
  "NPS",
  "FD",
  "Stocks",
  "Gold",
  "EPF",
  "ULIP",
  "Other",
];
export const INCOME_TYPES = [
  "salary",
  "freelance",
  "rental",
  "business",
  "other",
];
export const monthsUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth()),
  );
};

export const CAT_COLORS = {
  Housing: "#5b9cf6",
  Food: "#4caf82",
  Transport: "#c9a84c",
  Utilities: "#9b7fe8",
  Insurance: "#e05c5c",
  Healthcare: "#f0875a",
  Entertainment: "#56c2d6",
  Shopping: "#d46eb3",
  Education: "#7fcfa0",
  "Personal Care": "#b8a06a",
  Others: "#6b6b7a",
};

// ── Wealth Intelligence Utilities ─────────────────────────────────────────

/**
 * FIRE Ratio: invested corpus / annual expenses.
 * Tells how many years of expenses your investments can cover.
 * 25× = traditional FIRE target (4% withdrawal rule).
 */
export const fireRatio = (investedCorpus, annualExpenses) =>
  annualExpenses > 0 ? investedCorpus / annualExpenses : 0;

/**
 * Retirement corpus needed for a desired monthly spend (in today's money)
 * adjusted for inflation, assuming a 4% safe withdrawal rate.
 *   corpusNeeded = monthlySpend × 12 × (1 + inflation)^yearsToRetire / withdrawalRate
 */
export const retirementCorpus = (
  monthlySpend,
  yearsToRetire,
  inflation = 0.06,
  withdrawalRate = 0.04,
) => {
  const futureAnnualSpend =
    monthlySpend * 12 * Math.pow(1 + inflation, yearsToRetire);
  return futureAnnualSpend / withdrawalRate;
};

/**
 * Required monthly SIP to reach a target corpus in N months at given annual return.
 * Inverse of sipCorpus: SIP = FV × r / ((1+r)^n − 1) / (1+r)
 */
export const requiredSIP = (targetAmount, rateAnnual, months) => {
  if (months <= 0) return targetAmount;
  const r = rateAnnual / 100 / 12;
  if (r === 0) return targetAmount / months;
  return targetAmount / (((Math.pow(1 + r, months) - 1) / r) * (1 + r));
};

/**
 * Asset allocation breakdown from an investments array.
 * Returns { equity, debt, gold, cash, other } as percentages.
 */
export const assetAllocation = (investments) => {
  const EQUITY_TYPES = ["Mutual Fund", "Stocks", "ULIP"];
  const DEBT_TYPES = ["PPF", "FD", "EPF", "NPS"];
  const GOLD_TYPES = ["Gold"];

  let equity = 0,
    debt = 0,
    gold = 0,
    other = 0;
  for (const inv of investments || []) {
    const val = inv.existingCorpus || inv.amount || 0;
    if (EQUITY_TYPES.includes(inv.type)) equity += val;
    else if (DEBT_TYPES.includes(inv.type)) debt += val;
    else if (GOLD_TYPES.includes(inv.type)) gold += val;
    else other += val;
  }
  const total = equity + debt + gold + other;
  if (total === 0) return { equity: 0, debt: 0, gold: 0, other: 0, total: 0 };
  return {
    equity: Math.round((equity / total) * 100),
    debt: Math.round((debt / total) * 100),
    gold: Math.round((gold / total) * 100),
    other: Math.round((other / total) * 100),
    total,
  };
};

/**
 * Total current corpus across all investments (sum of existingCorpus).
 */
export const currentCorpus = (investments) =>
  (investments || []).reduce((s, x) => s + (x.existingCorpus || 0), 0);

/**
 * Unused 80C limit. maxLimit = 1,50,000.
 * Scans investments for ELSS, PPF, EPF, ULIP, life insurance.
 */
export const unused80C = (investments, insurances) => {
  const MAX = 150000;
  let used = 0;
  for (const inv of investments || []) {
    const amt = freqToMonthly(inv.amount, inv.frequency) * 12;
    if (inv.type === "Mutual Fund" && /elss/i.test(inv.name)) used += amt;
    else if (["PPF", "EPF", "ULIP"].includes(inv.type)) used += amt;
  }
  for (const ins of insurances || []) {
    if (ins.type === "Life") used += ins.premium || 0;
  }
  return Math.max(0, MAX - Math.min(used, MAX));
};

/**
 * Insurance adequacy: life cover should be 10–15× annual income.
 * Returns { currentCover, recommended, gap, adequate }.
 */
export const insuranceAdequacy = (insurances, annualIncome) => {
  const currentCover = (insurances || [])
    .filter((i) => i.type === "Life")
    .reduce((s, i) => s + (i.coverage || 0), 0);
  const recommended = annualIncome * 12;
  return {
    currentCover,
    recommended,
    gap: Math.max(0, recommended - currentCover),
    adequate: currentCover >= annualIncome * 10,
  };
};
