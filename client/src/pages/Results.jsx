import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSessionReview } from "../api.js";
import { useAuth } from "../auth.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import ShareResultsModal from "../components/ShareResultsModal.jsx";
import Modal from "../components/Modal.jsx";
import { trapLabel } from "../trapTypes.js";

const TYPE_LABELS = {
  inference: "Inference", tone: "Tone", title: "Title", detail: "Detail",
  application: "Application", main_idea: "Main idea", function: "Function",
  concept_set: "Concept set", vocab_in_context: "Vocab", weaken_strengthen: "Weaken/Strengthen",
};
const LETTERS = ["A", "B", "C", "D"];

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function accuracyColor(acc) {
  if (acc < 0.5) return "var(--red)";
  if (acc <= 0.7) return "var(--amber)";
  return "var(--green)";
}

export default function Results() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [openIdx, setOpenIdx] = useState(null); // index into attempts, or null

  useEffect(() => {
    if (!sessionId) {
      setError("No session specified");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setData(await getSessionReview(sessionId));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center muted">Loading results…</div>;
  }
  if (error) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>;
  }

  const { attempts } = data;
  const answered = attempts.filter((a) => a.skipped === 0);
  const correct = answered.filter((a) => a.is_correct === 1).length;
  const trapPicked = answered.filter((a) => a.selected_trap === 1).length;
  const totalTime = attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0);
  const accuracyPct = answered.length ? Math.round((correct / answered.length) * 100) : 0;
  const avgTime = attempts.length ? totalTime / attempts.length : 0;
  const isIntuition = attempts.some((a) => a.mode === "intuition");
  const totalPoints = attempts.reduce((sum, a) => sum + (a.intuition_points || 0), 0);

  // By-question-type breakdown
  const byType = {};
  for (const a of answered) {
    const t = byType[a.type] || { attempts: 0, correct: 0 };
    t.attempts++;
    if (a.is_correct === 1) t.correct++;
    byType[a.type] = t;
  }
  const typeRows = Object.entries(byType)
    .map(([type, s]) => ({ type, acc: s.attempts ? s.correct / s.attempts : 0, ...s }))
    .sort((a, b) => a.acc - b.acc);

  // Most-fallen-for trap type
  const byTrap = {};
  for (const a of answered) {
    if (!a.trap_type) continue;
    const t = byTrap[a.trap_type] || { encountered: 0, fellFor: 0 };
    t.encountered++;
    if (a.selected_trap === 1) t.fellFor++;
    byTrap[a.trap_type] = t;
  }
  let mostDangerousTrap = null, highestRate = 0;
  for (const [type, s] of Object.entries(byTrap)) {
    const rate = s.encountered ? s.fellFor / s.encountered : 0;
    if (s.fellFor > 0 && rate > highestRate) { highestRate = rate; mostDangerousTrap = type; }
  }

  // AI-style takeaway, templated client-side from stats already on hand
  const weakest = typeRows[0];
  const strongest = typeRows[typeRows.length - 1];
  let takeaway = "Not enough answered questions yet to spot a pattern. A longer session will surface one.";
  if (weakest && strongest && weakest.type !== strongest.type) {
    takeaway = `Strongest on ${TYPE_LABELS[strongest.type] || strongest.type} (${Math.round(strongest.acc * 100)}%). Watch ${TYPE_LABELS[weakest.type] || weakest.type} questions, where you're at ${Math.round(weakest.acc * 100)}%.`;
  } else if (weakest) {
    takeaway = `Your accuracy on ${TYPE_LABELS[weakest.type] || weakest.type} questions was ${Math.round(weakest.acc * 100)}% this session.`;
  }
  if (mostDangerousTrap) {
    takeaway += ` You fell for the ${trapLabel(mostDangerousTrap)} trap most often, worth a closer look.`;
  }

  const headline = accuracyPct >= 80 ? "Sharp session." : accuracyPct >= 60 ? "Solid work." : "Room to sharpen up.";

  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - accuracyPct / 100);

  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero: accuracy ring + headline + actions */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative flex-none" style={{ width: 112, height: 112 }}>
          <svg width={112} height={112} className="-rotate-90">
            <circle cx={56} cy={56} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
            <circle
              cx={56} cy={56} r={r} fill="none" stroke="var(--teal)" strokeWidth={8}
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-[27px] font-semibold leading-none text-foreground">
              {accuracyPct}<span className="text-[14px]">%</span>
            </span>
            <span className="mt-1 text-[10px] dim">accuracy</span>
          </div>
        </div>

        <div className="flex-1">
          <h1 className="display text-[30px] leading-tight">
            {headline} <span className="italic" style={{ color: "var(--teal)" }}>{correct}/{answered.length} correct</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] muted">{takeaway}</p>
        </div>

        <div className="flex flex-none flex-col gap-2">
          <Link to="/setup" className="btn btn-primary fx-sheen">Start new session</Link>
          <div className="flex gap-2">
            <Link to="/dashboard" className="btn btn-glass fx-ring flex-1 justify-center">Dashboard</Link>
            <button onClick={() => setShowShare(true)} className="btn btn-glass fx-ring flex-1 justify-center">
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className={`mt-8 grid gap-4 ${isIntuition ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Time</div>
          <div className="mono mt-2 text-[22px] leading-none text-foreground">{formatTime(totalTime)}</div>
          <div className="mt-1 text-xs dim">~{formatTime(avgTime)} per question</div>
        </div>
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Trap rate</div>
          <div className="mono mt-2 text-[22px] leading-none" style={{ color: trapPicked > 0 ? "var(--amber)" : "var(--text)" }}>
            {trapPicked} / {answered.length}
          </div>
          <div className="mt-1 text-xs dim">traps taken</div>
        </div>
        {isIntuition && (
          <div className="glass glasscard p-[18px]">
            <div className="eyebrow">Points</div>
            <div className="mono mt-2 text-[22px] leading-none" style={{ color: "var(--teal)" }}>{totalPoints}</div>
            <div className="mt-1 text-xs dim">intuition score</div>
          </div>
        )}
      </div>

      {/* By-type breakdown + review grid */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="glass p-5">
          <h2 className="eyebrow mb-4">By question type</h2>
          <div className="flex flex-col gap-3">
            {typeRows.map((r) => (
              <div key={r.type}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[13px]" style={{ color: "var(--text)" }}>{TYPE_LABELS[r.type] || r.type}</span>
                  <span className="mono text-xs" style={{ color: accuracyColor(r.acc) }}>{Math.round(r.acc * 100)}%</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.acc * 100)}%`, background: accuracyColor(r.acc) }} />
                </div>
              </div>
            ))}
            {typeRows.length === 0 && <p className="text-sm dim">No answered questions yet.</p>}
          </div>
        </div>

        <div className="glass p-5">
          <h2 className="eyebrow mb-4">Review, tap to open</h2>
          <div className="grid grid-cols-5 gap-2">
            {attempts.map((a, i) => {
              const status = a.skipped === 1 ? "skipped" : a.is_correct === 1 ? "correct" : "incorrect";
              const style = status === "correct"
                ? { background: "var(--green)", color: "#06210F" }
                : status === "incorrect"
                ? { background: "rgba(248,113,113,0.16)", color: "var(--red)" }
                : { background: "rgba(255,255,255,0.05)", color: "var(--text-2)" };
              return (
                <button
                  key={i}
                  onClick={() => setOpenIdx(i)}
                  className="mono flex aspect-square items-center justify-center rounded-[11px] text-[15px] font-semibold transition-transform hover:scale-[1.06]"
                  style={style}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI-style session takeaway */}
      <div
        className="mt-5 flex items-start gap-3 rounded-[14px] px-[18px] py-[17px]"
        style={{ background: "linear-gradient(150deg, rgba(139,157,255,0.13), rgba(139,157,255,0.03))", border: "1px solid rgba(139,157,255,0.3)" }}
      >
        <span className="mt-0.5 flex-none" style={{ color: "var(--periwinkle)" }}>✦</span>
        <div>
          <div className="mono mb-1 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--periwinkle)" }}>
            Session takeaway
          </div>
          <p className="text-[13px] leading-[1.6] muted">{takeaway}</p>
        </div>
      </div>

      {/* Question by question */}
      <section className="mt-8">
        <h2 className="eyebrow">Question by question</h2>
        <div className="glass mt-3">
          {attempts.map((a, i) => (
            <button
              key={i}
              onClick={() => setOpenIdx(i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              style={i > 0 ? { borderTop: "1px solid var(--glass-border-lo)" } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm dim w-6 mono">{i + 1}</span>
                <TypeBadge type={a.type} />
                <TopicBadge topic={a.topic} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs mono dim">
                  {formatTime(a.time_taken_seconds)}
                </span>
                <ResultBadge attempt={a} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {openIdx != null && (
        <QuestionReviewModal
          attempts={attempts}
          index={openIdx}
          onNavigate={setOpenIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}

      {showShare && (
        <ShareResultsModal
          data={{
            accuracyPct, correct, total: answered.length, trapPicked, dateLabel: today, headline,
            displayName: user?.name || (user?.username ? `@${user.username}` : null),
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

function ResultBadge({ attempt }) {
  if (attempt.skipped === 1) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
        Skipped
      </span>
    );
  }
  return attempt.is_correct === 1 ? (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--green)", background: "rgba(74,222,128,0.12)" }}>
      Correct
    </span>
  ) : (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--red)", background: "rgba(248,113,113,0.12)" }}>
      Incorrect
    </span>
  );
}

// ── Question review modal: full detail (paragraph, options, your answer vs
// correct, reasoning, AI feedback) with prev/next navigation across the
// whole session so a mistake review flows without closing and reopening. ──
function QuestionReviewModal({ attempts, index, onNavigate, onClose }) {
  const a = attempts[index];
  const total = attempts.length;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && index < total - 1) onNavigate(index + 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, onNavigate, onClose]);

  const feedbackAttempt = {
    options: a.options,
    correctOptionIndex: a.correct_option_index,
    selectedOptionIndex: a.selected_option_index,
    trapOptionIndex: a.trap_option_index,
    isCorrect: Boolean(a.is_correct),
    skipped: Boolean(a.skipped),
    trapType: a.trap_type,
    reasoningScore: a.reasoning_score,
    reasoningFeedback: a.reasoning_feedback,
    correctExplanation: a.correct_explanation,
    trapExplanation: a.trap_explanation,
    keyTakeaway: a.key_takeaway,
    reasoningText: a.reasoning_text,
  };

  return (
    <Modal onClose={onClose} align="top" labelledBy="results-review-title">
      <div className="glass-floating w-full max-w-2xl p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] uppercase tracking-wide dim">Q{index + 1} of {total}</span>
            {a.topic && <TopicBadge topic={a.topic} />}
            {a.type && <span className="mono text-[11px] uppercase tracking-wide dim">{TYPE_LABELS[a.type] || a.type}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-[8px] px-2.5 py-1 text-sm transition-colors hover:bg-white/[0.06]"
            style={{ color: "var(--text-2)" }}
          >
            ✕
          </button>
        </div>

        {a.paragraph && (
          <p className="serif-read mb-4 text-[14px] leading-[1.75] muted">{a.paragraph}</p>
        )}
        {a.questionText && (
          <h2 id="results-review-title" className="display mb-4 text-[19px] leading-[1.4]">{a.questionText}</h2>
        )}

        {a.skipped === 1 ? (
          <p className="text-sm dim italic">This question was skipped.</p>
        ) : (
          <FeedbackSections attempt={feedbackAttempt} />
        )}

        <div className="mt-6 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--glass-border-lo)", paddingTop: 16 }}>
          <button
            onClick={() => onNavigate(index - 1)}
            disabled={index === 0}
            className="btn btn-glass fx-ring disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="mono text-[11px] dim">{index + 1} / {total}</span>
          <button
            onClick={() => onNavigate(index + 1)}
            disabled={index === total - 1}
            className="btn btn-glass fx-ring disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </Modal>
  );
}
