import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createSession } from "../api.js";
import { saveActiveSession } from "../session.js";
import { track } from "../analytics.js";
import { Button } from "../components/ui/button.jsx";
import Modal from "../components/Modal.jsx";

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
  const [numQuestions, setNumQuestions] = useState(10);
  const [timerMode, setTimerMode] = useState("untimed");
  const [timerScope, setTimerScope] = useState("per_question");
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(60);
  const [perSessionMinutes, setPerSessionMinutes] = useState(10);
  // feedbackMode only matters for untimed analysis — timed always defers
  const [feedbackMode, setFeedbackMode] = useState("instant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // "Begin" on the confirmation screen: go fullscreen (distraction-free) from
  // this user gesture, then create the session and enter practice.
  async function beginSession() {
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    await handleStart();
  }

  async function handleStart() {
    setBusy(true);
    setError(null);

    const config = { numQuestions, timerMode };
    if (deepLinkValid) config.typeFilter = deepLinkType;

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
      track("session_start", { practiceMode, timerMode, numQuestions });
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
        <Section title="Practice mode" flush>
          <SquareToggle options={PRACTICE_MODES} value={practiceMode} onChange={setPracticeMode} />
        </Section>

        {/* Deep-link from Dashboard's "Drill →" CTAs (?type=<weak type>) still
            silently filters the session; it just no longer has a Focus control
            here — the on-page focus toggle was removed by request. A slim
            inline note lets the user clear it if they arrived via that link. */}
        {deepLinkValid && (
          <div
            className="mt-5 flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
            style={{ background: "rgba(139,157,255,0.08)", border: "1px solid rgba(139,157,255,0.3)" }}
          >
            <div className="text-sm font-semibold text-foreground">
              Drilling {TYPE_LABELS[deepLinkType]} questions
              <span className="ml-2 text-xs muted font-normal">from your Dashboard</span>
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
        )}

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

        <Button
          onClick={() => { setError(null); setShowConfirm(true); }}
          disabled={busy}
          className="fx-sheen mt-8 w-full"
          size="lg"
        >
          {`Start ${numQuestions}-question${
            deepLinkValid ? ` ${TYPE_LABELS[deepLinkType].toLowerCase()}` : ""
          } session →`}
        </Button>
      </div>

      {showConfirm && (
        <ConfirmStartModal
          rows={buildSummary({
            practiceMode, numQuestions, deepLinkValid, deepLinkType,
            timerMode, timerScope, perQuestionSeconds, perSessionMinutes, feedbackMode,
          })}
          busy={busy}
          error={error}
          onBack={() => setShowConfirm(false)}
          onBegin={beginSession}
        />
      )}
    </div>
  );
}

// Human-readable summary of everything the user configured, for the
// pre-start confirmation screen.
function buildSummary(s) {
  const rows = [
    ["Mode", PRACTICE_MODES.find((m) => m.value === s.practiceMode)?.title],
    ["Questions", String(s.numQuestions)],
    // Focus row only appears for a Dashboard deep-link; there's no on-page focus control.
    ...(s.deepLinkValid ? [["Focus", TYPE_LABELS[s.deepLinkType]]] : []),
    ["Timer", TIMER_MODES.find((m) => m.value === s.timerMode)?.title],
  ];
  if (s.timerMode !== "untimed") {
    rows.push(["Applies to", s.timerScope === "per_question" ? "Per question" : "Whole session"]);
    if (s.timerMode === "countdown") {
      rows.push([
        "Duration",
        s.timerScope === "per_question" ? `${s.perQuestionSeconds}s per question` : `${s.perSessionMinutes} min total`,
      ]);
    }
  } else if (s.practiceMode === "analysis") {
    rows.push(["Feedback", s.feedbackMode === "instant" ? "Instant, after each answer" : "After the whole session"]);
  }
  return rows;
}

function ConfirmStartModal({ rows, busy, error, onBack, onBegin }) {
  return (
    <Modal onClose={busy ? undefined : onBack} labelledBy="confirm-start-title">
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-start-title" className="display text-[22px]">Ready to begin?</h2>
        <p className="mt-1 text-xs dim">
          Starting opens a distraction-free fullscreen. Press Esc any time to exit.
        </p>

        <div className="mt-5">
          {rows.map(([label, value], i) => (
            <div
              key={label}
              className="flex items-center justify-between py-2.5"
              style={i > 0 ? { borderTop: "1px solid var(--glass-border-lo)" } : undefined}
            >
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-2)" }}>{label}</span>
              <span className="text-sm font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex gap-2.5">
          <Button onClick={onBegin} disabled={busy} className="fx-sheen flex-1" size="lg">
            {busy ? "Starting…" : "Begin session"}
          </Button>
          <Button variant="outline" onClick={onBack} disabled={busy} size="lg">
            Back
          </Button>
        </div>
      </div>
    </Modal>
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

// The selected option's description shows as a single line below the group —
// visible on touch (a hover tooltip never appears on phones) but still compact
// (only the active option's copy, not a paragraph per option).
function SquareToggle({ options, value, onChange }) {
  const selectedDesc = options.find((o) => o.value === value)?.desc;
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="fx-ring flex w-full min-h-[68px] items-center justify-center rounded-[12px] px-3 py-3 text-center transition-colors"
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
      {selectedDesc && <p className="mt-2.5 text-[12.5px] leading-snug dim">{selectedDesc}</p>}
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
