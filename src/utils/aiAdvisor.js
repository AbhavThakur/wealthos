/* ── WealthOS AI Advisor — Gemini 2.0 Flash (free tier) ───────────────────────
 *  Calls Google's Generative Language API directly.
 *  Requires VITE_GEMINI_KEY in .env.local
 *  Free tier: 15 RPM / 1 M tokens/min — more than enough for personal use.
 */

const SYSTEM_PROMPT = `You are WealthOS AI, a personal finance and investment advisor for an Indian household.
You speak in a warm, direct, friendly tone. Keep responses under 200 words unless asked for detail.
You understand Indian finance deeply: SIP, ELSS, PPF, NPS, LTCG, STCG, old vs new tax regime, Nifty 50, Nifty Next 50, Sensex, FD rates, RBI repo rate, mutual funds, index funds, direct vs regular plans, expense ratios, EPF, HRA, sovereign gold bonds, REITs, US feeder funds (Nasdaq 100, S&P 500).

INVESTMENT ADVICE RULES:
- Always consider the user's current allocation before suggesting new investments.
- For equity: if savings rate < 15%, prioritise building the savings habit first.
- For debt: recommend liquid or short-duration funds only — not long-duration in a high-rate environment unless holding-to-maturity is declared.
- For market-timing questions: remind that index funds (Nifty 50) via monthly SIP beat most active strategies over 10+ years after fees — cite SEBI CAGR data when relevant.
- If the user has idle cash above 6-month emergency fund, always flag that first — it is the single best quick win.
- Factor in the user's existing corpus, not just monthly SIPs.
- When suggesting a new SIP, compute the projected corpus at the stated time horizon using ~12% for equity, ~7% for debt, ~8% for gold.
- Always give the rupee impact of any suggestion, not just percentages.
- Call out high expense ratios (>1%) on active funds as a drag on returns.

MARKET CONTEXT (as of April 2026):
- Nifty 50 P/E is around 21–23 (fairly valued, not cheap, not expensive).
- RBI repo rate is 6.25% — FDs give 6.5–7.5%, liquid funds ~7%.
- Gold is elevated — SGB is the preferred vehicle over physical gold.
- US tech valuations are normalizing — Nasdaq 100 feeder funds have 5-year CAGR ~16% in INR terms.
- Small-cap P/E is high (~30) — risk:reward less favourable; limit to <15% of portfolio.
- Index funds (Nifty 50, Nifty Next 50) are still the default recommendation for equity allocation >10 years.

Always give specific, actionable advice based on the user's exact numbers. Never be vague.
Use ₹ for amounts. Use "L" for lakhs and "Cr" for crores when amounts are large.
If the data is insufficient for a question, say exactly what's missing instead of guessing.`;

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function askAdvisor(userMessage, financialContext) {
  const key = import.meta.env.VITE_GEMINI_KEY;
  if (!key) {
    return "⚠️ No API key found. Add VITE_GEMINI_KEY to your .env.local file.\nGet a free key at aistudio.google.com";
  }

  const contextStr = JSON.stringify(financialContext, null, 2);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `My financial data:\n${contextStr}\n\nQuestion: ${userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.65,
        },
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 429)
        return "Rate limited — wait a moment and try again.";
      if (res.status === 403)
        return "API key invalid or Gemini API not enabled. Check aistudio.google.com.";
      const errText = await res.text().then((t) => t.slice(0, 200));
      return `API error (${res.status}): ${errText}`;
    }

    const data = await res.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, couldn't get a response. Try again."
    );
  } catch (err) {
    if (err.name === "AbortError") return "⏱️ Request timed out. Try again.";
    return "❌ " + (err.message || "Something went wrong. Try again.");
  }
}

// ── Groq API (free tier — Llama 3.3 70B, 1000 req/day) ───────────────────────
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function askGroq(userMessage, financialContext) {
  const key = import.meta.env.VITE_GROQ_KEY;
  if (!key) {
    return "⚠️ No Groq key found. Add VITE_GROQ_KEY to .env.local\nGet a free key at console.groq.com (1000 requests/day free)";
  }

  const contextStr = JSON.stringify(financialContext, null, 2);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `My financial data:\n${contextStr}\n\nQuestion: ${userMessage}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.65,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 429)
        return "⏱️ Rate limited — you've hit today's free limit (1000 req/day). Try again tomorrow or switch mode.";
      if (res.status === 401)
        return "❌ Groq API key invalid. Check console.groq.com for a valid key.";
      const errText = await res.text().then((t) => t.slice(0, 200));
      return `API error (${res.status}): ${errText}`;
    }

    const data = await res.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Sorry, couldn't get a response. Try again."
    );
  } catch (err) {
    if (err.name === "AbortError") return "⏱️ Request timed out. Try again.";
    return "❌ " + (err.message || "Something went wrong. Try again.");
  }
}

// ── Generate a copy-paste report for use in ChatGPT / Claude web ─────────────
export function buildReport(abhav, aanya, shared) {
  const fmt = (n) =>
    n == null
      ? "—"
      : n >= 1e7
        ? `₹${(n / 1e7).toFixed(2)} Cr`
        : n >= 1e5
          ? `₹${(n / 1e5).toFixed(1)} L`
          : `₹${Math.round(n).toLocaleString("en-IN")}`;

  const line = "─".repeat(52);
  const out = [];

  out.push(
    "WEALTHOS FINANCIAL REPORT — " +
      new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  );
  out.push(line);
  out.push("Context: Indian household, use Indian finance terminology.");
  out.push("All amounts in INR. Advise specifically based on these numbers.");
  out.push(line);

  const summarisePerson = (d, name) => {
    if (!d) return;
    const inc = (d.incomes || []).reduce((s, x) => s + (x.amount || 0), 0);
    const monthlyExp = (d.expenses || [])
      .filter((e) => !e.expenseType || e.expenseType === "monthly")
      .reduce((s, x) => s + (x.amount || 0), 0);
    const sipAmt = (d.investments || []).reduce(
      (s, x) => s + (x.amount || 0),
      0,
    );
    const emiAmt = (d.debts || []).reduce((s, x) => s + (x.emi || 0), 0);
    const surplus = inc - monthlyExp - sipAmt - emiAmt;
    const savRate =
      inc > 0 ? Math.round(((sipAmt + Math.max(0, surplus)) / inc) * 100) : 0;
    const liquid = (d.savingsAccounts || []).reduce(
      (s, x) => s + (x.balance || 0),
      0,
    );
    const efMonths =
      monthlyExp + emiAmt > 0
        ? (liquid / (monthlyExp + emiAmt)).toFixed(1)
        : "0";

    out.push(`\n── ${name.toUpperCase()} ──`);
    out.push(`Monthly income : ${fmt(inc)}`);
    out.push(`Monthly expenses: ${fmt(monthlyExp)}`);
    out.push(`Monthly SIP total: ${fmt(sipAmt)}`);
    out.push(`Monthly EMI: ${fmt(emiAmt)}`);
    out.push(`Savings rate: ${savRate}%`);
    out.push(
      `Liquid savings (bank): ${fmt(liquid)} (${efMonths} months emergency cover)`,
    );

    if ((d.investments || []).length > 0) {
      out.push(`\nInvestments:`);
      for (const inv of d.investments) {
        const ep =
          inv.existingCorpus > 0 ? ` | corpus ${fmt(inv.existingCorpus)}` : "";
        out.push(
          `  • ${inv.name} (${inv.type}) — ${fmt(inv.amount)}/${inv.frequency} @ ${inv.returnPct || "?"}% pa${ep}`,
        );
      }
    }

    if ((d.debts || []).length > 0) {
      out.push(`\nDebts / Loans:`);
      for (const dbt of d.debts) {
        out.push(
          `  • ${dbt.name} — EMI ${fmt(dbt.emi)}, outstanding ${fmt(dbt.outstanding)}, rate ${dbt.rate}% pa`,
        );
      }
    }

    if ((d.savingsAccounts || []).length > 0) {
      out.push(`\nBank / Savings accounts:`);
      for (const acc of d.savingsAccounts) {
        out.push(
          `  • ${acc.bankName || "Bank"} — ${fmt(acc.balance)} @ ${acc.interestRate ?? 3.5}% pa`,
        );
      }
    }

    if ((d.insurances || []).length > 0) {
      out.push(`\nInsurance:`);
      for (const ins of d.insurances) {
        out.push(
          `  • ${ins.type} — cover ${fmt(ins.cover || 0)}, premium ${fmt(ins.premium)}/yr`,
        );
      }
    }
  };

  summarisePerson(abhav, shared?.personNames?.abhav || "Person 1");
  summarisePerson(aanya, shared?.personNames?.aanya || "Person 2");

  // Net worth history
  const nwHist = shared?.netWorthHistory || [];
  if (nwHist.length > 0) {
    out.push(
      `\n── NET WORTH HISTORY (last ${Math.min(6, nwHist.length)} snapshots) ──`,
    );
    nwHist.slice(-6).forEach((s) => {
      const hh = (s.abhavNetWorth || 0) + (s.aanyaNetWorth || 0);
      out.push(`  ${s.label || `${s.month}/${s.year}`}: ${fmt(hh)} household`);
    });
  }

  // Shared goals
  const goals = shared?.goals || [];
  if (goals.length > 0) {
    out.push(`\n── SHARED GOALS ──`);
    for (const g of goals) {
      const saved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
      const pct = g.target > 0 ? Math.round((saved / g.target) * 100) : 0;
      out.push(
        `  • ${g.emoji || ""} ${g.name} — target ${fmt(g.target)}, saved ${fmt(saved)} (${pct}%), deadline ${g.deadline || "—"}`,
      );
    }
  }

  // Profile
  const retireAge = shared?.profile?.retireAge || 60;
  const currentAge = shared?.profile?.currentAge || 30;
  out.push(`\n── PROFILE ──`);
  out.push(
    `Current age: ${currentAge}, target retirement age: ${retireAge}, years to retire: ${retireAge - currentAge}`,
  );

  out.push(`\n${line}`);
  out.push(
    "Please analyse and answer: Where should I invest right now based on current Indian market conditions? Consider my existing allocation, idle cash, savings rate, and long-term goals.",
  );

  return out.join("\n");
}

export function buildContext(abhav, aanya, shared, profile) {
  const summarizePerson = (d, name) => {
    if (!d) return null;
    const inc = (d.incomes || []).reduce((s, x) => s + (x.amount || 0), 0);
    const exp = (d.expenses || [])
      .filter((e) => e.expenseType === "monthly")
      .reduce((s, x) => s + (x.amount || 0), 0);
    const invTotal = (d.investments || []).reduce(
      (s, x) => s + (x.amount || 0),
      0,
    );
    const debtEMI = (d.debts || []).reduce((s, x) => s + (x.emi || 0), 0);

    // Savings accounts balance
    const liquidSavings = (d.savingsAccounts || []).reduce(
      (s, x) => s + (x.balance || 0),
      0,
    );

    // Asset allocation summary
    const equityTypes = ["Mutual Fund", "ELSS", "Stocks", "Index Fund", "ETF"];
    const debtTypes = ["FD", "PPF", "NPS", "RD", "Debt Fund", "Bonds"];
    const goldTypes = ["Gold", "SGB", "Gold Fund"];
    const equityAmt = (d.investments || [])
      .filter((i) => equityTypes.some((t) => (i.type || "").includes(t)))
      .reduce((s, x) => s + (x.amount || 0), 0);
    const debtAmt = (d.investments || [])
      .filter((i) => debtTypes.some((t) => (i.type || "").includes(t)))
      .reduce((s, x) => s + (x.amount || 0), 0);
    const goldAmt = (d.investments || [])
      .filter((i) => goldTypes.some((t) => (i.type || "").includes(t)))
      .reduce((s, x) => s + (x.amount || 0), 0);
    const totalInvAmt = invTotal || 1;

    return {
      name,
      // Income & cashflow
      monthlyIncome_INR: inc,
      monthlyExpenses_INR: exp,
      monthlyEMI_INR: debtEMI,
      monthlySIPTotal_INR: invTotal,
      monthlySurplus_INR: inc - exp - debtEMI - invTotal,
      savingsRatePct: inc
        ? Math.round(
            ((invTotal + Math.max(0, inc - exp - debtEMI - invTotal)) / inc) *
              100,
          )
        : 0,
      // Liquid assets
      liquidSavingsBalance: liquidSavings,
      emergencyFundMonths:
        exp + debtEMI > 0
          ? parseFloat((liquidSavings / (exp + debtEMI)).toFixed(1))
          : 0,
      excessCashAbove6Months: Math.max(0, liquidSavings - (exp + debtEMI) * 6),
      // Investment portfolio (with expense ratio so AI can flag high-fee funds)
      investmentDetail: (d.investments || []).map((i) => ({
        name: i.name,
        type: i.type,
        frequency: i.frequency,
        amount_INR: i.amount,
        returnPct: i.returnPct,
        existingCorpus_INR: i.existingCorpus || 0,
        capCategory: i.capCategory || null,
        expenseRatioPct: i.expenseRatio != null ? Number(i.expenseRatio) : null,
      })),
      assetAllocation: {
        equity_pct: Math.round((equityAmt / totalInvAmt) * 100),
        debt_pct: Math.round((debtAmt / totalInvAmt) * 100),
        gold_pct: Math.round((goldAmt / totalInvAmt) * 100),
        other_pct: Math.round(
          ((invTotal - equityAmt - debtAmt - goldAmt) / totalInvAmt) * 100,
        ),
      },
      // Debts
      totalEMI: debtEMI,
      debtToIncomeRatio: inc
        ? parseFloat(((debtEMI / inc) * 100).toFixed(1))
        : 0,
      debts: (d.debts || []).map((dbt) => ({
        name: dbt.name,
        emi: dbt.emi,
        rate: dbt.rate,
        outstanding: dbt.outstanding,
      })),
      // Goals
      goals: (d.goals || []).map((g) => ({
        name: g.name,
        target: g.target,
        saved: g.saved || 0,
        deadline: g.deadline,
        pct: g.target > 0 ? Math.round(((g.saved || 0) / g.target) * 100) : 0,
      })),
      // Insurance
      insurances: (d.insurances || []).map((ins) => ({
        type: ins.type,
        cover: ins.cover || ins.coverAmount,
        premium: ins.premium,
      })),
      // 80C used
      sec80C_used: Math.min(
        150000,
        (d.investments || [])
          .filter((i) => /elss|ppf/i.test(i.type || ""))
          .reduce((s, x) => s + (x.amount || 0) * 12, 0) +
          (d.insurances || []).reduce((s, x) => s + (x.premium || 0), 0),
      ),
      sec80C_remaining: Math.max(
        0,
        150000 -
          (d.investments || [])
            .filter((i) => /elss|ppf/i.test(i.type || ""))
            .reduce((s, x) => s + (x.amount || 0) * 12, 0) -
          (d.insurances || []).reduce((s, x) => s + (x.premium || 0), 0),
      ),
      // Savings accounts (individual breakdown so AI knows where cash is sitting)
      savingsAccounts: (d.savingsAccounts || []).map((acc) => ({
        bank: acc.bankName || "Bank",
        balance_INR: acc.balance || 0,
        interestRatePct: acc.interestRate ?? 3.5,
      })),
      // Monthly subscriptions (recurring fixed costs)
      monthlySubscriptions_INR: (d.subscriptions || [])
        .filter((s) => s.active !== false)
        .reduce((sum, s) => {
          const freq = s.frequency || "monthly";
          const m =
            freq === "yearly"
              ? s.amount / 12
              : freq === "quarterly"
                ? s.amount / 3
                : freq === "weekly"
                  ? s.amount * 4.33
                  : s.amount;
          return sum + m;
        }, 0),
    };
  };

  // Net worth history (last 6 snapshots for trend)
  const nwHistory = (shared?.netWorthHistory || []).slice(-6).map((s) => ({
    month: s.label || `${s.month}/${s.year}`,
    abhav: s.abhavNetWorth || 0,
    aanya: s.aanyaNetWorth || 0,
    household: (s.abhavNetWorth || 0) + (s.aanyaNetWorth || 0),
  }));

  const sharedGoals = (shared?.goals || []).map((g) => ({
    name: g.name,
    target: g.target,
    saved: (g.abhavSaved || 0) + (g.aanyaSaved || 0),
    deadline: g.deadline,
    pct:
      g.target > 0
        ? Math.round(
            (((g.abhavSaved || 0) + (g.aanyaSaved || 0)) / g.target) * 100,
          )
        : 0,
  }));

  const retireAge = shared?.profile?.retireAge || 60;
  const currentAge = shared?.profile?.currentAge || 30;

  if (profile === "household") {
    const p1 = summarizePerson(abhav, "Abhav");
    const p2 = summarizePerson(aanya, "Aanya");
    const combinedIncome =
      (p1?.monthlyIncome_INR || 0) + (p2?.monthlyIncome_INR || 0);
    const combinedSIP =
      (p1?.monthlySIPTotal_INR || 0) + (p2?.monthlySIPTotal_INR || 0);
    const combinedLiquid =
      (p1?.liquidSavingsBalance || 0) + (p2?.liquidSavingsBalance || 0);
    return {
      view: "Household",
      person1: p1,
      person2: p2,
      sharedGoals,
      household_combined: {
        combinedMonthlyIncome_INR: combinedIncome,
        combinedMonthlySIP_INR: combinedSIP,
        combinedLiquidSavings_INR: combinedLiquid,
        householdSavingsRatePct:
          combinedIncome > 0
            ? Math.round((combinedSIP / combinedIncome) * 100)
            : 0,
      },
      netWorthHistory: nwHistory,
      profile: { retireAge, currentAge, yearsToRetire: retireAge - currentAge },
      savingsTarget: shared?.profile?.savingsTarget,
    };
  }

  const person = profile === "abhav" ? abhav : aanya;
  const name = profile === "abhav" ? "Abhav" : "Aanya";
  return {
    view: name,
    ...summarizePerson(person, name),
    netWorthHistory: nwHistory,
    profile: { retireAge, currentAge, yearsToRetire: retireAge - currentAge },
    sharedGoals,
  };
}
