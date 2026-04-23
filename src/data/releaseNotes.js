// Release notes — newest first. Update this file with each deploy.
// Bump the version in the service worker (CACHE_NAME) to trigger the update banner.
const RELEASE_NOTES = [
  {
    version: "2.6.0",
    date: "2026-04-23",
    title: "Google Sheets Sync & UI Polish",
    highlights: [
      "Connect Google Sheets via OAuth — sync all data to 8 tabs",
      "Auto-push transactions, budget, investments, goals & net worth to Sheet",
      "Import preview from Sheet before applying changes",
      "What's New section redesigned with accordion",
    ],
  },
  {
    version: "2.5.0",
    date: "2026-04-04",
    title: "One-time Purchases Redesign",
    highlights: [
      "One-time purchase amounts now tracked via purchase log entries",
      "Card layout redesigned — name, category, then log",
      "Submit + Close buttons in purchase log for clearer UX",
      "Totals update live from logged entries",
    ],
  },
  {
    version: "2.4.0",
    date: "2026-04-01",
    title: "Push Notifications & Biometric Unlock",
    highlights: [
      "Server-side push notifications for bill reminders & goal deadlines",
      "Face ID / Touch ID biometric unlock as PIN alternative",
      "PWA install prompt banner for Add to Home Screen",
      "Background sync for daily reminder checks",
    ],
  },
  {
    version: "2.3.0",
    date: "2026-03-25",
    title: "Budget Rules & Smart Advisor",
    highlights: [
      "50/30/20, 70/20/10, Pay Yourself First budget frameworks",
      "Budget vs Actual tracking with category alerts",
      "AI-powered smart financial advisor",
      "Ctrl+K search palette for quick navigation",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-03-20",
    title: "Trips, Goals & Dark Mode",
    highlights: [
      "Shared & personal trip expense tracking",
      "Goal celebration confetti & progress milestones",
      "Dark / Light / System theme toggle",
      "Dashboard sparklines for quick trends",
    ],
  },
];

export default RELEASE_NOTES;
