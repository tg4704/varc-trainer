import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, coach as coachApi, sr as srApi, streak as streakApi } from "../api.js";
import StreakWidget from "../components/StreakWidget.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import FeedbackSections, { ScoreDots } from "../components/FeedbackSections.jsx";
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

// red < 50%, amber 50–70%, green > 70%
function accuracyColor(acc) {
  if (acc < 0.5) return "#ef4444";
  if (acc <= 0.7) return "#f59e0b";
  return "#22c55e";
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
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-slate-100 h-24" />
          ))}
        </div>
        <div className="rounded-xl bg-slate-100 h-48" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-100 h-36" />
          <div className="rounded-xl bg-slate-100 h-36" />
        </div>
        <div className="rounded-xl bg-slate-100 h-20" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-red-600">
        Could not load dashboard: {error}
      </div>
    );
  }
  if (!data || data.totalAttempts === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">No attempts yet</h1>
        <p className="mt-2 text-slate-600">
          Run a practice session and your weakness breakdown will show up here.
        </p>
        <Link
          to="/setup"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Start a session
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {headerSlot}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Link
          to="/setup"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          New session
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {[["practice", "VARC Practice"], ["coach", "Reading Coach"]].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
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
          <p className="mt-4 text-sm text-slate-500">Lifetime stats across all your sessions.</p>
          {streakData && (
            <div className="mt-4">
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

// ── Coach tab ──────────────────────────────────────────────────────────────────
const TYPE_LABELS_COACH = { inference: "Inference", tone: "Tone", title: "Title", detail: "Detail" };

function CoachTab({ stats, loading }) {
  if (loading) return (
    <div className="mt-8 space-y-4 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}
    </div>
  );
  if (!stats || stats.totalSessions === 0) return (
    <div className="mt-12 text-center">
      <p className="text-slate-500 text-sm">No Coach sessions yet.</p>
      <Link
        to="/coach"
        className="mt-4 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
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
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* By question type */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Accuracy by question type</h2>
          <div className="space-y-3">
            {Object.entries(stats.byType).map(([type, { attempts, correct }]) => {
              const acc = attempts ? correct / attempts : 0;
              const color = acc < 0.5 ? "#ef4444" : acc <= 0.7 ? "#f59e0b" : "#22c55e";
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-600">{TYPE_LABELS_COACH[type] || type}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct(acc), backgroundColor: color }} />
                  </div>
                  <span className="text-xs tabular-nums text-slate-500 w-10 text-right">{pct(acc)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Avg exchanges needed: {stats.avgExchanges ?? "—"} (lower = stronger first-pass reasoning)
          </p>
        </div>
      )}

      {/* Recent sessions */}
      {stats.recentSessions?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent articles</h2>
          <div className="space-y-2">
            {stats.recentSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {s.article_title || "Untitled article"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.created_at).toLocaleDateString()} ·{" "}
                    {s.attempted ? `${s.correct}/${s.attempted} correct` : "in progress"}
                  </p>
                </div>
                <Link
                  to={`/coach/summary?sessionId=${s.id}`}
                  className="ml-4 flex-none text-xs text-slate-500 hover:text-slate-900 underline"
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
    data.avgReasoningScore != null ? `${data.avgReasoningScore.toFixed(1)}/5` : "—";
  const cards = [
    ["Questions Answered", String(data.answeredCount)],
    ["Accuracy", pct(data.accuracy)],
    ["Trap Pick Rate", pct(data.trapPickRate)],
    ["Avg Reasoning Score", avg],
  ];
  return (
    <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-500">{label}</div>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Accuracy by Question Type
      </h2>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Accuracy by question type">
          {entries.map(([type, s], i) => {
            const acc = s.attempts ? s.correct / s.attempts : 0;
            const y = i * (rowH + gap);
            const barW = Math.max(2, acc * barMaxW);
            return (
              <g
                key={type}
                style={{ cursor: "pointer" }}
                onClick={() => console.log(`Practice ${type} questions (filtered sessions: future)`)}
              >
                <text x={0} y={y + rowH / 2 + 4} className="fill-slate-700" fontSize="13" fontWeight="600">
                  {TYPE_LABELS[type] || type}
                </text>
                <rect x={labelW} y={y} width={barMaxW} height={rowH} rx="6" fill="#f1f5f9" />
                <rect x={labelW} y={y} width={barW} height={rowH} rx="6" fill={accuracyColor(acc)} />
                <text x={labelW + 8} y={y + rowH / 2 + 4} fill="#fff" fontSize="12" fontWeight="700">
                  {pct(acc)}
                </text>
                <text x={labelW + barMaxW + 8} y={y + rowH / 2 + 4} className="fill-slate-500" fontSize="12">
                  {s.correct}/{s.attempts}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-400">Click a bar to practise that type (coming soon).</p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Your Trap Weakness
      </h2>
      <div className="mt-4 space-y-4">
        {entries.map(([type, s]) => {
          const rate = s.encountered ? s.fell_for / s.encountered : 0;
          const worst = type === mostDangerousTrap && s.fell_for > 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{trapLabel(type)}</span>
                <span className="text-xs text-slate-500">
                  fell for {s.fell_for} of {s.encountered}
                </span>
              </div>
              <p className="text-xs text-slate-400">{trapDescription(type)}</p>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max(2, rate * 100)}%`, backgroundColor: rate > 0 ? "#ef4444" : "#cbd5e1" }}
                />
              </div>
              {worst && (
                <p className="mt-1 text-xs font-semibold text-red-600">This is your biggest blind spot</p>
              )}
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Row 3 right: topic accuracy ────────────────────────
function TopicAccuracy({ byTopic }) {
  const entries = Object.entries(byTopic || {});
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Topic Accuracy
      </h2>
      <div className="mt-4 space-y-3">
        {entries.map(([topic, s]) => {
          const acc = s.attempts ? s.correct / s.attempts : 0;
          return (
            <div key={topic} className="flex items-center justify-between">
              <TopicBadge topic={topic} />
              <span className="text-sm font-medium" style={{ color: accuracyColor(acc) }}>
                {pct(acc)} <span className="text-slate-400 font-normal">({s.correct}/{s.attempts})</span>
              </span>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Row 4: weakest-area callout ────────────────────────
function WeakestArea({ data }) {
  if (!data.weakestType) return null;
  const t = (data.byType || {})[data.weakestType];
  const avg = t?.avgReasoningScore != null ? `${t.avgReasoningScore.toFixed(1)}/5` : "not yet scored";
  return (
    <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm text-amber-900">
        Your weakest area is <span className="font-bold">{TYPE_LABELS[data.weakestType] || data.weakestType}</span>{" "}
        questions. You picked the trap <span className="font-bold">{t?.trapPicked ?? 0}</span> out of{" "}
        <span className="font-bold">{t?.attempts ?? 0}</span> times, and your average reasoning score here is{" "}
        <span className="font-bold">{avg}</span>.
        {data.mostDangerousTrap && (
          <>
            {" "}Your most dangerous trap type is{" "}
            <span className="font-bold">{trapLabel(data.mostDangerousTrap)}</span>.
          </>
        )}
      </p>
      <button
        onClick={() => console.log(`Practice ${data.weakestType} questions (filtered sessions: future)`)}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Practice {TYPE_LABELS[data.weakestType] || data.weakestType} questions
      </button>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Intuition Mode
      </h2>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ["Total Points", String(stats.totalPoints)],
          ["Questions", String(stats.totalAttempts)],
          ["Avg Time / Q", avgTime],
          ["Elimination Accuracy", elimAcc],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xl font-bold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recent Attempts
      </h2>
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
    ? ["bg-slate-100 text-slate-500", "Skipped"]
    : attempt.isCorrect
    ? ["bg-green-100 text-green-700", "Correct"]
    : ["bg-red-100 text-red-700", "Incorrect"];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-400 text-xs">{open ? "▾" : "▸"}</span>
          <span className="truncate text-sm text-slate-700">{attempt.questionSnippet}</span>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <TypeBadge type={attempt.type} />
          {attempt.reasoningScore != null && <ScoreDots score={attempt.reasoningScore} />}
          <span className="text-xs font-mono text-slate-400">
            {Math.floor((attempt.timeTakenSeconds || 0) / 60)}:
            {String((attempt.timeTakenSeconds || 0) % 60).padStart(2, "0")}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[0]}`}>
            {badge[1]}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <TypeBadge type={attempt.type} />
            <TopicBadge topic={attempt.topic} />
          </div>
          {attempt.question && (
            <p className="mb-3 text-sm font-semibold text-slate-900">{attempt.question}</p>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Spaced Repetition
      </h2>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalCards}</p>
              <p className="mt-0.5 text-xs text-slate-500">Total cards</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${dueNow > 0 ? "text-amber-600" : "text-green-600"}`}>
                {dueNow}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Due now</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{graduated}</p>
              <p className="mt-0.5 text-xs text-slate-500">Graduated</p>
            </div>
          </div>
          {dueNow > 0 && (
            <Link
              to="/setup"
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors flex-none"
            >
              Review {dueNow} card{dueNow === 1 ? "" : "s"} →
            </Link>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress to graduation</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {avgBucket != null && (
          <p className="mt-3 text-xs text-slate-400">
            Avg. interval bucket: {avgBucket} / 4 &nbsp;·&nbsp; Bucket 4 = 30-day interval (graduated)
          </p>
        )}
      </div>
    </section>
  );
}
