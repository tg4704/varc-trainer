const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// POST /api/attempts/evaluate — analysis mode with AI reasoning evaluation
router.post("/evaluate", authenticate, async (req, res) => {
  const {
    sessionId,
    questionId,
    selectedOptionIndex,
    reasoningText,
    timeTakenSeconds,
    mode = "analysis",
  } = req.body || {};

  if (sessionId == null || !questionId) {
    return res.status(400).json({ error: "sessionId and questionId are required" });
  }
  if (selectedOptionIndex == null) {
    return res.status(400).json({ error: "selectedOptionIndex is required" });
  }
  if (!reasoningText || reasoningText.trim().length < 50) {
    return res.status(400).json({ error: "reasoningText must be at least 50 characters" });
  }

  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, req.userId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const q = questionsRepo.findById(questionId);
  if (!q) {
    return res.status(404).json({ error: "Question not found" });
  }

  const isCorrect = selectedOptionIndex === q.correctIndex ? 1 : 0;
  const selectedTrap = q.trapIndex != null && selectedOptionIndex === q.trapIndex ? 1 : 0;

  // Save attempt BEFORE calling Claude — never lose the attempt if the API fails
  const result = db
    .prepare(
      `INSERT INTO attempts
         (session_id, question_id, question_type, topic,
          selected_option_index, correct_option_index, is_correct,
          trap_option_index, trap_type, selected_trap, skipped,
          reasoning_text, mode, time_taken_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(
      sessionId, questionId, q.type, q.topic,
      selectedOptionIndex, q.correctIndex, isCorrect,
      q.trapIndex, q.trapType, selectedTrap,
      reasoningText.trim(), mode, timeTakenSeconds ?? null
    );

  const attemptId = result.lastInsertRowid;

  const base = {
    isCorrect: isCorrect === 1,
    correctOptionIndex: q.correctIndex,
    trapOptionIndex: q.trapIndex,
    trapType: q.trapType,
    selectedTrap: selectedTrap === 1,
  };

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(q, selectedOptionIndex, reasoningText.trim()) }],
    });

    // Log API call for admin cost tracking (Phase 9)
    logApiCall({
      userId: req.userId,
      route: "/api/attempts/evaluate",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      status: "ok",
    });

    const evaluation = JSON.parse(response.content[0].text);

    db.prepare(
      `UPDATE attempts SET
         reasoning_score = ?,
         reasoning_feedback = ?,
         correct_explanation = ?,
         trap_explanation = ?,
         key_takeaway = ?
       WHERE id = ?`
    ).run(
      evaluation.reasoningScore,
      evaluation.reasoningFeedback,
      evaluation.correctExplanation,
      evaluation.trapExplanation,
      evaluation.keyTakeaway,
      attemptId
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
    console.error("Claude API error:", err.message);
    // Still log the failed attempt for admin visibility
    logApiCall({
      userId: req.userId,
      route: "/api/attempts/evaluate",
      provider: "anthropic",
      model: "claude-haiku-4-5",
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
