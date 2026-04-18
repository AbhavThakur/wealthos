import {
  lumpCorpus,
  freqToMonthly,
  totalCorpus,
  weekdayCountInMonth,
} from "../utils/finance";

// ── Investment type helpers ──────────────────────────────────────────────────

// SIP / stock investment apps
export const INVESTMENT_APPS = [
  "Zerodha / Kite",
  "Groww",
  "Jio Finance",
  "myCams",
  "smallcase",
  "Coin",
  "Paytm Money",
  "ET Money",
  "INDmoney",
];

// FD / fixed-income platforms
export const FD_APPS = [
  "Stable Money",
  "Grip Invest",
  "Wint Wealth",
  "Altifi",
  "BondsIndia",
  "GoldenPi",
  "Jiraaf",
];

// All app names combined (for datalist autocomplete)
export const ALL_APPS = [...INVESTMENT_APPS, ...FD_APPS];

export const BANK_LIST = [
  // Big private banks
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Yes Bank",
  "IDFC First Bank",
  "IndusInd Bank",
  "Federal Bank",
  "South Indian Bank",
  "RBL Bank",
  "Bandhan Bank",
  // Public sector banks
  "State Bank of India",
  "Bank of Baroda",
  "Punjab National Bank",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "Central Bank of India",
  "Indian Bank",
  "UCO Bank",
  "Bank of Maharashtra",
  "Indian Overseas Bank",
  // Small finance banks
  "AU Small Finance Bank",
  "Equitas Small Finance Bank",
  "Jana Small Finance Bank",
  "Ujjivan Small Finance Bank",
  "Utkarsh Small Finance Bank",
  "Unity Small Finance Bank",
  "Suryoday Small Finance Bank",
  "Shivalik Small Finance Bank",
  "ESAF Small Finance Bank",
  "slice Small Finance Bank",
  // NBFCs / other lenders
  "Bajaj Finance",
  "Shriram Finance",
  "Mahindra Finance",
  "Tata Capital",
];

export function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const isFD = (t) => t === "FD";
export const hasSIPFreq = (t) =>
  ["Mutual Fund", "Stocks", "Gold", "ULIP"].includes(t);
export const hasDeductionDate = (t, freq) =>
  freq !== "onetime" &&
  freq !== "weekly" &&
  ["Mutual Fund", "Stocks", "Gold", "NPS", "ULIP"].includes(t);
export const hasInvestmentApp = (t) =>
  ["Mutual Fund", "Stocks", "Gold", "FD"].includes(t);

// Which app list to suggest for a given investment type
export const appsForType = (t) => (t === "FD" ? FD_APPS : INVESTMENT_APPS);

export const DEDUCTION_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
export const MONTHS = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];
export const hasDeductionMonth = (freq) => freq === "yearly";

// Count how many SIP installments have occurred since startDate
// Returns net invested total (after stamp duty for MFs)
export function computeAutoInvested(inv) {
  if (!inv.startDate || !inv.amount) return 0;
  const start = new Date(inv.startDate);
  const now = new Date();
  if (now < start) return 0;
  const freq = inv.frequency;
  // MF stamp duty (0.005%) is deducted from each SIP before buying units
  const perInstallment =
    inv.type === "Mutual Fund"
      ? Math.round(inv.amount * (1 - 0.00005) * 100) / 100
      : inv.amount;

  if (freq === "weekly") {
    // Count exact weekdays between startDate and today
    const NAMES = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const targetDay = NAMES.indexOf(inv.deductionDay || "Monday");
    if (targetDay === -1) return 0;

    // Count month-by-month for accuracy
    let count = 0;
    let y = start.getFullYear();
    let m = start.getMonth();
    const endY = now.getFullYear();
    const endM = now.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      const wc = weekdayCountInMonth(NAMES[targetDay], y, m);
      if (y === start.getFullYear() && m === start.getMonth()) {
        // Partial first month — only count deduction days on or after startDate
        const startDayOfMonth = start.getDate();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let partial = 0;
        for (let d = startDayOfMonth; d <= daysInMonth; d++) {
          if (new Date(y, m, d).getDay() === targetDay) partial++;
        }
        count += partial;
      } else if (y === endY && m === endM) {
        // Partial current month — only count deduction days up to today
        const todayDate = now.getDate();
        let partial = 0;
        for (let d = 1; d <= todayDate; d++) {
          if (new Date(y, m, d).getDay() === targetDay) partial++;
        }
        count += partial;
      } else {
        count += wc;
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return Math.round(perInstallment * count * 100) / 100;
  }

  if (freq === "monthly") {
    const deductDay = Number(inv.deductionDate) || start.getDate();
    // Walk month by month from start to now
    let count = 0;
    let y = start.getFullYear();
    let m = start.getMonth();
    const endY = now.getFullYear();
    const endM = now.getMonth();
    const todayDate = now.getDate();

    while (y < endY || (y === endY && m <= endM)) {
      if (y === start.getFullYear() && m === start.getMonth()) {
        // First month: always count — the start date means "SIP began this month"
        // (actual execution may shift a day or two due to weekends/holidays)
        count++;
      } else if (y === endY && m === endM) {
        // Current month: only count if deduction day has passed
        if (deductDay <= todayDate) count++;
      } else {
        count++;
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return Math.round(perInstallment * count * 100) / 100;
  }

  if (freq === "yearly") {
    const deductMonth = start.getMonth();
    const deductDay = start.getDate();
    let count = 0;
    for (let yr = start.getFullYear(); yr <= now.getFullYear(); yr++) {
      if (yr === start.getFullYear() && yr === now.getFullYear()) {
        // Same year — check if deduction date has passed
        const deductDate = new Date(yr, deductMonth, deductDay);
        if (now >= deductDate) count++;
      } else if (yr === now.getFullYear()) {
        const deductDate = new Date(yr, deductMonth, deductDay);
        if (now >= deductDate) count++;
      } else {
        count++;
      }
    }
    return Math.round(perInstallment * count * 100) / 100;
  }

  return 0;
}

// Get the invested amount — prefer manual totalInvested if entered, else auto-calculate
// lumpSumInvested is ADDED to auto-calculated SIP total (for one-off purchases outside SIP)
export function getInvested(inv) {
  if (isFD(inv.type)) return inv.amount || 0;
  if (inv.frequency === "onetime") return inv.amount || 0;
  // If user entered a manual override, use it as-is (fully static)
  if (Number(inv.totalInvested) > 0) return Number(inv.totalInvested);
  // Auto-calculate from startDate + SIP amount + frequency + any lump sums
  return computeAutoInvested(inv) + (Number(inv.lumpSumInvested) || 0);
}

// Shared row-computation helper (used in both single-person and household views)
export function computeInvRow(x) {
  const elapsedYrs =
    (isFD(x.type) || x.frequency === "onetime") && x.startDate
      ? Math.max(
          0,
          (new Date() - new Date(x.startDate)) / (365.25 * 24 * 3600 * 1000),
        )
      : 0;
  const cur = isFD(x.type)
    ? lumpCorpus(x.amount || 0, x.returnPct || 0, elapsedYrs)
    : x.frequency === "onetime"
      ? x.existingCorpus > 0
        ? x.existingCorpus
        : lumpCorpus(x.amount || 0, x.returnPct || 0, elapsedYrs)
      : x.existingCorpus || 0;
  const invested = getInvested(x);
  const monthly =
    !isFD(x.type) && x.frequency !== "onetime"
      ? freqToMonthly(x.amount, x.frequency)
      : 0;
  const yr20 = isFD(x.type)
    ? null
    : x.frequency === "onetime"
      ? lumpCorpus(cur, x.returnPct || 0, 20)
      : totalCorpus(
          x.existingCorpus || 0,
          freqToMonthly(x.amount, x.frequency),
          x.returnPct || 0,
          20,
        );
  return {
    name: x.name,
    type: x.type,
    frequency: x.frequency,
    capCategory: x.capCategory || "",
    cur,
    invested,
    monthly,
    yr20,
  };
}
