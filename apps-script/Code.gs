/**
 * WealthOS AI Copilot for Google Sheets
 * 
 * Embeds Google Gemini AI directly into your WealthOS Google Sheet
 * to analyze asset allocation, detect fund overlap, audit cashflow,
 * and simulate goal timelines across all 7 synced tabs.
 */

// ── 1. Create Top-Level Menu on Spreadsheet Open ──────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("WealthOS AI ✦")
    .addItem("🚀 Open AI Financial Copilot", "showAiSidebar")
    .addSeparator()
    .addItem("🛡️ Audit Asset Allocation & Overlap", "auditAssetAllocation")
    .addItem("💰 Audit Cashflow & Savings Rate", "auditCashflow")
    .addItem("🎯 Check Goal Readiness & Timelines", "auditGoals")
    .addItem("🧾 Tax & FD Rebalancing Advice", "auditTax")
    .addSeparator()
    .addItem("⚙️ Configure Gemini API Key", "promptApiKey")
    .addToUi();
}

// ── 2. Open Sidebar UI ────────────────────────────────────────────────────────
function showAiSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("WealthOS AI Copilot")
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

// ── 3. Menu Action Handlers ───────────────────────────────────────────────────
function auditAssetAllocation() {
  showAiSidebar();
}
function auditCashflow() {
  showAiSidebar();
}
function auditGoals() {
  showAiSidebar();
}
function auditTax() {
  showAiSidebar();
}

function promptApiKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    "Configure Gemini API Key",
    "Enter your Google Gemini API Key (Get a free key from https://aistudio.google.com/app/apikey):",
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() === ui.Button.OK) {
    const key = result.getResponseText().trim();
    if (key) {
      PropertiesService.getUserProperties().setProperty("GEMINI_API_KEY", key);
      ui.alert("Success", "Gemini API Key saved securely!", ui.ButtonSet.OK);
    }
  }
}

// ── 4. API Key Management ─────────────────────────────────────────────────────
function getApiKey() {
  return PropertiesService.getUserProperties().getProperty("GEMINI_API_KEY") || "";
}

function saveApiKeyFromUi(key) {
  if (!key || typeof key !== "string") throw new Error("Invalid API key");
  PropertiesService.getUserProperties().setProperty("GEMINI_API_KEY", key.trim());
  return { ok: true };
}

function hasApiKey() {
  return Boolean(getApiKey());
}

// ── 5. Data Extraction across WealthOS Tabs ───────────────────────────────────
function getTabContent(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return null;

  const headers = values[0];
  const rows = values.slice(1);
  return { sheetName, headers, rows };
}

function getFullFinancialContext() {
  const tabs = [
    "Investments_&_Assets",
    "Monthly_Summary",
    "Budget_vs_Actual",
    "Goals_Tracker",
    "Net_Worth_History"
  ];

  const context = {};
  tabs.forEach(tabName => {
    const data = getTabContent(tabName);
    if (data) {
      context[tabName] = {
        headers: data.headers,
        rowCount: data.rows.length,
        rows: data.rows.slice(0, 100) // Keep prompt concise
      };
    }
  });

  return context;
}

// ── 6. Gemini API Gateway ─────────────────────────────────────────────────────
function callGemini(userPrompt, selectedTabName) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key not configured. Click Settings (⚙️) to enter your free Gemini API key.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = selectedTabName 
    ? ss.getSheetByName(selectedTabName) 
    : ss.getActiveSheet();

  const currentTabData = currentSheet ? getTabContent(currentSheet.getName()) : null;
  const fullContext = getFullFinancialContext();

  const systemInstructions = `
You are the WealthOS Senior AI Financial Strategist and Quantitative Wealth Advisor.
You specialize in Indian Personal Finance, Mutual Fund Portfolio Construction (SEBI regulations), Tax Optimization (Section 112A LTCG, STCG, 80C, FD taxation), and Household Asset Allocation.

When answering:
1. Ground all your findings in the actual numbers provided in the WealthOS spreadsheet data.
2. Structure your response with clean Markdown: use bold metrics, comparison tables, and bulleted recommendations.
3. Be proactive: Identify asset allocation imbalances (e.g. excessive FD/cash drag vs equity compounding), mutual fund overlaps (e.g. multi-fund Nifty 50 holdings), high-fee ULIPs, and goal shortfalls.
4. Provide concrete, step-by-step actionable advice tailored to Indian households.
`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemInstructions}\n\n### Current Active Sheet:\n${JSON.stringify(currentTabData, null, 2)}\n\n### Complete Household Financial Context:\n${JSON.stringify(fullContext, null, 2)}\n\n### User Question / Audit Request:\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    }
  };

  // Try Gemini 2.0 Flash first, fallback to 1.5 Flash
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = UrlFetchApp.fetch(url, {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const resCode = response.getResponseCode();
      const resText = response.getContentText();
      const json = JSON.parse(resText);

      if (resCode !== 200) {
        throw new Error(json.error?.message || `Gemini API returned status ${resCode}`);
      }

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response received from Gemini.");
      return { ok: true, text, modelUsed: model };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Gemini API Error: ${lastError?.message || "Failed to generate analysis"}`);
}

// ── 7. Custom Google Sheets Formula: =WEALTHOS_AI() ───────────────────────────
/**
 * Executes a Gemini AI query on a range of spreadsheet data.
 *
 * @param {string} prompt The question or analysis to perform.
 * @param {range} [dataRange] Optional range of cells to include as context.
 * @return {string} The AI generated insight or calculation.
 * @customfunction
 */
function WEALTHOS_AI(prompt, dataRange) {
  if (!prompt) return "Error: Prompt required";
  const apiKey = getApiKey();
  if (!apiKey) return "Error: Set Gemini API Key in 'WealthOS AI ✦' menu";

  try {
    const dataContext = dataRange ? JSON.stringify(dataRange) : "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: `Perform this financial calculation/analysis strictly and concisely:\nPrompt: ${prompt}\nData: ${dataContext}` }]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
    };

    const res = UrlFetchApp.fetch(url, {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText());
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response";
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
