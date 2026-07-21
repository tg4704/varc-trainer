# Graspr — Plain-English Failure Report

**Companion to:** [`PRELAUNCH_TEST_RESULTS.md`](PRELAUNCH_TEST_RESULTS.md)
**Audience:** you, the operator, planning what to fix and in what order — not a security-researcher audience.

This walks through every FAIL from the pre-launch QA. For each one:
- **What happened** — a sentence a non-engineer could read.
- **Why it matters** — the actual real-world consequence.
- **How to fix** — the shape of the change (with the exact file and lines).
- **Complexity** — a rough size, in "cups of coffee":
  - ☕ = 5–15 minutes, a one-liner or a small local change.
  - ☕☕ = an hour or two, touches a few files or needs re-testing.
  - ☕☕☕ = half a day+, a design decision or a bigger change.

Findings are grouped **P0 → P2**, and within each group, ordered by *how quickly they should be fixed*, not alphabetically.

---

## ✅ Fix status as of 2026-07-20

**Fixed and re-verified** (both P0s, three P1s, three P2s):

| ID | What was fixed | Proof it works now |
|---|---|---|
| P0-1 | verify-email checks the OTP before issuing a token | exploit now returns 400, no token |
| P0-2 | authLimiter added to verify-email + resend-otp | burst → 429s appear |
| P1-1 | reset-password sets `email_verified = 1` | login after reset now 200 |
| P1-2 | reset-password no longer 404s on unknown emails | generic 400 |
| P1-3 | retry-evaluation passes `q` | real verdict, score persisted, no dup row |
| P2-1 | resend-otp response shape identical | both `{"ok":true}` |
| P2-6 | residual `DEFAULT_MODEL` in error log + dead import | zero left in `sessions.js` |
| P2-3 / P2-4 | CLAUDE.md annual-period + save-to-bank corrections | cross-checked against code |
| **P1-5** | Coach cap no longer blocks resuming your own session (`meterNewCoachPassage` checks for an existing session before metering) | new→200, resume→**200** (was 402), resume again→200, *different* passage→**402** (cap still enforced), exactly 1 session row created |
| **P1-7** | `authenticate()` now rejects tokens whose user no longer exists | after deleting the user, `/auth/me`, `/dashboard`, `/sessions/active`, `/coach/history` all →**401** (three were 200) |
| **P2-8** | `Modal` gained a `returnFocusTo` prop (ref \| element \| getter) with `isConnected` guards; the 4 TopNav modals pass the avatar button | live browser: Esc → focus lands on the **"Account menu" button**, not `<body>` — verified for both `ChangePasswordModal` and `DeleteAccountModal` (separate files), no console errors |
| **P1-6** *(drafted — awaiting your review)* | Authored canonical reading keys for all 5 passages in `content-pipeline/seed_reading_keys.js` and applied them locally (each key went from 2 bytes → ~1.8KB) | Submitted a deliberately shallow topic-listing map: grader returned `reading_mode: "information-gathering"`, `thesis: "weak"`, `caught_the_turn: false`, and cited the exact **¶3→¶4 pivot** from the key. Previously it graded against `Thesis: undefined`. |
| **P1-6b** *(new — prevents recurrence at scale)* | Import gate in `admin.js` now validates reading-key **content** and passage **shape**, not just presence. The old check was `typeof reading_key !== "object"` — which `{}` passes, so the exact broken state could be re-imported silently. | `reading_key:{}` → **rejected**; single-paragraph body → **rejected**; `paragraph_functions` count ≠ paragraph count → **rejected**; valid payload → **accepted** with a soft word-count note |
| **P1-6c** | `GENERATION_KIT.md` updated so the prompt and the importer state the same contract: reading-key fields mandatory + non-empty, one `paragraph_functions` entry per paragraph, 3–5 paragraph body. Added an explicit "Import contract — what gets HARD-REJECTED" table and two new self-QA gates. | cross-checked line-by-line against the validator |
| **Import error labels** | Single-payload import errors no longer begin with a stray `": "`; batch errors still carry `[1/2]` prefixes (`labelled()` / `sublabel()` helpers) | single → `passage.body must be 3-5 paragraphs…`; batch → `[1/2]: passage.body must be…` |

**Still open — needs you:** **P1-4** (commit the sessions.js fix — you chose not to commit yet), **P1-6 review** (the keys encode teaching judgment — edit `seed_reading_keys.js` and re-run), **P2-5** (Razorpay webhook secret), **P2-7** (`AI_MODEL` env var), and a **new structural finding** on passage shape (below).

### New finding — passages 7–10 are single-paragraph blocks

Not in the original QA (it only surfaced while authoring the keys). Passages 7, 8, 9, 10 have **zero paragraph breaks** and run 176–191 words. Only passage 11 (303 words, 4 paragraphs) is shaped like a real CAT RC passage.

**Why it matters.** Coach's reading map asks for "one entry per paragraph." On a single-block passage the student gets exactly one crux box, so the grader's *structure* dimension — one of its four scored bands — has almost nothing to assess. The keys I wrote for 7–10 describe *logical movements* as a stopgap, but that's papering over the shape problem.

**Fix.** Re-author 7–10 at 400–600 words across 3–5 paragraphs (real CAT RC proportions), then rewrite their `paragraph_functions` to map 1:1 onto the new paragraphs. Content work, same category as P1-6.

**Complexity:** ☕☕☕ per passage — this is passage authoring, not editing.

**Update:** the generation pipeline was checked and is *not* the source of this. `GENERATION_KIT.md` already mandates 350–500 words across 3–5 paragraphs plus a full `reading_key`, and all 5 current passages are `source='user'` — hand-inserted, never run through the importer. The importer now enforces both rules, so regenerating 7–10 through the documented path fixes shape and key together.

---

## Feature added — "your map vs the model reading"

Requested during the fix pass: show the student their reading map alongside the canonical key, with the AI's assessment of how close they were.

**Built as a split reveal**, because the canonical key is the answer key for the reading step and overlaps with what the questions test. On passage 11, the key's `thesis` answers both the inference and title questions and its `tone` answers the tone question — **3 of 4**. Showing it mid-session would have made those types unscoreable.

- **During questions** (`CoachPractice` — grade modal + right-edge dock): the student's own map + the AI grade. Both were already disclosed to them before question 1, so this leaks nothing new.
- **After completion** (`CoachSummary`): full side-by-side, "What you wrote" vs "The model reading", ¶-aligned.
- **Server** (`readingKeyIfRevealed` in `coach.js`): `readingKey` is `null` unless `session.status === 'completed'`. Also guards against legacy `{}` keys so they render as absent rather than as an empty column.

Verified: mid-session response contains none of `failure of incentive design` / `paragraph_functions` / `key_turn` / `Diagnostic and sober`; all present after completion. Practice screen shows the map with zero key strings in the DOM. Client production build passes, no console errors.

New shared component: `client/src/components/ReadingMapCard.jsx` (renders map-only or comparison depending on whether `readingKey` is passed).

**Also on the summary: the full passage, collapsible.** Added below the map comparison — a header row (eyebrow, title, word count, rotating chevron) that expands to the complete passage in the same Source Serif 4 reading typography used in Practice, with paragraph breaks preserved (`whitespace-pre-wrap`). Collapsed by default so the stats and per-question review stay reachable without a long scroll. Proper `aria-expanded` / `aria-controls` wiring. Verified live: default collapsed, opens to all 303 words across 4 paragraphs, closes again.

---

## Fixed — upgrade prompt destroyed in-progress Coach sessions

Reported after the QA: a free/Inference user who clicks "See plans" from the 1-on-1 coaching paywall loses their Coach session.

**What the investigation found — three separate issues, not one:**

**1. Both "See plans" entry points navigated in-place.** The `UpgradePrompt` modal used `navigate("/pricing")`, and the locked Discuss panel used `<Link to="/pricing">`. Either abandons the session. The `<Link>` is the one free users actually hit, because the client pre-empts the 402: `canCoach` is fetched on mount, so the button renders as "🔒 1-on-1 AI coaching" and opens a locked panel — the server 402 (and thus `UpgradePrompt`) never even fires. Neither path went through `attemptNav`, so the leave-guard never warned them either.

**2. The upgrade copy was actively wrong for this case.** The guided-coaching 402 carries `reason: "feature_locked"`, but `UpgradePrompt` only special-cased `cost_ceiling`. So a *feature* block rendered as **"You've hit today's limit"** followed by *"Upgrade… for a higher daily limit, or come back tomorrow when it resets."* It never resets — it's a plan feature. That told a high-intent user to wait for something that would never happen, directly instead of converting.

**3. "It takes away 1 coach passage too" — was true, already fixed earlier today.** This was P1-5: `requireEntitlement("coach")` ran before the resume lookup, so a free user (1 passage/day) who left and came back was 402'd out of their own unfinished session. Re-verified after the fix: leaving and returning to the same passage → **HTTP 200**, `usage.coach` stays at **1**.

**The fix:**
- Both entry points now open `/pricing` in a **new tab** (`window.open(…, "noopener,noreferrer")` / `target="_blank"`), so the session stays live. Called straight from the click handler, so popup blockers permit it.
- `UpgradePrompt` distinguishes `feature_locked`: title becomes **"Not included in your plan"**, body becomes *"Upgrade to Consistent to unlock it."*, and the false "resets tomorrow" line is suppressed.
- **`CoachPractice` re-checks entitlement on tab focus** (`visibilitychange` + `focus`). This is what makes resuming actually work — `canCoach` was previously fetched once on mount, so a user could pay in the other tab, switch back, and still see the padlock until a reload.
- Both surfaces now say the reassurance explicitly ("you won't lose your place here").

**Verified end-to-end in the browser** with a real free-tier session: locked panel → `See plans` is `target="_blank" rel="noopener noreferrer"` → simulated payment in another tab → dispatched `focus`/`visibilitychange` → locked panel gone, Discuss chat live (textarea present), **still on `/coach/practice?sessionId=71`** with the answered question intact. `UpgradePrompt` re-rendered from a live `feature_locked` event shows the corrected title and copy. Client production build passes.

*(Two React errors appear in the console log buffer from the HMR window between two of my edits — the count stayed at exactly 2 across three reads with a stale module timestamp, and the component verifiably renders correctly afterward. Not present in the built output.)*

### Flagged for later — pre-question grade already paraphrases the thesis

The reading-map grade is shown *before* question 1 and, by design, explains what the student missed — e.g. *"you did not see that ¶4 makes a claim about the absence of reproducibility from the incentive structure."* That reveals the argument ahead of the main-idea/tone/title questions. It predates this work and is arguably the intended pedagogy (the reading map is the teaching moment; questions are secondary practice). Noted, not changed. If you later want the questions to stay clean, the lever is the `coach_reading_grade` prompt: instruct it to critique the reading *process* without restating the passage's actual thesis.

---

## 🔴 P0 — must fix before launch

### P0-1 · Anyone can log into any verified account using only its email

**File:** `server/routes/auth.js`, lines **258–261** (inside `POST /api/auth/verify-email`)

**What happened.** The "verify your email" endpoint has a shortcut: if the account is already verified, it just hands back a login token. That shortcut runs *before* checking whether the OTP the caller submitted is actually correct. So `{"email":"someone@example.com","otp":"000000"}` returns a **real, working 7-day login token for that account** — no password, no valid code, nothing.

**Reproduced live** by the orchestrator during this run: sent a garbage OTP for `qa_userb@example.com` → got a JWT back → used it to call `/api/auth/me` → got user B's full profile.

**Why it matters.** This is a full account-takeover bug. With just a list of Graspr user emails (which are trivially guessable / scrapeable, and confirmed by P0-2 to be probeable at scale), an attacker owns those accounts — reads their reasoning history, changes profile data, deletes their account, buys things on their card if payment methods were stored, and so on. **Three of the accounts on the current database are admins**, so the same trick gives full admin-panel access (question bank editing, prompt overrides, user tier grants, cost dashboards).

**How to fix.** Delete the "already verified" shortcut, or move it below the OTP check. The cleanest patch is: always call `verifyOtp(...)` first, then handle both branches (unverified → mark verified + log in; already verified → also log in). Roughly a 4-line rearrangement in one function.

**Complexity:** ☕ — trivial code change. But before shipping: also rotate `JWT_SECRET` on any environment this code has ever been deployed to, so any tokens minted through the bypass stop working immediately. Existing users will need to log in again once, and that's the right trade.

---

### P0-2 · The bypass above is not rate-limited

**File:** `server/routes/auth.js`, line **251** (`verify-email` route) — and also line **272** (`resend-otp`)

**What happened.** Every other login-adjacent route (register, login, forgot-password, reset-password) is protected by `authLimiter`, which caps requests at 10/minute/IP. `verify-email` and `resend-otp` are missing that protection. The only limiter that applies is the loose 100/minute/IP global one.

**Verified empirically** by firing 14 rapid `verify-email` calls in under a minute — zero 429 responses.

**Why it matters.** On its own, this is not exploitable — but combined with **P0-1**, it means the account-takeover trick can be run at **~100 accounts per minute per attacking IP**. Attackers routinely rotate IPs, so the effective ceiling is much higher. Fixing P0-1 without also fixing this leaves an unnecessary amplification vector for the next similar bug (e.g. an OTP-brute-force attempt on an unverified account).

**How to fix.** Add `authLimiter` to both routes, matching how register/login already look. Literally add one word each on lines 251 and 272.

**Complexity:** ☕ — 30 seconds.

---

## 🟠 P1 — fix before launch (but not blockers on their own)

### P1-1 · Reset password lets someone skip email verification entirely

**File:** `server/routes/auth.js`, lines **344–348** (inside `POST /api/auth/reset-password`)

**What happened.** When someone completes the "forgot password" flow, the server updates their password hash and hands back a login token. But it never sets `email_verified = 1`. That means an unverified account can gain a working 7-day session simply by going through the reset-password flow — despite the login route explicitly blocking unverified users.

**Why it matters.** Your CLAUDE.md documents an invariant: "login is blocked for unverified accounts, so anyone who can see [the app] is already verified." The onboarding checklist quietly relies on this — it has no "verify email" step because the assumption is that anyone signed in must already be verified. That assumption is currently false.

The security impact is small (the reset-password OTP is still a real proof-of-mailbox-ownership), but the invariant breakage may hide bugs elsewhere in the app that assume verified users.

**How to fix.** Add `UPDATE users SET email_verified = 1 WHERE id = $1` alongside the existing password_hash update. A successful reset-password OTP round-trip is equally strong proof of mailbox control, so it's safe to auto-verify.

**Complexity:** ☕ — one extra `db.run(...)` next to the existing one.

---

### P1-2 · Attackers can tell whether an email is registered via reset-password

**File:** `server/routes/auth.js`, line **339**

**What happened.** `POST /api/auth/reset-password` returns **404 "No account found with that email"** for unknown emails, but **400 "Incorrect code"** for known ones. `register` and `forgot-password` were deliberately hardened to return identical generic responses for both cases (exactly to prevent this). `reset-password` was missed.

**Why it matters.** This defeats the anti-enumeration hardening on the other routes. An attacker with a scraped email list can figure out which addresses are Graspr users by watching for 404 vs 400 — the exact thing register/forgot-password were engineered *not* to allow. Once someone has that filtered list, they use it for phishing, credential-stuffing from other breaches, or as input to P0-1 above.

**How to fix.** On line 339, replace the 404 response with the same generic response the successful path returns (or a plain 400 that matches what the "wrong OTP on a real account" branch returns). The whole route should look indistinguishable from the outside regardless of whether the email exists.

**Complexity:** ☕ — a one-line change, plus one careful mental check that no legitimate flow relies on the distinction.

---

### P1-3 · The "retry AI feedback" button is broken — every retry fails

**File:** `server/routes/evaluate.js`, lines **249–254** (inside `POST /:attemptId/retry-evaluation`)

**What happened.** When an AI feedback call fails, users can click "Retry" to try again. That endpoint's code loads the question from the database, but forgets to pass the question object into the function that actually runs the AI call. So the AI function receives `undefined`, crashes internally on `buildUserMessage(undefined, ...)`, gets caught by the retry-logic, and returns `aiError: true`. Every single retry fails, regardless of whether the AI would actually work.

**Reproduced live** and confirmed against source: `runEvaluation()` requires a `q` parameter (evaluate.js:148), but the retry route's call site (line 249) doesn't include it in the object it passes.

**Why it matters.** The retry button is one of your visible reliability features — a user sees "AI feedback failed, click here" and expects that clicking works some of the time. It never works. If a user's first attempt hits a transient OpenRouter blip and they retry, the retry looks like a second failure — the app looks worse than it actually is.

**How to fix.** Add `q,` to the object literal passed to `runEvaluation()`. One character. The `q` variable is already loaded a few lines earlier at line 235.

**Complexity:** ☕ — literally add one word.

---

### P1-4 · Paid users' timed sessions get graded by the free model instead of Haiku

**File:** `server/routes/sessions.js` (`batch-evaluate` handler around line 397)

**What happened.** When a timed session ends and all its pending reasonings get graded in one batch, that handler was calling the AI with a hardcoded `DEFAULT_MODEL` (the current environment's `AI_MODEL`, which is a rate-limited `:free` model) instead of routing to the paid user's proper tier model (Haiku for Topper). It also skipped the entitlement/cap check that every other AI route has.

**A fix already exists uncommitted** in your working tree — `git status` shows `sessions.js` modified with the correct `resolveModels(req.userTier, "drills")` and `requireEntitlement("drills")` added. But **`git log` shows it hasn't been committed**, so it's a live wire: any `git checkout` / `git reset --hard` / branch switch loses it. The fix also looks incomplete: line 379 still logs `model: DEFAULT_MODEL` on one error path.

**Why it matters.** Paid users bought Haiku-quality feedback. Every timed session they run currently gives them the free model instead — worse feedback, plus a much higher chance the whole batch degrades because the free model rate-limits. That's a silent broken-promise for paying users, exactly on the path where they can't easily see it happening.

**How to fix.** Three steps: (1) `git add server/routes/sessions.js && git commit -m "..."`; (2) fix the residual `model: DEFAULT_MODEL` at line 379 to also use `resolveModels(...)`; (3) verify the running server is serving the fixed code (restart nodemon), then re-test one timed session with a Topper user.

**Complexity:** ☕☕ — the code fix is already done, but committing + finishing the last stray hardcode + verifying the deployed build actually runs it needs a few minutes of care.

---

### P1-5 · Free-tier coach users get locked out of their own unfinished session all day

**File:** `server/routes/coach.js`, line **87** (the `POST /sessions` route)

**What happened.** Free tier is 1 Coach passage per day. The daily-cap check runs *before* the code looks at whether the user is starting a **new** session or **resuming an existing** one. So: a free user starts passage A, gets halfway through, comes back later, tries to reopen it → 402 "you've used your 1 passage today" — even though they're not starting a new one, they're just trying to finish the one they already spent their quota on.

**Verified live:** user hit the cap on passage A, then re-POSTed with A's own `passageId` (which normally just resumes) — got 402 instead of the existing session.

**Why it matters.** This is worse than a normal cap-hit because it looks like a bug from the user's perspective. They already paid the cap-cost by starting the session — the app is now refusing to let them finish. Bad first impression for the exact user segment (free tier) you're trying to convert to paid.

**How to fix.** Two clean options: (a) move the resume-lookup above the entitlement middleware in the route, so a resume never hits the cap; or (b) modify `requireEntitlement("coach")` to accept a "skip if this is a resume" hint. Option (a) is smaller and requires restructuring one route.

**Complexity:** ☕☕ — needs a small route restructure (move the SELECT for the existing session above the middleware, or restructure into a resume-first then create-new flow), plus one test to confirm both new-session and resume paths still enforce and skip the cap correctly.

---

### P1-6 · The reading-map grader — the app's stated differentiator — grades against a blank key

**File:** `passages` table (data, not code)

**What happened.** Every Coach passage has a `reading_key_json` field that stores the *canonical* answer key (thesis, tone, paragraph functions, key turn) — this is what the AI grader compares a student's reading map against. **All 5 seeded passages have `reading_key_json = '{}'`** (an empty object). Independently verified in psql — every row is 2 bytes.

The grader code (`coach.js:161-168`) destructures this into the AI prompt as `Thesis: undefined / Tone: undefined / Paragraph functions: (empty) / Key turn: undefined`. The grade the student receives is genuine AI commentary, but it's free-floating commentary — not comparison against a canonical key, because there is no canonical key.

**Why it matters.** Your product framing (and the CLAUDE.md write-up) leans heavily on this being a *graded* comparison. That's the thing that makes Coach different from just "an AI reading a passage with you." Without real keys, Coach still works — but the differentiator claim is currently false. Reviewers, competitors, or a curious user reading the AI's own outputs (which sometimes literally say things like "the canonical key shows: undefined") will notice.

**How to fix.** Author the reading keys for all 5 seeded passages using the schema `content-pipeline/READING_GRADER.md` documents (`{thesis, tone, paragraph_functions:[], key_turn}`). This is a content authoring task, not a code fix. Then either: (a) `psql UPDATE passages SET reading_key_json = $1 WHERE id = $2` per passage, or (b) re-run the content-pipeline import with the completed keys.

**Complexity:** ☕☕☕ — the code path is fine; the missing input is the actual content. 5 passages × ~15 minutes each of thoughtful key-authoring = a solid afternoon if you write them yourself. Longer if you route through the content pipeline.

---

### P1-7 · A deleted user's login token stays valid until it naturally expires

**File:** `server/auth.js`, lines **17–29** (the `authenticate` middleware)

**What happened.** When a user deletes their account, all their data is correctly hard-deleted from the database (this was verified end-to-end and passed). But the login token they were holding at the moment of deletion continues to work for up to 7 days after — because the middleware that validates tokens only checks the signature and expiry, it never checks that the user row still exists.

**Practical effect:** `GET /api/auth/me` happens to 404 (that route does its own re-query), but `GET /api/dashboard` and `GET /api/sessions/active` return 200 with empty data. Writes fail cleanly (500 via foreign-key constraint) — no risk of corrupted data or of one user's token reaching another user's data. But the strict interpretation of your NO-GO criterion "deleted user's token still works" is met.

**Why it matters.** For account deletion specifically, this is mostly cosmetic — the account and its data are genuinely gone, no one else can see any of it, and the token expires in 7 days anyway. But it points at a more general question: what if you need to instantly revoke a token? (Compromised account, banned user, security incident.) Today, you can't — there's no revocation list. Stateless JWT auth without revocation is a fine trade-off for a small app; you just want to make it *deliberately*, not by omission.

**How to fix.** Two options:
- **Small (☕):** in `authenticate()`, after decoding the token, add a `SELECT 1 FROM users WHERE id = $1` and 401 if empty. Adds one round-trip per authenticated request — measurable but small. Combined with the existing dashboard cache this is fine.
- **Larger (☕☕☕):** move to a proper revocation model — a `revoked_tokens` table keyed by the token's `jti` (JWT ID) claim, checked on every request, populated on delete/logout-everywhere/security-incident. This is what you'll want long-term once payments are live; it's also what the CLAUDE.md comment on `signToken` foreshadows ("revisit toward a short-lived-token + refresh-token model").

**Complexity:** ☕ for the small fix; ☕☕☕ for the proper one. Given payments are on the near-term roadmap, I'd do the small fix now and the proper one before real launch.

---

## 🟡 P2 — cleanup / documentation / polish

### P2-1 · `resend-otp` leaks account existence via response-body shape

**File:** `server/routes/auth.js`, line **280**

**What happened.** Both known and unknown emails return HTTP 200, but the response body differs: known → `{"ok":true}`; unknown → `{"ok":true,"message":"If an account exists, a code has been sent."}`. Sending a reassuring message only for unknown emails is the exact opposite of what makes the messaging generic.

**Fix.** Return the same shape either way (either always send the `message`, or never send it). One-line change.

**Complexity:** ☕.

---

### P2-2 · `batch-evaluate` has no cap accounting

**File:** `server/routes/sessions.js` (committed version)

Handled indirectly by fixing P1-4 (the uncommitted fix adds `requireEntitlement("drills")` on the batch-evaluate route).

**Complexity:** — (folded into P1-4).

---

### P2-3 · No "annual" billing period exists in code

**File:** `server/routes/billing.js`, `server/config/tiers.js`; also documentation

**What happened.** CLAUDE.md and the QA brief both describe an "annual = 12 months at 10× monthly (2 months free)" billing period. The code only knows about `monthly` and `cat` (Till-CAT season pricing). Passing `period=annual` to `/quote` or `/create-order` is silently treated as `monthly` — bug-prone if any UI ever tries it.

**Fix.** Pick one: either implement the annual period (bigger change) or delete the documentation for it. Given "Till-CAT" seems to have replaced the annual concept, deleting the doc is cleanest.

**Complexity:** ☕ (just edit CLAUDE.md).

---

### P2-4 · `save-to-bank` route is documented but doesn't exist

**File:** `client/src/pages/CoachSummary.jsx` references it in CLAUDE.md, but `server/routes/coach.js` has no such handler.

**What happened.** CLAUDE.md's "Post-Phase-16 additional features" section describes a `POST /api/coach/sessions/:id/save-to-bank` endpoint. It doesn't exist in the current code. Earlier in the same doc, the phase-14 section explicitly notes the endpoint was removed in the restructure. The doc contradicts itself.

**Fix.** Delete or update the stale section in CLAUDE.md.

**Complexity:** ☕.

---

### P2-5 · `RAZORPAY_WEBHOOK_SECRET` is unset

**File:** `.env`

**What happened.** The webhook endpoint currently returns 503 for every incoming event (fails-closed — a safe default). This means the Razorpay `subscription.charged` webhook — the documented "source of truth" for recurring subscription renewal — cannot currently deliver an event even in a test environment.

**Fix.** Set the secret in `.env` (and in Railway's env config for prod) to match what's configured in the Razorpay dashboard. Then test one webhook round-trip end-to-end.

**Complexity:** ☕ (a config change), plus a webhook end-to-end test.

---

### P2-6 · Residual `model: DEFAULT_MODEL` in an error-log path

**File:** `server/routes/sessions.js`, line 379

Handled as part of P1-4 (finish the tier-routing fix).

**Complexity:** — (folded into P1-4).

---

### P2-7 · `AI_MODEL` in `.env` points at a `:free` OpenRouter model

**File:** `.env`

**What happened.** `AI_MODEL="openai/gpt-oss-120b:free"` — the `:free` suffix is a shared, rate-limited pool that 429s regularly. In this dev environment, that means free-tier users' AI calls fail more often than they succeed. Also carried over from the 2026-07-18 QA run's findings — it was noted then and still not changed.

**Fix.** Point `AI_MODEL` at the non-`:free` variant (or better: leave `AI_MODEL` unset so `SAFE_MODEL` in `tiers.js` — Haiku — is the default), and confirm production is set the same way. Free-tier users' *actual* model is `openai/gpt-oss-120b` per `tiers.js`, not the `:free` one — so the `.env` override is silently downgrading them.

**Complexity:** ☕.

---

### P2-8 · Focus doesn't return to trigger after closing certain modals

**Files:** `client/src/components/Modal.jsx` lines 26–27 and 67–70; `client/src/components/TopNav.jsx` line 284 (also 288, 292, 296 — all four dropdown modals share the pattern)

**What happened.** Modal.jsx captures `document.activeElement` when the modal mounts, then re-focuses it on unmount. That's the right pattern — *except* the four TopNav-dropdown modals (Change Password, Export, Reset, Delete) are triggered by a click that does two things at once: closes the dropdown AND opens the modal. React unmounts the dropdown item synchronously, so by the time the modal's `useEffect` runs a millisecond later, `document.activeElement` is a detached (out-of-tree) DOM node. Restoring focus to a detached node silently no-ops, and focus falls back to `<body>`. Keyboard users' next Tab starts from the top of the page instead of the account menu.

**Verified live** in the browser and against source — Modal.jsx does exactly what it should; the interaction is with how these particular triggers unmount.

**Why it matters.** A keyboard-only user closes the "Change Password" modal → their next Tab starts from the top of the app rather than the avatar menu. Annoying, not blocking. Same pattern hits the DPDP flows (Export/Delete) — the very ones DPDP recommends keeping accessible.

**How to fix.** Either:
- Keep the dropdown open while the modal is open (remove `setUserOpen(false)` from the trigger's onClick, then close the dropdown when the modal closes) — this preserves the trigger so `Modal.jsx`'s existing restore code works. Cleanest.
- Or: pass a `returnFocusTo` ref/id to the modal explicitly (e.g. the avatar button), so Modal can restore focus to a *stable* element regardless of trigger lifecycle.

**Complexity:** ☕☕ — small change, but repeated across 4 modals + wants a keyboard-navigation regression test to confirm the fix works and doesn't cause a different weird interaction (e.g. dropdown flashing).

---

## Suggested fix order

If you want a suggested sequence that gets you to Launch-Ready fastest with the lowest re-test cost:

1. **P0-1** + **P0-2** first, together, then rotate JWT_SECRET on every deployed environment. (☕ + ☕ + 5 min ops. Immediately un-blocks NO-GO.)
2. **P1-3** and **P2-1** while you're already in `auth.js` and `evaluate.js`. (☕ each.)
3. **P1-1** and **P1-2** — both in `auth.js`, close proximity to the P0 fix. (☕ each.)
4. **P1-4** — commit the sessions.js fix, patch the residual, restart, re-test. (☕☕.)
5. **P1-5** — coach cap resume path. (☕☕.)
6. **P1-7** — decide small-fix now vs proper revocation later. (☕ or ☕☕☕.)
7. **P2** cleanup pass: P2-3, P2-4, P2-5, P2-7 all in one sitting. (☕ × 4.)
8. **P1-6** — reading-key authoring for 5 passages. Content work, can happen in parallel with any of the above. (☕☕☕.)
9. **P2-8** — modal focus restoration polish. (☕☕.)

Total code work: about half a day if you knock it out sequentially. The reading-key authoring (P1-6) is the one item that meaningfully depends on the operator's judgment and can't be delegated to a mechanical fix.
