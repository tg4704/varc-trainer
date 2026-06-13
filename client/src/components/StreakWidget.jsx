// Phase 16 — Streak & daily-goal widget.
// Shows a circular progress ring (today's count vs goal), current streak,
// and an at-risk warning when the streak will break if today stays incomplete.
import { useState } from "react";
import { streak as streakApi } from "../api.js";
import Icon from "./Icon.jsx";

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
        stroke="var(--surface-2)"
        strokeWidth="8"
      />
      {/* Progress arc — rotated so it starts at the top */}
      <circle
        cx="50"
        cy="50"
        r={RING_R}
        fill="none"
        stroke={done ? "var(--green)" : "var(--teal)"}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.5s ease" }}
      />
      {/* Centre text */}
      <text
        x="50"
        y="46"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text)"
        style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)" }}
      >
        {todayCount}
      </text>
      <text
        x="50"
        y="63"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-2)"
        style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
      >
        / {dailyGoal}
      </text>
    </svg>
  );
}

// Inline goal editor — shows a stepper + save button.
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

  const stepperBtn =
    "w-7 h-7 rounded-md border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground text-sm leading-none transition-colors";

  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        type="button"
        onClick={() => setVal((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
        className={stepperBtn}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={50}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-14 rounded-md border border-border bg-background px-1 py-1 text-center text-sm text-foreground mono focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={() => setVal((v) => String(Math.min(50, parseInt(v, 10) + 1)))}
        className={stepperBtn}
      >
        +
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        className="btn btn-primary ml-1 px-3 py-1.5 text-xs"
      >
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}

// Streak count + flame icon, sized by `big`.
function StreakCount({ streak, big = false }) {
  return (
    <div className={big ? "flex items-center gap-2.5" : "text-center flex-none"}>
      <span className={`mono font-bold text-foreground leading-none ${big ? "text-4xl" : "text-3xl"}`}>
        {streak}
      </span>
      <span style={{ color: streak > 0 ? "var(--amber)" : "var(--text-muted)" }} className={big ? "" : "flex justify-center mt-1"}>
        <Icon name="flame" size={big ? 26 : 20} />
      </span>
      <span className={`muted ${big ? "text-sm" : "block mt-0.5 text-xs"}`}>day streak</span>
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
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
        <GoalRing todayCount={todayCount} dailyGoal={dailyGoal} />
        <div className="flex-1 min-w-0">
          <p className="text-xs muted uppercase tracking-[0.08em] font-semibold">Today's goal</p>
          <p className="mt-1 text-sm text-foreground">
            {done
              ? <span style={{ color: "var(--green)" }} className="font-semibold">Goal reached.</span>
              : <span>{dailyGoal - todayCount} more question{dailyGoal - todayCount === 1 ? "" : "s"} to go</span>}
          </p>
          {atRisk && (
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--amber)" }}>
              Streak at risk — practice today to keep it.
            </p>
          )}
          {showEditor && (
            <GoalEditor current={dailyGoal} onSave={handleGoalSave} />
          )}
        </div>
        <StreakCount streak={streak} />
      </div>
    );
  }

  // Full layout (used on Home page)
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-border bg-card px-6 py-5">
      <div className="flex flex-col items-center gap-1">
        <GoalRing todayCount={todayCount} dailyGoal={dailyGoal} />
        <p className="text-xs muted mt-1">Today's questions</p>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start">
          <StreakCount streak={streak} big />
        </div>

        {atRisk ? (
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--amber)" }}>
            Streak at risk — finish today's goal to keep it.
          </p>
        ) : done ? (
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--green)" }}>
            Today's goal reached. Keep going.
          </p>
        ) : (
          <p className="mt-2 text-sm muted">
            {dailyGoal - todayCount} more question{dailyGoal - todayCount === 1 ? "" : "s"} to hit today's goal
          </p>
        )}

        {showEditor && (
          <div className="mt-3">
            <p className="text-xs muted mb-1">Daily goal</p>
            <GoalEditor current={dailyGoal} onSave={handleGoalSave} />
          </div>
        )}
      </div>
    </div>
  );
}
