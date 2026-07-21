// Direct DB access for test fixtures ONLY — never for asserting product
// behavior (assertions belong on API responses, not table rows). Used to:
//   - control OTP verification deterministically (see fixtures.js)
//   - hard-delete leftover QA rows a failed run left behind
//
// Only usable when DATABASE_URL is set (local dev / staging). A prod smoke
// run has no DB credentials and must not need them — tests that require this
// module skip themselves via requireDb() rather than crashing the suite.
"use strict";

const { Pool } = require("pg");

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
}

function requireDb(t) {
  if (!pool) {
    t.skip("DATABASE_URL not set — skipping (this test needs direct DB access, e.g. local/staging only)");
    return false;
  }
  return true;
}

async function query(text, params) {
  if (!pool) throw new Error("DATABASE_URL not set");
  return pool.query(text, params);
}

async function closeDb() {
  if (pool) await pool.end();
}

module.exports = { requireDb, query, closeDb, hasDb: () => Boolean(pool) };
