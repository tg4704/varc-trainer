import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getDashboard, getDashboardTrend, getDashboardHeatmap,
  coach as coachApi,
} from "../api.js";
import { useAuth } from "../auth.jsx";
import { getActiveCoachSessionId } from "../coachSession.js";
import TopicBadge from "../components/TopicBadge.jsx";
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
  const navigate = useNavigate();
  const [tab, setTab] = useState("practice"); // "practice" | "coach"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coachStats, setCoachStats] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [resumeCoach, setResumeCoach] = useState(null);

  async function handleStartFresh() {
    if (!resumeCoach) return;
    try { await coachApi.deleteSession(resumeCoach.id); } catch {}
    setResumeCoach(null);
    navigate("/coach");
  }

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
    <div className="max-w-[1240px] mx-auto px-4 pt-9 pb-14 md:px-11">
      {headerSlot}
      <div>
        <h1 className="display text-[34px] leading-[1.1]">
          {greeting}, <span className="italic" style={{ color: "var(--teal)" }}>{greetName}.</span>
        </h1>
        <p className="mt-2 muted text-sm">{today}. Lifetime stats across all your sessions.</p>
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
          <HeaderStats data={data} />

          <div className="mt-6">
            <WeeklyHeatmap />
          </div>

          <div className="mt-6 grid gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-5">
              {resumeCoach && <ResumeCoachCard session={resumeCoach} onStartFresh={handleStartFresh} />}
              <AccuracyTrendChart />
            </div>
            <WeakByTypeList byType={data.byType} />
          </div>

          <div className="mt-6 grid gap-[18px] md:grid-cols-2">
            <TrapWeakness byTrapType={data.byTrapType} mostDangerousTrap={data.mostDangerousTrap} />
            <TopicAccuracy byTopic={data.byTopic} />
          </div>

          <div className="mt-6">
            <RecentSessions sessions={data.recentSessions} />
          </div>

          {data.intuitionStats && data.intuitionStats.totalAttempts > 0 && (
            <IntuitionStats stats={data.intuitionStats} />
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
                    {new Date(s.created_at).toLocaleDateString()}
                    {", "}
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
  // [label, value, valueColor] — accuracy keeps its threshold colour, the rest
  // are neutral. (Status dots removed per the user's request.)
  const cards = [
    ["Questions answered", String(data.answeredCount), "var(--text)"],
    ["Accuracy", pct(data.accuracy), accuracyColor(data.accuracy)],
    ["Trap pick rate", pct(data.trapPickRate), "var(--text)"],
    ["Avg reasoning score", avg, "var(--text)"],
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(([label, value, valueColor]) => (
        <div key={label} className="glass glasscard p-[18px_19px]">
          <span className="eyebrow">{label}</span>
          <div className="mono mt-3 text-[30px] leading-none" style={{ color: valueColor }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Resume in-progress Coach session ──────────────────────
function ResumeCoachCard({ session, onStartFresh }) {
  const attempted = session.questions?.filter((q) => q.correctIndex != null).length || 0;
  const total = session.questions?.length || 0;
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-[22px_24px]"
      style={{ background: "linear-gradient(135deg, rgba(93,202,165,0.18), rgba(139,157,255,0.10))", border: "1px solid rgba(93,202,165,0.32)" }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(93,202,165,0.25), transparent 70%)" }}
      />
      <div className="eyebrow" style={{ color: "var(--teal)" }}>Pick up where you left off</div>
      <div className="display mt-2 text-[25px]">{session.passage?.title || "Untitled passage"}</div>
      <div className="mt-1.5 text-[13px]" style={{ color: "var(--text)" }}>
        {total ? `Set of ${total}, ${attempted} of ${total} answered` : "Reading map in progress"}
      </div>
      <div className="mt-4 flex gap-2.5">
        <Link to={`/coach/practice?sessionId=${session.id}`} className="btn btn-primary fx-sheen inline-flex">
          Resume <span className="arrow inline-block">→</span>
        </Link>
        <button onClick={onStartFresh} className="btn btn-glass fx-ring">
          Start fresh
        </button>
      </div>
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
              <>{", "}<span style={{ color: delta >= 0 ? "var(--green)" : "var(--red)" }}>{delta >= 0 ? "+" : ""}{delta} pts</span> over range</>
            )}
          </div>
        </div>
        <div className="flex gap-1 rounded-[9px] p-[3px]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-lo)" }}>
          {["7d", "30d", "all"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="rounded-[7px] text-[11px] font-semibold transition-colors"
              style={{ padding: "5px 11px", ...(range === r ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }) }}
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
      <div className="flex flex-col" style={{ gap: 17 }}>
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

// GitHub-style contribution graph: weeks as columns (Sun-top rows), ~26 weeks
// (6 months) of history, month labels along the top, Mon/Wed/Fri row labels,
// and a Less-More legend. Data from GET /api/dashboard/heatmap (183 days).
const HEAT_WEEKS = 26;
const HEAT_CELL = 13;
const HEAT_GAP = 3;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]; // rows Sun..Sat
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildHeatGrid(days) {
  const map = {};
  days.forEach((d) => { map[d.date] = d.count; });

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentSunday = new Date(todayUTC);
  currentSunday.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());
  const start = new Date(currentSunday);
  start.setUTCDate(currentSunday.getUTCDate() - (HEAT_WEEKS - 1) * 7);

  const cols = [];
  const monthLabels = [];
  let lastMonth = -1;
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + r);
      if (d > todayUTC) { col.push(null); continue; }
      const iso = d.toISOString().slice(0, 10);
      col.push({ date: iso, count: map[iso] || 0, month: d.getUTCMonth() });
    }
    const firstCell = col.find(Boolean);
    if (firstCell && firstCell.month !== lastMonth) {
      monthLabels.push({ col: w, label: MONTH_ABBR[firstCell.month] });
      lastMonth = firstCell.month;
    }
    cols.push(col);
  }
  return { cols, monthLabels };
}

function WeeklyHeatmap() {
  const [heatmap, setHeatmap] = useState(null);

  useEffect(() => {
    getDashboardHeatmap().then(setHeatmap).catch(() => {});
  }, []);

  const days = heatmap?.days || [];
  const total = days.reduce((s, d) => s + d.count, 0);
  const { cols, monthLabels } = buildHeatGrid(days);

  return (
    <div className="glass p-[20px_22px]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>Practice activity</SectionTitle>
        <span className="text-xs dim">{total} question{total === 1 ? "" : "s"} in the last 6 months</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* weekday row labels (aligned below the month-label strip) */}
        <div className="flex flex-none flex-col" style={{ gap: HEAT_GAP, paddingTop: 16 }}>
          {WEEKDAY_LABELS.map((lbl, r) => (
            <span key={r} className="flex items-center text-[9px] leading-none dim" style={{ height: HEAT_CELL }}>
              {lbl}
            </span>
          ))}
        </div>

        <div>
          {/* month labels */}
          <div className="flex" style={{ gap: HEAT_GAP, height: 16 }}>
            {cols.map((_, w) => {
              const ml = monthLabels.find((m) => m.col === w);
              return (
                <span key={w} className="text-[9px] leading-none dim" style={{ width: HEAT_CELL, whiteSpace: "nowrap", overflow: "visible" }}>
                  {ml ? ml.label : ""}
                </span>
              );
            })}
          </div>
          {/* grid */}
          <div className="flex" style={{ gap: HEAT_GAP }}>
            {cols.map((col, w) => (
              <div key={w} className="flex flex-col" style={{ gap: HEAT_GAP }}>
                {col.map((cell, r) =>
                  cell === null ? (
                    <span key={r} style={{ width: HEAT_CELL, height: HEAT_CELL }} />
                  ) : (
                    <span
                      key={r}
                      title={cell.count === 0 ? `No practice on ${cell.date}` : `${cell.count} question${cell.count === 1 ? "" : "s"} on ${cell.date}`}
                      className="rounded-[2px] transition-transform hover:scale-[1.2]"
                      style={{ width: HEAT_CELL, height: HEAT_CELL, background: heatColor(heatLevel(cell.count)) }}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] dim">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="rounded-[2px]" style={{ width: 11, height: 11, background: heatColor(l) }} />
        ))}
        More
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

// ── Recent sessions ──────────────────────────────────────────────────────
// A flat list of the user's most recent sessions. Clicking one opens its
// Results screen — the same recap shown right after completing a Drills run.
function relativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RecentSessions({ sessions }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div className="glass p-[20px_22px]">
      <SectionTitle>Recent sessions</SectionTitle>
      <div className="mt-3">
        {sessions.map((s, i) => (
          <RecentSessionRow key={s.id} session={s} first={i === 0} />
        ))}
      </div>
    </div>
  );
}

function RecentSessionRow({ session, first }) {
  const answered = Number(session.answered) || 0;
  const correct = Number(session.correct) || 0;
  const acc = answered ? correct / answered : 0;
  const inProgress = session.status !== "completed";
  return (
    <Link
      to={`/results?sessionId=${session.id}`}
      className="flex w-full items-center gap-3.5 rounded-[10px] px-2.5 py-3 text-left transition-colors hover:bg-white/[0.04]"
      style={!first ? { borderTop: "1px solid rgba(255,255,255,0.05)" } : undefined}
    >
      <span
        className="mono flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[13px] font-bold"
        style={{ color: "var(--teal)", background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.28)" }}
      >
        {session.numQuestions}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-foreground">
          {answered} of {session.numQuestions} answered{inProgress ? " (in progress)" : ""}
        </p>
        <p className="mt-0.5 text-[11px] dim">{relativeDate(session.createdAt)}</p>
      </div>
      <div className="flex-none text-right">
        <div className="mono text-[15px] font-semibold" style={{ color: accuracyColor(acc) }}>
          {answered ? pct(acc) : "—"}
        </div>
        <div className="text-[10.5px] dim">{correct}/{answered} correct</div>
      </div>
      <span className="flex-none dim" style={{ fontSize: 18, lineHeight: 1 }}>›</span>
    </Link>
  );
}
