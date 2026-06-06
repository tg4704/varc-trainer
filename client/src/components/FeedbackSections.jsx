import { trapLabel, trapDescription } from "../trapTypes.js";
import { cn } from "../lib/utils.js";

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
          className={cn(
            "text-lg font-bold",
            skipped ? "text-muted-foreground" : isCorrect ? "text-success" : "text-destructive"
          )}
        >
          {skipped ? "Skipped" : isCorrect ? "Correct" : "Incorrect"}
        </div>
        {correctText && (
          <p className="mt-1 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            <span className="font-semibold">Correct: {LETTERS[correctOptionIndex]}.</span>{" "}
            {correctText}
          </p>
        )}
        {!skipped && selectedOptionIndex !== correctOptionIndex && selectedText && (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-semibold">You chose: {LETTERS[selectedOptionIndex]}.</span>{" "}
            {selectedText}
          </p>
        )}
      </div>

      {/* 2 — Reasoning score (AI; Phase 4) */}
      {reasoningScore != null && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your reasoning
          </div>
          <ScoreDots score={reasoningScore} />
          {reasoningFeedback && (
            <p className="mt-1 text-sm text-foreground">{reasoningFeedback}</p>
          )}
        </div>
      )}

      {/* 3 — Why correct (AI; Phase 4) */}
      {correctExplanation && (
        <div className="rounded-md bg-primary/10 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Why this is correct
          </div>
          <p className="mt-1 text-sm text-foreground">{correctExplanation}</p>
        </div>
      )}

      {/* 4 — The trap (identity always; explanation is AI/Phase 4) */}
      {trapText && (
        <div className="rounded-md bg-warning/15 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-warning">
            The trap: {LETTERS[trapOptionIndex]}. {trapText}
          </div>
          <p className="mt-1 text-xs text-warning">
            {trapLabel(trapType)} — {trapDescription(trapType)}
          </p>
          {trapExplanation && <p className="mt-1 text-sm text-foreground">{trapExplanation}</p>}
        </div>
      )}

      {/* 5 — Key takeaway (AI; Phase 4) */}
      {keyTakeaway && (
        <div className="rounded-md bg-muted px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Remember this
          </div>
          <p className="mt-1 text-sm text-foreground">{keyTakeaway}</p>
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
          className={cn(
            "h-3 w-3 rounded-full",
            n <= score ? "bg-foreground" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
