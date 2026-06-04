const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

const VALID_MODES = ["untimed", "count_up", "countdown"];
const VALID_SCOPES = ["per_question", "per_session"];
const MAX_QUESTIONS = 25;

function serializeSession(s) {
  return {
    id: s.id,
    numQuestions: s.num_questions,
    timerMode: s.timer_mode,
    timerScope: s.timer_scope,
    timerSeconds: s.timer_seconds,
    status: s.status,
    createdAt: s.created_at,
    completedAt: s.completed_at,
  };
}

function getOwnedSession(id, userId) {
  return db.prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?").get(id, userId);
}

// POST /api/sessions — create a configured session
router.post("/", authenticate, (req, res) => {
  let { numQuestions, timerMode, timerScope, timerSeconds } = req.body || {};

  numQuestions = parseInt(numQuestions, 10);
  if (!numQuestions || numQuestions < 1 || numQuestions > MAX_QUESTIONS) {
    return res.status(400).json({ error: `numQuestions must be between 1 and ${MAX_QUESTIONS}` });
  }
  if (!VALID_MODES.includes(timerMode)) {
    return res.status(400).json({ error: "Invalid timerMode" });
  }

  if (timerMode === "untimed") {
    timerScope = null;
    timerSeconds = null;
  } else {
    if (!VALID_SCOPES.includes(timerScope)) {
      return res.status(400).json({ error: "timerScope is required for timed sessions" });
    }
    if (timerMode === "countdown") {
      timerSeconds = parseInt(timerSeconds, 10);
      if (!timerSeconds || timerSeconds < 5) {
        return res.status(400).json({ error: "timerSeconds (>= 5) is required for a countdown" });
      }
    } else {
      timerSeconds = null; // count_up has no fixed duration
    }
  }

  const result = db
    .prepare(
      `INSERT INTO sessions (user_id, num_questions, timer_mode, timer_scope, timer_seconds)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.userId, numQuestions, timerMode, timerScope, timerSeconds);

  const session = getOwnedSession(result.lastInsertRowid, req.userId);
  res.json({ session: serializeSession(session) });
});

// GET /api/sessions — list the user's sessions (most recent first)
router.get("/", authenticate, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY id DESC")
    .all(req.userId);
  res.json({ sessions: rows.map(serializeSession) });
});

// GET /api/sessions/active — the user's most recent active session, if any
router.get("/active", authenticate, (req, res) => {
  const s = db
    .prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .get(req.userId);
  res.json({ session: s ? serializeSession(s) : null });
});

// GET /api/sessions/:id — config + attempt rows (for the results screen)
router.get("/:id", authenticate, (req, res) => {
  const s = getOwnedSession(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: "Session not found" });

  const attempts = db
    .prepare(
      `SELECT question_id, question_type, topic, selected_option_index,
              correct_option_index, is_correct, trap_option_index, trap_type,
              selected_trap, skipped, time_taken_seconds
       FROM attempts WHERE session_id = ? ORDER BY id`
    )
    .all(s.id);

  res.json({ session: serializeSession(s), attempts });
});

// POST /api/sessions/:id/complete — mark a session finished
router.post("/:id/complete", authenticate, (req, res) => {
  const s = getOwnedSession(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: "Session not found" });
  if (s.status !== "completed") {
    db.prepare(
      "UPDATE sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(s.id);
  }
  res.json({ session: serializeSession(getOwnedSession(s.id, req.userId)) });
});

module.exports = router;
