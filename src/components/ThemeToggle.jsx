import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "system", icon: Monitor, label: "System" },
];

function getStored() {
  return localStorage.getItem("wealthos-theme") || "dark";
}

function apply(theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  // Sync PWA status bar / theme-color meta tag
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark ? "#0c0c0f" : "#f5f3ef");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStored);

  useEffect(() => {
    apply(theme);
    localStorage.setItem("wealthos-theme", theme);
  }, [theme]);

  // Apply stored theme on mount (before paint)
  useEffect(() => {
    apply(getStored());
  }, []);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--bg-card2)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        padding: 3,
        gap: 2,
      }}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {THEMES.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          role="radio"
          aria-checked={theme === id}
          aria-label={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            background: theme === id ? "var(--gold-dim)" : "transparent",
            color: theme === id ? "var(--gold)" : "var(--text-muted)",
          }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// Apply theme before React hydrates (prevent flash)
// eslint-disable-next-line react-refresh/only-export-components
export function initTheme() {
  const t = localStorage.getItem("wealthos-theme") || "dark";
  if (t !== "system") {
    document.documentElement.setAttribute("data-theme", t);
  }
  const isDark =
    t === "dark" ||
    (t === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark ? "#0c0c0f" : "#f5f3ef");
}
