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

function HowStep({ icon, n, children }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-[11px] border border-border bg-card" style={{ color: "var(--teal)" }}>
        <Icon name={icon} size={21} />
      </div>
      <div className="mono text-xs dim">STEP {n}</div>
      <p className="text-[15px] leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function ProductCard({ name, italic, desc, bullets, to, cta }) {
  return (
    <div className="card flex flex-1 flex-col gap-4 p-7">
      <div>
        <h3 className="display text-[25px]">{name} <span className="italic" style={{ color: "var(--teal)" }}>{italic}</span></h3>
        <p className="mt-2 text-[14.5px] leading-relaxed muted">{desc}</p>
      </div>
      <div className="flex flex-col gap-3">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5" style={{ color: "var(--teal)" }}><Icon name="check" size={15} stroke={2} /></span>
            <span className="text-sm leading-snug muted">{b}</span>
          </div>
        ))}
      </div>
      <Link to={to} className="btn btn-ghost mt-1 self-start">
        {cta} <Icon name="arrowR" size={15} />
      </Link>
    </div>
  );
}

const STATS = [
  { n: "25", l: "questions across 5 topic areas" },
  { n: "5", l: "CAT question types covered" },
  { n: "<8s", l: "AI feedback, every time" },
];

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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12.5px] muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal)" }} /> Built for CAT 2026
          </div>
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
                <Link to="/setup" className="btn btn-primary btn-lg">Start practice</Link>
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
        <h2 className="display mb-2 text-[30px]">How it works</h2>
        <p className="mb-10 text-[15px] muted">Three steps. The third is where the learning happens.</p>
        <div className="relative flex flex-col gap-10 md:flex-row">
          <div className="absolute left-[16%] right-[16%] top-[22px] hidden h-px md:block" style={{ background: "var(--border)" }} />
          <HowStep icon="book" n="01">Read a short paragraph and pick an answer.</HowStep>
          <HowStep icon="pencil" n="02">Write 2–3 lines explaining your reasoning.</HowStep>
          <HowStep icon="spark" n="03">Get AI feedback on exactly where your thinking went wrong.</HowStep>
        </div>
      </section>

      {/* two products */}
      <section className="mx-auto max-w-[1000px] px-7 py-4">
        <div className="flex flex-col gap-6 md:flex-row">
          <ProductCard
            name="VARC" italic="Trainer" cta="Start training" to="/setup"
            desc="Curated CAT-style questions with reasoning feedback."
            bullets={[
              "Pick an answer, then defend your reasoning.",
              "AI scores the quality of your thinking, not just right/wrong.",
              "Every question deconstructs its trap — even when you're correct.",
            ]}
          />
          <ProductCard
            name="VARC" italic="Coach" cta="Open the coach" to="/coach"
            desc="Bring any article. The tutor questions you back."
            bullets={[
              "Paste an article; AI generates CAT-style questions.",
              "A Socratic back-and-forth guides you to the answer.",
              "It never just hands you the answer — you earn it.",
            ]}
          />
        </div>
      </section>

      {/* trust stats */}
      <section className="mx-auto max-w-[1000px] px-7 pb-16 pt-10">
        <div className="card flex px-2.5 py-7">
          {STATS.map((s, i) => (
            <div key={i} className={`flex-1 text-center ${i ? "border-l" : ""}`} style={i ? { borderColor: "var(--border-subtle)" } : undefined}>
              <div className="display text-[40px]" style={{ color: "var(--teal)" }}>{s.n}</div>
              <div className="mt-1.5 text-[13.5px] muted">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-4 px-7 py-8">
          <div>
            <span className="display text-lg">graspr<span style={{ color: "var(--teal)" }}>.</span></span>
            <p className="mt-2 text-[13px] dim">Train the reasoning, not the recall.</p>
          </div>
          <div className="flex gap-6 text-[13.5px] muted">
            <a href="#">About</a><a href="#">Pricing</a><a href="#">Contact</a>
          </div>
          <div className="text-[12.5px] dim">Made for CAT 2026.</div>
        </div>
      </footer>
    </div>
  );
}
