import { trapLabel, trapDescription } from "../trapTypes.js";
import Icon from "./Icon.jsx";

const LETTERS = ["A", "B", "C", "D"];

// Structured review of a single attempt, styled as the Graspr layered feedback
// card. AI-derived sections (reasoning score, explanations, takeaway) render
// only when their data is present, so this works both pre-Phase-4 (review only)
// and post-Phase-4 (full AI feedback).
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
  const selectedText = selectedOptionIndex != null ? options[selectedOptionIndex]?.text : null;
  const trapText = trapOptionIndex != null ? options[trapOptionIndex]?.text : null;
  const headColor = skipped ? "var(--text-muted)" : isCorrect ? "var(--green)" : "var(--red)";

  return (
    <div className="flex flex-col gap-[22px]">
      {/* 1 — Result header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-[11px]">
          <span
            className="grid h-[30px] w-[30px] place-items-center rounded-full"
            style={{
              background: skipped
                ? "var(--surface-2)"
                : isCorrect
                ? "rgba(74,222,128,0.14)"
                : "rgba(248,113,113,0.14)",
              color: headColor,
            }}
          >
            <Icon name={isCorrect && !skipped ? "check" : "x"} size={17} stroke={2.2} />
          </span>
          <span className="display text-[27px]" style={{ color: headColor }}>
            {skipped ? "Skipped" : isCorrect ? "Correct" : "Incorrect"}
          </span>
        </div>
        {(selectedText || correctText) && (
          <p className="pl-[41px] text-sm leading-relaxed muted">
            {selectedText && (
              <>
                You chose <strong className="text-foreground">{LETTERS[selectedOptionIndex]}. {selectedText}</strong>
              </>
            )}
            {!skipped && !isCorrect && correctText && (
              <>
                {" "}— the correct answer was{" "}
                <strong style={{ color: "var(--green)" }}>{LETTERS[correctOptionIndex]}. {correctText}</strong>.
              </>
            )}
            {(skipped || (!selectedText && correctText)) && correctText && (
              <>
                {skipped ? "The correct answer was " : ""}
                <strong style={{ color: "var(--green)" }}>{LETTERS[correctOptionIndex]}. {correctText}</strong>
              </>
            )}
          </p>
        )}
      </div>

      {/* 2 — Reasoning score (AI) */}
      {reasoningScore != null && (
        <>
          <hr className="hairline" />
          <div>
            <div className="mb-[11px] flex items-center justify-between">
              <span className="fb-label" style={{ margin: 0 }}>Your reasoning</span>
              <span className="flex items-center gap-2.5">
                <ScoreDots score={reasoningScore} />
                <span className="mono text-sm" style={{ color: "var(--teal)" }}>{reasoningScore}/5</span>
              </span>
            </div>
            {reasoningFeedback && (
              <p className="text-[14.5px] leading-[1.7] muted">{reasoningFeedback}</p>
            )}
          </div>
        </>
      )}

      {/* 3 — Why correct (AI) */}
      {correctExplanation && (
        <div className="accent-card accent-teal">
          <div className="fb-label">Why this is right</div>
          <p className="fb-body">{correctExplanation}</p>
        </div>
      )}

      {/* 4 — The trap (identity always; explanation is AI) */}
      {trapText && (
        <div className="accent-card accent-amber">
          <div className="fb-label">The trap</div>
          <p className="fb-body mb-3">
            <span className="muted">“{trapText}”</span>
          </p>
          <div className="mb-3">
            <span className="badge" style={{ color: "var(--amber)", background: "color-mix(in oklch, var(--amber) 13%, transparent)", borderColor: "color-mix(in oklch, var(--amber) 36%, transparent)" }}>
              {trapLabel(trapType)}
            </span>
          </div>
          <p className="fb-body">{trapExplanation || trapDescription(trapType)}</p>
        </div>
      )}

      {/* 5 — Key takeaway (AI) */}
      {keyTakeaway && (
        <div className="accent-card accent-teal accent-callout">
          <div className="fb-label">Remember</div>
          <p className="fb-body serif-read" style={{ fontSize: 16 }}>{keyTakeaway}</p>
        </div>
      )}
    </div>
  );
}

export function ScoreDots({ score }) {
  return (
    <span className="inline-flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={"score-dot" + (n <= score ? " on" : "")} />
      ))}
    </span>
  );
}
