// Cross-cutting security checks — PRELAUNCH_TEST_PLAN.md §3. Not tied to one
// route file: JWT tamper handling, deleted-user tokens, admin gating, body
// size limits, security headers, CORS, and the auth rate limiter's actual
// boundary (deliberately isolated here, not tripped incidentally elsewhere).
"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("../support/apiClient");
const { createVerifiedUser, deleteUser, forgedToken, hasDb } = require("../support/fixtures");
const { closeDb } = require("../support/db");

let user;
const skip = !hasDb();

before(async (t) => {
  if (skip) return;
  user = await createVerifiedUser(t);
});

after(async () => {
  if (user) await deleteUser(user);
  await closeDb();
});

test("Admin route: no token → 401", async () => {
  const res = await api.get("/api/admin/overview");
  assert.equal(res.status, 401);
});

test("Admin route: valid non-admin token → 403, not 401 (auth succeeded, authorization didn't)", { skip }, async () => {
  const res = await api.get("/api/admin/overview", { token: user.token });
  assert.equal(res.status, 403);
});

test("Admin route: forged-signature token → 401", { skip }, async () => {
  const res = await api.get("/api/admin/overview", { token: forgedToken(user.id) });
  assert.equal(res.status, 401);
});

test("Deleted-user token → 401 on every authenticated route, not silently treated as valid", { skip }, async (t) => {
  // Delete via the real DELETE /api/account route (transaction-wrapped,
  // handles the otp_tokens/sessions/etc cascade correctly) rather than a raw
  // SQL DELETE — a bare `DELETE FROM users` fails on otp_tokens' FK
  // constraint (no ON DELETE CASCADE), since register always creates one.
  // Using the app's own deletion path is also just the more honest test: the
  // token remains cryptographically valid (JWT is stateless), only the row
  // is gone — exactly the scenario authenticate()'s user-existence check
  // exists for.
  const victim = await createVerifiedUser(t);
  const staleToken = victim.token;
  const del = await api.delete("/api/account", { token: staleToken });
  assert.equal(del.status, 200, "fixture cleanup itself failed — not what this test is checking");

  const me = await api.get("/api/auth/me", { token: staleToken });
  assert.equal(me.status, 401, "a deleted user's still-valid-signature token must be rejected");

  const sessions = await api.get("/api/sessions", { token: staleToken });
  assert.equal(sessions.status, 401);
});

test("Body over the 100kb limit → 413, not 500", { skip }, async () => {
  const oversized = "x".repeat(150 * 1024);
  const res = await api.post("/api/sessions", {
    token: user.token,
    body: { numQuestions: 5, timerMode: "untimed", padding: oversized },
  });
  assert.equal(res.status, 413);
});

test("Security headers present on a real response (helmet)", async () => {
  const res = await api.get("/api/health");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("x-frame-options"), "expected X-Frame-Options to be set");
  // CSP is deliberately off (see CLAUDE.md — Railway serves the static build
  // from the same process and a default CSP needs tuning against that) — not
  // asserting on it here would be testing a decision, not a regression.
});

test("CORS: a disallowed Origin is not echoed back / allowed", async () => {
  const res = await fetch(`${api.BASE_URL}/api/billing/plans`, {
    headers: { Origin: "https://evil-attacker.example" },
  });
  const acao = res.headers.get("access-control-allow-origin");
  assert.notEqual(acao, "https://evil-attacker.example", "CORS reflected an untrusted origin");
});

test("authLimiter: exceeding the auth-route budget returns 429 with a JSON error, not a hang or 500", async (t) => {
  // Deliberately spends this file's whole authLimiter budget on ONE targeted
  // check (rather than letting other files trip it by accident) — fire past
  // the ceiling and confirm the shape of what a caller actually sees.
  const email = () => `ratelimit_${Date.now()}_${Math.random().toString(36).slice(2)}@qatest.local`;
  let sawLimited = false;
  for (let i = 0; i < 14; i++) {
    const res = await api.post("/api/auth/forgot-password", { body: { email: email() } });
    if (res.status === 429) {
      assert.ok(res.body?.error, "429 response should carry a JSON error message");
      sawLimited = true;
      break;
    }
  }
  assert.ok(sawLimited, "expected to hit the auth rate limiter within 14 requests from one IP");
});
