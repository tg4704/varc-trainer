import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createSession } from "../api.js";
import { saveActiveSession } from "../session.js";
import { Button } from "../components/ui/button.jsx";

const TYPE_LABELS = {
  inference: "Inference", tone: "Tone", title: "Title", detail: "Detail",
  application: "Application", main_idea: "Main idea", function: "Function",
  concept_set: "Concept set", vocab_in_context: "Vocab", weaken_strengthen: "Weaken/Strengthen",
};

const PER_QUESTION_SECONDS = [30, 45, 60, 90, 120];
const PER_SESSION_MINUTES = [5, 10, 15, 20, 30];

const PRACTICE_MODES = [
  {
    value: "analysis",
    title: "Analysis",
    desc: "Choose an option and explain your reasoning. Receive AI feedback on how you thought.",
  },
  {
    value: "intuition",
    title: "Intuition",
    desc: "Fast pattern recognition. Pick quickly, earn bonus points for speed and correct eliminations.",
  },
];

const TIMER_MODES = [
  { value: "untimed", title: "Untimed", desc: "No timer. Take as long as you like." },
  { value: "count_up", title: "Count up", desc: "A timer counts upward as you go. See your total at the end." },
  { value: "countdown", title: "Countdown", desc: "Set a time limit. The session ends automatically at 0:00." },
];

export default function SessionSetup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link from Dashboard's "Drill →" CTAs (?type=<questionType>) — always
  // wins over the inference-only toggle below when present.
  const deepLinkType = searchParams.get("type");
  const deepLinkValid = deepLinkType && TYPE_LABELS[deepLinkType];

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

  async function handleStart() {
    setBusy(true);
    setError(null);

    const config = { numQuestions, timerMode };
    if (deepLinkValid) config.typeFilter = deepLinkType;
    else if (inferenceOnly) config.typeFilter = "inference";

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

  const showTimerOptions = timerMode !== "untimed";
  const showFeedbackTiming = !showTimerOptions && practiceMode === "analysis";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="display text-[34px]">Start a Drills session</h1>
      <p className="mt-2 muted">Set the shape of your practice. You can change this any time.</p>

      <div className="glass mt-8 p-6 md:p-7">
        <div className="grid sm:grid-cols-2 gap-5">
          <Section title="Practice mode" flush>
            <SquareToggle options={PRACTICE_MODES} value={practiceMode} onChange={setPracticeMode} />
            <p className="mt-2 text-xs muted">
              {PRACTICE_MODES.find((m) => m.value === practiceMode)?.desc}
            </p>
          </Section>

          {/* Focus — either a deep-link from Dashboard's "Drill →" CTAs (any weak
              type), or the inference-only toggle. Inference is ~50% of real CAT
              RC and the single highest-leverage skill, so it gets a dedicated
              mode rather than being diluted into the general shuffle. */}
          <Section title="Focus" flush>
            {deepLinkValid ? (
              <div
                className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
                style={{ background: "rgba(139,157,255,0.08)", border: "1px solid rgba(139,157,255,0.3)" }}
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Drilling: {TYPE_LABELS[deepLinkType]}
                  </div>
                  <div className="mt-0.5 text-xs muted">From your Dashboard.</div>
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
              <ToggleSwitch
                active={inferenceOnly}
                onClick={() => setInferenceOnly((v) => !v)}
                label="Inference-focused drills"
                desc="~50% of real CAT RC. Off for a mixed shuffle across all types."
              />
            )}
          </Section>
        </div>

        {/* Number of questions — value bubble rides the thumb */}
        <Section title="How many questions?">
          <div className="relative pt-8">
            {/* Value bubble positioned above the thumb. 16px ≈ native thumb width. */}
            <div
              className="pointer-events-none absolute top-0"
              style={{
                left: `calc(${((numQuestions - 1) / 24) * 100}% + ${8 - ((numQuestions - 1) / 24) * 16}px)`,
                transform: "translateX(-50%)",
              }}
            >
              <span
                className="mono inline-flex items-center justify-center rounded-[8px] px-2 py-0.5 text-sm font-bold tabular-nums"
                style={{ background: "var(--teal)", color: "#07130E" }}
              >
                {numQuestions}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={25}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-primary cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
            <span>1</span>
            <span>25</span>
          </div>
        </Section>

        {/* Timer mode */}
        <Section title="Timer">
          <SquareToggle options={TIMER_MODES} value={timerMode} onChange={setTimerMode} />
          <p className="mt-2 text-xs muted">
            {TIMER_MODES.find((m) => m.value === timerMode)?.desc}
          </p>
        </Section>

        {/* Conditional row: timer options (scope + countdown duration) when timed,
            or feedback timing when untimed analysis. Mutually exclusive. */}
        {(showTimerOptions || showFeedbackTiming) && (
          <Section title={showTimerOptions ? "Timer options" : "Feedback timing"}>
            <div className="grid sm:grid-cols-2 gap-4">
              {showTimerOptions ? (
                <>
                  <Dropdown
                    label="Applies to"
                    value={timerScope}
                    onChange={setTimerScope}
                    options={[
                      { value: "per_question", label: "Per question" },
                      { value: "per_session", label: "Whole session" },
                    ]}
                  />
                  {timerMode === "countdown" && (
                    <Dropdown
                      label={timerScope === "per_question" ? "Seconds per question" : "Total minutes"}
                      value={timerScope === "per_question" ? perQuestionSeconds : perSessionMinutes}
                      onChange={(v) =>
                        timerScope === "per_question"
                          ? setPerQuestionSeconds(Number(v))
                          : setPerSessionMinutes(Number(v))
                      }
                      options={(timerScope === "per_question" ? PER_QUESTION_SECONDS : PER_SESSION_MINUTES).map(
                        (n) => ({ value: n, label: timerScope === "per_question" ? `${n}s` : `${n} min` })
                      )}
                    />
                  )}
                </>
              ) : (
                <Dropdown
                  label="When to show AI feedback"
                  value={feedbackMode}
                  onChange={setFeedbackMode}
                  options={[
                    { value: "instant", label: "Instant, after each answer" },
                    { value: "deferred", label: "After the whole session" },
                  ]}
                />
              )}
            </div>
          </Section>
        )}

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <Button onClick={handleStart} disabled={busy} className="fx-sheen mt-8 w-full" size="lg">
          {busy
            ? "Starting…"
            : `Start ${numQuestions}-question${
                deepLinkValid ? ` ${TYPE_LABELS[deepLinkType].toLowerCase()}` : inferenceOnly ? " inference" : ""
              } session`}
        </Button>
      </div>
    </div>
  );
}

// `flush` removes the top margin — used for the two Sections that sit inside
// the top 2-column grid (the grid handles their placement). Standalone
// Sections below keep the mt-8 rhythm.
function Section({ title, children, flush = false }) {
  return (
    <section className={flush ? "" : "mt-8"}>
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SquareToggle({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="fx-ring rounded-[12px] px-3 py-3 text-center transition-colors"
          style={
            value === o.value
              ? { background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.5)" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }
          }
        >
          <span
            className="text-sm font-semibold"
            style={{ color: value === o.value ? "var(--teal)" : "var(--text)" }}
          >
            {o.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({ active, onClick, label, desc }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }}
    >
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {desc && <div className="mt-0.5 text-xs muted">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="fx-ring relative h-6 w-11 flex-none rounded-full transition-colors"
        style={{ background: active ? "var(--teal)" : "rgba(255,255,255,0.14)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: active ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

function Dropdown({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
