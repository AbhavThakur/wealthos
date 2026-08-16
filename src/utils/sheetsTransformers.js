import {
  expAmount,
  freqToMonthly,
  EXPENSE_CATEGORIES,
} from "./finance.js";
import { calculateHouseholdMonthFinancials } from "./financialDiagnostics.js";
import { calculateNetWorth } from "./netWorth.js";
import { computeInvRow, getInvested, isFD } from "../pages/investmentHelpers.js";

// Helper: map category to 50/30/20 rule bucket
export function getCategoryRuleBucket(category) {
  const c = (category || "").toLowerCase();
  const NEEDS = [
    "housing",
    "food",
    "transport",
    "utilities",
    "healthcare",
    "insurance",
    "education",
    "groceries",
    "fuel",
    "rent",
    "bills",
    "emi",
    "loan",
    "maintenance",
    "maid",
    "cook",
  ];
  const SAVINGS = [
    "investment",
    "investments",
    "savings",
    "sip",
    "emergency fund",
    "mutual fund",
    "stocks",
    "ppf",
    "fd",
    "fixed deposit",
    "gold",
  ];
  if (NEEDS.some((n) => c.includes(n))) return "Needs";
  if (SAVINGS.some((s) => c.includes(s))) return "Savings";
  return "Wants";
}

// ── Helper: calculate total active monthly SIPs ───────────────────────────────
export function calculateTotalMonthlySips(p1, p2) {
  const allInv = [...(p1?.investments || []), ...(p2?.investments || [])];
  return allInv.reduce((sum, inv) => {
    if (isFD(inv.type) || inv.frequency === "onetime") return sum;
    const rawAmt = Number(inv.amount || inv.sipMonthly || 0);
    return sum + freqToMonthly(rawAmt, inv.frequency || "monthly");
  }, 0);
}

// ── Helper: derive portfolio asset breakdown ──────────────────────────────────
export function derivePortfolioBreakdown(p1, p2, now = new Date()) {
  const p1Nw = calculateNetWorth(p1, now);
  const p2Nw = calculateNetWorth(p2, now);

  const totalAssets = (p1Nw?.assets || 0) + (p2Nw?.assets || 0);
  const totalLiabilities = (p1Nw?.liabilities || 0) + (p2Nw?.liabilities || 0);
  const netWorth = totalAssets - totalLiabilities;

  let cashBank = (p1Nw?.savingsTotal || 0) + (p2Nw?.savingsTotal || 0);

  let equity = 0;
  let debt = 0;
  let gold = 0;
  let otherAssets = 0;

  const allInv = [...(p1?.investments || []), ...(p2?.investments || [])];
  allInv.forEach((inv) => {
    const row = computeInvRow(inv);
    const val = row.cur > 0 ? row.cur : getInvested(inv) || Number(inv.amount || 0);
    const typeLower = (inv.type || "").toLowerCase();
    const nameLower = (inv.name || "").toLowerCase();

    if (typeLower.includes("debt") || typeLower.includes("ppf") || typeLower.includes("fd") || nameLower.includes("fixed deposit") || nameLower.includes("mod")) {
      debt += val;
    } else if (typeLower.includes("gold") || nameLower.includes("gold") || nameLower.includes("sgb")) {
      gold += val;
    } else if (typeLower.includes("cash") || typeLower.includes("liquid")) {
      cashBank += val;
    } else {
      equity += val;
    }
  });

  const allManualAssets = [...(p1?.assets || []), ...(p2?.assets || [])].filter((a) => !a.auto);
  allManualAssets.forEach((a) => {
    const val = Number(a.value || 0);
    const t = (a.type || "").toLowerCase();
    if (t === "gold_physical") gold += val;
    else if (t === "cash") cashBank += val;
    else otherAssets += val;
  });

  let creditCardDues = 0;
  let loans = 0;
  const allDebts = [...(p1?.debts || []), ...(p2?.debts || [])];
  allDebts.forEach((d) => {
    loans += Number(d.outstanding || 0);
  });
  const allManualLiab = [...(p1?.liabilities || []), ...(p2?.liabilities || [])].filter((l) => !l.auto);
  allManualLiab.forEach((l) => {
    const val = Number(l.value || 0);
    if ((l.type || "").toLowerCase() === "credit_card") creditCardDues += val;
    else loans += val;
  });

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    cashBank,
    equity,
    debt,
    gold: gold + otherAssets,
    creditCardDues,
    loans,
  };
}

// ── Tab 1: Monthly_Summary (Executive Rollup) ──────────────────────────────────
export function toMonthlySummaryRows(p1, p2, shared, personNames = { p1: "Person 1", p2: "Person 2" }) {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const livePortfolio = derivePortfolioBreakdown(p1, p2, now);
  const totalSips = calculateTotalMonthlySips(p1, p2);

  // Gather unique months across netWorthHistory, expenses, and default trailing 6 months
  const monthSet = new Set();
  monthSet.add(curYm);

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  (shared?.netWorthHistory || []).forEach((h) => {
    if (h && h.date && h.date !== "—") monthSet.add(h.date.slice(0, 7));
  });

  [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
    if (e.date) monthSet.add(e.date.slice(0, 7));
    (e.entries || []).forEach((ent) => {
      if (ent.date) monthSet.add(ent.date.slice(0, 7));
    });
  });

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

    // Incomes
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

    // Expenses
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

    // Net worth for month: use snapshot if valid, otherwise use live calculated portfolio
    const nwEntry = (shared?.netWorthHistory || []).find((h) => h && h.date && h.date.slice(0, 7) === ym);
    const nextNwEntry = sortedMonths[idx + 1]
      ? (shared?.netWorthHistory || []).find(
          (h) => h && h.date && h.date.slice(0, 7) === sortedMonths[idx + 1],
        )
      : null;

    let assets = nwEntry && Number(nwEntry.assets || 0) > 0 ? Number(nwEntry.assets) : livePortfolio.totalAssets;
    let liabilities = nwEntry && Number(nwEntry.liabilities || 0) >= 0 ? Number(nwEntry.liabilities) : livePortfolio.totalLiabilities;
    let netWorth = assets - liabilities;

    let prevNetWorth = nextNwEntry && Number(nextNwEntry.assets || 0) > 0
      ? Number(nextNwEntry.assets) - Number(nextNwEntry.liabilities || 0)
      : null;
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

// ── Tab 3: Budget_vs_Actual (Category Matrix across all months) ────────────────
export function toBudgetVsActualRows(p1, p2, shared) {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthSet = new Set();
  monthSet.add(curYm);
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  [...(p1?.expenses || []), ...(p2?.expenses || [])].forEach((e) => {
    if (e.date) monthSet.add(e.date.slice(0, 7));
    (e.entries || []).forEach((ent) => {
      if (ent.date) monthSet.add(ent.date.slice(0, 7));
    });
  });

  const monthsToEvaluate = Array.from(monthSet).filter(Boolean).sort((a, b) => b.localeCompare(a));
  const rows = [];

  monthsToEvaluate.forEach((ym) => {
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
      if (budgeted === 0 && actual > 0) {
        status = "⚠️ Unbudgeted Spend";
      } else if (actual > budgeted && budgeted > 0) {
        status = "🔴 Over Budget";
      } else if (utilization >= 90) {
        status = "🟡 Near Limit (90%+)";
      }

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

  const processInvestments = (investments, owner) => {
    (investments || []).forEach((inv) => {
      const row = computeInvRow(inv);
      const corpus = row.cur > 0 ? Math.round(row.cur) : Math.round(getInvested(inv) || Number(inv.amount || 0));
      const sip = isFD(inv.type) || inv.frequency === "onetime"
        ? 0
        : Math.round(freqToMonthly(Number(inv.amount || inv.sipMonthly || 0), inv.frequency || "monthly"));

      let assetClass = "Equity";
      const typeLower = (inv.type || "").toLowerCase();
      const nameLower = (inv.name || "").toLowerCase();

      if (typeLower.includes("debt") || typeLower.includes("ppf") || typeLower.includes("fd") || nameLower.includes("fixed deposit") || nameLower.includes("mod")) {
        assetClass = "Debt / Fixed Income";
      } else if (typeLower.includes("gold") || nameLower.includes("gold") || nameLower.includes("sgb")) {
        assetClass = "Gold";
      } else if (typeLower.includes("real estate") || typeLower.includes("reit")) {
        assetClass = "Real Estate";
      } else if (typeLower.includes("cash") || typeLower.includes("liquid")) {
        assetClass = "Liquid Cash";
      }

      rows.push({
        owner,
        assetName: inv.name || "Investment",
        assetClass,
        monthlySip: sip,
        currentCorpus: corpus,
        allocationPct: 0, // computed below
        targetAllocationPct: Number(inv.targetAlloc) || 0,
        platform: inv.app || inv.broker || inv.platform || "—",
        startDate: inv.startDate || "—",
      });
    });
  };

  processInvestments(p1?.investments, personNames.p1 || "Person 1");
  processInvestments(p2?.investments, personNames.p2 || "Person 2");

  // Include savings accounts as Liquid Cash
  const processSavings = (accounts, owner) => {
    (accounts || []).forEach((acc) => {
      const bal = Math.round(Number(acc.balance || 0));
      if (bal > 0) {
        rows.push({
          owner,
          assetName: `${acc.bankName || "Bank"} Savings Account`,
          assetClass: "Liquid Cash",
          monthlySip: 0,
          currentCorpus: bal,
          allocationPct: 0,
          targetAllocationPct: 0,
          platform: acc.bankName || "Bank",
          startDate: "—",
        });
      }
    });
  };

  processSavings(p1?.savingsAccounts, personNames.p1 || "Person 1");
  processSavings(p2?.savingsAccounts, personNames.p2 || "Person 2");

  // Include manual assets
  const processManualAssets = (assets, owner) => {
    (assets || []).filter((a) => !a.auto).forEach((a) => {
      const val = Math.round(Number(a.value || 0));
      if (val > 0) {
        let assetClass = "Other Assets";
        const t = (a.type || "").toLowerCase();
        if (t === "gold_physical") assetClass = "Gold";
        else if (t === "cash") assetClass = "Liquid Cash";
        else if (t === "property") assetClass = "Real Estate";

        rows.push({
          owner,
          assetName: a.name || "Asset",
          assetClass,
          monthlySip: 0,
          currentCorpus: val,
          allocationPct: 0,
          targetAllocationPct: 0,
          platform: "Direct Ownership",
          startDate: "—",
        });
      }
    });
  };

  processManualAssets(p1?.assets, personNames.p1 || "Person 1");
  processManualAssets(p2?.assets, personNames.p2 || "Person 2");

  const totalCorpus = rows.reduce((s, r) => s + r.currentCorpus, 0);
  rows.forEach((r) => {
    r.allocationPct = totalCorpus > 0 ? Math.round((r.currentCorpus / totalCorpus) * 100) : 0;
    if (r.targetAllocationPct === 0) r.targetAllocationPct = r.allocationPct;
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

    let monthlyNeeded = 0;
    if (g.deadline && remaining > 0) {
      const d = new Date(g.deadline);
      const now = new Date();
      const monthsLeft = Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
      monthlyNeeded = Math.round(remaining / monthsLeft);
    }

    let status = "In Progress";
    if (progress >= 100) status = "Completed 🎉";
    else if (progress >= 75) status = "On Track (75%+)";
    else if (progress < 25) status = "Needs Attention";

    return {
      goalName: g.name || "Goal",
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
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const livePortfolio = derivePortfolioBreakdown(p1, p2, now);

  // Filter valid snapshots that have non-empty date
  const validHistory = (shared?.netWorthHistory || [])
    .filter((h) => h && h.date && h.date !== "—" && Number(h.assets || 0) > 0)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Build full chronological list
  const historyMap = new Map();

  // 1. Add recorded historical snapshots first (if valid assets > 0)
  validHistory.forEach((h) => {
    const ym = (h.date || "").slice(0, 7);
    if (!historyMap.has(ym)) {
      historyMap.set(ym, h);
    }
  });

  // 2. If current month is not in snapshots, add live calculated portfolio
  if (!historyMap.has(curYm)) {
    historyMap.set(curYm, {
      date: curYm,
      cash: livePortfolio.cashBank,
      equity: livePortfolio.equity,
      debt: livePortfolio.debt,
      gold: livePortfolio.gold,
      assets: livePortfolio.totalAssets,
      creditCard: livePortfolio.creditCardDues,
      loans: livePortfolio.loans,
      liabilities: livePortfolio.totalLiabilities,
    });
  }

  // 3. Backfill trailing 5 months if no snapshots existed
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!historyMap.has(ym)) {
      // Approximate historical asset values scaled slightly by elapsed months
      const scale = Math.max(0.7, 1 - i * 0.015);
      historyMap.set(ym, {
        date: ym,
        cash: Math.round(livePortfolio.cashBank * scale),
        equity: Math.round(livePortfolio.equity * scale),
        debt: Math.round(livePortfolio.debt * scale),
        gold: Math.round(livePortfolio.gold * scale),
        assets: Math.round(livePortfolio.totalAssets * scale),
        creditCard: Math.round(livePortfolio.creditCardDues),
        loans: Math.round(livePortfolio.loans),
        liabilities: Math.round(livePortfolio.totalLiabilities),
      });
    }
  }

  const sortedList = Array.from(historyMap.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return sortedList.map((h, i) => {
    const assets = Number(h.assets || 0);
    const liabilities = Number(h.liabilities || 0);
    const netWorth = assets - liabilities;
    const prev = sortedList[i + 1];
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
      category: "Sheets Canvas Mini-App",
      useCase: "Household Financial Command Center",
      promptOrFormula: 'Ask Gemini in Sheets: "Create an interactive Sheets Canvas dashboard from Monthly_Summary and Net_Worth_History with KPI cards for Net Worth, Savings Rate, Active SIPs, and a monthly trend chart."',
      targetRange: "Monthly_Summary & Net_Worth_History",
      expectedOutput: "Interactive visual mini-app with real-time KPI cards and trend charts.",
    },
    {
      category: "Sheets Canvas Mini-App",
      useCase: "Goal Funding Progress Dashboard",
      promptOrFormula: 'Ask Gemini in Sheets: "Create a Sheets Canvas dashboard from Goals_Tracker displaying visual progress bars, partner contribution splits (P1 vs P2), and target countdowns."',
      targetRange: "Goals_Tracker!A1:J10",
      expectedOutput: "Interactive goal cards with progress meters and funding status.",
    },
    {
      category: "Sheets Canvas Mini-App",
      useCase: "Budget & 50/30/20 Visual Optimizer",
      promptOrFormula: 'Ask Gemini in Sheets: "Create a Sheets Canvas mini-app from Budget_vs_Actual that visualizes our 50/30/20 breakdown with interactive category cards highlighting Over Budget areas in red."',
      targetRange: "Budget_vs_Actual!A1:I30",
      expectedOutput: "Visual category cards with utilization gauges and overspending alerts.",
    },
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
      useCase: "Generate Expense Breakdown Summary",
      promptOrFormula: '=AI("Write a one-sentence summary of the highest spending driver in this month", D2:H2)',
      targetRange: "Monthly_Summary!U2",
      expectedOutput: "Concise plain-text diagnostic summary.",
    },
  ];
}
