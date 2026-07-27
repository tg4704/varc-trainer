const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

// GET /api/account/export - DPDP data-portability right. Returns every row
// tied to the logged-in user as one JSON document (profile, sessions,
// attempts, coach sessions/attempts, SR cards). Excludes password_hash.
router.get("/export", authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;

    const [user, sessions, attempts, coachSessions, coachAttempts, srCards] = await Promise.all([
      db.get(
        `SELECT id, username, email, name, avatar_id, favorite_topic, bio,
                tier, daily_goal, created_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      db.all("SELECT * FROM sessions WHERE user_id = $1 ORDER BY id", [userId]),
      db.all(
        `SELECT a.* FROM attempts a
         JOIN sessions s ON s.id = a.session_id
         WHERE s.user_id = $1 ORDER BY a.id`,
        [userId]
      ),
      db.all("SELECT * FROM coach_sessions WHERE user_id = $1 ORDER BY id", [userId]),
      db.all(
        `SELECT ca.* FROM coach_attempts ca
         JOIN coach_sessions cs ON cs.id = ca.coach_session_id
         WHERE cs.user_id = $1 ORDER BY ca.id`,
        [userId]
      ),
      db.all("SELECT * FROM sr_cards WHERE user_id = $1 ORDER BY id", [userId]),
    ]);

    res.setHeader("Content-Disposition", `attachment; filename="graspr-data-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      sessions,
      attempts,
      coachSessions,
      coachAttempts,
      spacedRepetitionCards: srCards,
    });
  } catch (e) { next(e); }
});

// DELETE /api/account/reset
// Deletes ALL practice history for the authenticated user - Drills sessions
// and attempts, Coach sessions and attempts, and the spaced-repetition queue.
// The user account itself is preserved - they stay logged in.
//
// Coach + SR were originally missed here, which is why a "reset" user still
// saw passages/questions marked as already attempted: coach_attempts rows
// survived (Coach history and its per-passage "attempted" state read from
// them), as did sr_cards. Keep this list in sync with the per-user tables
// deleted in DELETE / below - anything the user thinks of as "my progress"
// belongs in both.
router.delete("/reset", authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;

    await db.transaction(async (client) => {
      // Children first in every case (FK to the parent session row).
      await client.query(
        `DELETE FROM attempts WHERE session_id IN (
           SELECT id FROM sessions WHERE user_id = $1
         )`,
        [userId]
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

      await client.query(
        `DELETE FROM coach_attempts WHERE coach_session_id IN (
           SELECT id FROM coach_sessions WHERE user_id = $1
         )`,
        [userId]
      );
      await client.query("DELETE FROM coach_sessions WHERE user_id = $1", [userId]);

      await client.query("DELETE FROM sr_cards WHERE user_id = $1", [userId]);
    });

    res.json({ ok: true, message: "All practice data has been reset." });
  } catch (e) { next(e); }
});

// DELETE /api/account - permanently deletes the account and everything tied
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
