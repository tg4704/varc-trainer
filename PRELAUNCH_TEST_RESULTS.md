# Graspr — Pre-Launch QA Results

**Run date:** 2026-07-20 · **Environment:** local dev (API `http://localhost:3001`, client `http://localhost:5173`, Postgres `varc`)
**Method:** QA-lead orchestration — one delegated subagent per test area, API-level (curl/psql) verification, results synthesised and spot-confirmed by the orchestrator.
**Build marker:** `X-App-Version: streak-navguard-1`
**Prior run:** [`PRELAUNCH_TEST_RESULTS_2026-07-18.md`](PRELAUNCH_TEST_RESULTS_2026-07-18.md) (archived — see "Relationship to the 2026-07-18 run" below)

## VERDICT AT TIME OF TESTING: 🔴 NO-GO
## STATUS AFTER REMEDIATION: 🟡 GO WITH CONDITIONS (both P0s fixed & re-verified — see Remediation log)

A **P0 full authentication bypass** was found and independently reproduced: any verified account — including all three admin accounts — could be taken over using **only the account's email address**, with no password and no valid OTP. **This has since been fixed and re-verified** (2026-07-20, same day). If this code was ever deployed, still treat it as an incident for that build and rotate `JWT_SECRET`.

### Remediation log — 2026-07-20, post-QA

| ID | Fix | Verified by |
|---|---|---|
| **P0-1** | `verify-email` now calls `verifyOtp()` **before** issuing any token; the "already verified → just log them in" short-circuit is gone | Re-ran the exact exploit: garbage OTP on a verified account now returns **400, no token** (was 200 + working JWT) |
| **P0-2** | `authLimiter` added to `verify-email` **and** `resend-otp` | Burst of 13 calls → `400×6` then `429×7` (was 14/14 with zero 429) |
| **P1-1** | `reset-password` now sets `email_verified = 1` alongside the password update | Full flow on a fresh unverified account: reset → `email_verified=1` → login **200** (was 403 `requiresVerification`) |
| **P1-2** | `reset-password` returns the generic `NO_ACTIVE_CODE` message for unknown emails instead of a 404 | Unregistered email → **400** generic (was 404 "No account found") |
| **P1-3** | `retry-evaluation` now passes `q` into `runEvaluation()` | Retried attempt 174 → real 5-field verdict, `reasoning_score` persisted, **no duplicate row** (was always `aiError`) |
| **P2-1** | `resend-otp` returns byte-identical `{"ok":true}` for known and unknown emails | Both → `{"ok":true}` HTTP 200 |
| **P2-6** | `evaluateOneAttempt`'s `models` hoisted out of the `try` so the catch logs the model actually attempted; dead `DEFAULT_MODEL` import removed | `grep` shows zero `model: DEFAULT_MODEL` left in `sessions.js` |
| **P2-3 / P2-4** | CLAUDE.md corrected: no `annual` billing period exists (`monthly` \| `cat` only); `save-to-bank` marked removed | Cross-checked against `billing.js`, `Pricing.jsx:54`, and a live 404 on the route |
| **P1-5** | `meterNewCoachPassage` checks for an existing active session before metering, so a resume is free but a new passage still counts | new→200, resume→**200** (was 402), *different* passage→**402** with cap intact, exactly 1 session row |
| **P1-7** | `authenticate()` rejects tokens whose user row no longer exists (existence check, not full revocation — documented inline) | after user deletion: `/auth/me`, `/dashboard`, `/sessions/active`, `/coach/history` all →**401** (three previously 200) |
| **P2-8** | `Modal` gained `returnFocusTo` (ref \| element \| getter) with `isConnected` guards; 4 TopNav modals pass the avatar button | live browser: Esc → focus on **"Account menu" button**, not `<body>`; verified across both defining files, zero console errors |
| **P1-6** *(drafted, needs review)* | Canonical reading keys authored for all 5 passages (`content-pipeline/seed_reading_keys.js`), applied locally | grader now returns `information-gathering` / `thesis: weak` / `caught_the_turn: false` citing the real ¶3→¶4 turn — previously graded against `Thesis: undefined` |

**Anti-enumeration note:** account-existence is now indistinguishable on the common path (a registered account with no outstanding code returns the *same* body as an unregistered one — verified byte-identical). A residual, weaker oracle remains: an account that currently has a *live* OTP returns "Incorrect code / expired" instead. Closing that fully would mean discarding genuinely useful UX ("your code expired — request a new one"), and it now requires the attacker to first trigger an OTP (which emails the victim, making it noisy). Accepted deliberately; revisit if enumeration ever shows up in practice.

**Regression sweep after the fixes:** health 200 · normal login 200 · wrong password 401 · register enumeration guard unchanged · unverified login 403 · full new-user register→OTP→verify→login happy path 200 end-to-end. No regressions.

---

## Environment ground truth (differs from the test brief)

| Fact | Brief assumed | Actual | Impact |
|---|---|---|---|
| `ENABLE_TIERS` | OFF | **ON** (`.env` + confirmed live via `/api/billing/me` returning a populated `usage` object) | Caps are really enforced. Testing proceeded against the launch-realistic config; Drills/Coach test users were granted `topper` so caps wouldn't cause false failures, and free-tier cap boundaries were tested with a dedicated zero-usage user. |
| `ADMIN_USERNAMES` | set | **empty** | No auto-promotion; the admin test user's `role` was set directly in the DB. |
| Razorpay keys | absent (dev mode) | **set** (`rzp_test_…`) | `create-order` reaches real Razorpay (test-mode key, no money at risk). Only validation/negative paths were exercised; no payment completed. |
| `AI_MODEL` | — | `openai/gpt-oss-120b:free` | The `:free` model is rate-limited and frequently errors. `topper`-tier users route to Haiku, so AI-dependent checks used those users. AI degradation was treated as a designed, handled path — not a defect. |
| `NODE_ENV` | — | `development` | 5xx responses return real messages; the "generic message in production" branch is code-verified only. |
| `SENTRY_DSN` / `RESEND_API_KEY` / `RAZORPAY_WEBHOOK_SECRET` | — | unset | Sentry is inert, OTP prints to console, webhook route fails closed (503). |

---

## Area 0 — Seed & Smoke

| Check | Expected | Actual | Result | Sev | Evidence |
|---|---|---|---|---|---|
| `GET /api/health` | `{ok:true}` w/ real DB round-trip | `{ok:true}` | PASS | — | 200 |
| Postgres reachable | `SELECT 1` | `1` | PASS | — | psql |
| Seed 9 namespaced users + mint JWTs | all tokens valid | 9/9 valid vs `/api/auth/me` | PASS | — | ids 13–21 |
| Real register → OTP → verify-email flow | works end-to-end | works (OTP recovered, verified) | PASS | — | qa_userA |
| Frontend reachable | 200 | 200 | PASS | — | :5173 |

---

## Area 1 — Auth

21/22 initial checks passed, plus a 4-check orchestrator-directed follow-up that uncovered the P0.

| Check | Expected | Actual | Result | Sev | Evidence |
|---|---|---|---|---|---|
| **`verify-email` with ANY otp on a verified account** | 400 incorrect code | **200 + valid 7-day JWT** | **FAIL** | **P0** | `auth.js:258-261`; reproduced by orchestrator |
| **`verify-email` has no `authLimiter`** | throttled | 14/14 rapid calls, **zero 429** | **FAIL** | **P0 amplifier** | `auth.js:251` |
| `reset-password` sets `email_verified` | verified after reset | never set; still issues a working JWT | FAIL | P1 | `auth.js:344-348` (orchestrator-confirmed) |
| `reset-password` unknown vs known email | generic | 404 vs 400 → enumeration oracle | FAIL | P1 | `auth.js:339` |
| `resend-otp` unknown vs known email | generic | both 200 but **body shape differs** | FAIL | P2 | `auth.js:280` |
| Register: email-enumeration guard | identical response | identical `{requiresVerification:true}` | PASS | — | — |
| Register: username collision | 409 specific (by design) | 409 | PASS | — | — |
| Register/login validation (8 cases incl. wrong types, >30, >254) | 400 | 400 each | PASS | — | zod |
| Login: wrong password vs unknown user | identical generic 401 | identical | PASS | — | — |
| Login: unverified | 403 `requiresVerification` | 403 | PASS | — | — |
| **Account lockout** (5 fails → correct password) | still 401 | still 401 (locked) | PASS | — | — |
| OTP wrong / expired / reuse / 5-attempt lockout | rejected each | rejected each | PASS | — | — |
| JWT expired / wrong-secret / `alg:none` forgery | 401 each | 401 each | PASS | — | — |
| PATCH username/name/avatar/profile/password authz+validation | 401 / 200 / 400 | as expected; wrong current password → 401 | PASS | — | — |
| `forgot-password` unknown email | generic | generic `{ok:true}` | PASS | — | — |
| Auth rate limiter | 429 after 10/min | 401×10 then 429×3 | PASS | — | — |

---

## Area 2 — Drills

| Check | Expected | Actual | Result | Sev | Evidence |
|---|---|---|---|---|---|
| **Answer-key invariant** on `/sessions/:id/questions`, `/questions/next`, partial active session | no `correctIndex`/`trapIndex`/`sourceLines` | none present | **PASS** | — | grep-clean |
| `retry-evaluation` re-runs the AI call | verdict returned | **always `aiError`** — `q` never passed to `runEvaluation()` | FAIL | P1 | `evaluate.js:249-254` (orchestrator-confirmed) |
| `batch-evaluate` tier-aware model routing | paid tier → Haiku | degraded to `:free` model live | FAIL | P1 (disputed — see Reconciliation) | `sessions.js` |
| Create session / prefetch / answer+reasoning / skip | correct behaviour | all correct; skip stores `NULL` selection + `skipped=1` | PASS | — | — |
| Evaluate validation (index 5, missing sessionId, wrong types) | 400 | 400 each | PASS | — | zod |
| Complete → review (post-reveal) | full reveal | full reveal incl. AI fields | PASS | — | — |
| Timed session auto-defers; deferred submit makes no AI call | `feedbackMode:deferred`, no `api_calls` growth | confirmed | PASS | — | — |
| Question flag | row created | `question_flags` row created | PASS | — | — |
| `retry-evaluation` on non-owned / missing attempt | 403/404 | 404 both | PASS | — | — |
| Timer freeze at lock; optimistic skip rollback | logic present | present | PASS (code) | — | `Practice.jsx` |

---

## Area 3 — Coach

| Check | Expected | Actual | Result | Sev | Evidence |
|---|---|---|---|---|---|
| **Invariant** on passages list, session create, reading-map, partial session | no answer keys, no `reading_key_json` | none present; **reveal correctly scoped to the answered question only** | **PASS** | — | per-question key diff |
| All passages have a canonical reading key | populated `reading_key_json` | **all 5 passages are `{}`** — grader scores against an empty key | FAIL | P1 | psql, `coach.js:161-168` |
| `save-to-bank` endpoint | exists, idempotent | **404 — route does not exist** | FAIL | P2 (stale doc) | — |
| Reading-map graded BEFORE questions (quick + full) | grade object returned | returned both modes | PASS | — | — |
| **Non-English (Hindi) reading map** | accepted | accepted + graded | PASS | — | — |
| Answer → 5-field verdict | reveal + verdict | all 5 fields | PASS | — | — |
| Discuss chat 4-exchange cap | 5th rejected | 5th → 400 "limit reached" | PASS | — | — |
| Free tier blocked from Discuss | 402 `feature_locked` | 402 `guided_coaching`, `upgradeTo:ninetyninth` | PASS | — | — |
| complete / stats / history / delete | correct | correct | PASS | — | — |
| Reading-map AI failure → ungraded stub, never blocks | degrade not block | confirmed | PASS (code) | — | `coach.js:137-206` |

---

## Area 4 — Ownership / IDOR ✅ (20/20)

| Check | Expected | Actual | Result | Sev |
|---|---|---|---|---|
| 14 cross-user attacks on User A's drills session, coach session, attempts, completes, deletes (as User B) | 403/404 each | **404 each; psql confirms zero rows read, written, or deleted** | PASS | — |
| `GET /billing/payments` as B | B's own only | `[]` — A's seeded payment absent | PASS | — |
| `GET /account/export` as B | B's data only | B's only; no trace of A | PASS | — |
| Answer-key leak probes on 4 pre-reveal endpoints | absent | absent (all snake+camel variants checked) | PASS | — |
| Sanity: B's own `/auth/me`; no-token access | 200 / 401 | 200 / 401 (rules out blanket-403 masking) | PASS | — |

Reproducible: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/sessions/66 -H "Authorization: Bearer <TOKEN_B>"` → **404**

---

## Area 5 — Billing

| Check | Expected | Actual | Result | Sev |
|---|---|---|---|---|
| **Forged Razorpay signature → tier grant** | rejected | 400 on `/verify` + `/verify-subscription`; **`users.tier` unchanged** | PASS | — |
| `/plans` prices vs `tiers.js` | ₹0/99/299/699 | exact match, incl. caps + names | PASS | — |
| `/me` usage object (tiers ON) | populated | `{period:"day",drills:0,coach:0}` | PASS | — |
| `dev-activate` grants tier + expiry | +30d, caps change | tier=inference, caps 25/4, psql-confirmed | PASS | — |
| "Annual = 10× monthly" | 990/2990/6990 | **no `annual` period exists** — only `monthly` + `cat`; `annual` silently treated as monthly | FAIL | P2 (doc) |
| Till-CAT (`cat`) season pricing | correct | ₹446 for 4.5 months, ends 2026-11-29 | PASS | — |
| Webhook with forged signature | rejected | 503 (secret unset → fails closed) | PASS | P2 (unconfigured) |
| Validation: invalid/missing tier, no auth, no active sub | 4xx, never 500 | 400/401/404 as appropriate | PASS | — |

---

## Area 6 — Admin ✅

| Check | Expected | Actual | Result | Sev |
|---|---|---|---|---|
| **21 non-admin requests to `/api/admin/*`** (12 GET + 9 mutating) | 403 each | **403 each; psql confirms zero mutation** | PASS | — |
| No-token admin routes | 401 | 401 | PASS | — |
| 10 admin GET endpoints | 200 + sane data | 200 each | PASS | — |
| **Admin prompt override changes LIVE model output** | marker appears | `reasoningFeedback` began with `ZEBRAMARKER` | PASS | — |
| Prompt reset | reverts to default | row deleted, byte-identical to default | PASS | — |
| Admin tier grant/revoke | expiry extended correctly | GREATEST/COALESCE extension, not overwrite | PASS | — |
| Non-admin PUT prompt / unknown key | 403 / 4xx | 403 / 404 | PASS | — |

---

## Area 7 — Edge & Error Handling (28/29)

| Check | Expected | Actual | Result | Sev |
|---|---|---|---|---|
| Coach cap blocks **resuming your own in-progress session** | resume allowed | **402** — capped user locked out of their own unfinished session all day | FAIL | P1 |
| Body 100kb+1 / just under | 413 / not 413 | 413 `Request body too large.` / 400 | PASS | — |
| Free coach cap boundary | 1st 200, 2nd 402 | exact, `reason:daily_cap, cap:1, upgradeTo:inference` | PASS | — |
| Free drills cap boundary | 9 allowed, 10 → 402 | exact, `cap:10, used:10` | PASS | — |
| XSS/RTL/zero-width/emoji/SQLi in reasoning + reading-map | stored verbatim, no execution | verbatim in DB; `users` count unchanged; no `dangerouslySetInnerHTML` | PASS | — |
| Prompt injection in reading-map | graceful, no prompt leak | graded honestly, no system-prompt echo | PASS | — |
| Expired + forged JWT | 401 | 401 both | PASS | — |
| 30s AI timeout; attempt saved before AI call | present | present | PASS (code) | — |
| Status sweep 400/401/402/403/413/429 | correct each | correct each; 429 at ~100/min global | PASS | — |
| 5xx generic only in production | code-correct | `index.js:399-411` correct (dev returns real msg, as expected) | PASS (code) | — |

---

## Area 8 — Cross-cutting & Frontend

Re-run after the earlier session-limit abort. Ran with `qa_frontend` for non-destructive browser checks and a freshly-provisioned `qa_reset2` (id=30) for the DPDP delete cascade (the original `qa_reset` did not survive the aborted run). Browser tools worked throughout — "browser-verified" rows are genuine.

| Check | Expected | Actual | Result | Sev | Evidence |
|---|---|---|---|---|---|
| Cloudflare apex→www 301 | production-only | cannot be tested locally | N/A | — | correctly out of scope |
| `GET /api/health` no auth | 200 `{ok:true}` | 200 | PASS | — | curl |
| Cache-Control on `/api/dashboard` | `no-store` | `no-store` | PASS | — | headers dumped |
| ErrorBoundary → `captureException` | wired | wired; no-op without DSN | PASS | — | `ErrorBoundary.jsx:23-26`, `sentry.js:28-30` |
| Sentry.setupExpressErrorHandler placement | after routes, before final handler | correct; 5xx generic only in prod | PASS | — | `index.js:388-390, 399-411` |
| Sentry end-to-end delivery | N/A — DSN unset | unverified by design | N/A | — | — |
| analytics.js gates on consent | no init pre-consent | `initAnalytics()` bails; `track()` no-ops | PASS | — | `analytics.js:17-19,39-41` |
| `VITE_POSTHOG_KEY` set in `client/.env` | (assumed maybe unset) | actually set | info | — | — |
| Cookie banner + no PostHog pre-consent | no `ph_*` in localStorage | confirmed after a clean re-test | PASS | — | browser + screenshot |
| Accept → consent persists + PostHog inits | `granted` in localStorage, real remote config populated | both confirmed | PASS | — | localStorage dump |
| **`GET /api/account/export` omits `password_hash`** | absent | absent | **PASS** | — | full export grep-clean |
| `DELETE /api/account/reset` | sessions/attempts gone, user survives | as-implemented (attempts+sessions only — coach kept, per code + CLAUDE.md) | PASS | — | psql before/after |
| **`DELETE /api/account` cascade** | user + owned data hard-deleted; shared data anonymised | users/sessions/attempts/coach_sessions/coach_attempts/sr_cards/otp_tokens → 0; `api_calls.user_id`, `question_flags.flagged_by_user_id`, authored `questions.author_user_id` → NULL | **PASS** | — | per-table psql verification |
| **Deleted user's JWT rejected** | 401 on `/api/auth/me`, no other route usable | `/me` → 404; **`/api/dashboard` & `/api/sessions/active` → 200 with empty data**; writes fail 500 via FK | **FAIL** | **P0** (see caveat) | `server/auth.js:17-29` orchestrator-confirmed |
| `GET /api/definitely-not-a-route` | 404 JSON | 404 `{"error":"Not found"}` | PASS | — | curl |
| `GET /assets/does-not-exist.js` on Express :3001 (prod path) | 404 JSON, NOT `index.html` | 404 `application/json` | PASS | — | Express prod path validated (`client/dist` exists) |
| Unknown SPA path | NotFound page renders | renders, tab title "Page not found · Graspr" | PASS | — | browser + screenshot |
| 375×812 mobile: nav collapse + no h-scroll | logo+avatar, `scrollWidth ≤ innerWidth` | both true | PASS | — | browser + screenshot + JS assert |
| 1280×800 desktop: full nav returns | Drills/Coach/Dashboard in bar | present | PASS | — | browser + screenshot |
| Modal focus trap (Change Password) | Tab cycles, wraps forward + back | wraps in both directions | PASS | — | `document.activeElement` after each keypress |
| Esc closes dismissible modal | closes | closed | PASS | — | browser |
| **Focus returns to trigger on close** | trigger refocused | focus lands on `<body>` — trigger already unmounted with the dropdown | **FAIL** | **P2** | `Modal.jsx:26-27, 67-70` + `TopNav.jsx:284` (orchestrator-confirmed) |
| `api.js` 401/402 event contract | 401→clear+`session-expired`; 402→`limit-reached` | exact code confirmed | PASS | — | `api.js:41-47, 53-57` |
| Invalid token → `/dashboard` → redirect + banner + preserve path | works | redirected, banner shown, `location.state.from === "/dashboard"` | PASS | — | browser + screenshot |

**Area 8 summary:** 20/23 pass, 1 N/A, 1 informational, plus the two failures above. The two DPDP P0-critical checks (`password_hash` absent from export; correct hard-delete + anonymise cascade on `DELETE /api/account`) both passed.

**P0 caveat on the JWT-after-delete finding:** the token stays cryptographically valid until its natural 7-day expiry because `authenticate()` never rechecks the user exists. No other user's data is reachable through it (writes fail on FK, reads return empty), so real data-exposure risk is low — but it literally satisfies the pre-set NO-GO criterion "deleted user's token still works." It is a deliberate design gap, not an oversight, and worth an explicit decision rather than silence.

---

## Reconciliation: `server/routes/sessions.js` (conflicting area findings)

Area 2 reported `batch-evaluate` ignores tier routing and lacks `requireEntitlement`; Area 7 reported the opposite. Orchestrator resolution:

- **Committed code (`HEAD`) contains the bug** — `git show HEAD:server/routes/sessions.js` line 7 lacks `resolveModels`.
- **The working tree contains an uncommitted fix** (`git status` → ` M server/routes/sessions.js`) adding `resolveModels(...)` and `requireEntitlement("drills")`.
- Area 2 observed a **live failure consistent with the buggy path** (deferred grading fell to the `:free` model), while Area 7 read the fixed file.
- The fix also looks **incomplete**: `sessions.js:379` still logs `model: DEFAULT_MODEL` on one error path.

**Action:** commit the fix, confirm the running build serves it, correct the residual `DEFAULT_MODEL` log, and re-test deferred grading for a paid-tier user.

---

## Relationship to the 2026-07-18 run

The archived report from two days ago concluded **"~50 checks executed, all passing. No security-critical failures,"** and explicitly claimed coverage of *"Auth hardening"* and *"Account enumeration blocked."* **P0-1 existed then and was missed.**

The gap is instructive: that run tested enumeration at `/register` and `/forgot-password` (both correctly hardened) but never sent a **deliberately wrong OTP to `/verify-email`** — the one probe that exposes the short-circuit. Treat "all passing" from a prior run as scoped to what it actually probed, not as a clean bill of health. Two other items in that report are now resolved or superseded: its finding #1 (stale 15/2 caps in CLAUDE.md) is fixed (docs now say 10/1, matching `tiers.js`), and its finding #3 (`AI_MODEL` on a `:free` model) is **still true** and still worth fixing before launch.

---

## Consolidated defect list (P0 → P2)

### P0 — launch blockers

**P0-1 · Full authentication bypass via `POST /api/auth/verify-email`** — `server/routes/auth.js:258-261`
`if (user.email_verified) { return res.json({ token: signToken(user.id), … }) }` executes **before `verifyOtp` is ever called**. Supplying any 6-digit string with a known email returns a valid 7-day JWT.
*Reproduced by the orchestrator:* `{"email":"qa_userb@example.com","otp":"000000"}` → 200 + JWT → `GET /api/auth/me` → 200 with full profile.
*Blast radius:* **12 of 15 accounts are verified, including all 3 admins** → admin takeover ⇒ full admin-panel access. Amplified by **P0-2**.
*Fix:* only take the "already verified" shortcut **after** `verifyOtp` succeeds; never mint a token on an unvalidated OTP.

**P0-2 · `/verify-email` and `/resend-otp` carry no `authLimiter`** — `server/routes/auth.js:251, 272`
Only the global 100/min/IP applies (empirically: 14 rapid calls, zero 429), making P0-1 exploitable at ~100 takeovers/minute/IP against a scraped email list.
*Fix:* add `authLimiter` to both routes.

### P1 — fix before launch

| ID | Defect | Location |
|---|---|---|
| P1-1 | `reset-password` never sets `email_verified=1` yet returns a working JWT — an unverified user gets full app access via forgot-password, contradicting the documented "login is blocked for unverified accounts" invariant | `auth.js:344-348` |
| P1-2 | `reset-password` email-enumeration oracle (404 unknown vs 400 known), defeating the deliberate anti-enumeration hardening on `/register` | `auth.js:339` |
| P1-3 | `retry-evaluation` never passes `q` to `runEvaluation()` → every retry throws internally and returns `aiError`; the AI-retry feature is entirely non-functional | `evaluate.js:249-254` |
| P1-4 | `batch-evaluate` tier-aware routing missing in committed code (see Reconciliation) — paid users' timed-session grading falls back to the rate-limited free model | `sessions.js` |
| P1-5 | Coach daily cap blocks a user from **resuming their own in-progress session**; `requireEntitlement("coach")` runs before the resume lookup | `coach.js:87` vs `96-99` |
| P1-6 | All 5 passages have empty `reading_key_json` (`{}`) — the reading-map grader, the product's stated differentiator, scores against a blank canonical key | `passages` table |
| P1-7 | Deleted user's JWT remains cryptographically valid until natural 7-day expiry — `authenticate()` never rechecks user existence, so read-side endpoints on the deleted user's `req.userId` return 200 (with empty data). Practical impact is limited; ranked P0 by the pre-set NO-GO criteria but treated as P1 for prioritisation | `server/auth.js:17-29` |

### P2 — cleanup / documentation

| ID | Defect |
|---|---|
| P2-1 | `resend-otp` leaks account existence via response-body shape |
| P2-2 | `batch-evaluate` has no cap accounting in committed code (up to 25 model calls per invocation unmetered) |
| P2-3 | No `annual` billing period exists (only `monthly` + `cat`); CLAUDE.md's "annual = 10× monthly" is stale and `period=annual` silently bills monthly |
| P2-4 | `save-to-bank` documented in CLAUDE.md's Post-Phase-16 section but the route does not exist |
| P2-5 | `RAZORPAY_WEBHOOK_SECRET` unset — webhook fails closed (safe) but the backstop path is unconfigured/untestable |
| P2-6 | `sessions.js:379` still hardcodes `model: DEFAULT_MODEL` in an error-log path |
| P2-7 | `AI_MODEL` points at a `:free` OpenRouter model (carried over from the 2026-07-18 run) — confirm production is not on a `:free` model |
| P2-8 | Focus doesn't return to trigger after closing any TopNav-dropdown-launched modal (Change Password / Export / Reset / Delete). Trigger unmounts synchronously with the modal-open state change, so `Modal.jsx`'s saved `activeElement` is a detached node by unmount | `Modal.jsx:26-27, 67-70` vs `TopNav.jsx:284` |

---

## Launch Readiness Scorecard

| Area | #P0 | #P1 | Go / No-Go |
|---|---|---|---|
| 0 · Seed & smoke | 0 | 0 | ✅ Go |
| 1 · Auth | **2** | 2 | 🔴 **No-Go** |
| 2 · Drills | 0 | 2 | 🟡 Go with conditions |
| 3 · Coach | 0 | 1 | 🟡 Go with conditions |
| 4 · Ownership / IDOR | 0 | 0 | ✅ Go |
| 5 · Billing | 0 | 0 | ✅ Go |
| 6 · Admin | 0 | 0 | ✅ Go |
| 7 · Edge & errors | 0 | 1 | 🟡 Go with conditions |
| 8 · Cross-cutting | 1* | 0 | 🟡 Go with conditions (see caveat) |
| **Overall** | **2 (+1\*)** | **7** | 🔴 **NO-GO** |

*Area 8's D5 finding is P0 by the literal NO-GO criteria but practical severity ≈ P1; see the P0 caveat under Area 8 above.*

**Gate evaluation against the defined NO-GO criteria:**

| Criterion | Result |
|---|---|
| IDOR / ownership failure on any `:id` route | ✅ None — 20/20 clean, psql-verified |
| Billing / tier bypass | ✅ None — forged signatures rejected, caps enforced at exact boundaries |
| Leak of `correctIndex`/`trapIndex`/`sourceLines`/`reading_key_json` pre-reveal | ✅ None — clean across Drills, Coach, and IDOR probes |
| Admin-auth bypass | ✅ None — 21/21 non-admin attempts rejected with zero mutation |
| *(Unlisted, more severe)* **Full authentication bypass** | 🔴 **FOUND — P0-1** |

All four named gates passed. The verdict is **NO-GO** solely because of P0-1/P0-2, a complete account-takeover vector that is categorically more severe than any listed criterion.

**Path to Go:** fix P0-1 and P0-2 and re-verify (minutes of work); clear the six P1s; complete Area 8. Rotate `JWT_SECRET` after the fix if this code has ever been deployed, to invalidate any tokens minted through the bypass.

---

## Test-data left behind

`qa_*` users (ids 13–21) remain except `qa_a1_*` (cleaned), `qa_reset` (id 20, deleted before Area 8 rerun), and `qa_reset2` (id 30, deleted as an intended outcome of the erasure test). `qa_billing` was left at `tier=free`. Anonymised leftovers (correct — evidence of the cascade working): one `api_calls` and one `question_flags` row with NULL user references, and one deactivated user-authored question with NULL `author_user_id`. Also on disk: one `payments` row each for users 13 and 18, one `question_flags` row from Area 2, plus genuine `api_calls`/session/attempt rows from testing. Area 7's synthetic `api_calls` seed rows were removed.

---

## Plain-English failure explainer

For a friendlier walkthrough of every FAIL — what actually happened, why it matters, how to fix it, and how hard the fix is — see [`FAILURE_REPORT.md`](FAILURE_REPORT.md).
