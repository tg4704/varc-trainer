// Floating question stepper, dockable to any edge of the viewport (desktop
// only - see Practice.jsx's mobile fallback). Shows previous/current/next
// question buttons; hovering the current one reveals a popover with every
// question in a grid, plus a colour legend. A "move" handle cycles the dock
// between left → top → right → bottom so it never has to sit on top of the
// reading text - the chosen edge is remembered in localStorage across
// sessions. All per-question status (correct/incorrect/seen/unseen) already
// lives in the caller's questionStates[] - this is a pure presentation layer.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

const POS_KEY = "varc_stepper_pos";
const POSITIONS = ["left", "top", "right", "bottom"];

// Seed from localStorage at module load so the dock doesn't flash to the
// default on every mount.
let _cachedPos = "left";
try {
  const saved = localStorage.getItem(POS_KEY);
  if (saved && POSITIONS.includes(saved)) _cachedPos = saved;
} catch {}

export function stateFor(s) {
  if (s.feedback) return s.feedback.isCorrect ? "correct" : "incorrect";
  if (s.skipped) return "skipped";
  if (s.locked || s.visited) return "seen";
  return "unseen";
}

export function statusDotColor(status) {
  switch (status) {
    case "correct": return "var(--green)";
    case "incorrect": return "var(--red)";
    case "skipped":
    case "seen": return "var(--amber)";
    default: return "rgba(255,255,255,0.25)";
  }
}

function styleFor(status, isCurrent) {
  if (isCurrent) {
    return { background: "rgba(93,202,165,0.16)", color: "var(--teal)", boxShadow: "0 0 0 2px rgba(93,202,165,0.75)" };
  }
  switch (status) {
    case "correct": return { background: "var(--green)", color: "#06210F" };
    case "incorrect": return { background: "rgba(248,113,113,0.16)", color: "var(--red)" };
    case "skipped":
    case "seen": return { background: "rgba(251,191,36,0.14)", color: "var(--amber)" };
    default: return { background: "rgba(255,255,255,0.05)", color: "var(--text-2)" };
  }
}

// Fixed-position anchor for the whole stepper, per dock edge. Left/right are
// vertical rails centred on the viewport height; top/bottom are horizontal
// bars centred on the width (top clears the in-session bar).
function dockAnchor(pos) {
  switch (pos) {
    case "right":  return { className: "fixed right-4 top-1/2 z-[70] hidden -translate-y-1/2 md:block", row: false };
    case "top":    return { className: "fixed left-1/2 top-[68px] z-[70] hidden -translate-x-1/2 md:block", row: true };
    case "bottom": return { className: "fixed bottom-4 left-1/2 z-[70] hidden -translate-x-1/2 md:block", row: true };
    case "left":
    default:       return { className: "fixed left-4 top-1/2 z-[70] hidden -translate-y-1/2 md:block", row: false };
  }
}

export default function QuestionStepper({ total, currentIdx, questionStates, onJump }) {
  // The popover is portaled to <body> so its own backdrop-filter isn't nested
  // inside this stepper's backdrop-filter (a blur nested inside another blur
  // renders flat). Hover uses a short close-delay so crossing the gap from the
  // trigger to the detached popover doesn't flicker it closed.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [pos, setPos] = useState(_cachedPos);
  // Non-null only while the handle is being dragged: the edge the pointer is
  // currently nearest to. Rendering from it gives live snap feedback instead of
  // the panel sitting still until you let go.
  const [dragPos, setDragPos] = useState(null);
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const dragMovedRef = useRef(false);

  const shownPos = dragPos || pos;
  const { className: dockClass, row } = dockAnchor(shownPos);

  function commitPos(next) {
    _cachedPos = next;
    try { localStorage.setItem(POS_KEY, next); } catch {}
    setPos(next);
  }

  // Whichever viewport edge the pointer is closest to.
  function nearestEdge(x, y) {
    const d = { left: x, right: window.innerWidth - x, top: y, bottom: window.innerHeight - y };
    return Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
  }

  // The handle is drag-first (that's what the four-way arrow promises) but a
  // plain click still cycles edges, so it stays usable by keyboard and by
  // anyone who just taps it.
  function onHandlePointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragMovedRef.current = false;
    setPopoverOpen(false);
    const startX = e.clientX;
    const startY = e.clientY;

    const move = (ev) => {
      if (!dragMovedRef.current && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragMovedRef.current = true;
      setDragPos(nearestEdge(ev.clientX, ev.clientY));
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragPos(null);
      if (dragMovedRef.current) commitPos(nearestEdge(ev.clientX, ev.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function cyclePos() {
    if (dragMovedRef.current) return; // the pointerup already committed a drop
    setPopoverOpen(false);
    commitPos(POSITIONS[(POSITIONS.indexOf(pos) + 1) % POSITIONS.length]);
  }

  function openPopover() {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
    setPopoverOpen(true);
  }
  function scheduleClosePopover() {
    closeTimerRef.current = setTimeout(() => setPopoverOpen(false), 150);
  }
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const prevIdx = currentIdx - 1;
  const nextIdx = currentIdx + 1;

  // Popover opens toward the viewport centre from whichever edge we're docked.
  function popoverStyle(rect) {
    switch (shownPos) {
      case "right":  return { position: "fixed", right: window.innerWidth - rect.left + 12, top: rect.top + rect.height / 2, transform: "translateY(-50%)", zIndex: 80 };
      case "top":    return { position: "fixed", left: rect.left + rect.width / 2, top: rect.bottom + 12, transform: "translateX(-50%)", zIndex: 80 };
      case "bottom": return { position: "fixed", left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 12, transform: "translateX(-50%)", zIndex: 80 };
      case "left":
      default:       return { position: "fixed", left: rect.right + 12, top: rect.top + rect.height / 2, transform: "translateY(-50%)", zIndex: 80 };
    }
  }

  const nextPos = POSITIONS[(POSITIONS.indexOf(pos) + 1) % POSITIONS.length];
  const moveTitle = `Drag to any edge, or click to dock ${nextPos} (now: ${pos}).`;

  return (
    <div className={dockClass}>
      <div
        className={`flex ${row ? "flex-row" : "flex-col"} items-center gap-1.5 rounded-[16px] p-1.5`}
        style={{
          background: "rgba(20,23,31,0.92)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 14px 40px rgba(0,0,0,0.4)",
        }}
      >
        {prevIdx >= 0 && (
          <StepBtn n={prevIdx + 1} style={styleFor(stateFor(questionStates[prevIdx] || {}), false)} onClick={() => onJump(prevIdx)} />
        )}

        <div
          className="relative"
          ref={triggerRef}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClosePopover}
        >
          <StepBtn n={currentIdx + 1} style={styleFor(stateFor(questionStates[currentIdx] || {}), true)} current />
        </div>

        {popoverOpen && triggerRect && createPortal(
          <div
            onMouseEnter={openPopover}
            onMouseLeave={scheduleClosePopover}
            style={popoverStyle(triggerRect)}
          >
            <div
              className="relative rounded-[16px] p-3.5"
              style={{
                background: "rgba(20,23,31,0.94)",
                backdropFilter: "blur(22px) saturate(150%)",
                WebkitBackdropFilter: "blur(22px) saturate(150%)",
                border: "1px solid rgba(255,255,255,0.13)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.12) inset, 0 20px 50px rgba(0,0,0,0.55)",
              }}
            >
              <div className="mono mb-2.5 text-center text-[9.5px] uppercase tracking-[0.12em] dim">All questions</div>
              {/* Columns stretch instead of being pinned to 32px: the legend
                  row below is wider than 4×32px, so a fixed grid left a dead
                  gutter on the right of the panel. minmax keeps the buttons
                  from ever shrinking below tap size. */}
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, minmax(32px, 1fr))" }}>
                {Array.from({ length: total }, (_, i) => (
                  <StepBtn
                    key={i}
                    n={i + 1}
                    style={styleFor(stateFor(questionStates[i] || {}), i === currentIdx)}
                    onClick={i === currentIdx ? undefined : () => onJump(i)}
                    current={i === currentIdx}
                    fill
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <Legend color="#4ADE80" label="Correct" />
                <Legend color="#F87171" label="Incorrect" />
                <Legend color="#FBBF24" label="Seen" />
                <Legend color="rgba(255,255,255,0.18)" label="Not seen" />
              </div>
            </div>
          </div>,
          document.body
        )}

        {nextIdx < total && (
          <StepBtn n={nextIdx + 1} style={styleFor(stateFor(questionStates[nextIdx] || {}), false)} onClick={() => onJump(nextIdx)} />
        )}

        {/* Divider + move handle to re-dock the panel to another edge. */}
        <span
          className={row ? "mx-0.5 h-6 w-px flex-none" : "my-0.5 h-px w-6 flex-none"}
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        <button
          type="button"
          onClick={cyclePos}
          onPointerDown={onHandlePointerDown}
          title={moveTitle}
          aria-label={moveTitle}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
          style={{
            color: dragPos ? "var(--teal)" : "var(--text-2)",
            cursor: dragPos ? "grabbing" : "grab",
            touchAction: "none", // let us own the gesture instead of the browser scrolling
          }}
        >
          <Icon name="move" size={15} />
        </button>
      </div>
    </div>
  );
}

function StepBtn({ n, style, onClick, current = false, fill = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={current}
      className={`mono flex items-center justify-center rounded-[9px] text-[12.5px] font-semibold transition-transform hover:scale-[1.08] ${fill ? "w-full" : "flex-none"}`}
      style={{ width: fill ? undefined : 32, height: 32, cursor: current ? "default" : "pointer", ...style }}
    >
      {n}
    </button>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-2)" }}>
      <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
