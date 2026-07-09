// Phase 10: user-submitted questions.
// All routes are auth-gated and scoped to the logged-in user.
// User questions are private (source='user', author_user_id=req.userId).
// Active ones are automatically included in the user's practice sessions
// (questionsRepo.listForUser already handles this).
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const { validateQuestionPayload, normalizeOptions } = require("../lib/validateQuestion");
const { logApiCall } = require("../ai/apiLog");
const { callModel, DEFAULT_MODEL, describeError } = require("../ai/provider");

router.use(authenticate);

const AI_ENABLED = process.env.ENABLE_AI_AUTHORING !== "false"; // on by default

// ── ID helper ──────────────────────────────────────────────────────────────
function makeId(userId) {
  return `user_${userId}_${Date.now()}`;
}

// ── GET /api/my-questions ──────────────────────────────────────────────────
// List all questions created by the logged-in user.
router.get("/", async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT id, topic, type, is_active, created_at,
              substr(question, 1, 120) AS question_snippet
       FROM questions
       WHERE author_user_id = $1
       ORDER BY id DESC`,
      [req.userId]
    );
    res.json({ questions: rows });
  } catch (e) { next(e); }
});

// ── POST /api/my-questions ─────────────────────────────────────────────────
// Create a user question (manual or after editing an AI draft).
router.post("/", async (req, res, next) => {
  try {
    const err = validateQuestionPayload(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      topic, paragraph, question, type,
      options, correctIndex, trapIndex, trapType, sourceLines,
    } = req.body;

    const id = makeId(req.userId);

    try {
      await db.run(
        `INSERT INTO questions
           (id, topic, paragraph, question, type, options_json,
            correct_index, trap_index, trap_type, source_lines,
            source, author_user_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'user', $11, 1)`,
        [
          id, topic, paragraph.trim(), question.trim(), type,
          JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
          correctIndex,
          trapIndex ?? null,
          trapIndex != null ? (trapType || null) : null,
          sourceLines.trim(),
          req.userId,
        ]
      );
      res.json({ ok: true, id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } catch (e) { next(e); }
});

// ── GET /api/my-questions/:id ──────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const row = await db.get(
      "SELECT * FROM questions WHERE id = $1 AND author_user_id = $2",
      [req.params.id, req.userId]
    );
    if (!row) return res.status(404).json({ error: "Not found" });

    const options = JSON.parse(row.options_json);
    res.json({
      question: {
        id: row.id,
        topic: row.topic,
        paragraph: row.paragraph,
        question: row.question,
        type: row.type,
        options,
        correctIndex: row.correct_index,
        trapIndex: row.trap_index,
        trapType: row.trap_type,
        sourceLines: row.source_lines,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
      },
    });
  } catch (e) { next(e); }
});

// ── PATCH /api/my-questions/:id ────────────────────────────────────────────
// Update content or toggle is_active.
router.patch("/:id", async (req, res, next) => {
  try {
    const existing = await db.get(
      "SELECT id FROM questions WHERE id = $1 AND author_user_id = $2",
      [req.params.id, req.userId]
    );
    if (!existing) return res.status(404).json({ error: "Not found" });

    // Quick toggle activation
    if (typeof req.body.isActive === "boolean") {
      await db.run(
        "UPDATE questions SET is_active = $1 WHERE id = $2",
        [req.body.isActive ? 1 : 0, req.params.id]
      );
      return res.json({ ok: true });
    }

    const err = validateQuestionPayload(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      topic, paragraph, question, type,
      options, correctIndex, trapIndex, trapType, sourceLines,
    } = req.body;

    await db.run(
      `UPDATE questions SET
         topic = $1, paragraph = $2, question = $3, type = $4,
         options_json = $5, correct_index = $6, trap_index = $7,
         trap_type = $8, source_lines = $9
       WHERE id = $10`,
      [
        topic, paragraph.trim(), question.trim(), type,
        JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
        correctIndex,
        trapIndex ?? null,
        trapIndex != null ? (trapType || null) : null,
        sourceLines.trim(),
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /api/my-questions/:id ───────────────────────────────────────────
// Hard delete — user questions are personal data; no reason to keep them soft.
router.delete("/:id", async (req, res, next) => {
  try {
    const info = await db.run(
      "DELETE FROM questions WHERE id = $1 AND author_user_id = $2",
      [req.params.id, req.userId]
    );
    if (info.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/my-questions/generate-draft ──────────────────────────────────
// AI-draft: user pastes a passage (and optionally picks a question type),
// Claude generates a full question + 4 options. Returns a draft object the
// frontend pre-populates the editor with. The user reviews and edits before saving.
// Feature-flagged: ENABLE_AI_AUTHORING env var (defaults true).
router.post("/generate-draft", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(403).json({ error: "AI question generation is not enabled on this server." });
  }

  const { paragraph, type, topic } = req.body || {};
  if (!paragraph || paragraph.trim().length < 100) {
    return res.status(400).json({ error: "Passage must be at least 100 characters." });
  }
  if (paragraph.trim().length > 9000) {
    return res.status(400).json({ error: "Passage too long. Keep it under ~1500 words." });
  }

  const questionType = type || "inference";
  const questionTopic = topic || "humanities";

  const SYSTEM = `You are an expert CAT (Common Admission Test) RC question designer.
Given a passage, generate ONE high-quality CAT-style ${questionType} question.

Rules:
- Exactly 4 options: 1 correct, 1 trap, 2 distractors
- The correct option requires inference/judgment, not direct quote recall
- Trap types: too_extreme | out_of_scope | real_but_unstated | partially_correct
- Correct option: 12–25 words, avoid absolute language (never/always/only/completely)
- Trap option must be genuinely tempting to a 90-percentile student
- Distractor options: clearly wrong but not obviously so
- sourceLines: 2–4 verbatim sentences from the passage that justify the correct answer

Respond ONLY with valid JSON. No preamble, no markdown fences.

Schema:
{
  "question": string,
  "options": [
    {"text": string, "isCorrect": boolean, "isTrap": boolean, "trapType": string|null},
    {"text": string, "isCorrect": boolean, "isTrap": boolean, "trapType": string|null},
    {"text": string, "isCorrect": boolean, "isTrap": boolean, "trapType": string|null},
    {"text": string, "isCorrect": boolean, "isTrap": boolean, "trapType": string|null}
  ],
  "correctIndex": 0|1|2|3,
  "trapIndex": 0|1|2|3,
  "trapType": "too_extreme"|"out_of_scope"|"real_but_unstated"|"partially_correct",
  "sourceLines": string
}`;

  const userMsg = `PASSAGE:\n${paragraph.trim()}\n\nQUESTION TYPE: ${questionType}\n\nGenerate one CAT-style ${questionType} question on this passage.`;

  async function callAI() {
    const response = await callModel({
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    await logApiCall({
      userId: req.userId,
      route: "/api/my-questions/generate-draft",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "ok",
    });
    return JSON.parse(response.text);
  }

  try {
    let draft;
    try {
      draft = await callAI();
    } catch {
      // Retry once on parse error or network hiccup
      draft = await callAI();
    }

    // Validate the AI output before returning to the client
    const payload = {
      topic: questionTopic,
      paragraph: paragraph.trim(),
      question: draft.question,
      type: questionType,
      options: draft.options,
      correctIndex: draft.correctIndex,
      trapIndex: draft.trapIndex,
      trapType: draft.trapType,
      sourceLines: draft.sourceLines,
    };
    const err = validateQuestionPayload(payload);
    if (err) {
      return res.status(422).json({
        error: `AI generated an invalid question (${err}). Try again or write it manually.`,
      });
    }

    res.json({ draft: payload });
  } catch (e) {
    await logApiCall({
      userId: req.userId,
      route: "/api/my-questions/generate-draft",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      status: "error",
      errorMessage: describeError(e),
    });
    console.error("AI draft error:", e.message);
    res.status(502).json({
      error: "Could not generate a question right now. Try again or write it manually.",
    });
  }
});

module.exports = router;
