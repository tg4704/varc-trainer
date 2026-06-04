// Circular countdown ring for Intuition mode.
// Shifts green → amber (under 20s) → red (under 10s).
export default function IntuitionTimer({ seconds, total }) {
  const clamped = Math.max(0, seconds);
  const fraction = total > 0 ? clamped / total : 0;
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - fraction);

  let stroke = "#22c55e";
  if (seconds <= 10) stroke = "#ef4444";
  else if (seconds <= 20) stroke = "#f59e0b";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={44} cy={44} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle
          cx={44}
          cy={44}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.25s" }}
        />
      </svg>
      <span
        className="absolute text-xl font-bold tabular-nums"
        style={{ color: stroke }}
      >
        {Math.ceil(clamped)}
      </span>
    </div>
  );
}
