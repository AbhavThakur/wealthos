import { Sparkles } from "lucide-react";
import useDraggable from "../hooks/useDraggable";

/** Floating button — navigates to the AI Advisor full-screen page */
export default function AIAdvisor({ setPage }) {
  const drag = useDraggable("ai-advisor", { bottom: 24, right: 24 });

  return (
    <button
      {...drag.handlers}
      onClick={() => {
        if (!drag.isDragging) setPage("advisor");
      }}
      aria-label="Open AI advisor"
      style={{
        ...drag.style,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "var(--gold)",
        border: "none",
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 24px rgba(201,168,76,0.35)",
        zIndex: 200,
      }}
    >
      <Sparkles size={20} color="#0c0c0f" />
    </button>
  );
}
