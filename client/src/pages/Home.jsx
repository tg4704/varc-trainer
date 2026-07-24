import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { scrollIntoViewMotionSafe } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import PageMeta from "../components/PageMeta.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import LoggedInHome from "./LoggedInHome.jsx";

/* ─────────────────────────────────────────────────────────────────────────────
   Hallmark · genre: editorial · macrostructure: Long Document
   theme: Graspr dark (preserved) · enrichment: none
   H1 Marquee (size=xl, align=left-bias, underlay=rule-below) · S2 Hanging heads
   F3 Tabular spec sheet · F4 Step sequence (01/02/03, vertical, no connector)
   C3 Typographic link CTA
   nav/footer: shared TopNav + SiteFooter, deliberately untouched (app-wide).

   The page is an argument you read, not a feature list you scan. Three font
   families only (Newsreader / Instrument Sans / IBM Plex Mono). Every heading
   is roman; emphasis is accent ink over a drawn rule, never an italic word.
   ────────────────────────────────────────────────────────────────────────── */

// ── Interactive demo ────────────────────────────────────────────────────────
// Unchanged behaviour: the visitor clicks whichever option they'd defend
// (correct, trap, or plain wrong - all three lead through the same flow),
// watches their reasoning type itself out, checks it, then retries for a
// blank slate. Only the shell changed - paper block instead of frosted glass.
const DEMO_OPTIONS = [
  {
    letter: "A", text: "Solitude actively prevents original thought.", kind: "trap",
    reasoning: "I picked A because the passage frames genius as something solitary, so solitude must block original thought.",
    feedback: "This is the trap. The passage never claims solitude “prevents” anything, it explains why the myth persists, not what isolation does to thinking. Too strong a claim for what's actually said.",
  },
  {
    letter: "B", text: "The myth persists because it is consoling, not because it is true.", kind: "correct",
    reasoning: "I picked B because the author says we return to the myth because it “flatters” us, so we keep it around because it feels good, not because it is accurate.",
    feedback: "Solid reasoning. You correctly located the psychological motive (comfort) the passage names, rather than treating the myth as a claim about truth.",
  },
  {
    letter: "C", text: "Genius requires institutional support to flourish.", kind: "wrong",
    reasoning: "I picked C because institutions like universities produce most breakthroughs today.",
    feedback: "Off the text. The passage never discusses institutional support, this brings in an idea from outside the paragraph rather than something it actually argues.",
  },
];

function DemoCard() {
  const [phase, setPhase] = useState("select"); // select | typing | feedback
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [typed, setTyped] = useState("");

  const selectedOption = selectedIdx != null ? DEMO_OPTIONS[selectedIdx] : null;

  function selectOption(idx) {
    if (phase !== "select") return;
    setSelectedIdx(idx);
    setPhase("typing");
  }

  useEffect(() => {
    if (phase !== "typing" || !selectedOption) return;
    setTyped("");
    let i = 0;
    const full = selectedOption.reasoning;
    const iv = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 22);
    return () => clearInterval(iv);
  }, [phase, selectedOption]);

  const typingDone = selectedOption ? typed.length >= selectedOption.reasoning.length : false;

  function checkReasoning() {
    if (!typingDone) return;
    setPhase("feedback");
  }

  function retry() {
    setPhase("select");
    setSelectedIdx(null);
    setTyped("");
  }

  function optionStyle(o, idx) {
    if (phase !== "feedback") {
      if (phase === "typing" && idx === selectedIdx) {
        return { background: "var(--ld-tint-teal)", borderColor: "var(--teal-dim)" };
      }
      return { background: "transparent", borderColor: "var(--border-subtle)" };
    }
    if (o.kind === "correct") return { background: "var(--ld-tint-teal)", borderColor: "var(--teal-dim)" };
    if (o.kind === "trap") return { background: "var(--ld-tint-amber)", borderColor: "var(--amber)" };
    return { background: "transparent", borderColor: "var(--border-subtle)", opacity: 0.5 };
  }

  return (
    <div className="ld-demo">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="ld-ord">Inference · sample</span>
        <span className="ld-ord">Fig. 1</span>
      </div>

      <p className="ld-h3" style={{ marginBottom: 18, color: "var(--text)" }}>
        “The lone genius is a figure we return to not because it describes how ideas are made,
        but because it flatters a conception of the self as self-sufficient.”
      </p>

      <p className="mb-4 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
        Which of these can be inferred from the passage?
      </p>

      <div className="flex flex-col">
        {DEMO_OPTIONS.map((o, idx) => (
          <button
            key={o.letter}
            type="button"
            onClick={() => selectOption(idx)}
            disabled={phase !== "select"}
            className="flex w-full items-baseline gap-3 border px-4 py-3.5 text-left transition-colors"
            style={{
              ...optionStyle(o, idx),
              borderRadius: 10,
              marginTop: idx === 0 ? 0 : 8,
              cursor: phase === "select" ? "pointer" : "default",
            }}
          >
            <span className="ld-optletter">{o.letter}</span>
            <span
              className="flex-1 text-[0.9375rem] leading-snug"
              style={{ color: phase === "select" ? "var(--text-2)" : "var(--text)" }}
            >
              {o.text}
            </span>
            {phase === "feedback" && o.kind === "correct" && (
              <span className="flex-none self-center" style={{ color: "var(--teal)" }}>
                <Icon name="check" size={15} stroke={2.2} />
              </span>
            )}
            {phase === "feedback" && o.kind === "trap" && (
              <span className="ld-ord flex-none self-center" style={{ color: "var(--amber)" }}>trap</span>
            )}
            {phase === "feedback" && o.kind === "wrong" && idx === selectedIdx && (
              <span className="flex-none self-center" style={{ color: "var(--red)" }}>
                <Icon name="x" size={15} stroke={2.2} />
              </span>
            )}
          </button>
        ))}
      </div>

      {phase === "select" && (
        <p className="mt-4 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Pick the option you would defend in the exam. Your reasoning gets read back to you.
        </p>
      )}

      {(phase === "typing" || phase === "feedback") && selectedOption && (
        <div className="mt-6">
          <hr className="ld-rule" />
          <p className="ld-ord" style={{ marginTop: 16, marginBottom: 8 }}>Your reasoning</p>
          <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--text)" }}>
            {phase === "feedback" ? selectedOption.reasoning : typed}
            {phase === "typing" && !typingDone && (
              <span className="animate-pulse" style={{ color: "var(--teal)" }}>▍</span>
            )}
          </p>

          {phase === "typing" && (
            <button
              onClick={checkReasoning}
              disabled={!typingDone}
              className="btn btn-primary mt-5"
              style={typingDone ? undefined : { opacity: 0.45, cursor: "default" }}
            >
              Check my reasoning
            </button>
          )}

          {phase === "feedback" && (
            <>
              <div
                className="mt-5 border-l px-4 py-1"
                style={{ borderColor: "var(--periwinkle)", borderLeftWidth: 1 }}
              >
                <p className="ld-ord" style={{ color: "var(--periwinkle)", marginBottom: 6 }}>AI verdict</p>
                <p className="text-[0.875rem] leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {selectedOption.feedback}
                </p>
              </div>
              <button onClick={retry} className="ld-link mt-5 text-[0.9375rem]" type="button">
                <Icon name="retry" size={13} /> Try another answer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Single orchestrated entrance. Adds `ld-in` the first time the section enters
// the viewport; nothing else on this page animates on scroll.
function useInView(threshold = 0.08) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); io.unobserve(e.target); } }),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ── The five failures ───────────────────────────────────────────────────────
// Each pairs an aspirant's real complaint with the mechanism that addresses it.
// A hairline table, not five alternating cards: they are five parallel items
// and the page should say so.
const FAILURES = [
  {
    quote: "“I always get it down to two options. Then I pick the wrong one.”",
    answer: "Every wrong option is labelled with the specific reason it is wrong — too extreme, off-text, half-right. You stop guessing between the final two and start naming the difference.",
    surface: "Drills",
  },
  {
    quote: "“I got it right, but I don't know why.”",
    answer: "You write out your reasoning before the answer is revealed, and it comes back scored 1–5 on the quality of the thinking, not on the option you clicked. A lucky guess reads as a lucky guess.",
    surface: "Drills",
  },
  {
    quote: "“I've reviewed the same mock three times. My score hasn't moved.”",
    answer: "Seeing the right answer never teaches you why you didn't pick it. The coach questions your logic — where in the text, what rules the other option out — until the reasoning holds on its own.",
    surface: "Coach",
  },
  {
    quote: "“VARC feels random. Some days 88th percentile, some days 56th.”",
    answer: "Accuracy broken out by question type and by trap type, tracked across weeks. Randomness is usually one blind spot repeating; the dashboard is where it stops hiding.",
    surface: "Dashboard",
  },
  {
    quote: "“Halfway through the passage I've lost the thread, and the clock is running.”",
    answer: "Before any question appears, you map what each paragraph is doing — in your own words, any language. That map gets graded. Structure first, questions second.",
    surface: "Coach",
  },
];

function Failures() {
  const [ref, inView] = useInView();
  return (
    <section id="why" ref={ref} className={`scroll-mt-28 ${inView ? "ld-in" : ""}`}>
      <div className="ld-wrap" style={{ paddingBlock: "clamp(4rem, 9vw, 7rem)" }}>
        <div className="ld-enter ld-col">
          <h2 className="ld-h2">The five failures a mock test cannot diagnose.</h2>
          <p className="ld-body" style={{ marginTop: "1rem" }}>
            A score tells you how many you got wrong. It has nothing to say about the part that
            actually decides your percentile — the reasoning that produced the answer.
          </p>
        </div>

        <div className="ld-enter" style={{ marginTop: "clamp(2.5rem, 5vw, 3.5rem)", transitionDelay: "80ms" }}>
          {FAILURES.map((f) => (
            <div className="ld-row" key={f.surface + f.quote.slice(0, 24)}>
              <p className="ld-quote">{f.quote}</p>
              <div>
                <p className="ld-body" style={{ fontSize: "1rem" }}>{f.answer}</p>
                <p className="ld-surface" style={{ marginTop: "0.75rem" }}>{f.surface}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── The walkthrough ─────────────────────────────────────────────────────────
// Genuinely ordinal content, so the numbering earns its place. Real product
// screenshots, hairline frames, no re-drawn browser chrome.
const JOURNEY_STEPS = [
  {
    n: "01", phase: "Coach",
    title: "Start with a real CAT-style passage",
    body: "Open the Coach and read a full-length passage — science, philosophy, humanities. No questions yet, just the text.",
    img: "/journey/j1-read-coach.png", alt: "Coach passage picker",
  },
  {
    n: "02", phase: "Coach",
    title: "Say what each paragraph is doing",
    body: "Before any question, map the argument in your own words — any language, grammar optional. This is the step every other prep tool skips.",
    img: "/journey/j2-map-writing.png", alt: "Writing a reading map of the passage",
  },
  {
    n: "03", phase: "Coach",
    title: "Answer, and explain why",
    body: "Pick an option and defend it. The AI grades your reasoning, confirms the answer, and names the trap you sidestepped.",
    img: "/journey/j3-answer-question.png", alt: "Answering a question with an AI reasoning verdict",
  },
  {
    n: "04", phase: "Coach",
    title: "Talk it out with an AI tutor",
    body: "Not convinced? A back-and-forth coach pushes on your reasoning until the idea actually clicks.",
    img: "/journey/j4-discuss-chat.png", alt: "1-on-1 AI coaching chat",
  },
  {
    n: "05", phase: "Drills",
    title: "Want more speed? Switch to Drills",
    body: "Configure a focused set — question count, timer, mode — to drill the exact patterns you keep missing.",
    img: "/journey/j5-drills-setup.png", alt: "Drills session setup",
  },
  {
    n: "06", phase: "Drills",
    title: "Solve short trap-spotting questions",
    body: "One tight paragraph, one question, four tempting options. Fast reps on the traps that cost you marks.",
    img: "/journey/j6-solve-question.png", alt: "A Drills question with four options",
  },
  {
    n: "07", phase: "Drills",
    title: "Explain your reasoning",
    body: "Type why, in your words. Every attempt trains the muscle that separates the 95th percentile from the 99th.",
    img: "/journey/j7-ai-reasoning.png", alt: "Explaining your reasoning before submitting",
  },
  {
    n: "08", phase: "Drills",
    title: "Get an instant AI verdict",
    body: "A reasoning score, why the right answer is right, and exactly how the trap was built to catch you.",
    img: "/journey/j8-response-analytics.png", alt: "AI feedback with reasoning score",
  },
  {
    n: "09", phase: "Track",
    title: "Watch the gap close",
    body: "Accuracy, trap-pick rate and reasoning quality over weeks — so you fix the pattern, not one question.",
    img: "/journey/j9-dashboard.png", alt: "Dashboard with accuracy trend and heatmap",
  },
];

function Walkthrough() {
  return (
    <section id="how" className="scroll-mt-28">
      <div className="ld-wrap" style={{ paddingBlock: "clamp(3rem, 7vw, 5rem)" }}>
        <div className="ld-col">
          <h2 className="ld-h2">What the work actually looks like.</h2>
          <p className="ld-body" style={{ marginTop: "1rem" }}>
            Nine screens, in the order you meet them. These are the real product, not mockups.
          </p>
        </div>

        <div style={{ marginTop: "clamp(3rem, 6vw, 4.5rem)", display: "grid", gap: "clamp(3.5rem, 7vw, 5.5rem)" }}>
          {JOURNEY_STEPS.map((s, i) => (
            <div key={s.n} className={`ld-step ${i % 2 ? "ld-step--flip" : ""}`}>
              <figure className="ld-fig">
                <img src={s.img} alt={s.alt} loading={i === 0 ? "eager" : "lazy"} />
              </figure>
              <div className="ld-col">
                <p className="ld-ord">{s.n} · {s.phase}</p>
                <h3 className="ld-h3" style={{ marginTop: "0.6rem", color: "var(--text)" }}>{s.title}</h3>
                <p className="ld-body" style={{ marginTop: "0.75rem", fontSize: "1rem" }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Marketing landing page - logged-out visitors only. Logged-in users get a
// different homepage entirely (LoggedInHome).
export default function Home() {
  const { user } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "toolkit" || hash === "try" || hash === "how" || hash === "why") {
      scrollIntoViewMotionSafe(document.getElementById(hash === "toolkit" ? "try" : hash));
    }
  }, []);

  if (user) return <LoggedInHome />;

  const scrollToTry = () => scrollIntoViewMotionSafe(document.getElementById("try"));

  return (
    <div className="ld">
      <PageMeta
        title="Graspr - Stop Picking the Trap"
        description="AI feedback on every answer. Practice CAT VARC reading comprehension and train the reasoning skill that separates 95th from 99th percentile."
      />

      {/* ── Opening statement (H1 Marquee, left-bias, rule below) ── */}
      {/* Bottom padding runs ~1.4x the top so the opening sits into the page
          rather than floating above it. */}
      <header className="ld-wrap" style={{ paddingTop: "clamp(3.5rem, 7vw, 5.5rem)", paddingBottom: "clamp(4.75rem, 10vw, 7.5rem)" }}>
        <div style={{ maxWidth: "58rem" }}>
          <h1 className="ld-h1">
            You understood it.<br />
            You still got it <span className="ld-mark">wrong</span>.
          </h1>
          <p className="ld-lede" style={{ marginTop: "clamp(1.5rem, 3vw, 2rem)", maxWidth: "48ch" }}>
            Every VARC tool on the market scores the option you clicked. Graspr reads the
            reasoning behind it.
          </p>
          <div style={{ marginTop: "clamp(2rem, 4vw, 2.75rem)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.5rem" }}>
            <Link to="/register" className="btn btn-primary btn-lg">Start free</Link>
            <button type="button" onClick={scrollToTry} className="ld-link">
              Try it first, no account <span className="ld-arrow">→</span>
            </button>
          </div>
        </div>
      </header>

      <div className="ld-wrap"><hr className="ld-rule-hi" /></div>

      {/* ── The argument (running prose at measure) ── */}
      <section className="ld-wrap" style={{ paddingBlock: "clamp(3.5rem, 8vw, 6rem)" }}>
        <div className="ld-col">
          <p className="ld-body" style={{ fontSize: "1.125rem" }}>
            Somewhere around the 95th percentile, more practice stops working. You have done the
            mocks. You know the question types. You still lose four or five marks a paper to
            options that felt defensible at the time and look obviously wrong in the solution key.
          </p>
          <p className="ld-body">
            That gap is not a knowledge gap. It is a <strong>reasoning</strong> gap, and it is
            invisible to every tool that only records which letter you picked. Two students can
            arrive at the same correct answer — one by locating the claim in the text, the other by
            recognising a phrase that felt familiar. The score sheet cannot tell them apart. On exam
            day, the difference decides the paper.
          </p>
          <p className="ld-body">
            So Graspr asks for the reasoning first. You write why, in your own words, before the
            answer is revealed. An AI reads it and tells you whether the logic holds — where you
            went to the text and where you went to your gut, which trap the wrong option was built
            to catch, and what the correct answer actually rests on.
          </p>
          <p className="ld-body">
            It is slower than a mock. That is the point. <Link to="/register" className="ld-link">Start free <span className="ld-arrow">→</span></Link>
          </p>
        </div>
      </section>

      {/* ── The five failures (F3 hairline table) ── */}
      <Failures />

      {/* ── Fig. 1 — the live demo ── */}
      <section id="try" className="ld-wrap scroll-mt-28" style={{ paddingBlock: "clamp(3rem, 7vw, 5rem)" }}>
        <div className="ld-col">
          <h2 className="ld-h2">See it work before you sign up.</h2>
          <p className="ld-body" style={{ marginTop: "1rem" }}>
            One real question. Pick whichever option you would defend — the right one, the trap, or
            the plainly wrong one. All three go through the same flow.
          </p>
        </div>
        <div style={{ marginTop: "clamp(2rem, 4vw, 3rem)", maxWidth: "40rem" }}>
          <DemoCard />
          <p className="ld-figcap">
            Fig. 1 — a Drills question with the AI reasoning verdict. Live, no account required.
          </p>
        </div>
      </section>

      <div className="ld-wrap"><hr className="ld-rule" /></div>

      {/* ── The walkthrough (F4 step sequence) ── */}
      <Walkthrough />

      {/* ── Close — one statement, one action ── */}
      <section className="ld-wrap" style={{ paddingTop: "clamp(4rem, 9vw, 7rem)", paddingBottom: "clamp(3rem, 7vw, 5rem)" }}>
        <hr className="ld-rule-hi" />
        <div style={{ maxWidth: "34ch", paddingTop: "clamp(2.5rem, 5vw, 3.5rem)" }}>
          <p className="ld-h2">
            The percentile is downstream of the reasoning.
          </p>
          <div style={{ marginTop: "clamp(1.75rem, 3vw, 2.25rem)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.5rem" }}>
            <Link to="/register" className="btn btn-primary btn-lg">Start free</Link>
            <Link to="/pricing" className="ld-link">See plans <span className="ld-arrow">→</span></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
