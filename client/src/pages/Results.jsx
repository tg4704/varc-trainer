import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSession } from "../api.js";
import TypeBadge from "../components/TypeBadge.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import { trapLabel } from "../trapTypes.js";

const TYPE_LABELS = {
  inference: "Inference", tone: "Tone", title: "Title", detail: "Detail",
  application: "Application", main_idea: "Main idea", function: "Function",
  concept_set: "Concept set", vocab_in_context: "Vocab", weaken_strengthen: "Weaken/Strengthen",
};

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function accuracyColor(acc) {
  if (acc < 0.5) return "var(--red)";
  if (acc <= 0.7) return "var(--amber)";
  return "var(--green)";
}

export default function Results() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shared, setShared] = useState(false);
  const rowRefs = useRef({});

  useEffect(() => {
    if (!sessionId) {
      setError("No session specified");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setData(await getSession(sessionId));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center muted">Loading results…</div>;
  }
  if (error) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>;
  }

  const { session, attempts } = data;
  const answered = attempts.filter((a) => a.skipped === 0);
  const correct = answered.filter((a) => a.is_correct === 1).length;
  const trapPicked = answered.filter((a) => a.selected_trap === 1).length;
  const totalTime = attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0);
  const accuracyPct = answered.length ? Math.round((correct / answered.length) * 100) : 0;
  const avgTime = attempts.length ? totalTime / attempts.length : 0;

  // By-question-type breakdown
  const byType = {};
  for (const a of answered) {
    const t = byType[a.question_type] || { attempts: 0, correct: 0 };
    t.attempts++;
    if (a.is_correct === 1) t.correct++;
    byType[a.question_type] = t;
  }
  const typeRows = Object.entries(byType)
    .map(([type, s]) => ({ type, acc: s.attempts ? s.correct / s.attempts : 0, ...s }))
    .sort((a, b) => a.acc - b.acc);

  // Most-fallen-for trap type
  const byTrap = {};
  for (const a of answered) {
    if (!a.trap_type) continue;
    const t = byTrap[a.trap_type] || { encountered: 0, fellFor: 0 };
    t.encountered++;
    if (a.selected_trap === 1) t.fellFor++;
    byTrap[a.trap_type] = t;
  }
  let mostDangerousTrap = null, highestRate = 0;
  for (const [type, s] of Object.entries(byTrap)) {
    const rate = s.encountered ? s.fellFor / s.encountered : 0;
    if (s.fellFor > 0 && rate > highestRate) { highestRate = rate; mostDangerousTrap = type; }
  }

  // AI-style takeaway, templated client-side from stats already on hand
  const weakest = typeRows[0];
  const strongest = typeRows[typeRows.length - 1];
  let takeaway = "Not enough answered questions yet to spot a pattern. A longer session will surface one.";
  if (weakest && strongest && weakest.type !== strongest.type) {
    takeaway = `Strongest on ${TYPE_LABELS[strongest.type] || strongest.type} (${Math.round(strongest.acc * 100)}%). Watch ${TYPE_LABELS[weakest.type] || weakest.type} questions, where you're at ${Math.round(weakest.acc * 100)}%.`;
  } else if (weakest) {
    takeaway = `Your accuracy on ${TYPE_LABELS[weakest.type] || weakest.type} questions was ${Math.round(weakest.acc * 100)}% this session.`;
  }
  if (mostDangerousTrap) {
    takeaway += ` You fell for the ${trapLabel(mostDangerousTrap)} trap most often, worth a closer look.`;
  }

  const headline = accuracyPct >= 80 ? "Sharp session." : accuracyPct >= 60 ? "Solid work." : "Room to sharpen up.";

  function revisit(i) {
    const el = rowRefs.current[i];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "background 0.15s ease";
    el.style.background = "rgba(93,202,165,0.12)";
    setTimeout(() => { el.style.background = ""; }, 1200);
  }

  function handleShare() {
    const text = `I just scored ${accuracyPct}% on a Graspr Drills session (${correct}/${answered.length} correct).`;
    navigator.clipboard?.writeText(text).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    });
  }

  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - accuracyPct / 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero: accuracy ring + headline + actions */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative flex-none" style={{ width: 112, height: 112 }}>
          <svg width={112} height={112} className="-rotate-90">
            <circle cx={56} cy={56} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
            <circle
              cx={56} cy={56} r={r} fill="none" stroke="var(--teal)" strokeWidth={8}
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-[27px] font-semibold leading-none text-foreground">
              {accuracyPct}<span className="text-[14px]">%</span>
            </span>
            <span className="mt-1 text-[10px] dim">accuracy</span>
          </div>
        </div>

        <div className="flex-1">
          <h1 className="display text-[30px] leading-tight">
            {headline} <span className="italic" style={{ color: "var(--teal)" }}>{correct}/{answered.length} correct</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] muted">{takeaway}</p>
        </div>

        <div className="flex flex-none flex-col gap-2">
          <Link to="/setup" className="btn btn-primary fx-sheen">Start new session</Link>
          <div className="flex gap-2">
            <Link to="/dashboard" className="btn btn-glass fx-ring flex-1 justify-center">Dashboard</Link>
            <button onClick={handleShare} className="btn btn-glass fx-ring flex-1 justify-center">
              {shared ? "Copied ✓" : "Share"}
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Time</div>
          <div className="mono mt-2 text-[22px] leading-none text-foreground">{formatTime(totalTime)}</div>
          <div className="mt-1 text-xs dim">~{formatTime(avgTime)} per question</div>
        </div>
        <div className="glass glasscard p-[18px]">
          <div className="eyebrow">Trap rate</div>
          <div className="mono mt-2 text-[22px] leading-none" style={{ color: trapPicked > 0 ? "var(--amber)" : "var(--text)" }}>
            {trapPicked} / {answered.length}
          </div>
          <div className="mt-1 text-xs dim">traps taken</div>
        </div>
      </div>

      {/* By-type breakdown + review grid */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="glass p-5">
          <h2 className="eyebrow mb-4">By question type</h2>
          <div className="flex flex-col gap-3">
            {typeRows.map((r) => (
              <div key={r.type}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[13px]" style={{ color: "var(--text)" }}>{TYPE_LABELS[r.type] || r.type}</span>
                  <span className="mono text-xs" style={{ color: accuracyColor(r.acc) }}>{Math.round(r.acc * 100)}%</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.acc * 100)}%`, background: accuracyColor(r.acc) }} />
                </div>
              </div>
            ))}
            {typeRows.length === 0 && <p className="text-sm dim">No answered questions yet.</p>}
          </div>
        </div>

        <div className="glass p-5">
          <h2 className="eyebrow mb-4">Review · tap to revisit</h2>
          <div className="grid grid-cols-5 gap-2">
            {attempts.map((a, i) => {
              const status = a.skipped === 1 ? "skipped" : a.is_correct === 1 ? "correct" : "incorrect";
              const style = status === "correct"
                ? { background: "var(--green)", color: "#06210F" }
                : status === "incorrect"
                ? { background: "rgba(248,113,113,0.16)", color: "var(--red)" }
                : { background: "rgba(255,255,255,0.05)", color: "var(--text-2)" };
              return (
                <button
                  key={i}
                  onClick={() => revisit(i)}
                  className="mono flex aspect-square items-center justify-center rounded-[11px] text-[15px] font-semibold transition-transform hover:scale-[1.06]"
                  style={style}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI-style session takeaway */}
      <div
        className="mt-5 flex items-start gap-3 rounded-[14px] px-[18px] py-[17px]"
        style={{ background: "linear-gradient(150deg, rgba(139,157,255,0.13), rgba(139,157,255,0.03))", border: "1px solid rgba(139,157,255,0.3)" }}
      >
        <span className="mt-0.5 flex-none" style={{ color: "var(--periwinkle)" }}>✦</span>
        <div>
          <div className="mono mb-1 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--periwinkle)" }}>
            Session takeaway
          </div>
          <p className="text-[13px] leading-[1.6] muted">{takeaway}</p>
        </div>
      </div>

      {/* Question by question */}
      <section className="mt-8">
        <h2 className="eyebrow">Question by question</h2>
        <div className="glass mt-3">
          {attempts.map((a, i) => (
            <div
              key={i}
              ref={(el) => { rowRefs.current[i] = el; }}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={i > 0 ? { borderTop: "1px solid var(--glass-border-lo)" } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm dim w-6 mono">{i + 1}</span>
                <TypeBadge type={a.question_type} />
                <TopicBadge topic={a.topic} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs mono dim">
                  {formatTime(a.time_taken_seconds)}
                </span>
                <ResultBadge attempt={a} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ResultBadge({ attempt }) {
  if (attempt.skipped === 1) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
        Skipped
      </span>
    );
  }
  return attempt.is_correct === 1 ? (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--green)", background: "rgba(74,222,128,0.12)" }}>
      Correct
    </span>
  ) : (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--red)", background: "rgba(248,113,113,0.12)" }}>
      Incorrect
    </span>
  );
}
