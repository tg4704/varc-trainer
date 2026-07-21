# Graspr automated test suite

Converts `PRELAUNCH_TEST_PLAN.md` (manually executed 2026-07-18) into a
runnable suite. See the "Automated test suite" stage in the Obsidian launch
checklist (`Operations/Launch Checklist.md`) for how this fits the launch
sequence.

```
tests/
├── support/
│   ├── apiClient.js   fetch wrapper, reads BASE_URL from env
│   ├── db.js          direct Postgres access for fixtures only — never for
│   │                   asserting product behavior. No-ops if DATABASE_URL unset.
│   └── fixtures.js     createVerifiedUser / deleteUser / mintToken / forgedToken
├── api/                node:test files — auth, sessions, security, billing, admin
└── e2e/                Playwright — real browser, seeded-JWT auth
```

## Running locally

```bash
# API suite — needs DATABASE_URL + JWT_SECRET (same as running the server)
npm test

# E2E — needs the client dev server up (npm run dev in client/) and the API server up
npm run test:e2e

# Both against a specific server
BASE_URL=http://localhost:3001 npm test
E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

## Running against the deployed site (post-deploy smoke)

```bash
BASE_URL=https://www.graspr.in npm run smoke
```

**No `DATABASE_URL` or `JWT_SECRET` needed for this.** Every test that needs
direct DB access (fixture user creation, IDOR checks that need two real
accounts) calls `t.skip(...)` when `DATABASE_URL` is unset — it doesn't fail,
it self-narrows to whatever's left: auth-gate checks (401/403 with no token),
public endpoints (`/plans`, `/health`), security headers, CORS, and the real
rate limiter. Confirmed locally: 14/56 tests run this way, all read-only or
auth-gate checks — nothing destructive, nothing needing a secret. This is
also the job GitHub Actions runs on manual dispatch (Actions tab → CI →
Run workflow → pick the target URL, defaults to production).

## Why some tests take 30-60 seconds

`authLimiter` (10 requests/min/IP) is a single in-memory bucket shared across
every file in a run. `tests/support/apiClient.js`'s `withRateLimitRetry()`
catches a 429 on fixture setup (register/login), reads the real
`RateLimit-Reset` header, and waits that out rather than failing — so an
unlucky file ordering self-heals instead of flaking. Tests that are
*deliberately* checking the limiter itself (in `security.test.js`) don't use
this wrapper — they need to see a real, immediate 429.

If you're iterating locally and want faster feedback, run one file at a time
(`node --test tests/api/sessions.test.js`) — session/coach/billing/admin
routes aren't rate-limited, so those files run in milliseconds.

## Test-data hygiene

Every fixture user is `qa_<timestamp>_<random>@qatest.local`, created via the
real `/api/auth/register` → DB-verified → `/api/auth/login` path, and deleted
via the real `DELETE /api/account` route in each file's `after()` hook — not
a raw SQL delete (the schema has FK constraints, e.g. `otp_tokens`, with no
cascade; the app's own deletion route already handles that correctly, so
tests should use it too rather than reimplementing cascade logic).

If a run leaves rows behind (a crash before cleanup, e.g.), find them with:

```sql
SELECT id, username, created_at FROM users
WHERE username LIKE 'qa_%' OR email LIKE '%@qatest.local';
```

## Known gaps (not yet ported from PRELAUNCH_TEST_PLAN.md)

- Coach API (`§1.3`) — the plan's Coach section predates the passage-bank
  rebuild (it describes article-paste + save-to-bank, both removed). Needs
  rewriting against the current `/api/coach/passages` → `/sessions` →
  `/reading-map` → `/attempts` flow before porting, not a straight port.
- Account export/reset/delete beyond what `security.test.js` already
  exercises incidentally (`§1.6`).
- OTP brute-force / attempt-cap behavior (`§A3`) — the 5-attempts-then-locked
  logic in `verifyOtp()` is real and testable (deterministically, via the
  same DB-seeded-hash technique `fixtures.js` could be extended with) but
  isn't covered yet.
- Full Razorpay payment-flow testing (webhook HMAC, verify, subscriptions) —
  correctly deferred until Razorpay test-mode keys are wired into CI; today's
  `billing.test.js` only covers the parts that don't need a real provider.
