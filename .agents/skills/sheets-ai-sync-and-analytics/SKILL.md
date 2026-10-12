---
name: sheets-ai-sync-and-analytics
description: Connects full-stack web applications to Google Sheets with AI-ready 7-tab schemas, automated formatting, Google NotebookLM multi-source grounding, Looker Studio live visual dashboards, and Google Sheets Apps Script Gemini sidebars.
---

# ✦ Google Sheets AI Sync & Financial Analytics Engine

This skill provides a battle-tested architecture for connecting web applications (React, Next.js, Vite, Node.js) to **Google Sheets**, **Google NotebookLM**, and **Google Looker Studio** for live visual analytics, AI audits, and automated portfolio management.

---

## 1. Architecture & 7-Tab AI-Ready Workbook Blueprint

When exporting or syncing financial/business data to Google Sheets for downstream AI tools, structure workbooks into 7 distinct, human-readable tabs:

| Tab Name | Purpose & Contents | Format Rules |
| :--- | :--- | :--- |
| **`Monthly_Summary`** | High-level monthly overview (Income, Expenses, Needs/Wants %, Monthly Surplus) | Currency (`₹#,##,##0`), Percent (`0%`), Year/Month centered |
| **`All_Transactions`** | Granular ledger (Date, Description, Category, Amount, Person, Split tag) | Dates centered, Amounts right-aligned currency |
| **`Budget_vs_Actual`** | Category-level budget targets vs actual spends with variance | Currency (`₹#,##,##0`), Variance percent (`0%`) |
| **`Investments_&_Assets`**| Portfolio holdings (Asset class, Type, Frequency, Monthly SIP, Invested corpus, Current value, Gain, Return rate %, Platform, Start Date) | Currency on corpus/SIP/gains, Percent on returns/allocations |
| **`Goals_Tracker`** | Long-term targets (Goal name, Category, Target corpus, Current corpus, Monthly SIP, Target year, Months remaining) | Currency on corpus/SIP, Months centered |
| **`Net_Worth_History`** | Monthly timeline (Equity, FDs/Debt, Real Estate, Gold, Cash, Net Worth, MoM growth amount, MoM growth %) | Currency on all net worth buckets, Percent on MoM growth |
| **`AI_Prompts_&_Formulas`**| Ready-to-copy prompts tailored for Gemini, NotebookLM, and ChatGPT | Formatted prompt blocks & formulas |

---

## 2. Google Sheets API v4 Integration & Anti-Corruption Protocol

### The "Smart Table" Corruption Pitfall & Solution
When users convert sheet ranges into native **Google Sheets Tables (Smart Tables)**, Google Sheets locks column data types (`Date`, `Dropdown Chip`, `Percent`) into the sheet metadata. Standard cell clearing (`values:clear`) **fails** to reset table metadata, causing numbers (like ₹3,798) to display as dates (`1910-05-25`) or percentages (`10833%`).

### The `recreateSheetTabFresh` Pattern
Always replace the sheet tab cleanly on sync:
1. `addSheet`: Add temporary sheet (`_tmp_${Date.now()}`).
2. `deleteSheet`: Delete the old sheet containing obsolete table metadata.
3. `updateSheetProperties`: Rename the new fresh sheet to the target `sheetName`.
4. `writeSheet`: Write 2D array of headers and values (`valueInputOption: "USER_ENTERED"`).
5. `formatSheet`: Apply `batchUpdate` formatting in a single request:
   - Freeze Row 1: `gridProperties: { frozenRowCount: 1 }`
   - Dark Slate Header: Background `#1E293B`, Bold White Text `#FFFFFF`, Centered.
   - Currency Formatting: `type: "CURRENCY"`, `pattern: "₹#,##,##0"`.
   - Percentage Formatting: `type: "NUMBER"`, `pattern: "0\"%\""`.
   - Centered Formatting: Text alignment `"CENTER"` on dates, months, and years.
   - Auto-Resize: `autoResizeDimensions` across `startIndex: 0` to `endIndex: totalCols`.

---

## 3. Google NotebookLM (Gemini Notebook) Research Engine

### Multi-Source Financial Intelligence
NotebookLM allows attaching up to 50 sources to a single notebook:
* **Source 1**: Live Synced `WealthOS Finance` Google Sheet.
* **Source 2**: CAMS / KFintech Consolidated Account Statement (CAS) PDF.
* **Source 3**: Tax ITR-1 / ITR-2 / Form 16 PDF.
* **Source 4**: EPF / Insurance Policy Statements.

### Core Strategic Prompts:
* **Asset Allocation & Overlap Audit:**
  ```text
  Analyze the Investments_&_Assets tab. Calculate the exact % Equity, % Debt/FDs, % Gold, and % ULIP. Identify mutual fund overlap across large-cap holdings and quantify the FD interest drag vs inflation.
  ```
* **Financial Stress Test:**
  ```text
  Act as an aggressive portfolio risk auditor. Identify our single biggest financial vulnerability. Calculate what happens to our monthly cashflow if primary income drops by 30%, and how many months our liquid emergency fund will last without touching lock-in FDs.
  ```
* **5-Year Compounding Projection Matrix:**
  ```text
  Create a markdown table projecting our Net Worth over 5 years under three compounding scenarios: Bear (8% equity), Base (12% equity), and Bull (15% equity), accounting for our monthly SIPs and 6% inflation.
  ```

### Audio Overview (AI Deep Dive Podcast)
Click **Generate Audio Overview** in NotebookLM to synthesize all connected spreadsheets into an interactive 10-minute conversational podcast between two AI hosts.

---

## 4. Google Looker Studio Live Visual Dashboards

### 3-Minute Live Dashboard Setup:
1. Go to `lookerstudio.google.com` $\rightarrow$ Create Report $\rightarrow$ Connect **Google Sheets**.
2. Select the `WealthOS Finance` spreadsheet $\rightarrow$ select `Investments_&_Assets`.
3. Add Visuals:
   - **Pie Chart**: Dimension = `Asset Class`, Metric = `SUM(Current Value (₹))`.
   - **KPI Scorecards**: `SUM(Current Value (₹))` (Total Net Worth) & `SUM(Monthly SIP (₹))` (Monthly SIP Rate).
   - **Line Chart**: Connect `Net_Worth_History` tab $\rightarrow$ Dimension = `month`, Metric = `Total Net Worth (₹)`.
4. Set Data Freshness to **Every 15 minutes** for continuous real-time updates.

---

## 5. In-Sheet Gemini Copilot (Google Apps Script)

Add container-bound Apps Script to Google Sheets (`Extensions` $\rightarrow$ `Apps Script`):
* `Code.gs`: Handles `onOpen()`, extracts workbook snapshot, calls Gemini API (`gemini-2.0-flash`), and registers custom formula `=WEALTHOS_AI(prompt, dataRange)`.
* `Sidebar.html`: Renders a dark-mode interactive sidebar with One-Click Audits and conversational Q&A.
