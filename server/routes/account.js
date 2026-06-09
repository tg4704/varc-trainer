const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

// DELETE /api/account/reset
// Deletes all attempts and sessions for the authenticated user.
// The user account itself is preserved — they stay logged in.
router.delete("/reset", authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;

    await db.transaction(async (client) => {
      // Delete attempts first (foreign key to sessions)
      await client.query(
        `DELETE FROM attempts WHERE session_id IN (
           SELECT id FROM sessions WHERE user_id = $1
         )`,
        [userId]
      );
      // Delete sessions
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    });

    res.json({ ok: true, message: "All practice data has been reset." });
  } catch (e) { next(e); }
});

module.exports = router;
