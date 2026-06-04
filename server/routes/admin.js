const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/admin/users?key=YOUR_SECRET
// Protected by ADMIN_KEY env var — never expose this URL publicly
router.get("/users", (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.key !== key) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const users = db
    .prepare(
      `SELECT
         u.id, u.username, u.email, u.created_at,
         COUNT(DISTINCT s.id)  AS sessions,
         COUNT(DISTINCT a.id)  AS attempts,
         COALESCE(SUM(a.is_correct), 0) AS correct
       FROM users u
       LEFT JOIN sessions s ON s.user_id = u.id
       LEFT JOIN attempts a ON a.session_id = s.id AND a.skipped = 0
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();

  res.json({ count: users.length, users });
});

module.exports = router;
