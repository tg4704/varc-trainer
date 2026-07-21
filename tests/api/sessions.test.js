// Sessions/Practice API — PRELAUNCH_TEST_PLAN.md §1.2. Ownership scoping is
// the primary IDOR surface in this app (getOwnedSession() = every read/write
// WHERE id=$1 AND user_id=$2) — that's the highest-value thing this file
// checks: User A must get 404, never another user's data, on every :id route.
"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("../support/apiClient");
const { createVerifiedUser, deleteUser, hasDb } = require("../support/fixtures");
const { closeDb } = require("../support/db");

let userA, userB, sessionB; // sessionB is owned by userB — userA must never reach it
const skip = !hasDb();

before(async (t) => {
  if (skip) return;
  userA = await createVerifiedUser(t);
  userB = await createVerifiedUser(t);

  const created = await api.post("/api/sessions", {
    token: userB.token,
    body: { numQuestions: 3, timerMode: "untimed" },
  });
  if (created.status !== 200 || !created.body?.session?.id) {
    throw new Error(`fixture session create failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  sessionB = created.body.session;
});

after(async () => {
  await Promise.all([userA, userB].filter(Boolean).map(deleteUser));
  await closeDb();
});

test("S1 — POST /: valid config creates a session bound to the caller", { skip }, async () => {
  const res = await api.post("/api/sessions", {
    token: userA.token,
    body: { numQuestions: 5, timerMode: "untimed" },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.session?.id);
});

test("S1 — POST /: numQuestions out of range → 400", { skip }, async () => {
  const zero = await api.post("/api/sessions", { token: userA.token, body: { numQuestions: 0, timerMode: "untimed" } });
  assert.equal(zero.status, 400);

  const tooMany = await api.post("/api/sessions", { token: userA.token, body: { numQuestions: 26, timerMode: "untimed" } });
  assert.equal(tooMany.status, 400);
});

test("S1 — POST /: countdown timer without timerSeconds → 400", { skip }, async () => {
  const res = await api.post("/api/sessions", {
    token: userA.token,
    body: { numQuestions: 5, timerMode: "countdown", timerScope: "per_question" },
  });
  assert.equal(res.status, 400);
});

test("S1 — POST /: body cannot inject a different owner — binds to the token's user", { skip }, async () => {
  const res = await api.post("/api/sessions", {
    token: userA.token,
    body: { numQuestions: 3, timerMode: "untimed", user_id: userB.id, userId: userB.id },
  });
  assert.equal(res.status, 200);
  // Confirm it's owned by A, not B: A can read it back via the ownership-scoped GET.
  const readBack = await api.get(`/api/sessions/${res.body.session.id}`, { token: userA.token });
  assert.equal(readBack.status, 200);
});

test("S2 — GET /: A's list never includes B's sessions", { skip }, async () => {
  const res = await api.get("/api/sessions", { token: userA.token });
  assert.equal(res.status, 200);
  const ids = (res.body.sessions || res.body).map((s) => s.id);
  assert.ok(!ids.includes(sessionB.id), "A's session list leaked B's session id");
});

test("S3 — GET /:id — IDOR: A requesting B's session id → 404", { skip }, async () => {
  const res = await api.get(`/api/sessions/${sessionB.id}`, { token: userA.token });
  assert.equal(res.status, 404);
});

test("S3 — GET /:id — control: B reading their own session → 200", { skip }, async () => {
  const res = await api.get(`/api/sessions/${sessionB.id}`, { token: userB.token });
  assert.equal(res.status, 200);
});

test("S3 — GET /:id — non-existent id → 404, not 500", { skip }, async () => {
  const res = await api.get("/api/sessions/999999999", { token: userA.token });
  assert.equal(res.status, 404);
});

test("S4 — GET /:id/questions — IDOR: A on B's session → 404 (would otherwise leak the paragraph/options)", { skip }, async () => {
  const res = await api.get(`/api/sessions/${sessionB.id}/questions`, { token: userA.token });
  assert.equal(res.status, 404);
});

test("S4 — GET /:id/questions — own session: sanitised, no answer-key fields", { skip }, async () => {
  const res = await api.get(`/api/sessions/${sessionB.id}/questions`, { token: userB.token });
  assert.equal(res.status, 200);
  for (const q of res.body.questions) {
    assert.equal(q.correctIndex, undefined, "correctIndex leaked pre-reveal");
    assert.equal(q.trapIndex, undefined, "trapIndex leaked pre-reveal");
    assert.equal(q.sourceLines, undefined, "sourceLines leaked pre-reveal");
    for (const opt of q.options) {
      assert.equal(opt.isCorrect, undefined, "option.isCorrect leaked pre-reveal");
      assert.equal(opt.isTrap, undefined, "option.isTrap leaked pre-reveal");
    }
  }
});

test("S5 — GET /:id/review — IDOR: A on B's session review → 404", { skip }, async () => {
  const res = await api.get(`/api/sessions/${sessionB.id}/review`, { token: userA.token });
  assert.equal(res.status, 404);
});

test("S6 — POST /:id/complete — IDOR: A cannot complete B's session", { skip }, async () => {
  const res = await api.post(`/api/sessions/${sessionB.id}/complete`, { token: userA.token });
  assert.equal(res.status, 404);
});

test("S7 — POST /:id/batch-evaluate — IDOR: A cannot trigger AI spend on B's session", { skip }, async () => {
  const res = await api.post(`/api/sessions/${sessionB.id}/batch-evaluate`, { token: userA.token });
  assert.equal(res.status, 404);
});
