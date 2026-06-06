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
router.get("/overview", (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
         (SELECT COUNT(*) FROM sessions) AS sessions,
         (SELECT COUNT(*) FROM attempts) AS attempts,
         (SELECT COUNT(*) FROM questions WHERE is_active = 1) AS questionsActive,
         (SELECT COUNT(*) FROM questions WHERE is_active = 0) AS questionsInactive,
         (SELECT COUNT(*) FROM question_flags WHERE status = 'open') AS flagsOpen,
         (SELECT COALESCE(SUM(est_cost_usd), 0) FROM api_calls) AS totalCostUsd,
         (SELECT COUNT(*) FROM api_calls) AS apiCallCount`
    )
    .get();

  const cutoff = `datetime('now', '-${ACTIVE_WINDOW_DAYS} days')`;
  const activeUsers = db
    .prepare(
      `SELECT COUNT(DISTINCT s.user_id) AS n
       FROM sessions s
       WHERE s.created_at >= ${cutoff}`
    )
    .get().n;

  res.json({ ...totals, activeUsers, activeWindowDays: ACTIVE_WINDOW_DAYS });
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
// Paginated list. ?q=search&page=1&pageSize=50
router.get("/users", (req, res) => {
  const q = (req.query.q || "").trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;

  const where = q ? "WHERE u.username LIKE ? OR u.email LIKE ?" : "";
  const params = q ? [`%${q}%`, `%${q}%`] : [];

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`).get(...params);

  const rows = db
    .prepare(
      `SELECT
         u.id, u.username, u.email, u.role, u.created_at,
         (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) AS sessions,
         (SELECT COUNT(*) FROM attempts a JOIN sessions s ON s.id = a.session_id
                                          WHERE s.user_id = u.id) AS attempts,
         (SELECT COALESCE(SUM(a.is_correct), 0)
            FROM attempts a JOIN sessions s ON s.id = a.session_id
            WHERE s.user_id = u.id AND a.skipped = 0) AS correct,
         (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS lastActivity
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);

  res.json({ users: rows, total, page, pageSize });
});

// ── GET /api/admin/users/:id ───────────────────────────────────────────────
// Full detail for one user. Includes a dashboard-style view for "read-only impersonation".
router.get("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ error: "invalid user id" });

  const user = db
    .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!user) return res.status(404).json({ error: "user not found" });

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS attempts,
         COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS answered,
         COALESCE(SUM(a.is_correct), 0) AS correct,
         COALESCE(SUM(a.selected_trap), 0) AS trapPicks,
         AVG(a.reasoning_score) AS avgReasoningScore
       FROM attempts a
       JOIN sessions s ON s.id = a.session_id
       WHERE s.user_id = ?`
    )
    .get(userId);

  const recentSessions = db
    .prepare(
      `SELECT id, num_questions, timer_mode, status, created_at, completed_at
       FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 10`
    )
    .all(userId);

  const apiCost = db
    .prepare(
      "SELECT COALESCE(SUM(est_cost_usd), 0) AS cost, COUNT(*) AS calls FROM api_calls WHERE user_id = ?"
    )
    .get(userId);

  res.json({ user, totals, recentSessions, apiCost });
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
// Change role or deactivate. Body: { role? } — admin cannot demote themselves.
router.patch("/users/:id", (req, res) => {
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
    const info = db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
    if (info.changes === 0) return res.status(404).json({ error: "user not found" });
  }

  res.json({ ok: true });
});

// ── DELETE /api/admin/users/:id/data ───────────────────────────────────────
// Wipe a user's attempts and sessions (keeps the account). Useful for support.
router.delete("/users/:id/data", (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ error: "invalid user id" });
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM attempts WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)"
    ).run(userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  });
  tx();
  res.json({ ok: true });
});

// ── GET /api/admin/users/:id/dashboard ─────────────────────────────────────
// Read-only impersonation: returns the same shape as /api/dashboard but for the
// target user. Reuses the public dashboard logic by calling its handler.
router.get("/users/:id/dashboard", (req, res, next) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ error: "invalid user id" });
  // Spoof req.userId for the dashboard handler call. We require the user to exist first.
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  req.userId = userId;
  req.adminImpersonating = true;
  return require("./dashboard").handle(req, res, next);
});

// ── GET /api/admin/questions ───────────────────────────────────────────────
// List with filters: ?q=search&type=&topic=&source=&active=
router.get("/questions", (req, res) => {
  const q = (req.query.q || "").trim();
  const { type, topic, source, active } = req.query;

  const where = [];
  const params = [];
  if (q) { where.push("(question LIKE ? OR paragraph LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (type)   { where.push("type = ?");   params.push(type); }
  if (topic)  { where.push("topic = ?");  params.push(topic); }
  if (source) { where.push("source = ?"); params.push(source); }
  if (active === "1") where.push("is_active = 1");
  else if (active === "0") where.push("is_active = 0");
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT id, topic, type, source, is_active, created_at,
              substr(question, 1, 100) AS question_snippet,
              (SELECT COUNT(*) FROM attempts WHERE question_id = questions.id) AS attempts,
              (SELECT COUNT(*) FROM question_flags WHERE question_id = questions.id AND status = 'open') AS openFlags
       FROM questions
       ${sql}
       ORDER BY id ASC`
    )
    .all(...params);

  res.json({ questions: rows, total: rows.length });
});

// ── GET /api/admin/questions/:id ───────────────────────────────────────────
router.get("/questions/:id", (req, res) => {
  const q = questionsRepo.findById(req.params.id) ||
    // findById skips inactive; fetch raw too so admin can edit deactivated ones
    (function () {
      const raw = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
      return raw ? questionsRepo.hydrate(raw) : null;
    })();
  if (!q) return res.status(404).json({ error: "question not found" });
  const flags = db
    .prepare(
      "SELECT id, source, reason, status, created_at, resolved_at FROM question_flags WHERE question_id = ? ORDER BY id DESC"
    )
    .all(req.params.id);
  res.json({ question: q, flags });
});

// validateQuestionPayload + normalizeOptions imported from ../lib/validateQuestion

// ── POST /api/admin/questions ──────────────────────────────────────────────
router.post("/questions", (req, res) => {
  const err = validateQuestionPayload(req.body);
  if (err) return res.status(400).json({ error: err });

  const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines } = req.body;
  // Generate a new id — 'a' prefix for admin-created, then timestamp+rand
  const id = req.body.id || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  try {
    db.prepare(
      `INSERT INTO questions
         (id, topic, paragraph, question, type, options_json,
          correct_index, trap_index, trap_type, source_lines, source, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 1)`
    ).run(
      id, topic, paragraph.trim(), question.trim(), type,
      JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
      correctIndex,
      trapIndex ?? null,
      trapIndex != null ? (trapType || null) : null,
      sourceLines.trim()
    );
    res.json({ ok: true, id });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "id already exists" });
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/admin/questions/:id ─────────────────────────────────────────
router.patch("/questions/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  // Toggle activation shortcut
  if (typeof req.body.isActive === "boolean") {
    db.prepare("UPDATE questions SET is_active = ? WHERE id = ?").run(
      req.body.isActive ? 1 : 0,
      req.params.id
    );
    return res.json({ ok: true });
  }

  const err = validateQuestionPayload(req.body);
  if (err) return res.status(400).json({ error: err });

  const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines } = req.body;
  db.prepare(
    `UPDATE questions SET
       topic = ?, paragraph = ?, question = ?, type = ?, options_json = ?,
       correct_index = ?, trap_index = ?, trap_type = ?, source_lines = ?
     WHERE id = ?`
  ).run(
    topic, paragraph.trim(), question.trim(), type,
    JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
    correctIndex,
    trapIndex ?? null,
    trapIndex != null ? (trapType || null) : null,
    sourceLines.trim(),
    req.params.id
  );
  res.json({ ok: true });
});

// ── DELETE /api/admin/questions/:id (soft delete) ──────────────────────────
router.delete("/questions/:id", (req, res) => {
  const info = db.prepare("UPDATE questions SET is_active = 0 WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ── POST /api/admin/questions/:id/flag ─────────────────────────────────────
// Admin flags a question for review (the 'admin' source). User thumbs-down
// and AI self-audit will populate this same table in later phases.
router.post("/questions/:id/flag", (req, res) => {
  const q = db.prepare("SELECT id FROM questions WHERE id = ?").get(req.params.id);
  if (!q) return res.status(404).json({ error: "not found" });
  db.prepare(
    `INSERT INTO question_flags (question_id, flagged_by_user_id, source, reason)
     VALUES (?, ?, 'admin', ?)`
  ).run(req.params.id, req.user.id, (req.body?.reason || "").slice(0, 500));
  res.json({ ok: true });
});

// ── GET /api/admin/flags ───────────────────────────────────────────────────
// Review queue — open flags first, with question snippet for context.
router.get("/flags", (req, res) => {
  const status = req.query.status || "open";
  const rows = db
    .prepare(
      `SELECT f.id, f.question_id, f.source, f.reason, f.status, f.resolution,
              f.created_at, f.resolved_at,
              substr(q.question, 1, 100) AS question_snippet,
              q.is_active AS question_active,
              u.username AS flagged_by_username
       FROM question_flags f
       JOIN questions q ON q.id = f.question_id
       LEFT JOIN users u ON u.id = f.flagged_by_user_id
       WHERE f.status = ?
       ORDER BY f.id DESC`
    )
    .all(status);
  res.json({ flags: rows });
});

// ── PATCH /api/admin/flags/:id ─────────────────────────────────────────────
// Resolve a flag. Body: { resolution: 'fixed' | 'deleted' | 'invalid' }
router.patch("/flags/:id", (req, res) => {
  const { resolution } = req.body || {};
  if (!["fixed", "deleted", "invalid"].includes(resolution)) {
    return res.status(400).json({ error: "invalid resolution" });
  }
  const info = db
    .prepare(
      "UPDATE question_flags SET status = 'resolved', resolution = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .run(resolution, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ── GET /api/admin/costs ───────────────────────────────────────────────────
// Aggregates for the costs page: by day, by model, by user, with running total.
router.get("/costs", (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(input_tokens), 0)  AS inputTokens,
         COALESCE(SUM(output_tokens), 0) AS outputTokens,
         COALESCE(SUM(est_cost_usd), 0)  AS costUsd,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
       FROM api_calls`
    )
    .get();

  const byDay = db
    .prepare(
      `SELECT date(created_at) AS day,
              COUNT(*) AS calls,
              COALESCE(SUM(est_cost_usd), 0) AS costUsd
       FROM api_calls
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY day
       ORDER BY day DESC`
    )
    .all();

  const byModel = db
    .prepare(
      `SELECT model, provider,
              COUNT(*) AS calls,
              COALESCE(SUM(input_tokens), 0)  AS inputTokens,
              COALESCE(SUM(output_tokens), 0) AS outputTokens,
              COALESCE(SUM(est_cost_usd), 0)  AS costUsd
       FROM api_calls
       GROUP BY model, provider
       ORDER BY costUsd DESC`
    )
    .all();

  const byUser = db
    .prepare(
      `SELECT c.user_id AS userId, u.username,
              COUNT(*) AS calls,
              COALESCE(SUM(c.est_cost_usd), 0) AS costUsd
       FROM api_calls c
       LEFT JOIN users u ON u.id = c.user_id
       GROUP BY c.user_id, u.username
       ORDER BY costUsd DESC
       LIMIT 50`
    )
    .all();

  res.json({ totals, byDay, byModel, byUser });
});

module.exports = router;
