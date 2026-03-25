# WealthOS

Open-source household finance tracker for two-person households (couples, families, roommates).  
Built with React 19 + Firebase — self-hosted, private, and free.

## Features

| Module            | Person 1             | Person 2             | Household             |
| ----------------- | -------------------- | -------------------- | --------------------- |
| **Dashboard**     | Overview + charts    | Overview + charts    | Combined side-by-side |
| **Budget**        | Monthly budget       | Monthly budget       | Both shown            |
| **Investments**   | SIP auto-corpus      | SIP auto-corpus      | Combined projection   |
| **Goals**         | Personal goals       | Personal goals       | Shared goals          |
| **Net Worth**     | Assets & liabilities | Assets & liabilities | Combined snapshot     |
| **Debts & EMIs**  | Loan tracker         | Loan tracker         | Both shown            |
| **Cash Flow**     | Forecast             | Forecast             | Household forecast    |
| **Transactions**  | Ledger               | Ledger               | Both shown            |
| **Tax Planner**   | Old vs New regime    | Old vs New regime    | Side-by-side          |
| **Insurance**     | Policies             | Policies             | Both shown            |
| **Subscriptions** | Tracker              | Tracker              | Both shown            |
| **Recurring**     | Auto-rules + alerts  | Auto-rules + alerts  | Both shown            |

**Also includes:** Guided onboarding wizard, PIN lock, guest demo mode with sample data, password reset, dark theme.

### SIP Auto-Compounding

Enter your existing corpus + monthly SIP amount + start date → the app calculates today's projected value, 10-year projection, 20-year corpus, and LTCG tax impact. Corpus auto-updates monthly.

---

## Quick Start

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → name it anything → disable Google Analytics → **Create project**

### 2. Enable Email/Password auth

1. Firebase Console → **Authentication** → **Get started**
2. **Email/Password** → Enable → Save

### 3. Create Firestore database

1. Firebase Console → **Firestore Database** → **Create database**
2. **Start in production mode** → select your region → **Enable**

### 4. Set Firestore security rules

In Firestore → **Rules** tab, paste and **Publish**:

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

(This file is also included as `firestore.rules` in the repo.)

### 5. Get your Firebase config

1. Firebase Console → ⚙️ **Project Settings** → **Your apps** → click **</>** (Web)
2. Register app name → **Register app**
3. Copy the config values shown

### 6. Configure the app

```bash
cp .env.example .env.local
```

Fill in your Firebase values in `.env.local`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
```

### 7. Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — create an account using the **Sign up** button.

---

## Deploy (free)

### Vercel (recommended)

Push to GitHub and connect at [vercel.com](https://vercel.com).  
Add the `VITE_FIREBASE_*` environment variables in Vercel project settings.  
Auto-deploys on every push.

### Other options

- **Netlify**: `npm run build` → drag `dist/` to netlify.com/drop
- **Cloudflare Pages**: connect GitHub repo, build command `npm run build`, output `dist`

---

## Tech Stack

React 19 · Vite 8 · Firebase Auth · Firestore · Recharts · Lucide React · date-fns

---

## License

MIT
