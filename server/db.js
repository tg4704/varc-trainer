const { Pool, types } = require("pg");

// Make COUNT/SUM (int8, OID 20) and AVG/NUMERIC (OID 1700) return JS numbers
// instead of strings - pg driver returns them as strings by default.
types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Single shared pool for the whole app (this module is required once - Node
// caches it - so every route reuses the same pool, never opens one per
// request). max is set explicitly so it's a documented decision rather than
// silently relying on pg's default of 10; comfortably under Railway's
// connection cap at current scale. Revisit (PgBouncer / Railway pooling) if
// this ever runs as more than one instance.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
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
  // Returns { rowCount, lastId, changes } - lastId is rows[0]?.id or null.
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

  // ② Coach - full-RC passages with the reading key baked in (created before
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

  // ② Coach - one run over one passage. The reading-map grade (b2) is the
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

  // ① Reading Lounge - curated real CC-licensed articles.
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

  // Admin-editable AI prompt overrides (server/ai/prompts.js). A row here
  // overrides the hardcoded default for that key; no row = use the default.
  // Lets an admin tweak prompt wording from the UI without a redeploy.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_prompts (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Admin-postable "important updates" shown in a bulletin box on the
  // logged-in homepage. is_active lets an admin retire an old bulletin
  // without deleting its history.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bulletins (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
// DEV ONLY - NEVER set DB_RESET=true against a production database.
async function resetTables() {
  console.warn("[db] DB_RESET=true - dropping all tables for a fresh rebuild.");
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
  if (!usersExists) return false; // brand-new empty DB - nothing to drop

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
    // as "kind:value" (or "kind:value:bg" for icons) - see parseAvatar() in
    // client/src/lib/avatars.js. Bare strings with no colon are the original
    // gradient-only format ("teal") and still parse as kind=grad.
    await ensureColumn("users", "avatar_id", "TEXT");
    // Student Profile card (Profile page): favorite RC topic + short bio.
    await ensureColumn("users", "favorite_topic", "TEXT");
    await ensureColumn("users", "bio", "TEXT");
    // Monetization (Phase 6): paid tiers expire; NULL = never expires (free
    // tier, or a manually-granted plan). Resolved by lib/entitlements.js -
    // an expired paid tier is treated as 'free'. users.tier already exists.
    await ensureColumn("users", "tier_expires_at", "TIMESTAMPTZ");
    // Terms/18+ consent timestamp. Email signup captures this at account creation
    // (the required Register checkbox); Google OAuth users start NULL and affirm it
    // on the post-sign-in ChooseUsername screen. When the column is first added,
    // grandfather every existing account (backfill to created_at) so nobody already
    // registered gets re-prompted. Runs exactly once - after this, new OAuth users
    // keep NULL until they accept.
    {
      const hasTermsCol = await db.get(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'terms_accepted_at'`
      );
      if (!hasTermsCol) {
        await db.exec("ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ");
        await db.run("UPDATE users SET terms_accepted_at = created_at WHERE terms_accepted_at IS NULL");
      }
    }
    // Unique partial index on google_id (allows multiple NULLs for non-Google users).
    await db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL"
    );
    // Admin Logs page: the actual provider error (rate limit, timeout, bad JSON
    // from the model, etc.) was previously only console.error'd and lost -
    // logApiCall() now persists it here so a failed call is diagnosable after
    // the fact instead of only in transient server logs.
    await ensureColumn("api_calls", "error_message", "TEXT");
    // Metered units this call consumes. Almost always 1, but batch-evaluate
    // grades N questions in a single API call, and the student should be
    // charged for N reasonings, not one. Defaults to 1 so every existing row
    // and every ordinary call keeps counting exactly as before.
    await ensureColumn("api_calls", "units", "INTEGER NOT NULL DEFAULT 1");
    // Coach sessions are soft-deleted. Usage is metered by counting rows, so a
    // hard DELETE handed the student their passage allowance back and made the
    // daily cap trivially farmable. The row stays and keeps counting; every
    // read path filters on deleted_at IS NULL.
    await ensureColumn("coach_sessions", "deleted_at", "TIMESTAMPTZ");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at DESC)");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_api_calls_user_id ON api_calls(user_id)");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_api_calls_status ON api_calls(status)");
    // Hot columns with zero indexes until now - every dashboard, session, and
    // account-export/delete query filters or joins on these and was doing a
    // full table scan. sr_cards already gets one for free from its
    // UNIQUE(user_id, question_id) constraint, so it's skipped here.
    await db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id)");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON coach_sessions(user_id)");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_coach_attempts_coach_session_id ON coach_attempts(coach_session_id)");

    // Drills difficulty (easy | medium | tough). DEFAULT 'medium' is a safety net
    // so no question is ever un-filterable; existing rows are backfilled to medium
    // (a one-time no-op once every row has a value).
    await ensureColumn("questions", "difficulty", "TEXT DEFAULT 'medium'");
    await db.exec("UPDATE questions SET difficulty = 'medium' WHERE difficulty IS NULL");
    // Monetization (Phase 6): one payment row per Razorpay order. Status flows
    // created → captured (webhook) → tier granted. Kept even after the tier
    // expires, as the billing history / audit trail.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        tier TEXT NOT NULL,
        months INTEGER NOT NULL DEFAULT 1,
        amount_inr INTEGER NOT NULL,
        provider TEXT NOT NULL DEFAULT 'razorpay',
        razorpay_order_id TEXT UNIQUE,
        razorpay_payment_id TEXT,
        status TEXT NOT NULL DEFAULT 'created',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        captured_at TIMESTAMPTZ
      )
    `);
    await db.exec("CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)");
    // 'monthly' (recurring 1-month) vs 'cat' (one-time, expires on the exam date).
    await ensureColumn("payments", "period", "TEXT NOT NULL DEFAULT 'monthly'");
    await ensureColumn("payments", "season_year", "INTEGER");

    // Razorpay recurring (autopay) - one Plan per (tier, mode, price); reused
    // across all subscribers. amount_inr is part of the key because Razorpay
    // plan amounts are immutable, so a price change needs a fresh plan.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS razorpay_plans (
        id SERIAL PRIMARY KEY,
        tier TEXT NOT NULL,
        mode TEXT NOT NULL,            -- 'test' | 'live'
        amount_inr INTEGER NOT NULL,
        plan_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tier, mode, amount_inr)
      )
    `);

    // A user's recurring subscription (monthly autopay). At most one active at a
    // time. Tier access itself still lives on users.tier_expires_at - each
    // successful charge extends it by a month; this table tracks the mandate.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        tier TEXT NOT NULL,
        razorpay_subscription_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',  -- created|authenticated|active|pending|halted|cancelled|completed
        last_charge_id TEXT,                     -- razorpay payment id of the most recently applied charge (dedup)
        current_end TIMESTAMPTZ,                 -- paid-through date (mirror of users.tier_expires_at at last charge)
        cancel_at_cycle_end BOOLEAN NOT NULL DEFAULT false,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)");
    await seedQuestions();
    await bootstrapAdmins();
    console.log("[db] Database initialised.");
  } catch (err) {
    console.error("[db] Initialisation error:", err);
    process.exit(1);
  }
})();

module.exports = db;
