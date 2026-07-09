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

// DELETE /api/account — permanently deletes the account and everything tied
// to it. Unlike /reset, the user row itself is removed and the token becomes
// invalid. Rows other users might rely on (question_flags, api_calls, any
// questions/passages this user authored) are anonymised (user_id -> NULL)
// rather than deleted outright, so shared data/audit history survives.
router.delete("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;

    await db.transaction(async (client) => {
      await client.query("DELETE FROM otp_tokens WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM sr_cards WHERE user_id = $1", [userId]);
      await client.query(
        `DELETE FROM attempts WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
        [userId]
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await client.query(
        `DELETE FROM coach_attempts WHERE coach_session_id IN (SELECT id FROM coach_sessions WHERE user_id = $1)`,
        [userId]
      );
      await client.query("DELETE FROM coach_sessions WHERE user_id = $1", [userId]);
      await client.query("UPDATE question_flags SET flagged_by_user_id = NULL WHERE flagged_by_user_id = $1", [userId]);
      await client.query("UPDATE questions SET author_user_id = NULL WHERE author_user_id = $1", [userId]);
      await client.query("UPDATE passages SET author_user_id = NULL WHERE author_user_id = $1", [userId]);
      await client.query("UPDATE api_calls SET user_id = NULL WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    });

    res.json({ ok: true, message: "Account deleted." });
  } catch (e) { next(e); }
});

module.exports = router;
