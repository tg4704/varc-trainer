const express = require("express");
const router = express.Router();
const db = require("../db");

function checkKey(req, res) {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.key !== key) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// GET /api/admin/users?key=SECRET — all users with aggregate stats
router.get("/users", (req, res) => {
  if (!checkKey(req, res)) return;
  const users = db.prepare(
    `SELECT
       u.id, u.username, u.email, u.created_at,
       COUNT(DISTINCT s.id)              AS sessions,
       COUNT(DISTINCT a.id)              AS attempts,
       COALESCE(SUM(a.is_correct), 0)    AS correct
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     LEFT JOIN attempts a ON a.session_id = s.id AND a.skipped = 0
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  ).all();
  res.json({ count: users.length, users });
});

// GET /api/admin/sessions?key=SECRET — all sessions
router.get("/sessions", (req, res) => {
  if (!checkKey(req, res)) return;
  const rows = db.prepare(
    `SELECT s.*, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.id DESC`
  ).all();
  res.json({ count: rows.length, sessions: rows });
});

// GET /api/admin/attempts?key=SECRET — all attempts (most recent first)
router.get("/attempts", (req, res) => {
  if (!checkKey(req, res)) return;
  const rows = db.prepare(
    `SELECT a.*, u.username
     FROM attempts a
     JOIN sessions s ON s.id = a.session_id
     JOIN users u ON u.id = s.user_id
     ORDER BY a.id DESC`
  ).all();
  res.json({ count: rows.length, attempts: rows });
});

// GET /api/admin/all?key=SECRET — full DB dump
router.get("/all", (req, res) => {
  if (!checkKey(req, res)) return;
  const users    = db.prepare("SELECT id, username, email, created_at FROM users ORDER BY id").all();
  const sessions = db.prepare("SELECT * FROM sessions ORDER BY id DESC").all();
  const attempts = db.prepare("SELECT * FROM attempts ORDER BY id DESC").all();
  res.json({ users, sessions, attempts });
});

module.exports = router;
