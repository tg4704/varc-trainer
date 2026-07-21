import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { scrollIntoViewMotionSafe } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import PageMeta from "../components/PageMeta.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import LoggedInHome from "./LoggedInHome.jsx";

// ── Interactive demo card ────────────────────────────────────────────────────
// No backend calls, but genuinely interactive: the visitor clicks whichever
// option they'd defend (correct, trap, or plain wrong - all three lead
// through the same flow), watches their reasoning type itself out, clicks
// "Check my reasoning" once typing finishes, sees a verdict tailored to
// their pick, then explicitly retries for a blank slate.
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
        return { background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.5)" };
      }
      return { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" };
    }
    if (o.kind === "correct") return { background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.45)" };
    if (o.kind === "trap") return { background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" };
    return { background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border-lo)", opacity: 0.55 };
  }

  function letterStyle(o, idx) {
    if (phase !== "feedback") {
      if (phase === "typing" && idx === selectedIdx) return { background: "var(--teal)", color: "#07130E" };
      return { background: "rgba(255,255,255,0.06)", color: "var(--text-2)" };
    }
    if (o.kind === "correct") return { background: "var(--green)", color: "#06210F" };
    if (o.kind === "trap") return { background: "rgba(251,191,36,0.2)", color: "var(--amber)" };
    return { background: "rgba(255,255,255,0.06)", color: "var(--text-2)" };
  }

  return (
    <div className="glass-floating mx-auto w-full max-w-[520px] p-[26px]">
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <TypeBadge type="inference" />
          <span className="text-xs dim">Sample question</span>
        </div>
        <span className="mono text-[11px] dim">demo</span>
      </div>
      <p className="serif-read mb-[18px] text-[15px] leading-[1.8] muted">
        “The lone genius is a figure we return to not because it describes how ideas are made,
        but because it flatters a conception of the self as self-sufficient.”
      </p>
      <p className="mb-3.5 text-[14.5px] font-medium">Which can be inferred from the passage?</p>
      <div className="flex flex-col gap-2.5">
        {DEMO_OPTIONS.map((o, idx) => (
          <button
            key={o.letter}
            type="button"
            onClick={() => selectOption(idx)}
            disabled={phase !== "select"}
            className="flex w-full items-center gap-3 rounded-[12px] px-[15px] py-[13px] text-left transition-colors"
            style={{ ...optionStyle(o, idx), cursor: phase === "select" ? "pointer" : "default" }}
          >
            <span
              className="flex h-6 w-6 flex-none items-center justify-center rounded-[8px] text-[12.5px] font-bold"
              style={letterStyle(o, idx)}
            >
              {o.letter}
            </span>
            <span className="flex-1 text-[14px]" style={{ color: phase === "typing" && idx === selectedIdx ? "var(--text)" : "var(--text-2)" }}>
              {o.text}
            </span>
            {phase === "feedback" && o.kind === "correct" && (
              <span style={{ flex: "none", color: "var(--green)" }}><Icon name="check" size={16} stroke={2.2} /></span>
            )}
            {phase === "feedback" && o.kind === "trap" && (
              <span className="badge flex-none" style={{ color: "var(--amber)", background: "rgba(251,191,36,0.16)", fontSize: 10, letterSpacing: "0.08em" }}>
                TRAP
              </span>
            )}
            {phase === "feedback" && o.kind === "wrong" && idx === selectedIdx && (
              <span style={{ flex: "none", color: "var(--red)" }}><Icon name="x" size={16} stroke={2.2} /></span>
            )}
          </button>
        ))}
      </div>

      {phase === "select" && (
        <p className="mt-3.5 flex items-center gap-1.5 text-[12px] dim">
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--teal)" }} />
          Pick the option you'd defend. We'll walk your reasoning.
        </p>
      )}

      {(phase === "typing" || phase === "feedback") && selectedOption && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="mono text-[10px] uppercase tracking-wide dim">Your reasoning</span>
          </div>
          <div
            className="flex items-start gap-2.5 rounded-[12px] px-[14px] py-[13px]"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <span
              className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px] text-[11px] font-bold"
              style={{ background: "linear-gradient(140deg, var(--teal), var(--periwinkle))", color: "#07130E" }}
            >
              t
            </span>
            <p className="text-[13px] leading-[1.55] text-foreground">
              {phase === "feedback" ? selectedOption.reasoning : typed}
              {phase === "typing" && !typingDone && (
                <span className="animate-pulse" style={{ color: "var(--teal)" }}>▍</span>
              )}
            </p>
          </div>

          {phase === "typing" && (
            <button
              onClick={checkReasoning}
              disabled={!typingDone}
              className="mt-3.5 w-full rounded-[10px] py-3 text-[13.5px] font-semibold transition-colors"
              style={
                typingDone
                  ? { background: "var(--teal)", color: "#07130E", cursor: "pointer" }
                  : { background: "rgba(255,255,255,0.05)", color: "var(--text-2)", cursor: "default" }
              }
            >
              Check my reasoning →
            </button>
          )}

          {phase === "feedback" && (
            <>
              <div
                className="mt-3.5 flex items-start gap-2.5 rounded-[13px] px-4 py-[15px]"
                style={{ background: "linear-gradient(150deg, rgba(139,157,255,0.12), rgba(139,157,255,0.03))", border: "1px solid rgba(139,157,255,0.28)" }}
              >
                <Icon name="spark" size={16} style={{ color: "var(--periwinkle)", flex: "none", marginTop: 1 }} />
                <div>
                  <div className="mono mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--periwinkle)" }}>
                    AI feedback
                  </div>
                  <p className="text-[12.5px] leading-[1.55] muted">{selectedOption.feedback}</p>
                </div>
              </div>
              <button
                onClick={retry}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--text)" }}
              >
                <Icon name="retry" size={13} /> Try another answer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Reveal-on-scroll: adds `pr-in` to the wrapped section the first time it
// enters the viewport, which drives the staggered .pr-reveal transitions and
// the in-card score-fill / bar-grow animations (see index.css). Respects
// reduced-motion via the global media query that neutralises transitions.
function useInView(threshold = 0.1) {
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

// One "problem → answer" row. Text block always comes first in the DOM (so it
// reads sensibly stacked on mobile); on desktop, `answer="left"` swaps the
// order and right-aligns the quote so the layout alternates side to side.
function ProblemRow({ answer, cols, delay, problem, card, first }) {
  const swap = answer === "left";
  return (
    <div
      className={`prrow pr-reveal grid grid-cols-1 items-center gap-9 md:gap-[46px] ${cols} ${first ? "" : "border-t pt-[38px]"}`}
      style={{ transitionDelay: delay, borderColor: first ? "transparent" : "var(--border-subtle)", marginTop: first ? 50 : 38 }}
    >
      <div className={swap ? "md:order-2 md:text-right" : ""}>{problem}</div>
      <div className={swap ? "md:order-1" : ""}>{card}</div>
    </div>
  );
}

function RowLabel({ num, tag, right }) {
  return (
    <div className={`flex items-baseline gap-3 ${right ? "md:justify-end" : ""}`}>
      {!right && <span className="mono text-[13px] dim">{num}</span>}
      <span className="mono text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--amber)" }}>{tag}</span>
      {right && <span className="mono text-[13px] dim">{num}</span>}
    </div>
  );
}

function CardHead({ name, ctx }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] font-bold" style={{ color: "var(--teal)" }}>{name}</span>
      <span
        className="mono rounded-full px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "#9BE3C8", background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.3)" }}
      >
        {ctx}
      </span>
    </div>
  );
}

const CARD_STYLE = {
  background: "#0E1512",
  border: "1px solid rgba(93,202,165,0.22)",
  borderRadius: 16,
};

// The five diagnoses - each pairs an aspirant's real complaint (left/right,
// alternating) with the Graspr surface that addresses it.
function ProblemRows() {
  const [ref, inView] = useInView(0.1);
  return (
    <section id="why" ref={ref} className={`scroll-mt-24 ${inView ? "pr-in" : ""}`}>
      <div className="mx-auto max-w-[1180px] px-7 py-[80px]">
        <div className="pr-reveal text-center">
          <div className="hand text-[24px]">what every serious aspirant says</div>
          <h2 className="display mt-1.5 text-[38px] leading-[1.1] tracking-[-0.01em] sm:text-[50px]">
            The problems no mock test <span style={{ color: "var(--teal)" }}>can diagnose.</span>
          </h2>
        </div>

        {/* Row 1 - Trap recognition */}
        <ProblemRow
          answer="right" cols="md:grid-cols-[0.9fr_1.1fr]" delay=".06s" first
          problem={
            <>
              <RowLabel num="01" tag="The 50/50 trap" />
              <p className="display mt-3.5 text-[26px] italic leading-[1.35] sm:text-[29px]">“I always get it down to two options. Then I pick the wrong one.”</p>
              <p className="mt-3.5 max-w-[380px] text-[15px] leading-[1.65] muted">The final two look equally valid every time. Your gut is wrong - and nothing tells you why.</p>
            </>
          }
          card={
            <div className="prcard px-7 py-[26px]" style={CARD_STYLE}>
              <CardHead name="Trap Recognition" ctx="Drills" />
              <div className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>Every wrong option labelled with exactly why it's a trap.</div>
              <div className="mt-3.5 flex flex-col gap-[7px]">
                <MiniOpt letter="A" color="var(--amber)" bg="rgba(240,168,104,0.08)" bd="rgba(240,168,104,0.3)" text="Solitude actively prevents thought." tag="TOO EXTREME" />
                <MiniOpt letter="B" color="var(--teal)" bg="rgba(93,202,165,0.08)" bd="rgba(93,202,165,0.32)" text="The myth persists because it consoles." check />
                <MiniOpt letter="C" color="var(--periwinkle)" bg="rgba(139,157,255,0.07)" bd="rgba(139,157,255,0.28)" text="Genius requires institutions." tag="OFF-TEXT" />
              </div>
            </div>
          }
        />

        {/* Row 2 - AI reasoning eval */}
        <ProblemRow
          answer="left" cols="md:grid-cols-[1.1fr_0.9fr]" delay=".12s"
          problem={
            <>
              <RowLabel num="02" tag="Invisible reasoning errors" right />
              <p className="display mt-3.5 text-[26px] italic leading-[1.35] sm:text-[29px]">“I got it right, but I don't know why. A lucky guess today is a negative mark on exam day.”</p>
            </>
          }
          card={
            <div className="prcard px-7 py-[26px]" style={{ ...CARD_STYLE, background: "#141020", border: "1px solid rgba(139,157,255,0.22)" }}>
              <CardHead name="AI Reasoning Eval" ctx="Drills" />
              <div className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>A 1–5 score on the quality of your thinking - not just the option you clicked.</div>
              <div className="mt-4 flex items-center gap-[18px]">
                <div className="flex flex-none items-end gap-2">
                  <span className="display text-[48px] leading-[0.8]" style={{ color: "var(--periwinkle)" }}>3.2</span>
                  <span className="pb-1.5 text-[12px] muted">/5</span>
                </div>
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="pr-scorefill h-full rounded-[3px]" style={{ width: "64%", background: "linear-gradient(90deg,var(--teal),var(--periwinkle))" }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ScoreChip color="var(--teal)" bg="rgba(93,202,165,0.12)" text="✓ Cue" />
                    <ScoreChip color="var(--teal)" bg="rgba(93,202,165,0.12)" text="✓ Evidence" />
                    <ScoreChip color="var(--amber)" bg="rgba(240,168,104,0.14)" text="! Scope" />
                  </div>
                </div>
              </div>
            </div>
          }
        />

        {/* Row 3 - 1-on-1 AI coaching */}
        <ProblemRow
          answer="right" cols="md:grid-cols-[0.9fr_1.1fr]" delay=".18s"
          problem={
            <>
              <RowLabel num="03" tag="The review loop" />
              <p className="display mt-3.5 text-[26px] italic leading-[1.35] sm:text-[29px]">“I've reviewed the same mock three times. My score hasn't moved.”</p>
              <p className="mt-3.5 max-w-[380px] text-[15px] leading-[1.65] muted">Seeing the right answer never teaches you why you didn't pick it.</p>
            </>
          }
          card={
            <div className="prcard px-7 py-[26px]" style={CARD_STYLE}>
              <CardHead name="1-on-1 AI coaching" ctx="VARC Coach" />
              <div className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>Coach questions your logic until you earn the reveal.</div>
              <div className="mt-3.5 flex flex-col gap-2">
                <div className="flex max-w-[80%] items-start gap-2 self-start">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px] text-[10px]" style={{ background: "rgba(93,202,165,0.16)" }}>🧠</span>
                  <span className="text-[12.5px] leading-[1.4]" style={{ color: "var(--text-2)", background: "rgba(93,202,165,0.09)", border: "1px solid rgba(93,202,165,0.22)", borderRadius: "10px 10px 10px 3px", padding: "8px 12px" }}>
                    What in the passage rules out option A?
                  </span>
                </div>
                <div className="max-w-[75%] self-end">
                  <span className="inline-block text-[12.5px] leading-[1.4]" style={{ color: "var(--text-2)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px 10px 3px 10px", padding: "8px 12px" }}>
                    It overstates - the text only says “flatters”.
                  </span>
                </div>
                <div className="mono flex items-center gap-2 self-start text-[10.5px]" style={{ color: "var(--teal)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"><path d="M7 11V7a5 5 0 0 1 10 0" /><rect x="4" y="11" width="16" height="9" rx="2" /></svg>
                  reveal unlocked
                </div>
              </div>
            </div>
          }
        />

        {/* Row 4 - Weakness map */}
        <ProblemRow
          answer="left" cols="md:grid-cols-[1.1fr_0.9fr]" delay=".24s"
          problem={
            <>
              <RowLabel num="04" tag="No pattern diagnosis" right />
              <p className="display mt-3.5 text-[26px] italic leading-[1.35] sm:text-[29px]">“VARC feels random. Some days 88%ile, some days 56%ile.”</p>
            </>
          }
          card={
            <div className="prcard px-7 py-[26px]" style={CARD_STYLE}>
              <CardHead name="Weakness Map" ctx="Dashboard" />
              <div className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>Accuracy by question type + trap - so your blind spots stop hiding.</div>
              <div className="mt-[18px] flex h-[76px] items-end gap-3.5">
                <WeakBar h={60} label="Tone" />
                <WeakBar h={48} label="Title" />
                <WeakBar h={64} label="Detail" />
                <WeakBar h={26} label="Infer" gap />
                <WeakBar h={52} label="Applic" />
              </div>
            </div>
          }
        />

        {/* Row 5 - Reading map */}
        <ProblemRow
          answer="right" cols="md:grid-cols-[0.9fr_1.1fr]" delay=".30s"
          problem={
            <>
              <RowLabel num="05" tag="Dense passage panic" />
              <p className="display mt-3.5 text-[26px] italic leading-[1.35] sm:text-[29px]">“Halfway through the passage I've lost the thread - and the clock's running.”</p>
              <p className="mt-3.5 max-w-[380px] text-[15px] leading-[1.65] muted">By the time you reach the questions, the structure of the argument is already gone.</p>
            </>
          }
          card={
            <div className="prcard px-7 py-[26px]" style={CARD_STYLE}>
              <CardHead name="Reading Map" ctx="VARC Coach" />
              <div className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>The argument mapped out before you ever see a question.</div>
              <div className="mt-4 flex items-center gap-3">
                <div className="mono flex-none rounded-[9px] px-3 py-[9px] text-[11px] font-semibold" style={{ color: "#07130E", background: "var(--teal)" }}>Claim</div>
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"><path d="M1 7h22" /><path d="M18 2l5 5-5 5" /></svg>
                <div className="flex flex-col gap-2">
                  <MapNode color="var(--teal)" text="Support · evidence" />
                  <MapNode color="var(--amber)" text="Counter · concession" />
                </div>
              </div>
            </div>
          }
        />
      </div>
    </section>
  );
}

function MiniOpt({ letter, color, bg, bd, text, tag, check }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[9px] px-[11px] py-2" style={{ background: bg, border: `1px solid ${bd}` }}>
      <span className="mono text-[11px]" style={{ color }}>{letter}</span>
      <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{text}</span>
      {check ? (
        <span className="ml-auto" style={{ color: "var(--teal)" }}>✓</span>
      ) : (
        <span className="mono ml-auto text-[9px] font-bold" style={{ color }}>{tag}</span>
      )}
    </div>
  );
}

function ScoreChip({ color, bg, text }) {
  return <span className="mono rounded-[5px] px-[7px] py-[3px] text-[9.5px]" style={{ color, background: bg }}>{text}</span>;
}

function WeakBar({ h, label, gap }) {
  return (
    <div className="relative flex flex-1 flex-col items-center gap-[7px]">
      {gap && <span className="hand absolute -top-4 whitespace-nowrap text-[14px]" style={{ color: "var(--amber)" }}>your gap</span>}
      <div
        className="pr-bargrow w-full rounded-t-[5px]"
        style={{ "--h": `${h}px`, height: h, background: gap ? "var(--amber)" : "rgba(93,202,165,0.4)", boxShadow: gap ? "0 0 16px rgba(240,168,104,0.4)" : undefined }}
      />
      <span className="mono text-[9.5px]" style={{ color: gap ? "var(--amber)" : "var(--text-muted)", fontWeight: gap ? 600 : 400 }}>{label}</span>
    </div>
  );
}

function MapNode({ color, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-[1.4px] w-[9px] flex-none" style={{ background: `color-mix(in srgb, ${color} 50%, transparent)` }} />
      <span className="text-[12px]" style={{ color: "var(--text-2)", border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, borderRadius: 8, padding: "6px 11px", background: `color-mix(in srgb, ${color} 6%, transparent)` }}>{text}</span>
    </div>
  );
}

// Marketing landing page - stays as-is for logged-out visitors. Logged-in
// users get a different homepage entirely (LoggedInHome).
export default function Home() {
  const { user } = useAuth();

  useEffect(() => {
    if (window.location.hash === "#toolkit" || window.location.hash === "#try") {
      scrollIntoViewMotionSafe(document.getElementById(window.location.hash.slice(1)));
    }
  }, []);

  if (user) return <LoggedInHome />;

  const scrollToTry = () => scrollIntoViewMotionSafe(document.getElementById("try"));

  return (
    <div>
      <PageMeta
        title="Graspr - Stop Picking the Trap"
        description="AI feedback on every answer. Practice CAT VARC reading comprehension and train the reasoning skill that separates 95th from 99th percentile."
      />

      {/* ── Summit hero - full-bleed image pulled up behind the floating nav ── */}
      <section className="relative overflow-hidden" style={{ marginTop: -72, minHeight: 780 }}>
        <img
          src="/summit.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 42%", filter: "saturate(0.92) brightness(0.72)", animation: "kenBurns 32s ease-in-out infinite alternate" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,rgba(11,13,19,0.55) 0%,rgba(11,13,19,0.32) 34%,rgba(11,13,19,0.72) 78%,#0B0D13 100%)" }}
        />
        <div className="relative z-[2] mx-auto max-w-[1000px] px-7 pb-24 pt-[150px] text-center sm:pt-[168px]">
          <div className="hand text-[24px] sm:text-[27px]" style={{ animation: "fadeSlideUp .7s ease both" }}>
            for every CAT aspirant who's been there
          </div>
          <h1
            className="display mx-auto mt-4 max-w-none text-[38px] font-medium leading-[1.0] tracking-[-0.02em] sm:text-[62px] lg:text-[76px]"
            style={{ animation: "fadeSlideUp .8s ease both", animationDelay: ".08s" }}
          >
            <span className="block sm:whitespace-nowrap">You understood the passage.</span>
            <span className="block sm:whitespace-nowrap">So why did you</span>
            <span className="block sm:whitespace-nowrap">get the question <span className="italic" style={{ color: "#EC7B63" }}>wrong?</span></span>
          </h1>
          <p
            className="mx-auto mt-7 max-w-[640px] text-[18px] leading-[1.6] sm:text-[19px]"
            style={{ color: "#C6CCDA", animation: "fadeSlideUp .8s ease both", animationDelay: ".16s" }}
          >
            Most VARC prep scores your answer. Graspr's AI evaluates your <b className="text-foreground">reading map and reasoning</b> to close the gap between 95th and 99th percentile.
          </p>
          <div
            className="mt-9 flex flex-wrap items-start justify-center gap-3.5"
            style={{ animation: "fadeSlideUp .8s ease both", animationDelay: ".24s" }}
          >
            {/* Buttons kept as the app's existing components/routes. */}
            <Link to="/register" className="btn btn-primary btn-lg fx-sheen">Start free</Link>
            <div className="flex flex-col items-center gap-1.5">
              <button type="button" onClick={scrollToTry} className="btn btn-glass btn-lg fx-ring">Try it live ↓</button>
              <span className="hand text-[17px] sm:text-[18px]">no sign up needed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem → answer, alternating rows ── */}
      <div className="mx-auto max-w-[1300px]">
        <ProblemRows />
      </div>

      {/* ── Interactive demo ── */}
      <section id="try" className="mx-auto max-w-[1300px] scroll-mt-24 px-7 pb-5 pt-[70px] text-center">
        <div className="hand text-[22px] sm:text-[24px]">try it before you sign up →</div>
        <h2 className="display mt-2.5 text-[34px] font-medium italic sm:text-[46px]">No signup. Pick an option. See what happens.</h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[16px] sm:text-[17px] dim">
          Click any answer you'd choose in a real exam. We'll show you the <span className="font-semibold" style={{ color: "var(--teal)" }}>AI reasoning verdict</span>.
        </p>
        <div className="mx-auto mt-10 max-w-[560px] text-left">
          <DemoCard />
        </div>
      </section>

      {/* ── How it works - screenshot roadpath ── */}
      <JourneyPath />

      {/* ── Hills CTA band - reuses the summit image, cropped/gradiented differently ── */}
      <section className="relative mt-20 overflow-hidden" style={{ height: 440 }}>
        <img
          src="/hills.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 58%", filter: "saturate(0.98) brightness(0.68)" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(11,13,19,0.94) 0%,rgba(11,13,19,0.6) 55%,rgba(11,13,19,0.28) 100%)" }} />
        <div className="relative mx-auto flex h-full max-w-[1300px] flex-col justify-center px-8 sm:px-16">
          <div className="max-w-[720px]">
            <div className="hand text-[24px]" style={{ color: "#8FE3C6" }}>aim high</div>
            <h2 className="display mt-2 text-[38px] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[52px]">
              Climb toward the <span className="italic" style={{ color: "var(--teal)" }}>99th percentile</span>.
            </h2>
            <p className="mt-4 max-w-[440px] text-[16px] sm:text-[17px]" style={{ color: "#C6CCDA" }}>
              Every drill and debrief is one more step up the mountain. Start free.
            </p>
            <div className="mt-7">
              <Link to="/register" className="btn btn-primary btn-lg fx-sheen">Start free →</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── How it works: a 4-step visual roadpath through the real product ── */
const JOURNEY_STEPS = [
  {
    n: "01", phase: "① Reading Coach", tag: "Read",
    title: "Start with a real CAT-style passage",
    body: "Open the Coach and read a full-length passage - science, philosophy, humanities. No questions yet, just the text.",
    img: "/journey/j1-read-coach.png", alt: "Coach passage picker",
  },
  {
    n: "02", phase: "① Reading Coach", tag: "Map the argument",
    title: "Say what each paragraph is doing",
    body: "Before any question, map the argument in your own words - any language, grammar optional. This is the step every other prep tool skips.",
    img: "/journey/j2-map-writing.png", alt: "Writing a reading map of the passage",
  },
  {
    n: "03", phase: "① Reading Coach", tag: "Answer",
    title: "Answer, and explain why",
    body: "Pick an option and defend it. The AI grades your reasoning, confirms the answer, and names the trap you sidestepped.",
    img: "/journey/j3-answer-question.png", alt: "Answering a question with an AI reasoning verdict",
  },
  {
    n: "04", phase: "① Reading Coach", tag: "Stuck? Discuss",
    title: "Talk it out with an AI tutor",
    body: "Not convinced? A back-and-forth coach pushes on your reasoning until the idea actually clicks.",
    img: "/journey/j4-discuss-chat.png", alt: "1-on-1 AI coaching chat",
  },
  {
    n: "05", phase: "② Drills", tag: "Set up",
    title: "Want more speed? Switch to Drills",
    body: "Configure a focused set - question count, timer, mode - to drill the exact patterns you keep missing.",
    img: "/journey/j5-drills-setup.png", alt: "Drills session setup",
  },
  {
    n: "06", phase: "② Drills", tag: "Solve",
    title: "Solve short trap-spotting questions",
    body: "One tight paragraph, one question, four tempting options. Fast reps on the traps that cost you marks.",
    img: "/journey/j6-solve-question.png", alt: "A Drills question with four options",
  },
  {
    n: "07", phase: "② Drills", tag: "Reason",
    title: "Explain your reasoning",
    body: "Type why - in your words. Every attempt trains the muscle that separates the 95th from the 99th percentile.",
    img: "/journey/j7-ai-reasoning.png", alt: "Explaining your reasoning before submitting",
  },
  {
    n: "08", phase: "② Drills", tag: "AI verdict",
    title: "Get an instant AI verdict",
    body: "A reasoning score, why the right answer is right, and exactly how the trap was built to catch you.",
    img: "/journey/j8-response-analytics.png", alt: "AI feedback with reasoning score",
  },
  {
    n: "09", phase: "③ Track", tag: "Track",
    title: "Watch the gap close",
    body: "Accuracy, trap-pick rate and reasoning quality over weeks - so you fix the pattern, not one question.",
    img: "/journey/j9-dashboard.png", alt: "Dashboard with accuracy trend and heatmap",
  },
];

function JourneyPath() {
  return (
    <section id="how" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 pt-[100px] text-center">
      <div className="hand text-[22px] sm:text-[24px]">how it actually works →</div>
      <h2 className="display mt-2.5 text-[34px] font-medium sm:text-[46px]">
        From first read to the <span className="italic" style={{ color: "var(--teal)" }}>99th percentile</span>
      </h2>
      <p className="mx-auto mt-4 max-w-[580px] text-[16px] sm:text-[17px] dim">
        The real Coach &amp; Drills flow - the same screens you'll use every day.
      </p>

      <div className="mt-16 flex flex-col gap-20 sm:gap-24">
        {JOURNEY_STEPS.map((s, i) => {
          return (
            <div key={s.n}>
              <div className={`flex flex-col items-center gap-8 lg:gap-14 ${i % 2 ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
                {/* Screenshot */}
                <div className="w-full lg:w-[58%]">
                  <div
                    className="overflow-hidden rounded-2xl border"
                    style={{ borderColor: "var(--line, rgba(255,255,255,0.09))", boxShadow: "0 30px 60px -30px rgba(0,0,0,0.7)" }}
                  >
                    <img src={s.img} alt={s.alt} loading="lazy" className="block w-full" />
                  </div>
                </div>

                {/* Copy */}
                <div className="w-full text-center lg:w-[42%] lg:text-left">
                  <div className="flex items-center justify-center gap-3 lg:justify-start">
                    <span
                      className="mono grid h-11 w-11 place-items-center rounded-full text-[15px] font-semibold"
                      style={{ background: "rgba(93,202,165,0.12)", color: "var(--teal)", border: "1px solid rgba(93,202,165,0.35)" }}
                    >
                      {s.n}
                    </span>
                    <span className="hand text-[20px]" style={{ color: "var(--teal)" }}>{s.tag}</span>
                  </div>
                  <h3 className="display mt-5 text-[26px] font-medium leading-[1.15] sm:text-[30px]">{s.title}</h3>
                  <p className="mx-auto mt-3.5 max-w-[420px] text-[16px] leading-[1.6] lg:mx-0" style={{ color: "#C6CCDA" }}>
                    {s.body}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
