import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initTheme } from "./components/ThemeToggle";

// Apply theme before first paint to prevent flash
initTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for PWA offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        // Register periodic background sync for daily reminders
        if ("periodicSync" in reg) {
          try {
            await reg.periodicSync.register("wealthos-daily-reminders", {
              minInterval: 24 * 60 * 60 * 1000, // 1 day
            });
          } catch {
            // Periodic sync not granted or unsupported
          }
        }

        // Detect updates — prompt user to reload
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (
              newSW.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              window.dispatchEvent(new Event("sw-update-available"));
            }
          });
        });
      })
      .catch(() => {});
  });

  // Auto-reload when new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
