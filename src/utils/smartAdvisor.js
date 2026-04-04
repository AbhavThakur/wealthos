/* ── WealthOS Smart Advisor — Local Rule Engine ──────────────────────────────
 *  Zero API calls. Runs entirely in the browser.
 *  Analyses real financial data and produces personalized insights.
 *  No rate limits, no API key, instant responses.
 */

import {
  fmt,
  fmtCr,
  totalCorpus,
  freqToMonthly,
  onetimeEffective,
} from "./finance";

// ── Helpers ──────────────────────────────────────────────────────────────────

const pct = (n) => Math.round(n) + "%";
const L = (n) => fmtCr(n);

function personData(d) {
  if (!d) return null;
  const income = (d.incomes || []).reduce((s, x) => s + (x.amount || 0), 0);
  const expenses = (d.expenses || [])
    .filter((e) => e.expenseType === "monthly")
    .reduce((s, x) => s + (x.amount || 0), 0);
  const sipTotal = (d.investments || []).reduce(
    (s, x) => s + freqToMonthly(x.amount || 0, x.frequency),
    0,
  );
  const debtEMI = (d.debts || []).reduce((s, x) => s + (x.emi || 0), 0);
  const surplus = income - expenses - sipTotal - debtEMI;
  const savingsRate = income
    ? ((sipTotal + Math.max(0, surplus)) / income) * 100
    : 0;

  const investmentsByType = {};
  for (const inv of d.investments || []) {
    const t = inv.type || "Other";
    investmentsByType[t] =
      (investmentsByType[t] || 0) +
      freqToMonthly(inv.amount || 0, inv.frequency);
  }

  const elss = (d.investments || [])
    .filter((i) => /elss/i.test(i.name) || /elss/i.test(i.type))
    .reduce((s, x) => s + freqToMonthly(x.amount || 0, x.frequency) * 12, 0);
  const ppf = (d.investments || [])
    .filter((i) => /ppf/i.test(i.type))
    .reduce((s, x) => s + freqToMonthly(x.amount || 0, x.frequency) * 12, 0);
  const insurancePremiums = (d.insurances || []).reduce(
    (s, x) => s + (x.premium || 0),
    0,
  );
  const sec80C = elss + ppf + insurancePremiums;

  const totalDebtOutstanding = (d.debts || []).reduce(
    (s, x) => s + (x.outstanding || x.principal || 0),
    0,
  );
  const debtToIncome = income ? (debtEMI / income) * 100 : 0;

  const lifeInsurance = (d.insurances || [])
    .filter((i) => /life|term/i.test(i.type))
    .reduce((s, x) => s + (x.cover || x.coverAmount || 0), 0);

  const equityAmt = (d.investments || [])
    .filter((i) => /mutual fund|stock|elss|equity/i.test(i.type || ""))
    .reduce((s, x) => s + freqToMonthly(x.amount || 0, x.frequency), 0);
  const equityPct = sipTotal > 0 ? (equityAmt / sipTotal) * 100 : 0;

  // Corpus projections
  const corpus20 = (d.investments || []).reduce((sum, inv) => {
    const m = freqToMonthly(inv.amount || 0, inv.frequency);
    return (
      sum + totalCorpus(inv.existingCorpus || 0, m, inv.returnPct || 10, 20)
    );
  }, 0);

  const corpus10 = (d.investments || []).reduce((sum, inv) => {
    const m = freqToMonthly(inv.amount || 0, inv.frequency);
    return (
      sum + totalCorpus(inv.existingCorpus || 0, m, inv.returnPct || 10, 10)
    );
  }, 0);

  return {
    income,
    expenses,
    sipTotal,
    debtEMI,
    surplus,
    savingsRate,
    investmentsByType,
    sec80C,
    elss,
    ppf,
    totalDebtOutstanding,
    debtToIncome,
    lifeInsurance,
    equityPct,
    corpus20,
    corpus10,
    investments: d.investments || [],
    debts: d.debts || [],
    goals: d.goals || [],
    insurances: d.insurances || [],
    incomes: d.incomes || [],
    expenses_: d.expenses || [],
    savingsAccounts: d.savingsAccounts || [],
    assets: d.assets || [],
    liabilities: d.liabilities || [],
    subscriptions: d.subscriptions || [],
    transactions: d.transactions || [],
    budgetAlerts: d.budgetAlerts || [],
    taxInfo: d.taxInfo || {},
    recurringRules: d.recurringRules || [],
    onetimeExpenses: (d.expenses || [])
      .filter((e) => e.expenseType !== "monthly")
      .sort((a, b) => onetimeEffective(b) - onetimeEffective(a)),
  };
}

// ── Insight generators — each returns { title, body, emoji } or null ────────

function savingsRateInsight(p, name) {
  if (!p || !p.income) return null;
  const r = p.savingsRate;
  if (r >= 40)
    return {
      emoji: "🔥",
      title: "Outstanding Savings Rate",
      body: `${name}, you're saving ${pct(r)} of your income — that's elite-level! At this pace, your 20-year corpus reaches ${L(p.corpus20)}. Keep this up.`,
    };
  if (r >= 25)
    return {
      emoji: "✅",
      title: "Healthy Savings Rate",
      body: `${name}, you're saving ${pct(r)} of your income — above the recommended 25%. Your 20-year projected corpus: ${L(p.corpus20)}.`,
    };
  if (r >= 15)
    return {
      emoji: "⚠️",
      title: "Savings Rate Needs Work",
      body: `${name}, your savings rate is ${pct(r)}. The target is 25%+. You need ${fmt(Math.round(p.income * 0.25 - p.sipTotal - Math.max(0, p.surplus)))}/mo more in SIPs to hit 25%.`,
    };
  return {
    emoji: "🚨",
    title: "Low Savings Rate Alert",
    body: `${name}, your savings rate is only ${pct(r)}. Start by reducing ${fmt(Math.round(p.expenses * 0.1))}/mo in expenses (10% cut) and moving that to SIPs.`,
  };
}

function debtHealthInsight(p, name) {
  if (!p || p.debtEMI === 0) return null;
  if (p.debtToIncome > 50)
    return {
      emoji: "🚨",
      title: "Debt Overload",
      body: `${name}, ${pct(p.debtToIncome)} of your income goes to EMIs (${fmt(p.debtEMI)}/mo). This is dangerously high — target under 30%. Focus on closing the highest-rate loan first.`,
    };
  if (p.debtToIncome > 30)
    return {
      emoji: "⚠️",
      title: "High Debt Ratio",
      body: `${name}, EMIs take ${pct(p.debtToIncome)} of income (${fmt(p.debtEMI)}/mo). Aim for under 30%. Consider prepaying the loan with the highest interest rate.`,
    };
  return {
    emoji: "✅",
    title: "Debt Under Control",
    body: `${name}, your EMIs are ${pct(p.debtToIncome)} of income (${fmt(p.debtEMI)}/mo) — well within safe limits. Keep going.`,
  };
}

function tax80CInsight(p, name) {
  if (!p || !p.income) return null;
  const unused = 150000 - p.sec80C;
  if (unused <= 10000) return null;
  return {
    emoji: "💰",
    title: "Save More Tax Under 80C",
    body: `${name}, you have ${fmt(unused)} unused 80C limit. Invest in ELSS (lock-in 3y, ~12% return) or increase PPF to save ~${fmt(Math.round(unused * 0.3))} in tax (30% slab).`,
  };
}

function insuranceInsight(p, name) {
  if (!p || !p.income) return null;
  const idealCover = p.income * 12 * 10; // 10x annual
  if (p.lifeInsurance >= idealCover) return null;
  const gap = idealCover - p.lifeInsurance;
  return {
    emoji: "🛡️",
    title: "Insurance Coverage Gap",
    body: `${name}, your life cover is ${L(p.lifeInsurance)} but the ideal is ${L(idealCover)} (10× annual income). Gap: ${L(gap)}. A term plan for ${L(gap)} would cost ~${fmt(Math.round((gap / 1000) * 8))}/yr.`,
  };
}

function emergencyFundInsight(p, name) {
  if (!p || !p.income) return null;
  const need = (p.expenses + p.debtEMI) * 6;
  const liquid = p.savingsAccounts.reduce((s, x) => s + (x.balance || 0), 0);
  if (liquid >= need) return null;
  const gap = need - liquid;
  return {
    emoji: "🏦",
    title: "Build Emergency Fund",
    body: `${name}, you need ${L(need)} (6 months expenses + EMIs) in liquid savings. Current liquid: ${L(liquid)}. Gap: ${L(gap)}. Park this in a liquid fund or savings account.`,
  };
}

function allocationInsight(p, name) {
  if (!p || p.sipTotal === 0) return null;
  if (p.equityPct > 80)
    return {
      emoji: "⚖️",
      title: "Portfolio Too Equity-Heavy",
      body: `${name}, ${pct(p.equityPct)} of your SIPs are in equity. Consider adding debt instruments (PPF, FD, debt funds) for stability. A 70-30 equity-debt split is ideal for most.`,
    };
  if (p.equityPct < 30 && p.equityPct > 0)
    return {
      emoji: "📈",
      title: "Low Equity Exposure",
      body: `${name}, only ${pct(p.equityPct)} of SIPs are in equity. For long-term wealth building, equity should be 60-70%. Consider adding an index fund SIP.`,
    };
  return null;
}

function sipStepUpInsight(p, name) {
  if (!p || p.sipTotal === 0 || !p.income) return null;
  const stepUp10 = p.sipTotal * 1.1;
  const extra = Math.round(stepUp10 - p.sipTotal);
  const boost20y =
    totalCorpus(0, stepUp10, 12, 20) - totalCorpus(0, p.sipTotal, 12, 20);
  return {
    emoji: "🚀",
    title: "SIP Step-Up Opportunity",
    body: `${name}, a 10% annual SIP increase (just ${fmt(extra)}/mo more) would add ${L(boost20y)} extra to your 20-year corpus. Consider stepping up SIPs every April.`,
  };
}

function goalProgressInsight(goals, sharedGoals) {
  const allGoals = [
    ...(goals || []).map((g) => ({
      name: g.name,
      target: g.target || 0,
      saved: (g.abhavSaved || 0) + (g.aanyaSaved || 0) + (g.saved || 0),
    })),
    ...(sharedGoals || []).map((g) => ({
      name: g.name,
      target: g.target || 0,
      saved: (g.abhavSaved || 0) + (g.aanyaSaved || 0),
    })),
  ];

  const lagging = allGoals.filter(
    (g) => g.target > 0 && g.saved / g.target < 0.5,
  );
  if (lagging.length === 0) return null;

  const worst = lagging.sort(
    (a, b) => a.saved / a.target - b.saved / b.target,
  )[0];
  const remaining = worst.target - worst.saved;
  return {
    emoji: "🎯",
    title: "Goal Needs Attention",
    body: `"${worst.name}" is only ${pct((worst.saved / worst.target) * 100)} funded (${L(worst.saved)} of ${L(worst.target)}). Gap: ${L(remaining)}. Consider starting a dedicated SIP for this goal.`,
  };
}

function surplusCashInsight(p, name) {
  if (!p || p.surplus <= 0) return null;
  if (p.surplus > 50000)
    return {
      emoji: "💸",
      title: "Idle Cash Detected",
      body: `${name}, you have ${fmt(p.surplus)}/mo in unused surplus after all expenses, SIPs & EMIs. Put this to work — start a new SIP, invest in mutual funds, or top up goals.`,
    };
  return null;
}

function topInvestmentInsight(p, name) {
  if (!p || p.investments.length === 0) return null;
  const top = [...p.investments]
    .sort(
      (a, b) =>
        freqToMonthly(b.amount || 0, b.frequency) -
        freqToMonthly(a.amount || 0, a.frequency),
    )
    .slice(0, 3);
  const lines = top
    .map(
      (i) =>
        `• ${i.name}: ${fmt(freqToMonthly(i.amount || 0, i.frequency))}/mo @ ${i.returnPct || 0}%`,
    )
    .join("\n");
  return {
    emoji: "📊",
    title: "Your Top Investments",
    body: `${name}, here are your largest SIPs:\n${lines}`,
  };
}

function householdCompareInsight(p1, p2, name1, name2) {
  if (!p1 || !p2 || !p1.income || !p2.income) return null;
  const total = p1.income + p2.income;
  const totalSIP = p1.sipTotal + p2.sipTotal;
  const hRate = total
    ? ((totalSIP + Math.max(0, p1.surplus) + Math.max(0, p2.surplus)) / total) *
      100
    : 0;
  return {
    emoji: "🏠",
    title: "Household Overview",
    body: `Combined income: ${fmt(total)}/mo\n${name1}: ${fmt(p1.sipTotal)} SIP, ${pct(p1.savingsRate)} savings\n${name2}: ${fmt(p2.sipTotal)} SIP, ${pct(p2.savingsRate)} savings\nHousehold savings rate: ${pct(hRate)}`,
  };
}

// ── Intent matching ─────────────────────────────────────────────────────────

const INTENTS = [
  {
    patterns: [
      /how.*(am i|doing|month|overall|summary|health)/i,
      /overview/i,
      /status/i,
    ],
    handler: "overview",
  },
  { patterns: [/sip|increase.*sip|step.?up/i], handler: "sip" },
  { patterns: [/goal|target|progress|lagging/i], handler: "goals" },
  { patterns: [/sav(e|ing)|enough/i, /savings?\s*rate/i], handler: "savings" },
  { patterns: [/tax|80c|elss|deduction/i], handler: "tax" },
  { patterns: [/debt|loan|emi|repay/i], handler: "debt" },
  { patterns: [/insur(ance|e)/i], handler: "insurance" },
  { patterns: [/emergency|liquid|rainy.?day/i], handler: "emergency" },
  {
    patterns: [/allocat|diversif|equity|debt.*ratio/i, /portfolio.*balance/i],
    handler: "allocation",
  },
  {
    patterns: [/invest|portfolio|top.*fund|top.*sip/i],
    handler: "investments",
  },
  { patterns: [/idle|surplus|extra.*cash|unused.*money/i], handler: "surplus" },
  { patterns: [/household|combined|family|both/i], handler: "household" },
  { patterns: [/reduce|cut|spend|expense|budget/i], handler: "expenses" },
  { patterns: [/retire|fire|financial.*independ/i], handler: "retirement" },
  {
    patterns: [
      /trip/i,
      /travel/i,
      /vacation/i,
      /holiday/i,
      /hyderabad|goa|mumbai|delhi|bangalore|chennai|kolkata|jaipur|kerala|manali|shimla|ooty|ladakh|kashmir|udaipur|varanasi|agra|pune|mysore|pondicherry|coorg|darjeeling|andaman|rishikesh|lonavala|mahabaleshwar|nainital|mussoorie|kodaikanal|munnar|alleppey|hampi/i,
    ],
    handler: "trip",
  },
  {
    patterns: [
      /subscri|ott|netflix|spotify|hotstar|prime|youtube|gym|magazine/i,
    ],
    handler: "subscriptions",
  },
  {
    patterns: [
      /how much.*(spend|spent|cost|paid|pay)/i,
      /spend.*on/i,
      /spent.*on/i,
      /cost.*of/i,
      /what.*spend/i,
    ],
    handler: "specific_expense",
  },
  {
    patterns: [/net\s*worth|wealth.*trend|wealth.*grow/i],
    handler: "networth",
  },
  {
    patterns: [
      /last\s*month|this\s*month|month.*over.*month|compare.*month|monthly.*trend/i,
      /month.*spend|month.*income/i,
    ],
    handler: "monthly_trend",
  },
  {
    patterns: [/income|salary|earn/i],
    handler: "income",
  },
  {
    patterns: [/asset|property|real\s*estate|net.*asset/i],
    handler: "assets",
  },
  {
    patterns: [
      /categor|food|groceries|rent|transport|fuel|petrol|dining|restaurant|shopping|medical|health|education|utility|electricity|water|internet|phone|mobile|recharge/i,
    ],
    handler: "category",
  },
];

function matchIntent(msg) {
  const lower = msg.toLowerCase();

  // If the user mentions a specific name + a generic word like "expense/spend",
  // route to search so we find the actual item instead of showing generic top-5
  const genericWords =
    /\b(expense|expenses|spend|spending|cost|costs|amount|payment|bill)\b/i;
  const hasGenericWord = genericWords.test(lower);
  // Strip generic/stop words and see if meaningful name words remain
  const nameWords = lower
    .replace(
      /\b(show|my|me|the|how|much|is|was|were|are|did|do|what|for|from|in|on|of|to|at|and|or|this|that|all|total|last|expense|expenses|spend|spending|cost|costs|amount|payment|bill|please|tell|give|about|get|find|search|look|check)\b/g,
      "",
    )
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (hasGenericWord && nameWords.length > 0) {
    return "search";
  }

  for (const { patterns, handler } of INTENTS) {
    for (const p of patterns) {
      if (p.test(lower)) return handler;
    }
  }
  // Fallback: try fuzzy search against all data names
  return "search";
}

// ── Main handler per intent ─────────────────────────────────────────────────

function handleIntent(
  intent,
  p,
  name,
  sharedGoals,
  p2,
  name2,
  shared,
  userMessage,
  profile,
) {
  const insights = [];

  switch (intent) {
    case "overview": {
      if (!p) break;
      insights.push({
        emoji: "📋",
        title: "Monthly Summary",
        body: `${name}, here's your snapshot:\n• Income: ${fmt(p.income)}/mo\n• Expenses: ${fmt(p.expenses)}/mo\n• SIPs: ${fmt(p.sipTotal)}/mo\n• EMIs: ${fmt(p.debtEMI)}/mo\n• Surplus: ${fmt(p.surplus)}/mo\n• Savings rate: ${pct(p.savingsRate)}`,
      });
      const sr = savingsRateInsight(p, name);
      if (sr) insights.push(sr);
      const dt = debtHealthInsight(p, name);
      if (dt) insights.push(dt);
      const gp = goalProgressInsight(p.goals, sharedGoals, name);
      if (gp) insights.push(gp);
      break;
    }
    case "sip":
      if (p) {
        insights.push(topInvestmentInsight(p, name));
        insights.push(sipStepUpInsight(p, name));
        insights.push(allocationInsight(p, name));
      }
      break;
    case "goals":
      if (p) {
        insights.push(goalProgressInsight(p.goals, sharedGoals, name));
        if (!insights[0]) {
          insights.push({
            emoji: "🎯",
            title: "Goals On Track",
            body: `${name}, all your goals are progressing well — keep it up!`,
          });
        }
      }
      break;
    case "savings":
      if (p) {
        insights.push(savingsRateInsight(p, name));
        insights.push(surplusCashInsight(p, name));
      }
      break;
    case "tax":
      if (p) {
        const t = tax80CInsight(p, name);
        insights.push(
          t || {
            emoji: "✅",
            title: "80C Optimized",
            body: `${name}, your 80C investments (ELSS + PPF + insurance) total ${fmt(p.sec80C)}/yr — ${p.sec80C >= 150000 ? "fully utilized!" : "close to the ₹1.5L limit."}`,
          },
        );
      }
      break;
    case "debt":
      if (p) {
        const d = debtHealthInsight(p, name);
        if (d) {
          insights.push(d);
        } else {
          insights.push({
            emoji: "🎉",
            title: "Debt Free",
            body: `${name}, you have no active EMIs — that's amazing! All income goes to savings and investments.`,
          });
        }
        if (p.debts.length > 0) {
          const highest = [...p.debts].sort(
            (a, b) => (b.rate || 0) - (a.rate || 0),
          )[0];
          insights.push({
            emoji: "💡",
            title: "Prepayment Tip",
            body: `Focus on "${highest.name}" first (${highest.rate || 0}% rate, ${fmt(highest.emi)}/mo EMI). Prepaying high-rate loans saves the most interest.`,
          });
        }
      }
      break;
    case "insurance":
      if (p) {
        const ins = insuranceInsight(p, name);
        insights.push(
          ins || {
            emoji: "✅",
            title: "Insurance Adequate",
            body: `${name}, your life cover is adequate at ${L(p.lifeInsurance)} (≥10× annual income). Well done!`,
          },
        );
      }
      break;
    case "emergency":
      if (p) {
        const em = emergencyFundInsight(p, name);
        insights.push(
          em || {
            emoji: "✅",
            title: "Emergency Fund Ready",
            body: `${name}, you have sufficient liquid savings to cover 6+ months of expenses. Great safety net!`,
          },
        );
      }
      break;
    case "allocation":
      if (p) {
        const al = allocationInsight(p, name);
        insights.push(
          al || {
            emoji: "✅",
            title: "Portfolio Well Balanced",
            body: `${name}, your equity allocation is ${pct(p.equityPct)} — well within the ideal 50-70% range. Good diversification.`,
          },
        );
        insights.push(topInvestmentInsight(p, name));
      }
      break;
    case "investments":
      if (p) {
        insights.push(topInvestmentInsight(p, name));
        insights.push(allocationInsight(p, name));
        insights.push(sipStepUpInsight(p, name));
      }
      break;
    case "surplus":
      if (p) {
        const s = surplusCashInsight(p, name);
        insights.push(
          s || {
            emoji: "✅",
            title: "Money Well Deployed",
            body: `${name}, your surplus is efficiently allocated. Income fully goes to expenses, SIPs & EMIs.`,
          },
        );
      }
      break;
    case "household":
      if (p && p2) {
        insights.push(householdCompareInsight(p, p2, name, name2));
      }
      insights.push(goalProgressInsight(p?.goals, sharedGoals, "Household"));
      break;
    case "expenses":
      if (p) {
        const topExp = [...(p.expenses_ || [])]
          .filter((e) => e.expenseType === "monthly")
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5);
        const lines = topExp
          .map((e) => `• ${e.name}: ${fmt(e.amount)}/mo`)
          .join("\n");
        insights.push({
          emoji: "📉",
          title: "Biggest Monthly Expenses",
          body: `${name}, your top 5 expenses:\n${lines || "No monthly expenses found."}\n\nLook for subscriptions you don't use, or categories where you can reduce by 10-20%.`,
        });
      }
      break;
    case "retirement": {
      if (!p) break;
      const annualExp = (p.expenses + p.debtEMI) * 12;
      const fireNumber = annualExp * 25;
      const corpus = p.corpus20;
      const ratio = fireNumber > 0 ? (corpus / fireNumber) * 100 : 0;
      insights.push({
        emoji: "🏖️",
        title: "FIRE / Retirement Check",
        body: `${name}, your FIRE number: ${L(fireNumber)} (25× annual expenses).\nProjected 20-year corpus: ${L(corpus)}.\nFIRE readiness: ${pct(ratio)}.\n${ratio >= 100 ? "You're on track to retire in 20 years! 🎉" : `Gap: ${L(fireNumber - corpus)}. Increase SIPs by ${fmt(Math.round((fireNumber - corpus) / (12 * 20)))}/mo to close it.`}`,
      });
      break;
    }
    case "trip": {
      const trips = [
        ...(shared?.trips || []).map((t) => ({
          name: t.name,
          amount: t.amount || 0,
          startDate: t.startDate,
          items: t.items || [],
          source: "shared",
        })),
        ...(p?.expenses_ || [])
          .filter((e) => e.expenseType === "trip")
          .map((t) => ({
            name: t.name,
            amount: t.amount || 0,
            startDate: t.startDate || t.date,
            items: t.items || [],
            source: "personal",
          })),
      ];

      if (trips.length === 0) {
        insights.push({
          emoji: "✈️",
          title: "No Trips Found",
          body: `${name}, you don't have any trips recorded yet. Add a trip from the expenses page.`,
        });
        break;
      }

      // Try to find a specific trip by name match from user message
      const msgLower = (userMessage || "").toLowerCase();
      const matched = trips.find((t) =>
        msgLower.includes(t.name.toLowerCase()),
      );

      if (matched) {
        const itemLines =
          matched.items.length > 0
            ? matched.items
                .map((it) => `• ${it.category || "Other"}: ${fmt(it.amount)}`)
                .join("\n")
            : "No category breakdown available.";
        insights.push({
          emoji: "✈️",
          title: `Trip: ${matched.name}`,
          body: `Total spent: ${fmt(matched.amount)}${matched.startDate ? `\nDate: ${matched.startDate}` : ""}\n\n**Breakdown:**\n${itemLines}`,
        });
      } else {
        // Show all trips
        const totalTrips = trips.reduce((s, t) => s + t.amount, 0);
        const lines = trips
          .sort((a, b) => b.amount - a.amount)
          .map(
            (t) =>
              `• ${t.name}: ${fmt(t.amount)}${t.startDate ? " (" + t.startDate + ")" : ""}`,
          )
          .join("\n");
        insights.push({
          emoji: "✈️",
          title: "All Trips",
          body: `${name}, you have ${trips.length} trip(s) totaling ${fmt(totalTrips)}:\n${lines}`,
        });
      }
      break;
    }
    case "subscriptions": {
      const subs = p?.subscriptions || [];
      if (subs.length === 0) {
        // Also check expenses for subscription-like names
        const subExpenses = (p?.expenses_ || []).filter((e) =>
          /subscri|ott|netflix|spotify|hotstar|prime|youtube|gym|disney|jio|airtel/i.test(
            e.name || "",
          ),
        );
        if (subExpenses.length > 0) {
          const total = subExpenses.reduce(
            (s, e) => s + onetimeEffective(e),
            0,
          );
          const lines = subExpenses
            .map((e) => `• ${e.name}: ${fmt(onetimeEffective(e))}/mo`)
            .join("\n");
          insights.push({
            emoji: "📺",
            title: "Subscription Expenses",
            body: `${name}, found these subscription-like expenses (${fmt(total)}/mo):\n${lines}`,
          });
        } else {
          insights.push({
            emoji: "📺",
            title: "No Subscriptions Found",
            body: `${name}, no subscription expenses found in your data.`,
          });
        }
      } else {
        const total = subs.reduce((s, x) => s + (x.amount || 0), 0);
        const lines = subs
          .map((s) => `• ${s.name}: ${fmt(s.amount)}/mo`)
          .join("\n");
        insights.push({
          emoji: "📺",
          title: "Subscriptions",
          body: `${name}, your subscriptions total ${fmt(total)}/mo:\n${lines}`,
        });
      }
      break;
    }
    case "specific_expense": {
      // Try to extract what the user is asking about from the message
      const msgLower = (userMessage || "").toLowerCase();
      const allExp = [
        ...(p?.expenses_ || []),
        ...(shared?.trips || []).map((t) => ({
          name: t.name,
          amount: t.amount,
          expenseType: "trip",
        })),
      ];

      // Fuzzy search: find expenses whose name appears in the user message
      const matches = allExp.filter((e) => {
        const eName = (e.name || "").toLowerCase();
        return (
          eName.length > 2 &&
          (msgLower.includes(eName) ||
            eName
              .split(/\s+/)
              .some((w) => w.length > 3 && msgLower.includes(w)))
        );
      });

      if (matches.length > 0) {
        const lines = matches
          .map((e) => {
            const freq =
              e.expenseType === "monthly"
                ? "/mo"
                : e.expenseType === "trip"
                  ? " (trip)"
                  : " (one-time)";
            return `• ${e.name}: ${fmt(onetimeEffective(e))}${freq}`;
          })
          .join("\n");
        const total = matches.reduce((s, e) => s + onetimeEffective(e), 0);
        insights.push({
          emoji: "🔍",
          title: "Expense Lookup",
          body: `Found ${matches.length} matching expense(s) totaling ${fmt(total)}:\n${lines}`,
        });
      } else {
        // Show top expenses as fallback
        const topExp = [...(p?.expenses_ || [])]
          .sort((a, b) => onetimeEffective(b) - onetimeEffective(a))
          .slice(0, 8);
        const lines = topExp
          .map((e) => {
            const freq =
              e.expenseType === "monthly"
                ? "/mo"
                : e.expenseType === "trip"
                  ? " (trip)"
                  : " (one-time)";
            return `• ${e.name}: ${fmt(onetimeEffective(e))}${freq}`;
          })
          .join("\n");
        insights.push({
          emoji: "🔍",
          title: "Couldn't find that expense",
          body: `I couldn't match a specific expense. Here are your biggest ones:\n${lines}\n\nTry asking with the exact expense name.`,
        });
      }
      break;
    }
    case "networth": {
      const hist = shared?.netWorthHistory || [];
      if (hist.length === 0) {
        insights.push({
          emoji: "📈",
          title: "No Net Worth History",
          body: `${name}, no monthly snapshots recorded yet. Net worth is tracked automatically at end of each month.`,
        });
        break;
      }
      const sorted = [...hist].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
      );
      const latest = sorted[0];
      const prev = sorted[1];
      const nw =
        profile === "aanya"
          ? latest.aanyaNetWorth || 0
          : profile === "abhav"
            ? latest.abhavNetWorth || 0
            : (latest.abhavNetWorth || 0) + (latest.aanyaNetWorth || 0);
      let body = `Latest net worth (${latest.label || latest.month + "/" + latest.year}): ${L(nw)}`;
      if (prev) {
        const prevNW =
          profile === "aanya"
            ? prev.aanyaNetWorth || 0
            : profile === "abhav"
              ? prev.abhavNetWorth || 0
              : (prev.abhavNetWorth || 0) + (prev.aanyaNetWorth || 0);
        const diff = nw - prevNW;
        body += `\nPrevious month: ${L(prevNW)}\nChange: ${diff >= 0 ? "+" : ""}${L(diff)} (${prevNW > 0 ? (diff >= 0 ? "+" : "") + pct((diff / prevNW) * 100) : "N/A"})`;
      }
      if (sorted.length >= 3) {
        const oldest = sorted[sorted.length - 1];
        const oldNW =
          profile === "aanya"
            ? oldest.aanyaNetWorth || 0
            : profile === "abhav"
              ? oldest.abhavNetWorth || 0
              : (oldest.abhavNetWorth || 0) + (oldest.aanyaNetWorth || 0);
        const totalGrowth = nw - oldNW;
        body += `\nSince ${oldest.label || oldest.month + "/" + oldest.year}: ${totalGrowth >= 0 ? "+" : ""}${L(totalGrowth)}`;
      }
      insights.push({ emoji: "📈", title: "Net Worth Trend", body });
      break;
    }
    case "monthly_trend": {
      const txns = p?.transactions || [];
      if (txns.length === 0) {
        insights.push({
          emoji: "📅",
          title: "No Transaction Data",
          body: `${name}, no transactions found to analyze monthly trends.`,
        });
        break;
      }
      const now = new Date();
      const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      const monthStats = (ym) => {
        const mt = txns.filter((t) => (t.date || "").startsWith(ym));
        const inc = mt
          .filter((t) => t.amount > 0 && t.type !== "investment")
          .reduce((s, t) => s + t.amount, 0);
        const exp = mt
          .filter(
            (t) =>
              t.amount < 0 && t.type !== "investment" && t.category !== "EMI",
          )
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        const inv = mt
          .filter((t) => t.type === "investment")
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { inc, exp, inv, count: mt.length };
      };

      const curr = monthStats(thisYM);
      const last = monthStats(prevYM);
      let body = `**This Month (${thisYM}):**\n• Income: ${fmt(curr.inc)}\n• Expenses: ${fmt(curr.exp)}\n• Investments: ${fmt(curr.inv)}`;
      if (last.count > 0) {
        body += `\n\n**Last Month (${prevYM}):**\n• Income: ${fmt(last.inc)}\n• Expenses: ${fmt(last.exp)}\n• Investments: ${fmt(last.inv)}`;
        const expDiff = curr.exp - last.exp;
        if (Math.abs(expDiff) > 1000) {
          body += `\n\n${expDiff > 0 ? "⚠️" : "✅"} Expenses ${expDiff > 0 ? "up" : "down"} by ${fmt(Math.abs(expDiff))} vs last month.`;
        }
      }
      insights.push({ emoji: "📅", title: "Monthly Comparison", body });
      break;
    }
    case "income": {
      if (!p) break;
      const incomes = p.incomes || [];
      if (incomes.length === 0) {
        insights.push({
          emoji: "💵",
          title: "No Income Data",
          body: `${name}, no income sources recorded.`,
        });
        break;
      }
      const lines = incomes
        .map((i) => `• ${i.name}: ${fmt(i.amount)}/mo`)
        .join("\n");
      const total = incomes.reduce((s, i) => s + (i.amount || 0), 0);
      let body = `${name}, your income sources (${fmt(total)}/mo total):\n${lines}`;
      const withHistory = incomes.filter(
        (i) => i.salaryHistory && i.salaryHistory.length > 0,
      );
      if (withHistory.length > 0) {
        const latest = withHistory[0].salaryHistory.sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
        )[0];
        if (latest) {
          body += `\n\nLast salary change: ${latest.from ? fmt(latest.from) : "?"} → ${latest.to ? fmt(latest.to) : "?"} on ${latest.date || "?"}${latest.note ? " (" + latest.note + ")" : ""}`;
        }
      }
      insights.push({ emoji: "💵", title: "Income Sources", body });
      break;
    }
    case "assets": {
      if (!p) break;
      const personalAssets = p.assets || [];
      const personalLiab = p.liabilities || [];
      const assetTotal = personalAssets.reduce((s, a) => s + (a.value || 0), 0);
      const liabTotal = personalLiab.reduce((s, l) => s + (l.value || 0), 0);
      let body = "";
      if (personalAssets.length > 0) {
        body += `**Assets** (${L(assetTotal)}):\n${personalAssets.map((a) => `• ${a.name || a.type}: ${L(a.value)}`).join("\n")}`;
      }
      if (personalLiab.length > 0) {
        body += `${body ? "\n\n" : ""}**Liabilities** (${L(liabTotal)}):\n${personalLiab.map((l) => `• ${l.name || l.type}: ${L(l.value)}`).join("\n")}`;
      }
      if (body) {
        body += `\n\n**Net Assets:** ${L(assetTotal - liabTotal)}`;
      } else {
        body = `${name}, no assets or liabilities recorded. Add them from the Net Worth page.`;
      }
      insights.push({ emoji: "🏠", title: "Assets & Liabilities", body });
      break;
    }
    case "category": {
      if (!p) break;
      const msgLower = (userMessage || "").toLowerCase();
      const allExp = p.expenses_ || [];
      const byCategory = {};
      for (const e of allExp) {
        const cat = (
          e.category ||
          e.subCategory ||
          "Uncategorized"
        ).toLowerCase();
        byCategory[cat] = (byCategory[cat] || 0) + onetimeEffective(e);
      }
      const cats = Object.keys(byCategory);
      const matchedCat = cats.find((c) => msgLower.includes(c));
      if (matchedCat) {
        const catExpenses = allExp.filter(
          (e) =>
            (e.category || e.subCategory || "").toLowerCase() === matchedCat,
        );
        const lines = catExpenses
          .sort((a, b) => onetimeEffective(b) - onetimeEffective(a))
          .map((e) => {
            const freq = e.expenseType === "monthly" ? "/mo" : " (one-time)";
            return `• ${e.name}: ${fmt(onetimeEffective(e))}${freq}`;
          })
          .join("\n");
        insights.push({
          emoji: "🏷️",
          title: `${matchedCat.charAt(0).toUpperCase() + matchedCat.slice(1)} Expenses`,
          body: `Total: ${fmt(byCategory[matchedCat])}\n${lines}`,
        });
      } else {
        const sorted = Object.entries(byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const lines = sorted
          .map(
            ([cat, amt]) =>
              `• ${cat}: ${fmt(amt)} (${pct((amt / total) * 100)})`,
          )
          .join("\n");
        insights.push({
          emoji: "🏷️",
          title: "Expense Categories",
          body: `${name}, your spending by category:\n${lines}`,
        });
      }
      break;
    }
    case "search": {
      const msgLower = (userMessage || "").toLowerCase();
      const words = msgLower
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 1 &&
            !/^(the|and|for|how|what|much|did|was|are|can|you|my|me|is|it|of|to|in|on|at|do|this|that|show|tell|about|give|get)$/i.test(
              w,
            ),
        );

      // Relevance scoring: more matched words + exact phrase = higher score
      const phrase = words.join(" ");
      const score = (name_) => {
        const nl = name_.toLowerCase();
        // Exact phrase match (best)
        if (nl.includes(phrase)) return words.length * 3;
        // Count how many query words match
        let s = 0;
        for (const w of words) {
          if (nl.includes(w)) s++;
        }
        return s;
      };

      const results = [];
      const addResult = (type, name_, detail) => {
        const s = score(name_);
        if (s > 0) results.push({ type, name: name_, detail, score: s });
      };

      for (const e of p?.expenses_ || []) {
        const freq =
          e.expenseType === "monthly"
            ? "/mo"
            : e.expenseType === "trip"
              ? " (trip)"
              : " (one-time)";
        addResult(
          "Expense",
          e.name || "",
          `${fmt(onetimeEffective(e))}${freq}`,
        );
      }
      for (const i of p?.investments || []) {
        addResult(
          "Investment",
          i.name || "",
          `${fmt(freqToMonthly(i.amount || 0, i.frequency))}/mo @ ${i.returnPct || 0}%`,
        );
      }
      for (const d of p?.debts || []) {
        addResult("Debt", d.name || "", `EMI ${fmt(d.emi)} @ ${d.rate || 0}%`);
      }
      for (const g of [...(p?.goals || []), ...(shared?.goals || [])]) {
        const saved =
          (g.abhavSaved || 0) + (g.aanyaSaved || 0) + (g.saved || 0);
        addResult("Goal", g.name || "", `${L(saved)} / ${L(g.target || 0)}`);
      }
      for (const t of shared?.trips || []) {
        addResult("Trip", t.name || "", fmt(t.amount || 0));
      }
      for (const i of p?.incomes || []) {
        addResult("Income", i.name || "", `${fmt(i.amount)}/mo`);
      }
      for (const t of (p?.transactions || []).slice(-100)) {
        addResult(
          "Transaction",
          t.desc || "",
          `${fmt(Math.abs(t.amount))} on ${t.date}`,
        );
      }
      for (const a of p?.assets || []) {
        addResult("Asset", a.name || a.type || "", L(a.value || 0));
      }
      for (const s of p?.subscriptions || []) {
        addResult("Subscription", s.name || "", `${fmt(s.amount)}/mo`);
      }

      // Sort by score descending, then filter: only keep items scoring >= best/2
      results.sort((a, b) => b.score - a.score);
      const best = results[0]?.score || 0;
      const threshold = Math.max(1, Math.ceil(best / 2));
      const filtered = results.filter((r) => r.score >= threshold);

      if (filtered.length > 0) {
        const shown = filtered.slice(0, 10);
        const lines = shown
          .map((r) => `• **${r.type}**: ${r.name} — ${r.detail}`)
          .join("\n");
        insights.push({
          emoji: "🔍",
          title: `Found ${filtered.length} Result${filtered.length > 1 ? "s" : ""}`,
          body: `${lines}${filtered.length > 10 ? `\n\n…and ${filtered.length - 10} more.` : ""}`,
        });
      } else {
        insights.push({
          emoji: "🤔",
          title: "No Match Found",
          body: `I searched all your expenses, investments, debts, goals, trips, income, assets & transactions but couldn't find a match.\n\nTry:\n• A specific expense name\n• "trip to Hyderabad"\n• "how much on groceries"\n• "my SIP investments"\n• "net worth trend"`,
        });
      }
      break;
    }
    default:
      break;
  }

  return insights.filter(Boolean);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ask the local smart advisor. Sync — returns immediately.
 * @param {string} userMessage — user's question
 * @param {object} abhav — person1 raw data
 * @param {object} aanya — person2 raw data
 * @param {object} shared — shared data
 * @param {string} profile — "abhav" | "aanya" | "household"
 * @returns {string} advisor response text
 */
export function askSmart(userMessage, abhav, aanya, shared, profile) {
  const p1 = personData(abhav);
  const p2 = personData(aanya);
  const sharedGoals = (shared?.goals || []).map((g) => ({
    name: g.name,
    target: g.target || 0,
    abhavSaved: g.abhavSaved || 0,
    aanyaSaved: g.aanyaSaved || 0,
  }));

  const name1 = shared?.profile?.person1Name || "Person 1";
  const name2 = shared?.profile?.person2Name || "Person 2";

  let activePerson = p1;
  let activeName = name1;
  if (profile === "aanya") {
    activePerson = p2;
    activeName = name2;
  }

  const intent = matchIntent(userMessage);

  let insights;
  if (profile === "household") {
    insights = handleIntent(
      intent,
      p1,
      name1,
      sharedGoals,
      p2,
      name2,
      shared,
      userMessage,
      profile,
    );
    if (
      intent !== "household" &&
      intent !== "trip" &&
      intent !== "networth" &&
      intent !== "monthly_trend" &&
      intent !== "assets" &&
      intent !== "search"
    ) {
      // Also add second person's perspective for household view
      const p2Insights = handleIntent(
        intent,
        p2,
        name2,
        sharedGoals,
        p1,
        name1,
        shared,
        userMessage,
        profile,
      );
      insights = [
        ...insights,
        ...p2Insights.filter(
          (ins) => !insights.some((existing) => existing.title === ins.title),
        ),
      ];
    }
  } else {
    insights = handleIntent(
      intent,
      activePerson,
      activeName,
      sharedGoals,
      null,
      null,
      shared,
      userMessage,
      profile,
    );
  }

  if (insights.length === 0) {
    // Last resort: run universal search before giving up
    const searchInsights = handleIntent(
      "search",
      activePerson,
      activeName,
      sharedGoals,
      null,
      null,
      shared,
      userMessage,
      profile,
    );
    if (searchInsights.length > 0)
      return searchInsights
        .map((i) => `${i.emoji} **${i.title}**\n${i.body}`)
        .join("\n\n");

    return `I searched all your data but couldn't find specific insights for that. Try:\n• "How am I doing this month?"\n• "Trip to Hyderabad"\n• "How much on groceries?"\n• "Show my SIP investments"\n• "Net worth trend"\n• "Compare last month"\n• "Income sources"\n• "My assets"`;
  }

  return insights
    .map((i) => `${i.emoji} **${i.title}**\n${i.body}`)
    .join("\n\n");
}

/**
 * Generate a quick health report (used for "How am I doing?")
 */
export function healthReport(abhav, aanya, shared, profile) {
  return askSmart("How am I doing overall?", abhav, aanya, shared, profile);
}
