// Phase 16 — Streak & daily-goal widget.
// Shows a circular progress ring (today's count vs goal), current streak,
// and an at-risk warning when the streak will break if today stays incomplete.
import { useState } from "react";
import { streak as streakApi } from "../api.js";

const RING_R = 40;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function GoalRing({ todayCount, dailyGoal }) {
  const pct = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const done = todayCount >= dailyGoal;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="block">
      {/* Track */}
      <circle
        cx="50"
        cy="50"
        r={RING_R}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-slate-200 dark:text-slate-700"
      />
      {/* Progress arc — rotated so it starts at the top */}
      <circle
        cx="50"
        cy="50"
        r={RING_R}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        className={done ? "text-green-500" : "text-indigo-500"}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.5s ease" }}
      />
      {/* Centre text */}
      <text
        x="50"
        y="46"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-900 dark:fill-slate-100"
        style={{ fontSize: "18px", fontWeight: 700, fontFamily: "inherit" }}
      >
        {todayCount}
      </text>
      <text
        x="50"
        y="63"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-500"
        style={{ fontSize: "11px", fontFamily: "inherit" }}
      >
        / {dailyGoal}
      </text>
    </svg>
  );
}

// Inline goal editor — shows a stepper or text field + save button.
function GoalEditor({ current, onSave }) {
  const [val, setVal] = useState(String(current));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const n = parseInt(val, 10);
    if (!n || n < 1 || n > 50) return;
    setBusy(true);
    try {
      await onSave(n);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        type="button"
        onClick={() => setVal((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
        className="w-6 h-6 rounded border border-slate-300 text-slate-500 hover:border-slate-500 text-sm leading-none"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={50}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={() => setVal((v) => String(Math.min(50, parseInt(v, 10) + 1)))}
        className="w-6 h-6 rounded border border-slate-300 text-slate-500 hover:border-slate-500 text-sm leading-none"
      >
        +
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        className="ml-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}

/**
 * StreakWidget — compact card showing today's goal ring + streak count.
 *
 * Props:
 *   data       — { streak, todayCount, dailyGoal, atRisk } from GET /api/streak
 *   onUpdate   — called with fresh data after goal is changed; optional
 *   showEditor — show the daily-goal editor (default false)
 *   compact    — smaller layout for dashboard (default false)
 */
export default function StreakWidget({ data, onUpdate, showEditor = false, compact = false }) {
  const { streak, todayCount, dailyGoal, atRisk } = data;
  const done = todayCount >= dailyGoal;

  async function handleGoalSave(n) {
    const fresh = await streakApi.setGoal(n);
    if (onUpdate) onUpdate(fresh);
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4">
        <GoalRing todayCount={todayCount} dailyGoal={dailyGoal} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Today's goal</p>
          <p className="mt-0.5 text-sm text-slate-700">
            {done
              ? <span className="text-green-600 font-semibold">Goal reached! 🎉</span>
              : <span>{dailyGoal - todayCount} more question{dailyGoal - todayCount === 1 ? "" : "s"} to go</span>}
          </p>
          {atRisk && (
            <p className="mt-1 text-xs font-medium text-amber-600 flex items-center gap-1">
              ⚠️ Streak at risk — practice today to keep it!
            </p>
          )}
          {showEditor && (
            <GoalEditor current={dailyGoal} onSave={handleGoalSave} />
          )}
        </div>
        <div className="text-center flex-none">
          <p className="text-3xl font-bold text-slate-900 leading-none">
            {streak}
          </p>
          <p className="text-xl leading-none">🔥</p>
          <p className="mt-0.5 text-xs text-slate-500">day streak</p>
        </div>
      </div>
    );
  }

  // Full layout (used on Home page)
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-5">
      <div className="flex flex-col items-center gap-1">
        <GoalRing todayCount={todayCount} dailyGoal={dailyGoal} />
        <p className="text-xs text-slate-500 mt-1">Today's questions</p>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-3">
          <span className="text-4xl font-bold text-slate-900">{streak}</span>
          <span className="text-3xl">🔥</span>
          <span className="text-sm text-slate-500">
            {streak === 1 ? "day streak" : "day streak"}
          </span>
        </div>

        {atRisk ? (
          <p className="mt-2 text-sm font-medium text-amber-600 flex items-center gap-1">
            ⚠️ Streak at risk — finish today's goal to keep it!
          </p>
        ) : done ? (
          <p className="mt-2 text-sm font-medium text-green-600">
            ✓ Today's goal reached! Keep going.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {dailyGoal - todayCount} more question{dailyGoal - todayCount === 1 ? "" : "s"} to hit today's goal
          </p>
        )}

        {showEditor && (
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">Daily goal</p>
            <GoalEditor current={dailyGoal} onSave={handleGoalSave} />
          </div>
        )}
      </div>
    </div>
  );
}
