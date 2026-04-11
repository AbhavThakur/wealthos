// Vercel Serverless Function — sends daily email reminders via Resend
// Triggered by Vercel Cron (daily at 7am) or manual GET /api/send-reminders
//
// Requires env vars:
//   RESEND_API_KEY  — get free key at resend.com (3,000 emails/month free)
//   Optional: FIREBASE_SA_CLIENT_EMAIL, FIREBASE_SA_PRIVATE_KEY for reading Firestore
//
// Reminder email per household is configured in Settings → Notifications.
// Households with no email set are silently skipped.

import { Resend } from "resend";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin init (server-side) ─────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_SA_CLIENT_EMAIL,
        // Vercel env vars use \n literal — convert to actual newlines
        privateKey: (process.env.FIREBASE_SA_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n",
        ),
      }),
    });
  }
  return getFirestore();
}

// ── Resend client ────────────────────────────────────────────────────────
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY env var is not set");
  return new Resend(key);
}

// ── Reminder logic (mirrors client-side checkReminders) ──────────────────
function buildReminders(data) {
  const now = new Date();
  const reminders = [];

  // Check all persons' insurance renewals (abhav/aanya are the real Firestore keys)
  for (const personKey of ["abhav", "aanya", "person1", "person2"]) {
    const person = data[personKey];
    if (!person) continue;
    for (const ins of person.insurances || []) {
      if (!ins.renewalDate) continue;
      const days = Math.ceil((new Date(ins.renewalDate) - now) / 86400000);
      if (days >= 0 && days <= 7) {
        reminders.push({
          title: `Insurance renewal in ${days} day${days !== 1 ? "s" : ""}`,
          body: `${ins.name || ins.type} policy is due for renewal.`,
          tag: `insurance-${ins.id}`,
        });
      }
    }
  }

  // Goal deadlines
  const shared = data.shared;
  for (const g of shared?.goals || []) {
    if (!g.deadline) continue;
    const deadline = new Date(g.deadline + "-28");
    const days = Math.ceil((deadline - now) / 86400000);
    const saved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
    if (days >= 0 && days <= 14 && saved < g.target) {
      reminders.push({
        title: `Goal "${g.name}" deadline approaching`,
        body: `${days} days left — ${Math.round((saved / g.target) * 100)}% saved.`,
        tag: `goal-${g.id}`,
      });
    }
  }

  // Budget overspend alerts — use REAL transactions + expense entries for current month
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (const personKey of ["abhav", "aanya", "person1", "person2"]) {
    const person = data[personKey];
    if (!person) continue;
    for (const alert of person.budgetAlerts || []) {
      if (!alert.active) continue;
      let spent = 0;
      // Real transactions this month matching category
      for (const t of person.transactions || []) {
        if (!t.date || t.date.slice(0, 7) !== curYm) continue;
        if (t.amount < 0 && t.category === alert.category) {
          spent += Math.abs(t.amount);
        }
      }
      // Expense log entries this month matching category
      for (const exp of person.expenses || []) {
        if (exp.category !== alert.category) continue;
        for (const e of exp.entries || []) {
          if (e.date && e.date.slice(0, 7) === curYm) spent += e.amount || 0;
        }
      }
      if (spent > alert.limit) {
        reminders.push({
          title: `Budget alert: ${alert.category}`,
          body: `Spent ₹${Math.round(spent).toLocaleString()} of ₹${Math.round(alert.limit).toLocaleString()} limit this month.`,
          tag: `budget-${alert.category}`,
        });
      }
    }
  }

  // Upcoming recurring payments due in the next 3 days (SIPs, EMIs, subscriptions)
  const upcomingDays = 3;
  const todayDate = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const seenUpcoming = new Set();
  for (const personKey of ["abhav", "aanya", "person1", "person2"]) {
    const person = data[personKey];
    if (!person) continue;
    // SIP investments
    for (const inv of person.investments || []) {
      if (inv.type === "FD" || inv.frequency === "onetime" || inv.paused)
        continue;
      const day = inv.deductionDate || 15;
      const diff =
        day >= todayDate ? day - todayDate : daysInMonth - todayDate + day;
      if (diff > 0 && diff <= upcomingDays) {
        const key = `sip-${inv.id || inv.name}`;
        if (!seenUpcoming.has(key)) {
          seenUpcoming.add(key);
          reminders.push({
            title: `SIP due in ${diff} day${diff !== 1 ? "s" : ""}`,
            body: `${inv.name} — ₹${Math.round(Math.abs(inv.amount)).toLocaleString()} on the ${day}${["st", "nd", "rd"][(day % 10) - 1] || "th"}.`,
            tag: `sip-${inv.id}`,
          });
        }
      }
    }
    // Debt EMIs
    for (const debt of person.debts || []) {
      const day = debt.emiDate || 5;
      const diff =
        day >= todayDate ? day - todayDate : daysInMonth - todayDate + day;
      if (diff > 0 && diff <= upcomingDays) {
        const key = `emi-${debt.id || debt.name}`;
        if (!seenUpcoming.has(key)) {
          seenUpcoming.add(key);
          reminders.push({
            title: `EMI due in ${diff} day${diff !== 1 ? "s" : ""}`,
            body: `${debt.name} — ₹${Math.round(debt.emi || 0).toLocaleString()} on the ${day}${["st", "nd", "rd"][(day % 10) - 1] || "th"}.`,
            tag: `emi-${debt.id}`,
          });
        }
      }
    }
    // Subscriptions
    for (const sub of person.subscriptions || []) {
      if (sub.active === false || sub.frequency === "onetime") continue;
      const day = sub.startDate ? parseInt(sub.startDate.slice(8, 10), 10) : 1;
      const diff =
        day >= todayDate ? day - todayDate : daysInMonth - todayDate + day;
      if (diff > 0 && diff <= upcomingDays) {
        const key = `sub-${sub.id || sub.name}`;
        if (!seenUpcoming.has(key)) {
          seenUpcoming.add(key);
          reminders.push({
            title: `Subscription due in ${diff} day${diff !== 1 ? "s" : ""}`,
            body: `${sub.name} — ₹${Math.round(sub.amount || 0).toLocaleString()}.`,
            tag: `sub-${sub.id}`,
          });
        }
      }
    }
  }

  return reminders.slice(0, 12);
}

// ── Expense summary for the current period ────────────────────────────────
function buildExpenseSummary(data, frequency) {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Week start = last Monday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  // Yesterday (for daily emails)
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const yesterdayLabel = yesterday.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const fmtINR = (n) =>
    n >= 1e7
      ? `\u20b9${(n / 1e7).toFixed(2)} Cr`
      : n >= 1e5
        ? `\u20b9${(n / 1e5).toFixed(1)} L`
        : `\u20b9${Math.round(n).toLocaleString("en-IN")}`;

  // Filter by period
  const isInPeriod = (dateStr) => {
    if (frequency === "daily") return dateStr === yesterdayStr;
    if (frequency === "weekly") {
      const d = new Date(dateStr);
      return d >= weekStart && d <= now;
    }
    return dateStr.slice(0, 7) === curYm; // monthly / force
  };

  // Collect all transactions for both persons, tracking per-person
  const byCategory = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalInvestments = 0;

  // byPerson: { [personKey]: { income, expenses, investments } }
  const byPerson = {};

  const personKeys = ["abhav", "aanya", "person1", "person2"];
  for (const key of personKeys) {
    const p = data[key];
    if (!p) continue;
    byPerson[key] = { income: 0, expenses: 0, investments: 0 };

    // Transactions (positive = income, type=investment = investment, else expense)
    for (const t of p.transactions || []) {
      if (!t.date || !isInPeriod(t.date)) continue;
      const amt = t.amount;
      if (amt > 0) {
        totalIncome += amt;
        byPerson[key].income += amt;
      } else if (t.type === "investment") {
        totalInvestments += Math.abs(amt);
        byPerson[key].investments += Math.abs(amt);
      } else {
        const cat = t.category || "Other";
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(amt);
        totalExpenses += Math.abs(amt);
        byPerson[key].expenses += Math.abs(amt);
      }
    }

    // Expense log entries
    for (const exp of p.expenses || []) {
      for (const e of exp.entries || []) {
        if (!e.date || !isInPeriod(e.date)) continue;
        const amt = e.amount || 0;
        const cat = exp.category || "Other";
        byCategory[cat] = (byCategory[cat] || 0) + amt;
        totalExpenses += amt;
        byPerson[key].expenses += amt;
      }
    }

    // Income entries
    for (const inc of p.incomes || []) {
      for (const e of inc.incomeEntries || []) {
        if (!e.date || !isInPeriod(e.date)) continue;
        const amt = e.amount || 0;
        totalIncome += amt;
        byPerson[key].income += amt;
      }
    }
  }

  // Sort categories by spend descending, take top 6
  const topCats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const periodLabel =
    frequency === "daily"
      ? `Yesterday, ${yesterdayLabel}`
      : frequency === "weekly"
        ? `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – Today`
        : `${now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} (MTD)`;

  // Savings rate: (invested + positive leftover) / income
  const savingsRate =
    totalIncome > 0
      ? Math.round(
          ((totalInvestments +
            Math.max(0, totalIncome - totalExpenses - totalInvestments)) /
            totalIncome) *
            100,
        )
      : null;

  // Only include persons that actually have data
  const personSummary = Object.entries(byPerson)
    .filter(([, v]) => v.expenses > 0 || v.income > 0 || v.investments > 0)
    .map(([key, v]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      ...v,
    }));

  return {
    totalIncome,
    totalExpenses,
    totalInvestments,
    topCats,
    periodLabel,
    savingsRate,
    personSummary,
    fmtINR,
  };
}

// ── Build financial snapshot for monthly emails ───────────────────────────
function buildSnapshot(data) {
  const fmtINR = (n) =>
    n >= 1e7
      ? `\u20b9${(n / 1e7).toFixed(2)} Cr`
      : n >= 1e5
        ? `\u20b9${(n / 1e5).toFixed(1)} L`
        : `\u20b9${Math.round(n).toLocaleString("en-IN")}`;

  let savings = 0;
  let investments = 0;
  for (const key of ["abhav", "aanya", "person1", "person2"]) {
    const p = data[key];
    if (!p) continue;
    for (const acc of p.savingsAccounts || []) savings += acc.balance || 0;
    for (const inv of p.investments || [])
      investments += inv.currentValue || inv.amount || 0;
  }

  const history = data.shared?.netWorthHistory || [];
  const lastSnap = history.length > 0 ? history[history.length - 1] : null;
  const netWorth = lastSnap
    ? (lastSnap.abhavNetWorth || 0) + (lastSnap.aanyaNetWorth || 0)
    : savings + investments;

  return { savings, investments, netWorth, fmtINR };
}

// ── Plain-text email body (required for deliverability — missing text = spam) ──
function buildPlainText(
  reminders,
  householdName,
  { expenseSummary, includeSnapshot, data } = {},
) {
  const fmtINR =
    expenseSummary?.fmtINR ||
    ((n) => `Rs.${Math.round(n).toLocaleString("en-IN")}`);

  const lines = [];
  const line = (s = "") => lines.push(s);

  line(`WealthOS — ${householdName || "Your Household"}`);
  line(
    `Sent: ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
  );
  line("━".repeat(48));

  // Reminders
  if (reminders.length > 0) {
    line();
    line("REMINDERS");
    for (const r of reminders) {
      line(`• ${r.title}`);
      line(`  ${r.body}`);
    }
  } else {
    line();
    line("No active reminders — all clear!");
  }

  // Spending
  if (expenseSummary && expenseSummary.totalExpenses > 0) {
    line();
    line("━".repeat(48));
    line(`SPENDING — ${expenseSummary.periodLabel}`);
    line();
    for (const [cat, amt] of expenseSummary.topCats) {
      line(`  ${cat.padEnd(22)} ${fmtINR(amt)}`);
    }
    line(
      `  ${"Total Spent".padEnd(22)} ${fmtINR(expenseSummary.totalExpenses)}`,
    );
    if (expenseSummary.totalIncome > 0)
      line(`  ${"Income".padEnd(22)} ${fmtINR(expenseSummary.totalIncome)}`);
    if (expenseSummary.totalInvestments > 0)
      line(
        `  ${"Invested".padEnd(22)} ${fmtINR(expenseSummary.totalInvestments)}`,
      );
    if (expenseSummary.savingsRate !== null)
      line(`  ${"Savings Rate".padEnd(22)} ${expenseSummary.savingsRate}%`);
    if (expenseSummary.personSummary?.length > 1) {
      line();
      line("Per Person:");
      for (const p of expenseSummary.personSummary) {
        const earned = p.income > 0 ? ` | Earned: ${fmtINR(p.income)}` : "";
        line(`  ${p.name}: Spent ${fmtINR(p.expenses)}${earned}`);
      }
    }
  }

  // Net worth snapshot
  if (includeSnapshot && data) {
    const s = buildSnapshot(data);
    if (s) {
      line();
      line("━".repeat(48));
      line("NET WORTH SNAPSHOT");
      line(`  ${"Liquid Savings".padEnd(22)} ${s.fmtINR(s.savings)}`);
      line(`  ${"Investments".padEnd(22)} ${s.fmtINR(s.investments)}`);
      line(`  ${"Net Worth".padEnd(22)} ${s.fmtINR(s.netWorth)}`);
    }
  }

  line();
  line("━".repeat(48));
  line("Sent by WealthOS. Open the app to take action.");

  return lines.join("\n");
}

// ── Build HTML email body ──────────────────────────────────────────────────
function buildEmailHtml(
  reminders,
  householdName,
  { includeSnapshot, expenseSummary, isForced, frequency, data } = {},
) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const freqLabel =
    frequency === "weekly"
      ? "Weekly Summary"
      : frequency === "monthly"
        ? "Monthly Summary"
        : "Daily Reminder";

  const rows = reminders
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;">
        <div style="font-weight:600;color:#eeeae4;font-size:14px;">${r.title}</div>
        <div style="color:#9a9a9a;font-size:13px;margin-top:3px;">${r.body}</div>
      </td>
    </tr>`,
    )
    .join("");

  const noRemindersRow =
    reminders.length === 0
      ? `<tr><td style="padding:14px 16px;color:#555;font-size:13px;font-style:italic;">No active reminders right now — all clear! ✓</td></tr>`
      : "";

  const expenseSection =
    expenseSummary && expenseSummary.totalExpenses > 0
      ? `<!-- Expense Summary -->
    <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
      <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
        Spending — ${expenseSummary.periodLabel}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${expenseSummary.topCats
          .map(
            ([cat, amt]) => `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#9a9a9a;">${cat}</td>
          <td style="padding:5px 0;font-size:13px;color:#eeeae4;text-align:right;">${expenseSummary.fmtINR(amt)}</td>
        </tr>`,
          )
          .join("")}
        <tr style="border-top:1px solid #2a2a2a;">
          <td style="padding:8px 0 2px;font-size:13px;color:#eeeae4;font-weight:700;">Total Spent</td>
          <td style="padding:8px 0 2px;font-size:13px;color:#eeeae4;text-align:right;font-weight:700;">${expenseSummary.fmtINR(expenseSummary.totalExpenses)}</td>
        </tr>
        ${
          expenseSummary.totalIncome > 0
            ? `<tr>
          <td style="padding:4px 0;font-size:12px;color:#9a9a9a;">Income</td>
          <td style="padding:4px 0;font-size:12px;color:#4caf82;text-align:right;">${expenseSummary.fmtINR(expenseSummary.totalIncome)}</td>
        </tr>`
            : ""
        }
        ${
          expenseSummary.totalInvestments > 0
            ? `<tr>
          <td style="padding:4px 0;font-size:12px;color:#9a9a9a;">Invested</td>
          <td style="padding:4px 0;font-size:12px;color:#c9a84c;text-align:right;">${expenseSummary.fmtINR(expenseSummary.totalInvestments)}</td>
        </tr>`
            : ""
        }
        ${
          expenseSummary.savingsRate !== null
            ? (() => {
                const r = expenseSummary.savingsRate;
                const color =
                  r >= 20 ? "#4caf82" : r >= 10 ? "#c9a84c" : "#e05a5a";
                return `<tr style="border-top:1px solid #2a2a2a;">
          <td style="padding:6px 0 2px;font-size:12px;color:#9a9a9a;">Savings Rate</td>
          <td style="padding:6px 0 2px;font-size:13px;color:${color};text-align:right;font-weight:700;">${r}%</td>
        </tr>`;
              })()
            : ""
        }
      </table>
      ${
        expenseSummary.personSummary && expenseSummary.personSummary.length > 1
          ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #222;">
        <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Per Person</div>
        ${expenseSummary.personSummary
          .map(
            (
              p,
            ) => `<div style="display:flex;justify-content:space-between;padding:3px 0;">
          <span style="font-size:13px;color:#9a9a9a;">${p.name}</span>
          <span style="font-size:13px;color:#eeeae4;">${expenseSummary.fmtINR(p.expenses)} spent${p.income > 0 ? ` · ${expenseSummary.fmtINR(p.income)} earned` : ""}</span>
        </div>`,
          )
          .join("")}
      </div>`
          : ""
      }
    </div>`
      : "";

  const snapshotSection =
    includeSnapshot && data
      ? (() => {
          const s = buildSnapshot(data);
          if (!s) return "";
          return `<!-- Net Worth Snapshot -->
    <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
      <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Net Worth Snapshot</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#9a9a9a;">Liquid Savings</td>
          <td style="padding:6px 0;font-size:13px;color:#eeeae4;text-align:right;font-weight:600;">${s.fmtINR(s.savings)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#9a9a9a;">Investments</td>
          <td style="padding:6px 0;font-size:13px;color:#eeeae4;text-align:right;font-weight:600;">${s.fmtINR(s.investments)}</td>
        </tr>
        <tr style="border-top:1px solid #2a2a2a;">
          <td style="padding:8px 0 2px;font-size:14px;color:#c9a84c;font-weight:700;">Net Worth</td>
          <td style="padding:8px 0 2px;font-size:14px;color:#c9a84c;text-align:right;font-weight:700;">${s.fmtINR(s.netWorth)}</td>
        </tr>
      </table>
    </div>`;
        })()
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <!-- Preheader: visible as inbox preview text, hidden in email body -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${
    expenseSummary && expenseSummary.totalExpenses > 0
      ? `${expenseSummary.fmtINR(expenseSummary.totalExpenses)} spent${expenseSummary.savingsRate !== null ? ` · Savings rate ${expenseSummary.savingsRate}%` : ""} — ${expenseSummary.periodLabel}`
      : reminders.length > 0
        ? `${reminders.length} reminder${reminders.length !== 1 ? "s" : ""} — ${reminders.map((r) => r.title).join(", ")}`
        : "All clear! No active reminders."
  }&zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847;</div>
  <div style="max-width:520px;margin:32px auto;background:#18181c;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a1f,#18181c);padding:24px 28px;border-bottom:1px solid #2a2a2a;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#c9a84c22;border:1px solid #c9a84c44;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">💰</div>
        <div>
          <div style="font-size:17px;font-weight:700;color:#c9a84c;">${householdName || "WealthOS"}</div>
          <div style="font-size:12px;color:#666;margin-top:1px;">${freqLabel} · ${today}</div>
        </div>
      </div>
    </div>
    <!-- Reminders -->
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
      ${noRemindersRow}
    </table>
    ${expenseSection}
    ${snapshotSection}
    <!-- Footer -->
    <div style="padding:16px 28px;background:#111114;border-top:1px solid #2a2a2a;">
      <div style="font-size:11px;color:#555;text-align:center;">
        Sent by WealthOS · Open the app to take action${isForced ? " · Manual send" : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify the request comes from Vercel Cron or has a secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    const isVercelCron = req.headers["x-vercel-cron"] === "true";
    if (!isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const resend = getResend();
    const db = getDb();
    const isDev = process.env.VITE_ENV === "dev";
    const prefix = isDev ? "dev_data" : "data";
    const isTest = req.query?.test === "1";
    // force=1: used by "Send Now" button — bypasses schedule, sends real data now
    const isForced = req.query?.force === "1";

    // Get all households
    const householdsRef = db.collection("households");
    const households = await householdsRef.listDocuments();

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const householdDoc of households) {
      // Read user data to check for reminders
      const dataSnaps = await householdDoc.collection(prefix).get();
      const data = {};
      dataSnaps.forEach((doc) => {
        data[doc.id] = doc.data();
      });

      // Each household configures their own reminder email in Settings
      const toEmail = data.shared?.reminderEmail?.trim();
      if (!toEmail) {
        skipped++;
        continue; // No email configured — skip silently
      }

      // Respect the enabled toggle (default: enabled if email is set)
      const reminderEnabled = data.shared?.reminderEnabled !== false;
      if (!reminderEnabled && !isTest && !isForced) {
        skipped++;
        continue;
      }

      // Respect frequency setting — cron runs daily, we skip based on day
      const frequency = data.shared?.reminderFrequency || "daily";
      if (!isTest && !isForced) {
        const now = new Date();
        if (frequency === "weekly" && now.getDay() !== 1) {
          skipped++; // Only send on Mondays
          continue;
        }
        if (frequency === "monthly" && now.getDate() !== 1) {
          skipped++; // Only send on 1st of month
          continue;
        }
      }

      const reminders = buildReminders(data);

      // Build expense summary for ALL frequencies (including daily = yesterday's spend)
      const expSummaryForSkipCheck =
        frequency === "daily" ? buildExpenseSummary(data, "daily") : null;

      // Normal cron: skip if nothing to send
      // For daily: also send if there was spend yesterday (even with no reminders)
      const hasYesterdaySpend =
        frequency === "daily" &&
        expSummaryForSkipCheck &&
        expSummaryForSkipCheck.totalExpenses > 0;
      if (
        reminders.length === 0 &&
        !hasYesterdaySpend &&
        !isTest &&
        !isForced
      ) {
        skipped++;
        continue;
      }

      const householdName = data.shared?.profile?.householdName || "WealthOS";

      // test=1: placeholder content only (used by scripts/test-email.js equivalent)
      // force=1 or cron: always use real data
      const displayReminders =
        isTest && reminders.length === 0
          ? [
              {
                title: "Test reminder — everything is working!",
                body: "This is a test email from WealthOS. Daily reminders are active.",
                tag: "test",
              },
            ]
          : reminders;

      // Expense summary: include on force, weekly, monthly, and daily sends
      const expSummary =
        isForced || frequency === "weekly" || frequency === "monthly"
          ? buildExpenseSummary(data, isForced ? "monthly" : frequency)
          : expSummaryForSkipCheck; // daily: already computed above (yesterday's data)

      // Net worth snapshot: monthly and force sends
      const showSnapshot = frequency === "monthly" || isForced;

      const subject = isTest
        ? `WealthOS: Test email for ${householdName}`
        : isForced
          ? `WealthOS: Your financial summary — ${householdName}`
          : frequency === "daily" && hasYesterdaySpend && reminders.length === 0
            ? `WealthOS: ₹${Math.round(expSummaryForSkipCheck.totalExpenses).toLocaleString("en-IN")} spent yesterday — ${householdName}`
            : reminders.length === 1
              ? `WealthOS: ${reminders[0].title}`
              : `WealthOS: ${reminders.length} reminders for ${householdName}`;

      try {
        const fromAddress =
          process.env.RESEND_FROM || "WealthOS <onboarding@resend.dev>";
        const emailOpts = {
          includeSnapshot: showSnapshot,
          expenseSummary: expSummary,
          isForced,
          frequency,
          data,
        };
        await resend.emails.send({
          from: fromAddress,
          to: toEmail,
          reply_to: toEmail, // Reply-To = recipient so replies don't bounce
          subject,
          // Plain-text version — critical for spam filters (HTML-only = spam signal)
          text: buildPlainText(displayReminders, householdName, emailOpts),
          html: buildEmailHtml(displayReminders, householdName, emailOpts),
          headers: {
            // List-Unsubscribe: required by Gmail/Yahoo bulk sender policy (Feb 2024)
            // Points to Settings page so users can disable reminders in-app
            "List-Unsubscribe": `<https://wealthos.app/settings#notifications>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            // Unique per-send ID prevents Gmail from thread-collapsing all emails
            "X-Entity-Ref-ID": `${householdDoc.id}-${Date.now()}`,
          },
        });
        sent++;
      } catch (err) {
        console.error(`Resend error for household ${householdDoc.id}:`, err);
        errors++;
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Email reminder error:", err);
    return res.status(500).json({ error: err.message });
  }
}
