import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadActiveSession } from "../session.js";
import { scrollIntoViewMotionSafe } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import PageMeta from "../components/PageMeta.jsx";

// ── Interactive demo card ────────────────────────────────────────────────────
// No backend calls, but genuinely interactive: the visitor clicks whichever
// option they'd defend (correct, trap, or plain wrong — all three lead
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
    <div className="glass-floating mx-auto w-full max-w-[480px] p-[26px]">
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

// Flowchart-style "how it works" — bold circular step numbers connected by a
// fading gradient line, echoing a process diagram rather than a bare 3-column
// text list. Steps collapse to a vertical stack on mobile (no connector).
function FlowSection({ title, steps, accent }) {
  return (
    <section className="mx-auto max-w-[1000px] px-7 py-14">
      <h2 className="display text-[30px]">{title}</h2>
      <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-start md:gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-1 items-start">
            <div className="flex-1">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[17px] font-black"
                style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1.5px solid color-mix(in srgb, ${accent} 45%, transparent)`, color: accent }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-4 max-w-[260px] text-[15px] leading-[1.6] text-foreground">{s}</p>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-4 mt-6 hidden h-px flex-1 md:block"
                style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 50%, transparent), transparent)` }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureRow({ color, path, children }) {
  return (
    <div className="fx-featrow flex items-center gap-3">
      <span
        className="ficon flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]"
        style={{ "--rc": `${color}2e`, background: `${color}1a`, border: `1px solid ${color}40` }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {path}
        </svg>
      </span>
      <span className="ftxt text-[14px] muted">{children}</span>
    </div>
  );
}

function ProductCard({ num, label, name, italic, desc, bullets, to, cta, comingSoon = false }) {
  return (
    <div className={`glass glasscard flex flex-1 flex-col gap-5 p-7 ${comingSoon ? "opacity-60" : ""}`}>
      <div>
        {num && (
          <div className="mb-3 flex items-baseline gap-2.5">
            <span className="font-black leading-none tracking-tight" style={{ fontSize: 34, color: "var(--teal)", fontFamily: '"Instrument Sans", sans-serif' }}>
              {num}
            </span>
            {label && (
              <span className="mono text-[11px] font-semibold uppercase tracking-[0.14em] dim">{label}</span>
            )}
          </div>
        )}
        <h3 className="display text-[25px]">{name} <span className="italic" style={{ color: "var(--teal)" }}>{italic}</span></h3>
        <p className="mt-2 text-[14.5px] leading-relaxed muted">{desc}</p>
      </div>
      <div className="flex flex-col">
        {bullets.map((b, i) => (
          <div key={i} className="py-2.5 text-[13.5px] leading-snug muted first:pt-0" style={{ borderTop: i === 0 ? "none" : "1px solid var(--glass-border-lo)" }}>
            {b}
          </div>
        ))}
      </div>
      {comingSoon ? (
        <span className="mt-auto self-start text-[13.5px] muted">Coming soon</span>
      ) : (
        <Link to={to} className="btn btn-glass fx-ring mt-auto self-start">
          {cta} <Icon name="arrowR" size={15} />
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const hasActive = Boolean(loadActiveSession());

  // Lets the logged-out nav's "Toolkit" link work from any other page —
  // it navigates to "/#toolkit", and this scrolls to the anchor once the
  // page (and its content above the anchor) has actually mounted.
  useEffect(() => {
    if (window.location.hash === "#toolkit") {
      scrollIntoViewMotionSafe(document.getElementById("toolkit"));
    }
  }, []);

  return (
    <div>
      <PageMeta
        title="Graspr — Stop Picking the Trap"
        description="AI feedback on every answer. Practice CAT VARC reading comprehension and train the reasoning skill that separates 95th from 99th percentile."
      />
      {/* hero */}
      <section className="mx-auto grid max-w-[1100px] items-center gap-10 px-7 pb-10 pt-4 md:grid-cols-[0.82fr_1.18fr] md:gap-14 md:pt-[21px]">
        <div>
          <h1 className="display text-[44px] leading-[1.02] tracking-[-0.01em] sm:text-[56px]">
            Stop picking the<br />
            <span className="italic" style={{ color: "var(--teal)" }}>trap option.</span>
          </h1>
          <p className="mt-5 max-w-[480px] text-[18px] leading-[1.65] muted">
            Most CAT students know the passage. They still pick the wrong answer. This trains the
            reasoning skill that separates <span className="text-foreground">95 from 99 percentile.</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <Link to="/setup" className="btn btn-primary btn-lg fx-sheen">Start Drills</Link>
                {hasActive && (
                  <Link to="/practice" className="btn btn-glass btn-lg fx-ring">Continue session</Link>
                )}
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg fx-sheen">Start free</Link>
                <span className="mono text-[11px] uppercase tracking-wide" style={{ color: "var(--teal)", letterSpacing: "0.12em" }}>
                  Free to start
                </span>
              </>
            )}
          </div>
          <div className="mt-9 flex flex-col" style={{ gap: 13 }}>
            <FeatureRow color="var(--teal)" path={<path d="M12 3l1.7 4.4L18 9l-4.3 1.6L12 15l-1.7-4.4L6 9l4.3-1.6z" />}>
              AI feedback on every answer
            </FeatureRow>
            <FeatureRow color="var(--periwinkle)" path={<path d="M17 4l4 4-4 4M21 8H9M7 20l-4-4 4-4M3 16h12" />}>
              Full reasoning verdicts, not just right or wrong
            </FeatureRow>
            <FeatureRow color="var(--amber)" path={<path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />}>
              Track your accuracy trend over time
            </FeatureRow>
          </div>
        </div>
        <div className="md:border-l md:pl-12 md:py-11" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <DemoCard />
        </div>
      </section>

      {/* three-stage journey */}
      <section id="toolkit" className="mx-auto max-w-[1000px] px-7 py-14">
        <h2 className="display text-[30px] mb-2">Read widely. Comprehend deeply. Solve fast.</h2>
        <p className="max-w-xl text-[14.5px] leading-relaxed muted mb-8">
          Three tools, three different jobs, not the same drill in different lengths.
        </p>
        <div className="flex flex-col gap-6 md:flex-row">
          <ProductCard
            num="01" label="READ" name="Reading" italic="Lounge" comingSoon
            desc="Curated real articles across CAT genres. Build the habit and kill topic-unfamiliarity before it costs you marks."
            bullets={[
              "Real long-form writing, not AI-generated text.",
              "A difficulty ladder, building up to dense, CAT-grade prose.",
              "Vocab-in-context as you go.",
            ]}
          />
          <ProductCard
            num="02" label="COMPREHEND" name="" italic="Coach" cta="Open Coach" to="/coach"
            desc="Full CAT-style passages. Map the argument before you see any question, and the AI grades how you read, not just what you answer."
            bullets={[
              "Reading-map graded before questions are revealed.",
              "Full reasoning feedback on every answer.",
              "Stuck? Discuss it with the AI after the verdict.",
            ]}
          />
          <ProductCard
            num="03" label="SOLVE" name="" italic="Drills" cta="Start Drills" to="/setup"
            desc="Short paragraph, one question, fast reps. Builds the trap-recognition reflex, the close 50/50 that decides your percentile."
            bullets={[
              "Pick an answer, then defend your reasoning.",
              "AI scores the quality of your thinking, not just right/wrong.",
              "Inference-focused mode, CAT's single most-tested RC skill.",
            ]}
          />
        </div>
      </section>

      {/* how it works — flowchart-style, sits below the three product cards */}
      <FlowSection
        accent="var(--teal)"
        title="How Drills works"
        steps={[
          "Read a short paragraph and pick an answer.",
          "Write a line or two explaining your reasoning.",
          "Get feedback on exactly where your thinking went wrong, not just whether you were right.",
        ]}
      />
      <FlowSection
        accent="var(--periwinkle)"
        title="How Coach helps you"
        steps={[
          "Map the argument, paragraph by paragraph, before any question is revealed.",
          "Answer full CAT-style questions on the same passage.",
          "Get pushed by a Socratic debrief before the AI ever hands you the answer.",
        ]}
      />

      {/* closing CTA — only for logged-out visitors */}
      {!user && (
        <section className="mx-auto max-w-[1000px] px-7 pb-20 pt-10">
          <div className="pt-12 text-center" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
            <h2 className="display text-[30px] leading-tight">
              Read closely. <span className="italic" style={{ color: "var(--teal)" }}>Reason better.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] muted">
              A few questions a day is enough to change how you read under pressure.
            </p>
            <Link to="/register" className="btn btn-primary btn-lg fx-sheen mt-6 inline-flex">Start free</Link>
          </div>
        </section>
      )}

      {/* footer */}
      <footer style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
        <div className="mx-auto grid max-w-[1000px] gap-8 px-7 py-10 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <span className="display text-lg">graspr<span style={{ color: "var(--teal)" }}>.</span>in</span>
            <p className="mt-2.5 max-w-[240px] text-[13px] leading-relaxed dim">
              Train the reasoning, not the recall. Verbal practice with feedback on every answer.
            </p>
          </div>
          <FooterColumn
            title="Product"
            items={[
              { label: "RC Trainer", to: "/setup" },
              { label: "AI Coach", to: "/coach" },
              { label: "Reading Lounge" },
            ]}
          />
          <FooterColumn title="Company" items={[{ label: "About" }, { label: "Blog", to: "/blog" }, { label: "Contact" }]} />
          <FooterColumn title="Legal" items={[{ label: "Privacy", to: "/privacy" }, { label: "Terms", to: "/terms" }]} />
        </div>
        <div
          className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3 px-7 py-4"
          style={{ borderTop: "1px solid var(--glass-border-lo)" }}
        >
          <span className="mono text-[11px] dim">© {new Date().getFullYear()} graspr.in</span>
          <span className="text-xs dim">Made for serious readers</span>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="mono text-[10.5px] uppercase tracking-[0.12em] dim">{title}</div>
      {items.map((it) =>
        it.to ? (
          <Link key={it.label} to={it.to} className="fx-underline text-[13px] dim">
            {it.label}
          </Link>
        ) : (
          <span key={it.label} className="text-[13px] dim">
            {it.label}
          </span>
        )
      )}
    </div>
  );
}
