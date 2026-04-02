import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  if (!show) return null;

  const reload = () => {
    navigator.serviceWorker?.controller?.postMessage({
      type: "SKIP_WAITING",
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: "var(--gold)",
        color: "#000",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <RefreshCw size={14} />A new version is available.
      <button
        onClick={reload}
        style={{
          background: "rgba(0,0,0,0.15)",
          border: "none",
          borderRadius: 6,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          color: "#000",
        }}
      >
        Update now
      </button>
    </div>
  );
}
