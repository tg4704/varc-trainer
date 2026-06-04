const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

// DELETE /api/account/reset
// Deletes all attempts and sessions for the authenticated user.
// The user account itself is preserved — they stay logged in.
router.delete("/reset", authenticate, (req, res) => {
  const userId = req.userId;

  // Delete attempts first (foreign key to sessions)
  db.prepare(
    `DELETE FROM attempts WHERE session_id IN (
       SELECT id FROM sessions WHERE user_id = ?
     )`
  ).run(userId);

  // Delete sessions
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);

  res.json({ ok: true, message: "All practice data has been reset." });
});

module.exports = router;
