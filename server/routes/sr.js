// Phase 15 — Spaced repetition API
const express = require("express");
const router = express.Router();
const { authenticate } = require("../auth");
const { getDueCards, getDueCount, getStats } = require("../sr");

// GET /api/sr/queue — due card count + ordered question IDs
router.get("/queue", authenticate, (req, res) => {
  const due = getDueCards(req.userId);
  res.json({
    dueCount: due.length,
    questionIds: due.map((c) => c.question_id),
  });
});

// GET /api/sr/stats — aggregate stats for the dashboard widget
router.get("/stats", authenticate, (req, res) => {
  const stats = getStats(req.userId);
  res.json({
    totalCards: stats.total_cards || 0,
    dueNow: stats.due_now || 0,
    graduated: stats.graduated || 0,
    avgBucket: stats.avg_bucket,
  });
});

module.exports = router;
