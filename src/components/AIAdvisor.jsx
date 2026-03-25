import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, X, Trash2, Zap, Globe } from "lucide-react";
import { askSmart } from "../utils/smartAdvisor";
import { askAdvisor, buildContext } from "../utils/aiAdvisor";

const QUICK_PROMPTS = [
  "How am I doing this month?",
  "Should I increase my SIP?",
  "Which goal needs attention?",
  "Am I saving enough?",
  "How can I reduce tax this year?",
  "Show my trip expenses",
  "Net worth trend",
  "Compare this vs last month",
  "My income sources",
  "Spending by category",
];

const WELCOME = `Hi! I'm your WealthOS advisor ⚡\nI run locally — instant answers, no API needed.\nAsk me about savings, SIPs, goals, tax, or anything financial.`;

/** Render **bold** as <strong> in message text */
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

export default function AIAdvisor({ abhav, aanya, shared, profile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("smart"); // "smart" = local | "gemini" = API
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (text) => {
      const q = (text || input).trim();
      if (!q || loading) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: q }]);
      setLoading(true);
      try {
        let reply;
        if (mode === "gemini") {
          const ctx = buildContext(abhav, aanya, shared, profile);
          reply = await askAdvisor(q, ctx);
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
  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_KEY;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI advisor" : "Open AI advisor"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--gold)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(201,168,76,0.35)",
          zIndex: 200,
          transition: "transform .15s",
        }}
      >
        {open ? (
          <X size={20} color="#0c0c0f" />
        ) : (
          <Sparkles size={20} color="#0c0c0f" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="AI Financial Advisor"
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: 360,
            maxHeight: 500,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            zIndex: 200,
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Sparkles size={15} color="var(--gold)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>WealthOS AI</span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginLeft: 4,
              }}
            >
              {mode === "smart" ? "⚡ Local" : "☁️ Gemini"}
            </span>
            {/* Mode toggle */}
            {hasGeminiKey && (
              <button
                onClick={() =>
                  setMode((m) => (m === "smart" ? "gemini" : "smart"))
                }
                title={
                  mode === "smart"
                    ? "Switch to Gemini (cloud AI)"
                    : "Switch to Local (instant)"
                }
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  padding: "2px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  color: "var(--text-secondary)",
                }}
              >
                {mode === "smart" ? <Globe size={10} /> : <Zap size={10} />}
                {mode === "smart" ? "Gemini" : "Local"}
              </button>
            )}
            <button
              onClick={clear}
              title="Clear chat"
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
            >
              <Trash2 size={13} color="var(--text-muted)" />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
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
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius:
                      m.role === "user"
                        ? "12px 12px 4px 12px"
                        : "12px 12px 12px 4px",
                    background:
                      m.role === "user" ? "var(--gold-dim)" : "var(--bg-card2)",
                    border: `1px solid ${m.role === "user" ? "var(--gold-border)" : "var(--border)"}`,
                    fontSize: 13,
                    lineHeight: 1.6,
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
                    padding: "8px 14px",
                    borderRadius: "12px 12px 12px 4px",
                    background: "var(--bg-card2)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts — only shown on fresh chat */}
          {messages.length <= 1 && (
            <div
              style={{
                padding: "0 12px 10px",
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
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
              padding: "10px 12px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything about your finances…"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: input.trim() ? "var(--gold)" : "var(--bg-card2)",
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Send size={14} color={input.trim() ? "#0c0c0f" : "#55535e"} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
