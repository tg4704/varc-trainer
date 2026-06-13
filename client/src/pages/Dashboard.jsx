import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, coach as coachApi, sr as srApi, streak as streakApi } from "../api.js";
import StreakWidget from "../components/StreakWidget.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import FeedbackSections, { ScoreDots } from "../components/FeedbackSections.jsx";
import Icon from "../components/Icon.jsx";
import { trapLabel, trapDescription } from "../trapTypes.js";

const TYPE_LABELS = {
  inference: "Inference",
  tone: "Tone",
  title: "Title",
  detail: "Detail",
  application: "Application",
};

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

// red < 50%, amber 50–70%, green > 70% (design palette)
function accuracyColor(acc) {
  if (acc < 0.5) return "var(--red)";
  if (acc <= 0.7) return "var(--amber)";
  return "var(--green)";
}

// `fetcher` defaults to the regular user dashboard fetch. Admin pages can pass
// `() => admin.getUserDashboard(userId)` to render someone else's dashboard
// read-only ("impersonation" without taking their session). `headerSlot` lets
// callers prepend a banner (e.g., "Viewing as <username>").
export default function Dashboard({ fetcher = getDashboard, headerSlot = null }) {
  const [tab, setTab] = useState("practice"); // "practice" | "coach"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coachStats, setCoachStats] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [srStats, setSrStats] = useState(null);
  const [streakData, setStreakData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await fetcher());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetcher]);

  useEffect(() => {
    if (tab !== "coach" || coachStats) return;
    setCoachLoading(true);
    coachApi.stats().then(setCoachStats).catch(() => {}).finally(() => setCoachLoading(false));
  }, [tab, coachStats]);

  // Fetch SR stats once on mount (shown in practice tab)
  useEffect(() => {
    srApi.getStats().then(setSrStats).catch(() => {});
  }, []);

  // Fetch streak once on mount (shown in practice tab)
  useEffect(() => {
    streakApi.get().then(setStreakData).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skel h-24 rounded-xl" />
          ))}
        </div>
        <div className="skel h-48 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="skel h-36 rounded-xl" />
          <div className="skel h-36 rounded-xl" />
        </div>
        <div className="skel h-20 rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-destructive">
        Could not load dashboard: {error}
      </div>
    );
  }
  if (!data) return null;

  // Always render the dashboard scaffold — even with zero attempts it shows
  // 0-value stat cards (the per-section components degrade gracefully). A new
  // user gets a real dashboard, not a dead-end placeholder.
  const hasAttempts = Number(data.totalAttempts) > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {headerSlot}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-[34px] leading-none">Dashboard</h1>
          <p className="mt-2 muted text-sm">Lifetime stats across all your sessions.</p>
        </div>
        <Link to="/setup" className="btn btn-primary flex-none">
          New session
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="mt-6 flex gap-6 border-b border-border">
        {[["practice", "Practice"], ["coach", "Coach"]].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "coach" ? (
        <CoachTab stats={coachStats} loading={coachLoading} />
      ) : (
        <>
          {!hasAttempts && (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-sm muted">
                No attempts yet — run a practice session and your breakdown fills in here.
              </p>
              <Link to="/setup" className="btn btn-primary flex-none">
                Start a session
              </Link>
            </div>
          )}
          {streakData && (
            <div className="mt-6">
              <StreakWidget data={streakData} onUpdate={setStreakData} compact />
            </div>
          )}
          <HeaderStats data={data} />
          <AccuracyByTypeChart byType={data.byType} />

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <TrapWeakness byTrapType={data.byTrapType} mostDangerousTrap={data.mostDangerousTrap} />
            <TopicAccuracy byTopic={data.byTopic} />
          </div>

          <WeakestArea data={data} />
          {data.intuitionStats && data.intuitionStats.totalAttempts > 0 && (
            <IntuitionStats stats={data.intuitionStats} />
          )}
          {srStats && srStats.totalCards > 0 && (
            <SrWidget stats={srStats} />
          )}
          <RecentAttempts attempts={data.recentAttempts} />
        </>
      )}
    </div>
  );
}

// Small uppercase section heading, shared across rows.
function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

// ── Coach tab ──────────────────────────────────────────────────────────────────
const TYPE_LABELS_COACH = { inference: "Inference", tone: "Tone", title: "Title", detail: "Detail" };

function CoachTab({ stats, loading }) {
  if (loading) return (
    <div className="mt-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="skel h-20 rounded-xl" />)}
    </div>
  );
  if (!stats || Number(stats.totalSessions) === 0) return (
    <div className="mt-12 text-center">
      <p className="muted text-sm">No Coach sessions yet.</p>
      <Link to="/coach" className="btn btn-primary mt-4 inline-flex">
        Start a session
      </Link>
    </div>
  );

  const accuracyPct = stats.accuracy != null ? `${Math.round(stats.accuracy * 100)}%` : "—";
  return (
    <div className="mt-6 space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Articles practiced", stats.totalSessions],
          ["Questions answered", stats.totalQuestions],
          ["Accuracy", accuracyPct],
          ["Avg exchanges", stats.avgExchanges ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* By question type */}
      {Object.keys(stats.byType || {}).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle>Accuracy by question type</SectionTitle>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.byType).map(([type, { attempts, correct }]) => {
              const acc = attempts ? correct / attempts : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-20 text-xs muted">{TYPE_LABELS_COACH[type] || type}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct(acc), backgroundColor: accuracyColor(acc) }} />
                  </div>
                  <span className="text-xs tabular-nums muted w-10 text-right">{pct(acc)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs dim">
            Avg exchanges needed: {stats.avgExchanges ?? "—"} (lower = stronger first-pass reasoning)
          </p>
        </div>
      )}

      {/* Recent sessions */}
      {stats.recentSessions?.length > 0 && (
        <div>
          <SectionTitle>Recent articles</SectionTitle>
          <div className="mt-3 space-y-2">
            {stats.recentSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.article_title || "Untitled article"}
                  </p>
                  <p className="text-xs muted">
                    {new Date(s.created_at).toLocaleDateString()} ·{" "}
                    {s.attempted ? `${s.correct}/${s.attempted} correct` : "in progress"}
                  </p>
                </div>
                <Link
                  to={`/coach/summary?sessionId=${s.id}`}
                  className="ml-4 flex-none text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row 1 ──────────────────────────────────────────────
function HeaderStats({ data }) {
  const avg =
    data.avgReasoningScore != null ? `${Number(data.avgReasoningScore).toFixed(1)}/5` : "—";
  const cards = [
    ["Questions answered", String(data.answeredCount)],
    ["Accuracy", pct(data.accuracy)],
    ["Trap pick rate", pct(data.trapPickRate)],
    ["Avg reasoning score", avg],
  ];
  return (
    <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-card p-5">
          <div className="mono text-[26px] leading-none text-foreground">{value}</div>
          <div className="mt-2 text-sm muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Row 2: plain-SVG horizontal bar chart ──────────────
function AccuracyByTypeChart({ byType }) {
  const entries = Object.entries(byType || {});
  if (entries.length === 0) return null;

  const rowH = 34;
  const gap = 10;
  const labelW = 90;
  const barMaxW = 360;
  const countW = 70;
  const width = labelW + barMaxW + countW;
  const height = entries.length * (rowH + gap);

  return (
    <section className="mt-10">
      <SectionTitle>Accuracy by question type</SectionTitle>
      <div className="mt-3 rounded-xl border border-border bg-card p-4 overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Accuracy by question type">
          {entries.map(([type, s], i) => {
            const acc = s.attempts ? s.correct / s.attempts : 0;
            const y = i * (rowH + gap);
            const barW = Math.max(2, acc * barMaxW);
            return (
              <g key={type}>
                <text x={0} y={y + rowH / 2 + 4} fill="var(--text-2)" fontSize="13" fontWeight="600">
                  {TYPE_LABELS[type] || type}
                </text>
                <rect x={labelW} y={y} width={barMaxW} height={rowH} rx="6" fill="var(--surface-2)" />
                <rect x={labelW} y={y} width={barW} height={rowH} rx="6" fill={accuracyColor(acc)} />
                <text x={labelW + 10} y={y + rowH / 2 + 4} fill="var(--bg)" fontSize="12" fontWeight="700">
                  {pct(acc)}
                </text>
                <text x={labelW + barMaxW + 8} y={y + rowH / 2 + 4} fill="var(--text-muted)" fontSize="12">
                  {s.correct}/{s.attempts}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

// ── Row 3 left: trap weakness ──────────────────────────
function TrapWeakness({ byTrapType, mostDangerousTrap }) {
  const entries = Object.entries(byTrapType || {}).sort((a, b) => {
    const ra = a[1].encountered ? a[1].fell_for / a[1].encountered : 0;
    const rb = b[1].encountered ? b[1].fell_for / b[1].encountered : 0;
    return rb - ra;
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle>Your trap weakness</SectionTitle>
      <div className="mt-4 space-y-4">
        {entries.map(([type, s]) => {
          const rate = s.encountered ? s.fell_for / s.encountered : 0;
          const worst = type === mostDangerousTrap && s.fell_for > 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{trapLabel(type)}</span>
                <span className="text-xs muted">
                  fell for {s.fell_for} of {s.encountered}
                </span>
              </div>
              <p className="text-xs dim">{trapDescription(type)}</p>
              <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max(2, rate * 100)}%`, backgroundColor: rate > 0 ? "var(--red)" : "var(--border)" }}
                />
              </div>
              {worst && (
                <p className="mt-1 text-xs font-semibold" style={{ color: "var(--red)" }}>This is your biggest blind spot</p>
              )}
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm dim">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Row 3 right: topic accuracy ────────────────────────
function TopicAccuracy({ byTopic }) {
  const entries = Object.entries(byTopic || {});
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle>Topic accuracy</SectionTitle>
      <div className="mt-4 space-y-3">
        {entries.map(([topic, s]) => {
          const acc = s.attempts ? s.correct / s.attempts : 0;
          return (
            <div key={topic} className="flex items-center justify-between">
              <TopicBadge topic={topic} />
              <span className="text-sm font-medium" style={{ color: accuracyColor(acc) }}>
                {pct(acc)} <span className="dim font-normal">({s.correct}/{s.attempts})</span>
              </span>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm dim">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Row 4: weakest-area callout ────────────────────────
function WeakestArea({ data }) {
  if (!data.weakestType) return null;
  const t = (data.byType || {})[data.weakestType];
  const avg = t?.avgReasoningScore != null ? `${Number(t.avgReasoningScore).toFixed(1)}/5` : "not yet scored";
  return (
    <section
      className="mt-8 rounded-xl border-l-[3px] p-5"
      style={{ borderColor: "var(--amber)", background: "color-mix(in oklch, var(--amber) 7%, var(--surface))" }}
    >
      <p className="text-sm leading-relaxed text-foreground">
        Your weakest area is <span className="font-semibold">{TYPE_LABELS[data.weakestType] || data.weakestType}</span>{" "}
        questions. You picked the trap <span className="font-semibold">{t?.trapPicked ?? 0}</span> out of{" "}
        <span className="font-semibold">{t?.attempts ?? 0}</span> times, and your average reasoning score here is{" "}
        <span className="font-semibold">{avg}</span>.
        {data.mostDangerousTrap && (
          <>
            {" "}Your most dangerous trap type is{" "}
            <span className="font-semibold">{trapLabel(data.mostDangerousTrap)}</span>.
          </>
        )}
      </p>
      <Link to="/setup" className="btn btn-primary mt-4 inline-flex">
        Practice more questions
      </Link>
    </section>
  );
}

// ── Intuition stats ────────────────────────────────────
function IntuitionStats({ stats }) {
  const elimAcc =
    stats.eliminationAccuracy != null
      ? `${Math.round(stats.eliminationAccuracy * 100)}%`
      : "—";
  const avgTime =
    stats.avgTimeSecs != null
      ? `${Math.round(stats.avgTimeSecs)}s`
      : "—";
  return (
    <section className="mt-8">
      <SectionTitle>Intuition mode</SectionTitle>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ["Total points", String(stats.totalPoints)],
          ["Questions", String(stats.totalAttempts)],
          ["Avg time / Q", avgTime],
          ["Elimination accuracy", elimAcc],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="mono text-xl leading-none text-foreground">{value}</div>
            <div className="mt-2 text-xs muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Row 5: recent attempts (expandable) ────────────────
function RecentAttempts({ attempts }) {
  if (!attempts || attempts.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle>Recent attempts</SectionTitle>
      <div className="mt-3 space-y-2">
        {attempts.map((a, i) => (
          <RecentAttemptCard key={i} attempt={a} />
        ))}
      </div>
    </section>
  );
}

function RecentAttemptCard({ attempt }) {
  const [open, setOpen] = useState(false);
  const badge = attempt.skipped
    ? { color: "var(--text-2)", bg: "var(--surface-2)", label: "Skipped" }
    : attempt.isCorrect
    ? { color: "var(--green)", bg: "rgba(74,222,128,0.12)", label: "Correct" }
    : { color: "var(--red)", bg: "rgba(248,113,113,0.12)", label: "Incorrect" };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground flex-none">
            <Icon name={open ? "chevU" : "chevD"} size={15} />
          </span>
          <span className="truncate text-sm text-foreground">{attempt.questionSnippet}</span>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <TypeBadge type={attempt.type} />
          {attempt.reasoningScore != null && <ScoreDots score={attempt.reasoningScore} />}
          <span className="text-xs mono dim">
            {Math.floor((attempt.timeTakenSeconds || 0) / 60)}:
            {String((attempt.timeTakenSeconds || 0) % 60).padStart(2, "0")}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: badge.color, background: badge.bg }}
          >
            {badge.label}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <TypeBadge type={attempt.type} />
            <TopicBadge topic={attempt.topic} />
          </div>
          {attempt.question && (
            <p className="mb-3 text-sm font-semibold text-foreground">{attempt.question}</p>
          )}
          <FeedbackSections attempt={attempt} />
        </div>
      )}
    </div>
  );
}

// ── Spaced Repetition widget (Phase 15) ───────────────────────────────────────
function SrWidget({ stats }) {
  const { totalCards, dueNow, graduated, avgBucket } = stats;
  const progress = totalCards > 0 ? Math.round((graduated / totalCards) * 100) : 0;

  return (
    <section className="mt-10">
      <SectionTitle>Spaced repetition</SectionTitle>
      <div className="mt-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div className="text-center">
              <p className="mono text-2xl leading-none text-foreground">{totalCards}</p>
              <p className="mt-1.5 text-xs muted">Total cards</p>
            </div>
            <div className="text-center">
              <p className="mono text-2xl leading-none" style={{ color: dueNow > 0 ? "var(--amber)" : "var(--green)" }}>
                {dueNow}
              </p>
              <p className="mt-1.5 text-xs muted">Due now</p>
            </div>
            <div className="text-center">
              <p className="mono text-2xl leading-none" style={{ color: "var(--green)" }}>{graduated}</p>
              <p className="mt-1.5 text-xs muted">Graduated</p>
            </div>
          </div>
          {dueNow > 0 && (
            <Link to="/setup" className="btn btn-primary flex-none">
              Review {dueNow} card{dueNow === 1 ? "" : "s"} →
            </Link>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs muted mb-1.5">
            <span>Progress to graduation</span>
            <span className="mono">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--green)" }}
            />
          </div>
        </div>

        {avgBucket != null && (
          <p className="mt-3 text-xs dim">
            Avg. interval bucket: {avgBucket} / 4 &nbsp;·&nbsp; Bucket 4 = 30-day interval (graduated)
          </p>
        )}
      </div>
    </section>
  );
}
