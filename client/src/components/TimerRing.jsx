// Small SVG donut timer for the passage panel header. Shared shape with
// IntuitionTimer's countdown ring, but compact (default 54px), shows MM:SS
// text, and optionally supports pause/resume (hover reveals a play/pause
// overlay) — used for the per-question timer in Analysis mode.
function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function TimerRing({ seconds, totalSeconds, paused = false, onTogglePause, size = 54 }) {
  const clamped = Math.max(0, seconds ?? 0);
  const fraction = totalSeconds > 0 ? clamped / totalSeconds : 0;
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)));
  const c = size / 2;

  let stroke = "var(--teal)";
  if (paused) stroke = "var(--amber)";
  else if (clamped <= 15) stroke = "var(--red)";

  return (
    <button
      type="button"
      onClick={onTogglePause}
      disabled={!onTogglePause}
      className="group relative flex flex-none items-center justify-center rounded-full"
      style={{ width: size, height: size, cursor: onTogglePause ? "pointer" : "default", background: "none", border: "none" }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={4} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.25s" }}
        />
      </svg>
      <span className="mono text-[12px] font-semibold" style={{ color: stroke }}>
        {formatMMSS(clamped)}
      </span>
      {onTogglePause && (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(11,13,19,0.6)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text)">
            {paused ? <path d="M8 5v14l11-7z" /> : <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>}
          </svg>
        </span>
      )}
    </button>
  );
}
