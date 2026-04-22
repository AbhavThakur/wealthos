// Shared helpers for Google Sheets serverless functions.
// This file is NOT an API route (Vercel ignores _ prefixed files in /api).
//
// Exports: getDb, encrypt, decrypt, getAccessToken
//
// Required env vars:
//   VITE_FIREBASE_PROJECT_ID, FIREBASE_SA_CLIENT_EMAIL, FIREBASE_SA_PRIVATE_KEY
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   SHEETS_ENCRYPTION_KEY   — 64 hex chars (32 bytes) for AES-256-GCM

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin ────────────────────────────────────────────────────────────
export function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_SA_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_SA_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n",
        ),
      }),
    });
  }
  return getFirestore();
}

// ── AES-256-GCM token encryption ──────────────────────────────────────────────
function getKey() {
  const hex = process.env.SHEETS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64)
    throw new Error("SHEETS_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}

// Returns "ivHex:authTagHex:ciphertextHex"
export function encrypt(plaintext) {
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(encrypted) {
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted token");
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

// ── Refresh an OAuth access token ────────────────────────────────────────────
export async function getAccessToken(encryptedRefreshToken) {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.access_token)
    throw new Error("No access_token in refresh response");
  return json.access_token;
}
