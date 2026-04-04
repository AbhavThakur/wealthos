export function autoRecurringRules(data) {
  const rules = [];
  let id = -1; // negative IDs to avoid clashing with manual rules

  // Income rules
  for (const inc of data.incomes || []) {
    rules.push({
      id: id--,
      desc: inc.name,
      amount: inc.amount,
      type: "income",
      category: "Salary",
      dayOfMonth: 1,
      active: true,
      auto: true,
      sourceType: "income",
    });
  }

  // Expense rules
  for (const exp of data.expenses || []) {
    if (exp.expenseType === "trip" || exp.expenseType === "onetime") continue;
    const recurrence =
      exp.recurrence || (exp.expenseType === "onetime" ? "once" : "monthly");
    rules.push({
      id: id--,
      desc: exp.name,
      amount: -Math.abs(exp.amount),
      type: "expense",
      category: exp.category || "Others",
      dayOfMonth: exp.date ? parseInt(exp.date.slice(8, 10), 10) : 1,
      active: true,
      auto: true,
      sourceType: "expense",
      recurrence,
      recurrenceMonth: exp.recurrenceMonth ?? null,
      recurrenceMonths: exp.recurrenceMonths ?? null,
    });
  }

  // SIP investment rules (skip FD, lump-sum, one-time, and paused)
  for (const inv of data.investments || []) {
    if (inv.type === "FD" || inv.frequency === "onetime" || inv.paused)
      continue;
    const rule = {
      id: id--,
      desc: inv.name,
      amount: -Math.abs(inv.amount),
      type: "investment",
      category: "Investment",
      dayOfMonth: inv.deductionDate || 15,
      frequency: inv.frequency || "monthly",
      startDate: inv.startDate || null,
      active: true,
      auto: true,
      sourceType: "investment",
    };
    // For yearly investments, include the deduction month
    if (inv.frequency === "yearly") {
      rule.recurrenceMonth = inv.deductionMonth ?? 0;
    }
    rules.push(rule);
  }

  // Debt EMI rules
  for (const debt of data.debts || []) {
    rules.push({
      id: id--,
      desc: debt.name + " EMI",
      amount: -Math.abs(debt.emi),
      type: "expense",
      category: "EMI",
      dayOfMonth: 5,
      active: true,
      auto: true,
      sourceType: "debt",
    });
  }

  // Subscription rules (active subs auto-generate monthly debit transactions)
  for (const sub of data.subscriptions || []) {
    if (sub.active === false) continue;
    const freq = sub.frequency || "monthly";
    if (freq === "onetime") continue;
    rules.push({
      id: id--,
      desc: sub.name,
      amount: -Math.abs(sub.amount),
      type: "expense",
      category: sub.category || "Subscription",
      dayOfMonth: sub.startDate ? parseInt(sub.startDate.slice(8, 10), 10) : 1,
      active: true,
      auto: true,
      sourceType: "subscription",
      recurrence:
        freq === "yearly"
          ? "yearly"
          : freq === "quarterly"
            ? "quarterly"
            : "monthly",
    });
  }

  return rules;
}
