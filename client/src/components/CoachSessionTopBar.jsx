// Minimal in-session bar for a VARC Coach passage — mirrors Drills'
// SessionTopBar shell (Exit left, progress center) so the two practice
// surfaces feel like one product. Coach has no timer, but its progress model
// has two phases: mapping the passage first, then answering N questions.
import Icon from "./Icon.jsx";

export default function CoachSessionTopBar({ phase, qIndex, qTotal, onExit }) {
  return (
    <header
      className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-6"
      style={{ borderBottom: "1px solid var(--glass-border-lo)" }}
    >
      <button
        type="button"
        onClick={onExit}
        className="flex flex-none items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--text-2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
      >
        <Icon name="arrowR" size={15} style={{ transform: "rotate(180deg)" }} /> Exit
      </button>

      {/* Center group shrinks with the viewport (flex-1 min-w-0) instead of a
          fixed 160px segment row; the "Question" word drops below sm. */}
      {phase === "reading" ? (
        <span className="mono min-w-0 flex-1 truncate text-center text-[12px]" style={{ color: "var(--text-2)" }}>Mapping the passage</span>
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
          <span className="mono whitespace-nowrap text-[12px]" style={{ color: "var(--text-2)" }}>
            <span className="hidden sm:inline">Question </span>{qIndex} / {qTotal}
          </span>
          <div className="flex w-full max-w-[160px] items-center gap-1">
            {Array.from({ length: qTotal }, (_, i) => (
              <div
                key={i}
                className="h-[5px] flex-1 rounded-full transition-colors"
                style={{
                  background: i < qIndex - 1
                    ? "var(--teal)"
                    : i === qIndex - 1
                    ? "var(--periwinkle)"
                    : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <span className="flex flex-none items-center gap-1.5" style={{ color: "var(--periwinkle)" }}>
        <Icon name="spark" size={13} style={{ animation: "aiTwinkle 2.6s ease-in-out infinite" }} />
        <span className="mono hidden text-[10px] uppercase tracking-[0.12em] sm:inline">AI Coach</span>
      </span>
    </header>
  );
}
