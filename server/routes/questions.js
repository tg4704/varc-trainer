const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { getDueCards } = require("../sr");

// Strip server-only fields before sending to client
function sanitise(q) {
  return {
    id: q.id,
    topic: q.topic,
    paragraph: q.paragraph,
    question: q.question,
    type: q.type,
    options: q.options.map((o) => ({ text: o.text })),
  };
}

// GET /api/questions/next?sessionId=X
router.get("/next", authenticate, async (req, res, next) => {
  try {
    const sessionId = parseInt(req.query.sessionId, 10);
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await db.get(
      "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
      [sessionId, req.userId]
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const attemptedRows = await db.all(
      "SELECT question_id FROM attempts WHERE session_id = $1",
      [sessionId]
    );
    const attempted = attemptedRows.map((r) => r.question_id);

    const count = attempted.length;

    // Session quota reached — signal completion
    if (count >= session.num_questions) {
      return res.json({ done: true, answered: count, total: session.num_questions });
    }

    const attemptedSet = new Set(attempted);

    // Review sessions (Phase 15): serve due SR cards in order, most-overdue first.
    if (session.session_type === "review") {
      const dueCards = await getDueCards(req.userId);
      const unseenDue = dueCards.filter((c) => !attemptedSet.has(c.question_id));
      if (unseenDue.length === 0) {
        // No more due cards — end the session early
        return res.json({ done: true, answered: count, total: session.num_questions });
      }
      const pick = await questionsRepo.findById(unseenDue[0].question_id);
      if (!pick) {
        return res.status(500).json({ error: "SR card question not found" });
      }
      return res.json({
        ...sanitise(pick),
        index: count + 1,
        total: session.num_questions,
        repeating: false,
        reviewMode: true,
      });
    }

    // Normal practice session: random unseen, then repeating if exhausted
    const allQuestions = await questionsRepo.listForUser(req.userId);
    if (allQuestions.length === 0) {
      return res.status(500).json({ error: "No questions available" });
    }
    const unseen = allQuestions.filter((q) => !attemptedSet.has(q.id));

    const repeating = unseen.length === 0;
    const pool = repeating ? allQuestions : unseen;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    return res.json({
      ...sanitise(pick),
      index: count + 1,
      total: session.num_questions,
      repeating,
    });
  } catch (e) { next(e); }
});

// POST /api/questions/:id/flag — user reports a problem with a question
router.post("/:id/flag", authenticate, async (req, res, next) => {
  try {
    const VALID_REASONS = ["wrong_answer", "ambiguous", "typo", "poor_quality"];
    const { reason, note = "" } = req.body || {};
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: "reason must be one of: " + VALID_REASONS.join(", ") });
    }

    // Ownership guard: a user may flag global content or their own question, but not
    // probe/flag another user's private question by guessing its id.
    const q = await db.get(
      `SELECT id FROM questions
       WHERE id = $1 AND is_active = 1 AND (source != 'user' OR author_user_id = $2)`,
      [req.params.id, req.userId]
    );
    if (!q) return res.status(404).json({ error: "Question not found" });

    const reasonText = note.trim() ? `${reason}: ${note.trim().slice(0, 300)}` : reason;
    await db.run(
      `INSERT INTO question_flags (question_id, flagged_by_user_id, source, reason)
       VALUES ($1, $2, 'user', $3)`,
      [req.params.id, req.userId, reasonText]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
