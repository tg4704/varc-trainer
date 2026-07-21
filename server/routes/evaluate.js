const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");
const { callModel, resolveModels, DEFAULT_MODEL, describeError } = require("../ai/provider");
const { requireEntitlement, attachTier } = require("../lib/entitlements");
const { clearCache: clearDashCache } = require("./dashboard");
const { buildTrapMeaningsBlock } = require("../lib/trapMeanings");
const { aiLimiter } = require("../lib/rateLimiters");
const { validateBody } = require("../lib/validate");
const { evaluateSchema } = require("../lib/schemas");
const { getPrompt } = require("../ai/prompts");
const { extractJSON } = require("../lib/extractJSON");

const LETTERS = ["A", "B", "C", "D"];

function buildUserMessage(q, selectedIndex, reasoningText, quotedLines) {
  const optionLines = q.options.map((o, i) => `${LETTERS[i]}) ${o.text}`).join("\n");

  // Reference meanings for every archetype present among this question's options,
  // not just the primary trap - imported AI questions tag every wrong option.
  const presentTrapTypes = [...new Set(q.options.map((o) => o.trapType).filter(Boolean))];

  const trapSection =
    q.trapIndex != null
      ? `TRAP OPTION: Option ${LETTERS[q.trapIndex]} - "${q.options[q.trapIndex].text}"
TRAP TYPE: ${q.trapType}
TRAP TYPE MEANINGS:
${buildTrapMeaningsBlock(presentTrapTypes)}`
      : "";

  const quotedSection =
    Array.isArray(quotedLines) && quotedLines.length > 0
      ? `\nSTUDENT QUOTED LINES (text they explicitly cited as evidence):\n${quotedLines.map((l) => `- "${l}"`).join("\n")}`
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

CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} - "${q.options[q.correctIndex].text}"
${trapSection}

STUDENT SELECTED: Option ${LETTERS[selectedIndex]}${quotedSection}
STUDENT'S REASONING:
${reasoningText}`;
}

// POST /api/attempts/evaluate - analysis mode with AI reasoning evaluation.
// Pass deferred:true to save the attempt without calling Claude (for timed sessions).
router.post("/evaluate", authenticate, attachTier, aiLimiter, requireEntitlement("drills"), validateBody(evaluateSchema), async (req, res) => {
  const {
    sessionId,
    questionId,
    selectedOptionIndex,
    reasoningText,
    timeTakenSeconds,
    mode = "analysis",
    quotedLines,
    deferred = false,
  } = req.body || {};

  if (sessionId == null || !questionId) {
    return res.status(400).json({ error: "sessionId and questionId are required" });
  }
  if (selectedOptionIndex == null) {
    return res.status(400).json({ error: "selectedOptionIndex is required" });
  }
  if (reasoningText && reasoningText.trim().length > 500) {
    return res.status(400).json({ error: "reasoningText must be 500 characters or fewer" });
  }

  const session = await db.get(
    "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
    [sessionId, req.userId]
  );
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const q = await questionsRepo.findById(questionId);
  if (!q) {
    return res.status(404).json({ error: "Question not found" });
  }

  const isCorrect = selectedOptionIndex === q.correctIndex ? 1 : 0;
  const selectedTrap = q.trapIndex != null && selectedOptionIndex === q.trapIndex ? 1 : 0;

  // Save attempt BEFORE calling Claude - never lose the attempt if the API fails
  const result = await db.run(
    `INSERT INTO attempts
       (session_id, question_id, question_type, topic,
        selected_option_index, correct_option_index, is_correct,
        trap_option_index, trap_type, selected_trap, skipped,
        reasoning_text, mode, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13) RETURNING id`,
    [
      sessionId, questionId, q.type, q.topic,
      selectedOptionIndex, q.correctIndex, isCorrect,
      q.trapIndex, q.trapType, selectedTrap,
      reasoningText.trim(), mode, timeTakenSeconds ?? null,
    ]
  );

  const base = {
    // attemptId lets the client retry a failed AI evaluation against this
    // saved attempt (POST /:attemptId/retry-evaluation) without re-inserting.
    attemptId: result.lastId,
    isCorrect: isCorrect === 1,
    correctOptionIndex: q.correctIndex,
    trapOptionIndex: q.trapIndex,
    trapType: q.trapType,
    selectedTrap: selectedTrap === 1,
  };

  // Invalidate dashboard cache so stats refresh immediately
  clearDashCache(req.userId);

  // Deferred mode: save attempt only, skip Claude call, return basic result.
  // The batch-evaluate endpoint will run Claude after the session ends.
  if (deferred) {
    return res.json({ ...base, deferred: true });
  }

  const evalResult = await runEvaluation({
    userId: req.userId, tierKey: req.userTier, attemptId: result.lastId, q,
    selectedOptionIndex, reasoningText: reasoningText.trim(), quotedLines,
  });
  return res.json({ ...base, ...evalResult });
});

// Runs the Claude evaluation for an already-saved attempt and writes the AI
// fields back to it. Shared by POST /evaluate and POST /:attemptId/retry-evaluation.
// Never throws - on AI failure it logs and returns { aiError: true, ... } so the
// attempt itself is never lost.
async function runEvaluation({ userId, tierKey, attemptId, q, selectedOptionIndex, reasoningText, quotedLines }) {
  const models = resolveModels(tierKey, "drills");
  try {
    const response = await callModel({
      models,
      system: await getPrompt("evaluate_reasoning"),
      messages: [{ role: "user", content: buildUserMessage(q, selectedOptionIndex, reasoningText, quotedLines) }],
    });

    // Log API call for admin cost tracking (Phase 9) - log the model that
    // actually answered (may be a fallback), so cost tracking stays accurate.
    await logApiCall({
      userId,
      route: "/api/attempts/evaluate",
      provider: "openrouter",
      model: response.model || models[0],
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "ok",
    });

    const evaluation = extractJSON(response.text);

    await db.run(
      `UPDATE attempts SET
         reasoning_score = $1,
         reasoning_feedback = $2,
         correct_explanation = $3,
         trap_explanation = $4,
         key_takeaway = $5
       WHERE id = $6`,
      [
        evaluation.reasoningScore,
        evaluation.reasoningFeedback,
        evaluation.correctExplanation,
        evaluation.trapExplanation,
        evaluation.keyTakeaway,
        attemptId,
      ]
    );

    return {
      reasoningScore: evaluation.reasoningScore,
      reasoningFeedback: evaluation.reasoningFeedback,
      correctExplanation: evaluation.correctExplanation,
      trapExplanation: evaluation.trapExplanation,
      keyTakeaway: evaluation.keyTakeaway,
      aiError: false,
    };
  } catch (err) {
    console.error("AI provider error:", err.message);
    await logApiCall({
      userId,
      route: "/api/attempts/evaluate",
      provider: "openrouter",
      model: models[0],
      status: "error",
      errorMessage: describeError(err),
    });
    return {
      aiError: true,
      aiErrorMessage: "AI feedback unavailable. Your attempt was saved.",
    };
  }
}

// Retry a failed AI evaluation for an attempt the user already submitted, using
// the reasoning text saved on that attempt. Verifies ownership via the session.
router.post("/:attemptId/retry-evaluation", authenticate, attachTier, aiLimiter, requireEntitlement("drills"), async (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  if (!Number.isInteger(attemptId)) {
    return res.status(400).json({ error: "Invalid attempt id" });
  }

  const attempt = await db.get(
    `SELECT a.* FROM attempts a
       JOIN sessions s ON a.session_id = s.id
      WHERE a.id = $1 AND s.user_id = $2`,
    [attemptId, req.userId]
  );
  if (!attempt) {
    return res.status(404).json({ error: "Attempt not found" });
  }
  if (attempt.selected_option_index == null || !attempt.reasoning_text) {
    return res.status(400).json({ error: "Attempt has no reasoning to evaluate" });
  }

  const q = await questionsRepo.findById(attempt.question_id);
  if (!q) {
    return res.status(404).json({ error: "Question not found" });
  }

  const base = {
    attemptId,
    isCorrect: attempt.is_correct === 1,
    correctOptionIndex: q.correctIndex,
    trapOptionIndex: q.trapIndex,
    trapType: q.trapType,
    selectedTrap: attempt.selected_trap === 1,
  };

  const evalResult = await runEvaluation({
    // `q` is required — runEvaluation passes it straight into
    // buildUserMessage(q, ...). Omitting it threw on q.options inside the try
    // block, which the catch turned into { aiError: true }, so every retry
    // silently "failed" even when the model was perfectly healthy.
    userId: req.userId, tierKey: req.userTier, attemptId, q,
    selectedOptionIndex: attempt.selected_option_index,
    reasoningText: attempt.reasoning_text.trim(),
    quotedLines: null,
  });
  return res.json({ ...base, ...evalResult });
});

module.exports = router;
