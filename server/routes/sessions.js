const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");
const { callModel, DEFAULT_MODEL } = require("../ai/provider");
const { getDueCards } = require("../sr");

const VALID_MODES = ["untimed", "count_up", "countdown"];
const VALID_SCOPES = ["per_question", "per_session"];
const VALID_FEEDBACK_MODES = ["instant", "deferred"];
const VALID_SESSION_TYPES = ["practice", "review"];
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
    sessionType: s.session_type || "practice",
    status: s.status,
    questionIds: s.question_ids ? JSON.parse(s.question_ids) : null,
    createdAt: s.created_at,
    completedAt: s.completed_at,
  };
}

async function getOwnedSession(id, userId) {
  return await db.get(
    "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
}

// POST /api/sessions — create a configured session
router.post("/", authenticate, async (req, res, next) => {
  try {
    let { numQuestions, timerMode, timerScope, timerSeconds, feedbackMode = "instant", sessionType = "practice" } = req.body || {};

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
    if (!VALID_SESSION_TYPES.includes(sessionType)) {
      return res.status(400).json({ error: "Invalid sessionType" });
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

    // Pre-select all questions for this session so order is stable across refreshes.
    let questionIds;
    if (sessionType === "review") {
      const dueCards = await getDueCards(req.userId);
      questionIds = dueCards.slice(0, numQuestions).map((c) => c.question_id);
    } else {
      const allQuestions = await questionsRepo.listForUser(req.userId);
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, numQuestions).map((q) => q.id);
      // If bank is smaller than requested, repeat questions to fill the session
      if (questionIds.length < numQuestions) {
        const extra = [...allQuestions].sort(() => Math.random() - 0.5);
        while (questionIds.length < numQuestions) {
          questionIds.push(extra[questionIds.length % extra.length].id);
        }
      }
    }

    const result = await db.run(
      `INSERT INTO sessions (user_id, num_questions, timer_mode, timer_scope, timer_seconds, feedback_mode, session_type, question_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [req.userId, numQuestions, timerMode, timerScope, timerSeconds, feedbackMode, sessionType, JSON.stringify(questionIds)]
    );

    const session = await getOwnedSession(result.lastId, req.userId);
    res.json({ session: serializeSession(session) });
  } catch (e) { next(e); }
});

// GET /api/sessions — list the user's sessions (most recent first)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const rows = await db.all(
      "SELECT * FROM sessions WHERE user_id = $1 ORDER BY id DESC",
      [req.userId]
    );
    res.json({ sessions: rows.map(serializeSession) });
  } catch (e) { next(e); }
});

// GET /api/sessions/active — the user's most recent active session, if any
router.get("/active", authenticate, async (req, res, next) => {
  try {
    const s = await db.get(
      "SELECT * FROM sessions WHERE user_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1",
      [req.userId]
    );
    res.json({ session: s ? serializeSession(s) : null });
  } catch (e) { next(e); }
});

// GET /api/sessions/:id — config + attempt rows (for the results screen)
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const s = await getOwnedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ error: "Session not found" });

    const attempts = await db.all(
      `SELECT question_id, question_type, topic, selected_option_index,
              correct_option_index, is_correct, trap_option_index, trap_type,
              selected_trap, skipped, time_taken_seconds
       FROM attempts WHERE session_id = $1 ORDER BY id`,
      [s.id]
    );

    res.json({ session: serializeSession(s), attempts });
  } catch (e) { next(e); }
});

// GET /api/sessions/:id/review — full attempt data for the Session Review screen.
// Returns paragraph, question text, options, selected/correct/trap indices, and
// all AI feedback fields. Safe to expose after the session is complete because
// correctIndex/trapIndex come from the attempt record (already seen by the user).
router.get("/:id/review", authenticate, async (req, res, next) => {
  try {
    const s = await getOwnedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ error: "Session not found" });

    const attempts = await db.all(
      `SELECT a.id, a.question_id, a.selected_option_index, a.correct_option_index,
              a.is_correct, a.trap_option_index, a.trap_type, a.selected_trap, a.skipped,
              a.time_taken_seconds, a.reasoning_text, a.mode,
              a.reasoning_score, a.reasoning_feedback, a.correct_explanation,
              a.trap_explanation, a.key_takeaway
       FROM attempts a WHERE a.session_id = $1 ORDER BY a.id`,
      [s.id]
    );

    // Attach question display data (paragraph, question text, options) from DB.
    // We do NOT include correctIndex/trapIndex from the questions table — those
    // come from the attempt's own fields which were set at answer time.
    const enriched = await Promise.all(attempts.map(async (a) => {
      const q = await questionsRepo.findById(a.question_id);
      return {
        ...a,
        paragraph: q?.paragraph ?? "",
        questionText: q?.question ?? "",
        options: q?.options ?? [],
        topic: q?.topic ?? "",
        type: q?.type ?? "",
      };
    }));

    res.json({ session: serializeSession(s), attempts: enriched });
  } catch (e) { next(e); }
});

// POST /api/sessions/:id/batch-evaluate — evaluate all unevaluated analysis
// attempts in this session with a SINGLE Claude call (one JSON array response).
// Falls back to parallel per-question calls if the batch parse fails.
// Idempotent: skips already-evaluated or skipped attempts.

// ── Per-question system prompt (used by the fallback path) ───────────────────
const SINGLE_SYSTEM_PROMPT = `You are a CAT (Common Admission Test) Reading Comprehension coach. A student has answered an RC question. You already know the correct answer. Your job is to evaluate the QUALITY of the student's reasoning process, explain the correct answer precisely, and deconstruct the trap option.

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

// ── Batch system prompt (used by the primary path) ───────────────────────────
const BATCH_SYSTEM_PROMPT = `You are a CAT (Common Admission Test) Reading Comprehension coach evaluating multiple student answers at once.

For EACH numbered question, evaluate the quality of the student's reasoning.

Respond ONLY with a valid JSON array. No preamble, no markdown fences, no text outside the JSON.
The array must have EXACTLY as many elements as there are questions, in the same order.

Each element schema:
{
  "reasoningScore": integer 1-5,
  "reasoningFeedback": string,
  "correctExplanation": string,
  "trapExplanation": string,
  "keyTakeaway": string
}

Reasoning score rubric:
1 — No reasoning shown, or circular
2 — Paraphrased paragraph but didn't connect to option logic
3 — Found right part of paragraph but made a reasoning error
4 — Sound reasoning but missed a nuance or used imprecise language
5 — Identified author's intent, eliminated trap with specific reason, arrived at answer through logic

Rules:
- reasoningFeedback: 2-3 sentences on HOW the student thought, not just whether correct. Be specific.
- correctExplanation: 2-3 sentences. Reference specific lines from source. Explain WHY this option is correct.
- trapExplanation: 2-3 sentences. Name the exact flaw. Be specific per trap type.
- keyTakeaway: One sentence. A generalizable rule for future similar questions.
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

// Build a combined user message for N questions in one prompt
function buildBatchUserMessage(pendingAttempts, questions) {
  return pendingAttempts
    .map((attempt, idx) => {
      const q = questions[idx];
      return `=== QUESTION ${idx + 1} ===\n${buildUserMessage(q, attempt.selected_option_index, attempt.reasoning_text)}`;
    })
    .join("\n\n");
}

// Persist one evaluation result to DB and return the result object
async function saveEvalResult(attemptId, ev) {
  await db.run(
    `UPDATE attempts SET
       reasoning_score = $1,
       reasoning_feedback = $2,
       correct_explanation = $3,
       trap_explanation = $4,
       key_takeaway = $5
     WHERE id = $6`,
    [ev.reasoningScore, ev.reasoningFeedback, ev.correctExplanation, ev.trapExplanation, ev.keyTakeaway, attemptId]
  );
  return {
    attemptId,
    reasoningScore: ev.reasoningScore,
    reasoningFeedback: ev.reasoningFeedback,
    correctExplanation: ev.correctExplanation,
    trapExplanation: ev.trapExplanation,
    keyTakeaway: ev.keyTakeaway,
    aiError: false,
  };
}

async function evaluateOneAttempt(attempt, userId) {
  const q = await questionsRepo.findById(attempt.question_id);
  if (!q) return { attemptId: attempt.id, aiError: true, aiErrorMessage: "Question not found" };

  try {
    const response = await callModel({
      system: SINGLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(q, attempt.selected_option_index, attempt.reasoning_text) }],
    });

    await logApiCall({
      userId,
      route: "/api/sessions/batch-evaluate",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "ok",
    });

    const ev = JSON.parse(response.text);
    return await saveEvalResult(attempt.id, ev);
  } catch (err) {
    console.error("Claude batch error for attempt", attempt.id, err.message);
    await logApiCall({
      userId,
      route: "/api/sessions/batch-evaluate",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      status: "error",
    });
    return { attemptId: attempt.id, aiError: true, aiErrorMessage: "AI feedback unavailable." };
  }
}

router.post("/:id/batch-evaluate", authenticate, async (req, res, next) => {
  try {
  const s = await getOwnedSession(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: "Session not found" });

  // Find all analysis attempts with reasoning but no score yet
  const pending = await db.all(
    `SELECT id, question_id, selected_option_index, reasoning_text
     FROM attempts
     WHERE session_id = $1 AND skipped = 0 AND mode = 'analysis'
           AND reasoning_text IS NOT NULL AND reasoning_score IS NULL`,
    [s.id]
  );

  if (pending.length === 0) {
    return res.json({ results: [] });
  }

  // ── Primary path: single batch call (one API call for all N questions) ──────
  // Look up all questions upfront
  const questions = await Promise.all(pending.map((a) => questionsRepo.findById(a.question_id)));
  const missingIdx = questions.findIndex((q) => !q);
  if (missingIdx !== -1) {
    // A question was deleted — fall through to per-question path which handles nulls gracefully
    console.warn("batch-evaluate: question not found for attempt", pending[missingIdx].id, "— falling back");
  } else {
    try {
      const response = await callModel({
        system: BATCH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildBatchUserMessage(pending, questions) }],
      });

      await logApiCall({
        userId: req.userId,
        route: "/api/sessions/batch-evaluate",
        provider: "openrouter",
        model: DEFAULT_MODEL,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        status: "ok",
      });

      const evaluations = JSON.parse(response.text);
      if (!Array.isArray(evaluations) || evaluations.length !== pending.length) {
        throw new Error(`Expected array of ${pending.length}, got ${Array.isArray(evaluations) ? evaluations.length : typeof evaluations}`);
      }

      const results = await Promise.all(pending.map((attempt, i) => saveEvalResult(attempt.id, evaluations[i])));
      return res.json({ results });
    } catch (batchErr) {
      console.error("batch-evaluate: single-call failed, falling back to parallel:", batchErr.message);
      await logApiCall({
        userId: req.userId,
        route: "/api/sessions/batch-evaluate",
        provider: "openrouter",
        model: DEFAULT_MODEL,
        status: "error",
      });
      // Fall through to per-question fallback below
    }
  }

  // ── Fallback path: parallel per-question calls ───────────────────────────────
  const results = await Promise.all(pending.map((a) => evaluateOneAttempt(a, req.userId)));
  res.json({ results });
  } catch (e) { next(e); }
});

// GET /api/sessions/:id/questions — return all pre-selected questions for this session.
// Strips server-only fields (correctIndex, trapIndex, sourceLines).
// Used by Practice.jsx to prefetch all questions for free navigation.
router.get("/:id/questions", authenticate, async (req, res, next) => {
  try {
    const s = await getOwnedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ error: "Session not found" });

    let questionIds = s.question_ids ? JSON.parse(s.question_ids) : null;
    if (!questionIds || questionIds.length === 0) {
      // Legacy session without pre-selected IDs — generate on the fly
      if (s.session_type === "review") {
        const dueCards = await getDueCards(req.userId);
        questionIds = dueCards.slice(0, s.num_questions).map((c) => c.question_id);
      } else {
        const allQuestions = await questionsRepo.listForUser(req.userId);
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
        questionIds = shuffled.slice(0, s.num_questions).map((q) => q.id);
        while (questionIds.length < s.num_questions && allQuestions.length > 0) {
          questionIds.push(allQuestions[questionIds.length % allQuestions.length].id);
        }
      }
    }

    const questions = await Promise.all(questionIds.map((id) => questionsRepo.findById(id)));
    const sanitised = questions.map((q, i) => q ? {
      id: q.id,
      topic: q.topic,
      paragraph: q.paragraph,
      question: q.question,
      type: q.type,
      options: q.options.map((o) => ({ text: o.text })),
      index: i + 1,
      total: questionIds.length,
    } : null).filter(Boolean);

    res.json({ questions: sanitised });
  } catch (e) { next(e); }
});

// DELETE /api/sessions/:id — discard a session and all its attempts ("never
// happened"). Used when the user chooses "Discard" on leaving a practice session.
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const s = await getOwnedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ error: "Session not found" });
    await db.transaction(async (client) => {
      await client.query("DELETE FROM attempts WHERE session_id = $1", [s.id]);
      await client.query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [s.id, req.userId]);
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/sessions/:id/complete — mark a session finished
router.post("/:id/complete", authenticate, async (req, res, next) => {
  try {
    const s = await getOwnedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ error: "Session not found" });
    if (s.status !== "completed") {
      await db.run(
        "UPDATE sessions SET status = 'completed', completed_at = NOW() WHERE id = $1",
        [s.id]
      );
    }
    res.json({ session: serializeSession(await getOwnedSession(s.id, req.userId)) });
  } catch (e) { next(e); }
});

module.exports = router;
