const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "varc.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',     -- 'user' | 'admin' (Phase 9)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,                          -- 'q001'..'q025' for seeds; uuid for user-created (Phase 10)
    topic TEXT NOT NULL,                          -- 'economics' | 'humanities' | 'philosophy' | 'science' | 'social'
    paragraph TEXT NOT NULL,
    question TEXT NOT NULL,
    type TEXT NOT NULL,                           -- 'inference' | 'tone' | 'title' | 'detail' | 'application'
    options_json TEXT NOT NULL,                   -- JSON: [{text, isCorrect, isTrap, trapType}, ...]
    correct_index INTEGER NOT NULL,
    trap_index INTEGER,                           -- null for no-trap questions
    trap_type TEXT,                               -- 'too_extreme' | 'out_of_scope' | 'real_but_unstated' | 'partially_correct' | null
    source_lines TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'seed',          -- 'seed' | 'user' (Phase 10)
    author_user_id INTEGER,                       -- null for built-ins; user id for user-created
    is_active INTEGER NOT NULL DEFAULT 1,         -- 0 = soft-deleted or admin-disabled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    num_questions INTEGER NOT NULL DEFAULT 10,
    timer_mode TEXT NOT NULL DEFAULT 'untimed',   -- 'untimed' | 'count_up' | 'countdown'
    timer_scope TEXT,                             -- 'per_question' | 'per_session' | null
    timer_seconds INTEGER,                        -- countdown duration (per question or per session); null otherwise
    status TEXT NOT NULL DEFAULT 'active',        -- 'active' | 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    topic TEXT NOT NULL,
    selected_option_index INTEGER,        -- null when skipped
    correct_option_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,          -- 0 or 1 (0 when skipped)
    trap_option_index INTEGER,
    trap_type TEXT,
    selected_trap INTEGER NOT NULL,       -- 0 or 1 (0 when skipped)
    skipped INTEGER NOT NULL DEFAULT 0,   -- 0 or 1
    reasoning_text TEXT,                  -- null until Phase 4
    reasoning_score INTEGER,              -- 1-5, null until Phase 4
    reasoning_feedback TEXT,
    trap_explanation TEXT,
    correct_explanation TEXT,
    key_takeaway TEXT,
    mode TEXT NOT NULL DEFAULT 'analysis', -- 'analysis' | 'intuition'
    time_taken_seconds INTEGER,
    eliminated_indices TEXT,              -- JSON array, used in intuition mode
    intuition_points INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

// ── Lightweight migrations for existing DBs ──
// CREATE TABLE IF NOT EXISTS won't add columns to a table that already exists,
// so we check and ALTER for each column that may be missing on older DBs.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");

// ── Seed questions on first run (Phase 8) ──
// Idempotent: only seeds when the questions table is empty. The canonical
// definition still lives in server/data/questions.js (checked into git) — it
// is only read at seed time, never at request time.
function seedQuestions() {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM questions").get();
  if (n > 0) return;

  const seedData = require("./data/questions");
  const insert = db.prepare(
    `INSERT INTO questions
       (id, topic, paragraph, question, type, options_json,
        correct_index, trap_index, trap_type, source_lines, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')`
  );
  const tx = db.transaction((rows) => {
    for (const q of rows) {
      insert.run(
        q.id, q.topic, q.paragraph, q.question, q.type,
        JSON.stringify(q.options),
        q.correctIndex,
        q.trapIndex ?? null,
        q.trapType ?? null,
        q.sourceLines
      );
    }
  });
  tx(seedData);
  console.log(`[db] Seeded ${seedData.length} questions into the database.`);
}
seedQuestions();

module.exports = db;
