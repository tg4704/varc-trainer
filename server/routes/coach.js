// Phase 14 — AI Reading Coach
// Routes:
//   POST /api/coach/sessions      — validate article, generate questions, create session
//   POST /api/coach/exchange      — one Socratic exchange turn
//   GET  /api/coach/sessions/:id  — full session (with revealed answers for completed attempts)
//   GET  /api/coach/history       — user's past sessions with stats
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const { logApiCall } = require("../ai/apiLog");
const { callModel, DEFAULT_MODEL } = require("../ai/provider");

const LETTERS = ["A", "B", "C", "D"];
const MIN_WORDS = 300;
const MAX_WORDS = 1200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Strip sensitive fields before sending questions to the client.
// correctIndex / trapIndex / trapType / sourceLines are kept server-side
// until the debrief for that question is complete.
function stripQuestion(q) {
  return {
    type: q.type,
    question: q.question,
    options: q.options.map((o) => ({ text: o.text })),
  };
}

// Validate the AI-generated questions array.
function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length !== 4) return "Expected 4 questions";
  const validTypes = ["inference", "tone", "detail", "title"];
  const validTrapTypes = ["too_extreme", "out_of_scope", "real_but_unstated", "partially_correct"];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!validTypes.includes(q.type)) return `Question ${i}: invalid type "${q.type}"`;
    if (!q.question || typeof q.question !== "string") return `Question ${i}: missing question text`;
    if (!Array.isArray(q.options) || q.options.length !== 4) return `Question ${i}: need exactly 4 options`;
    if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex > 3) return `Question ${i}: invalid correctIndex`;
    if (q.trapIndex == null || q.trapIndex < 0 || q.trapIndex > 3) return `Question ${i}: invalid trapIndex`;
    if (!validTrapTypes.includes(q.trapType)) return `Question ${i}: invalid trapType "${q.trapType}"`;
    if (!q.sourceLines) return `Question ${i}: missing sourceLines`;
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) return `Question ${i}: need exactly 1 correct option`;
  }
  return null; // valid
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const GENERATION_SYSTEM = `You are an expert CAT (Common Admission Test) RC question designer. You will be given an article. Your job is to generate 4 high-quality CAT-style questions on it.

Rules for questions:
- Each question must require inference or judgment — no pure factual recall
- One question per type: inference, tone, title, detail
- Every question must have exactly 4 options
- Options: 1 correct, 1 trap (tempting but wrong), 2 distractors (clearly wrong)
- Correct option: 12–25 words, no absolute language (never/always/only/completely)
- Trap option: plausible, either too extreme, out of scope, real-but-unstated, or partially correct
- Distractor options: wrong but not obviously so

For each question also identify:
- sourceLines: the 2–4 sentences from the article that directly contain or imply the answer
- trapType: one of "too_extreme" | "out_of_scope" | "real_but_unstated" | "partially_correct"
- correctIndex: 0–3 (which option is correct)
- trapIndex: 0–3 (which option is the trap)

Respond ONLY with a valid JSON array. No preamble, no markdown fences, no text outside the JSON.
[
  {
    "type": "inference",
    "question": "...",
    "options": [
      { "text": "...", "isCorrect": false, "isTrap": true, "trapType": "too_extreme" },
      { "text": "...", "isCorrect": true, "isTrap": false, "trapType": null },
      { "text": "...", "isCorrect": false, "isTrap": false, "trapType": null },
      { "text": "...", "isCorrect": false, "isTrap": false, "trapType": null }
    ],
    "correctIndex": 1,
    "trapIndex": 0,
    "trapType": "too_extreme",
    "sourceLines": "The specific 2–4 sentence excerpt from the article."
  }
]`;

const SOCRATIC_SYSTEM = `You are a CAT RC tutor conducting a Socratic debrief. A student has answered an RC question. You know the correct answer. Your job is NOT to reveal it — your job is to guide the student to figure it out themselves through targeted questions.

Your response rules:
- Keep your response under 100 words. This is a conversation, not a lecture.
- Never state the correct answer directly (unless exchange_number is 4)
- Never say "good job" or "you're wrong" — guide through questions
- Each response must end with a question that moves the student closer to the answer
- Target the specific gap in the student's reasoning — don't give generic advice
- Reference specific words or lines from the article when pushing back
- If the student's reasoning is essentially correct (even if they picked the wrong option), acknowledge the sound logic before redirecting

Exchange number rules:
- Exchange 1: Probe — ask them to show their evidence from the article (student message will be empty here — just ask the first probe question)
- Exchange 2: Challenge or validate based on their response
- Exchange 3: If still wrong, give a strong redirect to the relevant section of the article
- Exchange 4: Reveal the correct answer with full explanation (150–200 words)

Tone: direct, intellectually honest, no false praise, patient but not soft.

Respond ONLY with your conversational message. No JSON, no labels, no preamble.`;

function buildSocraticUserMessage(article, q, selectedIndex, conversation, exchangeNumber, studentMessage, giveUp) {
  const trapTypeMeanings = {
    too_extreme: "uses absolute language the article doesn't support",
    out_of_scope: "introduces a concept not present in the article",
    real_but_unstated: "may be true but the article doesn't say or imply it",
    partially_correct: "captures part of the point but misses a key nuance",
  };

  const optionLines = q.options.map((o, i) => `${LETTERS[i]}) ${o.text}`).join("\n");
  const historyLines = conversation.length
    ? "\nCONVERSATION SO FAR:\n" +
      conversation.map((m) => `${m.role === "tutor" ? "TUTOR" : "STUDENT"}: ${m.text}`).join("\n")
    : "";

  const effectiveExchange = giveUp ? 4 : exchangeNumber;

  return `ARTICLE:
${article}

QUESTION: ${q.question}

OPTIONS:
${optionLines}

CORRECT ANSWER: Option ${LETTERS[q.correctIndex]} — "${q.options[q.correctIndex].text}"
TRAP OPTION: Option ${LETTERS[q.trapIndex]} — "${q.options[q.trapIndex].text}" (trap type: ${q.trapType} — ${trapTypeMeanings[q.trapType] || ""})
STUDENT SELECTED: Option ${LETTERS[selectedIndex]} — "${q.options[selectedIndex].text}"
IS STUDENT CORRECT: ${selectedIndex === q.correctIndex}
${historyLines}

CURRENT EXCHANGE NUMBER: ${effectiveExchange}
STUDENT'S LATEST MESSAGE: ${studentMessage || "(none — this is the opening probe)"}
${giveUp ? "\nNOTE: The student has given up. Reveal the correct answer with full explanation now." : ""}
Now respond as the tutor.`;
}

// ── POST /api/coach/sessions — create session + generate questions ─────────────

router.post("/sessions", authenticate, async (req, res) => {
  const { articleText, articleTitle = "", articleSource = "" } = req.body || {};

  if (!articleText || typeof articleText !== "string") {
    return res.status(400).json({ error: "articleText is required" });
  }

  const wordCount = countWords(articleText);
  if (wordCount < MIN_WORDS) {
    return res.status(400).json({ error: `Article too short (${wordCount} words). Minimum is ${MIN_WORDS}.` });
  }
  if (wordCount > MAX_WORDS) {
    return res.status(400).json({ error: `Article too long (${wordCount} words). Maximum is ${MAX_WORDS}.` });
  }

  // Generate questions (with one retry on failure)
  let questions = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callModel({
        maxTokens: 2000,
        system: GENERATION_SYSTEM,
        messages: [{
          role: "user",
          content: `ARTICLE:\n${articleText}\n\nGenerate 4 CAT-style questions on this article following the rules above. Ensure the questions collectively cover: inference, tone, title, and detail.`,
        }],
      });

      logApiCall({
        userId: req.userId,
        route: "/api/coach/sessions",
        provider: "openrouter",
        model: DEFAULT_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        status: "ok",
      });

      const parsed = JSON.parse(response.text);
      const validationError = validateQuestions(parsed);
      if (validationError) {
        lastError = `Validation failed: ${validationError}`;
        continue;
      }
      questions = parsed;
      break;
    } catch (err) {
      lastError = err.message;
      logApiCall({
        userId: req.userId,
        route: "/api/coach/sessions",
        provider: "openrouter",
        model: DEFAULT_MODEL,
        status: "error",
      });
    }
  }

  if (!questions) {
    return res.status(502).json({
      error: "Couldn't generate good questions for this article. Try a different article or shorten it.",
      detail: lastError,
    });
  }

  const result = db
    .prepare(
      `INSERT INTO coach_sessions (user_id, article_text, article_source, article_title, word_count, questions_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, articleText.trim(), articleSource.trim(), articleTitle.trim(), wordCount, JSON.stringify(questions));

  const coachSessionId = result.lastInsertRowid;

  res.json({
    coachSession: {
      id: coachSessionId,
      articleTitle: articleTitle.trim() || null,
      articleSource: articleSource.trim() || null,
      wordCount,
      // Questions with sensitive fields stripped — correctIndex etc. revealed after debrief
      questions: questions.map(stripQuestion),
    },
  });
});

// ── POST /api/coach/exchange — one Socratic turn ───────────────────────────────

router.post("/exchange", authenticate, async (req, res) => {
  const { coachSessionId, questionIndex, selectedOptionIndex, message = "", giveUp = false } = req.body || {};

  if (coachSessionId == null || questionIndex == null || selectedOptionIndex == null) {
    return res.status(400).json({ error: "coachSessionId, questionIndex, and selectedOptionIndex are required" });
  }
  if (questionIndex < 0 || questionIndex > 3) {
    return res.status(400).json({ error: "questionIndex must be 0–3" });
  }

  const session = db
    .prepare("SELECT * FROM coach_sessions WHERE id = ? AND user_id = ?")
    .get(coachSessionId, req.userId);
  if (!session) return res.status(404).json({ error: "Coach session not found" });

  const questions = JSON.parse(session.questions_json);
  const q = questions[questionIndex];

  // Find or create the attempt for this question
  let attempt = db
    .prepare("SELECT * FROM coach_attempts WHERE coach_session_id = ? AND question_index = ?")
    .get(coachSessionId, questionIndex);

  if (!attempt) {
    const isCorrect = selectedOptionIndex === q.correctIndex ? 1 : 0;
    const selectedTrap = selectedOptionIndex === q.trapIndex ? 1 : 0;
    const r = db
      .prepare(
        `INSERT INTO coach_attempts
           (coach_session_id, question_index, question_type, selected_option_index,
            correct_option_index, is_correct, selected_trap, trap_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(coachSessionId, questionIndex, q.type, selectedOptionIndex,
           q.correctIndex, isCorrect, selectedTrap, q.trapType);
    attempt = db.prepare("SELECT * FROM coach_attempts WHERE id = ?").get(r.lastInsertRowid);
  }

  if (attempt.is_complete) {
    return res.status(400).json({ error: "Debrief for this question is already complete" });
  }

  const conversation = JSON.parse(attempt.conversation_json || "[]");
  // exchange_number = how many tutor messages have been sent + 1 (for this one)
  const tutorMessagesSent = conversation.filter((m) => m.role === "tutor").length;
  const exchangeNumber = tutorMessagesSent + 1;

  // Add student's message to conversation (skip for exchange 1 — tutor opens)
  if (message.trim() && exchangeNumber > 1) {
    conversation.push({ role: "student", text: message.trim() });
  }

  const isReveal = giveUp || exchangeNumber >= 4;

  try {
    const aiResponse = await callModel({
      maxTokens: isReveal ? 512 : 256,
      system: SOCRATIC_SYSTEM,
      messages: [{
        role: "user",
        content: buildSocraticUserMessage(
          session.article_text, q, selectedOptionIndex,
          conversation, exchangeNumber, message, giveUp
        ),
      }],
    });

    logApiCall({
      userId: req.userId,
      route: "/api/coach/exchange",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      inputTokens: aiResponse.usage.input_tokens,
      outputTokens: aiResponse.usage.output_tokens,
      status: "ok",
    });

    const tutorMessage = aiResponse.text.trim();
    conversation.push({ role: "tutor", text: tutorMessage });

    const newExchangeCount = attempt.exchange_count + 1;

    if (isReveal) {
      // Debrief complete — save verdict and mark attempt done
      db.prepare(
        `UPDATE coach_attempts
           SET conversation_json = ?, exchange_count = ?, final_verdict = ?, is_complete = 1
         WHERE id = ?`
      ).run(JSON.stringify(conversation), newExchangeCount, tutorMessage, attempt.id);

      // Check if all 4 questions are now complete; if so, mark session complete
      const completedCount = db
        .prepare("SELECT COUNT(*) as n FROM coach_attempts WHERE coach_session_id = ? AND is_complete = 1")
        .get(coachSessionId).n;
      if (completedCount >= 4) {
        db.prepare("UPDATE coach_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(coachSessionId);
      }

      return res.json({
        tutorMessage,
        exchangeNumber: newExchangeCount,
        isComplete: true,
        // Reveal sensitive fields now that the debrief is over
        correctIndex: q.correctIndex,
        trapIndex: q.trapIndex,
        trapType: q.trapType,
        sourceLines: q.sourceLines,
        isCorrect: selectedOptionIndex === q.correctIndex,
      });
    }

    db.prepare(
      "UPDATE coach_attempts SET conversation_json = ?, exchange_count = ? WHERE id = ?"
    ).run(JSON.stringify(conversation), newExchangeCount, attempt.id);

    return res.json({
      tutorMessage,
      exchangeNumber: newExchangeCount,
      isComplete: false,
    });

  } catch (err) {
    console.error("Coach exchange error:", err.message);
    logApiCall({
      userId: req.userId,
      route: "/api/coach/exchange",
      provider: "openrouter",
      model: DEFAULT_MODEL,
      status: "error",
    });
    return res.status(502).json({ error: "AI tutor unavailable. Please try again." });
  }
});

// ── GET /api/coach/sessions/:id — full session data ───────────────────────────

router.get("/sessions/:id", authenticate, (req, res) => {
  const session = db
    .prepare("SELECT * FROM coach_sessions WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Coach session not found" });

  const questions = JSON.parse(session.questions_json);
  const attempts = db
    .prepare("SELECT * FROM coach_attempts WHERE coach_session_id = ? ORDER BY question_index")
    .all(session.id);

  // For completed attempts, expose answer data; for active ones, strip it
  const enrichedAttempts = attempts.map((a) => ({
    ...a,
    conversation: JSON.parse(a.conversation_json || "[]"),
    // Only reveal correctIndex etc. for complete attempts
    ...(a.is_complete
      ? {
          correctIndex: questions[a.question_index]?.correctIndex,
          sourceLines: questions[a.question_index]?.sourceLines,
        }
      : {}),
  }));

  res.json({
    coachSession: {
      id: session.id,
      articleTitle: session.article_title,
      articleSource: session.article_source,
      articleText: session.article_text,
      wordCount: session.word_count,
      status: session.status,
      createdAt: session.created_at,
      questions: questions.map((q, i) => {
        const attempt = attempts.find((a) => a.question_index === i);
        // Strip sensitive fields unless this question's debrief is complete
        return attempt?.is_complete
          ? { ...stripQuestion(q), correctIndex: q.correctIndex, trapIndex: q.trapIndex, trapType: q.trapType, sourceLines: q.sourceLines }
          : stripQuestion(q);
      }),
    },
    attempts: enrichedAttempts,
  });
});

// ── GET /api/coach/history — past sessions with aggregate stats ───────────────

router.get("/history", authenticate, (req, res) => {
  const sessions = db
    .prepare(
      `SELECT cs.id, cs.article_title, cs.article_source, cs.word_count, cs.status,
              cs.created_at, cs.completed_at,
              COUNT(ca.id) as attempted,
              SUM(ca.is_correct) as correct,
              AVG(ca.exchange_count) as avg_exchanges
       FROM coach_sessions cs
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id AND ca.is_complete = 1
       WHERE cs.user_id = ?
       GROUP BY cs.id
       ORDER BY cs.created_at DESC`
    )
    .all(req.userId);

  res.json({ sessions });
});

// ── GET /api/coach/stats — aggregate stats for Dashboard Coach tab ─────────────

router.get("/stats", authenticate, (req, res) => {
  const row = db
    .prepare(
      `SELECT
         COUNT(DISTINCT cs.id) as total_sessions,
         COUNT(ca.id) as total_questions,
         SUM(ca.is_correct) as total_correct,
         AVG(ca.exchange_count) as avg_exchanges
       FROM coach_sessions cs
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id AND ca.is_complete = 1
       WHERE cs.user_id = ?`
    )
    .get(req.userId);

  const byType = db
    .prepare(
      `SELECT question_type, COUNT(*) as attempts, SUM(is_correct) as correct
       FROM coach_attempts
       WHERE coach_session_id IN (SELECT id FROM coach_sessions WHERE user_id = ?)
         AND is_complete = 1
       GROUP BY question_type`
    )
    .all(req.userId);

  const recentSessions = db
    .prepare(
      `SELECT cs.id, cs.article_title, cs.article_source, cs.created_at,
              COUNT(ca.id) as attempted, SUM(ca.is_correct) as correct,
              AVG(ca.exchange_count) as avg_exchanges
       FROM coach_sessions cs
       LEFT JOIN coach_attempts ca ON ca.coach_session_id = cs.id AND ca.is_complete = 1
       WHERE cs.user_id = ?
       GROUP BY cs.id
       ORDER BY cs.created_at DESC
       LIMIT 10`
    )
    .all(req.userId);

  res.json({
    totalSessions: row.total_sessions || 0,
    totalQuestions: row.total_questions || 0,
    totalCorrect: row.total_correct || 0,
    avgExchanges: row.avg_exchanges ? Math.round(row.avg_exchanges * 10) / 10 : null,
    accuracy: row.total_questions ? row.total_correct / row.total_questions : null,
    byType: byType.reduce((acc, r) => {
      acc[r.question_type] = { attempts: r.attempts, correct: r.correct };
      return acc;
    }, {}),
    recentSessions,
  });
});

module.exports = router;
