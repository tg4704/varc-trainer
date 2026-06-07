import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSession } from "../api.js";
import { saveActiveSession } from "../session.js";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";

const QUESTION_COUNTS = [5, 10, 15, 20, 25];
const PER_QUESTION_SECONDS = [30, 45, 60, 90, 120];
const PER_SESSION_MINUTES = [5, 10, 15, 20, 30];

const PRACTICE_MODES = [
  {
    value: "analysis",
    title: "Analysis mode",
    desc: "Choose an option and explain your reasoning. Receive AI feedback on how you thought.",
  },
  {
    value: "intuition",
    title: "Intuition mode",
    desc: "Fast pattern recognition — pick quickly, earn bonus points for speed and correct eliminations. No reasoning required.",
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
    desc: "A timer counts upward as you go. Unlimited time — see your total at the end.",
  },
  {
    value: "countdown",
    title: "Countdown",
    desc: "Set a time limit. When it hits 0:00, the session ends automatically.",
  },
];

export default function SessionSetup() {
  const navigate = useNavigate();

  const [practiceMode, setPracticeMode] = useState("analysis");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timerMode, setTimerMode] = useState("untimed");
  const [timerScope, setTimerScope] = useState("per_question");
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(60);
  const [perSessionMinutes, setPerSessionMinutes] = useState(10);
  // feedbackMode only matters for untimed analysis — timed always defers
  const [feedbackMode, setFeedbackMode] = useState("instant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleStart() {
    setBusy(true);
    setError(null);

    const config = { numQuestions, timerMode };
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">New practice session</h1>
      <p className="mt-1 text-muted-foreground">Configure your session, then start.</p>

      {/* Practice mode */}
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

      {/* Number of questions */}
      <Section title="How many questions?">
        <div className="flex flex-wrap gap-2">
          {QUESTION_COUNTS.map((n) => (
            <Pill key={n} active={numQuestions === n} onClick={() => setNumQuestions(n)}>
              {n}
            </Pill>
          ))}
        </div>
      </Section>

      {/* Timer mode */}
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
              ? "AI feedback appears immediately after each answer — good for deep learning."
              : "Your reasoning is saved; AI feedback for all questions is shown together at the end — better for uninterrupted practice."}
          </p>
        </Section>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      <Button onClick={handleStart} disabled={busy} className="mt-8 w-full" size="lg">
        {busy ? "Starting…" : `Start ${numQuestions}-question session`}
      </Button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:border-foreground/40"
      )}
    >
      {children}
    </button>
  );
}

function RadioCard({ active, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-foreground/40"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border",
            active ? "border-primary" : "border-input"
          )}
        >
          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 ml-6 text-sm text-muted-foreground">{desc}</p>
    </button>
  );
}
