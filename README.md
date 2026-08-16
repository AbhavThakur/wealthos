# WealthOS 🪙

> **The Private, Intelligent Household Wealth & Dual-Income Operating System.**  
> Built with React 19, Vite, Tailwind-grade Vanilla CSS tokens, and Firebase Firestore. 100% self-hosted, private, and zero subscription fees.

---

## 🌟 Key Highlights

- **Dual-Person & Household Architecture**: Dedicated individual spaces for Person 1 and Person 2 plus unified household views with smart expense splitting (50:50, proportional to income, or custom).
- **3-Tier Wealth Framework**: Visual breakdown into **Liquid & Daily Cash** (Bank balances), **Wealth Growers** (Mutual Funds, Stocks, Gold, Crypto), and **Guaranteed Reserves** (EPF, PPF, FD, RD).
- **10-Second Executive Health Pulse**: Real-time cashflow surplus, true savings rate, emergency runway months, and retirement net worth milestone progress with interactive drill-down modals.
- **Goal Funding Intelligence**: Set target amounts and timelines; WealthOS computes per-person liquidation options, asset allocation, and feasibility diagnostics.
- **2-Way Google Sheets Live Sync**: Full bi-directional sync across 8 tabs with 100% Dev vs. Production environment isolation.
- **Smart Statement & CAS Parser**: 1-click import of CAMS / KFintech Consolidated Account Statements (CAS), bank statements, payslips, and SMS transactions.
- **Tax Harvesting & Regime Planner**: LTCG ₹1.25 Lakh tax harvesting calculator + Old vs. New tax regime comparison for both earners.
- **Life Decision Lab**: Simulate major financial decisions (buying a home, purchasing a car, career break, sabbatical) with 10-year net worth impact curves.
- **Quick Log (NLP)**: Log expenses via natural language (`"spent 450 on dinner"`).
- **Privacy & Security**: Biometric unlock (FaceID, TouchID, WebAuthn), PIN lock, client-side encryption, and strict Firestore security rules.
- **Automated Multi-Month Audit CLI**: Built-in `npm run audit` verification engine.

---

## 📊 Modules & Capabilities

| Module | Person 1 | Person 2 | Household |
| :--- | :--- | :--- | :--- |
| **Executive Pulse** | Individual cashflow & burn | Individual cashflow & burn | Combined surplus, savings rate & runway |
| **3-Tier Wealth** | Bank cash & investments | Bank cash & investments | Liquid, Growth & Safe asset allocation |
| **Budget & Cashflow** | Monthly expenses & recurring | Monthly expenses & recurring | Shared expenses & auto-settlement matrix |
| **Investments & SIP** | Auto-compounding corpus | Auto-compounding corpus | Household portfolio & Treemap breakdown |
| **Goals & Funding** | Personal goals & allocations | Personal goals & allocations | Shared milestones & liquidation simulator |
| **Net Worth** | Assets vs Liabilities | Assets vs Liabilities | Household net worth milestone projection |
| **Tax & Harvesting** | Old/New regime + 80C/80D | Old/New regime + 80C/80D | LTCG ₹1.25L harvesting & tax optimization |
| **Decision Lab** | Scenario modeling | Scenario modeling | 10-year household net worth projections |
| **Google Sheets Sync**| 4 personal tabs | 4 personal tabs | 8-tab bi-directional sync with dev/prod isolation |
| **Statement Parser** | CAS / Bank PDF / SMS | CAS / Bank PDF / SMS | Instant portfolio & transaction ingestion |

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-repo/wealthos.git
cd wealthos
npm install
```

### 2. Configure Firebase

1. Create a free project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** (Email/Password).
3. Enable **Cloud Firestore** in production mode.
4. Set Firestore Security Rules (from [`firestore.rules`](./firestore.rules)).
5. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

6. Fill in your Firebase Web App credentials:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc

# Set to "dev" to isolate test data in Firestore (dev_data collections)
VITE_ENV=dev
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Data Audit Suite

WealthOS includes comprehensive unit tests, integration tests, and a dedicated multi-month financial audit engine:

```bash
# Run Vitest test suite (182+ unit & integration tests)
npm run test:run

# Run ESLint validation
npm run lint

# Run Multi-Month Financial Audit CLI
npm run audit

# Build for production
npm run build
```

---

## 📈 Google Sheets 2-Way Sync Setup

WealthOS supports live synchronization to Google Sheets with 8 dedicated tabs:
- `Transactions_P1`, `Transactions_P2`
- `Budget_P1`, `Budget_P2`
- `Investments_P1`, `Investments_P2`
- `Goals`, `NetWorth`

### Setup Instructions:
1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Google Drive API** and **Google Sheets API**.
2. Create **OAuth 2.0 Client ID (Web Application)**.
3. Add Authorized Redirect URIs:
   - `http://localhost:5173/api/google-auth` *(Local Dev)*
   - `https://your-domain.vercel.app/api/google-auth` *(Production)*
4. Add credentials to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-secret
   ```
5. In WealthOS, go to **Settings → Google Sheets** and click **Connect**.
   - In dev mode (`VITE_ENV=dev`), it automatically creates and links to `WealthOS Finance [DEV]`.
   - In production, it creates and links to `WealthOS Finance`.

---

## 📱 PWA & Mobile Installation

WealthOS is a fully offline-capable **Progressive Web App (PWA)**:
- **iOS / iPadOS**: Open Safari → Tap Share (`⎋`) → **Add to Home Screen**.
- **Android / Chrome**: Tap menu (`⋮`) → **Install App**.
- **Desktop (macOS / Windows)**: Click the Install icon in the browser address bar.

---

## 🔐 Security & Privacy Architecture

- **Zero Third-Party Trackers**: No analytics or ad SDKs.
- **Client-Side Encryption & Token Storage**: OAuth tokens are encrypted using AES-256-GCM.
- **Biometric Security**: Native WebAuthn integration supports FaceID, TouchID, and Windows Hello.
- **Granular Security Rules**: Users can only read and write their own household document subtree.

---

## 📄 License

MIT License — free for personal and commercial use.
