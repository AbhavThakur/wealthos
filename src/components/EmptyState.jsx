const ILLUSTRATIONS = {
  budget: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect
        x="14"
        y="20"
        width="52"
        height="44"
        rx="6"
        stroke="var(--gold)"
        strokeWidth="2"
        opacity="0.4"
      />
      <rect
        x="22"
        y="32"
        width="36"
        height="4"
        rx="2"
        fill="var(--gold)"
        opacity="0.3"
      />
      <rect
        x="22"
        y="40"
        width="28"
        height="4"
        rx="2"
        fill="var(--gold)"
        opacity="0.2"
      />
      <rect
        x="22"
        y="48"
        width="20"
        height="4"
        rx="2"
        fill="var(--gold)"
        opacity="0.15"
      />
      <circle
        cx="58"
        cy="16"
        r="10"
        fill="var(--gold-dim)"
        stroke="var(--gold)"
        strokeWidth="1.5"
      />
      <text x="58" y="20" textAnchor="middle" fontSize="12" fill="var(--gold)">
        ₹
      </text>
    </svg>
  ),
  investment: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <polyline
        points="10,60 25,48 40,52 55,30 70,20"
        stroke="var(--green)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      <polyline
        points="10,60 25,48 40,52 55,30 70,20 70,60 10,60"
        fill="var(--green)"
        opacity="0.08"
      />
      <circle cx="70" cy="20" r="4" fill="var(--green)" opacity="0.5" />
      <line
        x1="10"
        y1="60"
        x2="70"
        y2="60"
        stroke="var(--text-muted)"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  ),
  goal: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle
        cx="40"
        cy="40"
        r="28"
        stroke="var(--gold)"
        strokeWidth="2"
        opacity="0.3"
      />
      <circle
        cx="40"
        cy="40"
        r="18"
        stroke="var(--gold)"
        strokeWidth="2"
        opacity="0.4"
      />
      <circle cx="40" cy="40" r="8" fill="var(--gold)" opacity="0.5" />
      <line
        x1="40"
        y1="8"
        x2="40"
        y2="14"
        stroke="var(--gold)"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <line
        x1="40"
        y1="66"
        x2="40"
        y2="72"
        stroke="var(--gold)"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <line
        x1="8"
        y1="40"
        x2="14"
        y2="40"
        stroke="var(--gold)"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <line
        x1="66"
        y1="40"
        x2="72"
        y2="40"
        stroke="var(--gold)"
        strokeWidth="1.5"
        opacity="0.3"
      />
    </svg>
  ),
  subscription: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect
        x="18"
        y="22"
        width="44"
        height="36"
        rx="6"
        stroke="var(--purple)"
        strokeWidth="2"
        opacity="0.4"
      />
      <circle
        cx="40"
        cy="40"
        r="10"
        stroke="var(--purple)"
        strokeWidth="2"
        opacity="0.5"
      />
      <path d="M37 37 L37 43 L44 40 Z" fill="var(--purple)" opacity="0.5" />
    </svg>
  ),
  cashflow: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path
        d="M15 50 Q30 30 40 40 Q50 50 65 30"
        stroke="var(--blue)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M60 28 L66 30 L64 24"
        stroke="var(--blue)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <line
        x1="15"
        y1="54"
        x2="65"
        y2="54"
        stroke="var(--text-muted)"
        strokeWidth="1"
        opacity="0.2"
      />
    </svg>
  ),
  generic: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect
        x="20"
        y="20"
        width="40"
        height="40"
        rx="8"
        stroke="var(--text-muted)"
        strokeWidth="2"
        opacity="0.3"
      />
      <line
        x1="30"
        y1="36"
        x2="50"
        y2="36"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
      />
      <line
        x1="30"
        y1="44"
        x2="44"
        y2="44"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  ),
};

export default function EmptyState({
  type = "generic",
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 16, opacity: 0.8 }}>
        {ILLUSTRATIONS[type] || ILLUSTRATIONS.generic}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            maxWidth: 280,
            lineHeight: 1.5,
            marginBottom: actionLabel ? 16 : 0,
          }}
        >
          {description}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          className="btn-primary"
          onClick={onAction}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 20px",
            fontSize: 13,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
