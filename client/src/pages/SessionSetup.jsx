import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createSession, sr } from "../api.js";
import { saveActiveSession } from "../session.js";
import { Button } from "../components/ui/button.jsx";

// Cache due-count across mounts so the SR option doesn't flicker "checking…"
// every time the user visits the setup page.
let _cachedDueCount = null;

const TYPE_LABELS = {
  inference: "Inference", tone: "Tone", title: "Title", detail: "Detail",
  application: "Application", main_idea: "Main idea", function: "Function",
  concept_set: "Concept set", vocab_in_context: "Vocab", weaken_strengthen: "Weaken/Strengthen",
};

const PER_QUESTION_SECONDS = [30, 45, 60, 90, 120];
const PER_SESSION_MINUTES = [5, 10, 15, 20, 30];

const SESSION_TYPES = [
  {
    value: "practice",
    title: "Practice",
    desc: "Randomised questions from the full question bank. Builds new knowledge.",
  },
  {
    value: "review",
    title: "Spaced repetition review",
    desc: "Questions you previously got wrong, scheduled by the SM-2 algorithm. Reinforces weak spots.",
  },
];

const PRACTICE_MODES = [
  {
    value: "analysis",
    title: "Analysis mode",
    desc: "Choose an option and explain your reasoning. Receive AI feedback on how you thought.",
  },
  {
    value: "intuition",
    title: "Intuition mode",
    desc: "Fast pattern recognition. Pick quickly, earn bonus points for speed and correct eliminations. No reasoning required.",
  },
];

const TIMER_MODES = [
  {
    value: "untimed",
    title: "Untimed",
    desc: "No timer. Take as long as you like; the session ends when you finish all questions.",
  },
  {
    value: "count_up",
    title: "Count up",
    desc: "A timer counts upward as you go. Unlimited time, see your total at the end.",
  },
  {
    value: "countdown",
    title: "Countdown",
    desc: "Set a time limit. When it hits 0:00, the session ends automatically.",
  },
];

export default function SessionSetup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link from Dashboard's "Drill →" CTAs (?type=<questionType>) — always
  // wins over the inference-only toggle below when present.
  const deepLinkType = searchParams.get("type");
  const deepLinkValid = deepLinkType && TYPE_LABELS[deepLinkType];

  const [sessionType, setSessionType] = useState("practice");
  const [dueCount, setDueCount] = useState(_cachedDueCount); // seed from cache to avoid flicker
  const [practiceMode, setPracticeMode] = useState("analysis");
  const [inferenceOnly, setInferenceOnly] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [timerMode, setTimerMode] = useState("untimed");
  const [timerScope, setTimerScope] = useState("per_question");
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(60);
  const [perSessionMinutes, setPerSessionMinutes] = useState(10);
  // feedbackMode only matters for untimed analysis — timed always defers
  const [feedbackMode, setFeedbackMode] = useState("instant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Fetch SR due-card count on mount; refresh in background without resetting
  // to null (which causes the "checking…" flicker on every visit).
  useEffect(() => {
    sr.getQueue()
      .then(({ dueCount: n }) => { _cachedDueCount = n; setDueCount(n); })
      .catch(() => { if (_cachedDueCount === null) setDueCount(0); });
  }, []);

  // When switching session types, auto-set question count to a sensible default
  function handleSessionTypeChange(type) {
    setSessionType(type);
    if (type === "review" && dueCount != null && dueCount > 0) {
      setNumQuestions(Math.min(dueCount, 25));
    } else if (type === "practice") {
      setNumQuestions(10);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);

    if (sessionType === "review" && (dueCount === 0 || dueCount == null)) {
      setError("No cards are due for review right now. Come back later or start a practice session.");
      setBusy(false);
      return;
    }

    const config = { numQuestions, timerMode, sessionType };
    if (sessionType === "practice") {
      if (deepLinkValid) config.typeFilter = deepLinkType;
      else if (inferenceOnly) config.typeFilter = "inference";
    }
    if (timerMode !== "untimed") {
      config.timerScope = timerScope;
      if (timerMode === "countdown") {
        config.timerSeconds =
          timerScope === "per_question" ? perQuestionSeconds : perSessionMinutes * 60;
      }
      // Server always forces deferred for timed sessions; send it anyway for clarity
      config.feedbackMode = "deferred";
    } else if (practiceMode === "analysis") {
      config.feedbackMode = feedbackMode;
    }

    try {
      const { session } = await createSession(config);
      saveActiveSession({ ...session, startedAt: Date.now(), practiceMode });
      navigate("/practice", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const reviewReady = sessionType === "review";
  const effectiveMax = reviewReady && dueCount != null ? Math.min(dueCount, 25) : 25;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="display text-[34px]">Start a Drills session</h1>
      <p className="mt-2 muted">Set the shape of your practice. You can change this any time.</p>

      <div className="glass mt-8 p-6 md:p-7">
      {/* Session type */}
      <Section title="Session type">
        <div className="space-y-2">
          {SESSION_TYPES.map((t) => {
            const isReview = t.value === "review";
            const reviewLabel =
              isReview && dueCount != null
                ? dueCount === 0
                  ? " · No cards due"
                  : ` · ${dueCount} card${dueCount === 1 ? "" : "s"} due`
                : isReview
                ? " · checking…"
                : "";
            return (
              <RadioCard
                key={t.value}
                active={sessionType === t.value}
                title={t.title + reviewLabel}
                desc={
                  isReview && dueCount === 0
                    ? "Get questions wrong in practice to build your SR queue. Cards become due over time."
                    : t.desc
                }
                onClick={() => handleSessionTypeChange(t.value)}
                disabled={isReview && dueCount === 0}
              />
            );
          })}
        </div>
      </Section>

      {/* Practice mode — only relevant for practice sessions */}
      {!reviewReady && (
        <Section title="Practice mode">
          <div className="space-y-2">
            {PRACTICE_MODES.map((m) => (
              <RadioCard
                key={m.value}
                active={practiceMode === m.value}
                title={m.title}
                desc={m.desc}
                onClick={() => setPracticeMode(m.value)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Focus — either a deep-link from Dashboard's "Drill →" CTAs (any weak
          type), or the inference-only toggle. Inference is ~50% of real CAT
          RC and the single highest-leverage skill, so it gets a dedicated
          mode rather than being diluted into the general shuffle. */}
      {!reviewReady && (
        <Section title="Focus">
          {deepLinkValid ? (
            <div
              className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
              style={{ background: "rgba(139,157,255,0.08)", border: "1px solid rgba(139,157,255,0.3)" }}
            >
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Drilling: {TYPE_LABELS[deepLinkType]}
                </div>
                <div className="mt-0.5 text-xs muted">From your Dashboard's weak-area callout.</div>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className="fx-underline flex-none text-xs font-semibold"
                style={{ color: "var(--periwinkle)" }}
              >
                Clear
              </button>
            </div>
          ) : (
            <RadioCard
              active={inferenceOnly}
              title="Inference-focused drills"
              desc="Every question in this session is an inference question, CAT's single most-tested RC skill (~50% of all RC questions). Turn off for a mixed shuffle across all types."
              onClick={() => setInferenceOnly((v) => !v)}
            />
          )}
        </Section>
      )}

      {/* Number of questions */}
      <Section title="How many questions?">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={effectiveMax || 25}
            value={Math.min(numQuestions, effectiveMax || 25)}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
            className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
          />
          <span className="w-10 text-center text-lg font-bold text-foreground tabular-nums">
            {Math.min(numQuestions, effectiveMax || 25)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
          <span>1</span>
          {(effectiveMax || 25) > 1 && <span>{effectiveMax || 25}</span>}
        </div>
        {reviewReady && dueCount != null && dueCount > 25 && (
          <p className="mt-2 text-xs text-muted-foreground">
            You have {dueCount} cards due. Capped at 25; do multiple sessions to clear the queue.
          </p>
        )}
      </Section>

      {/* Timer mode — hidden for review sessions (always untimed) */}
      {!reviewReady && (
        <>
          <Section title="Timer">
            <div className="space-y-2">
              {TIMER_MODES.map((m) => (
                <RadioCard
                  key={m.value}
                  active={timerMode === m.value}
                  title={m.title}
                  desc={m.desc}
                  onClick={() => setTimerMode(m.value)}
                />
              ))}
            </div>
          </Section>

          {/* Timer scope — only for timed modes */}
          {timerMode !== "untimed" && (
            <Section title="Timer applies to">
              <div className="flex flex-wrap gap-2">
                <Pill
                  active={timerScope === "per_question"}
                  onClick={() => setTimerScope("per_question")}
                >
                  Per question
                </Pill>
                <Pill
                  active={timerScope === "per_session"}
                  onClick={() => setTimerScope("per_session")}
                >
                  Whole session
                </Pill>
              </div>
              {timerMode === "countdown" && timerScope === "per_question" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  When a question's time runs out, it's recorded as skipped and the next one loads.
                </p>
              )}
              {timerMode === "countdown" && timerScope === "per_session" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  When the overall time runs out, the session ends wherever you are.
                </p>
              )}
            </Section>
          )}

          {/* Countdown duration */}
          {timerMode === "countdown" && (
            <Section
              title={timerScope === "per_question" ? "Seconds per question" : "Total minutes"}
            >
              <div className="flex flex-wrap gap-2">
                {timerScope === "per_question"
                  ? PER_QUESTION_SECONDS.map((s) => (
                      <Pill
                        key={s}
                        active={perQuestionSeconds === s}
                        onClick={() => setPerQuestionSeconds(s)}
                      >
                        {s}s
                      </Pill>
                    ))
                  : PER_SESSION_MINUTES.map((m) => (
                      <Pill
                        key={m}
                        active={perSessionMinutes === m}
                        onClick={() => setPerSessionMinutes(m)}
                      >
                        {m} min
                      </Pill>
                    ))}
              </div>
            </Section>
          )}

          {/* Feedback timing — only relevant for untimed analysis mode.
              Timed sessions always defer automatically. */}
          {practiceMode === "analysis" && timerMode === "untimed" && (
            <Section title="Feedback timing">
              <div className="flex flex-wrap gap-2">
                <Pill active={feedbackMode === "instant"} onClick={() => setFeedbackMode("instant")}>
                  Instant
                </Pill>
                <Pill active={feedbackMode === "deferred"} onClick={() => setFeedbackMode("deferred")}>
                  After session
                </Pill>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {feedbackMode === "instant"
                  ? "AI feedback appears immediately after each answer, good for deep learning."
                  : "Your reasoning is saved; AI feedback for all questions is shown together at the end, better for uninterrupted practice."}
              </p>
            </Section>
          )}
        </>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleStart}
        disabled={busy || (reviewReady && dueCount === 0)}
        className="fx-sheen mt-8 w-full"
        size="lg"
      >
        {busy
          ? "Starting…"
          : reviewReady
          ? `Start review · ${Math.min(dueCount ?? 0, 25)} questions`
          : `Start ${numQuestions}-question${
              deepLinkValid ? ` ${TYPE_LABELS[deepLinkType].toLowerCase()}` : inferenceOnly ? " inference" : ""
            } session`}
      </Button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fx-ring rounded-[10px] px-4 py-2 text-sm font-medium transition-colors"
      style={
        active
          ? { background: "var(--teal)", color: "#07130E", border: "1px solid var(--teal)" }
          : { background: "rgba(255,255,255,0.03)", color: "var(--text)", border: "1px solid var(--border)" }
      }
    >
      {children}
    </button>
  );
}

function RadioCard({ active, title, desc, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full rounded-[12px] p-4 text-left transition-colors"
      style={
        disabled
          ? { background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border-lo)", opacity: 0.4, cursor: "not-allowed" }
          : active
          ? { background: "rgba(93,202,165,0.07)", border: "1px solid rgba(93,202,165,0.45)" }
          : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full"
          style={active ? { border: "2px solid var(--teal)" } : { border: "2px solid var(--text-muted)" }}
        >
          {active && <span className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} />}
        </span>
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 ml-[26px] text-sm muted">{desc}</p>
    </button>
  );
}
