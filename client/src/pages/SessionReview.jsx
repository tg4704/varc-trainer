// Phase 13 - Session Review page.
// After a timed (or "after session") practice run, this page batch-evaluates
// all saved reasonings in parallel then displays the full 5-section feedback
// for every question in order.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FeedbackSections from "../components/FeedbackSections.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import DifficultyBadge from "../components/DifficultyBadge.jsx";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";
import { getSessionReview, batchEvaluateSession } from "../api.js";

const LETTERS = ["A", "B", "C", "D"];

export default function SessionReview() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const navigate = useNavigate();

  const [phase, setPhase] = useState("loading"); // loading | evaluating | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [session, setSession] = useState(null);
  // attempts enriched with question display data + AI feedback
  const [attempts, setAttempts] = useState([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!sessionId || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // Step 1: load all attempt + question data
        const { session: s, attempts: raw } = await getSessionReview(sessionId);
        setSession(s);
        setAttempts(raw);

        // Step 2: check if there are any reasonings waiting to be evaluated
        const hasPending = raw.some(
          (a) => !a.skipped && a.mode === "analysis" && a.reasoning_text && !a.reasoning_score
        );

        if (hasPending) {
          setPhase("evaluating");
          const { results } = await batchEvaluateSession(sessionId);

          // Merge AI results back into attempts by attemptId
          const byId = {};
          for (const r of results) byId[r.attemptId] = r;

          setAttempts((prev) =>
            prev.map((a) =>
              byId[a.id]
                ? {
                    ...a,
                    reasoning_score: byId[a.id].reasoningScore ?? null,
                    reasoning_feedback: byId[a.id].reasoningFeedback ?? null,
                    correct_explanation: byId[a.id].correctExplanation ?? null,
                    trap_explanation: byId[a.id].trapExplanation ?? null,
                    key_takeaway: byId[a.id].keyTakeaway ?? null,
                    aiError: byId[a.id].aiError,
                  }
                : a
            )
          );
        }

        setPhase("done");
      } catch (e) {
        setErrorMsg(e.message || "Something went wrong loading the review.");
        setPhase("error");
      }
    })();
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        No session ID found.
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-destructive">{errorMsg}</p>
        <Button className="mt-4" onClick={() => navigate("/setup")}>
          New session
        </Button>
      </div>
    );
  }

  const answered = attempts.filter((a) => !a.skipped && a.mode === "analysis");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Session Review</h1>
        {phase === "loading" && (
          <p className="mt-1 text-muted-foreground">Loading your session…</p>
        )}
        {phase === "evaluating" && (
          <div className="mt-3 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              Evaluating {answered.length} reasoning{answered.length !== 1 ? "s" : ""}, hang tight…
            </p>
          </div>
        )}
        {phase === "done" && (
          <p className="mt-1 text-muted-foreground">
            {answered.length} of {attempts.length} questions answered with reasoning.
          </p>
        )}
      </div>

      {/* Attempt cards */}
      {(phase === "done" || phase === "evaluating") && (
        <div className="space-y-12">
          {attempts.map((a, idx) => (
            <AttemptReviewCard key={a.id} attempt={a} index={idx + 1} total={attempts.length} />
          ))}
        </div>
      )}

      {/* Skeleton cards while loading */}
      {(phase === "loading" || phase === "evaluating") && attempts.length === 0 && (
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6 animate-pulse">
              <div className="h-4 w-24 rounded bg-muted mb-3" />
              <div className="h-3 w-full rounded bg-muted mb-2" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      {phase === "done" && (
        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Button
            className="fx-sheen flex-1"
            size="lg"
            onClick={() => navigate(`/results?sessionId=${sessionId}`)}
          >
            View Session Summary →
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/setup")}>
            New Session
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Per-question card ─────────────────────────────────────────────────────────
function AttemptReviewCard({ attempt: a, index, total }) {
  const [open, setOpen] = useState(true);

  // Map snake_case DB fields → camelCase for FeedbackSections
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

  const isSkipped = Boolean(a.skipped);
  const hasReasoning = Boolean(a.reasoning_text);
  const isEvaluated = Boolean(a.reasoning_score);

  return (
    <div className="glass overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-muted-foreground">
              Q{index} / {total}
            </span>
            {a.topic && <TopicBadge topic={a.topic} />}
            {a.type && <TypeBadge type={a.type} />}
            <DifficultyBadge difficulty={a.difficulty} />
            {isSkipped && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Skipped
              </span>
            )}
            {!isSkipped && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  a.is_correct
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {a.is_correct ? "Correct" : "Incorrect"}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground line-clamp-2">{a.questionText}</p>
        </div>
        <span className="flex-none text-muted-foreground text-lg leading-none mt-0.5">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-6" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
          {/* Paragraph */}
          {a.paragraph && (
            <p
              className="mt-4 font-reading text-foreground"
              style={{ fontSize: "15px", lineHeight: 1.8 }}
            >
              {a.paragraph}
            </p>
          )}

          {/* Options */}
          {a.options?.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {a.options.map((opt, i) => {
                const isSelected = i === a.selected_option_index;
                const isCorrect = i === a.correct_option_index;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                      isCorrect && isSelected && "bg-success/10 text-success",
                      isCorrect && !isSelected && "bg-success/5 text-success/80",
                      !isCorrect && isSelected && "bg-destructive/10 text-destructive",
                      !isCorrect && !isSelected && "text-muted-foreground"
                    )}
                  >
                    <span className="flex-none font-semibold">{LETTERS[i]}.</span>
                    <span>{opt.text}</span>
                    {isSelected && !isCorrect && (
                      <span className="ml-auto flex-none text-xs">← your answer</span>
                    )}
                    {isCorrect && (
                      <span className="ml-auto flex-none text-xs font-semibold">✓ correct</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reasoning submitted */}
          {hasReasoning && (
            <div className="mt-4 rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Your reasoning</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.reasoning_text}</p>
            </div>
          )}

          {/* AI feedback */}
          {isSkipped ? (
            <p className="mt-4 text-sm text-muted-foreground italic">Question was skipped. No feedback.</p>
          ) : !hasReasoning ? (
            <p className="mt-4 text-sm text-muted-foreground italic">No reasoning submitted. No AI feedback.</p>
          ) : a.aiError ? (
            <div className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
              AI feedback unavailable for this question.
            </div>
          ) : isEvaluated ? (
            <div className="mt-4">
              <FeedbackSections attempt={feedbackAttempt} />
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Evaluating…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
