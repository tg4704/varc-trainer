// Phase 16 — Streaks & Daily Goals
// Streak = consecutive days where the user answered >= daily_goal non-skipped questions.
// All dates computed in UTC (server has no user timezone; acceptable for MVP).
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Build a map of { 'YYYY-MM-DD': count } for the user's non-skipped attempts.
async function buildDayMap(userId) {
  const rows = await db.all(
    `SELECT DATE(a.created_at) AS day, COUNT(*) AS cnt
     FROM attempts a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.user_id = $1 AND a.skipped = 0
     GROUP BY DATE(a.created_at)`,
    [userId]
  );
  const map = {};
  for (const r of rows) map[r.day] = parseInt(r.cnt, 10);
  return map;
}

// Compute the current streak and today's progress.
async function computeStreak(userId) {
  const user = await db.get("SELECT daily_goal FROM users WHERE id = $1", [userId]);
  const dailyGoal = user?.daily_goal ?? 10;

  const dayMap = await buildDayMap(userId);
  const today = todayUTC();
  const yesterday = subtractDays(today, 1);

  const todayCount = dayMap[today] || 0;
  const todayDone = todayCount >= dailyGoal;

  // Determine the most recent completed day to start the streak walk from.
  let startDay = null;
  if (todayDone) {
    startDay = today;
  } else if ((dayMap[yesterday] || 0) >= dailyGoal) {
    startDay = yesterday; // today not done yet — streak is at risk
  }

  let streak = 0;
  if (startDay) {
    let cursor = startDay;
    while ((dayMap[cursor] || 0) >= dailyGoal) {
      streak++;
      cursor = subtractDays(cursor, 1);
    }
  }

  const atRisk = streak > 0 && !todayDone;

  return { streak, todayCount, dailyGoal, atRisk };
}

// GET /api/streak
router.get("/", authenticate, async (req, res, next) => {
  try {
    res.json(await computeStreak(req.userId));
  } catch (e) { next(e); }
});

// PATCH /api/streak/goal — update the user's daily goal
router.patch("/goal", authenticate, async (req, res, next) => {
  try {
    const { dailyGoal } = req.body || {};
    const n = parseInt(dailyGoal, 10);
    if (!n || n < 1 || n > 50) {
      return res.status(400).json({ error: "dailyGoal must be between 1 and 50" });
    }
    await db.run("UPDATE users SET daily_goal = $1 WHERE id = $2", [n, req.userId]);
    res.json(await computeStreak(req.userId));
  } catch (e) { next(e); }
});

module.exports = router;
