// Thin fetch wrapper the whole API suite shares. Reads BASE_URL from env so
// the exact same test files run against local dev, staging, or the deployed
// prod URL — that portability is the whole point of this suite (see the
// Stage 4 note in the Obsidian launch checklist).
//
//   BASE_URL=https://www.graspr.in node --test tests/api
//
// Defaults to localhost:3001 (the dev server) when unset.
"use strict";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");

// One request, JSON in/out. Never throws on a non-2xx — every route under
// test is expected to return structured 4xx/5xx JSON, not a network error,
// so callers assert on `status`/`body` directly instead of try/catching.
async function req(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}

const api = {
  BASE_URL,
  get: (path, opts) => req("GET", path, opts),
  post: (path, opts) => req("POST", path, opts),
  patch: (path, opts) => req("PATCH", path, opts),
  delete: (path, opts) => req("DELETE", path, opts),
};

// For fixture setup only (register/login), NOT for tests asserting on rate-
// limit behavior itself — those must see a real, immediate 429. The suite's
// authLimiter budget (10/min/IP) is shared across every file in the run, and
// node:test can run files concurrently, so a file that happens to land after
// others have already spent the budget would otherwise fail on fixture
// creation for reasons that have nothing to do with what it's testing. Reads
// the real `RateLimit-Reset` header (seconds) rather than guessing a wait.
async function withRateLimitRetry(fn, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fn();
    if (res.status !== 429 || attempt >= retries) return res;
    const resetSeconds = Number(res.headers.get("ratelimit-reset")) || 60;
    await new Promise((r) => setTimeout(r, (resetSeconds + 1) * 1000));
  }
}

module.exports = { api, withRateLimitRetry };
