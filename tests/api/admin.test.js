// Admin API — PRELAUNCH_TEST_PLAN.md §1.5. The whole router is gated by a
// single `router.use(authenticate, requireAdmin)`, so most of the value here
// is confirming that gate actually holds across a representative sample of
// routes — not re-testing each route's business logic individually.
"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("../support/apiClient");
const { createVerifiedUser, deleteUser, hasDb } = require("../support/fixtures");
const { closeDb } = require("../support/db");

let user, admin;
const skip = !hasDb();

before(async (t) => {
  if (skip) return;
  user = await createVerifiedUser(t);
  admin = await createVerifiedUser(t, { role: "admin" });
});

after(async () => {
  await Promise.all([user, admin].filter(Boolean).map(deleteUser));
  await closeDb();
});

const ADMIN_GET_ROUTES = ["/api/admin/overview", "/api/admin/users", "/api/admin/api-calls", "/api/admin/costs", "/api/admin/flags"];

for (const route of ADMIN_GET_ROUTES) {
  test(`AD1 — ${route}: no token → 401`, async () => {
    const res = await api.get(route);
    assert.equal(res.status, 401);
  });

  test(`AD1 — ${route}: non-admin token → 403`, { skip }, async () => {
    const res = await api.get(route, { token: user.token });
    assert.equal(res.status, 403);
  });

  test(`AD1 — ${route}: admin token → 200`, { skip }, async () => {
    const res = await api.get(route, { token: admin.token });
    assert.equal(res.status, 200);
  });
}

test("AD2 — PATCH /users/:id/tier: non-admin → 403", { skip }, async () => {
  const res = await api.patch(`/api/admin/users/${admin.id}/tier`, {
    token: user.token,
    body: { tier: "topper" },
  });
  assert.equal(res.status, 403);
});

test("AD7 — self-demote guard: admin cannot demote themselves", { skip }, async () => {
  const res = await api.patch(`/api/admin/users/${admin.id}`, {
    token: admin.token,
    body: { role: "user" },
  });
  // Whatever the exact status, the effect must not go through — verify by
  // re-reading the admin's own role via /me rather than trusting the status
  // code alone (a 200 that silently no-ops would still be correct here).
  const me = await api.get("/api/auth/me", { token: admin.token });
  assert.equal(me.body.user.role, "admin", "an admin must never be able to demote themselves");
  void res;
});
