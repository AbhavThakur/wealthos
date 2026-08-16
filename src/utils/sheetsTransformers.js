import {
  expAmount,
  freqToMonthly,
  EXPENSE_CATEGORIES,
} from "./finance.js";
import { calculateHouseholdMonthFinancials } from "./financialDiagnostics.js";

// Helper: map category to 50/30/20 rule bucket
export function getCategoryRuleBucket(category) {
  const NEEDS = [
    "Housing",
    "Food",
    "Transport",
    "Utilities",
    "Healthcare",
    "Insurance",
    "Education",
  ];
  const SAVINGS = ["Investments", "Savings", "SIP", "Emergency Fund"];
  if (NEEDS.includes(category)) return "Needs";
  if (SAVINGS.includes(category)) return "Savings";
  return "Wants";
}

// ── Tab 1: Monthly_Summary (Executive Rollup) ──────────────────────────────────
export function toMonthlySummaryRows(p1, p2, shared, personNames = { p1: "Person 1", p2: "Person 2" }) {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Gather unique months across netWorthHistory, expenses, and current year
  const monthSet = new Set();
  monthSet.add(curYm);

  // Add trailing 6 months by default
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Add months from netWorthHistory
  (shared?.netWorthHistory || []).forEach((h) => {
    if (h.date) monthSet.add(h.date.slice(0, 7));
  });

  // Add months from onetime expenses
  [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
    if (e.date) monthSet.add(e.date.slice(0, 7));
    (e.entries || []).forEach((ent) => {
      if (ent.date) monthSet.add(ent.date.slice(0, 7));
    });
  });

  // Sort descending (newest month first)
  const sortedMonths = Array.from(monthSet).filter(Boolean).sort((a, b) => b.localeCompare(a));

  const rows = sortedMonths.map((ym, idx) => {
    const financials = calculateHouseholdMonthFinancials({
      p1,
      p2,
      shared,
      monthYm: ym,
      personNames,
    });

    const [year, monthNum] = ym.split("-");
    const monthDate = new Date(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1);
    const monthName = monthDate.toLocaleString("en-IN", { month: "long", year: "numeric" });

    // P1 vs P2 Incomes
    const p1Income = (p1?.incomes || []).reduce((s, inc) => {
      let amt = Number(inc.amount || 0);
      (inc.incomeEntries || []).forEach((e) => {
        if (e.date && e.date.slice(0, 7) === ym) amt += Number(e.amount || 0);
      });
      return s + amt;
    }, 0);

    const p2Income = (p2?.incomes || []).reduce((s, inc) => {
      let amt = Number(inc.amount || 0);
      (inc.incomeEntries || []).forEach((e) => {
        if (e.date && e.date.slice(0, 7) === ym) amt += Number(e.amount || 0);
      });
      return s + amt;
    }, 0);

    // P1 vs P2 Expenses
    const p1Exp = (p1?.expenses || []).reduce((s, e) => s + expAmount(e, ym), 0);
    const p2Exp = (p2?.expenses || []).reduce((s, e) => s + expAmount(e, ym), 0);
    const sharedExp = (shared?.trips || []).reduce((s, t) => {
      if ((t.startDate || t.date || "").slice(0, 7) === ym) return s + Number(t.amount || 0);
      return s;
    }, 0);

    // 50/30/20 Buckets
    let needsSpent = 0;
    let wantsSpent = 0;
    [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
      const amt = expAmount(e, ym);
      const bucket = getCategoryRuleBucket(e.category);
      if (bucket === "Needs") needsSpent += amt;
      else wantsSpent += amt;
    });

    // Total SIPs active
    const totalSips = [...(p1?.investments || []), ...(p2?.investments || [])].reduce(
      (s, inv) => s + freqToMonthly(Number(inv.sipMonthly || 0), inv.frequency || "monthly"),
      0,
    );

    // Net worth for month
    const nwEntry = (shared?.netWorthHistory || []).find((h) => (h.date || "").slice(0, 7) === ym);
    const nextNwEntry = sortedMonths[idx + 1]
      ? (shared?.netWorthHistory || []).find(
          (h) => (h.date || "").slice(0, 7) === sortedMonths[idx + 1],
        )
      : null;

    const assets = nwEntry?.assets ?? 0;
    const liabilities = nwEntry?.liabilities ?? 0;
    const netWorth = assets - liabilities;
    const prevNetWorth = nextNwEntry ? (nextNwEntry.assets || 0) - (nextNwEntry.liabilities || 0) : null;
    const momChange = prevNetWorth !== null ? netWorth - prevNetWorth : 0;

    return {
      month: ym,
      year: parseInt(year, 10),
      monthName,
      totalIncome: financials.totalIncome,
      p1Income,
      p2Income,
      totalExpenses: financials.totalExpenses,
      p1Expenses: p1Exp,
      p2Expenses: p2Exp,
      sharedExpenses: sharedExp,
      needsSpent,
      wantsSpent,
      savingsInvested: financials.monthlySurplus > 0 ? financials.monthlySurplus : 0,
      savingsRatePct: financials.savingsRate,
      budgetVariance: financials.monthlySurplus,
      totalSips,
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth,
      momNetWorthChange: momChange,
      statusNotes: financials.statusTitle + " (" + financials.savingsRate + "% Savings Rate)",
    };
  });

  return rows;
}

// ── Tab 2: All_Transactions (Unified Ledger) ──────────────────────────────────
export function toUnifiedTransactionRows(p1, p2, shared, personNames = { p1: "Person 1", p2: "Person 2" }) {
  const rows = [];

  const addTxn = ({
    date,
    person,
    type,
    category,
    subcategory,
    desc,
    amount,
    isSplit = false,
    paidBy = "",
    account = "",
    notes = "",
  }) => {
    if (!date || !amount) return;
    const month = date.slice(0, 7);
    const bucket = getCategoryRuleBucket(category);
    rows.push({
      date,
      month,
      person,
      type: type || "Expense",
      category: category || "Others",
      subcategory: subcategory || "",
      description: desc || "Transaction",
      amount: Number(amount) || 0,
      budgetBucket: bucket,
      isSplit: isSplit ? "Yes" : "No",
      paidBy: paidBy || person,
      accountLinked: account || "—",
      notes: notes || "",
    });
  };

  const processPersonData = (personData, personLabel) => {
    // 1. Direct transactions
    (personData?.transactions || []).forEach((t) => {
      addTxn({
        date: t.date,
        person: personLabel,
        type: t.type || (t.amount < 0 ? "Expense" : "Income"),
        category: t.category,
        subcategory: t.subcategory,
        desc: t.desc || t.name,
        amount: Math.abs(t.amount || 0),
        account: t.account || t.bankName,
        notes: t.notes,
      });
    });

    // 2. One-time expenses
    (personData?.expenses || []).forEach((e) => {
      if (e.expenseType === "onetime") {
        if ((e.entries || []).length > 0) {
          e.entries.forEach((ent) => {
            addTxn({
              date: ent.date || e.date,
              person: personLabel,
              type: "Expense (One-time)",
              category: e.category,
              subcategory: e.subCategory,
              desc: ent.note ? `${e.name} — ${ent.note}` : e.name,
              amount: ent.amount,
              isSplit: e.isSplit,
              paidBy: e.paidBy === "p2" ? personNames.p2 : personNames.p1,
              account: e.accountLinked,
            });
          });
        } else if (e.amount > 0 && e.date) {
          addTxn({
            date: e.date,
            person: personLabel,
            type: "Expense (One-time)",
            category: e.category,
            subcategory: e.subCategory,
            desc: e.name,
            amount: e.amount,
            isSplit: e.isSplit,
            paidBy: e.paidBy === "p2" ? personNames.p2 : personNames.p1,
            account: e.accountLinked,
          });
        }
      } else if (e.expenseType === "trip") {
        (e.items || []).forEach((item) => {
          addTxn({
            date: item.date || e.startDate || e.date,
            person: personLabel,
            type: "Expense (Trip)",
            category: item.category || "Travel",
            subcategory: e.name,
            desc: item.name ? `${e.name}: ${item.name}` : e.name,
            amount: item.amount,
            isSplit: e.isSplit,
          });
        });
      }
    });

    // 3. Variable income entries (bonuses, freelance, etc.)
    (personData?.incomes || []).forEach((inc) => {
      (inc.incomeEntries || []).forEach((ent) => {
        addTxn({
          date: ent.date,
          person: personLabel,
          type: "Income (Variable)",
          category: inc.type || "Bonus/Freelance",
          subcategory: ent.type || "Bonus",
          desc: ent.note ? `${inc.name}: ${ent.note}` : inc.name,
          amount: ent.amount,
        });
      });
    });
  };

  processPersonData(p1, personNames.p1 || "Person 1");
  processPersonData(p2, personNames.p2 || "Person 2");

  // Shared trips
  (shared?.trips || []).forEach((trip) => {
    (trip.items || []).forEach((item) => {
      addTxn({
        date: item.date || trip.startDate || trip.date,
        person: "Household",
        type: "Expense (Shared Trip)",
        category: item.category || "Travel",
        subcategory: trip.name,
        desc: item.name ? `${trip.name}: ${item.name}` : trip.name,
        amount: item.amount,
        isSplit: true,
      });
    });
  });

  // Sort newest date first
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

// ── Tab 3: Budget_vs_Actual (Category Matrix) ──────────────────────────────────
export function toBudgetVsActualRows(p1, p2, shared) {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Evaluate for current month and previous month
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const monthsToEvaluate = [curYm, prevYm];
  const rows = [];

  monthsToEvaluate.forEach((ym) => {
    // Group budgeted vs actual by category for Household
    const catMap = {};
    EXPENSE_CATEGORIES.forEach((cat) => {
      catMap[cat] = { budgeted: 0, actual: 0 };
    });

    // Sum recurring budget amounts
    [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
      const cat = e.category || "Others";
      if (!catMap[cat]) catMap[cat] = { budgeted: 0, actual: 0 };
      if (e.expenseType !== "onetime" && e.expenseType !== "trip") {
        catMap[cat].budgeted += Number(e.amount || 0);
      }
      // Actual spend in month
      const actualAmt = expAmount(e, ym);
      catMap[cat].actual += actualAmt;
    });

    // Add shared trip items to actual
    (shared?.trips || []).forEach((trip) => {
      if ((trip.startDate || trip.date || "").slice(0, 7) === ym) {
        (trip.items || []).forEach((item) => {
          const cat = item.category || "Travel";
          if (!catMap[cat]) catMap[cat] = { budgeted: 0, actual: 0 };
          catMap[cat].actual += Number(item.amount || 0);
        });
      }
    });

    Object.entries(catMap).forEach(([cat, { budgeted, actual }]) => {
      if (budgeted === 0 && actual === 0) return;
      const variance = budgeted - actual;
      const utilization = budgeted > 0 ? Math.round((actual / budgeted) * 100) : actual > 0 ? 100 : 0;
      let status = "🟢 Under Budget";
      if (actual > budgeted && budgeted > 0) status = "🔴 Over Budget";
      else if (utilization >= 90) status = "🟡 Near Limit (90%+)";

      rows.push({
        month: ym,
        person: "Household",
        category: cat,
        ruleBucket: getCategoryRuleBucket(cat),
        budgetedLimit: budgeted,
        actualSpent: actual,
        variance,
        utilizationPct: utilization,
        status,
      });
    });
  });

  return rows;
}

// ── Tab 4: Investments_&_Assets ────────────────────────────────────────────────
export function toInvestmentAssetRows(p1, p2, shared, personNames = { p1: "Person 1", p2: "Person 2" }) {
  const rows = [];
  const allInvestments = [
    ...(p1?.investments || []).map((i) => ({ ...i, owner: personNames.p1 || "Person 1" })),
    ...(p2?.investments || []).map((i) => ({ ...i, owner: personNames.p2 || "Person 2" })),
  ];

  const totalCorpus = allInvestments.reduce((s, i) => s + Number(i.corpus || 0), 0);

  allInvestments.forEach((inv) => {
    const corpus = Number(inv.corpus || 0);
    const sip = Number(inv.sipMonthly || 0);
    const alloc = totalCorpus > 0 ? Math.round((corpus / totalCorpus) * 100) : 0;

    let assetClass = "Equity";
    const typeLower = (inv.type || "").toLowerCase();
    const nameLower = (inv.name || "").toLowerCase();

    if (typeLower.includes("debt") || typeLower.includes("ppf") || typeLower.includes("fd") || nameLower.includes("fixed deposit")) {
      assetClass = "Debt / Fixed Income";
    } else if (typeLower.includes("gold") || nameLower.includes("gold") || nameLower.includes("sgb")) {
      assetClass = "Gold";
    } else if (typeLower.includes("real estate") || typeLower.includes("reit")) {
      assetClass = "Real Estate";
    } else if (typeLower.includes("cash") || typeLower.includes("liquid")) {
      assetClass = "Liquid Cash";
    }

    rows.push({
      owner: inv.owner,
      assetName: inv.name || "Investment",
      assetClass,
      monthlySip: sip,
      currentCorpus: corpus,
      allocationPct: alloc,
      targetAllocationPct: inv.targetAlloc || alloc,
      platform: inv.platform || inv.broker || "—",
      startDate: inv.startDate || "—",
    });
  });

  return rows;
}

// ── Tab 5: Goals_Tracker ───────────────────────────────────────────────────────
export function toGoalsTrackerRows(p1, p2, shared) {
  const allGoals = [...(shared?.goals || []), ...(p1?.goals || []), ...(p2?.goals || [])];

  return allGoals.map((g) => {
    const target = Number(g.target || 0);
    const p1Saved = Number(g.p1Saved ?? g.abhavSaved ?? 0);
    const p2Saved = Number(g.p2Saved ?? g.aanyaSaved ?? 0);
    const currentSaved = p1Saved + p2Saved;
    const progress = target > 0 ? Math.round((currentSaved / target) * 100) : 0;
    const remaining = Math.max(0, target - currentSaved);

    // Calculate required monthly contribution
    let monthsLeft = 12;
    if (g.deadline) {
      const now = new Date();
      const [dy, dm] = g.deadline.split("-").map(Number);
      if (dy && dm) {
        monthsLeft = Math.max(1, (dy - now.getFullYear()) * 12 + (dm - (now.getMonth() + 1)));
      }
    }
    const monthlyNeeded = Math.round(remaining / monthsLeft);

    let status = "On Track";
    if (progress >= 100) status = "Completed 🎉";
    else if (progress < 25 && monthsLeft < 6) status = "Needs Attention ⚠️";
    else if (progress >= 75) status = "Ahead of Schedule 🚀";

    return {
      goalName: g.name || "Financial Goal",
      targetAmount: target,
      currentSaved,
      p1Saved,
      p2Saved,
      targetDeadline: g.deadline || "—",
      progressPct: progress,
      remainingAmount: remaining,
      monthlyContributionNeeded: monthlyNeeded,
      status,
    };
  });
}

// ── Tab 6: Net_Worth_History ───────────────────────────────────────────────────
export function toNetWorthTimelineRows(p1, p2, shared) {
  const history = [...(shared?.netWorthHistory || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return history.map((h, i) => {
    const assets = Number(h.assets || 0);
    const liabilities = Number(h.liabilities || 0);
    const netWorth = assets - liabilities;
    const prev = history[i + 1];
    const prevNw = prev ? (Number(prev.assets || 0) - Number(prev.liabilities || 0)) : null;
    const momGrowth = prevNw && prevNw > 0 ? Number((((netWorth - prevNw) / prevNw) * 100).toFixed(1)) : 0;

    return {
      month: h.date || "—",
      cashBankBalances: h.cash ?? Math.round(assets * 0.15),
      equityMutualFunds: h.equity ?? Math.round(assets * 0.60),
      fixedDepositsPf: h.debt ?? Math.round(assets * 0.20),
      goldOtherAssets: h.gold ?? Math.round(assets * 0.05),
      totalAssets: assets,
      creditCardDues: h.creditCard ?? Math.round(liabilities * 0.2),
      personalHomeLoans: h.loans ?? Math.round(liabilities * 0.8),
      totalLiabilities: liabilities,
      netWorth,
      momGrowthPct: momGrowth,
    };
  });
}

// ── Tab 7: AI_Prompts_&_Formulas (Built-in Cheat Sheet) ─────────────────────────
export function toAIPromptsRows() {
  return [
    {
      category: "Executive Review",
      useCase: "Monthly Financial Health Audit",
      promptOrFormula: 'Ask Gemini in Sheets: "Summarize our financial performance from the Monthly_Summary tab over the last 3 months. Highlight our top savings wins and biggest spending anomalies in 3 bullet points."',
      targetRange: "Monthly_Summary!A1:S10",
      expectedOutput: "3-bullet executive summary with savings rate trend and budget health.",
    },
    {
      category: "Spending Audit",
      useCase: "Find Discretionary Leaks & Top Merchants",
      promptOrFormula: 'Ask Gemini in Sheets: "Analyze All_Transactions for the latest month. What are our top 5 discretionary expense categories and which single merchant took the most money?"',
      targetRange: "All_Transactions!A1:M500",
      expectedOutput: "Table of top 5 discretionary spend areas with total rupees spent.",
    },
    {
      category: "Budget Optimization",
      useCase: "Category Overspending Prevention",
      promptOrFormula: 'Ask Gemini in Sheets: "Look at Budget_vs_Actual. For every category where status is Over Budget, recommend practical cutbacks to increase our savings rate to 35%."',
      targetRange: "Budget_vs_Actual!A1:I30",
      expectedOutput: "Specific budget reallocation suggestions for high-variance categories.",
    },
    {
      category: "Retirement & Wealth",
      useCase: "Net Worth Compound Growth Projection",
      promptOrFormula: 'Ask Gemini in Sheets: "Based on our average monthly savings and SIP contributions in Investments_&_Assets and Monthly_Summary, estimate our Net Worth in 3 years at 12% CAGR."',
      targetRange: "Investments_&_Assets!A1:I50",
      expectedOutput: "Year-by-year projected portfolio growth table.",
    },
    {
      category: "Partner Insights",
      useCase: "Household Split & Contribution Analysis",
      promptOrFormula: 'Ask Gemini in Sheets: "Compare P1 vs P2 total spending and savings contributions across Monthly_Summary and All_Transactions. Are we splitting shared living costs equitably?"',
      targetRange: "Monthly_Summary!A1:S10",
      expectedOutput: "Equitable contribution breakdown and split ratio comparison.",
    },
    {
      category: "Native AI Formula",
      useCase: "Auto-Categorize Unlabeled Descriptions",
      promptOrFormula: '=AI("Classify this expense into Housing, Food, Transport, Utilities, Healthcare, Entertainment, Shopping, or Others", G2)',
      targetRange: "Any cell in All_Transactions",
      expectedOutput: "Single word canonical category label.",
    },
    {
      category: "Native AI Formula",
      useCase: "Instant 1-Sentence Month Review",
      promptOrFormula: '=AI("Write a 1-sentence monthly financial review highlighting the biggest win and biggest risk", Monthly_Summary!A2:S2)',
      targetRange: "Any summary cell",
      expectedOutput: "Concise actionable summary of the month.",
    },
  ];
}
