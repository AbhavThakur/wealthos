#!/usr/bin/env node
/**
 * Quick local email test — sends a real email using your Resend key.
 * No Vercel needed. Run from project root:
 *
 *   node scripts/test-email.js
 *
 * Reads RESEND_API_KEY and REMINDER_TO_EMAIL (optional) from .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local manually ───────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
let envVars = {};
try {
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    envVars[key] = val;
  }
} catch {
  console.error(
    "❌  Could not read .env.local — make sure you're running from the project root.",
  );
  process.exit(1);
}

const RESEND_API_KEY = envVars["RESEND_API_KEY"];
const TO_EMAIL = envVars["REMINDER_TO_EMAIL"] || process.argv[2];

if (!RESEND_API_KEY || RESEND_API_KEY.trim() === "") {
  console.error("❌  RESEND_API_KEY is not set in .env.local");
  console.error("    Get a free key at https://resend.com → API Keys");
  process.exit(1);
}

if (!TO_EMAIL) {
  console.error("❌  No recipient email. Set REMINDER_TO_EMAIL in .env.local");
  process.exit(1);
}

// ── Send ───────────────────────────────────────────────────────────────────
const { Resend } = await import("resend");
const resend = new Resend(RESEND_API_KEY);

console.log(`📧  Sending test email to: ${TO_EMAIL}`);

const { data, error } = await resend.emails.send({
  from: "WealthOS <onboarding@resend.dev>",
  to: TO_EMAIL,
  subject: "WealthOS — Test email (local)",
  html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px;background:#0c0c0f;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#18181c;border-radius:12px;padding:28px;border:1px solid #2a2a2a;">
    <div style="font-size:24px;margin-bottom:4px;">💰</div>
    <div style="font-size:18px;font-weight:700;color:#c9a84c;margin-bottom:8px;">WealthOS</div>
    <div style="font-size:14px;color:#9a9a9a;margin-bottom:16px;">Test email — sent ${new Date().toLocaleString("en-IN")}</div>
    <div style="font-size:14px;color:#eeeae4;line-height:1.7;">
      ✅ Your Resend email setup is working correctly.<br>
      Daily reminders will be sent based on your Settings → Notifications schedule.
    </div>
    <div style="margin-top:20px;font-size:11px;color:#555;">
      Sent by WealthOS · node scripts/test-email.js
    </div>
  </div>
</body>
</html>`,
});

if (error) {
  console.error("❌  Resend error:", error);
  process.exit(1);
}

console.log("✅  Email sent! Message ID:", data.id);
console.log(`    Check your inbox at ${TO_EMAIL}`);
