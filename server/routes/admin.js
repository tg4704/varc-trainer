// Phase 9: admin routes. All gated by authenticate + requireAdmin. The legacy
// ADMIN_KEY query-param hack from the pre-Phase-9 file is retired.
const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate, requireAdmin } = require("../auth");
const { validateQuestionPayload, normalizeOptions } = require("../lib/validateQuestion");

router.use(authenticate, requireAdmin);

const ACTIVE_WINDOW_DAYS = 30; // "active user" definition

// ── GET /api/admin/overview ────────────────────────────────────────────────
// Top-level numbers shown on /admin home.
router.get("/overview", async (req, res, next) => {
  try {
    const totals = await db.get(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
         (SELECT COUNT(*) FROM sessions) AS sessions,
         (SELECT COUNT(*) FROM attempts) AS attempts,
         (SELECT COUNT(*) FROM questions WHERE is_active = 1) AS "questionsActive",
         (SELECT COUNT(*) FROM questions WHERE is_active = 0) AS "questionsInactive",
         (SELECT COUNT(*) FROM question_flags WHERE status = 'open') AS "flagsOpen",
         (SELECT COALESCE(SUM(est_cost_usd), 0) FROM api_calls) AS "totalCostUsd",
         (SELECT COUNT(*) FROM api_calls) AS "apiCallCount"`
    );

    const activeUsersRow = await db.get(
      `SELECT COUNT(DISTINCT s.user_id) AS n
       FROM sessions s
       WHERE s.created_at >= NOW() - INTERVAL '${ACTIVE_WINDOW_DAYS} days'`
    );

    res.json({ ...totals, activeUsers: parseInt(activeUsersRow.n, 10), activeWindowDays: ACTIVE_WINDOW_DAYS });
  } catch (e) { next(e); }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
// Paginated list. ?q=search&page=1&pageSize=50
router.get("/users", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
    const offset = (page - 1) * pageSize;

    let countSql, rowSql, params;
    if (q) {
      countSql = "SELECT COUNT(*) AS total FROM users u WHERE u.username ILIKE $1 OR u.email ILIKE $2";
      params = [`%${q}%`, `%${q}%`];
      rowSql = `SELECT
         u.id, u.username, u.email, u.role, u.created_at,
         (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) AS sessions,
         (SELECT COUNT(*) FROM attempts a JOIN sessions s ON s.id = a.session_id
                                          WHERE s.user_id = u.id) AS attempts,
         (SELECT COALESCE(SUM(a.is_correct), 0)
            FROM attempts a JOIN sessions s ON s.id = a.session_id
            WHERE s.user_id = u.id AND a.skipped = 0) AS correct,
         (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS "lastActivity"
       FROM users u
       WHERE u.username ILIKE $1 OR u.email ILIKE $2
       ORDER BY u.created_at DESC
       LIMIT $3 OFFSET $4`;
    } else {
      countSql = "SELECT COUNT(*) AS total FROM users u";
      params = [];
      rowSql = `SELECT
         u.id, u.username, u.email, u.role, u.created_at,
         (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) AS sessions,
         (SELECT COUNT(*) FROM attempts a JOIN sessions s ON s.id = a.session_id
                                          WHERE s.user_id = u.id) AS attempts,
         (SELECT COALESCE(SUM(a.is_correct), 0)
            FROM attempts a JOIN sessions s ON s.id = a.session_id
            WHERE s.user_id = u.id AND a.skipped = 0) AS correct,
         (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS "lastActivity"
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`;
    }

    const countRow = await db.get(countSql, params);
    const rowParams = q ? [...params, pageSize, offset] : [pageSize, offset];
    const rows = await db.all(rowSql, rowParams);

    res.json({ users: rows, total: parseInt(countRow.total, 10), page, pageSize });
  } catch (e) { next(e); }
});

// ── GET /api/admin/users/:id ───────────────────────────────────────────────
// Full detail for one user. Includes a dashboard-style view for "read-only impersonation".
router.get("/users/:id", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "invalid user id" });

    const user = await db.get(
      "SELECT id, username, email, role, created_at FROM users WHERE id = $1",
      [userId]
    );
    if (!user) return res.status(404).json({ error: "user not found" });

    const totals = await db.get(
      `SELECT
         COUNT(*) AS attempts,
         COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS answered,
         COALESCE(SUM(a.is_correct), 0) AS correct,
         COALESCE(SUM(a.selected_trap), 0) AS "trapPicks",
         AVG(a.reasoning_score) AS "avgReasoningScore"
       FROM attempts a
       JOIN sessions s ON s.id = a.session_id
       WHERE s.user_id = $1`,
      [userId]
    );

    const recentSessions = await db.all(
      `SELECT id, num_questions, timer_mode, status, created_at, completed_at
       FROM sessions WHERE user_id = $1 ORDER BY id DESC LIMIT 10`,
      [userId]
    );

    const apiCost = await db.get(
      "SELECT COALESCE(SUM(est_cost_usd), 0) AS cost, COUNT(*) AS calls FROM api_calls WHERE user_id = $1",
      [userId]
    );

    // Coach session stats — count sessions and most recent
    let coachStats = { total: 0, recentSessions: [] };
    try {
      const coachTotal = await db.get(
        "SELECT COUNT(*) AS n FROM coach_sessions WHERE user_id = $1",
        [userId]
      );
      const coachRecent = await db.all(
        `SELECT cs.id, p.title AS article_title, cs.created_at,
                (SELECT COUNT(*) FROM coach_attempts WHERE coach_session_id = cs.id) AS questions
         FROM coach_sessions cs
         JOIN passages p ON p.id = cs.passage_id
         WHERE cs.user_id = $1 ORDER BY cs.id DESC LIMIT 5`,
        [userId]
      );
      coachStats = { total: parseInt(coachTotal.n, 10), recentSessions: coachRecent };
    } catch {
      // coach_sessions table may not exist on older DBs
    }

    res.json({ user, totals, recentSessions, apiCost, coachStats });
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
// Change role or deactivate. Body: { role? } — admin cannot demote themselves.
router.patch("/users/:id", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body || {};
    if (!userId) return res.status(400).json({ error: "invalid user id" });

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "role must be 'user' or 'admin'" });
      }
      if (userId === req.user.id && role !== "admin") {
        return res.status(400).json({ error: "cannot demote yourself" });
      }
      const info = await db.run("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
      if (info.rowCount === 0) return res.status(404).json({ error: "user not found" });
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /api/admin/users/:id/data ───────────────────────────────────────
// Wipe a user's attempts and sessions (keeps the account). Useful for support.
router.delete("/users/:id/data", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "invalid user id" });
    await db.transaction(async (client) => {
      await client.query(
        "DELETE FROM attempts WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)",
        [userId]
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /api/admin/users/:id/dashboard ─────────────────────────────────────
// Read-only impersonation: returns the same shape as /api/dashboard but for the
// target user. Reuses the public dashboard logic by calling its handler.
router.get("/users/:id/dashboard", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "invalid user id" });
    // Spoof req.userId for the dashboard handler call. We require the user to exist first.
    const user = await db.get("SELECT id FROM users WHERE id = $1", [userId]);
    if (!user) return res.status(404).json({ error: "user not found" });
    req.userId = userId;
    req.adminImpersonating = true;
    return require("./dashboard").handle(req, res, next);
  } catch (e) { next(e); }
});

// ── GET /api/admin/questions ───────────────────────────────────────────────
// List with filters: ?q=search&type=&topic=&source=&active=&product=drills|coach
router.get("/questions", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const { type, topic, source, active, product } = req.query;

    const where = [];
    const params = [];
    if (q) {
      where.push(`(question ILIKE $${params.length + 1} OR paragraph ILIKE $${params.length + 2})`);
      params.push(`%${q}%`, `%${q}%`);
    }
    if (type)   { where.push(`type = $${params.length + 1}`);   params.push(type); }
    if (topic)  { where.push(`topic = $${params.length + 1}`);  params.push(topic); }
    if (source) { where.push(`source = $${params.length + 1}`); params.push(source); }
    if (active === "1") where.push("is_active = 1");
    else if (active === "0") where.push("is_active = 0");
    // Product boundary: passage_id NULL = ③ Drills, set = ② Coach (see questionsRepo.js).
    if (product === "drills") where.push("passage_id IS NULL");
    else if (product === "coach") where.push("passage_id IS NOT NULL");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT id, topic, type, source, is_active, created_at, passage_id AS "passageId",
              (SELECT title FROM passages WHERE id = questions.passage_id) AS "passageTitle",
              substr(question, 1, 100) AS question_snippet,
              (SELECT COUNT(*) FROM attempts WHERE question_id = questions.id) AS attempts,
              (SELECT COUNT(*) FROM question_flags WHERE question_id = questions.id AND status = 'open') AS "openFlags"
       FROM questions
       ${whereSql}
       ORDER BY id ASC`,
      params
    );

    res.json({ questions: rows, total: rows.length });
  } catch (e) { next(e); }
});

// ── GET /api/admin/questions/:id ───────────────────────────────────────────
router.get("/questions/:id", async (req, res, next) => {
  try {
    let q = await questionsRepo.findById(req.params.id);
    if (!q) {
      // findById skips inactive; fetch raw too so admin can edit deactivated ones
      const raw = await db.get("SELECT * FROM questions WHERE id = $1", [req.params.id]);
      q = raw ? questionsRepo.hydrate(raw) : null;
    }
    if (!q) return res.status(404).json({ error: "question not found" });
    const flags = await db.all(
      "SELECT id, source, reason, status, created_at, resolved_at FROM question_flags WHERE question_id = $1 ORDER BY id DESC",
      [req.params.id]
    );
    res.json({ question: q, flags });
  } catch (e) { next(e); }
});

// validateQuestionPayload + normalizeOptions imported from ../lib/validateQuestion

// ── POST /api/admin/questions ──────────────────────────────────────────────
router.post("/questions", async (req, res, next) => {
  try {
    const err = validateQuestionPayload(req.body);
    if (err) return res.status(400).json({ error: err });

    const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines } = req.body;
    // Generate a new id — 'a' prefix for admin-created, then timestamp+rand
    const id = req.body.id || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    try {
      await db.run(
        `INSERT INTO questions
           (id, topic, paragraph, question, type, options_json,
            correct_index, trap_index, trap_type, source_lines, source, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'seed', 1)`,
        [
          id, topic, paragraph.trim(), question.trim(), type,
          JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
          correctIndex,
          trapIndex ?? null,
          trapIndex != null ? (trapType || null) : null,
          sourceLines.trim(),
        ]
      );
      res.json({ ok: true, id });
    } catch (e) {
      if (e.message.includes("unique") || e.message.includes("duplicate")) return res.status(409).json({ error: "id already exists" });
      res.status(500).json({ error: e.message });
    }
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/questions/:id ─────────────────────────────────────────
router.patch("/questions/:id", async (req, res, next) => {
  try {
    const existing = await db.get("SELECT * FROM questions WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "not found" });

    // Toggle activation shortcut
    if (typeof req.body.isActive === "boolean") {
      await db.run(
        "UPDATE questions SET is_active = $1 WHERE id = $2",
        [req.body.isActive ? 1 : 0, req.params.id]
      );
      return res.json({ ok: true });
    }

    const err = validateQuestionPayload(req.body);
    if (err) return res.status(400).json({ error: err });

    const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines } = req.body;
    await db.run(
      `UPDATE questions SET
         topic = $1, paragraph = $2, question = $3, type = $4, options_json = $5,
         correct_index = $6, trap_index = $7, trap_type = $8, source_lines = $9
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

// ── DELETE /api/admin/questions/:id (soft delete) ──────────────────────────
router.delete("/questions/:id", async (req, res, next) => {
  try {
    const info = await db.run("UPDATE questions SET is_active = 0 WHERE id = $1", [req.params.id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/admin/questions/:id/flag ─────────────────────────────────────
// Admin flags a question for review (the 'admin' source). User thumbs-down
// and AI self-audit will populate this same table in later phases.
router.post("/questions/:id/flag", async (req, res, next) => {
  try {
    const q = await db.get("SELECT id FROM questions WHERE id = $1", [req.params.id]);
    if (!q) return res.status(404).json({ error: "not found" });
    await db.run(
      `INSERT INTO question_flags (question_id, flagged_by_user_id, source, reason)
       VALUES ($1, $2, 'admin', $3)`,
      [req.params.id, req.user.id, (req.body?.reason || "").slice(0, 500)]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /api/admin/flags ───────────────────────────────────────────────────
// Review queue — open flags first, with question snippet for context.
router.get("/flags", async (req, res, next) => {
  try {
    const status = req.query.status || "open";
    const rows = await db.all(
      `SELECT f.id, f.question_id, f.source, f.reason, f.status, f.resolution,
              f.created_at, f.resolved_at,
              substr(q.question, 1, 100) AS question_snippet,
              q.is_active AS question_active,
              u.username AS flagged_by_username
       FROM question_flags f
       JOIN questions q ON q.id = f.question_id
       LEFT JOIN users u ON u.id = f.flagged_by_user_id
       WHERE f.status = $1
       ORDER BY f.id DESC`,
      [status]
    );
    res.json({ flags: rows });
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/flags/:id ─────────────────────────────────────────────
// Resolve a flag. Body: { resolution: 'fixed' | 'deleted' | 'invalid' }
// resolution='deleted' also soft-deletes the question (sets is_active=0).
router.patch("/flags/:id", async (req, res, next) => {
  try {
    const { resolution } = req.body || {};
    if (!["fixed", "deleted", "invalid"].includes(resolution)) {
      return res.status(400).json({ error: "invalid resolution" });
    }
    const flag = await db.get("SELECT * FROM question_flags WHERE id = $1", [req.params.id]);
    if (!flag) return res.status(404).json({ error: "not found" });

    if (resolution === "deleted") {
      // Approve flag: remove question from the active bank
      await db.run("UPDATE questions SET is_active = 0 WHERE id = $1", [flag.question_id]);
    }

    await db.run(
      "UPDATE question_flags SET status = 'resolved', resolution = $1, resolved_at = NOW() WHERE id = $2",
      [resolution, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /api/admin/passages ────────────────────────────────────────────────
// List passages (② Coach) with question counts, for review + activation.
// A passage's questions can be individually activated in Admin → Questions,
// but the passage itself gates whether it shows up in the Coach picker at all —
// activate it here once you've reviewed its questions.
router.get("/passages", async (req, res, next) => {
  try {
    const active = req.query.active;
    const where = [];
    if (active === "1") where.push("p.is_active = 1");
    else if (active === "0") where.push("p.is_active = 0");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT p.id, p.topic, p.genre, p.title, p.word_count AS "wordCount",
              p.source, p.is_active, p.created_at,
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id) AS "questionCount",
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id AND is_active = 1) AS "activeQuestionCount"
       FROM passages p
       ${whereSql}
       ORDER BY p.id DESC`
    );
    res.json({ passages: rows, total: rows.length });
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/passages/:id ──────────────────────────────────────────
// Toggle a passage's is_active. Body: { isActive: boolean }
router.patch("/passages/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ error: "id and isActive (boolean) are required" });
    }
    const info = await db.run("UPDATE passages SET is_active = $1 WHERE id = $2", [req.body.isActive ? 1 : 0, id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/admin/import ─────────────────────────────────────────────────
// Bulk-import content generated in Claude chat (see content-pipeline/GENERATION_KIT.md).
// Accepts { kind: "passage_set", passage, questions } OR { kind: "drills", items }.
// Everything is inserted INACTIVE (is_active=0), source='ai_generated', for review.
const IMPORT_TOPICS = ["economics", "humanities", "philosophy", "science", "social"];
const IMPORT_TYPES = [
  "inference", "main_idea", "function", "tone", "detail", "application",
  "concept_set", "vocab_in_context", "weaken_strengthen", "title",
];
const IMPORT_TRAPS = [
  "too_extreme", "out_of_scope", "too_broad", "partially_correct", "real_but_unstated",
  "distortion", "wrong_question", "wrong_location", "mislabelled", "wordplay", "tone_mismatch",
];

// Validate one question object; returns an error string or null.
function validateImportQuestion(q, label) {
  if (!q || typeof q !== "object") return `${label}: not an object`;
  if (!q.question || !String(q.question).trim()) return `${label}: missing question`;
  if (!IMPORT_TYPES.includes(q.type)) return `${label}: type "${q.type}" not allowed`;
  if (!Array.isArray(q.options) || q.options.length !== 4) return `${label}: needs exactly 4 options`;
  for (let i = 0; i < 4; i++) {
    if (!q.options[i] || !String(q.options[i].text || "").trim()) return `${label}: option ${i} needs text`;
    const tt = q.options[i].trapType;
    if (tt && !IMPORT_TRAPS.includes(tt)) return `${label}: option ${i} trapType "${tt}" not allowed`;
  }
  if (![0, 1, 2, 3].includes(q.correctIndex)) return `${label}: correctIndex must be 0–3`;
  if (q.trapIndex != null) {
    if (![0, 1, 2, 3].includes(q.trapIndex)) return `${label}: trapIndex must be 0–3 or null`;
    if (q.trapIndex === q.correctIndex) return `${label}: trapIndex equals correctIndex`;
  }
  if (!q.sourceLines || !String(q.sourceLines).trim()) return `${label}: missing sourceLines`;
  return null;
}

// Build options_json preserving EACH option's archetype tag (unlike normalizeOptions,
// which only keeps the primary trap's tag).
function buildImportOptions(q) {
  return q.options.map((o, i) => ({
    text: String(o.text).trim(),
    isCorrect: i === q.correctIndex,
    isTrap: q.trapIndex != null && i === q.trapIndex,
    trapType: i === q.correctIndex ? null : (o.trapType ?? null),
  }));
}

let importSeq = 0;
function newQuestionId() {
  importSeq = (importSeq + 1) % 1000;
  return `ai${Date.now().toString(36)}${importSeq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

async function insertImportQuestion(client, q, { topic, paragraph, passageId }) {
  await client.query(
    `INSERT INTO questions
       (id, topic, paragraph, question, type, options_json,
        correct_index, trap_index, trap_type, source_lines, source, passage_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_generated',$11,0)`,
    [
      newQuestionId(), topic, paragraph.trim(), String(q.question).trim(), q.type,
      JSON.stringify(buildImportOptions(q)),
      q.correctIndex,
      q.trapIndex ?? null,
      q.trapIndex != null ? (q.trapType || null) : null,
      String(q.sourceLines).trim(),
      passageId,
    ]
  );
}

// Import one { kind: "passage_set" | "drills", ... } payload. Returns
// { passagesInserted, questionsInserted, errors }, or throws for a hard structural error
// (bad kind, missing required fields) that should abort the whole batch item.
async function importOnePayload(payload, itemLabel) {
  const errors = [];
  let passagesInserted = 0, questionsInserted = 0;

  if (payload.kind === "passage_set") {
    const p = payload.passage;
    if (!p || !String(p.body || "").trim()) throw new Error(`${itemLabel}: passage.body required`);
    if (!IMPORT_TOPICS.includes(p.topic)) throw new Error(`${itemLabel}: passage.topic must be one of: ${IMPORT_TOPICS.join(", ")}`);
    if (!p.reading_key || typeof p.reading_key !== "object") throw new Error(`${itemLabel}: passage.reading_key required`);
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    if (!questions.length) throw new Error(`${itemLabel}: questions[] required`);
    for (let i = 0; i < questions.length; i++) {
      const err = validateImportQuestion(questions[i], `${itemLabel} Q${i + 1}`);
      if (err) throw new Error(err); // whole set is atomic — reject on any bad Q
    }
    const wordCount = String(p.body).trim().split(/\s+/).length;
    await db.transaction(async (client) => {
      const row = await client.query(
        `INSERT INTO passages (topic, genre, title, body, word_count, reading_key_json, source, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,'ai_generated',0) RETURNING id`,
        [p.topic, p.genre || null, p.title || null, String(p.body).trim(), wordCount, JSON.stringify(p.reading_key)]
      );
      const passageId = row.rows[0].id;
      for (const q of questions) {
        await insertImportQuestion(client, q, { topic: p.topic, paragraph: String(p.body).trim(), passageId });
      }
      passagesInserted = 1;
      questionsInserted = questions.length;
    });
  } else if (payload.kind === "drills") {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) throw new Error(`${itemLabel}: items[] required`);
    // Drills are independent — insert the good ones, collect errors for the rest.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const label = `${itemLabel} Item ${i + 1}`;
      if (!IMPORT_TOPICS.includes(it.topic)) { errors.push(`${label}: topic "${it.topic}" not allowed`); continue; }
      if (!String(it.paragraph || "").trim()) { errors.push(`${label}: missing paragraph`); continue; }
      const err = validateImportQuestion(it, label);
      if (err) { errors.push(err); continue; }
      try {
        await db.transaction(async (client) => {
          await insertImportQuestion(client, it, { topic: it.topic, paragraph: String(it.paragraph).trim(), passageId: null });
        });
        questionsInserted++;
      } catch (e) { errors.push(`${label}: ${e.message}`); }
    }
  } else {
    throw new Error(`${itemLabel}: kind must be "passage_set" or "drills"`);
  }

  return { passagesInserted, questionsInserted, errors };
}

router.post("/import", async (req, res, next) => {
  try {
    const body = req.body;
    // Accept either one payload object or an array of them (e.g. multiple passage_sets
    // generated together in one Claude chat and pasted as a JSON array).
    const batch = Array.isArray(body) ? body : [body];
    if (!batch.length) return res.status(400).json({ error: "empty payload" });

    let passagesInserted = 0, questionsInserted = 0;
    const errors = [];
    for (let i = 0; i < batch.length; i++) {
      const itemLabel = batch.length > 1 ? `[${i + 1}/${batch.length}]` : "";
      try {
        const result = await importOnePayload(batch[i] || {}, itemLabel);
        passagesInserted += result.passagesInserted;
        questionsInserted += result.questionsInserted;
        errors.push(...result.errors);
      } catch (e) {
        errors.push(e.message); // hard failure on this array item — skip it, continue the batch
      }
    }

    res.json({ ok: true, passagesInserted, questionsInserted, errors });
  } catch (e) { next(e); }
});

// ── GET /api/admin/costs ───────────────────────────────────────────────────
// Aggregates for the costs page: by day, by model, by user, with running total.
router.get("/costs", async (req, res, next) => {
  try {
    const totals = await db.get(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(input_tokens), 0)  AS "inputTokens",
         COALESCE(SUM(output_tokens), 0) AS "outputTokens",
         COALESCE(SUM(est_cost_usd), 0)  AS "costUsd",
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
       FROM api_calls`
    );

    const byDay = await db.all(
      `SELECT DATE(created_at) AS day,
              COUNT(*) AS calls,
              COALESCE(SUM(est_cost_usd), 0) AS "costUsd"
       FROM api_calls
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day DESC`
    );

    const byModel = await db.all(
      `SELECT model, provider,
              COUNT(*) AS calls,
              COALESCE(SUM(input_tokens), 0)  AS "inputTokens",
              COALESCE(SUM(output_tokens), 0) AS "outputTokens",
              COALESCE(SUM(est_cost_usd), 0)  AS "costUsd"
       FROM api_calls
       GROUP BY model, provider
       ORDER BY "costUsd" DESC`
    );

    const byUser = await db.all(
      `SELECT c.user_id AS "userId", u.username,
              COUNT(*) AS calls,
              COALESCE(SUM(c.est_cost_usd), 0) AS "costUsd"
       FROM api_calls c
       LEFT JOIN users u ON u.id = c.user_id
       GROUP BY c.user_id, u.username
       ORDER BY "costUsd" DESC
       LIMIT 50`
    );

    res.json({ totals, byDay, byModel, byUser });
  } catch (e) { next(e); }
});

module.exports = router;
