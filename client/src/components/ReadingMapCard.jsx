// Renders the reading map the student submitted BEFORE seeing any question,
// optionally beside the passage's canonical key ("the model reading").
//
// IMPORTANT — why `readingKey` is not always passed:
// The canonical key is the answer key for the reading-map step, and it overlaps
// almost entirely with what main-idea / tone / title questions test. On a
// sample passage its `thesis` answered both the inference and title questions
// and its `tone` answered the tone question — 3 of 4. So the server only
// releases it once the session is COMPLETED (see readingKeyIfRevealed in
// server/routes/coach.js). During the question phase this component is rendered
// map-only, which leaks nothing: the student's own map and the AI grade were
// both already shown to them before the first question.
import Icon from "./Icon.jsx";

// The student's map arrives as { mode, crux[], mainPoint, tone, structure[], theTurn }.
// "quick" mode fills crux[]; "full" mode fills the rest.
function studentRows(map) {
  if (!map) return [];
  if (map.mode === "quick") {
    return (map.crux || []).map((c, i) => ({ label: `¶${i + 1}`, value: c }));
  }
  return [
    { label: "Main point", value: map.mainPoint },
    { label: "Tone", value: map.tone },
    ...(map.structure || []).map((s, i) => ({ label: `¶${i + 1}`, value: s })),
    { label: "The turn", value: map.theTurn },
  ].filter((r) => r.value);
}

function keyRows(key) {
  if (!key) return [];
  return [
    { label: "Thesis", value: key.thesis },
    { label: "Tone", value: key.tone },
    ...(key.paragraph_functions || []).map((f, i) => ({ label: `¶${i + 1}`, value: f })),
    { label: "The turn", value: key.key_turn },
  ].filter((r) => r.value);
}

function Column({ title, rows, accent, empty }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {title}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] muted">{empty}</p>
      ) : (
        <dl className="space-y-2">
          {rows.map((r, i) => (
            <div key={i}>
              <dt className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-3, #6b7280)" }}>
                {r.label}
              </dt>
              <dd className="text-[13px] leading-relaxed" style={{ color: "var(--text)" }}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function ReadingMapCard({ map, readingKey, className = "" }) {
  if (!map) return null;
  const mine = studentRows(map);
  const canonical = keyRows(readingKey);
  const comparing = canonical.length > 0;

  return (
    <div
      className={`rounded-[16px] p-5 ${className}`}
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-6 w-6 flex-none items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}
        >
          <Icon name="book" size={13} stroke={2.4} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
          {comparing ? "Your map vs the model reading" : "Your reading map"}
        </span>
        <span className="mono ml-auto text-[10.5px] muted">{map.mode === "quick" ? "quick" : "full"}</span>
      </div>

      <div className={comparing ? "flex flex-col gap-5 sm:flex-row sm:gap-6" : ""}>
        <Column
          title="What you wrote"
          rows={mine}
          accent="var(--text-2)"
          empty="No map recorded for this session."
        />
        {comparing && (
          <>
            <div className="hidden w-px flex-none sm:block" style={{ background: "var(--border-subtle)" }} />
            <Column title="The model reading" rows={canonical} accent="var(--teal)" empty="" />
          </>
        )}
      </div>

      {comparing && (
        <p className="mt-4 text-[12px] leading-relaxed muted">
          These rarely match word-for-word — what matters is whether you tracked the same{" "}
          <em>moves</em> (what each paragraph does, and where the argument turns), not whether you
          used the same words.
        </p>
      )}
    </div>
  );
}
