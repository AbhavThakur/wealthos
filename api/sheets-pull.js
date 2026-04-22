// Vercel Serverless Function — pull rows from a Google Sheets tab → WealthOS
//
// POST /api/sheets-pull
// Body: { uid: string, sheetName: string }
// Response: { ok: true, rows: object[], sheetName: string }
//
// Returns header-keyed row objects, including _id and _synced_at columns.
// The client is responsible for merging/previewing the returned rows.

import { getDb, getAccessToken } from "./_sheetsLib.js";

const ALLOWED_SHEETS = [
  "Transactions_P1",
  "Transactions_P2",
  "Budget_P1",
  "Budget_P2",
  "Investments_P1",
  "Investments_P2",
  "Goals",
  "NetWorth",
];

async function readSheetRows(accessToken, spreadsheetId, sheetName) {
  // Read the full sheet — columns A to Z, all rows
  const range = `${sheetName}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Sheet read failed: ${await res.text()}`);
  const data = await res.json();
  const values = data.values || [];

  // Empty sheet or header-only — nothing to return
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

export default async function handler(req, res) {
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  res.setHeader("Access-Control-Allow-Origin", appUrl || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { uid, sheetName } = req.body || {};

  if (
    !uid ||
    typeof uid !== "string" ||
    uid.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(uid)
  ) {
    return res.status(400).json({ ok: false, error: "Invalid uid" });
  }
  if (!sheetName || !ALLOWED_SHEETS.includes(sheetName)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid sheetName. Must be one of: ${ALLOWED_SHEETS.join(", ")}`,
    });
  }

  try {
    const db = getDb();
    const snap = await db
      .collection("households")
      .doc(uid)
      .collection("integrations")
      .doc("google")
      .get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ ok: false, error: "Google Sheets not connected" });
    }

    const { encryptedRefreshToken, spreadsheetId } = snap.data();
    const accessToken = await getAccessToken(encryptedRefreshToken);
    const rows = await readSheetRows(accessToken, spreadsheetId, sheetName);

    return res.json({ ok: true, rows, sheetName });
  } catch (err) {
    console.error("[sheets-pull] Error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to read from Google Sheets" });
  }
}
