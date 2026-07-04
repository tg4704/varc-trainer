import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboard, getDashboardTrend, getDashboardHeatmap,
  coach as coachApi, sr as srApi, streak as streakApi,
} from "../api.js";
import { useAuth } from "../auth.jsx";
import { getActiveCoachSessionId } from "../coachSession.js";
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
  main_idea: "Main idea",
  function: "Function",
  concept_set: "Concept set",
  vocab_in_context: "Vocab",
  weaken_strengthen: "Weaken/Strengthen",
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
  const { user } = useAuth();
  const [tab, setTab] = useState("practice"); // "practice" | "coach"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coachStats, setCoachStats] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [srStats, setSrStats] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [resumeCoach, setResumeCoach] = useState(null);

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

  useEffect(() => {
    srApi.getStats().then(setSrStats).catch(() => {});
  }, []);

  useEffect(() => {
    streakApi.get().then(setStreakData).catch(() => {});
  }, []);

  // "Pick up where you left off" — only Coach sessions are resumable (Drills
  // sessions are explicitly End-only, see Practice.jsx), so this only ever
  // surfaces an in-progress Coach passage.
  useEffect(() => {
    const id = getActiveCoachSessionId();
    if (!id) return;
    coachApi.getSession(id)
      .then(({ coachSession }) => {
        if (coachSession?.status === "active") setResumeCoach(coachSession);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skel h-24 rounded-xl" />)}
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

  const hasAttempts = Number(data.totalAttempts) > 0;
  const greetName = user?.name || user?.username || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="max-w-6xl mx-auto px-4 py-9 md:px-11">
      {headerSlot}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[32px] leading-none">
            {greeting}, <span className="italic" style={{ color: "var(--teal)" }}>{greetName}.</span>
          </h1>
          <p className="mt-2 muted text-sm">{today} · lifetime stats across all your sessions.</p>
        </div>
        <Link to="/setup" className="btn btn-primary fx-sheen flex-none">
          New session
        </Link>
      </div>

      {/* Tab switcher — segmented pill */}
      <div className="mt-6 inline-flex gap-1 rounded-[11px] p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}>
        {[["practice", "Practice"], ["coach", "Coach"]].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="rounded-[8px] px-4 py-1.5 text-sm font-semibold transition-colors"
            style={tab === t ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
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
            <div className="glass mt-6 flex items-center justify-between gap-4 px-5 py-4">
              <p className="text-sm muted">
                No attempts yet. Run a practice session and your breakdown fills in here.
              </p>
              <Link to="/setup" className="btn btn-primary fx-sheen flex-none">
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

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-5">
              {resumeCoach && <ResumeCoachCard session={resumeCoach} />}
              <AccuracyTrendChart />
            </div>
            <WeakByTypeList byType={data.byType} />
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <TrapWeakness byTrapType={data.byTrapType} mostDangerousTrap={data.mostDangerousTrap} />
            <TopicAccuracy byTopic={data.byTopic} />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <RecentAttempts attempts={data.recentAttempts} />
            <WeeklyHeatmap />
          </div>

          <WeakestArea data={data} />
          {data.intuitionStats && data.intuitionStats.totalAttempts > 0 && (
            <IntuitionStats stats={data.intuitionStats} />
          )}
          {srStats && srStats.totalCards > 0 && (
            <SrWidget stats={srStats} />
          )}
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
const TYPE_LABELS_COACH = TYPE_LABELS;

function CoachTab({ stats, loading }) {
  if (loading) return (
    <div className="mt-8 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="skel h-20 rounded-xl" />)}
    </div>
  );
  if (!stats || Number(stats.totalSessions) === 0) return (
    <div className="mt-12 text-center">
      <p className="muted text-sm">No Coach sessions yet.</p>
      <Link to="/coach" className="btn btn-primary fx-sheen mt-4 inline-flex">
        Start a session
      </Link>
    </div>
  );

  const accuracyPct = stats.accuracy != null ? `${Math.round(stats.accuracy * 100)}%` : "—";
  return (
    <div className="mt-6 space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Passages practiced", stats.totalSessions],
          ["Questions answered", stats.totalQuestions],
          ["Accuracy", accuracyPct],
          ["Avg reasoning", stats.avgReasoningScore != null ? `${stats.avgReasoningScore}/5` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="glass glasscard p-4">
            <p className="text-xs muted">{label}</p>
            <p className="mt-1 mono text-2xl text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {Object.keys(stats.byType || {}).length > 0 && (
        <div className="glass p-5">
          <SectionTitle>Accuracy by question type</SectionTitle>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.byType).map(([type, { attempts, correct }]) => {
              const acc = attempts ? correct / attempts : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-24 flex-none text-xs muted">{TYPE_LABELS_COACH[type] || type}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full" style={{ width: pct(acc), backgroundColor: accuracyColor(acc) }} />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums muted">{pct(acc)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs dim">
            Avg reasoning score: {stats.avgReasoningScore != null ? `${stats.avgReasoningScore}/5` : "—"} (higher = stronger first-pass reasoning)
          </p>
        </div>
      )}

      {stats.recentSessions?.length > 0 && (
        <div>
          <SectionTitle>Recent passages</SectionTitle>
          <div className="mt-3 space-y-2">
            {stats.recentSessions.map((s) => (
              <div key={s.id} className="glass flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.article_title || "Untitled passage"}
                  </p>
                  <p className="text-xs muted">
                    {new Date(s.created_at).toLocaleDateString()} ·{" "}
                    {s.attempted ? `${s.correct}/${s.attempted} correct` : "in progress"}
                  </p>
                </div>
                <Link to={`/coach/summary?sessionId=${s.id}`} className="fx-underline ml-4 flex-none text-xs" style={{ color: "var(--teal)" }}>
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

// ── KPI row ──────────────────────────────────────────────
function HeaderStats({ data }) {
  const avg = data.avgReasoningScore != null ? `${Number(data.avgReasoningScore).toFixed(1)}/5` : "—";
  const cards = [
    ["Questions answered", String(data.answeredCount), "var(--teal)"],
    ["Accuracy", pct(data.accuracy), accuracyColor(data.accuracy)],
    ["Trap pick rate", pct(data.trapPickRate), "var(--trap)"],
    ["Avg reasoning score", avg, "var(--periwinkle)"],
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(([label, value, dot]) => (
        <div key={label} className="glass glasscard p-[19px]">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{label}</span>
            <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
          </div>
          <div className="mono mt-3 text-[26px] leading-none" style={{ color: dot === "var(--teal)" || dot === accuracyColor(data.accuracy) ? dot : "var(--text)" }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Resume in-progress Coach session ──────────────────────
function ResumeCoachCard({ session }) {
  const attempted = session.questions?.filter((q) => q.correctIndex != null).length || 0;
  const total = session.questions?.length || 0;
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-[22px_24px]"
      style={{ background: "linear-gradient(135deg, rgba(93,202,165,0.18), rgba(139,157,255,0.10))", border: "1px solid rgba(93,202,165,0.32)" }}
    >
      <div className="eyebrow" style={{ color: "var(--teal)" }}>Pick up where you left off</div>
      <div className="display mt-2 text-[22px]">{session.passage?.title || "Untitled passage"}</div>
      <div className="mt-1.5 text-[13px]" style={{ color: "var(--text)" }}>
        {total ? `${attempted} of ${total} questions answered` : "Reading map in progress"}
      </div>
      <Link to={`/coach/practice?sessionId=${session.id}`} className="btn btn-primary fx-sheen mt-4 inline-flex">
        Resume <span className="arrow inline-block">→</span>
      </Link>
    </div>
  );
}

// ── Accuracy trend line chart ──────────────────────────────
function AccuracyTrendChart() {
  const [range, setRange] = useState("30d");
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    getDashboardTrend(range).then(setTrend).catch(() => setTrend({ days: [] }));
  }, [range]);

  const days = trend?.days || [];
  const W = 480, H = 130, padX = 14, padT = 14, padB = 24;
  let points = "", area = "", dotX = 0, dotY = 0, cur = "—", delta = 0;

  if (days.length >= 2) {
    const vals = days.map((d) => Math.round(d.accuracy * 100));
    const min = Math.min(...vals), max = Math.max(...vals);
    const rng = (max - min) || 1;
    const xs = (i) => padX + (i * (W - 2 * padX)) / (vals.length - 1);
    const ys = (v) => H - padB - ((v - min) / rng) * (H - padT - padB);
    points = vals.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
    area = `${xs(0).toFixed(1)},${H - padB} ${points} ${xs(vals.length - 1).toFixed(1)},${H - padB}`;
    dotX = xs(vals.length - 1).toFixed(1);
    dotY = ys(vals[vals.length - 1]).toFixed(1);
    cur = `${vals[vals.length - 1]}%`;
    delta = vals[vals.length - 1] - vals[0];
  } else if (days.length === 1) {
    cur = `${Math.round(days[0].accuracy * 100)}%`;
  }

  return (
    <div className="glass flex-1 p-[20px_22px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Accuracy trend</div>
          <div className="mt-0.5 text-xs muted">
            now <span className="font-semibold" style={{ color: "var(--teal)" }}>{cur}</span>
            {days.length >= 2 && (
              <> · <span style={{ color: delta >= 0 ? "var(--green)" : "var(--red)" }}>{delta >= 0 ? "+" : ""}{delta} pts</span> over range</>
            )}
          </div>
        </div>
        <div className="flex gap-1 rounded-[9px] p-[3px]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-lo)" }}>
          {["7d", "30d", "all"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors"
              style={range === r ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        {days.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--teal)" stopOpacity="0.35" />
                <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={padX} y1={38} x2={W - padX} y2={38} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <line x1={padX} y1={74} x2={W - padX} y2={74} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <polygon points={area} fill="url(#gradTrend)" />
            <polyline points={points} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={dotX} cy={dotY} r="4.5" fill="var(--bg)" stroke="var(--teal)" strokeWidth="2.5" />
          </svg>
        ) : (
          <p className="py-8 text-center text-sm dim">Not enough data yet. Answer a few more questions.</p>
        )}
      </div>
    </div>
  );
}

// ── Where you're losing points (by type, with Drill CTA) ──
function WeakByTypeList({ byType }) {
  const rows = Object.entries(byType || {})
    .map(([type, s]) => ({ type, acc: s.attempts ? s.correct / s.attempts : 0, ...s }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 5);

  return (
    <div className="glass flex flex-col p-[20px_22px]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Where you're losing points</div>
        {rows[0] && (
          <Link to={`/setup?type=${encodeURIComponent(rows[0].type)}`} className="fx-underline text-xs" style={{ color: "var(--periwinkle)" }}>
            Drill →
          </Link>
        )}
      </div>
      <p className="mt-1 mb-4 text-xs muted">Lowest accuracy by question type.</p>
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.type}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px]" style={{ color: "var(--text)" }}>{TYPE_LABELS[r.type] || r.type}</span>
              <span className="mono text-xs" style={{ color: accuracyColor(r.acc) }}>{pct(r.acc)}</span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full" style={{ width: pct(r.acc), background: accuracyColor(r.acc) }} />
            </div>
            <div className="mt-1 text-[10.5px] dim">{r.correct} of {r.attempts} correct</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm dim">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Weekly heatmap ──────────────────────────────────────────
function heatColor(level) {
  return ["rgba(255,255,255,0.06)", "rgba(93,202,165,0.30)", "rgba(93,202,165,0.55)", "rgba(93,202,165,0.80)", "var(--teal)"][level];
}
function heatLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 7) return 2;
  if (count <= 14) return 3;
  return 4;
}

function WeeklyHeatmap() {
  const [heatmap, setHeatmap] = useState(null);

  useEffect(() => {
    getDashboardHeatmap().then(setHeatmap).catch(() => {});
  }, []);

  const days = heatmap?.days || [];
  const total = days.reduce((s, d) => s + d.count, 0);
  // Group the last 35 days into 5 columns of 7 (oldest-first, so newest is the rightmost column)
  const cols = [];
  for (let c = 0; c < 5; c++) cols.push(days.slice(c * 7, c * 7 + 7));
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="glass p-[20px_22px]">
      <div className="eyebrow">This week · {total} questions</div>
      <div className="mt-4 flex gap-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col items-center gap-1">
            {col.map((d, ri) => (
              <span
                key={d.date}
                title={d.count === 0 ? "No practice" : `${d.count} question${d.count === 1 ? "" : "s"}`}
                className="block rounded-[3.5px] transition-transform hover:scale-125"
                style={{ width: 14, height: 14, background: heatColor(heatLevel(d.count)) }}
              />
            ))}
            {ci === cols.length - 1 && col.length > 0 && (
              <span className="mt-0.5 text-[9px] dim">{dayLabels[new Date(col[col.length - 1].date).getUTCDay()]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trap weakness ──────────────────────────────────────────
function TrapWeakness({ byTrapType, mostDangerousTrap }) {
  const entries = Object.entries(byTrapType || {}).sort((a, b) => {
    const ra = a[1].encountered ? a[1].fell_for / a[1].encountered : 0;
    const rb = b[1].encountered ? b[1].fell_for / b[1].encountered : 0;
    return rb - ra;
  });

  return (
    <div className="glass p-5">
      <SectionTitle>Your trap weakness</SectionTitle>
      <div className="mt-4 space-y-4">
        {entries.map(([type, s]) => {
          const rate = s.encountered ? s.fell_for / s.encountered : 0;
          const worst = type === mostDangerousTrap && s.fell_for > 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{trapLabel(type)}</span>
                <span className="text-xs muted">fell for {s.fell_for} of {s.encountered}</span>
              </div>
              <p className="text-xs dim">{trapDescription(type)}</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.max(2, rate * 100)}%`, backgroundColor: rate > 0 ? "var(--red)" : "var(--glass-border-lo)" }} />
              </div>
              {worst && <p className="mt-1 text-xs font-semibold" style={{ color: "var(--red)" }}>This is your biggest blind spot</p>}
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm dim">No data yet.</p>}
      </div>
    </div>
  );
}

// ── Topic accuracy ──────────────────────────────────────────
function TopicAccuracy({ byTopic }) {
  const entries = Object.entries(byTopic || {});
  return (
    <div className="glass p-5">
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

// ── Weakest-area callout ────────────────────────────────────
function WeakestArea({ data }) {
  if (!data.weakestType) return null;
  const t = (data.byType || {})[data.weakestType];
  const avg = t?.avgReasoningScore != null ? `${Number(t.avgReasoningScore).toFixed(1)}/5` : "not yet scored";
  return (
    <section className="glass mt-6 border-l-[3px] p-5" style={{ borderLeftColor: "var(--amber)" }}>
      <p className="text-sm leading-relaxed text-foreground">
        Your weakest area is <span className="font-semibold">{TYPE_LABELS[data.weakestType] || data.weakestType}</span>{" "}
        questions. You picked the trap <span className="font-semibold">{t?.trapPicked ?? 0}</span> out of{" "}
        <span className="font-semibold">{t?.attempts ?? 0}</span> times, and your average reasoning score here is{" "}
        <span className="font-semibold">{avg}</span>.
        {data.mostDangerousTrap && (
          <> Your most dangerous trap type is <span className="font-semibold">{trapLabel(data.mostDangerousTrap)}</span>.</>
        )}
      </p>
      <Link to={`/setup?type=${encodeURIComponent(data.weakestType)}`} className="btn btn-primary fx-sheen mt-4 inline-flex">
        Drill {TYPE_LABELS[data.weakestType] || data.weakestType} questions
      </Link>
    </section>
  );
}

// ── Intuition stats ────────────────────────────────────────
function IntuitionStats({ stats }) {
  const elimAcc = stats.eliminationAccuracy != null ? `${Math.round(stats.eliminationAccuracy * 100)}%` : "—";
  const avgTime = stats.avgTimeSecs != null ? `${Math.round(stats.avgTimeSecs)}s` : "—";
  return (
    <section className="mt-8">
      <SectionTitle>Intuition mode</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total points", String(stats.totalPoints)],
          ["Questions", String(stats.totalAttempts)],
          ["Avg time / Q", avgTime],
          ["Elimination accuracy", elimAcc],
        ].map(([label, value]) => (
          <div key={label} className="glass p-4">
            <div className="mono text-xl leading-none text-foreground">{value}</div>
            <div className="mt-2 text-xs muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Recent attempts (expandable) ────────────────────────────
function RecentAttempts({ attempts }) {
  if (!attempts || attempts.length === 0) return null;
  return (
    <section>
      <SectionTitle>Recent attempts</SectionTitle>
      <div className="mt-3 space-y-2">
        {attempts.map((a, i) => <RecentAttemptCard key={i} attempt={a} />)}
      </div>
    </section>
  );
}

function RecentAttemptCard({ attempt }) {
  const [open, setOpen] = useState(false);
  const badge = attempt.skipped
    ? { color: "var(--text-2)", bg: "rgba(255,255,255,0.06)", label: "Skipped" }
    : attempt.isCorrect
    ? { color: "var(--green)", bg: "rgba(74,222,128,0.12)", label: "Correct" }
    : { color: "var(--red)", bg: "rgba(248,113,113,0.12)", label: "Incorrect" };

  return (
    <div className="glass">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex-none text-muted-foreground"><Icon name={open ? "chevU" : "chevD"} size={15} /></span>
          <span className="truncate text-sm text-foreground">{attempt.questionSnippet}</span>
        </div>
        <div className="flex flex-none items-center gap-2">
          <TypeBadge type={attempt.type} />
          {attempt.reasoningScore != null && <ScoreDots score={attempt.reasoningScore} />}
          <span className="mono dim text-xs">
            {Math.floor((attempt.timeTakenSeconds || 0) / 60)}:{String((attempt.timeTakenSeconds || 0) % 60).padStart(2, "0")}
          </span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: badge.color, background: badge.bg }}>
            {badge.label}
          </span>
        </div>
      </button>
      {open && (
        <div className="px-4 py-4" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
          <div className="mb-3 flex items-center gap-2">
            <TypeBadge type={attempt.type} />
            <TopicBadge topic={attempt.topic} />
          </div>
          {attempt.question && <p className="mb-3 text-sm font-semibold text-foreground">{attempt.question}</p>}
          <FeedbackSections attempt={attempt} />
        </div>
      )}
    </div>
  );
}

// ── Spaced repetition widget ────────────────────────────────
function SrWidget({ stats }) {
  const { totalCards, dueNow, graduated, avgBucket } = stats;
  const progress = totalCards > 0 ? Math.round((graduated / totalCards) * 100) : 0;

  return (
    <section className="mt-8">
      <SectionTitle>Spaced repetition</SectionTitle>
      <div className="glass mt-3 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid flex-1 grid-cols-3 gap-4">
            <div className="text-center">
              <p className="mono text-2xl leading-none text-foreground">{totalCards}</p>
              <p className="mt-1.5 text-xs muted">Total cards</p>
            </div>
            <div className="text-center">
              <p className="mono text-2xl leading-none" style={{ color: dueNow > 0 ? "var(--amber)" : "var(--green)" }}>{dueNow}</p>
              <p className="mt-1.5 text-xs muted">Due now</p>
            </div>
            <div className="text-center">
              <p className="mono text-2xl leading-none" style={{ color: "var(--green)" }}>{graduated}</p>
              <p className="mt-1.5 text-xs muted">Graduated</p>
            </div>
          </div>
          {dueNow > 0 && (
            <Link to="/setup" className="btn btn-primary fx-sheen flex-none">
              Review {dueNow} card{dueNow === 1 ? "" : "s"} →
            </Link>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs muted">
            <span>Progress to graduation</span>
            <span className="mono">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--green)" }} />
          </div>
        </div>

        {avgBucket != null && (
          <p className="mt-3 text-xs dim">Avg. interval bucket: {avgBucket} / 4 &nbsp;·&nbsp; Bucket 4 = 30-day interval (graduated)</p>
        )}
      </div>
    </section>
  );
}
