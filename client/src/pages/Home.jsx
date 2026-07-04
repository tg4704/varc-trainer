import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadActiveSession } from "../session.js";
import { streak as streakApi } from "../api.js";
import StreakWidget from "../components/StreakWidget.jsx";
import Icon from "../components/Icon.jsx";
import TypeBadge from "../components/TypeBadge.jsx";

function DemoCard() {
  const [hoverTrap, setHoverTrap] = useState(false);
  return (
    <div className="card mx-auto w-full max-w-[480px] p-[22px]">
      <div className="mb-4 flex items-center gap-2.5">
        <TypeBadge type="inference" />
        <span className="text-xs dim">Sample question</span>
      </div>
      <p className="serif-read mb-[18px] text-[15px] leading-[1.8] muted">
        “The lone genius is a figure we return to not because it describes how ideas are made,
        but because it flatters a conception of the self as self-sufficient.”
      </p>
      <p className="mb-3.5 text-[14.5px] font-medium">What can be inferred?</p>
      <div className="flex flex-col gap-2.5">
        <div className="opt opt-correct" style={{ minHeight: 0, padding: "13px 15px", cursor: "default" }}>
          <span className="opt-letter" style={{ color: "var(--green)" }}>B</span>
          <span className="opt-text" style={{ fontSize: 14 }}>The myth persists because it is consoling, not because it is true.</span>
          <span style={{ flex: "none", color: "var(--green)" }}><Icon name="check" size={16} stroke={2.2} /></span>
        </div>
        <div
          className="opt opt-trap"
          style={{ minHeight: 0, padding: "13px 15px", cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 0 }}
          onMouseEnter={() => setHoverTrap(true)}
          onMouseLeave={() => setHoverTrap(false)}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span className="opt-letter" style={{ color: "var(--trap)" }}>A</span>
            <span className="opt-text" style={{ fontSize: 14 }}>Solitude actively prevents original thought.</span>
            <span className="badge" style={{ flex: "none", color: "#0F1117", background: "var(--trap)", fontSize: 10, letterSpacing: "0.08em" }}>TRAP</span>
          </div>
          <div style={{ maxHeight: hoverTrap ? 70 : 0, overflow: "hidden", transition: "max-height 200ms ease" }}>
            <p style={{ fontSize: 12.5, color: "var(--amber)", paddingLeft: 38, paddingTop: 10, lineHeight: 1.5 }}>
              This is stronger than the passage — “not the source” isn’t “prevents.” True-sounding, but never claimed.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3.5 flex items-center gap-1.5 text-[11.5px] dim">
        <Icon name="spark" size={13} style={{ color: "var(--teal)" }} /> Hover the amber option to see why it traps you.
      </p>
    </div>
  );
}

function HowStep({ n, children }) {
  return (
    <div className="flex-1">
      <div className="mono text-[13px]" style={{ color: "var(--teal)" }}>0{n}</div>
      <p className="mt-3 text-[15.5px] leading-[1.6] text-foreground">{children}</p>
    </div>
  );
}

function ProductCard({ step, name, italic, desc, bullets, to, cta, comingSoon = false }) {
  return (
    <div className={`card flex flex-1 flex-col gap-5 p-7 ${comingSoon ? "opacity-60" : ""}`}>
      <div>
        {step && (
          <div className="mono text-[12px] mb-1.5" style={{ color: "var(--teal)" }}>{step}</div>
        )}
        <h3 className="display text-[25px]">{name} <span className="italic" style={{ color: "var(--teal)" }}>{italic}</span></h3>
        <p className="mt-2 text-[14.5px] leading-relaxed muted">{desc}</p>
      </div>
      <div className="flex flex-col">
        {bullets.map((b, i) => (
          <div key={i} className="border-t border-border py-2.5 text-[13.5px] leading-snug muted first:border-t-0 first:pt-0">
            {b}
          </div>
        ))}
      </div>
      {comingSoon ? (
        <span className="mt-auto self-start text-[13.5px] muted">Coming soon</span>
      ) : (
        <Link to={to} className="btn btn-ghost mt-auto self-start">
          {cta} <Icon name="arrowR" size={15} />
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const hasActive = Boolean(loadActiveSession());
  const [streakData, setStreakData] = useState(null);

  useEffect(() => {
    if (!user) return;
    streakApi.get().then(setStreakData).catch(() => {});
  }, [user]);

  return (
    <div>
      {/* hero */}
      <section className="mx-auto grid max-w-[1100px] items-center gap-10 px-7 pb-10 pt-16 md:grid-cols-[1.05fr_0.95fr] md:gap-14 md:pt-[76px]">
        <div>
          <h1 className="display text-[44px] leading-[1.06] tracking-[-0.02em] sm:text-[54px]">
            Stop picking the<br />
            <span className="italic" style={{ color: "var(--teal)" }}>trap option.</span>
          </h1>
          <p className="mt-5 max-w-[480px] text-[18px] leading-[1.65] muted">
            Most CAT students know the passage. They still pick the wrong answer. This trains the
            reasoning skill that separates <span className="text-foreground">95 from 99 percentile.</span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link to="/setup" className="btn btn-primary btn-lg">Start Drills</Link>
                {hasActive && (
                  <Link to="/practice" className="btn btn-teal-border btn-lg">Continue session</Link>
                )}
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">Start free</Link>
                <Link to="/login" className="btn btn-teal-border btn-lg">Log in</Link>
              </>
            )}
          </div>
        </div>
        <DemoCard />
      </section>

      {/* streak widget — logged-in users with data */}
      {user && streakData && (
        <section className="mx-auto max-w-[1000px] px-7 py-4">
          <StreakWidget data={streakData} onUpdate={setStreakData} />
        </section>
      )}

      {/* how it works */}
      <section className="mx-auto max-w-[1000px] px-7 py-14">
        <h2 className="display text-[30px]">How Drills works</h2>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:gap-12">
          <HowStep n={1}>Read a short paragraph and pick an answer.</HowStep>
          <HowStep n={2}>Write a line or two explaining your reasoning.</HowStep>
          <HowStep n={3}>Get feedback on exactly where your thinking went wrong — not just whether you were right.</HowStep>
        </div>
      </section>

      {/* three-stage journey */}
      <section className="mx-auto max-w-[1000px] px-7 py-4">
        <h2 className="display text-[30px] mb-2">Read widely. Comprehend deeply. Solve fast.</h2>
        <p className="max-w-xl text-[14.5px] leading-relaxed muted mb-8">
          Three tools, three different jobs — not the same drill in different lengths.
        </p>
        <div className="flex flex-col gap-6 md:flex-row">
          <ProductCard
            step="01 · READ" name="Reading" italic="Lounge" comingSoon
            desc="Curated real articles across CAT genres — build the habit and kill topic-unfamiliarity before it costs you marks."
            bullets={[
              "Real long-form writing, not AI-generated text.",
              "A difficulty ladder — build up to dense, CAT-grade prose.",
              "Vocab-in-context as you go.",
            ]}
          />
          <ProductCard
            step="02 · COMPREHEND" name="" italic="Coach" cta="Open Coach" to="/coach"
            desc="Full CAT-style passages. Map the argument before you see any question — the AI grades how you read, not just what you answer."
            bullets={[
              "Reading-map graded before questions are revealed.",
              "Full reasoning feedback on every answer.",
              "Stuck? Discuss it with the AI after the verdict.",
            ]}
          />
          <ProductCard
            step="03 · SOLVE" name="" italic="Drills" cta="Start Drills" to="/setup"
            desc="Short paragraph, one question, fast reps. Builds the trap-recognition reflex — the close 50/50 that decides your percentile."
            bullets={[
              "Pick an answer, then defend your reasoning.",
              "AI scores the quality of your thinking, not just right/wrong.",
              "Inference-focused mode — CAT's single most-tested RC skill.",
            ]}
          />
        </div>
      </section>

      {/* closing CTA — only for logged-out visitors */}
      {!user && (
        <section className="mx-auto max-w-[1000px] px-7 pb-20 pt-10">
          <div className="border-t border-border pt-12 text-center">
            <h2 className="display text-[30px] leading-tight">
              Read closely. <span className="italic" style={{ color: "var(--teal)" }}>Reason better.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] muted">
              A few questions a day is enough to change how you read under pressure.
            </p>
            <Link to="/register" className="btn btn-primary btn-lg mt-6 inline-flex">Start free</Link>
          </div>
        </section>
      )}

      {/* footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-4 px-7 py-8">
          <span className="display text-lg">graspr<span style={{ color: "var(--teal)" }}>.</span></span>
          <p className="text-[13px] dim">Train the reasoning, not the recall.</p>
        </div>
      </footer>
    </div>
  );
}
