# WealthOS 💰 — Finance Hub

A private, dual-profile personal finance tracker built with React + Firebase.
Password-protected, cloud-synced, fully separate data per person with a combined household view.

---

## Features

| Module | Abhav | Aanya | Household |
|---|---|---|---|
| Dashboard | ✓ | ✓ | Combined + side-by-side |
| Budget | ✓ | ✓ | Both shown |
| Investments | SIP auto-corpus | SIP auto-corpus | Combined projection |
| Goals | Personal | Personal | Shared goals |
| Debts & EMIs | ✓ | ✓ | Both shown |
| Transactions | ✓ | ✓ | Both shown |
| Tax Planner | Old vs New regime | Old vs New regime | Side by side |

### SIP Auto-Compounding
Enter your **existing corpus** + **monthly/weekly SIP amount** + **start date** → the app automatically calculates today's value, 10-year projection, 20-year corpus, and LTCG tax impact. Monthly corpus updates itself every month.

---

## Setup (one-time, ~10 minutes)

### Step 1 — Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `wealthos` → Continue
3. Disable Google Analytics (not needed) → **Create project**

### Step 2 — Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** → Enable it → Save
3. Go to **Users** tab → **Add user**
4. Enter your shared email + password (e.g. `abhav.aanya@gmail.com` + strong password)
5. **Save this password somewhere safe** — this is your login

### Step 3 — Enable Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** → Next
3. Select region: `asia-south1 (Mumbai)` → Enable

### Step 4 — Firestore Security Rules

In Firestore → **Rules** tab, paste this and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 5 — Get your config

1. Firebase Console → ⚙️ Project Settings → **Your apps** → click **</>** (Web)
2. Register app name: `wealthos` → **Register app**
3. Copy the `firebaseConfig` object shown

### Step 6 — Add config to app

Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",           // paste your values here
  authDomain: "wealthos-xxx.firebaseapp.com",
  projectId: "wealthos-xxx",
  storageBucket: "wealthos-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
}
```

---

## Run locally

```bash
npm install
npm run dev
# Open http://localhost:5173
# Login with the email+password you created in Firebase
```

---

## Deploy free on Vercel (recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (run from project folder)
vercel

# Follow the prompts — done in 60 seconds
# You'll get a URL like https://wealthos-xyz.vercel.app
```

Or push to GitHub and connect at [vercel.com](https://vercel.com) — auto-deploys on every push.

**Other free options:**
- **Netlify**: `npm run build` → drag `dist/` to netlify.com/drop
- **Cloudflare Pages**: connect GitHub repo, build command `npm run build`, output `dist`

---

## Customise default data

Open `src/context/DataContext.jsx` and edit the `DEFAULTS` object at the top.
Change Abhav's salary, Aanya's investments, shared goals etc. — this only affects first load (before any data is saved).

---

## Tech stack
React 18 · Vite · Firebase Auth · Firestore · Recharts · Lucide React
