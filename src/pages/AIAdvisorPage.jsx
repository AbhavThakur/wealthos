import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Trash2, Copy, Check, ChevronDown } from "lucide-react";
import { askSmart } from "../utils/smartAdvisor";
import { askGroq, buildContext, buildReport } from "../utils/aiAdvisor";

const QUICK_PROMPTS = [
  "Where should I invest right now?",
  "Is my asset allocation right for my age?",
  "How much idle cash should I move to investments?",
  "Should I increase my SIP or pay off debt first?",
  "Which of my funds has high expense ratio?",
  "Am I on track for retirement?",
  "How can I reduce tax this year?",
  "Which goal needs attention?",
  "How am I doing this month?",
  "Compare this vs last month",
];

const WELCOME = `Hi! I'm your WealthOS advisor ⚡\nI run locally — instant answers, no API needed.\nAsk me about savings, SIPs, goals, tax, or anything financial.`;

function renderText(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} style={{ color: "var(--gold)" }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function AIAdvisorPage({ abhav, aanya, shared, profile }) {
  const [messages, setMessages] = useState([{ role: "ai", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("smart");
  const [copied, setCopied] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const modeMenuRef = useRef(null);

  const hasGroqKey = !!import.meta.env.VITE_GROQ_KEY;
  const MODES = [
    { id: "smart", label: "⚡ Local", desc: "Instant, no API" },
    ...(hasGroqKey
      ? [
          {
            id: "groq",
            label: "🦙 Groq",
            desc: "Llama 3.3 70B · 1000/day free",
          },
        ]
      : []),
  ];
  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close mode dropdown on outside click
  useEffect(() => {
    if (!showModeMenu) return;
    const handler = (e) => {
      if (!modeMenuRef.current?.contains(e.target)) setShowModeMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModeMenu]);

  const send = useCallback(
    async (text) => {
      const q = (text || input).trim();
      if (!q || loading) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: q }]);
      setLoading(true);
      try {
        let reply;
        if (mode === "groq") {
          const ctx = buildContext(abhav, aanya, shared, profile);
          reply = await askGroq(q, ctx);
        } else {
          reply = askSmart(q, abhav, aanya, shared, profile);
        }
        setMessages((m) => [...m, { role: "ai", text: reply }]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: "ai", text: "Something went wrong. Try again." },
        ]);
      }
      setLoading(false);
    },
    [input, loading, mode, abhav, aanya, shared, profile],
  );

  const clear = () => setMessages([{ role: "ai", text: WELCOME }]);

  const copyReport = () => {
    const report = buildReport(abhav, aanya, shared);
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      {/* ── Page header ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          rowGap: 8,
        }}
      >
        <Sparkles size={18} color="var(--gold)" />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          WealthOS AI
        </h2>

        {/* Mode dropdown */}
        <div
          ref={modeMenuRef}
          style={{ position: "relative", marginLeft: "auto" }}
        >
          <button
            onClick={() => setShowModeMenu((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "var(--bg-card2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {currentMode.label}
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          {showModeMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                zIndex: 20,
                minWidth: 190,
              }}
            >
              {MODES.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id);
                    setShowModeMenu(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "10px 14px",
                    background:
                      mode === m.id ? "var(--bg-card2)" : "transparent",
                    border: "none",
                    borderBottom:
                      idx < MODES.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: mode === m.id ? 600 : 400,
                    }}
                  >
                    {m.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Copy Report */}
        <button
          onClick={copyReport}
          title="Copy full financial report — paste into ChatGPT or Claude"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: copied
              ? "var(--green-dim, rgba(76,175,130,0.15))"
              : "var(--bg-card2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "7px 12px",
            cursor: "pointer",
            fontSize: 13,
            color: copied ? "var(--green)" : "var(--text-secondary)",
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy Report"}
        </button>

        {/* Clear */}
        <button
          onClick={clear}
          title="Clear chat"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "7px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Trash2 size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* ── Chat card ───────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Messages */}
        <div
          style={{
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxHeight: "calc(100dvh - 340px)",
            minHeight: 220,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius:
                    m.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                  background:
                    m.role === "user" ? "var(--gold-dim)" : "var(--bg-card2)",
                  border: `1px solid ${
                    m.role === "user" ? "var(--gold-border)" : "var(--border)"
                  }`,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color:
                    m.role === "user" ? "var(--gold)" : "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {renderText(m.text)}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "14px 14px 14px 4px",
                  background: "var(--bg-card2)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts — only on fresh chat */}
        {messages.length <= 1 && (
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              borderTop: "1px solid var(--border)",
            }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 20,
                  background: "var(--bg-card2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask anything about your finances…"
            style={{
              flex: 1,
              fontSize: 14,
              padding: "10px 14px",
              borderRadius: 10,
            }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: input.trim() ? "var(--gold)" : "var(--bg-card2)",
              border: "none",
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Send size={16} color={input.trim() ? "#0c0c0f" : "#55535e"} />
          </button>
        </div>
      </div>
    </div>
  );
}
