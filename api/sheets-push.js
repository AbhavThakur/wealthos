// Vercel Serverless Function — push WealthOS data → Google Sheets tab
//
// POST /api/sheets-push
// Body: { uid: string, sheetName: string, rows: object[], env?: string }
// Response: { ok: true, updatedRows: number }
//
// AI-Ready 7-Tab Schema & Legacy Fallback Support

import { getDb, getAccessToken } from "./_sheetsLib.js";

// ── Tab color definitions ─────────────────────────────────────────────────────
const TAB_COLORS = {
  Monthly_Summary: { red: 0.06, green: 0.73, blue: 0.51 }, // Emerald Green
  All_Transactions: { red: 0.23, green: 0.51, blue: 0.96 }, // Royal Blue
  Budget_vs_Actual: { red: 0.96, green: 0.62, blue: 0.04 }, // Amber Gold
  "Investments_&_Assets": { red: 0.39, green: 0.40, blue: 0.95 }, // Indigo
  Goals_Tracker: { red: 0.55, green: 0.36, blue: 0.96 }, // Purple
  Net_Worth_History: { red: 0.08, green: 0.72, blue: 0.65 }, // Teal
  "AI_Prompts_&_Formulas": { red: 0.96, green: 0.25, blue: 0.37 }, // Rose
};

// ── Column keys per tab ───────────────────────────────────────────────────────
const SHEET_COLUMNS = {
  Monthly_Summary: [
    "month",
    "year",
    "monthName",
    "totalIncome",
    "p1Income",
    "p2Income",
    "totalExpenses",
    "p1Expenses",
    "p2Expenses",
    "sharedExpenses",
    "needsSpent",
    "needsPct",
    "wantsSpent",
    "wantsPct",
    "savingsInvested",
    "savingsRatePct",
    "monthlySurplus",
    "totalSips",
    "totalAssets",
    "totalLiabilities",
    "netWorth",
    "momNetWorthChange",
    "statusNotes",
  ],
  All_Transactions: [
    "date",
    "month",
    "person",
    "type",
    "category",
    "subcategory",
    "description",
    "amount",
    "budgetBucket",
    "isSplit",
    "paidBy",
    "accountLinked",
    "notes",
  ],
  Budget_vs_Actual: [
    "month",
    "person",
    "category",
    "ruleBucket",
    "budgetedLimit",
    "actualSpent",
    "variance",
    "utilizationPct",
    "status",
  ],
  "Investments_&_Assets": [
    "owner",
    "assetName",
    "assetClass",
    "subType",
    "frequency",
    "monthlySip",
    "investedCorpus",
    "currentCorpus",
    "unrealizedGain",
    "returnPct",
    "allocationPct",
    "targetAllocationPct",
    "platform",
    "startDate",
  ],
  Goals_Tracker: [
    "goalName",
    "category",
    "targetAmount",
    "currentSaved",
    "p1Saved",
    "p2Saved",
    "targetDeadline",
    "monthsRemaining",
    "progressPct",
    "remainingAmount",
    "monthlyContributionNeeded",
    "status",
  ],
  Net_Worth_History: [
    "month",
    "cashBankBalances",
    "equityMutualFunds",
    "fixedDepositsPf",
    "goldOtherAssets",
    "totalAssets",
    "creditCardDues",
    "personalHomeLoans",
    "totalLiabilities",
    "netWorth",
    "momGrowthAmount",
    "momGrowthPct",
  ],
  "AI_Prompts_&_Formulas": [
    "category",
    "useCase",
    "promptOrFormula",
    "targetRange",
    "expectedOutput",
  ],

  // Legacy fallback schemas
  Transactions_P1: ["_id", "date", "desc", "amount", "type", "category"],
  Transactions_P2: ["_id", "date", "desc", "amount", "type", "category"],
  Budget_P1: ["_id", "name", "category", "allocated", "type", "recurrence"],
  Budget_P2: ["_id", "name", "category", "allocated", "type", "recurrence"],
  Investments_P1: ["_id", "name", "type", "sipMonthly", "corpus", "startDate"],
  Investments_P2: ["_id", "name", "type", "sipMonthly", "corpus", "startDate"],
  Goals: ["_id", "name", "target", "deadline", "p1Saved", "p2Saved"],
  NetWorth: ["date", "totalAssets", "totalLiabilities", "netWorth"],
};

// ── Human-readable column header labels ───────────────────────────────────────
const HEADER_LABELS = {
  month: "Month (YYYY-MM)",
  year: "Year",
  monthName: "Month",
  totalIncome: "Total Income (₹)",
  p1Income: "P1 Income (₹)",
  p2Income: "P2 Income (₹)",
  totalExpenses: "Total Expenses (₹)",
  p1Expenses: "P1 Expenses (₹)",
  p2Expenses: "P2 Expenses (₹)",
  sharedExpenses: "Shared Expenses (₹)",
  needsSpent: "Needs Spend (₹)",
  needsPct: "Needs Share (%)",
  wantsSpent: "Wants Spend (₹)",
  wantsPct: "Wants Share (%)",
  savingsInvested: "Savings & Invested (₹)",
  savingsRatePct: "Savings Rate (%)",
  monthlySurplus: "Monthly Surplus / Deficit (₹)",
  budgetVariance: "Budget Variance (₹)",
  totalSips: "Active Monthly SIPs (₹)",
  totalAssets: "Total Assets (₹)",
  totalLiabilities: "Total Liabilities (₹)",
  netWorth: "Net Worth (₹)",
  momNetWorthChange: "MoM Net Worth Change (₹)",
  statusNotes: "Financial Health Status",

  date: "Date (YYYY-MM-DD)",
  person: "Person",
  type: "Type",
  category: "Category",
  subcategory: "Subcategory",
  description: "Description / Merchant",
  amount: "Amount (₹)",
  budgetBucket: "50/30/20 Bucket",
  isSplit: "Split with Partner",
  paidBy: "Paid By",
  accountLinked: "Linked Account",
  notes: "Notes",

  ruleBucket: "50/30/20 Rule Bucket",
  budgetedLimit: "Budget Limit (₹)",
  actualSpent: "Actual Spend (₹)",
  variance: "Variance (Surplus/Deficit) (₹)",
  utilizationPct: "Utilization (%)",
  status: "Status",

  owner: "Owner",
  assetName: "Asset / Fund Name",
  assetClass: "Asset Class",
  subType: "Type / Subcategory",
  frequency: "Frequency",
  monthlySip: "Monthly SIP (₹)",
  investedCorpus: "Invested Corpus (₹)",
  currentCorpus: "Current Value (₹)",
  unrealizedGain: "Total Gain / Growth (₹)",
  returnPct: "Return Rate (% p.a.)",
  allocationPct: "Allocation (%)",
  targetAllocationPct: "Target Allocation (%)",
  platform: "Platform / Broker",
  startDate: "Start Date",

  goalName: "Goal Name",
  targetAmount: "Target (₹)",
  currentSaved: "Current Saved (₹)",
  p1Saved: "P1 Saved (₹)",
  p2Saved: "P2 Saved (₹)",
  targetDeadline: "Target Deadline (YYYY-MM)",
  monthsRemaining: "Months Remaining",
  progressPct: "Progress (%)",
  remainingAmount: "Remaining (₹)",
  monthlyContributionNeeded: "Monthly Needed (₹)",

  cashBankBalances: "Cash & Bank (₹)",
  equityMutualFunds: "Equities & MFs (₹)",
  fixedDepositsPf: "Fixed Deposits & PF (₹)",
  goldOtherAssets: "Gold & Other (₹)",
  creditCardDues: "Credit Cards (₹)",
  personalHomeLoans: "Loans & EMIs (₹)",
  momGrowthAmount: "MoM Growth Amount (₹)",
  momGrowthPct: "MoM Growth (%)",

  useCase: "Use Case",
  promptOrFormula: "Gemini AI Prompt / AI Formula",
  targetRange: "Target Sheet Range",
  expectedOutput: "Expected AI Output / Insight",
};

const CURRENCY_COLUMNS = new Set([
  "totalIncome",
  "p1Income",
  "p2Income",
  "totalExpenses",
  "p1Expenses",
  "p2Expenses",
  "sharedExpenses",
  "needsSpent",
  "wantsSpent",
  "savingsInvested",
  "monthlySurplus",
  "budgetVariance",
  "totalSips",
  "totalAssets",
  "totalLiabilities",
  "netWorth",
  "momNetWorthChange",
  "amount",
  "budgetedLimit",
  "actualSpent",
  "variance",
  "monthlySip",
  "investedCorpus",
  "currentCorpus",
  "unrealizedGain",
  "targetAmount",
  "currentSaved",
  "p1Saved",
  "p2Saved",
  "remainingAmount",
  "monthlyContributionNeeded",
  "cashBankBalances",
  "equityMutualFunds",
  "fixedDepositsPf",
  "goldOtherAssets",
  "creditCardDues",
  "personalHomeLoans",
  "momGrowthAmount",
]);

const PERCENTAGE_COLUMNS = new Set([
  "savingsRatePct",
  "needsPct",
  "wantsPct",
  "utilizationPct",
  "allocationPct",
  "targetAllocationPct",
  "returnPct",
  "progressPct",
  "momGrowthPct",
]);

const ALLOWED_SHEETS = Object.keys(SHEET_COLUMNS);
const MAX_ROWS = 10_000;

async function getSpreadsheetMeta(accessToken, spreadsheetId) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!metaRes.ok) return null;
  return metaRes.json();
}

async function ensureSheetTabExistsAndFormat(accessToken, spreadsheetId, sheetName, totalCols) {
  try {
    const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
    if (!meta) return;

    const sheets = meta.sheets || [];
    let sheetObj = sheets.find((s) => s.properties?.title === sheetName);
    let sheetId;

    if (!sheetObj) {
      // Add sheet
      const addRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: sheetName } } }],
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (addRes.ok) {
        const addData = await addRes.json();
        sheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
      }
    } else {
      sheetId = sheetObj.properties?.sheetId;
    }

    // Auto-cleanup legacy deprecated tabs (e.g. Transactions_P1, Sheet1) when writing AI-ready tabs
    const LEGACY_TABS_TO_DELETE = [
      "Transactions_P1",
      "Transactions_P2",
      "Budget_P1",
      "Budget_P2",
      "Investments_P1",
      "Investments_P2",
      "Goals",
      "NetWorth",
      "Sheet1",
    ];
    const isAiTab = [
      "Monthly_Summary",
      "All_Transactions",
      "Budget_vs_Actual",
      "Investments_&_Assets",
      "Goals_Tracker",
      "Net_Worth_History",
      "AI_Prompts_&_Formulas",
    ].includes(sheetName);

    if (isAiTab && sheets.length > 1) {
      const legacySheetsToDelete = sheets.filter(
        (s) =>
          LEGACY_TABS_TO_DELETE.includes(s.properties?.title) &&
          s.properties?.sheetId !== sheetId,
      );
      // Ensure we leave at least 1 sheet in the workbook before deleting
      if (legacySheetsToDelete.length > 0 && sheets.length > legacySheetsToDelete.length) {
        const deleteRequests = legacySheetsToDelete.map((s) => ({
          deleteSheet: { sheetId: s.properties.sheetId },
        }));
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests: deleteRequests }),
            signal: AbortSignal.timeout(10_000),
          },
        );
      }
    }

    if (sheetId !== undefined) {
      // Format sheet: Tab Color, Freeze Row 1, Header Styling, Reset Old Format Cache, Apply Column Formats
      const tabColor = TAB_COLORS[sheetName] || { red: 0.2, green: 0.4, blue: 0.8 };
      const requests = [
        // 1. Set Tab Color & Freeze Row 1
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              tabColorStyle: { rgbColor: tabColor },
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "tabColorStyle,gridProperties.frozenRowCount",
          },
        },
        // 2. Format Header Row (Dark Slate Background, Bold White Text, Centered)
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: totalCols,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.118, green: 0.161, blue: 0.231 }, // #1E293B
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true,
                  fontSize: 10,
                },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "CLIP",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        },
        // 3. Reset all data cell formatting to clean slate (wipes obsolete date/percent cache from prior schemas)
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: 0,
              endColumnIndex: Math.max(totalCols, 30),
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "TEXT",
                },
                horizontalAlignment: "LEFT",
              },
            },
            fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
          },
        },
        // 4. Auto-resize all columns to fit contents
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: totalCols,
            },
          },
        },
      ];

      // 5. Apply explicit Number & Currency formatting per column
      const cols = SHEET_COLUMNS[sheetName] || [];
      cols.forEach((col, cIdx) => {
        if (CURRENCY_COLUMNS.has(col)) {
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: cIdx,
                endColumnIndex: cIdx + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: "CURRENCY",
                    pattern: "₹#,##,##0",
                  },
                  horizontalAlignment: "RIGHT",
                },
              },
              fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
            },
          });
        } else if (PERCENTAGE_COLUMNS.has(col)) {
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: cIdx,
                endColumnIndex: cIdx + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: "NUMBER",
                    pattern: "0\"%\"",
                  },
                  horizontalAlignment: "RIGHT",
                },
              },
              fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
            },
          });
        } else if (
          col === "month" ||
          col === "date" ||
          col === "startDate" ||
          col === "targetDeadline" ||
          col === "year" ||
          col === "monthsRemaining" ||
          col === "isSplit"
        ) {
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: cIdx,
                endColumnIndex: cIdx + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: "TEXT",
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
            },
          });
        }
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    }
  } catch (err) {
    console.warn(`[sheets-push] ensureSheetTabExistsAndFormat(${sheetName}):`, err.message);
  }
}

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

// ── Convert row objects → 2D array with clean human-readable headers ──────────
const LEGACY_TABS_SET = new Set([
  "Transactions_P1",
  "Transactions_P2",
  "Budget_P1",
  "Budget_P2",
  "Investments_P1",
  "Investments_P2",
  "Goals",
  "NetWorth",
]);

function buildValues(sheetName, columns, rows) {
  const isLegacy = LEGACY_TABS_SET.has(sheetName);
  
  const headers = isLegacy
    ? [...columns, "_synced_at"]
    : columns.map((col) => HEADER_LABELS[col] || col);

  const syncedAt = new Date().toISOString();

  const dataRows = rows.map((row) => [
    ...columns.map((col) => {
      const v = row[col];
      return v === undefined || v === null ? "" : v;
    }),
    ...(isLegacy ? [syncedAt] : []),
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

  const { uid, sheetName, rows, env } = req.body || {};
  const isDev = env === "dev" || process.env.VITE_ENV === "dev";
  const docName = isDev ? "google_dev" : "google";

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
      .doc(docName)
      .get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({
          ok: false,
          error: `Google Sheets not connected in ${isDev ? "Dev" : "Production"} environment`,
        });
    }

    const { encryptedRefreshToken, spreadsheetId } = snap.data();
    const accessToken = await getAccessToken(encryptedRefreshToken);
    const columns = SHEET_COLUMNS[sheetName];
    const values = buildValues(sheetName, columns, rows);

    await ensureSheetTabExistsAndFormat(
      accessToken,
      spreadsheetId,
      sheetName,
      columns.length + (sheetName.startsWith("Transactions_") ? 1 : 0),
    );
    await clearSheet(accessToken, spreadsheetId, sheetName);
    const updatedRows = await writeSheet(
      accessToken,
      spreadsheetId,
      sheetName,
      values,
    );

    await snap.ref.update({ lastSyncedAt: new Date().toISOString() }).catch(() => {});

    return res.json({ ok: true, updatedRows });
  } catch (err) {
    console.error("[sheets-push] Error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Failed to push to Google Sheets" });
  }
}
