export const fmt = (n = 0) =>
  "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

export const fmtCr = (n = 0) => {
  const a = Math.abs(n);
  if (a >= 10000000) return "₹" + (a / 10000000).toFixed(2) + " Cr";
  if (a >= 100000) return "₹" + (a / 100000).toFixed(1) + " L";
  return fmt(n);
};

export const nextId = (arr) => Math.max(0, ...arr.map((x) => x.id ?? 0)) + 1;

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
