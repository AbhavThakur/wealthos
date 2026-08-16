import {
  fmt,
  fmtCr,
  isFD,
  freqToMonthly,
  expAmount,
  onetimeMatchesMonth,
} from "./finance.js";
import { getInvestmentCurrentValue } from "./goalFunding.js";

/**
 * Recurrence gating helper matching Budget.jsx
 */
export function isRecurrenceActiveForMonth(exp, monthIndex) {
  if (exp.recurrence === "yearly" && (exp.recurrenceMonth ?? 0) !== monthIndex) {
    return false;
  }
  if (exp.recurrence === "quarterly") {
    const months = exp.recurrenceMonths || [0, 3, 6, 9];
    if (!months.includes(monthIndex)) return false;
  }
  return true;
}

/**
 * Canonical Household Monthly Financials Calculator.
 *
 * Compares Monthly Inflow (Combined Income) vs Monthly Outflow (Expenses + Subscriptions + Trips)
 * to compute true month-by-month cashflow surplus, savings rate, and budget health.
 */
export function calculateHouseholdMonthFinancials({
  p1,
  p2,
  shared,
  monthYm,
  personNames = { p1: "Person 1", p2: "Person 2" },
}) {
  const ym = monthYm || new Date().toISOString().slice(0, 7);
  const monthNum = parseInt(ym.split("-")[1], 10) - 1;

  const incomeItems = [];
  const expenseItems = [];

  // Helper to process a person's income and expenses for month `ym`
  const processPerson = (personData, personKey, personLabel) => {
    // 1. Incomes for this month
    for (const inc of personData?.incomes || []) {
      let amt = Number(inc.amount || 0);
      // Check for month-specific variable entries (bonus, freelance, etc.)
      if (inc.incomeEntries) {
        for (const e of inc.incomeEntries) {
          if (e.date && e.date.slice(0, 7) === ym) {
            amt += Number(e.amount || 0);
          }
        }
      }
      if (amt > 0) {
        incomeItems.push({
          name: inc.name || "Income",
          category: inc.type || "Salary",
          amount: amt,
          person: personLabel,
        });
      }
    }

    // 2. Expenses for this month
    for (const exp of personData?.expenses || []) {
      const isOnetime = exp.expenseType === "onetime";
      const isTrip = exp.expenseType === "trip";

      if (isOnetime) {
        if (onetimeMatchesMonth(exp, ym)) {
          const amt = expAmount(exp, ym);
          if (amt > 0) {
            expenseItems.push({
              name: exp.name || "One-time Expense",
              category: exp.category || "One-time",
              amount: amt,
              type: "One-time",
              person: personLabel,
            });
          }
        }
      } else if (isTrip) {
        const tripDate = (exp.startDate || exp.date || "").slice(0, 7);
        if (tripDate === ym) {
          const amt = Number(exp.amount || 0);
          if (amt > 0) {
            expenseItems.push({
              name: exp.name || "Trip",
              category: "Travel",
              amount: amt,
              type: "Trip",
              person: personLabel,
            });
          }
        }
      } else {
        // Recurring expense: Check recurrence gating and resolve amountHistory for past months
        if (isRecurrenceActiveForMonth(exp, monthNum)) {
          const amt = expAmount(exp, ym);
          if (amt > 0) {
            expenseItems.push({
              name: exp.name || "Recurring Expense",
              category: exp.category || "Living",
              amount: amt,
              type: exp.recurrence || "Monthly",
              person: personLabel,
            });
          }
        }
      }
    }

    // 3. Subscriptions (Fixed monthly debits)
    for (const sub of personData?.subscriptions || []) {
      if (sub.active !== false) {
        const monthlyAmt = freqToMonthly(Number(sub.amount || 0), sub.frequency || "monthly");
        if (monthlyAmt > 0) {
          expenseItems.push({
            name: sub.name || "Subscription",
            category: "Subscriptions",
            amount: monthlyAmt,
            type: sub.frequency || "Monthly",
            person: personLabel,
          });
        }
      }
    }
  };

  processPerson(p1, "p1", personNames.p1 || "Person 1");
  processPerson(p2, "p2", personNames.p2 || "Person 2");

  // 4. Shared trips
  for (const trip of shared?.trips || []) {
    if ((trip.startDate || "").slice(0, 7) === ym) {
      const amt = Number(trip.amount || 0);
      if (amt > 0) {
        expenseItems.push({
          name: trip.name || "Shared Trip",
          category: "Travel",
          amount: amt,
          type: "Shared Trip",
          person: "Household",
        });
      }
    }
  }

  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);

  const monthlySurplus = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round((Math.max(0, monthlySurplus) / totalIncome) * 100) : 0;
  const expenseRatio =
    totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  const isBudgetHealthy = monthlySurplus >= 0;

  // Determine intelligent status title and action text
  let statusTone = "positive";
  let statusTitle = "Budget On-Track";
  let nextActionText = `You are saving ${savingsRate}% of household income with ${fmt(monthlySurplus)} surplus remaining.`;

  if (totalIncome === 0 && totalExpenses > 0) {
    statusTone = "warning";
    statusTitle = "Expenses Logged (No Income Added)";
    nextActionText = `Total expenses are ${fmt(totalExpenses)}. Add income sources in Settings/Budget to track savings rate.`;
  } else if (monthlySurplus < 0) {
    statusTone = "warning";
    statusTitle = "Deficit Alert: High Spend Month";
    nextActionText = `Expenses (${fmt(totalExpenses)}) exceeded income (${fmt(totalIncome)}) by ${fmt(Math.abs(monthlySurplus))}. Review one-time expenses.`;
  } else if (savingsRate >= 50) {
    statusTone = "positive";
    statusTitle = "Outstanding Savings Rate!";
    nextActionText = `Superb cashflow discipline! You are saving ${savingsRate}% of income (+${fmt(monthlySurplus)} surplus saved).`;
  } else if (savingsRate >= 20) {
    statusTone = "positive";
    statusTitle = "Healthy Savings Rate";
    nextActionText = `Strong cashflow: Saving ${savingsRate}% of income with ${fmt(monthlySurplus)} surplus for investments.`;
  } else {
    statusTone = "opportunity";
    statusTitle = "Tight Cashflow Month";
    nextActionText = `Expenses took ${expenseRatio}% of income, leaving ${fmt(monthlySurplus)} (${savingsRate}%) surplus.`;
  }

  return {
    ym,
    totalIncome,
    totalExpenses,
    monthlySurplus,
    savingsRate,
    expenseRatio,
    isBudgetHealthy,
    statusTone,
    statusTitle,
    nextActionText,
    incomeItems,
    expenseItems,
    // Alias fields for backwards-compatibility
    thisMonthSpent: totalExpenses,
    totalAllocatedBudget: totalIncome > 0 ? totalIncome : totalExpenses,
    budgetPct: expenseRatio,
    projectedSurplus: Math.max(0, monthlySurplus),
    budgetItems: incomeItems,
    spentItems: expenseItems,
  };
}

/**
 * Canonical 3-Tier Wealth Breakdown Calculator.
 *
 * Captures all savings accounts, bank balances, emergency cash, MFs, and safe deposits.
 */
export function calculateThreeTierWealth({
  p1,
  p2,
  shared,
  personNames = { p1: "Person 1", p2: "Person 2" },
}) {
  const liquidItems = [];
  const growersItems = [];
  const safeItems = [];

  const addLiquid = (name, amount, source, person) => {
    const val = Number(amount || 0);
    if (val > 0) {
      liquidItems.push({ name, amount: val, source, person });
    }
  };

  const processPerson = (data, personLabel) => {
    // 1. Savings Bank Accounts (Core liquid cash)
    for (const acc of data?.savingsAccounts || []) {
      addLiquid(
        acc.bankName ? `${acc.bankName} Savings` : acc.name || "Savings Bank Account",
        acc.balance,
        "Bank Account",
        personLabel,
      );
    }

    // 2. Manual Cash / Liquid Assets
    for (const asset of data?.assets || []) {
      const type = (asset.type || "").toLowerCase();
      const val = Number(asset.value || 0);
      if (type.includes("cash") || type.includes("bank") || type.includes("savings")) {
        addLiquid(asset.name || "Cash Asset", val, "Liquid Asset", personLabel);
      }
    }

    // 3. Investments (Categorized into Growers vs Safe vs Liquid)
    for (const inv of data?.investments || []) {
      const val = getInvestmentCurrentValue(inv);
      if (val <= 0) continue;
      const type = (inv.type || "").toUpperCase();

      if (
        type.includes("SAVINGS") ||
        type.includes("LIQUID") ||
        type.includes("OVERNIGHT") ||
        type.includes("EMERGENCY") ||
        type.includes("CASH")
      ) {
        liquidItems.push({
          name: inv.name || "Liquid / Savings Fund",
          amount: val,
          source: inv.type || "Liquid Fund",
          person: personLabel,
        });
      } else if (
        type.includes("MUTUAL") ||
        type.includes("STOCK") ||
        type.includes("EQUITY") ||
        type.includes("MF")
      ) {
        growersItems.push({
          name: inv.name || "Equity / Mutual Fund",
          amount: val,
          source: inv.type || "Mutual Fund",
          returnPct: inv.returnPct || 12,
          person: personLabel,
        });
      } else if (
        isFD(inv.type) ||
        type.includes("PPF") ||
        type.includes("EPF") ||
        type.includes("GOLD") ||
        type.includes("BOND") ||
        type.includes("NPS") ||
        type.includes("RD")
      ) {
        safeItems.push({
          name: inv.name || "Guaranteed Deposit",
          amount: val,
          source: inv.type || "FD",
          returnPct: inv.returnPct || 7,
          person: personLabel,
        });
      } else {
        if (Number(inv.returnPct || 0) >= 10) {
          growersItems.push({
            name: inv.name,
            amount: val,
            source: inv.type || "Other Asset",
            person: personLabel,
          });
        } else {
          safeItems.push({
            name: inv.name,
            amount: val,
            source: inv.type || "Other Asset",
            person: personLabel,
          });
        }
      }
    }

    // 4. Goals Cash
    for (const g of data?.goals || []) {
      const saved = Number(g.saved || 0);
      if (saved > 0) {
        addLiquid(`${g.name} (Goal Cash)`, saved, "Goal Savings", personLabel);
      }
    }
  };

  processPerson(p1, personNames.p1 || "Person 1");
  processPerson(p2, personNames.p2 || "Person 2");

  // Shared savings & goals
  for (const acc of shared?.savingsAccounts || []) {
    addLiquid(
      acc.bankName ? `${acc.bankName} Joint Savings` : acc.name || "Joint Savings Account",
      acc.balance,
      "Joint Bank Account",
      "Household",
    );
  }
  for (const g of shared?.goals || []) {
    const saved =
      g.saved !== undefined
        ? Number(g.saved || 0)
        : Number(g.p1Saved || 0) + Number(g.p2Saved || 0);
    if (saved > 0) {
      addLiquid(`${g.name} (Shared Goal Cash)`, saved, "Goal Savings", "Household");
    }
  }

  const liquidCash = liquidItems.reduce((s, i) => s + i.amount, 0);
  const wealthGrowers = growersItems.reduce((s, i) => s + i.amount, 0);
  const guaranteedSafe = safeItems.reduce((s, i) => s + i.amount, 0);
  const total = liquidCash + wealthGrowers + guaranteedSafe;

  const liquidPct = total > 0 ? Math.round((liquidCash / total) * 100) : 0;
  const growersPct = total > 0 ? Math.round((wealthGrowers / total) * 100) : 0;
  const safePct = total > 0 ? Math.max(0, 100 - liquidPct - growersPct) : 0;

  return {
    total,
    liquidCash,
    liquidPct,
    liquidItems,
    wealthGrowers,
    growersPct,
    growersItems,
    guaranteedSafe,
    safePct,
    safeItems,
  };
}

/**
 * Automated Data Integrity & Consistency Inspector
 */
export function inspectDataIntegrity({ p1, p2, shared }) {
  const anomalies = [];

  const checkPerson = (data, name) => {
    // Check for negative balances
    for (const acc of data?.savingsAccounts || []) {
      if (Number(acc.balance) < 0) {
        anomalies.push({
          level: "warning",
          message: `${name}: Savings account "${acc.bankName || acc.name || "Account"}" has a negative balance (${fmt(acc.balance)})`,
        });
      }
    }
    // Check for negative expenses
    for (const exp of data?.expenses || []) {
      if (Number(exp.amount) < 0) {
        anomalies.push({
          level: "error",
          message: `${name}: Expense "${exp.name}" has a negative amount (${fmt(exp.amount)})`,
        });
      }
    }
  };

  checkPerson(p1, "Person 1");
  checkPerson(p2, "Person 2");
  checkPerson(shared, "Household");

  return {
    isHealthy: anomalies.length === 0,
    anomalies,
  };
}

/**
 * Full Workspace Financial Audit Report Generator
 */
export function auditWorkspaceData({ p1, p2, shared, monthYm, personNames }) {
  const ym = monthYm || new Date().toISOString().slice(0, 7);
  const financials = calculateHouseholdMonthFinancials({ p1, p2, shared, monthYm: ym, personNames });
  const wealth = calculateThreeTierWealth({ p1, p2, shared, personNames });
  const integrity = inspectDataIntegrity({ p1, p2, shared });

  return {
    monthYm: ym,
    financials,
    wealth,
    integrity,
    summary: {
      totalIncome: fmt(financials.totalIncome),
      totalExpenses: fmt(financials.totalExpenses),
      monthlySurplus: fmt(financials.monthlySurplus),
      savingsRate: `${financials.savingsRate}%`,
      liquidCash: fmt(wealth.liquidCash),
      wealthGrowers: fmt(wealth.wealthGrowers),
      guaranteedSafe: fmt(wealth.guaranteedSafe),
      totalNetWorth: fmtCr(wealth.total),
    },
  };
}
