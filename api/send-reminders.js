/* global process */
// Vercel Serverless Function — sends push notifications for WealthOS
// Triggered by Vercel Cron (daily) or manual GET /api/send-reminders
//
// Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL,
// and Firebase service account credentials (FIREBASE_SA_* vars).

import webpush from "web-push";
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

// ── VAPID setup ──────────────────────────────────────────────────────────
function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:noreply@example.com",
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
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

  return reminders.slice(0, 5);
}

// ── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify the request comes from Vercel Cron or has a secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    // Allow Vercel Cron (no auth header) but block random callers if secret is set
    const isVercelCron = req.headers["x-vercel-cron"] === "true";
    if (!isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    setupVapid();
    const db = getDb();
    const isDev = process.env.VITE_ENV === "dev";
    const prefix = isDev ? "dev_data" : "data";

    // Get all households
    const householdsRef = db.collection("households");
    const households = await householdsRef.listDocuments();

    let sent = 0;
    let errors = 0;

    for (const householdDoc of households) {
      // Read push subscription
      const subDoc = await householdDoc
        .collection(prefix)
        .doc("pushSubscription")
        .get();
      if (!subDoc.exists) continue;

      const { subscription } = subDoc.data();
      if (!subscription?.endpoint) continue;

      // Read user data to check for reminders
      const dataSnaps = await householdDoc.collection(prefix).get();
      const data = {};
      dataSnaps.forEach((doc) => {
        data[doc.id] = doc.data();
      });

      const reminders = buildReminders(data);
      if (reminders.length === 0) continue;

      // Send push for each reminder
      for (const reminder of reminders) {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: reminder.title,
              body: reminder.body,
              tag: reminder.tag,
            }),
          );
          sent++;
        } catch (err) {
          errors++;
          // If subscription is expired/invalid, clean it up
          if (err.statusCode === 404 || err.statusCode === 410) {
            await subDoc.ref.delete();
            break;
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Push notification error:", err);
    return res.status(500).json({ error: err.message });
  }
}
