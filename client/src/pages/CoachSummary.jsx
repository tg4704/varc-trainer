// ② Coach — session summary / review screen. Rebuilt to match the Drills
// Results page: accuracy-ring hero, shareable card, and a click-to-open
// per-question review (reusing FeedbackSections) instead of always-expanded
// inline cards — plus the Socratic discuss transcript when one exists.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coach } from "../api.js";
import { useAuth } from "../auth.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import ShareResultsModal from "../components/ShareResultsModal.jsx";
import { cn } from "../lib/utils.js";

const LETTERS = ["A", "B", "C", "D"];

export default function CoachSummary() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openIdx, setOpenIdx] = useState(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const result = await coach.getSession(sessionId);
        setData(result);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-16 text-center muted">Loading summary…</div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>;
  if (!data) return null;

  const { coachSession, attempts } = data;
  const { passage, questions, readingGrade } = coachSession;
  const correct = attempts.filter((a) => a.is_correct).length;
  const totalAttempted = attempts.length;
  const accuracyPct = totalAttempted ? Math.round((correct / totalAttempted) * 100) : 0;
  const scored = attempts.filter((a) => a.reasoning_score != null);
  const avgReasoning = scored.length
    ? (scored.reduce((s, a) => s + a.reasoning_score, 0) / scored.length).toFixed(1)
    : null;

  const headline = accuracyPct >= 80 ? "Sharp reading." : accuracyPct >= 60 ? "Solid work." : "Room to sharpen up.";
  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - accuracyPct / 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative flex-none" style={{ width: 112, height: 112 }}>
          <svg width={112} height={112} className="-rotate-90">
            <circle cx={56} cy={56} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
            <circle
              cx={56} cy={56} r={r} fill="none" stroke="var(--periwinkle)" strokeWidth={8}
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
            {headline} <span className="italic" style={{ color: "var(--periwinkle)" }}>{correct}/{totalAttempted} correct</span>
          </h1>
          {passage.title && <p className="mt-1.5 text-[13.5px] muted">{passage.title}</p>}
        </div>

        <div className="flex flex-none flex-col gap-2">
          <button onClick={() => navigate("/coach")} className="btn btn-primary fx-sheen">
            Practice another passage
          </button>
          <div className="flex gap-2">
            <button onClick={() => navigate("/dashboard")} className="btn btn-glass fx-ring flex-1 justify-center">Dashboard</button>
            <button onClick={() => setShowShare(true)} className="btn btn-glass fx-ring flex-1 justify-center">Share</button>
          </div>
        </div>
      </div>

      {/* Reading grade recap */}
      {readingGrade && (
        <div className="accent-card accent-periwinkle mt-8">
          <div className="fb-label">Your reading: {readingGrade.reading_mode?.replace(/-/g, " ")}</div>
          <p className="fb-body">{readingGrade.verdict_line}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Score</div>
          <div className="mono mt-2 text-[22px] leading-none text-foreground">{correct} / {totalAttempted}</div>
          <div className="mt-1 text-xs dim">questions correct</div>
        </div>
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Avg reasoning</div>
          <div className="mono mt-2 text-[22px] leading-none" style={{ color: avgReasoning >= 4 ? "var(--green)" : "var(--text)" }}>
            {avgReasoning ? `${avgReasoning}/5` : "—"}
          </div>
          <div className="mt-1 text-xs dim">score across questions</div>
        </div>
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Words read</div>
          <div className="mono mt-2 text-[22px] leading-none text-foreground">{passage.wordCount?.toLocaleString() ?? "—"}</div>
          <div className="mt-1 text-xs dim">passage length</div>
        </div>
      </div>

      {/* Question by question */}
      <section className="mt-8">
        <h2 className="eyebrow">Question by question</h2>
        <div className="glass mt-3">
          {questions.map((q, i) => {
            const a = attempts.find((at) => at.question_index === i);
            return (
              <button
                key={q.id}
                onClick={() => a && setOpenIdx(i)}
                disabled={!a}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                  a ? "hover:bg-white/[0.04]" : "cursor-default opacity-60"
                )}
                style={i > 0 ? { borderTop: "1px solid var(--glass-border-lo)" } : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm dim w-6 mono flex-none">{i + 1}</span>
                  <TypeBadge type={q.type} />
                  <p className="truncate text-[13px] muted">{q.question}</p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {a?.reasoning_score != null && <span className="mono text-[11px] dim">{a.reasoning_score}/5</span>}
                  {a ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={a.is_correct ? { color: "var(--green)", background: "rgba(74,222,128,0.12)" } : { color: "var(--red)", background: "rgba(248,113,113,0.12)" }}
                    >
                      {a.is_correct ? "Correct" : "Incorrect"}
                    </span>
                  ) : (
                    <span className="text-xs dim">Not attempted</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {openIdx != null && (
        <CoachQuestionModal
          questions={questions}
          attempts={attempts}
          index={openIdx}
          onNavigate={setOpenIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}

      {showShare && (
        <ShareResultsModal
          data={{
            accuracyPct, correct, total: totalAttempted, dateLabel: today, headline,
            eyebrow: "COACH SESSION",
            secondStat: avgReasoning ? [`${avgReasoning}/5`, "AVG REASONING"] : ["N/A", "AVG REASONING"],
            displayName: user?.name || (user?.username ? `@${user.username}` : null),
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

// Per-question detail: options with your-answer/correct highlighting via
// FeedbackSections (same field shape as Drills attempts), plus the Socratic
// discuss transcript when the student used it.
function CoachQuestionModal({ questions, attempts, index, onNavigate, onClose }) {
  const q = questions[index];
  const a = attempts.find((at) => at.question_index === index);
  const total = questions.length;
  const attemptedIdxs = questions.map((_, i) => i).filter((i) => attempts.some((at) => at.question_index === i));

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!a) return null;

  const feedbackAttempt = {
    options: q.options,
    correctOptionIndex: q.correctIndex,
    selectedOptionIndex: a.selected_option_index,
    trapOptionIndex: q.trapIndex,
    isCorrect: Boolean(a.is_correct),
    skipped: false,
    trapType: a.trap_type,
    reasoningScore: a.reasoning_score,
    reasoningFeedback: a.reasoning_feedback,
    correctExplanation: a.correct_explanation,
    trapExplanation: a.trap_explanation,
    keyTakeaway: a.key_takeaway,
    reasoningText: a.reasoning_text,
  };

  const pos = attemptedIdxs.indexOf(index);
  const prevIdx = pos > 0 ? attemptedIdxs[pos - 1] : null;
  const nextIdx = pos >= 0 && pos < attemptedIdxs.length - 1 ? attemptedIdxs[pos + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10" onClick={onClose}>
      <div className="glass-floating w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] uppercase tracking-wide dim">Q{index + 1} of {total}</span>
            <TypeBadge type={q.type} />
          </div>
          <button type="button" onClick={onClose} className="flex-none rounded-[8px] px-2.5 py-1 text-sm transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-2)" }}>
            ✕
          </button>
        </div>

        <h2 className="display mb-4 text-[19px] leading-[1.4]">{q.question}</h2>

        <FeedbackSections attempt={feedbackAttempt} />

        {a.discussConversation?.length > 0 && (
          <div className="mt-5 glass-recessed overflow-hidden">
            <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
              <span className="eyebrow">Discussed with Coach</span>
            </div>
            <div className="flex flex-col gap-3 px-4 py-4">
              {a.discussConversation.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "student" ? "justify-end" : "justify-start")}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed"
                    style={
                      msg.role === "coach"
                        ? { background: "rgba(255,255,255,0.05)", color: "var(--text)", borderTopLeftRadius: 4 }
                        : { background: "var(--teal)", color: "#07130E", borderTopRightRadius: 4 }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--glass-border-lo)", paddingTop: 16 }}>
          <button onClick={() => prevIdx != null && onNavigate(prevIdx)} disabled={prevIdx == null} className="btn btn-glass fx-ring disabled:opacity-40">
            ← Previous
          </button>
          <span className="mono text-[11px] dim">{pos + 1} / {attemptedIdxs.length}</span>
          <button onClick={() => nextIdx != null && onNavigate(nextIdx)} disabled={nextIdx == null} className="btn btn-glass fx-ring disabled:opacity-40">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
