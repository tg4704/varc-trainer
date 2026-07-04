// Minimal in-session bar for Drills practice: Exit / progress / timer / mode
// pill. Replaces the app-level TopNav while a session is active — this is
// the "in-session minimal top bar" deferred from the v2 redesign pass.
import Icon from "./Icon.jsx";

export default function SessionTopBar({ current, total, timerText, timerTone = "neutral", modeLabel, onExit }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const timerColor = timerTone === "danger" ? "var(--red)" : timerTone === "warn" ? "var(--amber)" : "var(--text)";

  return (
    <header
      className="flex items-center justify-between px-6 py-3.5"
      style={{ borderBottom: "1px solid var(--glass-border-lo)" }}
    >
      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--text-2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
      >
        <Icon name="arrowR" size={15} style={{ transform: "rotate(180deg)" }} /> Exit
      </button>

      <div className="flex items-center gap-2.5">
        <span className="mono text-[12px]" style={{ color: "var(--text-2)" }}>
          Question {current} / {total}
        </span>
        <div className="h-[5px] w-[160px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), var(--periwinkle))" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {timerText && (
          <span className="mono flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: timerColor }}>
            <Icon name="clock" size={14} style={{ color: "var(--text-2)" }} />
            {timerText}
          </span>
        )}
        {modeLabel && (
          <span
            className="rounded-full px-3 py-[5px] text-[12px] font-semibold"
            style={{ color: "var(--teal)", background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)" }}
          >
            {modeLabel}
          </span>
        )}
      </div>
    </header>
  );
}
