// Renders the AI grade of a student's reading map (Coach). Shared across the
// Coach practice screen (post-submit modal + revisit dock) and the Coach
// summary/review page so the "how you read" feedback looks identical everywhere.
import Icon from "./Icon.jsx";

export default function ReadingGradeCard({ grade, onRetry, retrying, className = "" }) {
  if (!grade) return null;
  const ungraded = grade.ungraded;

  return (
    <div
      className={`rounded-[16px] p-5 ${className}`}
      style={ungraded
        ? { background: "rgba(240,168,104,0.06)", border: "1px solid rgba(240,168,104,0.3)" }
        : { background: "rgba(93,202,165,0.06)", border: "1px solid rgba(93,202,165,0.3)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full"
            style={{
              background: ungraded ? "rgba(240,168,104,0.15)" : "rgba(93,202,165,0.15)",
              color: ungraded ? "var(--amber)" : "var(--teal)",
            }}
          >
            <Icon name={ungraded ? "x" : "target"} size={13} stroke={2.4} />
          </span>
          <span
            className="truncate text-xs font-semibold uppercase tracking-wide"
            style={{ color: ungraded ? "var(--amber)" : "var(--teal)" }}
          >
            {ungraded ? "Reading feedback unavailable" : `Your reading: ${grade.reading_mode?.replace(/-/g, " ")}`}
          </span>
        </div>
        {ungraded && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="flex-none rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60"
            style={{ borderColor: "rgba(240,168,104,0.4)", color: "var(--amber)" }}
          >
            {retrying ? "Retrying…" : "Retry grade"}
          </button>
        )}
      </div>

      {grade.verdict_line && (
        <p className="mt-3 text-[15px] font-semibold leading-snug text-foreground">{grade.verdict_line}</p>
      )}

      <div className={ungraded ? "mt-2" : "mt-3 grid gap-3 sm:grid-cols-2"}>
        <div className="rounded-[10px] p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }}>
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide dim">
            <Icon name="eye" size={12} stroke={2.4} /> What you missed
          </div>
          <p className="text-xs leading-relaxed muted">{grade.what_you_missed}</p>
        </div>
        {!ungraded && (
          <div className="rounded-[10px] p-3" style={{ background: "rgba(93,202,165,0.05)", border: "1px solid rgba(93,202,165,0.25)" }}>
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--teal)" }}>
              <Icon name="spark" size={12} stroke={2.4} /> Try this next
            </div>
            <p className="text-xs leading-relaxed text-foreground">{grade.one_technique}</p>
          </div>
        )}
      </div>
    </div>
  );
}
