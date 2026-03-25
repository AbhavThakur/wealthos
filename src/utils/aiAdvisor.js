/* ── WealthOS AI Advisor — Gemini 2.0 Flash (free tier) ───────────────────────
 *  Calls Google's Generative Language API directly.
 *  Requires VITE_GEMINI_KEY in .env.local
 *  Free tier: 15 RPM / 1 M tokens/min — more than enough for personal use.
 */

const SYSTEM_PROMPT = `You are WealthOS AI, a personal finance advisor for an Indian household.
You speak in a warm, direct, friendly tone. Keep responses under 150 words unless asked for detail.
You understand Indian finance: SIP, ELSS, PPF, NPS, LTCG, old vs new tax regime, Nifty, FD rates, mutual funds, EPF, HRA.
Always give specific, actionable advice based on the numbers provided. Never be vague.
Use ₹ for amounts. Use "L" for lakhs and "Cr" for crores when amounts are large.
If the data is insufficient for a question, say what's missing instead of guessing.`;

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function askAdvisor(userMessage, financialContext) {
  const key = import.meta.env.VITE_GEMINI_KEY;
  if (!key) {
    return "⚠️ No API key found. Add VITE_GEMINI_KEY to your .env.local file.\nGet a free key at aistudio.google.com";
  }

  const contextStr = JSON.stringify(financialContext, null, 2);

  const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
        maxOutputTokens: 512,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429)
      return "Rate limited — wait a moment and try again.";
    if (res.status === 403)
      return "API key invalid or Gemini API not enabled. Check aistudio.google.com.";
    throw new Error(err);
  }

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sorry, couldn't get a response. Try again."
  );
}

/** Build a concise financial context object from app data */
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
    return {
      name,
      monthlyIncome: inc,
      monthlyExpenses: exp,
      monthlySavings: inc - exp - debtEMI,
      savingsRate: inc ? Math.round(((inc - exp - debtEMI) / inc) * 100) : 0,
      totalSIPAmount: invTotal,
      investmentCount: (d.investments || []).length,
      topInvestments: (d.investments || [])
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5)
        .map((i) => ({
          name: i.name,
          amount: i.amount,
          returnPct: i.returnPct,
          type: i.type,
        })),
      totalEMI: debtEMI,
      debts: (d.debts || []).map((dbt) => ({
        name: dbt.name,
        emi: dbt.emi,
        rate: dbt.rate,
      })),
      goals: (d.goals || []).map((g) => ({
        name: g.name,
        target: g.target,
        saved: g.saved,
        deadline: g.deadline,
      })),
      insurances: (d.insurances || []).map((ins) => ({
        type: ins.type,
        cover: ins.cover,
        premium: ins.premium,
      })),
    };
  };

  const sharedGoals = (shared?.goals || []).map((g) => ({
    name: g.name,
    target: g.target,
    saved: (g.abhavSaved || 0) + (g.aanyaSaved || 0),
    deadline: g.deadline,
  }));

  if (profile === "household") {
    return {
      view: "Household",
      person1: summarizePerson(abhav, "Abhav"),
      person2: summarizePerson(aanya, "Aanya"),
      sharedGoals,
      savingsTarget: shared?.profile?.savingsTarget,
    };
  }

  const person = profile === "abhav" ? abhav : aanya;
  const name = profile === "abhav" ? "Abhav" : "Aanya";
  return {
    view: name,
    ...summarizePerson(person, name),
    sharedGoals,
  };
}
