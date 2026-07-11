// Minimal in-session bar for Drills practice: Exit / progress / session timer.
// Replaces the app-level TopNav while a session is active — this is the
// "in-session minimal top bar" deferred from the v2 redesign pass. The mode
// pill (Analysis/Intuition) was removed; the timer carries an optional label
// ("Session") so it's never confused with the per-question donut timer.
import Icon from "./Icon.jsx";

export default function SessionTopBar({ current, total, timerText, timerTone = "neutral", timerLabel, onExit }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const timerColor = timerTone === "danger" ? "var(--red)" : timerTone === "warn" ? "var(--amber)" : "var(--text)";

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

      {/* Center group shrinks with the viewport (flex-1 min-w-0) instead of
          forcing a fixed 160px bar; the "Question" word drops below sm. */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
        <span className="mono whitespace-nowrap text-[12px]" style={{ color: "var(--text-2)" }}>
          <span className="hidden sm:inline">Question </span>{current} / {total}
        </span>
        <div className="h-[5px] w-full max-w-[160px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), var(--periwinkle))" }}
          />
        </div>
      </div>

      <div className="flex flex-none items-center gap-3">
        {timerText && (
          <span className="flex items-center gap-1.5">
            <Icon name="clock" size={14} style={{ color: "var(--text-2)" }} />
            {timerLabel && (
              <span className="mono hidden text-[9px] uppercase tracking-[0.12em] sm:inline" style={{ color: "var(--text-2)" }}>
                {timerLabel}
              </span>
            )}
            <span className="mono text-[13px] font-semibold tabular-nums" style={{ color: timerColor }}>
              {timerText}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}
