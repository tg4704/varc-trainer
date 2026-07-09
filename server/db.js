const { Pool, types } = require("pg");

// Make COUNT/SUM (int8, OID 20) and AVG/NUMERIC (OID 1700) return JS numbers
// instead of strings — pg driver returns them as strings by default.
types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// ── Thin async wrapper around pg Pool ────────────────────────────────────────

const db = {
  // Returns the first row or null
  async get(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0] ?? null;
  },

  // Returns all rows as an array
  async all(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
  },

  // Executes an INSERT/UPDATE/DELETE.
  // For INSERTs that need the new ID, append RETURNING id to the SQL.
  // Returns { rowCount, lastId, changes } — lastId is rows[0]?.id or null.
  async run(sql, params = []) {
    const result = await pool.query(sql, params);
    return {
      rowCount: result.rowCount,
      lastId: result.rows[0]?.id ?? null,
      changes: result.rowCount,
    };
  },

  // Runs raw SQL (DDL)
  async exec(sql) {
    await pool.query(sql);
  },

  // Wraps asyncFn in a BEGIN/COMMIT/ROLLBACK transaction using a dedicated client
  async transaction(asyncFn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await asyncFn(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

// ── Schema creation ───────────────────────────────────────────────────────────

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      tier TEXT NOT NULL DEFAULT 'free',
      daily_goal INTEGER NOT NULL DEFAULT 10,
      email_verified INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ② Coach — full-RC passages with the reading key baked in (created before
  // `questions` because questions.passage_id references it).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS passages (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      genre TEXT,
      title TEXT,
      body TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      reading_key_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai_generated',
      author_user_id INTEGER REFERENCES users(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      paragraph TEXT NOT NULL,
      question TEXT NOT NULL,
      type TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      trap_index INTEGER,
      trap_type TEXT,
      source_lines TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      author_user_id INTEGER REFERENCES users(id),
      passage_id INTEGER REFERENCES passages(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_calls (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      route TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      est_cost_usd REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ok',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS question_flags (
      id SERIAL PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id),
      flagged_by_user_id INTEGER REFERENCES users(id),
      source TEXT NOT NULL DEFAULT 'admin',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      num_questions INTEGER NOT NULL DEFAULT 10,
      timer_mode TEXT NOT NULL DEFAULT 'untimed',
      timer_scope TEXT,
      timer_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      feedback_mode TEXT NOT NULL DEFAULT 'instant',
      session_type TEXT NOT NULL DEFAULT 'practice',
      question_ids TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS attempts (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      question_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      topic TEXT NOT NULL,
      selected_option_index INTEGER,
      correct_option_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      trap_option_index INTEGER,
      trap_type TEXT,
      selected_trap INTEGER NOT NULL,
      skipped INTEGER NOT NULL DEFAULT 0,
      reasoning_text TEXT,
      reasoning_score INTEGER,
      reasoning_feedback TEXT,
      trap_explanation TEXT,
      correct_explanation TEXT,
      key_takeaway TEXT,
      mode TEXT NOT NULL DEFAULT 'analysis',
      time_taken_seconds INTEGER,
      eliminated_indices TEXT,
      intuition_points INTEGER,
      error_category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sr_cards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id TEXT NOT NULL,
      bucket INTEGER NOT NULL DEFAULT 0,
      due_at TEXT NOT NULL,
      last_seen_at TEXT,
      last_correct INTEGER,
      total_attempts INTEGER NOT NULL DEFAULT 0,
      total_correct INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, question_id)
    )
  `);

  // ② Coach — one run over one passage. The reading-map grade (b2) is the
  // defining mechanic: it's stored at the session level, submitted BEFORE questions.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS coach_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      passage_id INTEGER NOT NULL REFERENCES passages(id),
      reading_map_json TEXT,
      reading_grade_json TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS coach_attempts (
      id SERIAL PRIMARY KEY,
      coach_session_id INTEGER NOT NULL REFERENCES coach_sessions(id),
      question_id TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      selected_option_index INTEGER,
      correct_option_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      trap_type TEXT,
      selected_trap INTEGER NOT NULL DEFAULT 0,
      reasoning_text TEXT,
      reasoning_score INTEGER,
      reasoning_feedback TEXT,
      trap_explanation TEXT,
      correct_explanation TEXT,
      key_takeaway TEXT,
      discuss_conversation_json TEXT NOT NULL DEFAULT '[]',
      exchange_count INTEGER NOT NULL DEFAULT 0,
      error_category TEXT,
      time_taken_seconds INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ① Reading Lounge — curated real CC-licensed articles.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      license TEXT NOT NULL,
      genre TEXT NOT NULL,
      body TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      difficulty TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Lightweight additive migrations ──────────────────────────────────────────
async function ensureColumn(table, column, definition) {
  const row = await db.get(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  if (!row) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// ── Seed questions on first run ───────────────────────────────────────────────
async function seedQuestions() {
  const row = await db.get("SELECT COUNT(*) AS n FROM questions");
  if (parseInt(row.n, 10) > 0) return;

  const seedData = require("./data/questions");
  await db.transaction(async (client) => {
    for (const q of seedData) {
      await client.query(
        `INSERT INTO questions
           (id, topic, paragraph, question, type, options_json,
            correct_index, trap_index, trap_type, source_lines, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'seed')`,
        [
          q.id, q.topic, q.paragraph, q.question, q.type,
          JSON.stringify(q.options),
          q.correctIndex,
          q.trapIndex ?? null,
          q.trapType ?? null,
          q.sourceLines,
        ]
      );
    }
  });
  console.log(`[db] Seeded ${seedData.length} questions into the database.`);
}

// ── Bootstrap admins from env var ────────────────────────────────────────────
async function bootstrapAdmins() {
  const names = (process.env.ADMIN_USERNAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return;

  for (const username of names) {
    const result = await db.run(
      "UPDATE users SET role = 'admin' WHERE username = $1 AND role != 'admin'",
      [username]
    );
    if (result.rowCount > 0) {
      console.log(`[db] Promoted ${username} to admin.`);
    }
  }
}

// ── One-time destructive reset (fresh rebuild), guarded by DB_RESET=true ──────
// Drops all app tables so createTables() rebuilds the schema from scratch.
// DEV ONLY — NEVER set DB_RESET=true against a production database.
async function resetTables() {
  console.warn("[db] DB_RESET=true — dropping all tables for a fresh rebuild.");
  await db.exec(`
    DROP TABLE IF EXISTS
      coach_attempts, coach_sessions, articles, sr_cards, otp_tokens,
      attempts, sessions, question_flags, api_calls, questions, passages, users
    CASCADE
  `);
}

// Returns true ONLY if the pre-restructure schema is detected. This makes DB_RESET
// self-limiting: a lingering DB_RESET=true env var can wipe at most once, because
// after the rebuild the schema is no longer "stale" and this returns false.
async function schemaIsStale() {
  const usersExists = await db.get(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
  );
  if (!usersExists) return false; // brand-new empty DB — nothing to drop

  const passagesExists = await db.get(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'passages'"
  );
  const oldCoachColumn = await db.get(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'coach_sessions' AND column_name = 'article_text'`
  );
  // Stale if the new passages table is missing OR the old coach schema is still present.
  return !passagesExists || !!oldCoachColumn;
}

// ── Initialise everything ─────────────────────────────────────────────────────
(async () => {
  try {
    if (process.env.DB_RESET === "true" && (await schemaIsStale())) {
      await resetTables();
    }
    await createTables();
    // Additive migration for existing (pre-name-field) live databases.
    await ensureColumn("users", "name", "TEXT");
    // Preset avatar picker (Profile customization). Encodes one of three kinds
    // as "kind:value" (or "kind:value:bg" for icons) — see parseAvatar() in
    // client/src/lib/avatars.js. Bare strings with no colon are the original
    // gradient-only format ("teal") and still parse as kind=grad.
    await ensureColumn("users", "avatar_id", "TEXT");
    // Student Profile card (Profile page): favorite RC topic + short bio.
    await ensureColumn("users", "favorite_topic", "TEXT");
    await ensureColumn("users", "bio", "TEXT");
    // Unique partial index on google_id (allows multiple NULLs for non-Google users).
    await db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL"
    );
    await seedQuestions();
    await bootstrapAdmins();
    console.log("[db] Database initialised.");
  } catch (err) {
    console.error("[db] Initialisation error:", err);
    process.exit(1);
  }
})();

module.exports = db;
