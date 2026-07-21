// Test-user lifecycle: create, mint tokens, and always clean up. Every user
// this suite creates is prefixed `qa_` and uses the `@qatest.local` domain —
// matching the convention the manual 2026-07-18 QA run used (see
// PRELAUNCH_TEST_RESULTS.md) — so leftover rows are trivially identifiable
// and never collide with a real signup.
"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { api, withRateLimitRetry } = require("./apiClient");
const { requireDb, query, hasDb } = require("./db");

function uniqueSuffix() {
  return `${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

// Register a user, then bypass OTP by marking email_verified directly in the
// DB rather than trying to intercept a real email (Resend sends real mail
// even in staging) — see tests/support/db.js. Requires DATABASE_URL.
async function createVerifiedUser(t, { role = "user" } = {}) {
  if (!requireDb(t)) return null;

  const suffix = uniqueSuffix();
  const username = `qa_${suffix}`;
  const email = `${username}@qatest.local`;
  const password = "TestPass123!";

  const reg = await withRateLimitRetry(() =>
    api.post("/api/auth/register", { body: { username, email, password } })
  );
  if (reg.status !== 200 || !reg.body?.requiresVerification) {
    throw new Error(`fixture register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }

  await query("UPDATE users SET email_verified = 1 WHERE email = $1", [email]);
  if (role === "admin") {
    await query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  }

  const login = await withRateLimitRetry(() =>
    api.post("/api/auth/login", { body: { identifier: username, password } })
  );
  if (login.status !== 200 || !login.body?.token) {
    throw new Error(`fixture login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return { username, email, password, id: login.body.user.id, token: login.body.token };
}

// Deletes via the real API path (DELETE /api/account), not a raw DB delete —
// exercises the same transaction-wrapped route real users hit, and means
// cleanup works identically whether DATABASE_URL is set or not.
async function deleteUser(user) {
  if (!user?.token) return;
  await api.delete("/api/account", { token: user.token });
}

// Mints a token for an arbitrary user id without going through login — used
// for tamper/expiry tests where we want to control the JWT's claims or
// signature directly. Requires JWT_SECRET (same requirement as running the
// real server, so this is a local/staging-only helper).
function mintToken(userId, { secret = process.env.JWT_SECRET, expiresIn = "7d" } = {}) {
  if (!secret) return null;
  return jwt.sign({ userId }, secret, { expiresIn });
}

// A syntactically valid JWT signed with the WRONG secret — must be rejected
// regardless of whether the real JWT_SECRET is known to the test runner.
function forgedToken(userId) {
  return jwt.sign({ userId }, "definitely-not-the-real-secret", { expiresIn: "7d" });
}

module.exports = { createVerifiedUser, deleteUser, mintToken, forgedToken, hasDb, query };
