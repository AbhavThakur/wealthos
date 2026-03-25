// Demo data with realistic Indian household finances
// Used by guest demo mode — no Firebase writes

const now = new Date();
const ym = (offset = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const dateStr = (offset = 0, day = 1) =>
  `${ym(offset)}-${String(day).padStart(2, "0")}`;

export const DEMO_PERSON1 = {
  incomes: [
    { id: 1, name: "Salary", amount: 125000, type: "salary" },
    { id: 2, name: "Freelance", amount: 15000, type: "freelance" },
  ],
  expenses: [
    {
      id: 1,
      name: "Rent",
      amount: 28000,
      category: "Housing",
      expenseType: "monthly",
    },
    {
      id: 2,
      name: "Groceries",
      amount: 8000,
      category: "Food",
      expenseType: "monthly",
    },
    {
      id: 3,
      name: "Transport",
      amount: 4500,
      category: "Transport",
      expenseType: "monthly",
    },
    {
      id: 4,
      name: "Utilities",
      amount: 3500,
      category: "Utilities",
      expenseType: "monthly",
    },
    {
      id: 5,
      name: "Entertainment",
      amount: 5000,
      category: "Entertainment",
      expenseType: "monthly",
    },
    {
      id: 6,
      name: "Shopping",
      amount: 4000,
      category: "Shopping",
      expenseType: "monthly",
    },
    {
      id: 7,
      name: "Health Insurance",
      amount: 2000,
      category: "Insurance",
      expenseType: "monthly",
    },
  ],
  investments: [
    {
      id: 1,
      name: "Nifty 50 Index Fund",
      amount: 15000,
      frequency: "monthly",
      returnPct: 12,
      existingCorpus: 620000,
      startDate: "2022-01-15",
      type: "Mutual Fund",
      deductionDate: 5,
    },
    {
      id: 2,
      name: "HDFC Mid-Cap SIP",
      amount: 10000,
      frequency: "monthly",
      returnPct: 14,
      existingCorpus: 380000,
      startDate: "2022-06-01",
      type: "Mutual Fund",
      deductionDate: 10,
    },
    {
      id: 3,
      name: "PPF",
      amount: 12500,
      frequency: "monthly",
      returnPct: 7.1,
      existingCorpus: 450000,
      startDate: "2020-04-01",
      type: "PPF",
      deductionDate: 1,
    },
    {
      id: 4,
      name: "FD – SBI",
      amount: 300000,
      frequency: "onetime",
      returnPct: 7.25,
      existingCorpus: 0,
      startDate: "2024-01-10",
      type: "FD",
    },
  ],
  goals: [
    {
      id: 1,
      name: "Emergency Fund",
      target: 500000,
      saved: 380000,
      emoji: "🛡️",
      color: "#4caf82",
      deadline: "2025-12-31",
    },
  ],
  debts: [
    {
      id: 1,
      name: "Home Loan",
      outstanding: 3200000,
      emi: 32000,
      rate: 8.5,
      tenure: 180,
    },
  ],
  transactions: [],
  recurringRules: [],
  budgetAlerts: [
    { id: 1, category: "Food", limit: 10000, active: true },
    { id: 2, category: "Entertainment", limit: 6000, active: true },
  ],
  assets: [
    { id: 1, name: "Savings Account – HDFC", value: 185000, type: "cash" },
  ],
  liabilities: [],
  taxInfo: {
    regime: "new",
    hra: 14000,
    section80C: 150000,
    section80D: 25000,
    nps80CCD: 50000,
  },
  insurances: [
    {
      id: 1,
      name: "Term Life – ICICI",
      type: "term",
      premium: 12000,
      sumAssured: 10000000,
      renewalDate: "2025-11-15",
    },
    {
      id: 2,
      name: "Health – Star",
      type: "health",
      premium: 24000,
      sumAssured: 1000000,
      renewalDate: "2025-09-01",
    },
  ],
  subscriptions: [
    {
      id: 1,
      name: "Netflix",
      amount: 649,
      frequency: "monthly",
      category: "Entertainment",
    },
    {
      id: 2,
      name: "Spotify",
      amount: 119,
      frequency: "monthly",
      category: "Entertainment",
    },
    {
      id: 3,
      name: "Gym",
      amount: 2500,
      frequency: "monthly",
      category: "Health",
    },
  ],
  dismissedAutoTxns: [],
  savingsAccounts: [
    { id: 1, name: "HDFC Savings", balance: 185000 },
    { id: 2, name: "Kotak 811", balance: 45000 },
  ],
};

export const DEMO_PERSON2 = {
  incomes: [{ id: 1, name: "Salary", amount: 95000, type: "salary" }],
  expenses: [
    {
      id: 1,
      name: "Groceries",
      amount: 6000,
      category: "Food",
      expenseType: "monthly",
    },
    {
      id: 2,
      name: "Transport",
      amount: 3000,
      category: "Transport",
      expenseType: "monthly",
    },
    {
      id: 3,
      name: "Shopping",
      amount: 7000,
      category: "Shopping",
      expenseType: "monthly",
    },
    {
      id: 4,
      name: "Utilities",
      amount: 2500,
      category: "Utilities",
      expenseType: "monthly",
    },
    {
      id: 5,
      name: "Education",
      amount: 5000,
      category: "Education",
      expenseType: "monthly",
    },
    {
      id: 6,
      name: "Personal Care",
      amount: 3000,
      category: "Others",
      expenseType: "monthly",
    },
  ],
  investments: [
    {
      id: 1,
      name: "Axis Bluechip SIP",
      amount: 10000,
      frequency: "monthly",
      returnPct: 11,
      existingCorpus: 290000,
      startDate: "2022-09-01",
      type: "Mutual Fund",
      deductionDate: 15,
    },
    {
      id: 2,
      name: "SGB – Gold Bond",
      amount: 50000,
      frequency: "yearly",
      returnPct: 8,
      existingCorpus: 150000,
      startDate: "2023-03-01",
      type: "Gold",
      deductionDate: 1,
    },
    {
      id: 3,
      name: "EPF",
      amount: 7500,
      frequency: "monthly",
      returnPct: 8.25,
      existingCorpus: 320000,
      startDate: "2021-07-01",
      type: "EPF",
      deductionDate: 1,
    },
  ],
  goals: [
    {
      id: 1,
      name: "Vacation Fund",
      target: 200000,
      saved: 85000,
      emoji: "✈️",
      color: "#5b9cf6",
      deadline: "2025-10-31",
    },
  ],
  debts: [],
  transactions: [],
  recurringRules: [],
  budgetAlerts: [{ id: 1, category: "Shopping", limit: 8000, active: true }],
  assets: [
    { id: 1, name: "Savings Account – SBI", value: 120000, type: "cash" },
    { id: 2, name: "Gold Jewellery", value: 350000, type: "other" },
  ],
  liabilities: [],
  taxInfo: {
    regime: "new",
    section80C: 100000,
    section80D: 25000,
  },
  insurances: [
    {
      id: 1,
      name: "Term Life – Max",
      type: "term",
      premium: 9500,
      sumAssured: 7500000,
      renewalDate: "2026-01-10",
    },
  ],
  subscriptions: [
    {
      id: 1,
      name: "Amazon Prime",
      amount: 1499,
      frequency: "yearly",
      category: "Shopping",
    },
    {
      id: 2,
      name: "YouTube Premium",
      amount: 149,
      frequency: "monthly",
      category: "Entertainment",
    },
  ],
  dismissedAutoTxns: [],
  savingsAccounts: [{ id: 1, name: "SBI Savings", balance: 120000 }],
};

// Build net worth history for last 6 months
function buildHistory() {
  const history = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const offset = i + 5; // 0..5
    history.push({
      label,
      month,
      year,
      timestamp: d.toISOString(),
      abhavIncome: 125000 + 15000,
      abhavExpenses: 55000 + Math.round(offset * 800),
      abhavInvestments: 37500,
      aanyaIncome: 95000,
      aanyaExpenses: 26500 + Math.round(offset * 500),
      aanyaInvestments: 17500,
      sharedTripExpenses: 0,
      abhavNetWorth: 1200000 + offset * 85000,
      aanyaNetWorth: 750000 + offset * 55000,
    });
  }
  return history;
}

export const DEMO_SHARED = {
  goals: [
    {
      id: 1,
      name: "Home Down Payment",
      target: 2000000,
      abhavSaved: 650000,
      aanyaSaved: 420000,
      emoji: "🏠",
      color: "#c9a84c",
      deadline: "2026-06-30",
    },
    {
      id: 2,
      name: "Europe Trip",
      target: 500000,
      abhavSaved: 120000,
      aanyaSaved: 80000,
      emoji: "✈️",
      color: "#5b9cf6",
      deadline: "2025-12-31",
    },
    {
      id: 3,
      name: "Baby Fund",
      target: 800000,
      abhavSaved: 180000,
      aanyaSaved: 150000,
      emoji: "👶",
      color: "#d46eb3",
      deadline: "2027-01-01",
    },
  ],
  trips: [
    { id: 1, name: "Goa Weekend", amount: 35000, date: dateStr(-2, 15) },
    { id: 2, name: "Manali Trip", amount: 52000, date: dateStr(-4, 5) },
  ],
  profile: {
    householdName: "The Sharmas",
    city: "Bengaluru",
    savingsTarget: 30,
    person1Name: "Rahul",
    person2Name: "Priya",
  },
  netWorthHistory: buildHistory(),
};

export const DEMO_PERSON_NAMES = {
  abhav: "Rahul",
  aanya: "Priya",
};
