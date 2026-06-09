// Phase 15 — Spaced repetition API
const express = require("express");
const router = express.Router();
const { authenticate } = require("../auth");
const { getDueCards, getDueCount, getStats } = require("../sr");

// GET /api/sr/queue — due card count + ordered question IDs
router.get("/queue", authenticate, async (req, res, next) => {
  try {
    const due = await getDueCards(req.userId);
    res.json({
      dueCount: due.length,
      questionIds: due.map((c) => c.question_id),
    });
  } catch (e) { next(e); }
});

// GET /api/sr/stats — aggregate stats for the dashboard widget
router.get("/stats", authenticate, async (req, res, next) => {
  try {
    const stats = await getStats(req.userId);
    res.json({
      totalCards: parseInt(stats.total_cards, 10) || 0,
      dueNow: parseInt(stats.due_now, 10) || 0,
      graduated: parseInt(stats.graduated, 10) || 0,
      avgBucket: stats.avg_bucket,
    });
  } catch (e) { next(e); }
});

module.exports = router;
