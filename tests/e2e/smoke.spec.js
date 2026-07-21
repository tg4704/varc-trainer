// Minimal E2E smoke — proves the harness works end-to-end (real browser,
// real server, real DB) without trying to drive the full OTP-verification UI
// flow. Auth is seeded directly: mint a real JWT for a DB-backed fixture
// user and inject it into localStorage under the same key api.js reads
// (`varc_token`), then load an authenticated route directly. Faster and far
// less flaky than clicking through Login every run, and just as real a test
// of "does the authenticated app actually render" — the token still has to
// pass the server's real verification on every request.
"use strict";

const { test, expect } = require("@playwright/test");
const { createVerifiedUser, deleteUser, hasDb } = require("../support/fixtures");
const { closeDb } = require("../support/db");

test.describe("smoke", () => {
  test("home page loads for a logged-out visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Graspr/i);
  });

  test("login page renders the identifier + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="text"], input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("a seeded JWT reaches an authenticated route (dashboard renders, not redirected to /login)", async ({ page }) => {
    test.skip(!hasDb(), "needs DATABASE_URL");
    // hasDb() already confirmed above — requireDb()'s internal skip path
    // (t.skip(...)) is unreachable here, so a no-op stub is all this needs.
    const user = await createVerifiedUser({ skip: () => {} });
    try {
      // Navigate first so localStorage has an origin to attach to, then seed
      // the token and reload into the real authenticated boot path.
      await page.goto("/login");
      await page.evaluate((token) => localStorage.setItem("varc_token", token), user.token);
      await page.goto("/dashboard");
      await expect(page).not.toHaveURL(/\/login/);
    } finally {
      await deleteUser(user);
    }
  });
});

test.afterAll(async () => {
  await closeDb();
});
