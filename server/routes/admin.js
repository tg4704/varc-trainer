// Phase 9: admin routes. All gated by authenticate + requireAdmin. The legacy
// ADMIN_KEY query-param hack from the pre-Phase-9 file is retired.
const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate, requireAdmin } = require("../auth");
const { validateQuestionPayload, normalizeOptions, VALID_DIFFICULTIES } = require("../lib/validateQuestion");
const { DEFAULTS: PROMPT_DEFAULTS, invalidatePromptCache } = require("../ai/prompts");

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
         u.tier, u.tier_expires_at AS "tierExpiresAt",
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
         u.tier, u.tier_expires_at AS "tierExpiresAt",
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
      "SELECT id, username, email, role, tier, tier_expires_at, created_at FROM users WHERE id = $1",
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

    // Coach session stats - count sessions and most recent
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

    // Recurring subscription (for the force-cancel control).
    let subscription = null;
    try {
      const subs = require("../lib/subscriptions");
      const sub = await subs.getActiveSubscription(userId);
      if (sub) {
        subscription = {
          id: sub.razorpay_subscription_id,
          tier: sub.tier,
          status: sub.status,
          cancelAtCycleEnd: sub.cancel_at_cycle_end,
          currentEnd: sub.current_end || null,
        };
      }
    } catch {
      // subscriptions table may not exist on older DBs
    }

    // Plan limits + how much of them this user has actually consumed. Mirrors
    // the maths in GET /api/billing/me exactly (same helpers, same
    // daily-vs-monthly rule) so what an admin sees on this page and what the
    // user sees on My Plan can never disagree. `enforced` reports the
    // ENABLE_TIERS flag, because with it off these numbers are informational
    // only — nothing is actually being blocked.
    let entitlement = null;
    try {
      const { getTier, ENABLE_TIERS } = require("../config/tiers");
      const {
        effectiveTierKey, countTodayDrills, countTodayCoach,
        countMonthDrills, countMonthCoach,
      } = require("../lib/entitlements");

      const key = effectiveTierKey(user);
      const tier = getTier(key);
      // A tier with no daily cap is metered monthly instead.
      const meteredMonthly = tier.caps?.drills == null && tier.caps?.coach == null;
      entitlement = {
        effectiveTier: key,          // may differ from user.tier if it expired
        tierName: tier.name,
        enforced: ENABLE_TIERS,
        period: meteredMonthly ? "month" : "day",
        caps: meteredMonthly ? tier.monthlyCaps : tier.caps,
        used: meteredMonthly
          ? { drills: await countMonthDrills(user.id), coach: await countMonthCoach(user.id) }
          : { drills: await countTodayDrills(user.id), coach: await countTodayCoach(user.id) },
        // Always show today's figures too — the useful number when a user
        // writes in saying "it says I've hit my limit".
        today: { drills: await countTodayDrills(user.id), coach: await countTodayCoach(user.id) },
      };
    } catch (e) {
      console.error("[admin] entitlement lookup failed:", e.message);
    }

    res.json({ user, totals, recentSessions, apiCost, coachStats, subscription, entitlement });
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
// Change role or deactivate. Body: { role? } - admin cannot demote themselves.
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

// ── PATCH /api/admin/users/:id/tier ────────────────────────────────────────
// Grant / extend / revoke a paid tier manually (support, comps, testing).
// Body: { tier: 'free'|'inference'|'ninetyninth'|'topper', months? }.
router.patch("/users/:id/tier", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "invalid user id" });
    const { getTier, isValidPaidTier } = require("../config/tiers");
    const tier = String(req.body?.tier || "");
    const months = Math.min(36, Math.max(1, parseInt(req.body?.months, 10) || 1));

    if (tier === "free") {
      const info = await db.run("UPDATE users SET tier = 'free', tier_expires_at = NULL WHERE id = $1", [userId]);
      if (info.rowCount === 0) return res.status(404).json({ error: "user not found" });
    } else if (isValidPaidTier(tier)) {
      const info = await db.run(
        `UPDATE users
            SET tier = $1,
                tier_expires_at = GREATEST(NOW(), COALESCE(tier_expires_at, NOW())) + ($2 || ' months')::interval
          WHERE id = $3`,
        [tier, String(months), userId]
      );
      if (info.rowCount === 0) return res.status(404).json({ error: "user not found" });
    } else {
      return res.status(400).json({ error: "unknown tier" });
    }

    // Audit trail. A manually granted tier is a plan the user holds without a
    // Razorpay payment behind it, so without this it would be invisible in the
    // payments log - and "why does this account have Topper?" would have no
    // answer. Recorded as a ₹0 'manual' row, attributed to the acting admin.
    await db.run(
      `INSERT INTO payments (user_id, tier, months, amount_inr, provider, razorpay_order_id, status, period, captured_at, granted_by)
       VALUES ($1, $2, $3, 0, 'manual', $4, 'captured', 'manual', NOW(), $5)`,
      [userId, tier, tier === "free" ? 0 : months, `manual_${userId}_${Date.now()}`, req.userId]
    );

    const updated = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [userId]);
    res.json({ ok: true, tier: updated.tier, tierName: getTier(updated.tier).name, expiresAt: updated.tier_expires_at });
  } catch (e) { next(e); }
});

// ── POST /api/admin/users/:id/force-cancel ─────────────────────────────────
// Immediately cancel the user's active recurring subscription AND drop them to
// the free tier right now (no waiting for period end). For abuse / chargebacks /
// support overrides. Distinct from the user's own cancel, which is period-end.
router.post("/users/:id/force-cancel", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "invalid user id" });
    const subs = require("../lib/subscriptions");
    const { downgradeToFree } = require("../lib/grants");

    const sub = await subs.getActiveSubscription(userId);
    if (sub) await subs.cancelSubscription(sub, { immediate: true });
    await downgradeToFree(userId);

    const updated = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [userId]);
    res.json({ ok: true, cancelled: Boolean(sub), tier: updated.tier, expiresAt: updated.tier_expires_at });
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
    // Trashed rows live in Admin → Deleted, not here.
    where.push("deleted_at IS NULL");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT id, topic, type, source, is_active, created_at, difficulty, passage_id AS "passageId",
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

    const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines, difficulty } = req.body;
    // Generate a new id - 'a' prefix for admin-created, then timestamp+rand
    const id = req.body.id || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    try {
      await db.run(
        `INSERT INTO questions
           (id, topic, paragraph, question, type, options_json,
            correct_index, trap_index, trap_type, source_lines, source, is_active, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'seed', 1, $11)`,
        [
          id, topic, paragraph.trim(), question.trim(), type,
          JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
          correctIndex,
          trapIndex ?? null,
          trapIndex != null ? (trapType || null) : null,
          sourceLines.trim(),
          difficulty || "medium",
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

    const { topic, paragraph, question, type, options, correctIndex, trapIndex, trapType, sourceLines, difficulty } = req.body;
    await db.run(
      `UPDATE questions SET
         topic = $1, paragraph = $2, question = $3, type = $4, options_json = $5,
         correct_index = $6, trap_index = $7, trap_type = $8, source_lines = $9,
         difficulty = COALESCE($10, difficulty)
       WHERE id = $11`,
      [
        topic, paragraph.trim(), question.trim(), type,
        JSON.stringify(normalizeOptions(options, correctIndex, trapIndex ?? null, trapType)),
        correctIndex,
        trapIndex ?? null,
        trapIndex != null ? (trapType || null) : null,
        sourceLines.trim(),
        difficulty || null,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /api/admin/questions/:id (move to trash) ────────────────────────
// Sets deleted_at (+ is_active=0) so the row lands in Admin → Deleted, is
// restorable, and is hard-purged after TRASH_TTL_DAYS (server/lib/trash.js).
router.delete("/questions/:id", async (req, res, next) => {
  try {
    const info = await db.run(
      "UPDATE questions SET is_active = 0, deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (info.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/admin/questions/bulk ─────────────────────────────────────────
// Body: { ids: string[], action: 'activate' | 'deactivate' | 'delete' }
// 'delete' here moves rows to the trash (deleted_at + is_active=0), matching the
// single DELETE /questions/:id - they show up in Admin → Deleted and are hard-
// purged after TRASH_TTL_DAYS. attempts.question_id is a plain TEXT column with
// no FK, so attempt history survives the eventual hard delete.
router.post("/questions/bulk", async (req, res, next) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids (non-empty array) is required" });
    }
    if (!["activate", "deactivate", "delete"].includes(action)) {
      return res.status(400).json({ error: "action must be activate, deactivate or delete" });
    }
    if (ids.length > 500) return res.status(400).json({ error: "at most 500 ids per request" });

    const info = action === "delete"
      ? await db.run("UPDATE questions SET is_active = 0, deleted_at = NOW() WHERE id = ANY($1) AND deleted_at IS NULL", [ids])
      : await db.run("UPDATE questions SET is_active = $1 WHERE id = ANY($2)", [action === "activate" ? 1 : 0, ids]);

    res.json({ ok: true, affected: info.rowCount });
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
// Review queue - open flags first, with question snippet for context.
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
// but the passage itself gates whether it shows up in the Coach picker at all -
// activate it here once you've reviewed its questions.
router.get("/passages", async (req, res, next) => {
  try {
    const active = req.query.active;
    const where = ["p.deleted_at IS NULL"]; // trashed passages live in Admin → Deleted
    if (active === "1") where.push("p.is_active = 1");
    else if (active === "0") where.push("p.is_active = 0");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT p.id, p.topic, p.genre, p.title, p.word_count AS "wordCount",
              p.source, p.is_active, p.created_at,
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id AND deleted_at IS NULL) AS "questionCount",
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id AND deleted_at IS NULL AND is_active = 1) AS "activeQuestionCount"
       FROM passages p
       ${whereSql}
       ORDER BY p.id DESC`
    );
    res.json({ passages: rows, total: rows.length });
  } catch (e) { next(e); }
});

// ── GET /api/admin/passages/:id ────────────────────────────────────────────
// Full passage (for the Coach detail page) + its non-trashed questions.
router.get("/passages/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "invalid passage id" });
    const passage = await db.get(
      `SELECT id, topic, genre, title, body, word_count AS "wordCount",
              reading_key_json, source, is_active, created_at
       FROM passages WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!passage) return res.status(404).json({ error: "passage not found" });
    const questions = await db.all(
      `SELECT id, type, topic, difficulty, is_active, created_at,
              substr(question, 1, 120) AS question_snippet,
              (SELECT COUNT(*) FROM attempts WHERE question_id = questions.id) AS attempts
       FROM questions
       WHERE passage_id = $1 AND deleted_at IS NULL
       ORDER BY id ASC`,
      [id]
    );
    res.json({ passage, questions });
  } catch (e) { next(e); }
});

// ── PUT /api/admin/passages/:id ────────────────────────────────────────────
// Edit passage fields. Body: { topic, genre, title, body }. Recomputes word_count.
router.put("/passages/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "invalid passage id" });
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    const genre = typeof req.body?.genre === "string" ? req.body.genre.trim() : null;
    if (!body) return res.status(400).json({ error: "body is required" });
    if (!topic) return res.status(400).json({ error: "topic is required" });
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const info = await db.run(
      `UPDATE passages SET topic = $1, genre = $2, title = $3, body = $4, word_count = $5
       WHERE id = $6 AND deleted_at IS NULL`,
      [topic, genre, title || null, body, wordCount, id]
    );
    if (info.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true, wordCount });
  } catch (e) { next(e); }
});

// ── PATCH /api/admin/passages/:id ──────────────────────────────────────────
// Toggle a passage's is_active. Body: { isActive: boolean }.
// Activation cascades to the passage's questions in BOTH directions: activating
// a passage activates all its (non-trashed) questions, deactivating deactivates
// them - so a Coach passage and its question set are never half-live.
router.patch("/passages/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ error: "id and isActive (boolean) are required" });
    }
    const active = req.body.isActive ? 1 : 0;
    let affectedQuestions = 0;
    let found = false;
    await db.transaction(async (client) => {
      const info = await client.query(
        "UPDATE passages SET is_active = $1 WHERE id = $2 AND deleted_at IS NULL",
        [active, id]
      );
      if (info.rowCount === 0) return;
      const qInfo = await client.query(
        "UPDATE questions SET is_active = $1 WHERE passage_id = $2 AND deleted_at IS NULL",
        [active, id]
      );
      affectedQuestions = qInfo.rowCount;
      found = true;
    });
    if (!found) return res.status(404).json({ error: "not found" });
    res.json({ ok: true, affectedQuestions });
  } catch (e) { next(e); }
});

// ── POST /api/admin/passages/bulk ──────────────────────────────────────────
// Body: { ids: number[], action: 'activate' | 'deactivate' | 'delete' }
// activate/deactivate cascade to each passage's questions (see PATCH above).
// 'delete' moves the passage AND its questions to the trash (deleted_at set);
// they show in Admin → Deleted and are hard-purged after TRASH_TTL_DAYS, at
// which point any passage with Coach history is skipped (server/lib/trash.js).
router.post("/passages/bulk", async (req, res, next) => {
  try {
    const { ids: rawIds, action } = req.body || {};
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: "ids (non-empty array) is required" });
    }
    if (!["activate", "deactivate", "delete"].includes(action)) {
      return res.status(400).json({ error: "action must be activate, deactivate or delete" });
    }
    const ids = rawIds.map((i) => parseInt(i, 10)).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: "no valid ids" });
    if (ids.length > 500) return res.status(400).json({ error: "at most 500 ids per request" });

    let affected = 0;
    await db.transaction(async (client) => {
      if (action === "delete") {
        await client.query(
          "UPDATE questions SET is_active = 0, deleted_at = NOW() WHERE passage_id = ANY($1) AND deleted_at IS NULL",
          [ids]
        );
        const info = await client.query(
          "UPDATE passages SET is_active = 0, deleted_at = NOW() WHERE id = ANY($1) AND deleted_at IS NULL",
          [ids]
        );
        affected = info.rowCount;
      } else {
        const val = action === "activate" ? 1 : 0;
        const info = await client.query(
          "UPDATE passages SET is_active = $1 WHERE id = ANY($2) AND deleted_at IS NULL",
          [val, ids]
        );
        await client.query(
          "UPDATE questions SET is_active = $1 WHERE passage_id = ANY($2) AND deleted_at IS NULL",
          [val, ids]
        );
        affected = info.rowCount;
      }
    });

    res.json({ ok: true, affected, skipped: [] });
  } catch (e) { next(e); }
});

// ── GET /api/admin/trash ───────────────────────────────────────────────────
// Everything currently in the trash - drill questions + passages - newest
// deletion first, with days-left before the auto-purge.
router.get("/trash", async (req, res, next) => {
  try {
    const { TRASH_TTL_DAYS } = require("../lib/trash");
    const questions = await db.all(
      `SELECT id, topic, type, difficulty, source, deleted_at, created_at,
              passage_id AS "passageId",
              substr(question, 1, 100) AS question_snippet
       FROM questions
       WHERE deleted_at IS NOT NULL AND passage_id IS NULL
       ORDER BY deleted_at DESC`
    );
    const passages = await db.all(
      `SELECT p.id, p.topic, p.title, p.source, p.deleted_at, p.created_at,
              (SELECT COUNT(*) FROM questions WHERE passage_id = p.id) AS "questionCount",
              EXISTS(SELECT 1 FROM coach_sessions WHERE passage_id = p.id) AS "hasCoachHistory"
       FROM passages p
       WHERE p.deleted_at IS NOT NULL
       ORDER BY p.deleted_at DESC`
    );
    res.json({ questions, passages, ttlDays: TRASH_TTL_DAYS });
  } catch (e) { next(e); }
});

// ── POST /api/admin/trash/:kind/:id/restore ────────────────────────────────
// Pull an item back out of the trash. Restored INACTIVE (deleted_at cleared,
// is_active stays 0) so it's re-reviewed before going live. Restoring a passage
// also un-trashes its questions (but leaves them inactive too).
router.post("/trash/:kind/:id/restore", async (req, res, next) => {
  try {
    const { kind } = req.params;
    if (kind === "questions") {
      const info = await db.run(
        "UPDATE questions SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL",
        [req.params.id]
      );
      if (info.rowCount === 0) return res.status(404).json({ error: "not in trash" });
    } else if (kind === "passages") {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "invalid passage id" });
      let found = false;
      await db.transaction(async (client) => {
        const info = await client.query(
          "UPDATE passages SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL",
          [id]
        );
        if (info.rowCount === 0) return;
        await client.query("UPDATE questions SET deleted_at = NULL WHERE passage_id = $1", [id]);
        found = true;
      });
      if (!found) return res.status(404).json({ error: "not in trash" });
    } else {
      return res.status(400).json({ error: "kind must be 'questions' or 'passages'" });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /api/admin/trash/:kind/:id ──────────────────────────────────────
// Purge one trashed item immediately (don't wait for the 10-day sweep). A
// passage with Coach history is refused - that history must be kept.
router.delete("/trash/:kind/:id", async (req, res, next) => {
  try {
    const { kind } = req.params;
    if (kind === "questions") {
      const info = await db.run(
        "DELETE FROM questions WHERE id = $1 AND deleted_at IS NOT NULL",
        [req.params.id]
      );
      if (info.rowCount === 0) return res.status(404).json({ error: "not in trash" });
    } else if (kind === "passages") {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "invalid passage id" });
      const trashed = await db.get(
        "SELECT 1 AS x FROM passages WHERE id = $1 AND deleted_at IS NOT NULL",
        [id]
      );
      if (!trashed) return res.status(404).json({ error: "not in trash" });
      const used = await db.get(
        "SELECT 1 AS x FROM coach_sessions WHERE passage_id = $1 LIMIT 1",
        [id]
      );
      if (used) return res.status(409).json({ error: "passage has Coach sessions and can't be purged" });
      await db.transaction(async (client) => {
        // Questions first — questions.passage_id FKs to passages.
        await client.query("DELETE FROM questions WHERE passage_id = $1", [id]);
        await client.query("DELETE FROM passages WHERE id = $1", [id]);
      });
    } else {
      return res.status(400).json({ error: "kind must be 'questions' or 'passages'" });
    }
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
// requireDifficulty: true for ③ Drills items (difficulty is mandatory), false for
// ② Coach passage_set questions (difficulty is a Drills-only concept).
function validateImportQuestion(q, label, requireDifficulty = false) {
  if (!q || typeof q !== "object") return `${label}: not an object`;
  if (!q.question || !String(q.question).trim()) return `${label}: missing question`;
  if (!IMPORT_TYPES.includes(q.type)) return `${label}: type "${q.type}" not allowed`;
  if (requireDifficulty && !VALID_DIFFICULTIES.includes(q.difficulty)) {
    return `${label}: difficulty is required and must be one of: ${VALID_DIFFICULTIES.join(", ")}`;
  } else if (q.difficulty != null && !VALID_DIFFICULTIES.includes(q.difficulty)) {
    return `${label}: difficulty "${q.difficulty}" not allowed (use ${VALID_DIFFICULTIES.join(", ")})`;
  }
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
        correct_index, trap_index, trap_type, source_lines, source, passage_id, is_active, difficulty)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_generated',$11,0,$12)`,
    [
      newQuestionId(), topic, paragraph.trim(), String(q.question).trim(), q.type,
      JSON.stringify(buildImportOptions(q)),
      q.correctIndex,
      q.trapIndex ?? null,
      q.trapIndex != null ? (q.trapType || null) : null,
      String(q.sourceLines).trim(),
      passageId,
      q.difficulty || "medium", // Coach passage_set questions have no difficulty → medium
    ]
  );
}

// ── Passage-shape + reading-key gate ─────────────────────────────────────────
// These enforce, at import time, the contract GENERATION_KIT.md already asks
// the model for. Worth being strict here: the 2026-07-20 QA found all 5 seeded
// passages carrying reading_key_json = '{}', which the Coach grader silently
// destructures into "Thesis: undefined / Paragraph functions: (empty)" — so
// every reading-map grade was free-floating commentary rather than a
// comparison against a canonical reading, with no error anywhere to notice.
// Those rows were hand-inserted (source='user'), never passed through here,
// but the old check (`typeof reading_key !== "object"`) would have ACCEPTED
// them anyway, since `{}` is a truthy object.
const PASSAGE_MIN_PARAS = 3;   // GENERATION_KIT: "MUST be 3-5 distinct paragraphs"
const PASSAGE_MAX_PARAS = 5;
const PASSAGE_MIN_WORDS = 350; // GENERATION_KIT: "PASSAGE (350-500 words)"
const PASSAGE_MAX_WORDS = 500;

function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Import errors are prefixed with a batch position ("[2/5]") only when the
// request actually contained a batch. For a single-payload import itemLabel is
// "", so joining naively produced messages that began with a stray ": ".
function labelled(itemLabel, msg) {
  return itemLabel ? `${itemLabel}: ${msg}` : msg;
}
// Same idea for nested labels ("[2/5] Item 3" vs just "Item 3").
function sublabel(itemLabel, suffix) {
  return itemLabel ? `${itemLabel} ${suffix}` : suffix;
}

// Throws on a violation. `paraCount` is the passage's real paragraph count so
// we can confirm the key actually describes THIS passage.
function assertReadingKey(readingKey, paraCount, itemLabel) {
  const k = readingKey;
  if (!k || typeof k !== "object" || Array.isArray(k)) {
    throw new Error(labelled(itemLabel, `passage.reading_key required (object)`));
  }
  for (const field of ["thesis", "tone", "key_turn"]) {
    if (!nonEmptyString(k[field])) {
      throw new Error(labelled(itemLabel, `passage.reading_key.${field} must be a non-empty string`));
    }
  }
  if (!Array.isArray(k.paragraph_functions) || !k.paragraph_functions.length) {
    throw new Error(labelled(itemLabel, `passage.reading_key.paragraph_functions must be a non-empty array`));
  }
  if (!k.paragraph_functions.every(nonEmptyString)) {
    throw new Error(labelled(itemLabel, `passage.reading_key.paragraph_functions entries must be non-empty strings`));
  }
  // One function per paragraph — a mismatch means the key doesn't describe this
  // passage, which makes the grader's "structure" band meaningless.
  if (k.paragraph_functions.length !== paraCount) {
    throw new Error(
      labelled(itemLabel, `reading_key.paragraph_functions has ${k.paragraph_functions.length} entries but the passage has ${paraCount} paragraphs — one per paragraph is required`)
    );
  }
}

// Splits on blank lines, the same way the client renders paragraphs.
function countParagraphs(body) {
  return String(body).trim().split(/\n\s*\n/).filter((s) => s.trim()).length;
}

// Import one { kind: "passage_set" | "drills", ... } payload. Returns
// { passagesInserted, questionsInserted, errors }, or throws for a hard structural error
// (bad kind, missing required fields) that should abort the whole batch item.
async function importOnePayload(payload, itemLabel) {
  const errors = [];
  let passagesInserted = 0, questionsInserted = 0;

  if (payload.kind === "passage_set") {
    const p = payload.passage;
    if (!p || !String(p.body || "").trim()) throw new Error(labelled(itemLabel, `passage.body required`));
    if (!IMPORT_TOPICS.includes(p.topic)) throw new Error(labelled(itemLabel, `passage.topic must be one of: ${IMPORT_TOPICS.join(", ")}`));
    // Passage must be genuinely multi-paragraph: Coach's reading map asks for
    // one crux entry PER PARAGRAPH, so a single unbroken block gives the
    // student one box and leaves the grader's structure band nothing to score.
    const paraCount = countParagraphs(p.body);
    if (paraCount < PASSAGE_MIN_PARAS || paraCount > PASSAGE_MAX_PARAS) {
      throw new Error(
        labelled(itemLabel, `passage.body must be ${PASSAGE_MIN_PARAS}-${PASSAGE_MAX_PARAS} paragraphs separated by blank lines (found ${paraCount})`)
      );
    }
    assertReadingKey(p.reading_key, paraCount, itemLabel);

    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    if (!questions.length) throw new Error(labelled(itemLabel, `questions[] required`));
    for (let i = 0; i < questions.length; i++) {
      const err = validateImportQuestion(questions[i], sublabel(itemLabel, `Q${i + 1}`));
      if (err) throw new Error(err); // whole set is atomic - reject on any bad Q
    }
    const wordCount = String(p.body).trim().split(/\s+/).length;
    // Soft: length drift doesn't corrupt grading the way a missing key does, so
    // surface it in the import report rather than rejecting usable content.
    if (wordCount < PASSAGE_MIN_WORDS || wordCount > PASSAGE_MAX_WORDS) {
      errors.push(labelled(itemLabel, `passage is ${wordCount} words (expected ${PASSAGE_MIN_WORDS}-${PASSAGE_MAX_WORDS}) — imported anyway`));
    }
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
    if (!items.length) throw new Error(labelled(itemLabel, `items[] required`));
    // Drills are independent - insert the good ones, collect errors for the rest.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const label = sublabel(itemLabel, `Item ${i + 1}`);
      if (!IMPORT_TOPICS.includes(it.topic)) { errors.push(`${label}: topic "${it.topic}" not allowed`); continue; }
      if (!String(it.paragraph || "").trim()) { errors.push(`${label}: missing paragraph`); continue; }
      const err = validateImportQuestion(it, label, true); // Drills → difficulty required
      if (err) { errors.push(err); continue; }
      try {
        await db.transaction(async (client) => {
          await insertImportQuestion(client, it, { topic: it.topic, paragraph: String(it.paragraph).trim(), passageId: null });
        });
        questionsInserted++;
      } catch (e) { errors.push(`${label}: ${e.message}`); }
    }
  } else {
    throw new Error(labelled(itemLabel, `kind must be "passage_set" or "drills"`));
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
        errors.push(e.message); // hard failure on this array item - skip it, continue the batch
      }
    }

    res.json({ ok: true, passagesInserted, questionsInserted, errors });
  } catch (e) { next(e); }
});

// ── GET /api/admin/export ──────────────────────────────────────────────────
// Dump the content bank (passages + their questions, and standalone drills) as
// JSON for offline review / quality auditing. Query params:
//   ?source=ai_generated,coach   (comma list; default: all sources)
//   ?active=1|0                  (filter by is_active; default: all)
// Returns { passages:[...], questions:[...], counts:{...} }.
router.get("/export", async (req, res, next) => {
  try {
    const sources = (req.query.source || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const active = req.query.active; // "1" | "0" | undefined

    const qWhere = [], qParams = [];
    if (sources.length) { qParams.push(sources); qWhere.push(`source = ANY($${qParams.length})`); }
    if (active === "1" || active === "0") {
      qParams.push(active === "1" ? 1 : 0); qWhere.push(`is_active = $${qParams.length}`);
    }
    const qClause = qWhere.length ? `WHERE ${qWhere.join(" AND ")}` : "";

    const questions = await db.all(
      `SELECT id, topic, type, difficulty, trap_type, question, options_json,
              correct_index, trap_index, source_lines, passage_id, source, is_active, created_at
         FROM questions ${qClause}
         ORDER BY passage_id NULLS FIRST, id`,
      qParams
    );

    // Passages: same source/active filter where the columns exist.
    const pWhere = [], pParams = [];
    if (sources.length) { pParams.push(sources); pWhere.push(`source = ANY($${pParams.length})`); }
    if (active === "1" || active === "0") {
      pParams.push(active === "1" ? 1 : 0); pWhere.push(`is_active = $${pParams.length}`);
    }
    const pClause = pWhere.length ? `WHERE ${pWhere.join(" AND ")}` : "";
    const passages = await db.all(
      `SELECT id, topic, genre, title, body, word_count, reading_key_json,
              source, is_active, created_at
         FROM passages ${pClause}
         ORDER BY id`,
      pParams
    );

    res.json({
      exportedAt: new Date().toISOString(),
      filters: { source: sources.length ? sources : "all", active: active || "all" },
      counts: { passages: passages.length, questions: questions.length },
      passages,
      questions,
    });
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

// ── GET /api/admin/payments ─────────────────────────────────────────────────
// The money log: every payment row across all users, with revenue totals and
// the plans currently held. Filters: ?q=<user/order/payment id>&status=&provider=
// &tier=&page=&pageSize=
//
// Deliberately shows 'created' (abandoned-checkout) rows too, not just captured
// ones like the user-facing /api/billing/payments does. A pile of created-never-
// captured rows for one account is exactly the signal that someone is probing
// the payment flow, and hiding it would hide the attack.
router.get("/payments", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
    const offset = (page - 1) * pageSize;

    // Build the filter clause with positional params (never string interpolation).
    const where = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(u.username ILIKE $${params.length} OR u.email ILIKE $${params.length}
          OR p.razorpay_order_id ILIKE $${params.length} OR p.razorpay_payment_id ILIKE $${params.length})`
      );
    }
    for (const [col, val] of [["status", req.query.status], ["provider", req.query.provider], ["tier", req.query.tier]]) {
      if (val) { params.push(String(val)); where.push(`p.${col} = $${params.length}`); }
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRow = await db.get(
      `SELECT COUNT(*) AS total FROM payments p JOIN users u ON u.id = p.user_id ${whereSql}`,
      params
    );

    const rows = await db.all(
      `SELECT p.id, p.user_id AS "userId", u.username, u.email,
              p.tier, p.months, p.amount_inr AS "amountInr", p.provider,
              p.razorpay_order_id AS "orderId", p.razorpay_payment_id AS "paymentId",
              p.status, p.period, p.season_year AS "seasonYear",
              p.created_at AS "createdAt", p.captured_at AS "capturedAt",
              p.granted_by AS "grantedBy", g.username AS "grantedByUsername"
         FROM payments p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN users g ON g.id = p.granted_by
         ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    // Revenue totals ignore the filters on purpose - they're the headline
    // numbers for the whole business, not for the current search. Only real
    // money counts, so ₹0 'manual' comp rows are excluded from revenue while
    // still being counted separately.
    const totals = await db.get(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'captured' AND provider <> 'manual' THEN amount_inr ELSE 0 END), 0)::int AS "revenueInr",
         COALESCE(SUM(CASE WHEN status = 'captured' AND provider <> 'manual'
                            AND captured_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
                           THEN amount_inr ELSE 0 END), 0)::int AS "revenueThisMonthInr",
         COUNT(*) FILTER (WHERE status = 'captured' AND provider <> 'manual')::int AS "capturedCount",
         COUNT(*) FILTER (WHERE status = 'created')::int AS "abandonedCount",
         COUNT(*) FILTER (WHERE provider = 'manual')::int AS "manualCount",
         COUNT(DISTINCT user_id) FILTER (WHERE status = 'captured' AND provider <> 'manual')::int AS "payingUsers"
       FROM payments`
    );

    // Who currently holds what. Counts live (unexpired) paid plans by tier.
    const byTier = await db.all(
      `SELECT tier, COUNT(*)::int AS users
         FROM users
        WHERE tier IS NOT NULL AND tier <> 'free'
          AND (tier_expires_at IS NULL OR tier_expires_at > NOW())
        GROUP BY tier
        ORDER BY users DESC`
    );

    res.json({ payments: rows, total: parseInt(countRow.total, 10), page, pageSize, totals, byTier });
  } catch (e) { next(e); }
});

// ── GET /api/admin/subscriptions ────────────────────────────────────────────
// Recurring-mandate state, which the payments log alone doesn't show: a
// subscription that has stopped charging ('halted') is a user quietly losing
// access, and a 'cancel at cycle end' is churn you can still act on.
router.get("/subscriptions", async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT s.id, s.user_id AS "userId", u.username, u.email,
              s.tier, s.razorpay_subscription_id AS "subscriptionId", s.status,
              s.last_charge_id AS "lastChargeId", s.current_end AS "currentEnd",
              s.cancel_at_cycle_end AS "cancelAtCycleEnd",
              s.cancelled_at AS "cancelledAt", s.created_at AS "createdAt"
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
        LIMIT 200`
    );
    res.json({ subscriptions: rows });
  } catch (e) {
    // Older DBs may predate the subscriptions table - an empty list is a better
    // answer than a 500 that breaks the whole page.
    if (/relation .* does not exist/i.test(e.message)) return res.json({ subscriptions: [] });
    next(e);
  }
});

// ── GET /api/admin/api-calls ────────────────────────────────────────────────
// Row-level browser over api_calls for diagnosing a specific failure (e.g.
// "AI feedback unavailable") - the /costs endpoint above only returns
// aggregates, this returns individual calls with their persisted error
// message (see logApiCall in server/ai/apiLog.js), filterable by date range,
// user, token count, surface (which product the call came from), and status.
const SURFACE_ROUTE_PATTERNS = {
  drills: ["/api/attempts/evaluate", "/api/sessions/batch-evaluate"],
  coach: ["/api/coach/"],
  my_questions: ["/api/my-questions/"],
};

function surfaceWhereClause(surface, paramIndex) {
  const patterns = SURFACE_ROUTE_PATTERNS[surface];
  if (!patterns) return null;
  // Routes are either exact matches (Drills) or prefixes (Coach/My Questions) -
  // build an OR of `route = $n` / `route LIKE $n` accordingly.
  const clauses = [];
  const values = [];
  let i = paramIndex;
  for (const p of patterns) {
    if (p.endsWith("/")) {
      clauses.push(`c.route LIKE $${i}`);
      values.push(`${p}%`);
    } else {
      clauses.push(`c.route = $${i}`);
      values.push(p);
    }
    i++;
  }
  return { sql: `(${clauses.join(" OR ")})`, values };
}

router.get("/api-calls", async (req, res, next) => {
  try {
    const {
      from, to, userId, minTokens, maxTokens, surface, status,
      page = 1, pageSize = 50,
    } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    if (from) { where.push(`c.created_at >= $${i++}`); params.push(from); }
    if (to) { where.push(`c.created_at < ($${i++}::date + INTERVAL '1 day')`); params.push(to); }
    if (userId) {
      const trimmed = String(userId).trim();
      if (/^\d+$/.test(trimmed)) {
        where.push(`c.user_id = $${i++}`);
        params.push(Number(trimmed));
      } else {
        where.push(`u.username ILIKE $${i++}`);
        params.push(`%${trimmed}%`);
      }
    }
    if (minTokens) { where.push(`(c.input_tokens + c.output_tokens) >= $${i++}`); params.push(Number(minTokens)); }
    if (maxTokens) { where.push(`(c.input_tokens + c.output_tokens) <= $${i++}`); params.push(Number(maxTokens)); }
    if (status === "ok" || status === "error") { where.push(`c.status = $${i++}`); params.push(status); }
    if (surface && surface !== "other") {
      const clause = surfaceWhereClause(surface, i);
      if (clause) { where.push(clause.sql); params.push(...clause.values); i += clause.values.length; }
    } else if (surface === "other") {
      // Not Drills, not Coach, not My Questions - everything else (currently none, but future-proof).
      const allPatterns = Object.values(SURFACE_ROUTE_PATTERNS).flat();
      const clauses = allPatterns.map((p) => {
        const c = p.endsWith("/") ? `c.route LIKE $${i}` : `c.route = $${i}`;
        params.push(p.endsWith("/") ? `${p}%` : p);
        i++;
        return c;
      });
      where.push(`NOT (${clauses.join(" OR ")})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    const totalRow = await db.get(
      `SELECT COUNT(*) AS total FROM api_calls c LEFT JOIN users u ON u.id = c.user_id ${whereSql}`,
      params
    );

    const rows = await db.all(
      `SELECT c.id, c.user_id AS "userId", u.username, u.email,
              c.route, c.provider, c.model,
              c.input_tokens AS "inputTokens", c.output_tokens AS "outputTokens",
              (c.input_tokens + c.output_tokens) AS "totalTokens",
              c.est_cost_usd AS "costUsd", c.status, c.error_message AS "errorMessage",
              c.created_at AS "createdAt"
       FROM api_calls c
       LEFT JOIN users u ON u.id = c.user_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows, total: Number(totalRow.total), page: Number(page) || 1, pageSize: limit });
  } catch (e) { next(e); }
});

// ── Admin: AI prompt overrides (server/ai/prompts.js) ────────────────────────
// GET lists every known prompt key with its effective content (DB override if
// one exists, otherwise the hardcoded default) plus whether it's customized.
router.get("/prompts", async (req, res, next) => {
  try {
    const overrides = await db.all("SELECT key, content, updated_at, updated_by FROM ai_prompts");
    const overrideMap = new Map(overrides.map((r) => [r.key, r]));
    const rows = Object.entries(PROMPT_DEFAULTS).map(([key, def]) => {
      const override = overrideMap.get(key);
      return {
        key,
        label: def.label,
        description: def.description,
        defaultContent: def.content,
        content: override ? override.content : def.content,
        isCustom: Boolean(override),
        updatedAt: override ? override.updated_at : null,
        updatedBy: override ? override.updated_by : null,
      };
    });
    res.json({ prompts: rows });
  } catch (e) { next(e); }
});

// PUT upserts an override for one prompt key. Rejects unknown keys and empty
// content so a typo in the URL or a blank save can't silently break an AI call.
router.put("/prompts/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!PROMPT_DEFAULTS[key]) return res.status(404).json({ error: "Unknown prompt key" });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) return res.status(400).json({ error: "content is required" });

    await db.run(
      `INSERT INTO ai_prompts (key, content, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET content = $2, updated_by = $3, updated_at = NOW()`,
      [key, content, req.userId]
    );
    invalidatePromptCache();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE reverts a prompt to its hardcoded default.
router.delete("/prompts/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!PROMPT_DEFAULTS[key]) return res.status(404).json({ error: "Unknown prompt key" });
    await db.run("DELETE FROM ai_prompts WHERE key = $1", [key]);
    invalidatePromptCache();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Admin: bulletins (the "important updates" box on the logged-in home) ────
// GET lists every bulletin (active + retired) newest-first, for the admin list view.
router.get("/bulletins", async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT b.id, b.title, b.body, b.is_active, b.created_at, b.updated_at, u.username AS created_by_username
         FROM bulletins b LEFT JOIN users u ON u.id = b.created_by
        ORDER BY b.created_at DESC`
    );
    res.json({ bulletins: rows });
  } catch (e) { next(e); }
});

// Bulletins render verbatim on every logged-in homepage, so an accidental
// paste of something enormous is a site-wide layout problem, not just a bad
// row. Keep in sync with MISC in client/src/lib/limits.js.
const BULLETIN_TITLE_MAX = 200;
const BULLETIN_BODY_MAX = 4000;

function validateBulletin(req) {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!title || !body) return { error: "title and body are required" };
  if (title.length > BULLETIN_TITLE_MAX) {
    return { error: `title is too long (${title.length} characters, max ${BULLETIN_TITLE_MAX})` };
  }
  if (body.length > BULLETIN_BODY_MAX) {
    return { error: `body is too long (${body.length} characters, max ${BULLETIN_BODY_MAX})` };
  }
  return { title, body };
}

// POST creates a new bulletin (active by default).
router.post("/bulletins", async (req, res, next) => {
  try {
    const { title, body, error } = validateBulletin(req);
    if (error) return res.status(400).json({ error });

    const row = await db.get(
      `INSERT INTO bulletins (title, body, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [title, body, req.userId]
    );
    res.json({ ok: true, id: row.id });
  } catch (e) { next(e); }
});

// PUT updates a bulletin's title/body/is_active.
router.put("/bulletins/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, body, error } = validateBulletin(req);
    if (error) return res.status(400).json({ error });
    const isActive = Boolean(req.body?.isActive);

    const result = await db.run(
      `UPDATE bulletins SET title = $1, body = $2, is_active = $3, updated_at = NOW() WHERE id = $4`,
      [title, body, isActive, id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Bulletin not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE permanently removes a bulletin.
router.delete("/bulletins/:id", async (req, res, next) => {
  try {
    const result = await db.run("DELETE FROM bulletins WHERE id = $1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Bulletin not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
