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
        `SELECT id, article_title, created_at,
                (SELECT COUNT(*) FROM coach_attempts WHERE coach_session_id = cs.id) AS questions
         FROM coach_sessions cs WHERE user_id = $1 ORDER BY id DESC LIMIT 5`,
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
// List with filters: ?q=search&type=&topic=&source=&active=
router.get("/questions", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const { type, topic, source, active } = req.query;

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
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT id, topic, type, source, is_active, created_at,
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
router.patch("/flags/:id", async (req, res, next) => {
  try {
    const { resolution } = req.body || {};
    if (!["fixed", "deleted", "invalid"].includes(resolution)) {
      return res.status(400).json({ error: "invalid resolution" });
    }
    const info = await db.run(
      "UPDATE question_flags SET status = 'resolved', resolution = $1, resolved_at = NOW() WHERE id = $2",
      [resolution, req.params.id]
    );
    if (info.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
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
