// Vercel Serverless Function — push WealthOS data → Google Sheets tab
//
// POST /api/sheets-push
// Body: { uid: string, sheetName: string, rows: object[] }
// Response: { ok: true, updatedRows: number }
//
// Supported sheetName values and their column headers:
//   Transactions_P1/P2  — _id, date, desc, amount, type, category
//   Budget_P1/P2        — _id, name, category, allocated, type, recurrence
//   Investments_P1/P2   — _id, name, type, sipMonthly, corpus, startDate
//   Goals               — _id, name, target, deadline, p1Saved, p2Saved
//   NetWorth            — date, totalAssets, totalLiabilities, netWorth
//
// Each row also gets a _synced_at column appended automatically.

import { getDb, getAccessToken } from "./_sheetsLib.js";

// ── Column schemas per tab ────────────────────────────────────────────────────
const SHEET_COLUMNS = {
  Transactions_P1: ["_id", "date", "desc", "amount", "type", "category"],
  Transactions_P2: ["_id", "date", "desc", "amount", "type", "category"],
  Budget_P1: ["_id", "name", "category", "allocated", "type", "recurrence"],
  Budget_P2: ["_id", "name", "category", "allocated", "type", "recurrence"],
  Investments_P1: ["_id", "name", "type", "sipMonthly", "corpus", "startDate"],
  Investments_P2: ["_id", "name", "type", "sipMonthly", "corpus", "startDate"],
  Goals: ["_id", "name", "target", "deadline", "p1Saved", "p2Saved"],
  NetWorth: ["date", "totalAssets", "totalLiabilities", "netWorth"],
};
const ALLOWED_SHEETS = Object.keys(SHEET_COLUMNS);
const MAX_ROWS = 10_000;

// ── Sheets API helpers ────────────────────────────────────────────────────────
async function clearSheet(accessToken, spreadsheetId, sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Sheet clear failed: ${await res.text()}`);
}

async function writeSheet(accessToken, spreadsheetId, sheetName, values) {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Sheet write failed: ${await res.text()}`);
  const data = await res.json();
  return data.updatedRows || values.length;
}

// ── Convert row objects → 2D array with headers ───────────────────────────────
function buildValues(columns, rows) {
  const syncedAt = new Date().toISOString();
  const headers = [...columns, "_synced_at"];
  const dataRows = rows.map((row) => [
    ...columns.map((col) => {
      const v = row[col];
      return v === undefined || v === null ? "" : v;
    }),
    syncedAt,
  ]);
  return [headers, ...dataRows];
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  res.setHeader("Access-Control-Allow-Origin", appUrl || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { uid, sheetName, rows } = req.body || {};

  // Input validation
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
  if (!Array.isArray(rows)) {
    return res.status(400).json({ ok: false, error: "rows must be an array" });
  }
  if (rows.length > MAX_ROWS) {
    return res
      .status(400)
      .json({ ok: false, error: `Too many rows (max ${MAX_ROWS})` });
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
        .json({
          ok: false,
          error: "Google Sheets not connected for this user",
        });
    }

    const { encryptedRefreshToken, spreadsheetId } = snap.data();
    const accessToken = await getAccessToken(encryptedRefreshToken);
    const columns = SHEET_COLUMNS[sheetName];
    const values = buildValues(columns, rows);

    await clearSheet(accessToken, spreadsheetId, sheetName);
    const updatedRows = await writeSheet(
      accessToken,
      spreadsheetId,
      sheetName,
      values,
    );

    return res.json({ ok: true, updatedRows });
  } catch (err) {
    console.error("[sheets-push] Error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to push to Google Sheets" });
  }
}
