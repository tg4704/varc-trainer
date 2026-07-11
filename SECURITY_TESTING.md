# Security Hardening — Manual Test Plan

Covers everything from the 2026-07 security pass (see `CLAUDE.md` → "Security
Hardening" for what was built and why). Each test is copy-pasteable — run it,
compare to "Expected," check the box.

## Setup

```bash
# Point this at whatever you're testing — local dev or a deployed URL.
BASE=http://localhost:3001
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
