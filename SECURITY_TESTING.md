# Security, Legal, SEO, Monitoring, Performance & Reliability — Manual Test Plan

Covers five passes from 2026-07 (see `CLAUDE.md` for what was built and why
in each):
- **Part A — Security Hardening** (tests 1–14): rate limiting, auth, headers, CORS.
- **Part B — Legal & Compliance + SEO** (tests 15–21): privacy/consent, DPDP rights, sitemap/meta.
- **Part C — Monitoring & Observability** (tests 22–26): error tracking, health check, analytics events.
- **Part D — Performance & Infrastructure** (tests 27–30): compression, DB indexes, optimistic UI.
- **Part E — Testing, Reliability & Release Engineering** (tests 31–39): token-expiry, AI-audit fixes, CI.

Each test is copy-pasteable — run it, compare to "Expected," check the box.

## Setup

```bash
# Point this at whatever you're testing — local dev or a deployed URL.
BASE=http://localhost:3001
FRONTEND=http://localhost:5173
```

**Two things to know before you start:**

1. **Rate limiting and account lockout use in-memory storage.** If a test
   below leaves you rate-limited or locked out, either wait it out (rate
   limit resets after 60s, lockout after 15min) or restart the server to
   clear the in-memory counters instantly (`Ctrl+C` the `npm run dev`
   process and start it again).
2. **You need a real test account.** Use one you don't mind logging out of —
   the JWT-expiry test invalidates nothing destructively, but the lockout
   tests will genuinely lock the account you test with for 15 minutes.

```bash
# Fill these in with a real test account before running the tests below.
TEST_USER="tester"
TEST_PASS="testpass123"
```

---

## 1. Security headers (helmet)

**What this proves:** the server sends standard browser-security headers —
without them, the site is more vulnerable to clickjacking (an attacker
embedding your site in an invisible iframe to trick clicks) and MIME-sniffing
attacks.

```bash
curl -s -D - -o /dev/null $BASE/api/auth/me | grep -iE "x-frame-options|x-content-type-options|strict-transport-security"
```

**Expected:** three lines back —
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=...
```
☐ Pass — all three headers present

---

## 2. CORS allowlist

**What this proves:** only your actual frontend can call the API from a
browser. Before this fix, *any* website could make authenticated-looking
requests to your API using a logged-in user's browser session.

```bash
# 2a. Your real frontend origin — should be ALLOWED
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" $BASE/api/auth/me | grep -i "access-control-allow-origin"

# 2b. A random origin — should be BLOCKED (no header back)
curl -s -D - -o /dev/null -H "Origin: https://evil-site.example.com" $BASE/api/auth/me | grep -i "access-control-allow-origin"
```

**Expected:**
- 2a prints `Access-Control-Allow-Origin: http://localhost:5173`
- 2b prints **nothing** (empty output = correctly blocked)

☐ Pass — real origin allowed, fake origin gets no CORS header

---

## 3. Request body size cap

**What this proves:** the server rejects absurdly large request bodies
before they can become an expensive AI prompt or crash the process.

```bash
python3 -c "print('{\"identifier\":\"' + 'a'*200000 + '\",\"password\":\"x\"}')" > /tmp/big_body.json
curl -s -o /dev/null -w "HTTP status: %{http_code}\n" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" --data-binary @/tmp/big_body.json
```

**Expected:** `HTTP status: 413`

☐ Pass — oversized body rejected with 413, not 500 and not silently accepted

---

## 4. Rate limiting

**What this proves:** a script can't hammer the login endpoint (or any
endpoint) indefinitely. The auth-route limit is 10 requests/minute per IP.

```bash
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login \
    -H "Content-Type: application/json" -d '{"identifier":"nobody","password":"x"}')
  echo -n "$code "
done
echo
```

**Expected:** the first ~10 requests return `401` (wrong credentials — normal),
then the rest flip to `429` (rate limited). Something like:
```
401 401 401 401 401 401 401 401 401 401 429 429 429 429 429
```

☐ Pass — requests switch from 401 to 429 partway through

**Cleanup:** wait 60 seconds, or restart the server, before running other
tests against `$BASE` — you're currently rate-limited from this IP.

---

## 5. Account lockout

**What this proves:** even if rate limiting is somehow bypassed (e.g. an
attacker spreads requests across many IPs), one specific account still locks
after 5 wrong passwords within 15 minutes — protecting against a targeted
password-guessing attack on a single user.

⚠️ **This will lock your `$TEST_USER` account for 15 minutes.** Use a
throwaway test account, or restart the server afterward to clear it instantly.

```bash
# 5a. Five wrong passwords
for i in 1 2 3 4 5; do
  curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
    -d "{\"identifier\":\"$TEST_USER\",\"password\":\"wrongpassword\"}"
  echo
done

# 5b. Now try the CORRECT password — should STILL fail while locked
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}"
```

**Expected:** every single response in both 5a and 5b is the identical
`{"error":"Invalid credentials"}` — including 5b, even though that password
is actually correct. (The message being identical either way is deliberate —
it never reveals that the account is specifically locked vs. just another
wrong guess.)

☐ Pass — correct password also rejected after 5 fails (proves lockout, not
just repeated wrong-password checks)

**Cleanup:** restart the server to unlock the account immediately, or wait 15
minutes.

---

## 6. Registration — no email enumeration

**What this proves:** you can no longer find out whether a specific email
address has a Graspr account by trying to register with it. Before this fix,
the response literally said "That email is already registered."

```bash
# 6a. Register with an email that's DEFINITELY already taken
curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"probeuser123","email":"tester@local.dev","password":"whatever1"}'

# 6b. Register with a brand-new, definitely-unused email
curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"probeuser456","email":"definitely-new-'$(date +%s)'@example.com","password":"whatever1"}'
```

**Expected:** both 6a and 6b return the **same shape**:
`{"requiresVerification":true,"email":"..."}` — no way to tell from the
response alone which email was already registered.

☐ Pass — both responses look identical (success-shaped), no "already
registered" message anywhere

**Bonus check (if you have Resend configured, or are in dev mode where OTP
emails print to the server console):** look at the server logs after running
6a — you should see a "someone tried to sign up with your email" notice
logged/sent to `tester@local.dev`, confirming the real owner gets told
instead of the requester.

**Note:** usernames are *not* hardened the same way — try registering with
username `tester` (already taken) and you'll get an immediate, specific
`"That username is already taken"` error. That's intentional — usernames are
already meant to be publicly checkable (see test 12).

---

## 7. Password hashing strength (bcrypt cost 12)

**What this proves:** newly created passwords are hashed with a strong-enough
cost factor that a leaked database is expensive to crack.

This one isn't testable via `curl` — it requires a database check. If you
have `psql` access:

```sql
-- Register a fresh test user first (via the app or curl), then:
SELECT username, password_hash FROM users WHERE username = 'probeuser123';
```

**Expected:** the hash starts with `$2a$12$` or `$2b$12$` — the `12` is the
cost factor. (Existing users created before this change will show `$...$10$`
until they next change their password — that's expected, not a bug.)

☐ Pass — new signups show cost factor 12

---

## 8. JWT expiry (7 days, not 30)

**What this proves:** a stolen/leaked login token now only stays valid for a
week instead of a month.

```bash
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Decode the JWT payload (no signature verification, just reading the claims)
python3 -c "
import base64, json, sys
payload = '$TOKEN'.split('.')[1]
payload += '=' * (-len(payload) % 4)
data = json.loads(base64.urlsafe_b64decode(payload))
diff_days = (data['exp'] - data['iat']) / 86400
print('issued at:', data['iat'], '| expires at:', data['exp'], '| valid for', diff_days, 'days')
"
```

**Expected:** `valid for 7.0 days`

☐ Pass — token lifetime is exactly 7 days

---

## 9. Input validation (zod) — malformed requests rejected cleanly

**What this proves:** sending the wrong data type doesn't crash the server
with a raw 500 error — it's caught and rejected with a clear message.

```bash
# 9a. Password sent as a number instead of a string
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"identifier":"tester","password":12345}'

# 9b. Missing field entirely
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"identifier":"tester"}'

# 9c. A required auth-route field, but same idea on an AI route — huge reasoningText
curl -s -X POST $BASE/api/attempts/evaluate -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"sessionId\":1,\"questionId\":\"q1\",\"selectedOptionIndex\":0,\"reasoningText\":\"$(python3 -c 'print("x"*600)')\"}"
```

**Expected:**
- 9a: `{"error":"password: Expected string, received number"}`
- 9b: `{"error":"password: Required"}`
- 9c: a 400 with an error mentioning `reasoningText` and a length limit (500
  chars) — not a 500 crash

☐ Pass — all three return clean, specific 400 errors (no stack traces, no
500s)

---

## 10. Admin routes reject non-admin users

**What this proves:** hiding the "Admin" link in the UI isn't the actual
security boundary — the server independently checks the role on every
request.

```bash
# Using $TOKEN from test 8 (a normal, non-admin user)
curl -s -o /dev/null -w "no auth at all: %{http_code}\n" $BASE/api/admin/overview
curl -s -o /dev/null -w "non-admin token: %{http_code}\n" $BASE/api/admin/overview -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "non-admin token: %{http_code}\n" $BASE/api/admin/users -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "non-admin token: %{http_code}\n" $BASE/api/admin/api-calls -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```
no auth at all: 401
non-admin token: 403
non-admin token: 403
non-admin token: 403
```

☐ Pass — no token → 401, wrong role → 403, on every admin route tested

**If you have a real admin account:** repeat with an admin token and confirm
you get `200` instead — proving the block is role-based, not just "always
403."

---

## 11. AI rate limiting (per-user, separate from the auth limiter)

**What this proves:** the AI-calling routes (the expensive ones) have their
own limit — 20 requests/minute per logged-in user — independent of the
general auth rate limit.

```bash
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/attempts/evaluate \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"sessionId":999999,"questionId":"nonexistent","selectedOptionIndex":0}')
  echo -n "$code "
done
echo
```

**Expected:** the first ~20 requests return `404` (session not found — that's
fine, it means the request got through validation and rate limiting before
hitting the "not found" check), then the rest flip to `429`.

☐ Pass — switches to 429 after ~20 requests

**Cleanup:** wait 60 seconds before further testing with this token.

---

## 12. Username availability check still works (unaffected, by design)

**What this proves:** the registration-enumeration fix (test 6) deliberately
did *not* touch username checking, since it's meant to be public.

```bash
curl -s "$BASE/api/auth/username-available?u=tester"
curl -s "$BASE/api/auth/username-available?u=probe$(date +%s | tail -c 6)"
```

**Expected:** `{"available":false}` for the taken one, `{"available":true}`
for the made-up one — this one *is* supposed to tell you directly.

☐ Pass — behaves as an intentional public check, not a leak

---

## 13. No XSS / SQL injection surface (source-level, quick spot-check)

**What this proves:** the two most common web vulnerability classes have no
foothold in this codebase.

```bash
cd /path/to/varc-trainer
grep -rn "dangerouslySetInnerHTML" client/src/
grep -rnE "(SELECT|INSERT|UPDATE|DELETE).*\+.*(req\.|body\.|params\.)" server/*.js server/routes/*.js
```

**Expected:** both commands return **nothing** (no matches).

☐ Pass — no raw HTML injection points, no string-concatenated SQL

**Live SQLi sanity check** — try a classic injection payload as a login
identifier:
```bash
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"identifier":"tester'"'"' OR '"'"'1'"'"'='"'"'1","password":"x"}'
```
**Expected:** `{"error":"Invalid credentials"}` — treated as a literal
(nonexistent) username, not interpreted as SQL. If this ever logs you in or
throws a database error, that's a real problem.

☐ Pass — injection payload treated as plain text, login still fails normally

---

## 14. Dependency vulnerabilities

```bash
npm audit
```

**Expected:** should show 19 moderate vulnerabilities, all traced to
`@sentry/node`'s OpenTelemetry auto-instrumentation for database drivers this
app doesn't use (Prisma, MySQL) — not anything on Graspr's actual code path.
If this number changes, or a *high*/*critical* severity shows up, that's
worth investigating before ignoring.

☐ Pass — no new high/critical vulnerabilities beyond the known 19 moderate

---

# Part B — Legal & Compliance + SEO

## 15. Privacy Policy / Terms pages load and are linked correctly

```bash
curl -s -o /dev/null -w "privacy: %{http_code}\n" $FRONTEND/privacy
curl -s -o /dev/null -w "terms: %{http_code}\n" $FRONTEND/terms
```

**Expected:** both `200`.

Then in a browser: open `$FRONTEND/`, scroll to the footer, confirm "Privacy"
and "Terms" links under the "Legal" column actually navigate (not dead links)
to `/privacy` and `/terms` respectively, and that both pages name **Tarun
Gupta, an individual based in Bangalore, Karnataka** and list `privacy@graspr.in`
as the contact.

☐ Pass — both pages load, footer links work, contact info correct

---

## 16. Cookie consent banner + PostHog gating

In a browser (private/incognito window, so there's no prior consent decision):

1. Open `$FRONTEND/`. **Expected:** a bottom banner appears — "We use analytics
   cookies..." with Accept/Decline buttons.
2. Open DevTools → Application → Local Storage. **Expected:** no key
   `ph_<project-key>_posthog` exists yet (PostHog hasn't loaded).
3. Click **Decline**. **Expected:** banner disappears; `graspr_analytics_consent`
   in Local Storage is `"denied"`; still no `ph_..._posthog` key — PostHog never loads.
4. Reload the page, confirm the banner does **not** reappear (decision persisted).
5. Go to `/privacy`, click "Manage cookie preferences" near the bottom of the
   Cookies section. **Expected:** banner reappears.
6. Click **Accept**. **Expected:** `graspr_analytics_consent` becomes `"granted"`;
   within a couple seconds a `ph_<project-key>_posthog` key appears in Local
   Storage (confirms PostHog actually initialized).

☐ Pass — banner shows once, Decline blocks PostHog entirely, Accept enables it,
"Manage cookie preferences" reopens the banner

---

## 17. Registration requires the 18+/Terms checkbox

In a browser, open `$FRONTEND/register`, fill in valid username/email/password,
but **leave the checkbox unchecked**.

**Expected:** the "Create account" button is disabled (greyed out) — form
cannot be submitted without checking "I confirm I'm 18 or older and agree to
the Terms and Privacy Policy." Checking the box enables the button.

☐ Pass — signup blocked until the checkbox is checked

---

## 18. DPDP data export downloads real data, no password hash

```bash
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s $BASE/api/account/export -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('top-level keys:', list(d.keys()))
print('password_hash present:', 'password_hash' in d.get('profile', {}))
print('sessions:', len(d.get('sessions', [])), '| attempts:', len(d.get('attempts', [])))
"
```

**Expected:** keys include `profile`, `sessions`, `attempts`, `coachSessions`,
`coachAttempts`, `spacedRepetitionCards`; `password_hash present: False`;
session/attempt counts match what you'd expect for that account.

In the browser, confirm the equivalent UI path works too: log in, open the
avatar dropdown (top right), click **"Export my data"** — a `graspr-data-export.json`
file should download.

☐ Pass — export returns real data, no password hash, UI download works

---

## 19. SEO static assets served correctly

```bash
for f in favicon.ico favicon.svg apple-touch-icon.png og-image.png sitemap.xml robots.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND/$f)
  echo "$f -> $code"
done
```

**Expected:** all six return `200`.

```bash
curl -s $FRONTEND/robots.txt | grep -c "Disallow"
```

**Expected:** a non-zero count (auth-gated routes like `/dashboard`, `/admin`,
`/coach` are disallowed).

☐ Pass — all SEO assets served, robots.txt has real Disallow rules

---

## 20. Per-page title/description actually change per route

In a browser, open `$FRONTEND/` then navigate to `/pricing` via a nav link
(client-side navigation, not a full reload) and check the tab title.

**Expected:** the browser tab title changes from "Graspr — Stop Picking the
Trap" to "Pricing — Graspr". Open DevTools console and run:

```js
document.title
document.querySelector('meta[name="description"]').content
document.querySelectorAll('meta[name="description"]').length
```

**Expected:** title matches the current page, description is Pricing-specific
text (not the homepage's), and the count is exactly `1` (no duplicate meta tags
left behind from the previous page).

☐ Pass — title/description change per route via client-side nav, no duplicates

---

## 21. Age/Terms gate does not block Google OAuth (known gap)

This is a **known, accepted gap**, not something to fix here — just confirm
it's still the documented state: the 18+/Terms checkbox only exists on the
email/password `/register` form. The Google OAuth signup path
(`/choose-username`, reached via "Continue with Google") has no equivalent
gate. Low priority since email signup is the primary path — no action needed,
just don't be surprised by it.

☐ Acknowledged — not a bug, documented gap

---

# Part C — Monitoring & Observability

## 22. Health check does a real DB round-trip

```bash
curl -s -o /dev/null -w "status: %{http_code}\n" $BASE/api/health
curl -s $BASE/api/health
```

**Expected:** `status: 200`, body `{"ok":true}`.

**To actually prove it checks the DB** (not just a static 200), temporarily
point `DATABASE_URL` at something unreachable and restart the server, then:

```bash
curl -s -o /dev/null -w "status: %{http_code}\n" $BASE/api/health
```

**Expected:** `status: 503` with `{"ok":false,"error":"Database unavailable"}`.
Restore the real `DATABASE_URL` and restart afterward.

☐ Pass — healthy DB → 200, unreachable DB → 503 (not a false-positive 200)

---

## 23. Server errors don't leak internals to the client in production

This only differs from dev when `NODE_ENV=production`. If you're testing
against a deployed instance (which should already be `NODE_ENV=production`),
you'd need to actually trigger a genuine 500 — not easy to script safely
against production. The safer verification is a code read, not a live test:

```bash
grep -A3 "status < 500 && err.message" server/index.js
```

**Expected:** confirms the logic — 4xx errors still show their real message,
5xx errors show `err.message` only when `NODE_ENV !== "production"`. Full
detail always still goes to `console.error` + Sentry either way.

Known-good 4xx behavior (safe to test anywhere, doesn't touch the 5xx path):

```bash
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"tester"}'
```

**Expected:** `{"error":"password: Required"}` — a real, specific 4xx message,
unaffected by the production-generic-500 change.

☐ Pass — 4xx messages unaffected; 5xx logic confirmed correct by code read

---

## 24. Sentry captures a client-side render crash

Requires `VITE_SENTRY_DSN` to be set — this test is a no-op (nothing to see)
without it, by design.

In a browser with React DevTools available, or by temporarily editing a
component to `throw new Error("test crash")` during render, trigger a crash
and confirm:
1. The `ErrorBoundary` fallback UI ("Something went wrong") appears instead of
   a blank screen.
2. If you have access to the Sentry project dashboard, a new issue appears
   within a minute or two, with the error message and a component stack trace
   attached.

☐ Pass — ErrorBoundary shows fallback UI, and (if DSN configured) the error
appears in Sentry

---

## 25. Sentry captures server-side route errors

Requires `SENTRY_DSN` to be set. Trigger any route that throws an unexpected
error (e.g., temporarily break a query, or use an existing route with bad
input that reaches `next(err)` rather than a handled `res.status().json()`),
then check the Sentry dashboard for a new server-side issue.

☐ Pass — a server error triggered via `next(err)` shows up in Sentry (not just
truly-uncaught exceptions)

---

## 26. PostHog funnel events fire

Requires `VITE_POSTHOG_KEY` set and cookie consent accepted (test 16). This is
best verified against the real PostHog project dashboard, not locally — this
session's own attempt to observe the network calls directly was inconclusive
in a sandboxed test browser (its network monitor never surfaced any
cross-origin request, PostHog's initial config call included), so dashboard
verification is the reliable path.

In PostHog → **Activity → Live events** (or **Events** in the left sidebar),
perform each action below and confirm a matching event appears within
~30 seconds:

| Action | Expected event |
|---|---|
| Register a new account | `signup` |
| Start a Drills session (Session Setup → Begin) | `session_start` |
| Answer (not skip) a question in Practice | `question_answered` |
| Start or resume a Coach session | `coach_used` |

☐ Pass — all four events appear in PostHog's live events view

---

# Part D — Performance & Infrastructure

## 27. Response compression is actually on

```bash
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" -H "Authorization: Bearer $TOKEN" $BASE/api/dashboard | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: gzip`. (Tiny responses like `/api/health`
won't show this — `compression` has a size threshold below which it doesn't
bother; that's normal, not a bug.)

☐ Pass — a real payload comes back gzip-encoded

---

## 28. DB indexes on the hot columns exist

Requires `psql` access to the database being tested.

```bash
psql "$DATABASE_URL" -c "SELECT indexname, tablename FROM pg_indexes WHERE indexname LIKE 'idx_%' ORDER BY tablename;"
```

**Expected:** includes at minimum `idx_sessions_user_id`,
`idx_attempts_session_id`, `idx_coach_sessions_user_id`,
`idx_coach_attempts_coach_session_id`, alongside the earlier `idx_api_calls_*`
ones and `idx_users_google_id`. These are created automatically on server
startup (`server/db.js`'s migration block, `CREATE INDEX IF NOT EXISTS` —
safe, non-blocking, idempotent) — no manual step needed on a fresh deploy,
just confirm they landed.

☐ Pass — all four new indexes present

---

## 29. DB pool has an explicit, sane max

```bash
grep -A2 "new Pool" server/db.js
```

**Expected:** shows `max: 10` explicitly set (previously relied on `pg`'s
implicit default of 10 — same behavior, now a documented decision instead of
an accident).

☐ Pass — pool max is explicit

---

## 30. Optimistic Skip in Practice — instant advance + correct rollback on failure

In a browser, log in, start any Drills session, and on question 1 click
**"Not sure"**.

**Expected (happy path):** the app advances to question 2 immediately — no
visible "Skipping…" delay, no spinner blocking the UI. Question 1's slot in
the top-left stepper shows the skipped (amber) state.

To verify the skip actually persisted server-side (not just a client-side
illusion), check the DB directly:

```bash
# Replace SESSION_ID with the id from the active session
psql "$DATABASE_URL" -c "SELECT session_id, skipped, selected_option_index FROM attempts WHERE session_id = SESSION_ID ORDER BY id;"
```

**Expected:** a row with `skipped = 1` for the question you skipped, confirming
the optimistic UI matched real server state.

**Rollback path** (requires DevTools): before clicking "Not sure" on another
question, open the console and run:
```js
window.__origFetch = window.fetch;
window.fetch = (url, opts) => (typeof url === "string" && url.includes("/api/attempts/basic"))
  ? Promise.reject(new Error("simulated failure"))
  : window.__origFetch(url, opts);
```
Then click "Not sure". **Expected:** an error message appears, the question
you tried to skip is still the current one (not stranded on the next
question), and "Not sure" is clickable again to retry. Restore fetch
afterward: `window.fetch = window.__origFetch`.

☐ Pass — skip is instant on success, and correctly rolls back (no stuck
state) if the save actually fails

---

# Part E — Reliability fixes (CI/CD + token-expiry + AI flow audit)

## 31. Expired/invalid token mid-session redirects with a clear message and returns you to where you were

In a browser, log in and navigate to any protected page (e.g. `/dashboard`).
In DevTools console, corrupt the token to simulate an expired/invalid one:
```js
localStorage.setItem('varc_token', 'invalid.corrupted.token');
```
Reload the page. **Expected:**
- Redirected to `/login`.
- A teal banner reads "Your session timed out. Log back in to pick up right
  where you left off." — not a raw `"jwt expired"` error stuck on the old page.
- `localStorage.getItem('varc_token')` is now `null` (dead token cleared).

Log back in. **Expected:** you land back on `/dashboard` (or wherever you
were), not the homepage — the return path survived the round trip.

Verified live this session both ways, including the corrupted-token → banner
→ re-login → exact-original-path-restored flow.

☐ Pass — clear message, dead token cleared, return path preserved

---

## 32. Practice "Retry" button actually retries after a load failure

In a browser, log in and note you have at least one Drills session you can
resume (or create one). Stop the backend (`Ctrl+C` the `npm run dev`
process), then navigate to `/practice`. **Expected:** an error screen with a
"Something went wrong" message and a **Retry** button — not an infinite
"Loading questions…" spinner.

Restart the backend, then click **Retry**. **Expected:** the request re-fires
and the actual practice screen loads — no page refresh needed, no repeated
click needed.

```bash
# Verify the underlying fix is in place (extracted into a reusable callback
# both the mount effect and Retry button call, instead of the old dead
# reset-state-but-nothing-re-fires bug):
grep -n "bootstrapSession\b" client/src/pages/Practice.jsx | head -5
```
**Expected:** shows `bootstrapSession` defined once via `useCallback`, called
from the mount `useEffect`, and called directly from the Retry button's
`onClick`.

☐ Pass — Retry genuinely re-fetches and recovers, doesn't just reset state

---

## 33. A session with every question deleted shows an error, not a blank page

Requires `psql` access.

```bash
# Create a session referencing only nonexistent question IDs, for your own test user.
psql "$DATABASE_URL" -c "
INSERT INTO sessions (user_id, num_questions, timer_mode, feedback_mode, session_type, status, question_ids)
SELECT id, 3, 'untimed', 'instant', 'practice', 'active', '[\"nonexistent1\",\"nonexistent2\",\"nonexistent3\"]'
FROM users WHERE username = '$TEST_USER'
RETURNING id;
"
```
Note the returned `id`, then in a browser (logged in as that user) run in
DevTools console:
```js
localStorage.setItem('varc_active_session', JSON.stringify({
  id: <THE_ID>, numQuestions: 3, timerMode: "untimed",
  feedbackMode: "instant", sessionType: "practice", status: "active",
  questionIds: ["nonexistent1","nonexistent2","nonexistent3"],
  practiceMode: "analysis", startedAt: Date.now()
}));
```
Navigate to `/practice`. **Expected:** "This session's questions are no
longer available." with a **Back to Session Setup** button — not a blank
white screen with no way out.

Clean up afterward:
```bash
psql "$DATABASE_URL" -c "DELETE FROM sessions WHERE id = <THE_ID>;"
```

☐ Pass — clear error screen with an escape hatch, verified live

---

## 34. Question index/total stay sequential after a partial deletion

Requires `psql` access. Same idea as test 33, but with a **mix** of valid and
invalid question IDs:

```bash
psql "$DATABASE_URL" -c "
INSERT INTO sessions (user_id, num_questions, timer_mode, feedback_mode, session_type, status, question_ids)
SELECT id, 5, 'untimed', 'instant', 'practice', 'active', '[\"q001\",\"nonexistent1\",\"q020\",\"nonexistent2\",\"q014\"]'
FROM users WHERE username = '$TEST_USER'
RETURNING id;
"
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s $BASE/api/sessions/<THE_ID>/questions -H "Authorization: Bearer $TOKEN" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for q in d['questions']: print(q['id'], 'index=', q['index'], 'total=', q['total'])
"
```
**Expected:** three surviving questions numbered `index=1,2,3` with
`total=3` each — sequential, no gaps (previously could show e.g. `1, 3, 4` of
a stale `"total": 5`).

Clean up: `psql "$DATABASE_URL" -c "DELETE FROM sessions WHERE id = <THE_ID>;"`

☐ Pass — index/total renumbered after filtering, verified live

---

## 35. AI calls have a real timeout (no infinite "Analyzing…")

```bash
grep -n "timeout:" server/ai/provider.js
```
**Expected:** shows `timeout: 30_000` on the OpenAI client construction. Not
independently live-testable without artificially hanging OpenRouter — this
is a code-level guarantee: any call that exceeds 30s now throws the same way
any other AI failure does, which every calling route already catches
(`aiError: true`, logged to `api_calls`).

☐ Pass — timeout configured, verified by code read

---

## 36. Browser back/tab-close is warned while a Drills session is unresolved

In a browser, start a Drills session, answer or view at least one question
(so you're mid-session), then try to **close the tab** (or use the browser's
own Back button). **Expected:** the browser's native "Leave site? Changes you
made may not be saved" prompt appears — this is a native browser dialog
Graspr can't customize the text of, but it should appear at all, which it
didn't before this fix.

Note: this only fires while `questions` are loaded and the session hasn't
ended (`inProgressRef` in `Practice.jsx`) — it won't nag you on `/dashboard`
or other non-session pages.

☐ Pass — native leave-confirmation prompt appears mid-session

---

## 37. Coach: unsaved reasoning/chat text also warns on tab-close

Same idea as test 36, but for `CoachPractice.jsx`: type something into the
reasoning box or the Discuss chat input **without submitting/sending it**,
then try to close the tab. **Expected:** the native leave-confirmation prompt
appears. Clear the field (or submit/send it) and try again — **expected:**
no prompt, since the Coach session itself is safely resumable and only
*unsaved typed text* is at risk here.

☐ Pass — prompts only when there's actually unsaved text, not on every leave

---

## 38. Coach chat: a failed send rolls back instead of losing the message

Requires DevTools. Start (or resume) a Coach session, get to a question's
Discuss chat, and in the console run:
```js
window.__origFetch = window.__origFetch || window.fetch;
window.fetch = (url, opts) => (typeof url === "string" && url.includes("/api/coach/exchange"))
  ? Promise.reject(new Error("simulated failure"))
  : window.__origFetch(url, opts);
```
Type a message in the Discuss box and send it. **Expected:** an error
appears, and — this is the actual fix — **your typed message reappears in
the input box** instead of vanishing, and the phantom "sent" bubble does
**not** stay stuck in the conversation. Restore fetch afterward
(`window.fetch = window.__origFetch`) and send again to confirm the happy
path still works normally.

☐ Pass — failed send restores the input text, doesn't leave a stuck bubble

---

## 39. CI runs and passes on push to main

```bash
gh run list --limit 3
```
**Expected:** the most recent run for `CI` on `main` shows `completed` /
`success` — not `failure`. If it's still `in_progress`, wait a minute and
re-run.

```bash
gh run view --log-failed 2>&1 | head -40
```
**Expected:** no output (nothing failed). If something did fail, this shows
which step and why.

☐ Pass — CI green on the current `main`

---

## Quick summary checklist

| # | Test | Pass? |
|---|---|---|
| 1 | Security headers present | ☐ |
| 2 | CORS allows real origin, blocks fake origin | ☐ |
| 3 | Oversized body → 413 | ☐ |
| 4 | Rate limit kicks in at ~10 req/min on auth routes | ☐ |
| 5 | Account locks after 5 fails, even correct password blocked | ☐ |
| 6 | Registration doesn't leak "email already registered" | ☐ |
| 7 | New password hashes use cost factor 12 | ☐ |
| 8 | JWT expires in exactly 7 days | ☐ |
| 9 | Malformed input → clean 400, not a 500 crash | ☐ |
| 10 | Admin routes reject non-admin / no-auth requests | ☐ |
| 11 | AI routes have their own 20/min per-user limit | ☐ |
| 12 | Username-available check still works publicly | ☐ |
| 13 | No dangerouslySetInnerHTML, no string-concat SQL, injection payload inert | ☐ |
| 14 | npm audit shows only the known 19 moderate issues | ☐ |
| 15 | Privacy/Terms pages load, footer links work, contact info correct | ☐ |
| 16 | Cookie banner shows once; Decline blocks PostHog, Accept enables it | ☐ |
| 17 | Registration blocked until 18+/Terms checkbox is checked | ☐ |
| 18 | Data export returns real data, no password hash | ☐ |
| 19 | All SEO static assets served (favicon, sitemap, robots, OG image) | ☐ |
| 20 | Per-page title/description change on client-side nav, no duplicates | ☐ |
| 21 | Google OAuth age-gate gap acknowledged (not a bug) | ☐ |
| 22 | Health check does a real DB round-trip (200 healthy, 503 down) | ☐ |
| 23 | 5xx errors don't leak internals in production; 4xx unaffected | ☐ |
| 24 | Sentry captures a client-side render crash | ☐ |
| 25 | Sentry captures a server-side route error via next(err) | ☐ |
| 26 | PostHog funnel events (signup/session_start/question_answered/coach_used) fire | ☐ |
| 27 | A real API response comes back gzip-encoded | ☐ |
| 28 | All 4 new DB indexes exist (sessions/attempts/coach hot columns) | ☐ |
| 29 | DB pool has explicit max: 10 | ☐ |
| 30 | Skip advances instantly on success; correctly rolls back on failure | ☐ |
| 31 | Expired token → clear banner, dead token cleared, return path preserved | ☐ |
| 32 | Practice "Retry" button actually re-fetches and recovers | ☐ |
| 33 | All-questions-deleted session shows an error screen, not a blank page | ☐ |
| 34 | Question index/total stay sequential after a partial deletion | ☐ |
| 35 | AI client has a real 30s timeout configured | ☐ |
| 36 | Browser tab-close warns mid-Drills-session | ☐ |
| 37 | Browser tab-close warns only when Coach has unsaved reasoning/chat text | ☐ |
| 38 | Coach chat failed-send rolls back (restores input, no stuck bubble) | ☐ |
| 39 | CI is green on the current main | ☐ |
