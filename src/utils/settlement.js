import { fmt, expAmount, onetimeMatchesMonth } from "./finance";

/**
 * Split Modes:
 * - "50:50": Equal 50% split between P1 and P2
 * - "60:40": P1 pays 60%, P2 pays 40% (or vice versa)
 * - "70:30": P1 pays 70%, P2 pays 30%
 * - "income_ratio": Split proportional to net monthly income
 * - "custom": Custom percentage specified by p1SharePct / p2SharePct
 * - "full": 100% assigned to one person
 */

/**
 * Calculates the percentage share for Person 1 given split settings.
 * Returns a number between 0 and 1 (e.g. 0.5 for 50%).
 */
export function getP1ShareRatio(expense, p1Income = 0, p2Income = 0) {
  if (!expense || !expense.isSplit) {
    // If not explicitly marked as split:
    // By default, household shared trips or expenses can be 50:50 if marked
    return 1.0;
  }

  const mode = expense.splitMode || "50:50";

  switch (mode) {
    case "50:50":
      return 0.5;
    case "60:40":
      return 0.6;
    case "40:60":
      return 0.4;
    case "70:30":
      return 0.7;
    case "30:70":
      return 0.3;
    case "income_ratio": {
      const totalIncome = (p1Income || 0) + (p2Income || 0);
      if (totalIncome <= 0) return 0.5;
      return (p1Income || 0) / totalIncome;
    }
    case "custom": {
      const p1Pct = Number(expense.p1SharePct);
      if (!isNaN(p1Pct) && p1Pct >= 0 && p1Pct <= 100) {
        return p1Pct / 100;
      }
      return 0.5;
    }
    case "full_p1":
      return 1.0;
    case "full_p2":
      return 0.0;
    default:
      return 0.5;
  }
}

/**
 * Extract all split expenses across P1, P2, and shared trips for a given month.
 * If month is null/empty, extracts all.
 */
export function getSharedExpenses(p1, p2, shared, month = null) {
  const list = [];
  const p1Income = (p1?.incomes || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const p2Income = (p2?.incomes || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const monthNum = month ? parseInt(month.split("-")[1], 10) - 1 : null;

  const isActiveForMonth = (e) => {
    if (!month) return true;
    if (e.expenseType === "onetime") return onetimeMatchesMonth(e, month);
    if (e.expenseType === "trip") return (e.startDate || e.date || "").slice(0, 7) === month;
    if (e.recurrence === "yearly" && monthNum !== null && (e.recurrenceMonth ?? 0) !== monthNum)
      return false;
    if (e.recurrence === "quarterly" && monthNum !== null) {
      const months = e.recurrenceMonths || [0, 3, 6, 9];
      if (!months.includes(monthNum)) return false;
    }
    return true;
  };

  // Helper to process an expense list
  const processPersonExpenses = (expenses, defaultPayer) => {
    for (const exp of expenses || []) {
      const isSplit = Boolean(exp.isSplit || exp.splitWithPartner || exp.isShared || exp.splitRatio !== undefined);
      if (!isSplit) continue;
      if (!isActiveForMonth(exp)) continue;

      const amt = month ? expAmount(exp, month) : Number(exp.amount) || 0;
      if (amt <= 0) continue;

      const paidBy = exp.paidBy || defaultPayer;
      const p1Ratio = getP1ShareRatio(exp, p1Income, p2Income);
      const p2Ratio = 1 - p1Ratio;

      const p1Obligation = Math.round(amt * p1Ratio);
      const p2Obligation = amt - p1Obligation;

      list.push({
        id: exp.id,
        name: exp.name || "Shared Expense",
        category: exp.category || "Others",
        amount: amt,
        paidBy, // "p1" or "p2"
        splitMode: exp.splitMode || "50:50",
        p1Ratio,
        p2Ratio,
        p1Obligation,
        p2Obligation,
        date: exp.date || (month ? `${month}-01` : new Date().toISOString().slice(0, 10)),
        source: "expense",
      });
    }
  };

  processPersonExpenses(p1?.expenses, "p1");
  processPersonExpenses(p2?.expenses, "p2");

  // Also include shared trips if any
  for (const trip of shared?.trips || []) {
    if (month && (trip.startDate || "").slice(0, 7) !== month) continue;
    for (const item of trip.items || []) {
      const amt = Number(item.amount) || 0;
      if (amt <= 0) continue;
      const paidBy = (item.addedBy || "").toLowerCase().includes("p2") ? "p2" : "p1";
      const p1Ratio = 0.5;
      const p1Obligation = Math.round(amt * p1Ratio);
      const p2Obligation = amt - p1Obligation;

      list.push({
        id: `trip_${trip.id}_${item.id || item.name}`,
        name: `${trip.name}: ${item.name || item.category || "Trip item"}`,
        category: item.category || "Trip",
        amount: amt,
        paidBy,
        splitMode: "50:50",
        p1Ratio: 0.5,
        p2Ratio: 0.5,
        p1Obligation,
        p2Obligation,
        date: trip.startDate || (month ? `${month}-01` : new Date().toISOString().slice(0, 10)),
        source: "trip",
      });
    }
  }

  return list;
}

/**
 * Calculates net settlement for a specific month (or all-time).
 * Takes into account shared expenses and past recorded settlements.
 */
export function calculateSettlement(p1, p2, shared, month = null) {
  const expenses = getSharedExpenses(p1, p2, shared, month);

  let p1PaidTotal = 0;
  let p2PaidTotal = 0;
  let p1ObligationTotal = 0;
  let p2ObligationTotal = 0;

  for (const exp of expenses) {
    if (exp.paidBy === "p1") {
      p1PaidTotal += exp.amount;
    } else {
      p2PaidTotal += exp.amount;
    }
    p1ObligationTotal += exp.p1Obligation;
    p2ObligationTotal += exp.p2Obligation;
  }

  // Net balance from expenses:
  // P1 Net = P1 Total Paid - P1 Total Obligation
  // If positive, P1 paid more than their share => P2 owes P1
  // If negative, P2 paid more than their share => P1 owes P2
  const grossBalance = p1PaidTotal - p1ObligationTotal;

  // Filter settlements for this month (or all)
  const allSettlements = shared?.settlements || [];
  const monthSettlements = allSettlements.filter((s) => {
    if (!month) return true;
    return (s.date || s.month || "").slice(0, 7) === month;
  });

  // Apply settlements:
  // If P2 paid P1 ₹X (from="p2", to="p1"), it reduces P1's positive balance (grossBalance - X)
  // If P1 paid P2 ₹X (from="p1", to="p2"), it increases P1's balance (grossBalance + X)
  let settlementEffect = 0;
  for (const s of monthSettlements) {
    const amt = Number(s.amount) || 0;
    if (s.from === "p2" && s.to === "p1") {
      settlementEffect -= amt;
    } else if (s.from === "p1" && s.to === "p2") {
      settlementEffect += amt;
    }
  }

  const netBalance = grossBalance + settlementEffect;

  let debtor = null;
  let creditor = null;
  let amountOwed = 0;

  if (netBalance > 0) {
    debtor = "p2";
    creditor = "p1";
    amountOwed = Math.round(netBalance);
  } else if (netBalance < 0) {
    debtor = "p1";
    creditor = "p2";
    amountOwed = Math.round(Math.abs(netBalance));
  }

  return {
    month,
    expenses,
    settlements: monthSettlements,
    p1PaidTotal,
    p2PaidTotal,
    p1ObligationTotal,
    p2ObligationTotal,
    totalSharedAmount: p1PaidTotal + p2PaidTotal,
    grossBalance,
    settlementEffect,
    netBalance,
    debtor, // "p1" | "p2" | null
    creditor, // "p1" | "p2" | null
    amountOwed,
    isSettled: amountOwed === 0,
  };
}

/**
 * Generates formatted text ready to copy & share on WhatsApp / iMessage.
 */
export function generateSettlementShareText(settlement, personNames = {}) {
  const p1Name = personNames.p1 || "Person 1";
  const p2Name = personNames.p2 || "Person 2";
  const monthLabel = settlement.month || "Current Month";

  if (!settlement || settlement.expenses.length === 0) {
    return `📊 WealthOS Settlement Summary (${monthLabel})\nNo shared expenses logged for this month.`;
  }

  let text = `📊 *WealthOS Household Settlement* (${monthLabel})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 Total Shared: ${fmt(settlement.totalSharedAmount)}\n`;
  text += `• ${p1Name} Paid: ${fmt(settlement.p1PaidTotal)} (Share: ${fmt(settlement.p1ObligationTotal)})\n`;
  text += `• ${p2Name} Paid: ${fmt(settlement.p2PaidTotal)} (Share: ${fmt(settlement.p2ObligationTotal)})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;

  if (settlement.isSettled) {
    text += `✅ *All settled up!* No outstanding balance.\n`;
  } else {
    const debtorName = settlement.debtor === "p1" ? p1Name : p2Name;
    const creditorName = settlement.creditor === "p1" ? p1Name : p2Name;
    text += `👉 *${debtorName}* owes *${creditorName}*: *${fmt(settlement.amountOwed)}*\n`;
  }

  if (settlement.expenses.length > 0) {
    text += `\n📋 *Shared Expenses (${settlement.expenses.length}):*\n`;
    for (const exp of settlement.expenses.slice(0, 10)) {
      const payer = exp.paidBy === "p1" ? p1Name : p2Name;
      text += `• ${exp.name}: ${fmt(exp.amount)} (Paid by ${payer})\n`;
    }
    if (settlement.expenses.length > 10) {
      text += `• ...and ${settlement.expenses.length - 10} more items\n`;
    }
  }

  text += `\n⚡ Tracked via WealthOS`;
  return text;
}
