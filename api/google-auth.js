// Vercel Serverless Function — Google OAuth 2.0 for Sheets integration
//
// GET  /api/google-auth?action=url&uid=UID  → { ok: true, url: string }
// GET  /api/google-auth?code=XXX&state=XXX  → OAuth callback → 302 redirect
// POST /api/google-auth  body: { action: "disconnect", uid: UID } → { ok: true }
//
// Required env vars (Vercel Dashboard → Settings → Environment Variables):
//   GOOGLE_CLIENT_ID        — OAuth 2.0 Client ID (Google Cloud Console)
//   GOOGLE_CLIENT_SECRET    — OAuth 2.0 Client Secret
//   GOOGLE_REDIRECT_URI     — Exact match: https://your-app.vercel.app/api/google-auth
//   SHEETS_ENCRYPTION_KEY   — 64 hex chars for AES-256-GCM token encryption
//   SHEETS_HMAC_SECRET      — Random string for CSRF-protection state signing
//   APP_URL                 — Your app base URL (e.g. https://wealthos.vercel.app)
//   VITE_FIREBASE_PROJECT_ID, FIREBASE_SA_CLIENT_EMAIL, FIREBASE_SA_PRIVATE_KEY

import { createHmac, randomBytes } from "crypto";
import { getDb, encrypt, decrypt } from "./_sheetsLib.js";

// ── HMAC-signed state — prevents CSRF on OAuth callback ──────────────────────
function signState(uid) {
  const nonce = randomBytes(8).toString("hex");
  const payload = Buffer.from(JSON.stringify({ uid, nonce })).toString(
    "base64url",
  );
  const sig = createHmac(
    "sha256",
    process.env.SHEETS_HMAC_SECRET || "dev-fallback",
  )
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function verifyState(state) {
  if (!state || typeof state !== "string") return null;
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac(
    "sha256",
    process.env.SHEETS_HMAC_SECRET || "dev-fallback",
  )
    .update(payload)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ── Google OAuth helpers ──────────────────────────────────────────────────────
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function buildOAuthUrl(uid) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SHEETS_SCOPE,
    access_type: "offline",
    prompt: "consent", // Always request refresh_token
    state: signState(uid),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

// Creates the WealthOS spreadsheet with 8 tabs
async function createSpreadsheet(accessToken) {
  const TABS = [
    "Transactions_P1",
    "Transactions_P2",
    "Budget_P1",
    "Budget_P2",
    "Investments_P1",
    "Investments_P2",
    "Goals",
    "NetWorth",
  ];
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "WealthOS Finance" },
      sheets: TABS.map((title) => ({ properties: { title } })),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Spreadsheet creation failed: ${await res.text()}`);
  }
  const data = await res.json();
  return data.spreadsheetId;
}

async function revokeToken(token) {
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: "POST", signal: AbortSignal.timeout(5_000) },
    );
  } catch {
    // Revocation failure is non-critical — token will eventually expire
    console.warn("[google-auth] Token revocation failed (non-critical)");
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");

  res.setHeader("Access-Control-Allow-Origin", appUrl || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // ── GET ?action=url&uid=UID — generate OAuth URL ────────────────────────
  if (req.method === "GET" && req.query.action === "url") {
    const { uid } = req.query;
    if (
      !uid ||
      typeof uid !== "string" ||
      uid.length > 128 ||
      !/^[a-zA-Z0-9_-]+$/.test(uid)
    ) {
      return res.status(400).json({ ok: false, error: "Invalid uid" });
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
      return res
        .status(500)
        .json({ ok: false, error: "Google OAuth env vars not configured" });
    }
    return res.json({ ok: true, url: buildOAuthUrl(uid) });
  }

  // ── GET ?code=XXX&state=XXX — OAuth callback from Google ───────────────
  if (req.method === "GET" && req.query.code) {
    const { code, state, error } = req.query;
    const redirect = (status, reason) =>
      res.redirect(
        302,
        `${appUrl}/?sheets=${status}${reason ? `&reason=${reason}` : ""}`,
      );

    if (error) return redirect("error", "denied");
    if (!state || !code) return redirect("error", "missing_params");

    const decoded = verifyState(state);
    if (!decoded?.uid) return redirect("error", "invalid_state");

    try {
      const tokens = await exchangeCode(code);
      if (!tokens.refresh_token) {
        // prompt=consent should always yield a refresh_token; if not, revoke and retry
        return redirect("error", "no_refresh_token");
      }

      const spreadsheetId = await createSpreadsheet(tokens.access_token);

      const db = getDb();
      await db
        .collection("households")
        .doc(decoded.uid)
        .collection("integrations")
        .doc("google")
        .set({
          encryptedRefreshToken: encrypt(tokens.refresh_token),
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          connectedAt: new Date().toISOString(),
        });

      return redirect("connected");
    } catch (err) {
      console.error("[google-auth] OAuth callback error:", err);
      return redirect("error", "server_error");
    }
  }

  // ── POST — disconnect ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action, uid } = req.body || {};
    if (
      action !== "disconnect" ||
      !uid ||
      typeof uid !== "string" ||
      uid.length > 128 ||
      !/^[a-zA-Z0-9_-]+$/.test(uid)
    ) {
      return res.status(400).json({ ok: false, error: "Invalid request body" });
    }
    try {
      const db = getDb();
      const ref = db
        .collection("households")
        .doc(uid)
        .collection("integrations")
        .doc("google");
      const snap = await ref.get();
      if (snap.exists) {
        const { encryptedRefreshToken } = snap.data();
        if (encryptedRefreshToken) {
          try {
            await revokeToken(decrypt(encryptedRefreshToken));
          } catch {
            /* non-critical */
          }
        }
        await ref.delete();
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[google-auth] Disconnect error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
