import { useState, useEffect, useCallback, useRef } from "react";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, Download, X } from "lucide-react";

export default function ExpandableChartModal({
  isOpen,
  onClose,
  title = "Expanded Chart View",
  subtitle,
  children,
  onExportPng,
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef(null);

  const handleClose = useCallback(() => {
    setZoomLevel(1);
    onClose();
  }, [onClose]);

  // Handle keyboard shortcuts (Esc to close, + / - / 0 to zoom)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "+" || e.key === "=") setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
      if (e.key === "-") setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
      if (e.key === "0") setZoomLevel(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  const handleZoomReset = () => setZoomLevel(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 10, 15, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        overflow: "hidden",
      }}
    >
      {/* ── Modal Header Bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "#181824",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
          borderRadius: 12,
          marginBottom: 12,
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary, #eeeae4)", display: "flex", alignItems: "center", gap: 8 }}>
            <Maximize2 size={18} color="var(--gold, #c9a84c)" />
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted, #9896a0)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Zoom Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              borderRadius: 8,
              padding: "2px",
            }}
          >
            <button
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary, #c4c2cc)",
                padding: "6px 9px",
                cursor: "pointer",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleZoomReset}
              title="Reset Zoom (0)"
              style={{
                background: "none",
                border: "none",
                color: zoomLevel !== 1 ? "var(--gold, #c9a84c)" : "var(--text-muted, #9896a0)",
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 8px",
                cursor: "pointer",
                borderRadius: 4,
                minWidth: 44,
                textAlign: "center",
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              title="Zoom In (+)"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary, #c4c2cc)",
                padding: "6px 9px",
                cursor: "pointer",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleZoomReset}
            title="Reset View"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.05)",
              color: "var(--text-primary, #eeeae4)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Export PNG */}
          {onExportPng && (
            <button
              onClick={onExportPng}
              title="Download High-Res PNG"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                padding: "7px 14px",
                borderRadius: 8,
                background: "rgba(201, 168, 76, 0.15)",
                color: "var(--gold, #c9a84c)",
                border: "1px solid var(--gold, #c9a84c)",
                cursor: "pointer",
              }}
            >
              <Download size={14} />
              <span>Export HD</span>
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={handleClose}
            aria-label="Close expanded view"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
              color: "var(--text-primary, #eeeae4)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Main Canvas Viewport ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: "#13131a",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
          borderRadius: 14,
          padding: "20px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease-out",
            width: "100%",
            height: "100%",
            minHeight: 520,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
