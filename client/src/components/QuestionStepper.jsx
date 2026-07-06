// Floating vertical question stepper, docked to the left edge of the
// viewport (desktop only — see Practice.jsx's mobile fallback). Shows the
// previous/current/next question buttons; hovering the current one reveals
// a popover with every question in a grid, plus a colour legend. All the
// underlying per-question status (correct/incorrect/seen/unseen) already
// lives in Practice.jsx's questionStates[] — this is a pure presentation
// layer over that same data, replacing the old inline horizontal pill row.
import { useState } from "react";

export function stateFor(s) {
  if (s.feedback) return s.feedback.isCorrect ? "correct" : "incorrect";
  if (s.skipped) return "skipped";
  if (s.locked) return "seen";
  return "unseen";
}

export function statusDotColor(status) {
  switch (status) {
    case "correct": return "var(--green)";
    case "incorrect": return "var(--red)";
    case "skipped":
    case "seen": return "var(--amber)";
    default: return "rgba(255,255,255,0.25)";
  }
}

function styleFor(status, isCurrent) {
  if (isCurrent) {
    return { background: "rgba(93,202,165,0.16)", color: "var(--teal)", boxShadow: "0 0 0 2px rgba(93,202,165,0.75)" };
  }
  switch (status) {
    case "correct": return { background: "var(--green)", color: "#06210F" };
    case "incorrect": return { background: "rgba(248,113,113,0.16)", color: "var(--red)" };
    case "skipped":
    case "seen": return { background: "rgba(251,191,36,0.14)", color: "var(--amber)" };
    default: return { background: "rgba(255,255,255,0.05)", color: "var(--text-2)" };
  }
}

export default function QuestionStepper({ total, currentIdx, questionStates, onJump }) {
  const [hover, setHover] = useState(false);
  const prevIdx = currentIdx - 1;
  const nextIdx = currentIdx + 1;

  return (
    <div className="fixed left-5 top-1/2 z-[70] hidden -translate-y-1/2 md:block">
      <div
        className="flex flex-col items-center gap-1.5 rounded-[16px] p-1.5"
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 14px 40px rgba(0,0,0,0.4)",
        }}
      >
        {prevIdx >= 0 && (
          <StepBtn n={prevIdx + 1} style={styleFor(stateFor(questionStates[prevIdx] || {}), false)} onClick={() => onJump(prevIdx)} />
        )}

        <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <StepBtn n={currentIdx + 1} style={styleFor(stateFor(questionStates[currentIdx] || {}), true)} current />
          {hover && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 pl-3">
              <div
                className="relative rounded-[16px] p-3.5"
                style={{
                  background: "rgba(20,23,31,0.86)",
                  backdropFilter: "blur(22px) saturate(150%)",
                  WebkitBackdropFilter: "blur(22px) saturate(150%)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.12) inset, 0 20px 50px rgba(0,0,0,0.55)",
                }}
              >
                {/* arrow pointer back toward the stepper */}
                <span
                  className="absolute top-1/2 h-3 w-3"
                  style={{
                    left: -6,
                    transform: "translateY(-50%) rotate(45deg)",
                    background: "rgba(20,23,31,0.86)",
                    borderLeft: "1px solid rgba(255,255,255,0.13)",
                    borderBottom: "1px solid rgba(255,255,255,0.13)",
                  }}
                />
                <div className="mono mb-2.5 text-center text-[9.5px] uppercase tracking-[0.12em] dim">All questions</div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 32px)" }}>
                  {Array.from({ length: total }, (_, i) => (
                    <StepBtn
                      key={i}
                      n={i + 1}
                      style={styleFor(stateFor(questionStates[i] || {}), i === currentIdx)}
                      onClick={i === currentIdx ? undefined : () => onJump(i)}
                      current={i === currentIdx}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <Legend color="#4ADE80" label="Correct" />
                  <Legend color="#F87171" label="Incorrect" />
                  <Legend color="#FBBF24" label="Seen" />
                  <Legend color="rgba(255,255,255,0.18)" label="Not seen" />
                </div>
              </div>
            </div>
          )}
        </div>

        {nextIdx < total && (
          <StepBtn n={nextIdx + 1} style={styleFor(stateFor(questionStates[nextIdx] || {}), false)} onClick={() => onJump(nextIdx)} />
        )}
      </div>
    </div>
  );
}

function StepBtn({ n, style, onClick, current = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={current}
      className="mono flex flex-none items-center justify-center rounded-[9px] text-[12.5px] font-semibold transition-transform hover:scale-[1.08]"
      style={{ width: 32, height: 32, cursor: current ? "default" : "pointer", ...style }}
    >
      {n}
    </button>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-2)" }}>
      <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
