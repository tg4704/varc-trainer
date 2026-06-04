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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

module.exports = db;
