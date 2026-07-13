import { useState } from "react";
import { trapLabel, trapDescription } from "../trapTypes.js";
import Icon from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../auth.jsx";

const LETTERS = ["A", "B", "C", "D"];

// Per-option one-line verdict for the "Every option" tab. Built entirely from
// data already on hand (no extra AI call): the real AI text for the correct
// and trap options, a lightweight templated line for the rest.
function buildOptionVerdicts({ options, correctOptionIndex, trapOptionIndex, trapType, correctExplanation, trapExplanation }) {
  return options.map((o, i) => {
    if (i === correctOptionIndex) {
      return { letter: LETTERS[i], kind: "correct", label: "Correct", note: correctExplanation || "This is what the passage supports." };
    }
    if (trapOptionIndex != null && i === trapOptionIndex) {
      return { letter: LETTERS[i], kind: "trap", label: "The trap", note: trapExplanation || trapDescription(trapType) };
    }
    return { letter: LETTERS[i], kind: "wrong", label: "Not supported", note: "Doesn't match what the passage actually argues." };
  });
}

// Structured review of a single attempt, styled as the Graspr layered feedback
// card. Result header + optional reasoning echo render up top; the rest splits
// into two tabs (Explanation / Every option) when both AI commentary and
// option data are available. Falls back to whichever exists (or neither, for
// a bare skip) so this still works pre-Phase-4 or without reasoning text.
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
    reasoningText,
  } = attempt;

  const [tab, setTab] = useState("explanation");
  const { user } = useAuth();

  // Option text usually ends with a period; the sentences below add their own
  // punctuation, so trim a trailing "." to avoid "…informed.." double periods.
  const stripDot = (s) => (s ? s.replace(/\s*\.\s*$/, "") : s);
  const correctText = stripDot(options[correctOptionIndex]?.text);
  const selectedText = selectedOptionIndex != null ? stripDot(options[selectedOptionIndex]?.text) : null;
  const headColor = skipped ? "var(--text-muted)" : isCorrect ? "var(--green)" : "var(--red)";

  const hasExplanation = reasoningScore != null || !!correctExplanation || !!trapExplanation || !!keyTakeaway;
  const hasOptions = options.length > 0 && correctOptionIndex != null;
  const showTabs = hasExplanation && hasOptions;
  const optionVerdicts = hasOptions
    ? buildOptionVerdicts({ options, correctOptionIndex, trapOptionIndex, trapType, correctExplanation, trapExplanation })
    : [];

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Result header */}
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
                You chose <strong className="text-foreground">{LETTERS[selectedOptionIndex]}. {selectedText}</strong>.
              </>
            )}
            {!skipped && !isCorrect && correctText && (
              <>
                {" "}The correct answer was{" "}
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

      {/* Reasoning echo — the student's own words, when we have them */}
      {reasoningText && (
        <div
          className="flex items-start gap-2.5 rounded-[13px] px-4 py-[13px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }}
        >
          <Avatar avatarId={user?.avatarId} name={user?.name || user?.username} size={24} radius={7} />
          <div>
            <div className="mono mb-1 text-[10px] font-bold uppercase tracking-wide dim">Your reasoning</div>
            <p className="text-[12.5px] leading-[1.55] muted">{reasoningText}</p>
          </div>
        </div>
      )}

      {showTabs && (
        <div className="flex gap-1">
          <TabButton active={tab === "explanation"} onClick={() => setTab("explanation")}>Explanation</TabButton>
          <TabButton active={tab === "options"} onClick={() => setTab("options")}>Every option</TabButton>
        </div>
      )}

      {(!showTabs ? hasExplanation : tab === "explanation") && hasExplanation && (
        <div className="flex flex-col gap-[18px]">
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

          {correctExplanation && (
            <div className="accent-card accent-teal">
              <div className="fb-label">Why this is right</div>
              <p className="fb-body">{correctExplanation}</p>
            </div>
          )}

          {trapOptionIndex != null && options[trapOptionIndex] && (
            <div className="accent-card accent-amber">
              <div className="fb-label">The trap</div>
              <p className="fb-body mb-3">
                <span className="muted">“{options[trapOptionIndex].text}”</span>
              </p>
              <div className="mb-3">
                <span className="badge" style={{ color: "var(--amber)", background: "color-mix(in oklch, var(--amber) 13%, transparent)", borderColor: "color-mix(in oklch, var(--amber) 36%, transparent)" }}>
                  {trapLabel(trapType)}
                </span>
              </div>
              <p className="fb-body">{trapExplanation || trapDescription(trapType)}</p>
            </div>
          )}

          {keyTakeaway && (
            <div className="accent-card accent-teal accent-callout">
              <div className="fb-label">Remember</div>
              <p className="fb-body serif-read" style={{ fontSize: 16 }}>{keyTakeaway}</p>
            </div>
          )}
        </div>
      )}

      {(!showTabs ? hasOptions && !hasExplanation : tab === "options") && hasOptions && (
        <div className="flex flex-col gap-[10px]">
          {optionVerdicts.map((v) => (
            <div key={v.letter} className="flex items-start gap-[9px]">
              <span
                className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px] text-[10.5px] font-bold"
                style={
                  v.kind === "correct"
                    ? { background: "var(--green)", color: "#06210F" }
                    : v.kind === "trap"
                    ? { background: "rgba(251,191,36,0.18)", color: "var(--amber)" }
                    : { background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }
                }
              >
                {v.letter}
              </span>
              <p className="text-[12px] leading-[1.5] muted">
                <strong className="text-foreground">{v.label}.</strong> {v.note}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
      style={active ? { background: "var(--periwinkle)", color: "#07130E" } : { background: "rgba(255,255,255,0.04)", color: "var(--text-2)" }}
    >
      {children}
    </button>
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
