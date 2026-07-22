// Admin trash for Drills questions + Coach passages.
//
// Deleting from the admin lists sets deleted_at (and is_active=0) rather than
// hard-deleting: the row shows up in Admin → Deleted, can be restored, and is
// permanently removed once it has sat in the trash longer than TRASH_TTL_DAYS.
//
// A passage that any student has actually run in Coach (coach_sessions FKs to
// it) is never hard-purged - that would take real user history with it. Those
// passages simply stay in the trash; the sweep skips them and the UI says why.
const db = require("../db");

const TRASH_TTL_DAYS = 10;

// Hard-delete everything that has been in the trash longer than the TTL.
// Questions first, then passages (questions.passage_id FKs to passages).
// Returns { questions, passages, skippedPassages } counts for logging.
async function purgeExpiredTrash() {
  const cutoffSql = `deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${TRASH_TTL_DAYS} days'`;

  // Trashed drill questions past the TTL - safe to hard-delete (attempts.question_id
  // is a plain TEXT column with no FK, so attempt history survives the row going away).
  const qInfo = await db.run(`DELETE FROM questions WHERE ${cutoffSql}`);

  // Trashed passages past the TTL, EXCEPT any with Coach history. Delete each
  // passage's remaining questions first, then the passage.
  const expired = await db.all(`SELECT id FROM passages WHERE ${cutoffSql}`);
  const ids = expired.map((r) => r.id);
  let passagesPurged = 0;
  let skippedPassages = 0;
  if (ids.length) {
    const used = await db.all(
      "SELECT DISTINCT passage_id FROM coach_sessions WHERE passage_id = ANY($1)",
      [ids]
    );
    const blocked = new Set(used.map((r) => r.passage_id));
    const deletable = ids.filter((id) => !blocked.has(id));
    skippedPassages = ids.length - deletable.length;
    if (deletable.length) {
      await db.transaction(async (client) => {
        await client.query("DELETE FROM questions WHERE passage_id = ANY($1)", [deletable]);
        const info = await client.query("DELETE FROM passages WHERE id = ANY($1)", [deletable]);
        passagesPurged = info.rowCount;
      });
    }
  }

  return { questions: qInfo.rowCount || 0, passages: passagesPurged, skippedPassages };
}

// Run one sweep now, then once a day. Failures are logged, never fatal.
function startTrashSweeper() {
  const sweep = async () => {
    try {
      const r = await purgeExpiredTrash();
      if (r.questions || r.passages || r.skippedPassages) {
        console.log(
          `[trash] purged ${r.questions} question(s), ${r.passages} passage(s); ` +
          `${r.skippedPassages} passage(s) kept (Coach history).`
        );
      }
    } catch (e) {
      console.error("[trash] sweep failed:", e.message);
    }
  };
  sweep();
  // Daily. unref() so the timer never keeps the process alive on its own.
  const timer = setInterval(sweep, 24 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { TRASH_TTL_DAYS, purgeExpiredTrash, startTrashSweeper };
