// Phase 15 — Spaced repetition helpers.
// Bucket intervals (days): bucket 0 = tomorrow, ..., bucket 4 = 30 days.
// Wrong answer → reset to bucket 0.
// Correct answer → advance bucket (capped at 4).
// First correct ever → no card created (no need to review what you got right cold).
// First wrong ever  → card created, due tomorrow.
const db = require("./db");

const INTERVALS = [1, 3, 7, 14, 30]; // days per bucket
const MAX_BUCKET = INTERVALS.length - 1;

function isoFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// Call after every non-skipped attempt.
function updateCard(userId, questionId, isCorrect) {
  const card = db
    .prepare("SELECT * FROM sr_cards WHERE user_id = ? AND question_id = ?")
    .get(userId, questionId);

  if (!card) {
    if (isCorrect) return; // First attempt correct — no review needed
    // First attempt wrong — schedule for tomorrow
    db.prepare(
      `INSERT INTO sr_cards (user_id, question_id, bucket, due_at, last_seen_at, last_correct, total_attempts, total_correct)
       VALUES (?, ?, 0, ?, ?, 0, 1, 0)`
    ).run(userId, questionId, isoFromNow(1), nowIso());
    return;
  }

  const newBucket = isCorrect ? Math.min(card.bucket + 1, MAX_BUCKET) : 0;
  const dueAt = isoFromNow(INTERVALS[newBucket]);

  db.prepare(
    `UPDATE sr_cards
     SET bucket = ?, due_at = ?, last_seen_at = ?, last_correct = ?,
         total_attempts = total_attempts + 1,
         total_correct = total_correct + ?
     WHERE id = ?`
  ).run(newBucket, dueAt, nowIso(), isCorrect ? 1 : 0, isCorrect ? 1 : 0, card.id);
}

// Returns ordered list of due question IDs (most overdue first).
function getDueCards(userId) {
  return db
    .prepare(
      `SELECT question_id, bucket, due_at
       FROM sr_cards
       WHERE user_id = ? AND due_at <= datetime('now', 'localtime')
       ORDER BY due_at ASC`
    )
    .all(userId);
}

// Count of cards due now.
function getDueCount(userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM sr_cards
       WHERE user_id = ? AND due_at <= datetime('now', 'localtime')`
    )
    .get(userId).n;
}

// Aggregate stats for the SR dashboard widget.
function getStats(userId) {
  return db
    .prepare(
      `SELECT
         COUNT(*) AS total_cards,
         SUM(CASE WHEN due_at <= datetime('now', 'localtime') THEN 1 ELSE 0 END) AS due_now,
         SUM(CASE WHEN bucket = ${MAX_BUCKET} THEN 1 ELSE 0 END) AS graduated,
         ROUND(AVG(bucket), 1) AS avg_bucket
       FROM sr_cards WHERE user_id = ?`
    )
    .get(userId);
}

module.exports = { updateCard, getDueCards, getDueCount, getStats, INTERVALS, MAX_BUCKET };
