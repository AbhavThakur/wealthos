import { useState, useEffect } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import RELEASE_NOTES from "../data/releaseNotes";

const APP_VERSION = RELEASE_NOTES[0]?.version || "0.0.0";
const VERSION_KEY = "wealthos-last-seen-version";
const UPDATED_FLAG = "wealthos-just-updated";

export { APP_VERSION };

export default function UpdateBanner() {
  // Pure computation for initial state — no setState in effects
  const [show, setShow] = useState(() => {
    // Suppress modal right after an update-reload so it doesn't flash again
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      return false;
    }
    const lastSeen = localStorage.getItem(VERSION_KEY);
    if (!lastSeen) {
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      return false;
    }
    return lastSeen !== APP_VERSION;
  });

  useEffect(() => {
    const swHandler = () => setShow(true);
    window.addEventListener("sw-update-available", swHandler);
    return () => window.removeEventListener("sw-update-available", swHandler);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    setShow(false);
  };

  const reload = () => {
    sessionStorage.setItem(UPDATED_FLAG, "true");
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  const latest = RELEASE_NOTES[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        padding: 16,
        fontFamily: "var(--font-body, system-ui)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          color: "#fff",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 0", textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--gold-dim)",
              border: "1px solid var(--gold-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <Sparkles size={24} style={{ color: "var(--gold)" }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            New Update Available
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            <strong style={{ color: "var(--gold)" }}>v{latest?.version}</strong>
            {" — "}
            {latest?.title}
          </div>
        </div>

        {/* Release notes */}
        {latest?.highlights && (
          <div
            style={{
              padding: "16px 20px",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                marginBottom: 8,
              }}
            >
              What&apos;s new
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 12,
                lineHeight: 1.8,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {latest.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            padding: "12px 20px 20px",
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={dismiss}
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Later
          </button>
          <button
            onClick={reload}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--gold)",
              border: "none",
              borderRadius: 8,
              color: "#000",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={14} /> Update now
          </button>
        </div>
      </div>
    </div>
  );
}
