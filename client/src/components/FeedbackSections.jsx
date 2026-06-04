import { trapLabel, trapDescription } from "../trapTypes.js";

const LETTERS = ["A", "B", "C", "D"];

// Structured review of a single attempt. The AI-derived sections (reasoning
// score, explanations, takeaway) render only when their data is present, so this
// works both pre-Phase-4 (review only) and post-Phase-4 (full AI feedback).
export default function FeedbackSections({ attempt }) {
  const {
    options = [],
    correctOptionIndex,
    selectedOptionIndex,
    trapOptionIndex,
    isCorrect,
    skipped,
    trapType,
    reasoningScore,
    reasoningFeedback,
    correctExplanation,
    trapExplanation,
    keyTakeaway,
  } = attempt;

  const correctText = options[correctOptionIndex]?.text;
  const selectedText =
    selectedOptionIndex != null ? options[selectedOptionIndex]?.text : null;
  const trapText = trapOptionIndex != null ? options[trapOptionIndex]?.text : null;

  return (
    <div className="space-y-4">
      {/* 1 — Result + correct answer */}
      <div>
        <div
          className={`text-lg font-bold ${
            skipped ? "text-slate-500" : isCorrect ? "text-green-600" : "text-red-600"
          }`}
        >
          {skipped ? "Skipped" : isCorrect ? "Correct" : "Incorrect"}
        </div>
        {correctText && (
          <p className="mt-1 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            <span className="font-semibold">Correct: {LETTERS[correctOptionIndex]}.</span>{" "}
            {correctText}
          </p>
        )}
        {!skipped && selectedOptionIndex !== correctOptionIndex && selectedText && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <span className="font-semibold">You chose: {LETTERS[selectedOptionIndex]}.</span>{" "}
            {selectedText}
          </p>
        )}
      </div>

      {/* 2 — Reasoning score (AI; Phase 4) */}
      {reasoningScore != null && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your reasoning
          </div>
          <ScoreDots score={reasoningScore} />
          {reasoningFeedback && (
            <p className="mt-1 text-sm text-slate-700">{reasoningFeedback}</p>
          )}
        </div>
      )}

      {/* 3 — Why correct (AI; Phase 4) */}
      {correctExplanation && (
        <div className="rounded-md bg-blue-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Why this is correct
          </div>
          <p className="mt-1 text-sm text-blue-900">{correctExplanation}</p>
        </div>
      )}

      {/* 4 — The trap (identity always; explanation is AI/Phase 4) */}
      {trapText && (
        <div className="rounded-md bg-amber-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            The trap: {LETTERS[trapOptionIndex]}. {trapText}
          </div>
          <p className="mt-1 text-xs text-amber-800">{trapLabel(trapType)} — {trapDescription(trapType)}</p>
          {trapExplanation && <p className="mt-1 text-sm text-amber-900">{trapExplanation}</p>}
        </div>
      )}

      {/* 5 — Key takeaway (AI; Phase 4) */}
      {keyTakeaway && (
        <div className="rounded-md bg-slate-100 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Remember this
          </div>
          <p className="mt-1 text-sm text-slate-800">{keyTakeaway}</p>
        </div>
      )}
    </div>
  );
}

export function ScoreDots({ score }) {
  return (
    <div className="mt-1 flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-3 w-3 rounded-full ${n <= score ? "bg-slate-900" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}
