const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");
const { callModel, DEFAULT_MODEL } = require("../ai/provider");
const { updateCard } = require("../sr");
const { clearCache: clearDashCache } = require("./dashboard");
const { buildTrapMeaningsBlock } = require("../lib/trapMeanings");

const LETTERS = ["A", "B", "C", "D"];

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

function buildUserMessage(q, selectedIndex, reasoningText, quotedLines) {
  const optionLines = q.options.map((o, i) => `${LETTERS[i]}) ${o.text}`).join("\n");

  // Reference meanings for every archetype present among this question's options,
  // not just the primary trap — imported AI questions tag every wrong option.
  const presentTrapTypes = [...new Set(q.options.map((o) => o.trapType).filter(Boolean))];

  const trapSection =
    q.trapIndex != null
      ? `TRAP OPTION: Option ${LETTERS[q.trapIndex]} — "${q.options[q.trapIndex].text}"
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

CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} — "${q.options[q.correctIndex].text}"
${trapSection}

STUDENT SELECTED: Option ${LETTERS[selectedIndex]}${quotedSection}
STUDENT'S REASONING:
${reasoningText}`;
}

// POST /api/attempts/evaluate — analysis mode with AI reasoning evaluation.
// Pass deferred:true to save the attempt without calling Claude (for timed sessions).
router.post("/evaluate", authenticate, async (req, res) => {
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

  // Save attempt BEFORE calling Claude — never lose the attempt if the API fails
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
    isCorrect: isCorrect === 1,
    correctOptionIndex: q.correctIndex,
    trapOptionIndex: q.trapIndex,
    trapType: q.trapType,
    selectedTrap: selectedTrap === 1,
  };

  // Update SR card now that we know the result (Phase 15)
  try { await updateCard(req.userId, questionId, isCorrect === 1); } catch {}

  // Invalidate dashboard cache so stats refresh immediately
  clearDashCache(req.userId);

  // Deferred mode: save attempt only, skip Claude call, return basic result.
  // The batch-evaluate endpoint will run Claude after the session ends.
  if (deferred) {
    return res.json({ ...base, deferred: true });
  }

  const attemptId = result.lastId;

  try {
    const response = await callModel({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(q, selectedOptionIndex, reasoningText.trim(), quotedLines) }],
    });

    // Log API call for admin cost tracking (Phase 9)
    await logApiCall({
      userId: req.userId,
      route: "/api/attempts/evaluate",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "ok",
    });

    const evaluation = JSON.parse(response.text);

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

    return res.json({
      ...base,
      reasoningScore: evaluation.reasoningScore,
      reasoningFeedback: evaluation.reasoningFeedback,
      correctExplanation: evaluation.correctExplanation,
      trapExplanation: evaluation.trapExplanation,
      keyTakeaway: evaluation.keyTakeaway,
      aiError: false,
    });
  } catch (err) {
    console.error("AI provider error:", err.message);
    await logApiCall({
      userId: req.userId,
      route: "/api/attempts/evaluate",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      status: "error",
    });
    return res.json({
      ...base,
      aiError: true,
      aiErrorMessage: "AI feedback unavailable — your attempt was saved.",
    });
  }
});

module.exports = router;
