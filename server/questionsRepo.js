// Phase 8: shared accessor for questions. All routes read from the DB through
// this module - never from server/data/questions.js at runtime.
const db = require("./db");

// Convert a DB row into the shape the rest of the app expects (matching the
// old in-memory format from server/data/questions.js).
function hydrate(row) {
  if (!row) return null;
  let options;
  try {
    options = JSON.parse(row.options_json);
  } catch {
    options = [];
  }
  return {
    id: row.id,
    topic: row.topic,
    paragraph: row.paragraph,
    question: row.question,
    type: row.type,
    options,
    correctIndex: row.correct_index,
    trapIndex: row.trap_index,
    trapType: row.trap_type,
    sourceLines: row.source_lines,
    source: row.source,
    difficulty: row.difficulty || "medium",
    authorUserId: row.author_user_id,
    isActive: row.is_active === 1,
  };
}

// Lookup by id. Returns null if not found or inactive.
async function findById(id) {
  const row = await db.get(
    "SELECT * FROM questions WHERE id = $1 AND is_active = 1",
    [id]
  );
  return hydrate(row);
}

// ③ Drills question pool for a given user:
//   - seed questions, curated AI-generated drills, or the user's own questions (Phase 10)
//   - passage_id IS NULL only - passage-linked questions belong to ② Coach, never to Drills
async function listForUser(userId) {
  const rows = await db.all(
    `SELECT * FROM questions
     WHERE is_active = 1
       AND passage_id IS NULL
       AND (source IN ('seed', 'ai_generated') OR author_user_id = $1)`,
    [userId]
  );
  return rows.map(hydrate);
}

// All active, standalone (non-passage) questions - admin/global view used by the
// dashboard's recent-attempts lookup. Excludes passage-linked (② Coach) questions.
async function listAllActive() {
  const rows = await db.all(
    "SELECT * FROM questions WHERE is_active = 1 AND passage_id IS NULL"
  );
  return rows.map(hydrate);
}

// Every question this user has ever ANSWERED, in any session, mapped to the id
// of their most recent attempt at it (a monotonic proxy for "how long ago").
// Used to keep a session from re-serving questions the user has already done -
// soft, not hard: once the unseen pool is exhausted we fall back to the
// longest-ago-seen ones rather than refusing to build a session.
// Skips are deliberately NOT counted: a skipped question gave the user nothing,
// so it stays in the unseen pool and can come round again.
async function attemptedByUser(userId) {
  const rows = await db.all(
    `SELECT a.question_id, MAX(a.id) AS last_attempt_id
     FROM attempts a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.user_id = $1
       AND a.skipped = 0
     GROUP BY a.question_id`,
    [userId]
  );
  const seen = new Map();
  for (const r of rows) seen.set(r.question_id, Number(r.last_attempt_id));
  return seen;
}

module.exports = { findById, listForUser, listAllActive, attemptedByUser, hydrate };
