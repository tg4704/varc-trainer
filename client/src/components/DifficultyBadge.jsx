// Drills difficulty chip (easy | medium | tough). Review-only: never rendered
// while a question is being answered — knowing a question is "tough" before you
// commit is a hint, so it only appears in Results / Session Review.
const STYLES = {
  easy:   { label: "Easy",   color: "var(--green)", bg: "rgba(74,222,128,0.12)",  bd: "rgba(74,222,128,0.35)" },
  medium: { label: "Medium", color: "var(--teal)",  bg: "rgba(93,202,165,0.12)",  bd: "rgba(93,202,165,0.35)" },
  tough:  { label: "Tough",  color: "var(--amber)", bg: "rgba(240,168,104,0.12)", bd: "rgba(240,168,104,0.35)" },
};

export default function DifficultyBadge({ difficulty }) {
  const s = STYLES[difficulty];
  if (!s) return null;
  return (
    <span
      className="mono inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.bd}` }}
    >
      {s.label}
    </span>
  );
}
