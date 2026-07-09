// Phase 2 (restructure) — ② Coach.
// Full passage → reading-map grade (BEFORE questions) → questions with reasoning
// verdict → optional "Stuck? Discuss" chat. See content-pipeline/READING_GRADER.md
// and PHASE0_ARCHITECTURE.md for the design this implements.
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");
const { callModel, DEFAULT_MODEL, describeError } = require("../ai/provider");
const { buildTrapMeaningsBlock } = require("../lib/trapMeanings");
const { clearCache: clearDashCache } = require("./dashboard");

const LETTERS = ["A", "B", "C", "D"];
const MAX_DISCUSS_EXCHANGES = 4;
const MAX_MSG_LENGTH = 300;

router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Models occasionally wrap JSON in ```json fences despite instructions not to.
// Strip fences and grab the first {...} block before parsing.
function extractJSON(text) {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function hydrateQuestion(row) {
  return {
    id: row.id,
    type: row.type,
    question: row.question,
    options: JSON.parse(row.options_json),
    correctIndex: row.correct_index,
    trapIndex: row.trap_index,
    trapType: row.trap_type,
    sourceLines: row.source_lines,
  };
}

// Strip answer-revealing fields until this question has a completed attempt.
function stripQuestion(q) {
  return { id: q.id, type: q.type, question: q.question, options: q.options.map((o) => ({ text: o.text })) };
}

async function getPassageQuestions(passageId) {
  const rows = await db.all(
    "SELECT * FROM questions WHERE passage_id = $1 AND is_active = 1 ORDER BY id ASC",
    [passageId]
  );
  return rows.map(hydrateQuestion);
}

// ── GET /api/coach/passages — picker list ──────────────────────────────────────
router.get("/passages", async (req, res, next) => {
  try {
    const topic = (req.query.topic || "").trim();
    const where = ["p.is_active = 1"];
    const params = [];
    if (topic) { params.push(topic); where.push(`p.topic = $${params.length}`); }

    const rows = await db.all(
      `SELECT p.id, p.topic, p.genre, p.title, p.word_count AS "wordCount",
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id AND is_active = 1) AS "questionCount",
              EXISTS(
                SELECT 1 FROM coach_sessions cs
                WHERE cs.passage_id = p.id AND cs.user_id = $${params.length + 1} AND cs.status = 'completed'
              ) AS "completed",
              (
                SELECT cs2.id FROM coach_sessions cs2
                WHERE cs2.passage_id = p.id AND cs2.user_id = $${params.length + 1} AND cs2.status = 'active'
                ORDER BY cs2.id DESC LIMIT 1
              ) AS "activeSessionId"
       FROM passages p
       WHERE ${where.join(" AND ")}
       ORDER BY p.id DESC`,
      [...params, req.userId]
    );
    res.json({ passages: rows });
  } catch (e) { next(e); }
});

// ── POST /api/coach/sessions — start (or resume) a session on a passage ───────
router.post("/sessions", async (req, res, next) => {
  try {
    const { passageId } = req.body || {};
    if (!passageId) return res.status(400).json({ error: "passageId is required" });

    const passage = await db.get("SELECT * FROM passages WHERE id = $1 AND is_active = 1", [passageId]);
    if (!passage) return res.status(404).json({ error: "Passage not found" });

    // Resume an existing active session for this user+passage rather than duplicating.
    let session = await db.get(
      "SELECT * FROM coach_sessions WHERE passage_id = $1 AND user_id = $2 AND status = 'active'",
      [passageId, req.userId]
    );
    if (!session) {
      const r = await db.run(
        "INSERT INTO coach_sessions (user_id, passage_id, status) VALUES ($1, $2, 'active') RETURNING id",
        [req.userId, passageId]
      );
      session = await db.get("SELECT * FROM coach_sessions WHERE id = $1", [r.lastId]);
    }

    const questions = await getPassageQuestions(passageId);
    const attempts = await db.all(
      "SELECT * FROM coach_attempts WHERE coach_session_id = $1", [session.id]
    );
    const attemptedIds = new Set(attempts.map((a) => a.question_id));

    res.json({
      coachSession: {
        id: session.id,
        status: session.status,
        readingMap: session.reading_map_json ? JSON.parse(session.reading_map_json) : null,
        readingGrade: session.reading_grade_json ? JSON.parse(session.reading_grade_json) : null,
        passage: {
          id: passage.id,
          title: passage.title,
          topic: passage.topic,
          genre: passage.genre,
          body: passage.body,
          wordCount: passage.word_count,
        },
        questions: questions.map((q) => (attemptedIds.has(q.id) ? q : stripQuestion(q))),
      },
    });
  } catch (e) { next(e); }
});

// ── POST /api/coach/sessions/:id/reading-map — the b2 differentiator ──────────
// Grades the student's reading BEFORE they see any question. Any language is
// accepted (mother-tongue verbalization) — grading is on understanding, not grammar.
router.post("/sessions/:id/reading-map", async (req, res, next) => {
  try {
    const session = await db.get(
      "SELECT * FROM coach_sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]
    );
    if (!session) return res.status(404).json({ error: "Coach session not found" });

    const passage = await db.get("SELECT * FROM passages WHERE id = $1", [session.passage_id]);
    const readingKey = JSON.parse(passage.reading_key_json);

    const { mode, crux, mainPoint, tone, structure, theTurn } = req.body || {};
    if (mode !== "quick" && mode !== "full") return res.status(400).json({ error: 'mode must be "quick" or "full"' });
    if (mode === "quick" && (!Array.isArray(crux) || crux.filter((c) => c && c.trim()).length === 0)) {
      return res.status(400).json({ error: "crux[] (one entry per paragraph) is required for quick mode" });
    }
    if (mode === "full" && !mainPoint) {
      return res.status(400).json({ error: "mainPoint is required for full mode" });
    }

    const readingMap = { mode, crux: crux || null, mainPoint: mainPoint || null, tone: tone || null, structure: structure || null, theTurn: theTurn || null };

    const studentMapText = mode === "quick"
      ? `Paragraph crux words (one entry per paragraph, in the student's own words — may be in any language):\n${(crux || []).map((c, i) => `¶${i + 1}: ${c || "(blank)"}`).join("\n")}`
      : `Main point: ${mainPoint || "(blank)"}\nTone: ${tone || "(blank)"}\nStructure (one line per paragraph): ${(structure || []).map((s, i) => `\n¶${i + 1}: ${s || "(blank)"}`).join("")}\nThe turn: ${theTurn || "(not given)"}`;

    const SYSTEM = `You are a CAT VARC reading coach. You are given a passage's canonical reading key and a student's reading map, submitted BEFORE they saw any questions. Grade their READING PROCESS.

RULES:
- Do NOT be generic or encouraging-by-default. If the reading is shallow, say so plainly.
- Diagnose the READING MODE: is the student argument-mapping (tracking claims, evidence, turns) or information-gathering (cataloguing topics/facts)? Name it explicitly.
- Grade UNDERSTANDING and LOGIC, never grammar or language — the student may write in their mother tongue, Hinglish, or ungrammatical English (this is an encouraged technique). Judge only whether they grasped the argument.
- Be specific: quote/paraphrase what they wrote and contrast it with the passage's actual architecture.
- End with ONE concrete technique they should apply on the very next passage.

Respond ONLY with valid JSON, no markdown fences:
{
  "reading_mode": "argument-mapping" | "mixed" | "information-gathering",
  "thesis": "strong" | "partial" | "weak",
  "structure": "strong" | "partial" | "weak",
  "caught_the_turn": true | false,
  "what_you_missed": "string",
  "one_technique": "string",
  "verdict_line": "string"
}`;

    const userMsg = `CANONICAL READING KEY:
Thesis: ${readingKey.thesis}
Tone: ${readingKey.tone}
Paragraph functions:
${(readingKey.paragraph_functions || []).join("\n")}
Key turn: ${readingKey.key_turn}

STUDENT'S READING MAP (${mode} mode):
${studentMapText}`;

    // Retry once on a transient/parse failure before falling back — grading the
    // reading is the differentiator, but it must never hard-block the student
    // from reaching the questions if the AI call has a bad moment.
    let grade = null;
    for (let attempt = 0; attempt < 2 && !grade; attempt++) {
      try {
        const response = await callModel({ system: SYSTEM, messages: [{ role: "user", content: userMsg }], maxTokens: 600 });
        await logApiCall({ userId: req.userId, route: "/api/coach/reading-map", provider: "openrouter", model: DEFAULT_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, status: "ok" });
        grade = extractJSON(response.text);
      } catch (err) {
        console.error(`Reading-map grade attempt ${attempt + 1} failed:`, err.message);
        await logApiCall({ userId: req.userId, route: "/api/coach/reading-map", provider: "openrouter", model: DEFAULT_MODEL, status: "error", errorMessage: describeError(err) });
      }
    }

    if (!grade) {
      // Fallback: don't block the session — record that grading failed and let
      // the student proceed. They can still be graded manually via Discuss later.
      grade = {
        reading_mode: "mixed",
        thesis: "partial",
        structure: "partial",
        caught_the_turn: false,
        what_you_missed: "We couldn't grade your reading this time: the AI feedback service had a hiccup. Your notes were saved; continue to the questions.",
        one_technique: "Re-check your notes against the passage before answering. Did you capture what each paragraph is doing, not just what it's about?",
        verdict_line: "Reading feedback unavailable this time.",
        ungraded: true,
      };
    }

    await db.run(
      "UPDATE coach_sessions SET reading_map_json = $1, reading_grade_json = $2 WHERE id = $3",
      [JSON.stringify(readingMap), JSON.stringify(grade), session.id]
    );

    res.json({ readingMap, readingGrade: grade });
  } catch (e) { next(e); }
});

// ── GET /api/coach/sessions/:id — full session state ───────────────────────────
router.get("/sessions/:id", async (req, res, next) => {
  try {
    const session = await db.get(
      "SELECT * FROM coach_sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]
    );
    if (!session) return res.status(404).json({ error: "Coach session not found" });

    const passage = await db.get("SELECT * FROM passages WHERE id = $1", [session.passage_id]);
    const questions = await getPassageQuestions(session.passage_id);
    const attempts = await db.all(
      "SELECT * FROM coach_attempts WHERE coach_session_id = $1 ORDER BY question_index ASC", [session.id]
    );
    const attemptByQ = new Map(attempts.map((a) => [a.question_id, a]));

    res.json({
      coachSession: {
        id: session.id,
        status: session.status,
        readingMap: session.reading_map_json ? JSON.parse(session.reading_map_json) : null,
        readingGrade: session.reading_grade_json ? JSON.parse(session.reading_grade_json) : null,
        passage: { id: passage.id, title: passage.title, topic: passage.topic, genre: passage.genre, body: passage.body, wordCount: passage.word_count },
        questions: questions.map((q) => (attemptByQ.has(q.id) ? q : stripQuestion(q))),
      },
      attempts: attempts.map((a) => ({
        ...a,
        discussConversation: JSON.parse(a.discuss_conversation_json || "[]"),
      })),
    });
  } catch (e) { next(e); }
});

// ── POST /api/coach/attempts — reasoning verdict for one question ─────────────
// Mirrors attempts/evaluate.js but writes to coach_attempts. Response shape
// matches FeedbackSections' expected `attempt` prop so the client can reuse it.
router.post("/attempts", async (req, res, next) => {
  try {
    const { coachSessionId, questionId, questionIndex, selectedOptionIndex, reasoningText } = req.body || {};
    if (coachSessionId == null || !questionId || selectedOptionIndex == null) {
      return res.status(400).json({ error: "coachSessionId, questionId, and selectedOptionIndex are required" });
    }
    if (reasoningText && reasoningText.trim().length > 800) {
      return res.status(400).json({ error: "reasoningText must be 800 characters or fewer" });
    }

    const session = await db.get(
      "SELECT * FROM coach_sessions WHERE id = $1 AND user_id = $2", [coachSessionId, req.userId]
    );
    if (!session) return res.status(404).json({ error: "Coach session not found" });

    const qRow = await db.get("SELECT * FROM questions WHERE id = $1 AND passage_id = $2", [questionId, session.passage_id]);
    if (!qRow) return res.status(404).json({ error: "Question not found on this passage" });
    const q = hydrateQuestion(qRow);

    let attempt = await db.get(
      "SELECT * FROM coach_attempts WHERE coach_session_id = $1 AND question_id = $2", [coachSessionId, questionId]
    );
    if (attempt) return res.status(400).json({ error: "This question has already been attempted" });

    const isCorrect = selectedOptionIndex === q.correctIndex ? 1 : 0;
    const selectedTrap = q.trapIndex != null && selectedOptionIndex === q.trapIndex ? 1 : 0;

    const ins = await db.run(
      `INSERT INTO coach_attempts
         (coach_session_id, question_id, question_index, question_type,
          selected_option_index, correct_option_index, is_correct, trap_type, selected_trap)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [coachSessionId, questionId, questionIndex ?? 0, q.type, selectedOptionIndex, q.correctIndex, isCorrect, q.trapType, selectedTrap]
    );
    const attemptId = ins.lastId;

    const base = {
      options: q.options.map((o) => ({ text: o.text })),
      correctOptionIndex: q.correctIndex,
      selectedOptionIndex,
      trapOptionIndex: q.trapIndex,
      trapType: q.trapType,
      sourceLines: q.sourceLines,
      isCorrect: isCorrect === 1,
      skipped: false,
    };

    clearDashCache(req.userId);

    if (!reasoningText || !reasoningText.trim()) {
      return res.json({ ...base, attemptId });
    }

    const presentTrapTypes = [...new Set(q.options.map((o) => o.trapType).filter(Boolean))];
    const optionLines = q.options.map((o, i) => `${LETTERS[i]}) ${o.text}`).join("\n");
    const SYSTEM = `You are a CAT (Common Admission Test) Reading Comprehension coach. A student has answered a full-passage RC question and explained their reasoning. You already know the correct answer. Evaluate the QUALITY of their reasoning, explain the correct answer precisely, and deconstruct the trap.

Respond ONLY with valid JSON, no markdown fences:
{ "reasoningScore": integer 1-5, "reasoningFeedback": string, "correctExplanation": string, "trapExplanation": string, "keyTakeaway": string }

Reasoning score rubric: 1=no real reasoning/circular, 2=paraphrased but didn't connect to option logic, 3=found the right part of the passage but erred connecting it, 4=sound but missed a nuance, 5=identified authorial intent, eliminated the trap with a specific reason, reached the answer through logic.
Rules: reasoningFeedback (2-3 sentences on HOW they thought), correctExplanation (2-3 sentences, cite specific lines), trapExplanation (2-3 sentences naming the exact flaw using the trap type meaning below), keyTakeaway (one generalizable sentence). Always reference specific words from the options or passage.`;
    const userMsg = `PASSAGE:
${qRow.paragraph}

SOURCE LINES: ${q.sourceLines}

QUESTION: ${q.question}
QUESTION TYPE: ${q.type}

OPTIONS:
${optionLines}

CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} — "${q.options[q.correctIndex].text}"
${q.trapIndex != null ? `TRAP OPTION: Option ${LETTERS[q.trapIndex]} — "${q.options[q.trapIndex].text}"\nTRAP TYPE: ${q.trapType}\nTRAP TYPE MEANINGS:\n${buildTrapMeaningsBlock(presentTrapTypes)}` : ""}

STUDENT SELECTED: Option ${LETTERS[selectedOptionIndex]}
STUDENT'S REASONING:
${reasoningText.trim()}`;

    try {
      const response = await callModel({ system: SYSTEM, messages: [{ role: "user", content: userMsg }] });
      await logApiCall({ userId: req.userId, route: "/api/coach/attempts", provider: "openrouter", model: DEFAULT_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, status: "ok" });
      const evalResult = extractJSON(response.text);

      await db.run(
        `UPDATE coach_attempts SET reasoning_text=$1, reasoning_score=$2, reasoning_feedback=$3,
           correct_explanation=$4, trap_explanation=$5, key_takeaway=$6 WHERE id=$7`,
        [reasoningText.trim(), evalResult.reasoningScore, evalResult.reasoningFeedback, evalResult.correctExplanation, evalResult.trapExplanation, evalResult.keyTakeaway, attemptId]
      );

      return res.json({
        ...base, attemptId,
        reasoningScore: evalResult.reasoningScore,
        reasoningFeedback: evalResult.reasoningFeedback,
        correctExplanation: evalResult.correctExplanation,
        trapExplanation: evalResult.trapExplanation,
        keyTakeaway: evalResult.keyTakeaway,
      });
    } catch (err) {
      await logApiCall({ userId: req.userId, route: "/api/coach/attempts", provider: "openrouter", model: DEFAULT_MODEL, status: "error", errorMessage: describeError(err) });
      await db.run("UPDATE coach_attempts SET reasoning_text = $1 WHERE id = $2", [reasoningText.trim(), attemptId]);
      return res.json({ ...base, attemptId, aiError: true, aiErrorMessage: "AI feedback unavailable. Your attempt was saved." });
    }
  } catch (e) { next(e); }
});

// ── POST /api/coach/exchange — optional "Stuck? Discuss" chat ─────────────────
// Only usable AFTER a question's attempt/verdict exists — this is supplementary
// discussion, not a gate to revealing the answer (that's the point of the redesign).
router.post("/exchange", async (req, res, next) => {
  try {
    const { coachSessionId, questionId, message } = req.body || {};
    if (!coachSessionId || !questionId || !message || !message.trim()) {
      return res.status(400).json({ error: "coachSessionId, questionId, and message are required" });
    }
    if (message.trim().length > MAX_MSG_LENGTH) return res.status(400).json({ error: `message must be ${MAX_MSG_LENGTH} characters or fewer` });

    const session = await db.get("SELECT * FROM coach_sessions WHERE id = $1 AND user_id = $2", [coachSessionId, req.userId]);
    if (!session) return res.status(404).json({ error: "Coach session not found" });

    const attempt = await db.get("SELECT * FROM coach_attempts WHERE coach_session_id = $1 AND question_id = $2", [coachSessionId, questionId]);
    if (!attempt) return res.status(400).json({ error: "Answer this question before discussing it" });
    if (attempt.exchange_count >= MAX_DISCUSS_EXCHANGES) return res.status(400).json({ error: "Discussion limit reached for this question" });

    const qRow = await db.get("SELECT * FROM questions WHERE id = $1", [questionId]);
    const q = hydrateQuestion(qRow);
    const conversation = JSON.parse(attempt.discuss_conversation_json || "[]");
    conversation.push({ role: "student", text: message.trim() });

    const presentTrapTypes = [...new Set(q.options.map((o) => o.trapType).filter(Boolean))];
    const SYSTEM = `You are a VARC coach discussing an already-revealed answer with a student who wants to understand it better. They already know the correct answer and your explanation — this is a follow-up clarification chat, not a Socratic reveal. Answer their specific question directly and helpfully. Reference the passage's actual text. Keep responses under 120 words. Respond ONLY with your message, no JSON, no labels.`;
    const historyLines = conversation.map((m) => `${m.role === "student" ? "STUDENT" : "COACH"}: ${m.text}`).join("\n");
    const userMsg = `PASSAGE:
${qRow.paragraph}

QUESTION: ${q.question}
CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} — "${q.options[q.correctIndex].text}"
${q.trapType ? `TRAP TYPE: ${q.trapType} (${buildTrapMeaningsBlock([q.trapType])})` : ""}
STUDENT'S ORIGINAL REASONING: ${attempt.reasoning_text || "(none given)"}
PRIOR AI FEEDBACK: ${attempt.correct_explanation || ""} ${attempt.trap_explanation || ""}

CONVERSATION SO FAR:
${historyLines}

Respond as the coach to the student's latest message.`;

    try {
      const response = await callModel({ system: SYSTEM, messages: [{ role: "user", content: userMsg }], maxTokens: 300 });
      await logApiCall({ userId: req.userId, route: "/api/coach/exchange", provider: "openrouter", model: DEFAULT_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, status: "ok" });
      const reply = response.text.trim();
      conversation.push({ role: "coach", text: reply });
      const newCount = attempt.exchange_count + 1;
      await db.run("UPDATE coach_attempts SET discuss_conversation_json = $1, exchange_count = $2 WHERE id = $3", [JSON.stringify(conversation), newCount, attempt.id]);
      res.json({ reply, exchangeCount: newCount, limitReached: newCount >= MAX_DISCUSS_EXCHANGES });
    } catch (err) {
      await logApiCall({ userId: req.userId, route: "/api/coach/exchange", provider: "openrouter", model: DEFAULT_MODEL, status: "error", errorMessage: describeError(err) });
      res.status(502).json({ error: "Coach unavailable right now. Try again." });
    }
  } catch (e) { next(e); }
});

// ── POST /api/coach/sessions/:id/complete ───────────────────────────────────────
router.post("/sessions/:id/complete", async (req, res, next) => {
  try {
    const session = await db.get("SELECT * FROM coach_sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (!session) return res.status(404).json({ error: "Coach session not found" });
    await db.run("UPDATE coach_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1", [session.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /api/coach/history ─────────────────────────────────────────────────────
router.get("/history", async (req, res, next) => {
  try {
    const sessions = await db.all(
      `SELECT cs.id, p.title AS article_title, p.topic, cs.status, cs.created_at, cs.completed_at,
              COUNT(ca.id) AS attempted,
              COALESCE(SUM(ca.is_correct), 0) AS correct,
              AVG(ca.reasoning_score) AS avg_reasoning_score
       FROM coach_sessions cs
       JOIN passages p ON p.id = cs.passage_id
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id, p.title, p.topic
       ORDER BY cs.created_at DESC`,
      [req.userId]
    );
    res.json({ sessions });
  } catch (e) { next(e); }
});

// ── GET /api/coach/stats — Dashboard Coach tab ─────────────────────────────────
router.get("/stats", async (req, res, next) => {
  try {
    const row = await db.get(
      `SELECT COUNT(DISTINCT cs.id) AS total_sessions, COUNT(ca.id) AS total_questions,
              COALESCE(SUM(ca.is_correct), 0) AS total_correct, AVG(ca.reasoning_score) AS "avgReasoningScore"
       FROM coach_sessions cs
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id
       WHERE cs.user_id = $1`,
      [req.userId]
    );
    const byType = await db.all(
      `SELECT question_type, COUNT(*) AS attempts, SUM(is_correct) AS correct
       FROM coach_attempts
       WHERE coach_session_id IN (SELECT id FROM coach_sessions WHERE user_id = $1)
       GROUP BY question_type`,
      [req.userId]
    );
    const recentSessions = await db.all(
      `SELECT cs.id, p.title AS article_title, cs.created_at,
              COUNT(ca.id) AS attempted, COALESCE(SUM(ca.is_correct), 0) AS correct,
              AVG(ca.reasoning_score) AS avg_reasoning_score
       FROM coach_sessions cs
       JOIN passages p ON p.id = cs.passage_id
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id, p.title
       ORDER BY cs.created_at DESC
       LIMIT 10`,
      [req.userId]
    );
    res.json({
      totalSessions: parseInt(row.total_sessions, 10) || 0,
      totalQuestions: parseInt(row.total_questions, 10) || 0,
      totalCorrect: parseInt(row.total_correct, 10) || 0,
      avgReasoningScore: row.avgReasoningScore ? Math.round(row.avgReasoningScore * 10) / 10 : null,
      accuracy: row.total_questions ? row.total_correct / row.total_questions : null,
      byType: byType.reduce((acc, r) => { acc[r.question_type] = { attempts: r.attempts, correct: r.correct }; return acc; }, {}),
      recentSessions,
    });
  } catch (e) { next(e); }
});

// ── DELETE /api/coach/sessions/:id ─────────────────────────────────────────────
router.delete("/sessions/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "invalid session id" });
    const session = await db.get("SELECT id FROM coach_sessions WHERE id = $1 AND user_id = $2", [id, req.userId]);
    if (!session) return res.status(404).json({ error: "Coach session not found" });
    await db.run("DELETE FROM coach_attempts WHERE coach_session_id = $1", [id]);
    await db.run("DELETE FROM coach_sessions WHERE id = $1 AND user_id = $2", [id, req.userId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
