import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

let deferredPrompt = null;

// Capture the event globally so it's not lost
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event("pwa-install-available"));
  });
}

function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onAvailable = () => setCanInstall(true);
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
    };
    window.addEventListener("pwa-install-available", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-available", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === "accepted";
  };

  return { canInstall, installed, install };
}

const DISMISS_KEY = "wealthos-install-dismissed";

export default function InstallBanner() {
  const { canInstall, installed, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!canInstall || dismissed || installed) return null;

  // Also hide if already in standalone mode
  if (window.matchMedia("(display-mode: standalone)").matches) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9990,
        background: "var(--bg-card)",
        border: "1px solid var(--gold-border)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        maxWidth: "calc(100vw - 32px)",
        width: 360,
        animation: "slideUp 0.3s ease",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "var(--gold-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Download size={18} color="var(--gold)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Install WealthOS
        </div>
        <div
          style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}
        >
          Add to home screen for offline access & faster launch
        </div>
      </div>
      <button
        onClick={async () => {
          await install();
        }}
        style={{
          background: "var(--gold)",
          color: "#000",
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: 4,
          display: "flex",
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
