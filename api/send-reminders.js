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

  // Check both persons' insurance renewals
  for (const personKey of ["person1", "person2"]) {
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

  // Budget overspend alerts
  for (const personKey of ["person1", "person2"]) {
    const person = data[personKey];
    if (!person) continue;
    for (const alert of person.budgetAlerts || []) {
      if (!alert.active) continue;
      const spent = (person.expenses || [])
        .filter(
          (e) => e.category === alert.category && e.expenseType === "monthly",
        )
        .reduce((s, e) => s + e.amount, 0);
      if (spent > alert.limit) {
        reminders.push({
          title: `Budget alert: ${alert.category}`,
          body: `Spent ₹${Math.round(spent).toLocaleString()} of ₹${Math.round(alert.limit).toLocaleString()} limit.`,
          tag: `budget-${alert.category}`,
        });
      }
    }
  }

  return reminders.slice(0, 10);
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

// ── Build HTML email body ──────────────────────────────────────────────────
function buildEmailHtml(
  reminders,
  householdName,
  { includeSnapshot, data } = {},
) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#18181c;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a1f,#18181c);padding:24px 28px;border-bottom:1px solid #2a2a2a;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#c9a84c22;border:1px solid #c9a84c44;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">💰</div>
        <div>
          <div style="font-size:17px;font-weight:700;color:#c9a84c;">${householdName || "WealthOS"}</div>
          <div style="font-size:12px;color:#666;margin-top:1px;">Daily Reminder · ${today}</div>
        </div>
      </div>
    </div>
    <!-- Reminders -->
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
    ${
      includeSnapshot && data
        ? (() => {
            const s = buildSnapshot(data);
            return `<!-- Financial Snapshot -->
    <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
      <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Monthly Snapshot</div>
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
        : ""
    }
    <!-- Footer -->
    <div style="padding:16px 28px;background:#111114;border-top:1px solid #2a2a2a;">
      <div style="font-size:11px;color:#555;text-align:center;">
        Sent by WealthOS · Open the app to take action
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
      if (!reminderEnabled && !isTest) {
        skipped++;
        continue;
      }

      // Respect frequency setting — cron runs daily, we skip based on day
      const frequency = data.shared?.reminderFrequency || "daily";
      if (!isTest) {
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
      if (reminders.length === 0 && !isTest) {
        skipped++;
        continue; // Nothing to remind today (skip in normal mode)
      }

      const householdName = data.shared?.profile?.householdName || "WealthOS";
      const displayReminders =
        reminders.length > 0
          ? reminders
          : [
              {
                title: "Test reminder — everything is working!",
                body: "This is a test email from WealthOS. Daily reminders are active.",
                tag: "test",
              },
            ];
      const subject = isTest
        ? `WealthOS: Test email for ${householdName}`
        : reminders.length === 1
          ? `WealthOS: ${reminders[0].title}`
          : `WealthOS: ${reminders.length} reminders for today`;

      try {
        await resend.emails.send({
          from: "WealthOS <onboarding@resend.dev>",
          to: toEmail,
          subject,
          html: buildEmailHtml(displayReminders, householdName, {
            includeSnapshot: frequency === "monthly" || isTest,
            data,
          }),
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
