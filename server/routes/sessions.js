const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const Anthropic = require("@anthropic-ai/sdk");
const { logApiCall } = require("../ai/apiLog");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_MODES = ["untimed", "count_up", "countdown"];
const VALID_SCOPES = ["per_question", "per_session"];
const VALID_FEEDBACK_MODES = ["instant", "deferred"];
const MAX_QUESTIONS = 25;

const LETTERS = ["A", "B", "C", "D"];

function serializeSession(s) {
  return {
    id: s.id,
    numQuestions: s.num_questions,
    timerMode: s.timer_mode,
    timerScope: s.timer_scope,
    timerSeconds: s.timer_seconds,
    feedbackMode: s.feedback_mode || "instant",
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
  let { numQuestions, timerMode, timerScope, timerSeconds, feedbackMode = "instant" } = req.body || {};

  numQuestions = parseInt(numQuestions, 10);
  if (!numQuestions || numQuestions < 1 || numQuestions > MAX_QUESTIONS) {
    return res.status(400).json({ error: `numQuestions must be between 1 and ${MAX_QUESTIONS}` });
  }
  if (!VALID_MODES.includes(timerMode)) {
    return res.status(400).json({ error: "Invalid timerMode" });
  }
  if (!VALID_FEEDBACK_MODES.includes(feedbackMode)) {
    return res.status(400).json({ error: "Invalid feedbackMode" });
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
    // Timed sessions always defer — override any passed value
    feedbackMode = "deferred";
  }

  const result = db
    .prepare(
      `INSERT INTO sessions (user_id, num_questions, timer_mode, timer_scope, timer_seconds, feedback_mode)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, numQuestions, timerMode, timerScope, timerSeconds, feedbackMode);

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

// GET /api/sessions/:id/review — full attempt data for the Session Review screen.
// Returns paragraph, question text, options, selected/correct/trap indices, and
// all AI feedback fields. Safe to expose after the session is complete because
// correctIndex/trapIndex come from the attempt record (already seen by the user).
router.get("/:id/review", authenticate, (req, res) => {
  const s = getOwnedSession(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: "Session not found" });

  const attempts = db
    .prepare(
      `SELECT a.id, a.question_id, a.selected_option_index, a.correct_option_index,
              a.is_correct, a.trap_option_index, a.trap_type, a.selected_trap, a.skipped,
              a.time_taken_seconds, a.reasoning_text, a.mode,
              a.reasoning_score, a.reasoning_feedback, a.correct_explanation,
              a.trap_explanation, a.key_takeaway
       FROM attempts a WHERE a.session_id = ? ORDER BY a.id`
    )
    .all(s.id);

  // Attach question display data (paragraph, question text, options) from DB.
  // We do NOT include correctIndex/trapIndex from the questions table — those
  // come from the attempt's own fields which were set at answer time.
  const enriched = attempts.map((a) => {
    const q = questionsRepo.findById(a.question_id);
    return {
      ...a,
      paragraph: q?.paragraph ?? "",
      questionText: q?.question ?? "",
      options: q?.options ?? [],
      topic: q?.topic ?? "",
      type: q?.type ?? "",
    };
  });

  res.json({ session: serializeSession(s), attempts: enriched });
});

// POST /api/sessions/:id/batch-evaluate — evaluate all unevaluated analysis
// attempts in this session in parallel. Idempotent: skips already-evaluated
// or skipped attempts. Returns per-attempt results keyed by attempt ID.
const SYSTEM_PROMPT = `You are a CAT (Common Admission Test) Reading Comprehension coach. A student has answered an RC question. You already know the correct answer. Your job is to evaluate the QUALITY of the student's reasoning process, explain the correct answer precisely, and deconstruct the trap option.

Respond ONLY with a valid JSON object. No preamble, no markdown fences, no text outside the JSON.

JSON schema:
{
  "reasoningScore": integer 1-5,
  "reasoningFeedback": string,
  "correctExplanation": string,
  "trapExplanation": string,
  "keyTakeaway": string
}

Reasoning score rubric:
1 — No reasoning shown, or circular ("I chose this because it seemed right")
2 — Paraphrased the paragraph but didn't connect it to option logic
3 — Found the right part of the paragraph but made a reasoning error connecting it to the option
4 — Sound reasoning but missed a nuance or used imprecise language
5 — Identified the author's intent, eliminated the trap with a specific reason, arrived at answer through logic

Rules for your response:
- reasoningFeedback: 2-3 sentences on HOW the student thought, not just whether they were right. Be specific.
- correctExplanation: 2-3 sentences. Reference specific lines from the source excerpt. Explain WHY this option is correct, not just that it is.
- trapExplanation: 2-3 sentences. Name the exact flaw. For too_extreme: which word makes it extreme. For out_of_scope: what concept is introduced that wasn't in the paragraph. For real_but_unstated: what the paragraph actually says instead. For partially_correct: what the option gets right and what it misses.
- keyTakeaway: One sentence. A generalizable rule the student can apply to future similar questions.
- Never be vague. Always reference specific words from the options or paragraph.`;

function buildUserMessage(q, selectedIndex, reasoningText) {
  const trapTypeMeanings = {
    too_extreme: "the option uses absolute language (always/never/only/completely) that the paragraph does not support",
    out_of_scope: "introduces a concept or claim not present in the paragraph",
    real_but_unstated: "may be true in the world but the paragraph does not say or imply it",
    partially_correct: "captures part of the author's point but misses a key qualification or nuance",
  };

  const optionLines = q.options.map((o, i) => `${LETTERS[i]}) ${o.text}`).join("\n");
  const trapSection =
    q.trapIndex != null
      ? `TRAP OPTION: Option ${LETTERS[q.trapIndex]} — "${q.options[q.trapIndex].text}"
TRAP TYPE: ${q.trapType}
TRAP TYPE MEANINGS:
- too_extreme: ${trapTypeMeanings.too_extreme}
- out_of_scope: ${trapTypeMeanings.out_of_scope}
- real_but_unstated: ${trapTypeMeanings.real_but_unstated}
- partially_correct: ${trapTypeMeanings.partially_correct}`
      : "";

  return `PARAGRAPH:
${q.paragraph}

SOURCE LINES (where the answer comes from):
${q.sourceLines}

QUESTION:
${q.question}

QUESTION TYPE: ${q.type}

OPTIONS:
${optionLines}

CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} — "${q.options[q.correctIndex].text}"
${trapSection}

STUDENT SELECTED: Option ${LETTERS[selectedIndex]}
STUDENT'S REASONING:
${reasoningText}`;
}

async function evaluateOneAttempt(attempt, userId) {
  const q = questionsRepo.findById(attempt.question_id);
  if (!q) return { attemptId: attempt.id, aiError: true, aiErrorMessage: "Question not found" };

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(q, attempt.selected_option_index, attempt.reasoning_text) }],
    });

    logApiCall({
      userId,
      route: "/api/sessions/batch-evaluate",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      status: "ok",
    });

    const ev = JSON.parse(response.content[0].text);

    db.prepare(
      `UPDATE attempts SET
         reasoning_score = ?,
         reasoning_feedback = ?,
         correct_explanation = ?,
         trap_explanation = ?,
         key_takeaway = ?
       WHERE id = ?`
    ).run(ev.reasoningScore, ev.reasoningFeedback, ev.correctExplanation, ev.trapExplanation, ev.keyTakeaway, attempt.id);

    return {
      attemptId: attempt.id,
      reasoningScore: ev.reasoningScore,
      reasoningFeedback: ev.reasoningFeedback,
      correctExplanation: ev.correctExplanation,
      trapExplanation: ev.trapExplanation,
      keyTakeaway: ev.keyTakeaway,
      aiError: false,
    };
  } catch (err) {
    console.error("Claude batch error for attempt", attempt.id, err.message);
    logApiCall({
      userId,
      route: "/api/sessions/batch-evaluate",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      status: "error",
    });
    return { attemptId: attempt.id, aiError: true, aiErrorMessage: "AI feedback unavailable." };
  }
}

router.post("/:id/batch-evaluate", authenticate, async (req, res) => {
  const s = getOwnedSession(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: "Session not found" });

  // Find all analysis attempts with reasoning but no score yet
  const pending = db
    .prepare(
      `SELECT id, question_id, selected_option_index, reasoning_text
       FROM attempts
       WHERE session_id = ? AND skipped = 0 AND mode = 'analysis'
             AND reasoning_text IS NOT NULL AND reasoning_score IS NULL`
    )
    .all(s.id);

  if (pending.length === 0) {
    return res.json({ results: [] });
  }

  // Run all evaluations in parallel
  const results = await Promise.all(pending.map((a) => evaluateOneAttempt(a, req.userId)));
  res.json({ results });
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
