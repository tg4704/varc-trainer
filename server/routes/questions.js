const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");

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
router.get("/next", authenticate, (req, res) => {
  const sessionId = parseInt(req.query.sessionId, 10);
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, req.userId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const attempted = db
    .prepare("SELECT question_id FROM attempts WHERE session_id = ?")
    .all(sessionId)
    .map((r) => r.question_id);

  const count = attempted.length;

  // Session quota reached — signal completion
  if (count >= session.num_questions) {
    return res.json({ done: true, answered: count, total: session.num_questions });
  }

  const attemptedSet = new Set(attempted);
  const allQuestions = questionsRepo.listForUser(req.userId);
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
});

module.exports = router;
