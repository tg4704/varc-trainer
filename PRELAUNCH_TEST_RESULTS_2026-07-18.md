# Graspr — Pre-Launch Test Run Results

> Run date: 2026-07-18 · Env: local dev (server :3001, Vite :5173, local Postgres)
> Config at test time: `ENABLE_TIERS=true`, Razorpay test keys (`rzp_test_`), `NODE_ENV=development`
> Method: live API harness (curl + directly-minted JWTs) + real browser E2E on the running app.
> Test users `qa_*@qatest.local` were provisioned and **fully cleaned up** afterward (0 rows remain).

## Summary

**~50 checks executed, all passing.** No security-critical failures. Three minor findings + four items that can't be verified in this environment (need staging / live keys). Details below.

| Area | Checks | Result |
|---|---|---|
| Auth (token, tamper, leak) | 4 | ✅ all pass |
| IDOR / BOLA (sessions, coach, attempts, export) | 13 | ✅ all pass |
| Sensitive-field leakage (answer key) | 2 | ✅ no leaks |
| Input validation (400s) | 6 | ✅ all pass |
| Admin auth enforcement | 4 | ✅ all pass |
| Billing (public/sig/webhook/order) | 10 | ✅ all pass |
| Tier caps → 402 (coach + drills) | 2 | ✅ correct payloads |
| Rate limiting / lockout / enumeration | 4 | ✅ all pass |
| Headers / CORS / payload limit | 4 | ✅ all pass |
| Frontend E2E (Drills loop + UpgradePrompt) | full flow | ✅ pass |

## Detailed results

### Access control / IDOR — ✅ (highest-priority surface)
- User A → User B's `/api/sessions/:id`, `/:id/questions`, `/:id/review`, `/:id/complete`, `/:id/batch-evaluate` → **all 404**. A's `/sessions` list excludes B's session.
- A → B's `/api/coach/sessions/:id`, `/:id/reading-map`, `/:id/complete`, `DELETE /:id` → **404/400** (rejected). Control: B on own → 200.
- A → B's `/api/attempts/:attemptId/retry-evaluation` → **404**.
- `/api/account/export` → A's export contains **zero** B rows; no `password_hash`.
- **Body-param injection**: A creating a session with `{"user_id": <B>}` in the body → the session is owned by **A** (token wins, body ignored). Verified in DB.

### Sensitive-field leakage — ✅
- `GET /sessions/:id/questions` and the Coach session/questions payload expose only `id/type/question/options` — **no `correctIndex`, `trapIndex`, `sourceLines`** pre-reveal. Confirmed in the UI too: type/topic badges and the answer key appear only *after* answering.

### Auth hardening — ✅
- No-token → 401; tampered JWT → 401; `/me` hides `password_hash`.
- **Account enumeration blocked**: register with an existing email returns the generic `{requiresVerification:true}` (no "email taken"); `forgot-password` is byte-identical for known vs unknown email (`{"ok":true}`).
- **Login lockout works**: after 5 wrong passwords, the **correct** password is still rejected with a generic 401 (lockout engaged, no leak).
- **Rate limiting works**: auth route returns 429 past the 10/min/IP bucket (observed `401×5 → 429`).

### Billing / payments — ✅
- `/plans` public, no secret leakage.
- `/verify` with a bad signature → **400**; missing fields → 400.
- `/webhook` with a forged signature / no secret configured → **503** (safe rejection; would be 400 with a secret set).
- `/create-order` unknown tier → 400; `/quote` unknown/free tier → 400.
- `dev-activate` → 200 in dev (the prod block is `IS_PROD` — **must be re-verified against a `NODE_ENV=production` build**, see gaps).

### Tier caps → 402 — ✅ (mechanism verified)
- **Coach cap**: free tier is **1 passage/day**; 2nd create → `402 {reason:"daily_cap", tier:"free", cap:1, used:1, upgradeTo:"inference"}`.
- **Drills cap**: free tier is **10 reasonings/day**; with usage pre-seeded to 10, the 11th `/evaluate` → `402 {reason:"daily_cap", cap:10, used:10, upgradeTo:"inference", upgradeName:"Inference"}`. Confirmed the `requireEntitlement` middleware 402s **before** validation/AI.

### Infra — ✅
- 100kb+ payload → **413** (handler respects the limit, not flattened to 500).
- Rogue `Origin` (`evil.example.com`) → **not reflected** in `Access-Control-Allow-Origin`.
- Helmet `X-Frame-Options` + `X-Content-Type-Options` present.

### Frontend E2E (real browser) — ✅
Full core Drills loop driven on the running app:
Setup (slider→2 questions, Analysis/Untimed/Instant) → confirm modal → Practice → **tentative select** (reversible, "you can still change") → **Submit Answer locks it** (options disable, reasoning textarea + mic appear) → empty reasoning shows **"Submit (No AI Feedback)"** → instant feedback card ("Correct", **TRAP** badge on A, **Inference** type badge revealed post-answer) → Next → **Skip** (optimistic advance) → **EndSessionModal** → **Results** ("1/1 correct", skip correctly **excluded** from the denominator).
- **UpgradePrompt**: dispatching `graspr:limit-reached` renders the modal ("You've hit today's limit… Upgrade to **Inference**…", See plans / Not now) with the tier data correctly interpolated.

---

## Findings (minor — none launch-blocking)

1. **Stale cap numbers in `CLAUDE.md`.** Actual free-tier caps in `server/config/tiers.js` are **drills 10/day, coach 1/day** — the CLAUDE.md Monetization table says 15/2. Docs (and any pricing copy derived from them) should match the config, which is the enforced source of truth.
2. **Malformed-JSON error echoes the raw parser message.** A body of `this is not json` → `400 {"error":"Unexpected token 't', \"this is not json\"... is not valid JSON"}`. Not sensitive (it only reflects the client's own input), but the global 4xx handler returns `err.message` even in prod for body-parser errors. Polish: map express.json parse failures to a generic `"Invalid JSON body"`.
3. **`AI_MODEL` is pointed at a `:free` model in dev.** `.env` has `AI_MODEL="openai/gpt-oss-120b:free"` set (despite the adjacent comment saying it was disabled) — every AI reasoning/coach-grade call 429s. Dev-only, but it (a) blocks exercising the AI-feedback and drills-cap paths through real usage here, and (b) is a reminder to **confirm production is not on a `:free` model** before launch.

## Not verifiable in this environment (need staging / live setup)

- **Real Razorpay Checkout** (declined/timeout/webhook-lost/double-submit, subscription mandate) — needs KYC + live keys. Only the dev-mode + signature-rejection paths were testable here.
- **Google OAuth round-trip** (`state` CSRF validation, new-user → choose-username) — needs OAuth credentials + external redirect.
- **Prod error-masking** (5xx → generic message) — this env is `NODE_ENV=development`, so 5xx returns full detail by design; verify the generic-message path against a production build.
- **`dev-activate` 403 in prod** — the `IS_PROD` gate returns 200 here (correct for dev); must be confirmed 403 on a production build.
- **Drills-cap via real usage** (vs. the seeded-usage proof used here) — blocked by finding #3.
