// Phase 8: shared accessor for questions. All routes read from the DB through
// this module — never from server/data/questions.js at runtime.
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

// All active questions visible to a given user:
//   - all seed questions
//   - that user's own user-created questions (Phase 10)
async function listForUser(userId) {
  const rows = await db.all(
    `SELECT * FROM questions
     WHERE is_active = 1
       AND (source = 'seed' OR author_user_id = $1)`,
    [userId]
  );
  return rows.map(hydrate);
}

// All active questions (admin/global view; used by dashboard recent-attempts).
async function listAllActive() {
  const rows = await db.all("SELECT * FROM questions WHERE is_active = 1");
  return rows.map(hydrate);
}

module.exports = { findById, listForUser, listAllActive, hydrate };
