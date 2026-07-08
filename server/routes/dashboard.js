const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const questionsRepo = require("../questionsRepo");

// GET /api/dashboard — aggregate stats across all of the user's sessions.
// Accuracy, trap-pick rate, and per-type/topic/trap breakdowns are computed over
// ANSWERED (non-skipped) attempts.
// Computed fresh on every request: the queries are cheap indexed aggregates and
// any server-side caching here risks showing a stale "0 attempts" snapshot right
// after a session (the exact bug we hit).
// Exported as `handle` so the admin impersonation route can reuse the same
// computation by spoofing req.userId.
async function handle(req, res, next) {
  try {
    const userId = req.userId;

    // Never let the browser cache dashboard JSON either.
    res.set("Cache-Control", "no-store");

    const totals = await db.get(
      `SELECT COUNT(*) AS "totalAttempts",
              COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS "answeredCount",
              COALESCE(SUM(a.is_correct), 0) AS "correctCount",
              COALESCE(SUM(a.selected_trap), 0) AS "trapCount",
              COALESCE(SUM(a.skipped), 0) AS "skippedCount",
              AVG(a.reasoning_score) AS "avgReasoningScore"
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1`,
      [userId]
    );

    const answered = parseInt(totals.answeredCount, 10);
    const accuracy = answered ? totals.correctCount / answered : 0;
    const trapPickRate = answered ? totals.trapCount / answered : 0;

    // ── By question type (answered only) ──
    const byType = {};
    const byTypeRows = await db.all(
      `SELECT a.question_type AS type,
              COUNT(*) AS attempts,
              COALESCE(SUM(a.is_correct), 0) AS correct,
              COALESCE(SUM(a.selected_trap), 0) AS "trapPicked",
              AVG(a.reasoning_score) AS "avgReasoningScore"
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0
       GROUP BY a.question_type`,
      [userId]
    );
    byTypeRows.forEach((r) => {
      byType[r.type] = {
        attempts: parseInt(r.attempts, 10),
        correct: parseInt(r.correct, 10),
        trapPicked: parseInt(r.trapPicked, 10),
        avgReasoningScore: r.avgReasoningScore,
      };
    });

    // ── By topic (answered only) ──
    const byTopic = {};
    const byTopicRows = await db.all(
      `SELECT a.topic,
              COUNT(*) AS attempts,
              COALESCE(SUM(a.is_correct), 0) AS correct
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0
       GROUP BY a.topic`,
      [userId]
    );
    byTopicRows.forEach((r) => {
      byTopic[r.topic] = { attempts: parseInt(r.attempts, 10), correct: parseInt(r.correct, 10) };
    });

    // ── By trap type: encountered vs fell-for (answered only) ──
    const byTrapType = {};
    const byTrapTypeRows = await db.all(
      `SELECT a.trap_type AS "trapType",
              COUNT(*) AS encountered,
              COALESCE(SUM(a.selected_trap), 0) AS "fellFor"
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0 AND a.trap_type IS NOT NULL
       GROUP BY a.trap_type`,
      [userId]
    );
    byTrapTypeRows.forEach((r) => {
      byTrapType[r.trapType] = { encountered: parseInt(r.encountered, 10), fell_for: parseInt(r.fellFor, 10) };
    });

    // weakest type = lowest accuracy (tie → more attempts)
    let weakestType = null;
    let lowestAcc = Infinity;
    for (const [type, s] of Object.entries(byType)) {
      const acc = s.attempts ? s.correct / s.attempts : 1;
      if (acc < lowestAcc || (acc === lowestAcc && weakestType && s.attempts > byType[weakestType].attempts)) {
        lowestAcc = acc;
        weakestType = type;
      }
    }

    // most dangerous trap = highest fell-for rate
    let mostDangerousTrap = null;
    let highestRate = -1;
    for (const [type, s] of Object.entries(byTrapType)) {
      const rate = s.encountered ? s.fell_for / s.encountered : 0;
      if (rate > highestRate) {
        highestRate = rate;
        mostDangerousTrap = type;
      }
    }

    // ── Intuition mode stats ──
    const intuitionRow = await db.get(
      `SELECT
         COUNT(*) AS "totalIntuition",
         COALESCE(SUM(a.intuition_points), 0) AS "totalPoints",
         AVG(a.time_taken_seconds) AS "avgTimeSecs",
         COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS "answeredCount"
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.mode = 'intuition'`,
      [userId]
    );

    // Elimination accuracy: correct eliminations / total eliminations
    const elimRows = await db.all(
      `SELECT a.eliminated_indices, a.correct_option_index
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.mode = 'intuition' AND a.eliminated_indices IS NOT NULL`,
      [userId]
    );

    let totalElim = 0, correctElim = 0;
    for (const row of elimRows) {
      try {
        const indices = JSON.parse(row.eliminated_indices);
        for (const idx of indices) {
          totalElim++;
          if (idx !== row.correct_option_index) correctElim++;
        }
      } catch {}
    }

    const intuitionStats = {
      totalAttempts: parseInt(intuitionRow.totalIntuition, 10),
      totalPoints: parseInt(intuitionRow.totalPoints, 10),
      avgTimeSecs: intuitionRow.avgTimeSecs,
      eliminationAccuracy: totalElim > 0 ? correctElim / totalElim : null,
    };

    // ── Recent attempts (last 10, most recent first) ──
    const recentRows = await db.all(
      `SELECT a.* FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1
       ORDER BY a.id DESC LIMIT 10`,
      [userId]
    );
    const recentAttempts = await Promise.all(recentRows.map(async (a) => {
      const q = await questionsRepo.findById(a.question_id);
      const snippet = q
        ? q.question.split(/\s+/).slice(0, 8).join(" ") + "…"
        : a.question_id;
      return {
        questionId: a.question_id,
        questionSnippet: snippet,
        question: q ? q.question : null,
        paragraph: q ? q.paragraph : null,
        options: q ? q.options.map((o) => ({ text: o.text })) : [],
        type: a.question_type,
        topic: a.topic,
        selectedOptionIndex: a.selected_option_index,
        correctOptionIndex: a.correct_option_index,
        trapOptionIndex: a.trap_option_index,
        isCorrect: a.is_correct === 1,
        selectedTrap: a.selected_trap === 1,
        skipped: a.skipped === 1,
        trapType: a.trap_type,
        reasoningText: a.reasoning_text,
        reasoningScore: a.reasoning_score,
        reasoningFeedback: a.reasoning_feedback,
        correctExplanation: a.correct_explanation,
        trapExplanation: a.trap_explanation,
        keyTakeaway: a.key_takeaway,
        timeTakenSeconds: a.time_taken_seconds,
        createdAt: a.created_at,
      };
    }));

    // ── Recent sessions (most recent first) — mirror of the copy in index.js ──
    const recentSessionRows = await db.all(
      `SELECT s.id, s.created_at, s.completed_at, s.status, s.num_questions,
              COUNT(a.id) FILTER (WHERE a.skipped = 0) AS answered,
              COALESCE(SUM(a.is_correct), 0) AS correct
       FROM sessions s JOIN attempts a ON a.session_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.id DESC
       LIMIT 8`,
      [userId]
    );
    const recentSessions = recentSessionRows.map((s) => ({
      id: s.id, createdAt: s.created_at, completedAt: s.completed_at, status: s.status,
      numQuestions: parseInt(s.num_questions, 10),
      answered: parseInt(s.answered, 10), correct: parseInt(s.correct, 10),
    }));

    const responseData = {
      totalAttempts: parseInt(totals.totalAttempts, 10),
      answeredCount: answered,
      correctCount: parseInt(totals.correctCount, 10),
      skippedCount: parseInt(totals.skippedCount, 10),
      accuracy,
      trapPickRate,
      avgReasoningScore: totals.avgReasoningScore,
      byType,
      byTopic,
      byTrapType,
      weakestType,
      mostDangerousTrap,
      recentAttempts,
      recentSessions,
      intuitionStats,
    };

    res.json(responseData);
  } catch (e) { next(e); }
}

// Kept as a no-op so existing callers (attempts.js, evaluate.js) don't break.
// The dashboard no longer caches, so there is nothing to invalidate.
function clearCache() {}

const TREND_RANGE_DAYS = { "7d": 7, "30d": 30, all: 3650 };
const TREND_MAX_POINTS = 60; // safeguard for "all" on a long-lived account

// GET /api/dashboard/trend?range=7d|30d|all — daily accuracy over answered
// (non-skipped) attempts, one point per day that has at least one attempt.
router.get("/trend", authenticate, async (req, res, next) => {
  try {
    const range = TREND_RANGE_DAYS[req.query.range] ? req.query.range : "30d";
    const days = TREND_RANGE_DAYS[range];

    const rows = await db.all(
      `SELECT DATE(a.created_at) AS day,
              COUNT(*) AS answered,
              COALESCE(SUM(a.is_correct), 0) AS correct
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0
         AND a.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(a.created_at)
       ORDER BY day ASC`,
      [req.userId]
    );

    const trimmed = rows.slice(-TREND_MAX_POINTS);
    res.json({
      range,
      days: trimmed.map((r) => ({
        date: r.day,
        answered: parseInt(r.answered, 10),
        accuracy: r.answered ? r.correct / r.answered : 0,
      })),
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/heatmap — raw per-day answered counts for the last ~6
// months (183 days). Client lays them out as a GitHub-style contribution grid.
router.get("/heatmap", authenticate, async (req, res, next) => {
  try {
    // Drills (attempts) + Coach (coach_attempts), bucketed by UTC date as a
    // 'YYYY-MM-DD' STRING (a real date column comes back as a JS Date whose
    // String() form never matches the client's ISO keys — the reason the
    // heatmap always read 0). See the authoritative copy in server/index.js.
    const rows = await db.all(
      `SELECT day, SUM(cnt) AS count FROM (
         SELECT to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
         FROM attempts a
         JOIN sessions s ON a.session_id = s.id
         WHERE s.user_id = $1 AND a.skipped = 0
           AND a.created_at >= NOW() - INTERVAL '183 days'
         GROUP BY 1
         UNION ALL
         SELECT to_char(ca.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
         FROM coach_attempts ca
         JOIN coach_sessions cs ON ca.coach_session_id = cs.id
         WHERE cs.user_id = $1
           AND ca.created_at >= NOW() - INTERVAL '183 days'
         GROUP BY 1
       ) t
       GROUP BY day`,
      [req.userId]
    );
    const byDate = {};
    rows.forEach((r) => { byDate[r.day] = Number(r.count); });

    // Dense oldest-first array of the last 183 days so the client can lay out
    // a stable weekday-row grid regardless of which days have zero activity.
    const out = [];
    for (let i = 182; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, count: byDate[iso] || 0 });
    }
    res.json({ days: out });
  } catch (e) { next(e); }
});

router.get("/", authenticate, handle);

module.exports = router;
module.exports.handle = handle;
module.exports.clearCache = clearCache;
