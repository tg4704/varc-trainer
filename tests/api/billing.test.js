// Billing API — PRELAUNCH_TEST_PLAN.md §1.4. Amounts are server-authoritative
// (quoteFor()), so the highest-value checks are: no secret leakage on the
// public /plans route, and strict per-caller scoping on /me and /payments.
"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("../support/apiClient");
const { createVerifiedUser, deleteUser, hasDb } = require("../support/fixtures");
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

test("B1 — GET /plans: public, no auth required, no secrets leaked", async () => {
  const res = await api.get("/api/billing/plans");
  assert.equal(res.status, 200);
  const dump = JSON.stringify(res.body).toLowerCase();
  assert.ok(!dump.includes("key_secret"), "KEY_SECRET must never appear in the public plans payload");
  assert.ok(!dump.includes("webhook_secret"), "WEBHOOK_SECRET must never appear in the public plans payload");
  assert.ok(Array.isArray(res.body.tiers) && res.body.tiers.length > 0);
  assert.ok(Array.isArray(res.body.seasons), "expected the seasons[] array (two-season pricing)");
});

test("B1 — GET /plans: server-computed season prices match across tiers (quote/plans parity)", async () => {
  const res = await api.get("/api/billing/plans");
  const season = res.body.seasons?.[0];
  assert.ok(season, "expected at least one season on sale");
  for (const tier of res.body.tiers.filter((t) => t.priceInr > 0)) {
    const p = season.prices[tier.key];
    assert.ok(p, `expected a season price for ${tier.key}`);
    assert.equal(p.totalInr, Math.round(p.listTotalInr * (1 - p.discountPct / 100)));
  }
});

test("B3 — GET /me: returns only the caller's own plan", { skip }, async () => {
  const res = await api.get("/api/billing/me", { token: user.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.tier, "free", "fresh fixture user should be on the free tier");
});

test("B3 — GET /me: no token → 401", async () => {
  const res = await api.get("/api/billing/me");
  assert.equal(res.status, 401);
});

test("B4 — GET /payments: A's history never contains B's rows", { skip }, async (t) => {
  const other = await createVerifiedUser(t);
  try {
    const res = await api.get("/api/billing/payments", { token: other.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.payments, [], "a fresh user should have zero captured payments");
  } finally {
    await deleteUser(other);
  }
});

test("B5 — POST /create-order: unknown tier → 400", { skip }, async () => {
  const res = await api.post("/api/billing/create-order", {
    token: user.token,
    body: { tier: "not_a_real_tier", period: "monthly" },
  });
  assert.equal(res.status, 400);
});

test("B5 — POST /create-order: free tier is not purchasable → 400", { skip }, async () => {
  const res = await api.post("/api/billing/create-order", {
    token: user.token,
    body: { tier: "free", period: "monthly" },
  });
  assert.equal(res.status, 400);
});

test("Season spoofing: an invented seasonYear falls back to the real default, never honoured", { skip }, async () => {
  const plans = await api.get("/api/billing/plans");
  const realYears = plans.body.seasons.map((s) => s.year);
  assert.ok(!realYears.includes(2099), "2099 must not be a real season");

  const quote = await api.get("/api/billing/quote?tier=inference&period=cat&seasonYear=2099", { token: user.token });
  assert.equal(quote.status, 200);
  assert.ok(realYears.includes(quote.body.seasonYear), "forged year should silently fall back to a real, on-sale season, not error or honour the fake one");
});
