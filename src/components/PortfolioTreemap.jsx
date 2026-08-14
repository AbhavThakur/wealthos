/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo } from "react";
import { TreemapChart } from "./Chart";
import { fmt, fmtCr } from "../utils/finance";
import { Scale, Sparkles, CheckCircle2, Sliders, ArrowLeft, Palette, Maximize2 } from "lucide-react";
import ExpandableChartModal from "./ExpandableChartModal";

export const HARMONIC_SHADES = {
  Debt: ["#065f46", "#047857", "#0f766e", "#0d9488", "#115e59", "#134e4a", "#059669"],
  Equity: ["#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#4338ca", "#4f46e5", "#3730a3"],
  Gold: ["#92400e", "#b45309", "#d97706", "#78350f", "#a16207", "#ca8a04"],
  Cash: ["#0e7490", "#0891b2", "#155e75", "#0369a1", "#0284c7"],
  "Real Estate": ["#9a3412", "#c2410c", "#ea580c", "#7c2d12"],
  Crypto: ["#5b21b6", "#6d28d9", "#7c3aed", "#4c1d95", "#8b5cf6"],
  Other: ["#334155", "#475569", "#1e293b", "#64748b"],
};

export const COLOR_PALETTES = {
  emerald: {
    id: "emerald",
    label: "🌲 Deep Emerald & Sapphire",
    colors: {
      Debt: "#065f46", // Dark forest emerald (super crisp with white text)
      Equity: "#1d4ed8", // Deep royal sapphire
      Gold: "#b45309", // Warm rich bronze/amber
      Cash: "#0e7490", // Deep dark cyan
      "Real Estate": "#9a3412", // Deep terracotta
      Crypto: "#5b21b6", // Deep royal purple
      Other: "#334155", // Deep slate
    },
  },
  classic: {
    id: "classic",
    label: "👑 Classic Wealth",
    colors: {
      Debt: "#0f766e", // Deep ocean teal
      Equity: "#1e40af", // Classic navy royal
      Gold: "#a16207", // Dark antique gold
      Cash: "#0369a1", // Dark steel blue
      "Real Estate": "#854d0e", // Deep warm brass
      Crypto: "#6b21a8", // Deep plum
      Other: "#475569", // Slate
    },
  },
  neon: {
    id: "neon",
    label: "⚡ Cyber Dark",
    colors: {
      Debt: "#047857", // Deep emerald
      Equity: "#2563eb", // Vibrant sapphire
      Gold: "#d97706", // Amber
      Cash: "#0891b2", // Cyan
      "Real Estate": "#ea580c", // Burnt orange
      Crypto: "#7c3aed", // Violet
      Other: "#64748b", // Slate
    },
  },
};

export const ALLOCATION_PRESETS = [
  { id: "growth", label: "70:20:10 (Growth)", alloc: { equity: 70, debt: 20, gold: 10 } },
  { id: "balanced", label: "60:30:10 (Balanced)", alloc: { equity: 60, debt: 30, gold: 10 } },
  { id: "aggressive", label: "80:15:5 (High Equity)", alloc: { equity: 80, debt: 15, gold: 5 } },
  { id: "conservative", label: "40:50:10 (Preservation)", alloc: { equity: 40, debt: 50, gold: 10 } },
];

/**
 * Classifies an investment item into a major asset class
 */
export function classifyAsset(item) {
  const cat = (item.category || item.type || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  if (cat.includes("gold") || name.includes("gold") || name.includes("sgb")) return "Gold";
  if (
    cat.includes("fd") ||
    cat.includes("fixed") ||
    cat.includes("deposit") ||
    cat.includes("debt") ||
    cat.includes("ppf") ||
    cat.includes("epf") ||
    cat.includes("nps") ||
    cat.includes("bonds") ||
    cat.includes("liquid") ||
    name.includes("fd") ||
    name.includes("fixed deposit")
  ) {
    return "Debt";
  }
  if (cat.includes("cash") || cat.includes("bank") || cat.includes("savings") || name.includes("savings")) return "Cash";
  if (cat.includes("real estate") || cat.includes("property") || name.includes("property")) return "Real Estate";
  if (cat.includes("crypto") || cat.includes("bitcoin")) return "Crypto";
  return "Equity";
}

/**
 * Builds hierarchical data for ECharts Treemap with harmonic colorful children
 */
export function buildTreemapData(investments = [], colorMap = COLOR_PALETTES.emerald.colors) {
  const groups = {};

  investments.forEach((inv) => {
    const val = Number(inv.currentValue || inv.amount || inv.value || inv.existingCorpus || inv.cur || 0);
    if (val <= 0) return;

    const assetClass = classifyAsset(inv);
    if (!groups[assetClass]) {
      groups[assetClass] = {
        name: assetClass,
        value: 0,
        itemStyle: { color: colorMap[assetClass] || colorMap.Other || "#334155" },
        children: [],
      };
    }

    const childIndex = groups[assetClass].children.length;
    const shades = HARMONIC_SHADES[assetClass] || [colorMap[assetClass] || "#334155"];
    const childColor = shades[childIndex % shades.length];

    groups[assetClass].value += val;
    groups[assetClass].children.push({
      name: inv.name || inv.schemeName || "Holding",
      value: val,
      category: inv.category || assetClass,
      itemStyle: {
        color: childColor,
      },
    });
  });

  return Object.values(groups).sort((a, b) => b.value - a.value);
}

export default function PortfolioTreemap({
  investments = [],
  targetAlloc: initialTargetAlloc = { equity: 70, debt: 20, gold: 10 },
}) {
  const [showRebalancer, setShowRebalancer] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePaletteKey, setActivePaletteKey] = useState("emerald");
  const [selectedClass, setSelectedClass] = useState("All");
  const [chartKey, setChartKey] = useState(0);
  const [targetAlloc, setTargetAlloc] = useState(initialTargetAlloc);
  const [selectedPreset, setSelectedPreset] = useState("growth");
  const [monthlySip, setMonthlySip] = useState(30000);

  const activeColors = COLOR_PALETTES[activePaletteKey]?.colors || COLOR_PALETTES.emerald.colors;

  const treemapData = useMemo(() => {
    return buildTreemapData(investments, activeColors);
  }, [investments, activeColors]);

  const totalPortfolioValue = useMemo(() => {
    return treemapData.reduce((s, g) => s + g.value, 0);
  }, [treemapData]);

  // Filtered treemap data when user selects a specific asset class
  const filteredTreemapData = useMemo(() => {
    if (selectedClass === "All") return treemapData;
    const match = treemapData.find((g) => g.name === selectedClass);
    return match?.children?.length ? match.children : treemapData.filter((g) => g.name === selectedClass);
  }, [treemapData, selectedClass]);

  // Actual asset class distribution
  const actualAlloc = useMemo(() => {
    if (totalPortfolioValue <= 0) return { equity: 0, debt: 0, gold: 0, other: 0 };
    const byClass = {};
    treemapData.forEach((g) => {
      byClass[g.name.toLowerCase()] = Math.round((g.value / totalPortfolioValue) * 100);
    });
    return {
      equity: byClass.equity || 0,
      debt: byClass.debt || 0,
      gold: byClass.gold || 0,
      other: Math.max(0, 100 - ((byClass.equity || 0) + (byClass.debt || 0) + (byClass.gold || 0))),
    };
  }, [treemapData, totalPortfolioValue]);

  // Rebalancing calculation
  const rebalancePlan = useMemo(() => {
    if (totalPortfolioValue <= 0) return null;

    const targetEqVal = (totalPortfolioValue * (targetAlloc.equity || 70)) / 100;
    const targetDebtVal = (totalPortfolioValue * (targetAlloc.debt || 20)) / 100;
    const targetGoldVal = (totalPortfolioValue * (targetAlloc.gold || 10)) / 100;

    const currentEqVal = treemapData.find((g) => g.name === "Equity")?.value || 0;
    const currentDebtVal = treemapData.find((g) => g.name === "Debt")?.value || 0;
    const currentGoldVal = treemapData.find((g) => g.name === "Gold")?.value || 0;

    const eqDiff = targetEqVal - currentEqVal;
    const debtDiff = targetDebtVal - currentDebtVal;
    const goldDiff = targetGoldVal - currentGoldVal;

    // SIP routing: prioritize underweight asset classes
    const underweightTotal = Math.max(0, debtDiff) + Math.max(0, goldDiff) + Math.max(0, eqDiff);

    const sipRoute = {
      equity: underweightTotal > 0 && eqDiff > 0 ? Math.round((eqDiff / underweightTotal) * monthlySip) : 0,
      debt: underweightTotal > 0 && debtDiff > 0 ? Math.round((debtDiff / underweightTotal) * monthlySip) : 0,
      gold: underweightTotal > 0 && goldDiff > 0 ? Math.round((goldDiff / underweightTotal) * monthlySip) : 0,
    };

    return {
      eqDiff,
      debtDiff,
      goldDiff,
      sipRoute,
      isBalanced: Math.abs(actualAlloc.equity - targetAlloc.equity) <= 3 && Math.abs(actualAlloc.debt - targetAlloc.debt) <= 3,
    };
  }, [totalPortfolioValue, treemapData, targetAlloc, actualAlloc, monthlySip]);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.id);
    setTargetAlloc({ ...preset.alloc });
  };

  const handleResetToAll = () => {
    setSelectedClass("All");
    setChartKey((k) => k + 1); // Forces clean ECharts reinitialization back to root
  };

  const handleSelectClass = (name) => {
    setSelectedClass((prev) => (prev === name ? "All" : name));
    setChartKey((k) => k + 1); // Forces clean re-render
  };

  return (
    <div
      className="card"
      style={{
        background: "var(--bg-card, #13131a)",
        border: "1px solid var(--border, rgba(255,255,255,0.08))",
        borderRadius: "var(--radius-lg, 16px)",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      {/* ── Card Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20 }}>🗺️</span>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-primary, #eeeae4)" }}>
              Portfolio Treemap & Asset Allocation
            </h3>
            {selectedClass !== "All" && (
              <button
                onClick={handleResetToAll}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: "rgba(201, 168, 76, 0.15)",
                  color: "var(--gold, #c9a84c)",
                  border: "1px solid var(--gold, #c9a84c)",
                }}
              >
                <ArrowLeft size={13} /> Back to All Assets
              </button>
            )}
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted, #9896a0)",
              margin: "4px 0 0 0",
            }}
          >
            Total Portfolio: <strong style={{ color: "var(--gold, #c9a84c)" }}>{fmt(totalPortfolioValue)}</strong> ({fmtCr(totalPortfolioValue)})
            {selectedClass !== "All" && ` · Viewing: ${selectedClass}`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Fullscreen Expand Button */}
          <button
            onClick={() => setIsExpanded(true)}
            title="Expand Fullscreen View"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.05)",
              color: "var(--text-secondary, #c4c2cc)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              transition: "all 0.15s ease",
            }}
          >
            <Maximize2 size={14} color="var(--gold, #c9a84c)" />
            <span>Expand</span>
          </button>

          {/* Palette Selector */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPaletteMenu(!showPaletteMenu)}
              title="Change Color Theme"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--text-secondary, #c4c2cc)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                transition: "all 0.15s ease",
              }}
            >
              <Palette size={14} color="var(--gold, #c9a84c)" />
              <span>Theme</span>
            </button>

            {showPaletteMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  zIndex: 40,
                  background: "#181824",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                  borderRadius: 10,
                  padding: "6px",
                  minWidth: 210,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                }}
              >
                {Object.values(COLOR_PALETTES).map((pal) => (
                  <button
                    key={pal.id}
                    onClick={() => {
                      setActivePaletteKey(pal.id);
                      setShowPaletteMenu(false);
                      setChartKey((k) => k + 1);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: activePaletteKey === pal.id ? 700 : 400,
                      borderRadius: 6,
                      background: activePaletteKey === pal.id ? "rgba(201, 168, 76, 0.15)" : "transparent",
                      color: activePaletteKey === pal.id ? "var(--gold, #c9a84c)" : "var(--text-primary, #eeeae4)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span>{pal.label}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: pal.colors.Debt }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: pal.colors.Equity }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: pal.colors.Gold }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rebalancing Button */}
          <button
            onClick={() => setShowRebalancer(!showRebalancer)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              background: showRebalancer ? "var(--gold, #c9a84c)" : "rgba(255, 255, 255, 0.06)",
              color: showRebalancer ? "#0c0c0f" : "var(--text-primary, #eeeae4)",
              border: showRebalancer ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border, rgba(255,255,255,0.12))",
              boxShadow: showRebalancer ? "0 2px 10px rgba(201,168,76,0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Scale size={15} color={showRebalancer ? "#0c0c0f" : "var(--gold, #c9a84c)"} />
            {showRebalancer ? "Hide Rebalancer" : "Rebalancing Advisor"}
          </button>
        </div>
      </div>

      {/* ── Asset Class Filter & Summary Pills ── */}
      {treemapData.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border, rgba(255, 255, 255, 0.06))",
          }}
        >
          {/* All Assets Tab */}
          <button
            onClick={handleResetToAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: selectedClass === "All" ? 700 : 500,
              padding: "5px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: selectedClass === "All" ? "rgba(201, 168, 76, 0.18)" : "rgba(0, 0, 0, 0.25)",
              color: selectedClass === "All" ? "var(--gold, #c9a84c)" : "var(--text-secondary, #c4c2cc)",
              border: selectedClass === "All" ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border, rgba(255,255,255,0.08))",
              transition: "all 0.15s ease",
            }}
          >
            <span>🏠 All Assets</span>
          </button>

          {/* Individual Asset Classes */}
          {treemapData.map((g) => {
            const pct = totalPortfolioValue > 0 ? Math.round((g.value / totalPortfolioValue) * 100) : 0;
            const color = activeColors[g.name] || activeColors.Other;
            const isSelected = selectedClass === g.name;

            return (
              <button
                key={g.name}
                onClick={() => handleSelectClass(g.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  padding: "5px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isSelected ? `${color}33` : "rgba(0, 0, 0, 0.25)",
                  color: isSelected ? "#ffffff" : "var(--text-primary, #eeeae4)",
                  border: isSelected ? `1.5px solid ${color}` : `1px solid ${color}55`,
                  boxShadow: isSelected ? `0 0 10px ${color}44` : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                <span style={{ fontWeight: 600 }}>{g.name}:</span>
                <span style={{ color: isSelected ? "#ffffff" : "var(--text-secondary, #c4c2cc)" }}>{fmt(g.value)}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: color,
                    padding: "1px 7px",
                    borderRadius: 4,
                  }}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Interactive Treemap Chart ── */}
      {filteredTreemapData.length > 0 ? (
        <TreemapChart
          key={`treemap_${selectedClass}_${chartKey}_${activePaletteKey}`}
          data={filteredTreemapData}
          height={340}
          fmt={fmt}
        />
      ) : (
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #9896a0)",
            fontSize: 13,
            background: "rgba(255, 255, 255, 0.02)",
            borderRadius: 10,
          }}
        >
          No portfolio holdings recorded yet
        </div>
      )}

      {/* ── Treemap Navigation Tag & Context Bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 8,
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.07))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", fontWeight: 500 }}>
            Active View:
          </span>
          <button
            onClick={handleResetToAll}
            title="Click to view all assets"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 6,
              cursor: "pointer",
              background: selectedClass === "All" ? "rgba(201, 168, 76, 0.18)" : "rgba(255, 255, 255, 0.05)",
              color: selectedClass === "All" ? "var(--gold, #c9a84c)" : "var(--text-primary, #eeeae4)",
              border: selectedClass === "All" ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              transition: "all 0.15s ease",
            }}
          >
            <span>🏠 Home (All Assets)</span>
          </button>

          {selectedClass !== "All" && (
            <>
              <span style={{ color: "var(--text-muted, #9896a0)", fontSize: 12 }}>›</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: `${activeColors[selectedClass] || "#3b82f6"}33`,
                  color: "#ffffff",
                  border: `1px solid ${activeColors[selectedClass] || "#3b82f6"}`,
                }}
              >
                {selectedClass} Holdings
              </span>
            </>
          )}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>💡</span>
          <span>
            {selectedClass === "All"
              ? "Click any category to inspect individual holdings"
              : "Click '🏠 Home (All Assets)' or [Back] to return"}
          </span>
        </div>
      </div>

      {/* ── Fullscreen Expand Modal ── */}
      <ExpandableChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title="Portfolio Treemap & Allocation Explorer"
        subtitle={`Total Portfolio: ${fmt(totalPortfolioValue)} (${fmtCr(totalPortfolioValue)}) · Mode: ${selectedClass === "All" ? "Full Allocation" : selectedClass + " Deep Dive"}`}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 520 }}>
          <TreemapChart
            key={`treemap_expanded_${selectedClass}_${chartKey}_${activePaletteKey}`}
            data={filteredTreemapData}
            height={540}
            fmt={fmt}
          />
        </div>
      </ExpandableChartModal>

      {/* ── Rebalancing Advisor Drawer ── */}
      {showRebalancer && rebalancePlan && (
        <div
          style={{
            marginTop: 20,
            padding: 18,
            background: "rgba(20, 20, 28, 0.85)",
            border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
            borderRadius: "var(--radius, 12px)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Header & Target Presets */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.07))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="var(--gold, #c9a84c)" />
              <strong style={{ fontSize: 14, color: "var(--text-primary, #eeeae4)" }}>
                Tax-Smart SIP Rebalancing Advisor
              </strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", display: "flex", alignItems: "center", gap: 4 }}>
                <Sliders size={12} /> Target Preset:
              </span>
              {ALLOCATION_PRESETS.map((preset) => {
                const isActive = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 400,
                      padding: "4px 9px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: isActive ? "rgba(201, 168, 76, 0.18)" : "rgba(255, 255, 255, 0.04)",
                      color: isActive ? "var(--gold, #c9a84c)" : "var(--text-muted, #9896a0)",
                      border: isActive ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border, rgba(255, 255, 255, 0.08))",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allocation Drift Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Equity Allocation</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: activeColors.Equity }}>
                {actualAlloc.equity}% <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", fontWeight: 400 }}>(Target {targetAlloc.equity}%)</span>
              </div>
              <div style={{ fontSize: 11, color: actualAlloc.equity > targetAlloc.equity ? "var(--yellow, #eab308)" : "var(--green, #10b981)", marginTop: 4 }}>
                {actualAlloc.equity > targetAlloc.equity ? `+${actualAlloc.equity - targetAlloc.equity}% Overweight` : `${actualAlloc.equity - targetAlloc.equity}% Underweight`}
              </div>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Debt / Fixed Income</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: activeColors.Debt }}>
                {actualAlloc.debt}% <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", fontWeight: 400 }}>(Target {targetAlloc.debt}%)</span>
              </div>
              <div style={{ fontSize: 11, color: actualAlloc.debt >= targetAlloc.debt ? "var(--green, #10b981)" : "var(--yellow, #eab308)", marginTop: 4 }}>
                {actualAlloc.debt > targetAlloc.debt ? `+${actualAlloc.debt - targetAlloc.debt}% Overweight` : `${actualAlloc.debt - targetAlloc.debt}% Underweight`}
              </div>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Gold / Sovereign Bonds</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: activeColors.Gold }}>
                {actualAlloc.gold}% <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", fontWeight: 400 }}>(Target {targetAlloc.gold}%)</span>
              </div>
              <div style={{ fontSize: 11, color: actualAlloc.gold >= targetAlloc.gold ? "var(--green, #10b981)" : "var(--yellow, #eab308)", marginTop: 4 }}>
                {actualAlloc.gold > targetAlloc.gold ? `+${actualAlloc.gold - targetAlloc.gold}% Overweight` : `${actualAlloc.gold - targetAlloc.gold}% Underweight`}
              </div>
            </div>
          </div>

          {/* Actionable Rebalancing Recommendation */}
          <div
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: 10,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--green, #10b981)", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={16} />
                Zero-Tax Rebalancing Strategy:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--text-muted, #9896a0)" }}>Monthly Fresh SIP:</span>
                <input
                  type="number"
                  step="5000"
                  value={monthlySip}
                  onChange={(e) => setMonthlySip(Number(e.target.value))}
                  style={{
                    width: 100,
                    padding: "4px 8px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                    background: "rgba(0, 0, 0, 0.4)",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>
            <p style={{ margin: 0, color: "var(--text-secondary, #c4c2cc)", lineHeight: 1.5, fontSize: 12 }}>
              Instead of redeeming equity holdings and triggering capital gains tax, re-route your upcoming monthly fresh savings ({fmt(monthlySip)}) into underweight asset classes:
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
              {rebalancePlan.sipRoute.debt > 0 && (
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    fontWeight: 600,
                    color: "#34d399",
                    fontSize: 12,
                  }}
                >
                  → Route to Debt / FDs: {fmt(rebalancePlan.sipRoute.debt)} / mo
                </div>
              )}
              {rebalancePlan.sipRoute.gold > 0 && (
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(234, 179, 8, 0.15)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    fontWeight: 600,
                    color: "#facc15",
                    fontSize: 12,
                  }}
                >
                  → Route to Gold / SGBs: {fmt(rebalancePlan.sipRoute.gold)} / mo
                </div>
              )}
              {rebalancePlan.sipRoute.equity > 0 && (
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    fontWeight: 600,
                    color: "#60a5fa",
                    fontSize: 12,
                  }}
                >
                  → Route to Equity: {fmt(rebalancePlan.sipRoute.equity)} / mo
                </div>
              )}
              {rebalancePlan.isBalanced && (
                <div style={{ fontWeight: 600, color: "var(--green, #10b981)", fontSize: 12 }}>
                  ✓ Portfolio is within balanced target thresholds.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
