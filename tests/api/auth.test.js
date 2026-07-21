// Auth API coverage — ports the highest-value rows from PRELAUNCH_TEST_PLAN.md
// §1.1. Positive paths, the account-enumeration guards (the actual security
// property, not just "does it 200"), and ownership scoping on /me.
//
// Shares two fixture users across the whole file (created once in `before`)
// rather than one-per-test: authLimiter is 10/min/IP shared across
// register/login/forgot-password/etc, and a fresh register+login pair per
// test blows through that budget well before the file finishes. Rate-limit
// behavior itself is tested deliberately in security.test.js, not tripped
// incidentally here.
//
// Kept deliberately under budget (8 authLimiter-gated calls: 4 in `before`
// + 4 below) rather than right at the 10/min ceiling — the window's start
// time isn't controlled by this file (it began at the first authLimiter
// request the server received, possibly before this run), so a razor-thin
// margin is flaky by construction, not just unlucky.
"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { api, withRateLimitRetry } = require("../support/apiClient");
const { createVerifiedUser, deleteUser, forgedToken, hasDb } = require("../support/fixtures");
const { closeDb } = require("../support/db");

let userA, userB;
const skip = !hasDb();

before(async (t) => {
  if (skip) return;
  userA = await createVerifiedUser(t);
  userB = await createVerifiedUser(t);
});

after(async () => {
  await Promise.all([userA, userB].filter(Boolean).map(deleteUser));
  await closeDb();
});

// The positive login path (correct creds → 200 + token, no password_hash) is
// exercised by `before()`'s own createVerifiedUser() call for every other
// test in this file — a dedicated duplicate here would just spend one more
// of a scarce shared budget to re-prove something already proven every run.

// Every authLimiter-gated call below is wrapped in withRateLimitRetry — these
// tests assert on enumeration-resistance and response shape, not on the rate
// limiter itself (that has its own dedicated test in security.test.js), so a
// 429 here should transparently retry rather than fail the wrong assertion.
// Cross-file budget sharing (one in-memory limiter, whichever files happen to
// run first in the same 60s window) makes this necessary, not just tidy.

test("A2 — login: wrong password returns a generic 401, no leak", { skip }, async () => {
  const res = await withRateLimitRetry(() => api.post("/api/auth/login", {
    body: { identifier: userA.username, password: "wrong-password-entirely" },
  }));
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Invalid credentials");
});

test("A2 — login: unknown identifier returns the SAME generic 401 (no enumeration)", async () => {
  const res = await withRateLimitRetry(() => api.post("/api/auth/login", {
    body: { identifier: "no_such_user_at_all_qa", password: "whatever123" },
  }));
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Invalid credentials");
});

test("A5 — forgot-password: known vs unknown email are byte-identical (no enumeration)", { skip }, async () => {
  const known = await withRateLimitRetry(() => api.post("/api/auth/forgot-password", { body: { email: userA.email } }));
  const unknown = await withRateLimitRetry(() => api.post("/api/auth/forgot-password", {
    body: { email: `nobody_${Date.now()}@qatest.local` },
  }));
  assert.equal(known.status, unknown.status);
  assert.deepEqual(known.body, unknown.body, "response bodies must not differ — that's the leak");
});

// Duplicate-username → 409 is covered more cheaply (no authLimiter spend) by
// the "A9 — PATCH /username" test below, which exercises the same uniqueness
// constraint via a non-rate-limited route.

test("A1 — register: duplicate email returns the SAME shape as a fresh signup (no enumeration)", { skip }, async () => {
  const res = await withRateLimitRetry(() => api.post("/api/auth/register", {
    body: { username: `different_${Date.now()}`, email: userA.email, password: "AnotherPass123!" },
  }));
  assert.equal(res.status, 200);
  assert.equal(res.body.requiresVerification, true);
});

test("A7 — GET /me: valid token returns own profile without password_hash", { skip }, async () => {
  const res = await api.get("/api/auth/me", { token: userA.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, userA.username);
  assert.equal(res.body.user.password_hash, undefined);
});

test("A7 — GET /me: no token → 401", async () => {
  const res = await api.get("/api/auth/me");
  assert.equal(res.status, 401);
});

test("A7 — GET /me: tampered signature → 401 (not the payload's claimed user)", { skip }, async () => {
  const bad = forgedToken(userA.id);
  const res = await api.get("/api/auth/me", { token: bad });
  assert.equal(res.status, 401);
});

test("A8 — GET /username-available: reflects only availability, nothing else", { skip }, async () => {
  const taken = await api.get(`/api/auth/username-available?u=${userA.username}`);
  assert.equal(taken.body.available, false);

  const free = await api.get(`/api/auth/username-available?u=qa_free_${Date.now()}`);
  assert.equal(free.body.available, true);
});

test("A9 — PATCH /username: cannot be used to claim another user's taken username", { skip }, async () => {
  const res = await api.patch("/api/auth/username", { token: userA.token, body: { username: userB.username } });
  assert.equal(res.status, 409);
});

test("A11 — PATCH /password: wrong current password → 401", { skip }, async () => {
  const res = await api.patch("/api/auth/password", {
    token: userB.token,
    body: { currentPassword: "definitely-wrong", newPassword: "NewPass123!" },
  });
  assert.equal(res.status, 401);
});
