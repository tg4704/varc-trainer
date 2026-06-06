const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const questionsRepo = require("../questionsRepo");

// Simple 30-second TTL cache keyed by userId
const cache = new Map();
const CACHE_TTL = 30_000;

// GET /api/dashboard — aggregate stats across all of the user's sessions.
// Accuracy, trap-pick rate, and per-type/topic/trap breakdowns are computed over
// ANSWERED (non-skipped) attempts.
// Exported as `handle` so the admin impersonation route can reuse the same
// computation by spoofing req.userId.
function handle(req, res) {
  const userId = req.userId;
  const skipCache = req.adminImpersonating === true;

  const cached = cache.get(userId);
  if (!skipCache && cached && Date.now() - cached.at < CACHE_TTL) {
    return res.json(cached.data);
  }

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS totalAttempts,
              COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS answeredCount,
              COALESCE(SUM(a.is_correct), 0) AS correctCount,
              COALESCE(SUM(a.selected_trap), 0) AS trapCount,
              COALESCE(SUM(a.skipped), 0) AS skippedCount,
              AVG(a.reasoning_score) AS avgReasoningScore
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = ?`
    )
    .get(userId);

  const answered = totals.answeredCount;
  const accuracy = answered ? totals.correctCount / answered : 0;
  const trapPickRate = answered ? totals.trapCount / answered : 0;

  // ── By question type (answered only) ──
  const byType = {};
  db.prepare(
    `SELECT a.question_type AS type,
            COUNT(*) AS attempts,
            COALESCE(SUM(a.is_correct), 0) AS correct,
            COALESCE(SUM(a.selected_trap), 0) AS trapPicked,
            AVG(a.reasoning_score) AS avgReasoningScore
     FROM attempts a
     JOIN sessions s ON a.session_id = s.id
     WHERE s.user_id = ? AND a.skipped = 0
     GROUP BY a.question_type`
  )
    .all(userId)
    .forEach((r) => {
      byType[r.type] = {
        attempts: r.attempts,
        correct: r.correct,
        trapPicked: r.trapPicked,
        avgReasoningScore: r.avgReasoningScore,
      };
    });

  // ── By topic (answered only) ──
  const byTopic = {};
  db.prepare(
    `SELECT a.topic,
            COUNT(*) AS attempts,
            COALESCE(SUM(a.is_correct), 0) AS correct
     FROM attempts a
     JOIN sessions s ON a.session_id = s.id
     WHERE s.user_id = ? AND a.skipped = 0
     GROUP BY a.topic`
  )
    .all(userId)
    .forEach((r) => {
      byTopic[r.topic] = { attempts: r.attempts, correct: r.correct };
    });

  // ── By trap type: encountered vs fell-for (answered only) ──
  const byTrapType = {};
  db.prepare(
    `SELECT a.trap_type AS trapType,
            COUNT(*) AS encountered,
            COALESCE(SUM(a.selected_trap), 0) AS fellFor
     FROM attempts a
     JOIN sessions s ON a.session_id = s.id
     WHERE s.user_id = ? AND a.skipped = 0 AND a.trap_type IS NOT NULL
     GROUP BY a.trap_type`
  )
    .all(userId)
    .forEach((r) => {
      byTrapType[r.trapType] = { encountered: r.encountered, fell_for: r.fellFor };
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
  const intuitionRow = db
    .prepare(
      `SELECT
         COUNT(*) AS totalIntuition,
         COALESCE(SUM(a.intuition_points), 0) AS totalPoints,
         AVG(a.time_taken_seconds) AS avgTimeSecs,
         COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS answeredCount
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = ? AND a.mode = 'intuition'`
    )
    .get(userId);

  // Elimination accuracy: correct eliminations / total eliminations
  const elimRows = db
    .prepare(
      `SELECT a.eliminated_indices, a.correct_option_index
       FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = ? AND a.mode = 'intuition' AND a.eliminated_indices IS NOT NULL`
    )
    .all(userId);

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
    totalAttempts: intuitionRow.totalIntuition,
    totalPoints: intuitionRow.totalPoints,
    avgTimeSecs: intuitionRow.avgTimeSecs,
    eliminationAccuracy: totalElim > 0 ? correctElim / totalElim : null,
  };

  // ── Recent attempts (last 10, most recent first) ──
  const recentAttempts = db
    .prepare(
      `SELECT a.* FROM attempts a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = ?
       ORDER BY a.id DESC LIMIT 10`
    )
    .all(userId)
    .map((a) => {
      const q = questionsRepo.findById(a.question_id);
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
        reasoningScore: a.reasoning_score,
        reasoningFeedback: a.reasoning_feedback,
        correctExplanation: a.correct_explanation,
        trapExplanation: a.trap_explanation,
        keyTakeaway: a.key_takeaway,
        timeTakenSeconds: a.time_taken_seconds,
      };
    });

  const responseData = {
    totalAttempts: totals.totalAttempts,
    answeredCount: answered,
    correctCount: totals.correctCount,
    skippedCount: totals.skippedCount,
    accuracy,
    trapPickRate,
    avgReasoningScore: totals.avgReasoningScore,
    byType,
    byTopic,
    byTrapType,
    weakestType,
    mostDangerousTrap,
    recentAttempts,
    intuitionStats,
  };

  if (!skipCache) cache.set(userId, { data: responseData, at: Date.now() });
  res.json(responseData);
}

router.get("/", authenticate, handle);

module.exports = router;
module.exports.handle = handle;
