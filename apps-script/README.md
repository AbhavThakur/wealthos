# ✦ WealthOS AI Copilot for Google Sheets

Embeds **Google Gemini AI** directly inside your synced WealthOS Google Sheet to perform instant portfolio audits, fund overlap detection, cashflow analysis, and goal simulations across all 7 tabs.

---

## ⚡ 60-Second Setup Guide

### Step 1: Open Apps Script in your Google Sheet
1. Open your synced **WealthOS Finance** Google Sheet.
2. In the top menu, click **Extensions** $\rightarrow$ **Apps Script**.

---

### Step 2: Add `Code.gs` & `Sidebar.html`
1. In the Apps Script editor, open the existing `Code.gs` file.
2. Replace all its content with the contents of [`apps-script/Code.gs`](./Code.gs).
3. In the left panel, click the **`+`** icon next to *Files* $\rightarrow$ select **HTML**.
4. Name the new file **`Sidebar`** (without `.html`).
5. Paste the contents of [`apps-script/Sidebar.html`](./Sidebar.html) into it.
6. Click the **💾 Save project** icon (or `Ctrl+S` / `Cmd+S`).

---

### Step 3: Run & Authorize
1. Reload your Google Sheet tab in your browser.
2. You will now see a new menu in the Google Sheets toolbar: **`WealthOS AI ✦`**.
3. Click **`WealthOS AI ✦`** $\rightarrow$ **`🚀 Open AI Financial Copilot`**.
4. *(First time only)* Google will ask for permission to read the spreadsheet and connect to the Gemini API. Click **Review Permissions** $\rightarrow$ select your Google account $\rightarrow$ click **Allow**.

---

### Step 4: Add your Free Gemini API Key
1. In the sidebar, click the **Settings** tab (or **`WealthOS AI ✦`** $\rightarrow$ **`⚙️ Configure Gemini API Key`**).
2. Paste your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Click **Save API Key**.

---

## 🚀 Features Included

### 1. One-Click Strategic Audits
* 🛡️ **Asset Allocation & Overlap Audit**: Calculates exact equity vs FD drag and flags redundant large-cap funds.
* 💰 **Cashflow & Savings Rate Audit**: Analyzes income vs expense ratios and monthly SIP compounding capacity.
* 🎯 **Goal Readiness & Timelines**: Projects whether current SIPs reach target deadlines and calculates monthly top-ups.
* 🧾 **Tax & Rebalancing Roadmap**: Section 112A LTCG tax harvesting and smart FD deployment strategies.

### 2. Conversational Financial Q&A
Ask any question in natural language:
* *"If I reduce my FD balance by ₹10 Lakhs and start an STP into Flexi Cap, what will my net worth look like in 2030?"*
* *"Which fund in my portfolio has the lowest return rate?"*

### 3. Custom Google Sheet Formula `=WEALTHOS_AI()`
Use AI directly in any cell formula:
```excel
=WEALTHOS_AI("Summarize this fund's performance in 1 sentence", A2:N2)
```
