// PWA Notification manager — uses the Web Notification API
// Works on both desktop and mobile (via service worker)

const LS_ENABLED = "wealthos-notifications";

export function isNotificationSupported() {
  return "Notification" in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unavailable";
  return Notification.permission; // "default" | "granted" | "denied"
}

export function isNotificationEnabled() {
  return localStorage.getItem(LS_ENABLED) === "1";
}

export function setNotificationEnabled(enabled) {
  localStorage.setItem(LS_ENABLED, enabled ? "1" : "0");
}

export async function requestPermission() {
  if (!isNotificationSupported()) return "unavailable";
  const result = await Notification.requestPermission();
  if (result === "granted") setNotificationEnabled(true);
  return result;
}

/**
 * Show a local notification via service worker (if available) or Notification API.
 */
export async function showNotification(title, options = {}) {
  if (getNotificationPermission() !== "granted") return;
  if (!isNotificationEnabled()) return;

  const defaults = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: options.tag || "wealthos",
    ...options,
  };

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      await reg.showNotification(title, defaults);
    } else {
      new Notification(title, defaults);
    }
  } catch {
    try {
      new Notification(title, defaults);
    } catch {
      // Notification blocked
    }
  }
}

/**
 * Check and fire reminders based on data.
 * Call this once on app load after data is ready.
 */
export function checkReminders(abhav, aanya, shared, _PersonNames) {
  if (!isNotificationEnabled()) return;
  if (getNotificationPermission() !== "granted") return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const shownKey = `wealthos-notif-${today}`;

  // Only show once per day
  if (sessionStorage.getItem(shownKey)) return;
  sessionStorage.setItem(shownKey, "1");

  const reminders = [];

  // Insurance renewals within 7 days
  for (const p of [abhav, aanya]) {
    for (const ins of p?.insurances || []) {
      if (!ins.renewalDate) continue;
      const days = Math.ceil((new Date(ins.renewalDate) - now) / 86400000);
      if (days >= 0 && days <= 7) {
        reminders.push({
          title: `Insurance renewal in ${days} day${days !== 1 ? "s" : ""}`,
          body: `${ins.name || ins.type} policy is due for renewal.`,
          tag: `insurance-${ins.id}`,
        });
      }
    }
  }

  // Goal deadlines within 14 days
  for (const g of shared?.goals || []) {
    if (!g.deadline) continue;
    const deadline = new Date(g.deadline + "-28"); // month deadline
    const days = Math.ceil((deadline - now) / 86400000);
    const saved = (g.abhavSaved || 0) + (g.aanyaSaved || 0);
    if (days >= 0 && days <= 14 && saved < g.target) {
      reminders.push({
        title: `Goal "${g.name}" deadline approaching`,
        body: `${days} days left — ${Math.round((saved / g.target) * 100)}% saved.`,
        tag: `goal-${g.id}`,
      });
    }
  }

  // Show max 3 reminders with delay between them
  reminders.slice(0, 3).forEach((r, i) => {
    setTimeout(() => {
      showNotification(r.title, { body: r.body, tag: r.tag });
    }, i * 2000);
  });
}
