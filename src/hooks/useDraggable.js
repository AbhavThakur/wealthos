import { useState, useRef, useCallback, useEffect } from "react";

const LS_PREFIX = "fab-pos-";
const DRAG_THRESHOLD = 6; // px — must move this far before it counts as drag

/**
 * Lightweight draggable hook for FABs.
 * Returns { style, handlers, isDragging }.
 * Spread `handlers` onto the element, merge `style`.
 * Position is persisted to localStorage per `id`.
 */
export default function useDraggable(
  id,
  defaultPos = { bottom: 24, right: 24 },
) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + id);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return defaultPos;
  });

  const [isDragging, setIsDragging] = useState(false);

  // Mutable drag tracking — only accessed in event handlers, never during render
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startBottom: 0,
    startRight: 0,
  });

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      const d = dragRef.current;
      d.active = true;
      d.moved = false;
      d.startX = e.clientX;
      d.startY = e.clientY;
      d.startBottom = pos.bottom;
      d.startRight = pos.right;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // Check threshold before starting visual drag
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
        return;
      d.moved = true;
      setIsDragging(true);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const size = 52;

    const newRight = Math.max(8, Math.min(vw - size - 8, d.startRight - dx));
    const newBottom = Math.max(8, Math.min(vh - size - 8, d.startBottom - dy));

    setPos({ bottom: newBottom, right: newRight });
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      d.active = false;

      if (d.moved) {
        // Save position — read from latest state via callback
        setPos((current) => {
          const finalPos = {
            bottom: Math.max(8, current.bottom),
            right: Math.max(8, current.right),
          };
          localStorage.setItem(LS_PREFIX + id, JSON.stringify(finalPos));
          return current;
        });

        // Prevent the click event that follows pointerup after a drag
        const prevent = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        e.currentTarget.addEventListener("click", prevent, {
          capture: true,
          once: true,
        });

        requestAnimationFrame(() => setIsDragging(false));
      }
    },
    [id],
  );

  // Cleanup on unmount
  useEffect(() => {
    const d = dragRef.current;
    return () => {
      d.active = false;
    };
  }, []);

  const style = {
    position: "fixed",
    bottom: pos.bottom,
    right: pos.right,
    touchAction: "none",
    userSelect: "none",
  };

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };

  return { style, handlers, isDragging };
}
