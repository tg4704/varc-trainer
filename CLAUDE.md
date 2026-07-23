# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

**Graspr** (formerly "VARC Trainer") — a web app for CAT aspirants to get better at Verbal Ability & Reading Comprehension.

**As of the 2026-07 restructure the app is three products** (locked in [`PHASE0_ARCHITECTURE.md`](PHASE0_ARCHITECTURE.md), the source of truth for the new shape), framed as a Read → Comprehend → Solve journey:

- **① Reading Lounge** — curated real Creative-Commons articles to build reading stamina (`articles` table; `/reading*` client pages **not built yet** — table + admin import exist, no runtime route/nav link yet).
- **② Coach** *(keeps the `/coach/*` routes, evolved in place — this is the feature that was fully rebuilt)* — pick a full-length RC **passage** from the bank, write a **reading-map** (what each paragraph does) and get it **graded by AI *before* seeing any question**, then answer multi-question sets with reasoning verdicts, with an optional "Stuck? Discuss" chat as a supplement (no longer the defining Socratic-debrief mechanic). Data: `passages` + `coach_sessions` + `coach_attempts` (all rebuilt), reusing `questions` via `passage_id`.
- **③ Drills** — the original single-paragraph trap-spotting loop, relabelled "Drills" in copy (routes `/setup`, `/practice`, `/results`, `/session-review` unchanged). Each question is anchored to a short paragraph (~90–120 words). The user picks an answer, explains their reasoning, and gets AI feedback on the quality of their thinking.

The original phased build spec is in [`varc_trainer_build_prompt.md`](varc_trainer_build_prompt.md). The old roadmap is [`ROADMAP.md`](ROADMAP.md); the current one is [`Roadmap_new.md`](Roadmap_new.md). The user-facing feature list is [`USER_FEATURES.md`](USER_FEATURES.md). The offline content-generation pipeline (how passages/questions are authored) lives in [`content-pipeline/`](content-pipeline/) — `PIPELINE.md`, `READING_GRADER.md`, `GENERATION_KIT.md`, etc. The pre-restructure Coach plan in [`ai_reading_coach_plan.md`](ai_reading_coach_plan.md) is now **superseded** by the Phase 0 architecture.

## Tech Stack

- **Frontend**: React (Vite) + Tailwind CSS + React Router v6 — lives in `client/`
- **UI system**: shadcn/ui-style primitives in `client/src/components/ui/`, built on Radix Slot + `class-variance-authority` + `tailwind-merge`. **Graspr design (2026-06)**: dark-only editorial theme. `client/src/index.css` holds two parallel token systems pointing at the same dark palette — (1) the shadcn HSL tokens (`--background`, `--primary`…) remapped to dark so every page reskins at once, and (2) raw hex tokens (`--bg`, `--teal`, `--surface`…) + utility classes (`.btn`, `.opt`, `.accent-card`, `.badge`, `.card`, animations) ported from the design. `theme.jsx` forces dark always. Fonts: Newsreader (display, `font-display`/`.display`), Source Serif 4 (reading passages, `font-reading`/`.serif-read`), Inter (UI), IBM Plex Mono (`.mono`). Accent teal `#5DCAA5`. Shared `components/Icon.jsx` = line-art icon set; `components/AuthShell.jsx` = auth card shell. `OptionCard` and `FeedbackSections` use the signature `.opt` / layered accent-card styling. The dark editorial theme now applies across every screen via the shared tokens. (The old `design_dump/` handoff bundle is no longer in the repo; `UI_REDESIGN.md` documents the redesign.)
- **Backend**: Node.js + Express — lives in `server/`
- **Database**: PostgreSQL via `pg` (node-postgres) — `DATABASE_URL` env var; Railway Postgres in production; local Postgres in dev
- **Auth**: bcryptjs (password hashing) + JSON Web Tokens (`jsonwebtoken`)
- **AI**: Anthropic Claude API (`claude-haiku-4-5`) — reasoning evaluation only, never used to determine correct answers
- **Language**: Plain JavaScript throughout, no TypeScript

## Commands

```bash
# Backend (from repo root)
npm install      # first-time setup
npm run dev      # nodemon server/index.js  (http://localhost:3001)
npm start        # node server/index.js

# Frontend (from client/)
npm install      # first-time setup
npm run dev      # vite dev server on localhost:5173
npm run build    # production build to client/dist
```

Both servers must run together in dev: Vite proxies `/api` → `http://localhost:3001`.
There is no test runner configured yet. `.claude/launch.json` defines the `client` dev server for the preview tooling.

## Project Structure

```
server/
├── index.js                ← Express app; mounts all /api routes
├── db.js                   ← Postgres (pg Pool) init, migrations, seed + admin bootstrap
├── auth.js                 ← signToken() + authenticate + requireAdmin middleware
├── questionsRepo.js        ← shared DB accessor for questions (Phase 8)
├── data/questions.js       ← 25 seed questions (SEED SOURCE only; read at first-run seed,
│                              never at request time — see Phase 8 below)
├── ai/
│   ├── pricing.js          ← per-model USD price table (Phase 9)
│   └── apiLog.js           ← logApiCall() — writes to api_calls (Phase 9)
└── routes/
    ├── auth.js             ← register / login / me / password (returns role)
    ├── sessions.js         ← create/list/active/get/complete (all auth-gated)
    ├── questions.js        ← GET /next (auth + session-ownership + quota)
    ├── attempts.js         ← POST /basic (answer or skip)
    ├── evaluate.js         ← POST /evaluate (AI reasoning eval; logs to api_calls)
    ├── dashboard.js        ← exports `handle()` so admin can reuse it for impersonation
    ├── account.js          ← DELETE /reset (account data wipe)
    ├── admin.js            ← Phase 9 admin API — overview, users, questions,
    │                          flags, costs (all role='admin' gated)
    ├── coach.js            ← Phase 14 Coach API — REBUILT (passages, reading-map grade, attempts, discuss)
    ├── billing.js          ← Monetization — plans/me/create-order/verify/webhook/subscriptions
    ├── bulletins.js        ← admin "important updates" shown on the logged-in home
    └── sr.js               ← Phase 15 spaced repetition (GET /queue, GET /stats)
```

**Not reflected in the tree above but present** (grew a lot post-restructure):
- `server/lib/`: `entitlements.js` (tier caps), `grants.js` (the only writer of `users.tier`/`tier_expires_at`), `season.js` ("Till CAT" plan pricing/expiry), `subscriptions.js` (Razorpay autopay), `rateLimiters.js`, `loginLockout.js`, `schemas.js`+`validate.js` (zod), `validateQuestion.js`, `extractJSON.js`, `trapMeanings.js`.
- `server/ai/`: `provider.js` (OpenRouter client + `resolveModels`/`callModel`), `prompts.js` (5 admin-overridable prompt defaults), `pricing.js`, `apiLog.js`.
- `server/config/tiers.js`: tier definitions (single source of truth).
- New client pages: `Reading Lounge` planned (articles table + `AdminImport` exist, no `/reading` route yet), `MyPlan`, `Refunds`, `Cookies`, `FAQ`, `Blog`, `LoggedInHome`, `ProfileCustomize`, `NotFound`, `OAuthCallback`, email/OTP pages, `SessionReview`, `CoachHistory`.
- New admin pages: `AdminPassages`, `AdminImport`, `AdminPrompts`, `AdminBulletins`, `AdminLogs`.
- **`My Questions` is removed from the UI** — `/my-questions*` routes now `Navigate` to `/dashboard`. The `POST /api/my-questions/*` API and `author_user_id` question support still exist server-side; only the client entry points were retired.

```
client/src/
├── App.jsx                 ← AuthProvider + nav (incl. Admin link) + routes
├── main.jsx                ← bootstrap; wraps in ThemeProvider + BrowserRouter
├── api.js                  ← fetch wrapper + `admin` namespace for Phase 9 endpoints
├── auth.jsx                ← AuthProvider / useAuth (user.role exposed)
├── theme.jsx               ← ThemeProvider + useTheme (Phase 8.5)
├── session.js              ← active-session localStorage helpers
├── lib/utils.js            ← cn() class-name helper (Phase 8.5)
├── pages/
│   ├── Home                 ← public landing (interactive demo card)
│   ├── LoggedInHome         ← authed home: bento tiles for the Read→Comprehend→Solve journey
│   ├── Login / Register / VerifyEmail / ForgotPassword / ResetPassword  ← auth + OTP flow
│   ├── OAuthCallback / ChooseUsername  ← Google OAuth landing + username confirm
│   ├── SessionSetup / Practice / Results / SessionReview  ← ③ Drills (routes unchanged)
│   ├── CoachLanding / CoachPractice / CoachSummary / CoachHistory  ← ② Coach (passage picker → reading-map → questions → review/history)
│   ├── Dashboard           ← per-user analytics (Drills + Coach tabs)
│   ├── Profile / ProfileCustomize  ← read-only profile + avatar picker
│   ├── MyPlan              ← self-serve tier/usage/purchase-history + client-side receipt
│   ├── Pricing / Refunds   ← data-driven pricing (tiers.js) + refund policy
│   ├── Blog / FAQ / Cookies / Privacy / Terms (+ LegalDoc shared shell)  ← marketing/legal
│   ├── MyQuestions / MyQuestionEditor  ← retired from nav (routes redirect to /dashboard) but files remain
│   ├── NotFound           ← catch-all 404
│   └── admin/              ← Phase 9 admin shell (lazy-loaded)
│       ├── AdminLayout            ← sidebar + Outlet
│       ├── AdminOverview          ← top-level stat cards
│       ├── AdminUsers             ← paginated user list + search
│       ├── AdminUserDetail        ← per-user stats, promote/demote, reset data, tier grant/revoke, coach sessions
│       ├── AdminUserDashboard     ← read-only impersonation (uses Dashboard fetcher prop)
│       ├── AdminQuestions         ← filterable question list
│       ├── AdminQuestionEditor    ← structured CRUD form
│       ├── AdminPassages          ← ② Coach passage bank management
│       ├── AdminImport            ← bulk import of passages/questions (content-pipeline output)
│       ├── AdminCosts             ← AI spend by day/model/user
│       ├── AdminLogs              ← raw api_calls log viewer
│       ├── AdminPrompts           ← edit the 5 AI prompt overrides (ai_prompts)
│       ├── AdminBulletins         ← post "important updates" for the logged-in home
│       └── AdminFlags             ← quality-flag review queue
├── hooks/
│   └── useVoiceInput.js    ← Phase 11 Web Speech API wrapper (short per-phrase, en-US, interim results)
└── components/
    ├── ui/                 ← Phase 8.5 primitives (button, card, badge, input)
    ├── TopNav              ← universal floating glass-pill nav (responsive; avatar dropdown absorbs links <1024px)
    ├── SideDock            ← right-edge dock: Updates (bulletins) + Blog tabs
    ├── SiteFooter          ← marketing footer
    ├── ThemeToggle         ← light→dark→system cycle (UI is dark-only in practice)
    ├── Avatar              ← profile picture (gradient initial / icon / emoji)
    ├── OptionCard          ← Drills/Coach answer-option card (status-driven styling)
    ├── FeedbackSections    ← per-option one-line verdict for the "Every option" review tab
    ├── FeedbackCard        ← lightweight feedback wrapper (Phase-2 placeholder shell)
    ├── SessionTopBar / CoachSessionTopBar  ← in-session bars (Drills / Coach)
    ├── QuestionStepper     ← floating, edge-dockable question navigator
    ├── TimerRing / IntuitionTimer  ← SVG donut / circular countdowns
    ├── PassageFontMenu     ← "Aa" passage typeface/size/spacing menu
    ├── TopicBadge/TypeBadge← topic/question-type chips
    ├── Modal               ← shared modal shell (focus trap, Esc, backdrop) used by every modal
    ├── AccountDangerModals ← reset-data / delete-account confirm modals (shared)
    ├── ShareResultsModal   ← canvas→PNG shareable results card
    ├── VoiceMicButton      ← Phase 11 mic toggle (pulses while recording)
    ├── TypingLoader        ← calm "AI is working" type-in indicator
    ├── OnboardingChecklist ← first-session activation checklist on Home
    ├── UpgradePrompt       ← app-level modal reacting to graspr:limit-reached (402)
    ├── CookieConsent       ← analytics consent banner (gates PostHog)
    ├── PageMeta            ← per-route <title>/<meta description> for public pages
    ├── Tooltip             ← shared hover tooltip
    ├── DashboardSkeleton   ← shared Dashboard loading skeleton
    ├── ErrorBoundary       ← catches render crashes → friendly reload fallback (reports to Sentry)
    ├── Icon / AuthShell    ← line-art icon set / centered auth-card wrapper
    ├── ProtectedRoute      ← auth gate
    └── AdminRoute          ← admin role gate (Phase 9)
.env                        ← ANTHROPIC_API_KEY, PORT, JWT_SECRET, ADMIN_USERNAMES
```

## Admin (Phase 9)

The first admin(s) are bootstrapped from the `ADMIN_USERNAMES` env var (comma-separated usernames). On every server start, those users are promoted to `role='admin'` if they aren't already. Promotion is one-way — removing the env var does not demote.

After that, an admin can promote/demote others through the UI (`/admin/users/:id`, except they can't demote themselves).

Admin URL is `/admin`, with sub-routes: `/admin/users`, `/admin/questions`, `/admin/costs`, `/admin/flags`, plus drill-ins for individual users (`/admin/users/:id` and the read-only "view as user" page at `/admin/users/:id/dashboard`) and questions (`/admin/questions/new`, `/admin/questions/:id`).

The Admin link in the top NavBar is only rendered when `user.role === 'admin'`.

The legacy `ADMIN_KEY` query-param hack from before Phase 9 is removed — all admin routes are now gated by JWT + `requireAdmin` middleware that checks `users.role`.

## Authentication

- Users register with **username + email + password**; login accepts **either** username or email as the `identifier`.
- Passwords hashed with bcryptjs; a 30-day JWT is returned on register/login and stored in `localStorage` under `varc_token`.
- `api.js` attaches `Authorization: Bearer <token>` to every request. `server/auth.js`'s `authenticate` middleware verifies it and sets `req.userId`.
- Frontend auth state lives in `auth.jsx` (`AuthProvider`/`useAuth`); on boot it validates the stored token via `GET /api/auth/me`.
- `components/ProtectedRoute.jsx` gates `/setup`, `/practice`, `/results`, `/dashboard`, `/profile` — redirects to `/login` (preserving intended path in `location.state.from`).
- All session/question/attempt/dashboard routes are auth-gated and enforce **session ownership** (`WHERE ... AND user_id = ?`).

## Session Model

A session is an explicit, configured run created on the **Session Setup** page (`POST /api/sessions`):

- `numQuestions` (1–25)
- `timerMode`: `untimed` | `count_up` (counts up, unlimited) | `countdown` (ends at 0:00)
- `timerScope`: `per_question` | `per_session` (required for timed modes; null for untimed)
- `timerSeconds`: countdown duration (per question or per whole session); null for untimed/count_up

**Timer behavior (client-enforced in `Practice.jsx`):**
- `count_up` + `per_question` → display resets each question; `per_session` → accumulates across the run.
- `countdown` + `per_question` → each question gets `timerSeconds`; on 0:00 it **auto-skips** to the next question.
- `countdown` + `per_session` → one continuous clock; on 0:00 the **whole session ends**.
- Per-session countdowns anchor to `startedAt` (stored in localStorage) so they survive a refresh.

**Skip**: every question has a Skip button; auto-skip on per-question timeout uses the same path. Skips are recorded (`skipped=1`, no selection) and **excluded from accuracy/trap-rate denominators**.

**Session end** → `POST /api/sessions/:id/complete` → navigate to `/results`. A session ends when the question quota is reached (server returns `{ done: true }` from `/next`) or a per-session countdown expires. On the **last question** (`question.index === question.total`), the post-answer button reads **"End Session"** and calls `finishSession` directly — skipping the redundant `/next` round-trip.

**Client session storage**: the in-progress session is kept in `localStorage` under `varc_active_session` (`{ ...sessionConfig, startedAt }`); cleared on completion and on logout. (This replaced the old Phase-3 `varc_session` object.)

**Question selection (2026-07-23)**: all N questions are picked **once, at session creation** (`POST /api/sessions`, `sessions.js`) and frozen into `sessions.question_ids`, so refresh/resume gives the same set and order. The pool is `questionsRepo.listForUser()` filtered by the chosen `difficulties` subset, then by `typeFilter` if set. Selection order:

1. **Unseen first** — questions the user has never *answered*, in any past session, shuffled. `questionsRepo.attemptedByUser(userId)` returns a `Map(questionId → id of most recent attempt)`; the attempt id is a monotonic proxy for "how long ago".
2. **Top up with longest-ago-seen** if unseen runs dry, then reshuffle the combined list so recycled questions aren't bunched at the end in a predictable order. This is a **soft preference, not a hard filter** — with a 24-question standalone bank, a user exhausts it in ~2–3 sessions (sooner under a difficulty filter), and refusing to build a session would be worse than repeating.
3. **Repeat within the same filtered pool** as a last resort when the pool itself is smaller than `numQuestions` — never silently falls back to other types/difficulties.

**Skips are not counted as seen** (`AND a.skipped = 0` in `attemptedByUser`) — a skipped question gave the user nothing, so it stays in the unseen pool and can come round again. The separate *within-session* guard in `/questions/next` still won't re-serve a question skipped earlier in the same run.

**Use `server/lib/shuffle.js` (Fisher-Yates) for any new shuffling — never `sort(() => Math.random() - 0.5)`.** That idiom was used at all three selection sites until 2026-07-23 and is **not** a uniform shuffle: the comparator is inconsistent (it can claim a<b and b<a), so V8's TimSort leaves elements biased toward their original index. Measured over 200k trials on an 8-element array, the first element landed in slot 0 **22.1%** of the time against an ideal 12.5% — and since selection is shuffle-then-`slice(0, N)`, that bias went straight into which questions users saw. Fisher-Yates measures 12.6%.

`GET /api/questions/next` still holds the old per-question random picker, but `Practice.jsx` prefetches from `question_ids` via `GET /api/sessions/:id/questions`, so that path is largely vestigial. Its "unseen" check is now cross-session too (it was per-session only), with a fallback that picks randomly from the oldest-seen third rather than uniformly from everything.

## Key Architecture Decisions

**Question data is server-only**: `correctIndex`, `trapIndex`, and `sourceLines` must never be sent to the client. `GET /api/questions/next` strips them and adds `index`/`total` (or `{ done: true }` when the quota is hit).

**Two practice modes**: Analysis and Intuition. The `practiceMode` field (`"analysis"` | `"intuition"`) is stored in `varc_active_session` localStorage and read by `Practice.jsx` to branch into the correct UI. SessionSetup has a mode selector at the top before the question-count and timer options.

**Intuition points** (calculated server-side in `attempts.js`): +10 correct, +3 bonus if <30s, +2 per correct elimination, -5 for eliminating the correct answer, -2 if skipped/timed-out. `eliminated_indices` is sent as a JSON array in the request payload; `intuition_points` is returned in the response.

**Attempt endpoints**:
- `POST /api/attempts/basic` — handles both Analysis (answers/skips) and Intuition mode (includes `eliminatedIndices`, returns `intuitionPoints`); no AI call.
- `POST /api/attempts/evaluate` — Phase 4 Analysis mode (not yet built); will save the attempt to DB *before* calling Claude so it's never lost if the API fails.

**Claude evaluates reasoning quality, not correctness** (Phase 4): the correct answer is known from the DB row; Claude scores the reasoning process (1–5) and explains the trap.

**Questions live in SQLite, not in JS** (Phase 8): all runtime question lookups go through `server/questionsRepo.js` which reads the `questions` table. `server/data/questions.js` is **seed source only** — it is loaded once on first server startup (when the `questions` table is empty) and never imported by routes. To re-seed: stop the server, `DELETE FROM questions`, restart. Edits made directly to the seed file only take effect after wiping the table.

**Dashboard is user-scoped**: `GET /api/dashboard` (no `sessionId`) aggregates across **all** the logged-in user's sessions. Accuracy and trap-pick rate are computed over answered (non-skipped) attempts. Returns `byType`, `byTopic`, `byTrapType` (encountered vs fell-for), `weakestType`, `mostDangerousTrap`, and `recentAttempts` (last 10 with full question+option data). `avgReasoningScore` returns `null` until Phase 4.

**Dashboard frontend** (`client/src/pages/Dashboard.jsx`) has 5 rows: header stat cards → SVG accuracy-by-type bar chart (red/amber/green thresholds) → trap weakness + topic accuracy cards → weakest-area callout → expandable recent-attempt cards. The `FeedbackSections` component (`client/src/components/FeedbackSections.jsx`) has since been repurposed — it now renders the per-option one-line verdict for an attempt's "Every option" review tab (built from the attempt's option/trap data), not the old 5-section AI block. Shared trap-type metadata lives in `client/src/trapTypes.js`.

## Database Schema (recreated by `server/db.js` on startup)

- `users(id, username UNIQUE, email UNIQUE, password_hash, role['user'|'admin'], created_at)`
- `sessions(id, user_id FK, num_questions, timer_mode, timer_scope, timer_seconds, feedback_mode['instant'|'deferred'], session_type['practice'|'review'], status['active'|'completed'], question_ids TEXT, created_at, completed_at)` — `feedback_mode` added Phase 13 via `ensureColumn`; `session_type` added Phase 15 via `ensureColumn`; `question_ids` added 2026-06 via `ensureColumn` (JSON array of pre-selected question IDs for free navigation).
- `attempts(id, session_id FK, question_id, question_type, topic, selected_option_index NULLABLE, correct_option_index, is_correct, trap_option_index, trap_type, selected_trap, skipped, reasoning_* + AI fields, mode, time_taken_seconds, eliminated_indices, intuition_points, created_at)`
- `questions(id, topic, paragraph, question, type, options_json, correct_index, trap_index, trap_type, source_lines, source, author_user_id FK NULLABLE, passage_id FK NULLABLE, is_active, created_at)` — **Phase 8**; built-ins have `source='seed'`/`author_user_id=NULL`. User-created questions (Phase 10) set `author_user_id`. **Restructure additions:** `passage_id` (NULL = standalone ③ Drill question; set = ② Coach passage-linked — passage-linked rows still store the passage body in `paragraph` so single-question rendering works); `source` now also allows `'ai_generated'`/`'coach'`; `type` adds `application`/`concept_set`/`vocab_in_context`; `trap_type` adds `too_broad`/`distortion`/`wrong_question`/`wrong_location`/`mislabelled`/`wordplay` alongside the original four. **Drills difficulty (2026-07):** `difficulty TEXT DEFAULT 'medium'` (`easy`/`medium`/`tough`) — added via `ensureColumn`, existing rows backfilled to `'medium'`. Drills-only concept: Coach passage-linked questions carry it too (defaults medium) but it's never used in the Coach flow. Session creation (`POST /api/sessions`) accepts a `difficulties: string[]` (non-empty subset; omitted → all three) and filters the pool by it, composing with `typeFilter`. SessionSetup has an Easy/Medium/Tough multi-select (all on by default, ≥1 enforced). Imports: `drills` items **require** a valid `difficulty` (`passage_set`/Coach questions don't); admin question editor + `my_questions_generate` prompt (`{{difficulty}}` token) + `content-pipeline/GENERATION_KIT.md` Prompt B all thread it, calibrating easy→plainer/obvious-trap, tough→denser/near-miss-trap. `VALID_DIFFICULTIES` lives in `server/lib/validateQuestion.js`.
- `passages(id, topic, genre, title, body, word_count, reading_key_json, source['ai_generated'|...], author_user_id FK NULLABLE, is_active, created_at)` — **Restructure**; ② Coach full-RC passage bank. `reading_key_json` = the canonical `{ thesis, tone, paragraph_functions:[], key_turn }` the reading-map grader scores against.
- `articles(id, title, author, source_name, source_url, license, genre, body, word_count, difficulty['easy'|'medium'|'hard'], is_active, created_at)` — **Restructure**; ① Reading Lounge curated CC articles. Attribution fields (`source_name`/`source_url`/`license`) stored for compliance. Runtime `/reading` UI not built yet.
- `api_calls(id, user_id FK NULLABLE, route, provider, model, input_tokens, output_tokens, est_cost_usd, status['ok'|'error'], created_at)` — **Phase 9**; every AI call is logged here. Cost computed against `server/ai/pricing.js`.
- `question_flags(id, question_id FK, flagged_by_user_id FK NULLABLE, source['user'|'ai'|'admin'], reason, status['open'|'resolved'], resolution['fixed'|'deleted'|'invalid'], created_at, resolved_at)` — **Phase 9**; review queue. Admin can flag from the question editor today; user thumbs-down + AI self-audit will populate this in later phases.
- `sr_cards(id, user_id FK, question_id TEXT, bucket[0–4], due_at, last_seen_at, last_correct, total_attempts, total_correct, created_at, UNIQUE(user_id, question_id))` — **Phase 15**; spaced repetition state. Bucket 0–4 → intervals [1,3,7,14,30] days. Never created on first-correct; created due=tomorrow on first-wrong.
- `coach_sessions(id, user_id FK, passage_id FK, reading_map_json, reading_grade_json, status['active'|'completed'], created_at, completed_at)` — **Restructure (rebuilt)**; one row per user's run at a passage (resumed, not duplicated, while active). `reading_map_json` = what the student submitted before questions; `reading_grade_json` = grader output. Old `article_text`/`questions_json` columns are gone.
- `coach_attempts(id, coach_session_id FK, question_id TEXT, question_index, question_type, selected_option_index, correct_option_index, is_correct, trap_type, selected_trap, reasoning_text, reasoning_score, reasoning_feedback, trap_explanation, correct_explanation, key_takeaway, discuss_conversation_json, exchange_count, error_category, time_taken_seconds, created_at)` — **Restructure (rebuilt)**; `discuss_conversation_json`/`exchange_count` back the "Stuck? Discuss" chat.
- `otp_tokens(...)` — email OTP + password-reset codes (verification/forgot-password flow).
- `ai_prompts(key PK, content, updated_by FK, updated_at)` — admin-editable overrides of the hardcoded prompts in `server/ai/prompts.js`; a row overrides the default for that key, no row = default.
- `bulletins(id, title, body, is_active, created_by FK, created_at, updated_at)` — admin-postable "important updates" shown on the logged-in homepage (`/api/bulletins`, `AdminBulletins.jsx`).
- `payments(id, user_id FK, tier, months, period['monthly'|'annual'|'till_cat'], season_year, amount_inr, provider, razorpay_order_id UNIQUE, razorpay_payment_id, status['created'|'captured'], captured_at)` — **Monetization**; one-time-order audit trail (see Monetization below).
- `razorpay_plans(id, tier, mode['test'|'live'], amount_inr, plan_id, UNIQUE(tier,mode,amount_inr))` — cached Razorpay Plan IDs for recurring subscriptions.
- `subscriptions(id, user_id FK, tier, razorpay_subscription_id UNIQUE, status, last_charge_id, current_end, cancel_at_cycle_end, cancelled_at, created_at)` — **Monetization**; a user's recurring (UPI-Autopay/card mandate) subscription. Tier access still lives on `users.tier`/`tier_expires_at`; each `subscription.charged` webhook extends it a month. Cancel-at-cycle-end by default.
- `users` also gained `name`, `avatar_id`, `favorite_topic`, `bio` (profile), `tier`/`tier_expires_at` (monetization), and the orphaned `daily_goal` (dead — see Phase 16).

`db.js` uses `CREATE TABLE IF NOT EXISTS` plus a small `ensureColumn` helper for additive column migrations (used to add `users.role` to existing DBs). **For non-additive schema changes (renaming/dropping columns, changing types), delete `varc.db` and restart** — the file is local-only data.

## Question Data Format

```javascript
{
  id: "q001",
  topic: "economics",           // 'economics'|'humanities'|'philosophy'|'science'|'social'
  paragraph: `...90-120 words...`,
  question: "Which of the following...",
  type: "inference",            // 'inference'|'tone'|'title'|'detail'|'application'
  options: [
    { text: "...", isCorrect: false, isTrap: true, trapType: "too_extreme" },
    { text: "...", isCorrect: true,  isTrap: false, trapType: null },
    ...
  ],
  correctIndex: 1,
  trapIndex: 0,
  trapType: "too_extreme",      // 'too_extreme'|'out_of_scope'|'real_but_unstated'|'partially_correct'
  sourceLines: "...3-4 sentences from the paragraph that contain the answer..."
}
```

25 questions total: 5 per topic, distributed as inference 35%, tone 20%, title 15%, detail 15%, application 15%. `questions.js` validates every question at module load (exactly one correct option, indices consistent) — this still runs when the seed bootstrap requires the file on first DB run.

**Planned: no-trap questions.** Real CAT RC doesn't always have an obvious trap — sometimes all wrong options are straightforwardly incorrect. Future questions with `trapIndex: null` / `trapType: null` should be supported: the attempt route already handles null trap fields, `selected_trap` stays 0, and the Practice feedback simply omits the trap panel when `trapOptionIndex` is null. When adding no-trap questions, skip the trap-index validation in `questions.js` for those entries.

## Build Status

Done: **Phase 1** (backend), **Phase 2** (frontend scaffold), **Phase 3** (core loop), **Auth & Configurable Sessions** (added on top of Phase 3), **Phase 4** (AI reasoning evaluation: `POST /api/attempts/evaluate`, Claude Haiku integration, reasoning textarea + 5-section feedback card in `Practice.jsx`), **Phase 5** (dashboard intelligence: SVG chart, trap weakness, weakest-area callout, expandable recent attempts), **Phase 6** (intuition mode), **Phase 7** (polish: dashboard 30s server cache, skeleton loading, lazy `Dashboard` with `React.lazy`, mobile paragraph toggle, question-repeat banner, `client/vercel.json` SPA routing config), **Deployment** (Vercel frontend + Render backend), **Phase 8** (questions migrated from `questions.js` into the `questions` SQLite table; all runtime routes read through `server/questionsRepo.js`; auto-seed on first run; `users.role` column added for Phase 9), **Phase 8.5** (design system foundation: shadcn-style primitives, indigo-based brand, Inter + Lora fonts, dark mode with system-pref + manual override, theme toggle in nav, ported screens: Home, Login, Register, SessionSetup, Practice, FeedbackSections, OptionCard, TypeBadge, TopicBadge), **Phase 9** (admin page: `requireAdmin` middleware, `ADMIN_USERNAMES` env-var bootstrap, full admin shell at `/admin` with overview/users/questions/costs/flags pages, question CRUD form with validation, read-only impersonation, AI cost tracking via `api_calls` + pricing table, quality-flag review queue; legacy `ADMIN_KEY` hack retired).
**Phase 10** (user-submitted questions: `POST /api/my-questions` CRUD, AI-draft via Claude Haiku at `POST /api/my-questions/generate-draft`, feature-flagged with `ENABLE_AI_AUTHORING`, ID format `user_{userId}_{timestamp}`, active questions auto-included in practice sessions, `/my-questions` page with list + method-picker editor + AI draft flow).
**Phase 11**: voice reasoning input — `useVoiceInput` hook wraps Web Speech API (Chrome/Edge); `VoiceMicButton` mic toggle sits beside the reasoning textarea in `Practice.jsx`; final transcript appended to `reasoningText`, interim shown as a live preview overlay; voice stops on submit and on "Next Question" (`loadNext` calls `resetVoice()`); hidden when `voiceSupported` is false; permission/no-speech errors shown inline. Uses `continuous:false` + `lang=en-US` (short per-phrase requests; more reliable than a long-lived stream). **Known issue (localhost):** Chrome fires a `"network"` error when it can't reach Google's speech servers — hook retries 3× silently then surfaces a message. If the error persists, check VPN/firewall blocking Google, Windows Privacy > Microphone setting, or no default mic set.
**Phase 12**: quote-to-reasoning — highlight passage text → popover "Quote" button inserts a styled blockquote chip into the reasoning textarea; chips are visually distinct from typed text; quoted spans sent as structured `quotes[]` array in the `/evaluate` payload so AI feedback knows exactly what the student cited.
**Phase 13**: deferred AI feedback in timed modes — any session with a timer (count-up or countdown) auto-defers AI evaluation; untimed Analysis sessions get a "Instant / After session" toggle in SessionSetup. During deferred sessions the submit button reads "Submit Answer", saves the attempt + reasoning via `POST /api/attempts/evaluate?deferred=true` (skips Claude), and shows a minimal ✓/✗ card. On session end, navigates to `/session-review?sessionId=:id` (new `SessionReview.jsx` page) which calls `POST /api/sessions/:id/batch-evaluate` to run all pending reasonings through Claude in parallel, then renders the full 5-section `FeedbackSections` for each question. `feedback_mode` column added to `sessions` table via `ensureColumn`; `GET /api/sessions/:id/review` returns full attempt + question display data; "View Session Summary →" link goes to the existing `/results` page.
**Phase 14 (Coach) — REBUILT in the 2026-07 restructure. The description below is current; the old "paste an article → Socratic debrief" model is gone.** The Coach is now a full-RC comprehension trainer over a **pre-authored passage bank**, keyed on the **reading-map grade** (`server/routes/coach.js`, `client/src/pages/CoachLanding.jsx` + `CoachPractice.jsx` + `CoachSummary.jsx` + `CoachHistory.jsx`). Flow:

1. **Pick a passage** — `CoachLanding` is a passage picker (`GET /api/coach/passages`, filterable by topic), NOT an article-paste box. `POST /api/coach/sessions {passageId}` creates or resumes an active session and returns the passage body + its questions (answer-revealing fields stripped until each question is attempted).
2. **Reading-map first (the differentiator)** — before any question, the student submits a reading map in **`quick` mode** (crux words, one entry per paragraph) or **`full` mode** (main point, tone, per-paragraph structure, "the turn"). **Any language is accepted** (mother-tongue verbalization) — grading is on understanding, not grammar. `POST /api/coach/sessions/:id/reading-map` grades it against the passage's canonical `reading_key_json` and returns `{ reading_mode, thesis, structure, caught_the_turn, what_you_missed, one_technique, verdict_line }`. Retries once, then **falls back to an ungraded stub rather than blocking** the student from the questions.
3. **Answer questions with reasoning verdicts** — `POST /api/coach/attempts` records the pick (immediate correct/incorrect reveal, no debrief gate) and, if reasoning text was given, returns a 5-field AI verdict (`reasoningScore`, `reasoningFeedback`, `correctExplanation`, `trapExplanation`, `keyTakeaway`). AI failure degrades to a saved attempt + `aiError` flag.
4. **Optional "Stuck? Discuss" chat** — `POST /api/coach/exchange` is now a *supplement available only after a question is answered* (max 4 exchanges/question), not the mechanic that reveals the answer.

Other endpoints: `GET /api/coach/sessions/:id` (full state), `POST /api/coach/sessions/:id/complete`, `GET /api/coach/history`, `GET /api/coach/stats` (Dashboard "Coach" tab: totals, accuracy, avg reasoning score, by-type, recent sessions), `DELETE /api/coach/sessions/:id`. Voice input is wired into both the reasoning box and the Discuss chat. `CoachSummary` shows score + per-question review; `CoachHistory` lists past sessions with resume/review. Coach AI calls are tier-aware (`resolveModels(req.userTier, "coach")`) and cap-metered (`requireEntitlement("coach")` / `requireGuidedCoaching`). **The old `coach.js` save-to-bank, `article_text`/`questions_json` columns, and the exchange-1-probe/exchange-4-reveal Socratic schema no longer exist.**
**Phase 15**: spaced repetition — SM-2-style bucketed scheduling. `sr_cards` table tracks per-user per-question state (bucket 0–4, due_at, last_seen_at, total_attempts, total_correct). Bucket intervals: [1, 3, 7, 14, 30] days. Rules: first correct → no card; first wrong → card due tomorrow; subsequent answers → bucket advances (correct) or resets to 0 (wrong). `server/sr.js` exports `updateCard`, `getDueCards`, `getDueCount`, `getStats`. `server/routes/sr.js` exposes `GET /api/sr/queue` (dueCount + ordered questionIds) and `GET /api/sr/stats` (totalCards, dueNow, graduated, avgBucket). Both `attempts.js` and `evaluate.js` call `updateCard` on every non-skipped attempt. Review sessions: `session_type='review'` column (default `'practice'`) in sessions table; `GET /api/questions/next` branches into SR mode for review sessions — serves due cards ordered by due_at ASC, ends early if queue is empty. SessionSetup has a "Session type" selector (Practice / Spaced Repetition Review) with live due-count label; selecting Review auto-fills question count. Practice page shows an amber "🔁 Spaced repetition review" banner for review sessions. Dashboard practice tab shows SR widget (total cards, due now, graduated, progress bar, "Review N cards →" CTA) when the user has at least one SR card.
**Phase 16**: streaks & daily goals — **built, then later removed** (confirmed 2026-07: no `server/routes/streak.js`, no `/api/streak` route, no `client/src/components/StreakWidget.jsx` exist in the current codebase). Only stray leftovers remain: the orphaned `users.daily_goal` column (harmless, unused), the "keep your streak alive" subtitle copy on the Login page, and the `APP_VERSION = "streak-navguard-1"` marker in `server/index.js`. Treat any future mention of streak UI as needing to be rebuilt from scratch, not resumed.
**Post-Phase-16 additional features** (committed on top of Phase 16):
- ~~**Coach save-to-bank**: `POST /api/coach/sessions/:id/save-to-bank`~~ — **REMOVED in the 2026-07 restructure and no longer exists** (verified 2026-07-20: the route 404s and there are zero `source='coach'` rows). This bullet described the pre-restructure Coach; see the Phase 14 section above, which correctly states it was dropped. Kept here struck-through so the contradiction isn't reintroduced.
- **Voice input in Socratic debrief**: `useVoiceInput` hook integrated into `CoachPractice.jsx` chat input; `VoiceMicButton` beside the chat textarea; live interim preview overlay; voice stops on `nextQuestion()`.
- **Option lock-in**: In Analysis mode, options are disabled (`disabled={... || selected !== null}`) once the user clicks one — prevents accidental re-selection.
- **Question navigator + history review**: `QuestionNavBar` component (colored circles) above the question. Flagged slots shown with amber ring (🚩 button). `HistoryView` component lets user jump back to any completed question (read-only with full feedback). History is pushed on skip and answer. `questionHistory`, `historyViewIdx`, `flaggedSlots` state in `Practice.jsx`.
- **Batch AI evaluation**: `POST /api/sessions/:id/batch-evaluate` sends a single Claude call with all N pending reasonings in one prompt returning a JSON array. Fallback to parallel per-question calls if parse fails.
- **Email verification + forgot password**: Full OTP flow via Resend. `otp_tokens` table. Register → `/verify-email` (6-box OTP). Login blocked for unverified users. `POST /forgot-password` + `POST /reset-password`. Dev mode logs OTP to console when no `RESEND_API_KEY`. Existing users grandfathered as verified (`email_verified DEFAULT 1`). `server/email.js` + new pages: `VerifyEmail.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`.
- **PostgreSQL migration**: Database layer fully migrated from SQLite/better-sqlite3 to PostgreSQL (`pg` Pool). `server/db.js` provides async `db.get/all/run/exec/transaction` wrappers. All 14 server files converted: `?` → `$1/$2`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, `AUTOINCREMENT` → `SERIAL`, `LIKE` → `ILIKE`, `CURRENT_TIMESTAMP` → `NOW()`. `DATABASE_URL` env var required; Railway Postgres in production.

Since this section was written, a large amount of additional work has landed — see the sections below (Legal & Compliance, Security Hardening, SEO, Analytics/Monitoring, Performance & Infrastructure, Cloudflare, Product/UX & AI Providers, UI/UX Audit Pass, and Monetization) for the full 2026-07 picture. Results/Dashboard/Profile have since been re-skinned (Profile rewritten to read-only + Edit toggle; Dashboard/Results got a full UI-redesign pass) — the "legacy styling" note below is stale. Remaining real gaps: Razorpay KYC + going live with `ENABLE_TIERS`, email sending-subdomain (SPF/DKIM/DMARC), load/pen testing (needs a staging environment), Search Console/Bing sitemap submission — see `ROADMAP.md` for the original phase framing, though it now undersells how much of "monetize + launch" is actually built.

**Post-Phase-16 UX fixes** (applied on top of Phase 16):
- **Skip button**: added separate `isSkipping` state in `Practice.jsx` so the submit button no longer shows "Analyzing…" during a skip. Skip button now shows "Skipping…" while in progress.
- **Reasoning optional**: `Practice.jsx` now sends `submitBasicAttempt` when reasoning textarea is empty (no AI call, instant ✓/✗ only). Submit button shows "Submit (No AI Feedback)" when empty. `evaluate.js` server validation removed for empty reasoning. Reasoning label updated to "(optional)".
- **Coach article limits**: `CoachLanding.jsx` now accepts any non-empty article up to 500 words (was 300–1200 words). Word-count UI updated accordingly.
- **ErrorBoundary**: `client/src/components/ErrorBoundary.jsx` added and wraps the main `<Routes>` in `App.jsx`. Catches render crashes that previously caused blank screens; shows a friendly "Reload page" fallback.
- **Dashboard null guards**: `AccuracyByTypeChart`, `TrapWeakness`, `TopicAccuracy`, and `WeakestArea` all have `|| {}` null guards so they never crash if `byType`/`byTopic`/`byTrapType` are undefined.
- **Admin coach visibility**: `GET /api/admin/users/:id` now includes a `coachStats` object (total + 5 most recent coach sessions). `AdminUserDetail.jsx` renders a "Reading Coach sessions" table alongside the practice sessions table.
- **SR disabled UX**: The "Spaced Repetition Review" option in SessionSetup now shows an explanatory message ("Get questions wrong in practice to build your SR queue") when `dueCount === 0`.

- **Timer freezes on option selection** (analysis mode, per-question timers): `selectionTimeRef` records the moment the first option is clicked. `timerInfo()` uses this frozen time for the per-question display. Per-question countdown auto-skip is also disabled once an option is selected, so users can't be force-skipped while writing reasoning.
- **Badges hidden during active sessions**: `TypeBadge` (question type) and `TopicBadge` (topic) are now hidden while a question is being answered in both Practice and Coach modes. They appear in the feedback/verdict phase so the answer is revealed contextually without giving away the question type as a hint.
- **"View answer" toggle in MyQuestionEditor**: Options section has a "Show answer / Hide answer" link. When hidden (default), correct/trap radio buttons and source lines are not shown — lets users self-test their own questions. When revealed, the full editing controls appear.
- **Question count slider**: The preset pill buttons (5/10/15/20/25) in Session Setup replaced with a smooth range slider (1–25). Number shown live beside the slider. Switching to Review mode auto-sets the slider to `dueCount`; switching back to Practice resets to 10.
- **CoachPractice type badge**: Also hidden until verdict is revealed (same logic as Practice).

**Post-16 bug fixes & UX batch (2026-06)** (13-item batch — see ROADMAP.md for full list):
- **pg aggregate type fix**: `db.js` sets `types.setTypeParser(20)` (int8) and `types.setTypeParser(1700)` (numeric) so `COUNT`/`SUM`/`AVG` aggregates come back as JS numbers — fixes all "n is not a function" / `avgReasoningScore.toFixed` crashes app-wide.
- **Dashboard cache invalidation**: `dashboard.js` exports `clearCache(userId)`; called by `attempts.js` and `evaluate.js` after every attempt insert, so the dashboard never shows stale "0 attempts" after a session.
- **Practice interaction rewrite (items 1, 2, 9, 10)**:
  - **Prefetch all questions**: `sessions` table gains `question_ids TEXT` column (populated at session creation); `GET /api/sessions/:id/questions` returns all N sanitised questions. `Practice.jsx` fetches them once at boot — no more per-question `/next` round-trips.
  - **Per-question state array** (`questionStates[]`): replaces single `selected`/`feedback` state. Each entry tracks `tentativeSelected`, `locked`, `lockedSelected`, `lockTime`, `reasoning`, `quotes`, `feedback`, `skipped`.
  - **Two-step lock flow**: clicking an option is *tentative* (reversible); "Submit Answer →" button locks it, freezes the per-question timer, then reveals the reasoning textarea + quote popover.
  - **Free navigation**: `QuestionNavBar` all slots are clickable; navigation blocked only while `locked && !feedback` (shows a brief warning message).
  - **Timer frozen at lock time** (not at feedback arrival): `cs.lockTime` is used in `timerInfo()`.
  - **End-session confirm modal** (`EndSessionModal`): shown when all questions answered or on the last question's "End Session".
  - **HistoryView removed**: navigating to a past question just renders the normal view with `cs.feedback` set (read-only because options are disabled).
- **Flag modal (item 4)**: 🚩 button opens a `FlagModal` with predefined reason radios (Wrong answer key / Ambiguous / Typo / Poor quality) + optional note. Submits to `POST /api/questions/:id/flag`. No amber ring on nav slots. `AdminFlags.jsx` shows human-readable reason labels and has "Approve (remove)" button that calls `resolution='deleted'` (soft-deletes question from bank).
- **Dashboard cache invalidation** (item 5): `clearCache` called from both attempt routes — dashboard/profile no longer shows stale 0 after a session.
- **Voice retry reset** (item 3): `retryCount.current` reset after each successful final transcript and on clean `onend`; threshold raised to 5; on network error, recognizer restarts immediately.
- **Coach → VARC Coach rename** (item 7): `CoachLanding`, `CoachPractice`, `Dashboard` tab all updated to "VARC Coach". Max words 500→600. User sends reasoning *first* (static tutor opener, no AI call on answer-select).
- **Coach session persistence + History** (item 8): `coachSession.js` localStorage helper persists active session ID. `CoachPractice.jsx` saves on mount, clears on completion. `CoachHistory.jsx` page lists all past sessions with Resume/Review links. Leave-confirmation modal when debrief is active. (A `beforeunload` handler was documented here but never actually existed until the 2026-07 reliability pass — see below.)
- **SR setup flicker fix** (item 11): module-level `_cachedDueCount` seeds React state on mount; avoids "checking…" flash on every `/setup` visit.
- **Google OAuth username flow** (item 12): new users redirected to `/choose-username` (availability check via `GET /api/auth/username-available`; PATCH endpoint to change). Profile page has inline username edit. `Invalid Date` fixed (no longer appends extra "Z" to ISO timestamp). `updateUser` exposed on `AuthContext`.

**Deferred features** (documented in `ROADMAP.md` "Deferred / Backlog Items" section):
- Coach questions → user question bank admin promotion to global pool
- Google OAuth ("Continue with Google" — email signup stays as primary)
- Mobile OTP verification (SMS via Twilio etc. — deferred, costs money)

**Account reset**: `DELETE /api/account/reset` (auth-gated, `server/routes/account.js`) deletes all sessions and attempts for the user while keeping the account. Frontend: "Reset all data" button on the Profile page opens a confirmation dialog, then shows a toast notification on success. `clearActiveSession()` is called client-side so any in-progress session is cleared. `DELETE /api/account` (same file) permanently deletes the user row and everything cascading from it (sessions, attempts, coach data, SR cards, OTP tokens); rows other users might depend on (`api_calls`, `question_flags`, authored `questions`/`passages`) are anonymised (`user_id`/`author_user_id` → `NULL`) rather than deleted. Frontend: "Delete account" in the TopNav avatar dropdown (`AccountDangerModals.jsx`, shared between the dropdown and Profile page), gated behind typing `DELETE` to confirm.

## Legal & Compliance (2026-07)

Entity: Graspr is operated by Tarun Gupta, an individual (no registered company), based in Bangalore, Karnataka, India. Contact: `privacy@graspr.in` (ImprovMX forwarding on `graspr.in`, DNS on GoDaddy). Governing law / jurisdiction: courts of Bangalore, Karnataka.

- **Privacy Policy & Terms of Service** (`client/src/pages/Privacy.jsx`, `Terms.jsx`, shared layout in `LegalDoc.jsx`) — live at `/privacy` and `/terms`, linked from the Home page footer (previously dead links) and from the Register page checkbox. Content is drafted directly from the actual data model (not a generic template): what's collected, third parties (OpenRouter/underlying AI provider, Resend, Railway, Google OAuth, PostHog, future Razorpay), DPDP data-principal rights, grievance officer contact, AI-output disclaimer, 18+ eligibility.
- **DPDP Act 2023 data rights**: `GET /api/account/export` (`server/routes/account.js`) returns the user's full data (profile minus password hash, sessions, attempts, coach sessions/attempts, SR cards) as a downloadable JSON file — "Export my data" in the TopNav avatar dropdown (`exportAccountData()` in `api.js`, triggers a client-side Blob download). Erasure right is the pre-existing `DELETE /api/account` (see above). Correction right is the existing Profile edit fields.
- **18+ age-gate**: `Register.jsx` has a required checkbox ("I confirm I'm 18+ and agree to the Terms and Privacy Policy") that gates the submit button — not persisted to the DB, purely a UI/ToS gate per the product decision (CAT is a graduate-entrance exam; real userbase is already 18+). Not yet applied to the Google OAuth signup path (`ChooseUsername.jsx`) — flagged as a gap, low priority since OAuth isn't the primary signup path.
- **Cookie/analytics consent banner** (`client/src/components/CookieConsent.jsx` + `client/src/analytics.js`): shown once (bottom banner) until the user Accepts or Declines; decision stored in `localStorage` (`graspr_analytics_consent`). Accept lazily imports and initializes `posthog-js` (`disable_session_recording: true` by default — session replay can be turned on later from the PostHog dashboard with no code change). Nothing analytics-related loads before explicit consent. Auth (JWT in `localStorage`) is treated as essential and needs no banner. "Manage cookie preferences" link on the Privacy page (`resetAnalyticsConsent()`) reopens the banner via a `window` custom event (`graspr:reopen-cookie-banner`). `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` are public, non-secret client env vars (see below).

## Environment Variables

```
OPENROUTER_API_KEY=sk-or-...             # All AI calls go through OpenRouter (server/ai/provider.js), NOT a direct Anthropic key — despite the "AI" section above saying claude-haiku-4-5, the actual provider is OpenRouter's OpenAI-compatible API. Get a key at openrouter.ai/keys.
AI_MODEL=anthropic/claude-haiku-4-5      # Optional override — this is the default if unset. NOTE: as of 2026-07 this var was found set in dev to a free/rate-limited OpenRouter model (openrouter's ":free" suffix models are shared and get 429'd easily) — always double check this isn't accidentally pointed at a free-tier model in any environment.
APP_URL=https://www.graspr.in            # Sent as HTTP-Referer to OpenRouter's dashboard for their per-app rate-limit tiers
PORT=3001
JWT_SECRET=...                           # change in production; rotate before real users depend on the app (see Security Hardening below)
DATABASE_URL=postgresql://...            # Railway Postgres (required — no SQLite fallback)
ADMIN_USERNAMES=tarun,priya              # Phase 9 — comma-separated; auto-promote on startup
ENABLE_AI_AUTHORING=true                 # Phase 10 — set 'false' to disable AI question generation
RESEND_API_KEY=...                       # Email OTP (optional in dev — logs to console if absent)
RESEND_FROM_EMAIL=noreply@yourdomain.com # Sender address for OTP emails
FRONTEND_URL=https://www.graspr.in       # Also used as the CORS allowlist origin (server/index.js) and the OAuth redirect base — keep in sync with the real deployed domain, a stale value here silently breaks both
BACKEND_URL=https://www.graspr.in        # Same origin as FRONTEND_URL in production (one Railway service serves both) — used for the Google OAuth callback URL
GOOGLE_CLIENT_ID=...                     # Google OAuth
GOOGLE_CLIENT_SECRET=...
SENTRY_DSN=...                           # optional — error monitoring, server-side
VITE_SENTRY_DSN=...                      # optional — error monitoring, client-side (safe to expose, DSNs aren't secret)
VITE_POSTHOG_KEY=phc_...                 # optional — client-side analytics, safe to expose (write-only key). Never fires until the user accepts the cookie-consent banner.
VITE_POSTHOG_HOST=https://us.i.posthog.com
# ── Monetization (Phase 6 — tiers + Razorpay) ──
ENABLE_TIERS=false                       # master switch: OFF = no caps + DEFAULT_MODEL everywhere (current behavior). ON = enforce per-tier daily caps + per-tier model routing (server/config/tiers.js). Independent of ENABLE_KILL_SWITCH below.
ENABLE_KILL_SWITCH=false                 # OFF by default even when ENABLE_TIERS=true — the monthly ₹ cost ceilings in tiers.js sit below what the advertised daily caps cost when fully used, so hard-enforcing them could cut off a heavy paying user mid-cycle. Parked as a deliberate decision (server/lib/entitlements.js) — daily caps still enforce regardless of this flag; only the monthly ₹ kill-switch itself is gated. Revisit as a soft-degrade (drop to a cheaper model past the ceiling) rather than a hard block.
USD_TO_INR=95                            # FX for converting api_calls.est_cost_usd → ₹ for the kill-switch.
RAZORPAY_KEY_ID=rzp_...                  # unset → billing runs in dev mode (no real orders; POST /api/billing/dev-activate grants tiers, non-prod only).
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...              # HMAC secret for verifying the /api/billing/webhook signature (set the same value in the Razorpay dashboard webhook config).
```

In production, the frontend uses `VITE_API_URL` to point at the deployed backend instead of the dev proxy.

## Security Hardening (2026-07 pass)

A security/production-readiness pass landed on top of Post-16 fixes, covering most of the "Security & Hardening" checklist (rate limiting, input validation, secret handling, password hashing, auth error messages, account lockout, backend auth enforcement, security headers/CORS, dependency scanning). Not a full app rewrite — additive middleware + a handful of targeted route changes.

**What's live:**
- `helmet()` (CSP explicitly left off — the single Railway service also serves the built React static assets, and a default CSP needs real tuning against that before enabling; the other helmet defaults like X-Frame-Options are on).
- CORS allowlist (`server/index.js`) replacing the previous wide-open `cors()` — origin restricted to `FRONTEND_URL` + `localhost:5173`.
- `express.json({ limit: "100kb" })` — the global error handler (`server/index.js`) was fixed alongside this to actually respect `err.status` (it previously flattened every error, including a legit 413 from this limit, to 500).
- Rate limiting (`server/lib/rateLimiters.js`) — "Balanced" profile: global 100/min/IP, auth routes (login/register/forgot-password/reset-password) 10/min/IP, AI routes (evaluate, coach reading-map/attempts/exchange, my-questions generate-draft, sessions batch-evaluate) 20/min per authenticated user.
  - **Tier-aware AI limiter (done 2026-07-21)**: the AI limiter's per-minute ceiling now comes from `aiRateLimitPerMin` in `server/config/tiers.js`, read off `req.userTier` (free 20 · inference 30 · ninetyninth 45 · topper 60; admins get the highest). Free stays at the historical flat 20, so no existing user got a worse limit. Unknown/missing tier falls back to the free value — the safe direction. This is **burst/abuse protection only**, deliberately separate from the daily/monthly caps in `entitlements.js`, which are the monetization lever; every tier's value sits far above human pace (a reasoning takes ~30s to write), so it only ever catches a script. Not gated on `ENABLE_TIERS` — nobody holds a paid tier while the flag is off, so behaviour is unchanged today and correct the moment it flips.
    - **Ordering requirement**: `req.userTier` is set by `attachTier`/`requireEntitlement`/`requireGuidedCoaching`, so a tier-resolving middleware **must** run before `aiLimiter` or it silently sees `undefined` and gives everyone the free ceiling. All 7 `aiLimiter` route sites were reordered to `attachTier, aiLimiter, …` (three Coach routes had them backwards; `myQuestions.js`'s `/generate-draft` had no tier middleware at all). `requireEntitlement` deliberately stays **after** the limiter — it runs cap-counting queries, so a flood must be rejected before it can trigger them.
    - `loadTierUser(req)` in `entitlements.js` memoises the user row on `req._tierUser` (and sets `req.userTier`/`req.userRole`), so the now-common `attachTier` → `requireEntitlement` chain doesn't query the same primary key twice.
- Account lockout (`server/lib/loginLockout.js`) — 5 failed attempts / 15 min, keyed by identifier+IP, in-memory (fine for the current single Railway instance; move to Redis/Upstash if it ever runs on more than one instance — same caveat applies to the rate limiters, which also use an in-memory store).
- Registration no longer leaks whether an email is already registered (`server/routes/auth.js` `/register` + `server/email.js` `sendAccountExistsNotice`) — responds identically either way and silently emails the existing account owner instead of telling the requester. Username collisions still return an immediate, specific error deliberately — usernames are already intentionally public/checkable live via `GET /auth/username-available`, so there's no new leak in confirming one's taken.
- bcrypt cost factor bumped 10 → 12 on all three `bcrypt.hashSync` call sites (register, reset-password, change-password). Only affects newly-hashed passwords going forward, not existing hashes.
- JWT expiry shortened 30d → 7d (`server/auth.js`) — done specifically because payments (Razorpay) are on the roadmap; revisit toward a short-lived-token + refresh-token model if 7 days ever proves annoying, but that's real added infrastructure, not a one-line change.
- zod input validation (`server/lib/schemas.js` + `server/lib/validate.js`) on **auth routes and the AI-calling routes** — register/login/verify-email/resend-otp/forgot-password/reset-password/username/name/avatar/profile/password in `auth.js`; evaluate in `evaluate.js`; create-session/reading-map/attempts/exchange in `coach.js`; generate-draft in `myQuestions.js`.
  - **Deliberately NOT covered**: `sessions.js`'s `POST /` (create session) — it already has thorough, order-dependent hand-validation (`parseInt` coercion, `timerMode`-gates-other-fields logic) that a rigid zod schema risked conflicting with; question CRUD (already has its own `validateQuestionPayload` custom validator in `lib/validateQuestion.js`); admin routes; dashboard; flags. Extend incrementally if these become a real target.
- Verified: no `dangerouslySetInnerHTML` anywhere in `client/src`, no string-concatenated SQL anywhere in `server` (everything already uses `pg` parameterized `$1`-style placeholders), no secrets found in a production client build (`grep`'d `client/dist` for key patterns — clean).
- `npm audit fix` (non-breaking) run — went from 20 → 19 vulnerabilities. The remaining 19 (all moderate) are transitively pulled in through `@sentry/node`'s OpenTelemetry auto-instrumentation for DB drivers this app doesn't use (Prisma, MySQL) — fixing them needs `npm audit fix --force`, which risks bumping Sentry to a breaking major version. Left as-is; revisit if `npm audit` ever shows something in a package actually on this app's real dependency path.
- Confirmed (not new — already correct): `requireAdmin` middleware genuinely checks `role` server-side on every admin route, not just hidden client-side — live-tested with a non-admin token against `/api/admin/overview`, `/api/admin/users`, `/api/admin/api-calls` → all correctly 403. No token → 401.

**Not done / explicitly deferred** (see the Security & Hardening checklist in the Obsidian vault's `Operations/Launch & Production Readiness.md` for the full original list and reasoning per item):
- Secrets manager (Doppler/Infisical) — P2, `.env` + rotation is enough at current scale.
- Pen-test pass (OWASP ZAP/Burp) — needs a running staging environment; do this *after* the above, as a final check, not in parallel.
- Managed auth provider swap (Clerk/Supabase/Firebase) — optional, current custom bcrypt+JWT+OTP+OAuth works fine.
- Actually rotating `JWT_SECRET`/`OPENROUTER_API_KEY` on Railway — that's a manual action on the live environment, not something done from this repo.

## SEO & Discoverability (2026-07)

Vite/SPA, not Next.js — no `app/sitemap.ts`. Static files in `client/public/` + a plain `useEffect`-based per-route title/description, not a helmet library (see below for why).

- **`client/public/`**: `robots.txt` (disallows every auth-gated route — `/dashboard`, `/practice`, `/coach`, `/admin`, etc. — and points at the sitemap), `sitemap.xml` (home, pricing, login, register, privacy, terms — `/blog` deliberately excluded until it has real content, still reachable via nav, just not asking Google to index a "coming soon" page), `favicon.ico` (16/32/48px), `favicon.svg`, `apple-touch-icon.png` (180px), `og-image.png` (1200×630, built from the BrandMark recipe in `AuthShell.jsx` — headless-Chrome-screenshotted from a throwaway HTML file, not hand-drawn).
- **Meta title/description per page**: `client/src/components/PageMeta.jsx` — a plain component using `useEffect` to set `document.title` and the `<meta name="description">` tag, restoring the previous value on unmount so client-side route changes don't leak one page's meta into the next. Wired into every public page (Home, Pricing, Login, Register, Blog, Privacy, Terms).
  - **Why not `react-helmet-async`**: tried it first (`HelmetProvider` + `<Helmet>`), fully wired per its docs — it silently never committed anything to `<head>` in this app (traced into its own source: zero `data-rh`-tagged elements ever appeared, meaning its `HelmetDispatcher`/`Context.Consumer` commit path never fired, with or without `React.StrictMode`). Root cause not fully isolated (React 18.3.1 + Vite dev, single React instance confirmed, not a duplicate-package issue) and not worth chasing further for ~7 static page titles — the native `useEffect` approach has no such risk and is fewer moving parts.
- **OG/Twitter tags are static in `client/index.html`**, not set per-route via JS — link-preview crawlers (WhatsApp, LinkedIn, X, iMessage) generally don't execute JavaScript, so tags set client-side would never be seen. One shared OG image/description covers the whole site; revisit per-route OG only if distinct shareable landing pages exist later.
- **Not done yet** (external actions, not code): submitting the sitemap to Google Search Console + Bing Webmaster Tools (needs DNS TXT verification on `graspr.in`, on GoDaddy); running Lighthouse/PageSpeed against the real deployed URL (meaningless against localhost). IndexNow explicitly skipped — Bing/Yandex-only, not worth it at current traffic. Both deferred to post-launch — see `ROADMAP.md` "SEO — post-launch verification steps".

## Analytics, Monitoring & Observability (2026-07)

Sentry (client + server) and PostHog were already wired (see Legal & Compliance and earlier phases); this pass closed the gaps between "installed" and "actually catching things."

- **Sentry now actually captures render crashes**: `client/src/components/ErrorBoundary.jsx`'s `componentDidCatch` previously only did `console.error` — Sentry was initialized but never told about the crash. Now calls `captureException()` (new export in `client/src/sentry.js`, safe no-op if Sentry never loaded — no DSN, still dev, still lazy-loading).
- **Sentry now actually captures server errors**: `server/index.js` was calling `Sentry.init()` but never `Sentry.setupExpressErrorHandler(app)` — without it, errors routes pass to `next(err)` never reached Sentry (only truly uncaught exceptions would have, via automatic instrumentation). Now registered after all routes, before the final error handler.
- **Stopped leaking error internals to the client in production**: the final error handler used to send `err.message` straight to the client for *any* non-413 status, including genuine 500s — a real risk (e.g. a raw Postgres constraint-violation message naming a column). Now: 4xx messages (our own intentional `res.status(4xx)` errors) still show as before; 5xx messages are generic (`"Internal server error"`) when `NODE_ENV=production`, full detail in dev. Full detail always still goes to console + Sentry regardless.
- **`GET /api/health`** (`server/index.js`) — does a real `SELECT 1` DB round-trip, not just a static 200, so a healthy HTTP response can't mask a dead database. Registered before the rate limiter so uptime-monitor pings never count against it and need no auth. Point UptimeRobot or Better Stack Uptime (you already have a Better Stack account for Logtail) at it once deployed.
- **PostHog named funnel events** (`client/src/analytics.js`'s new `track(event, props)` export, no-ops before consent/init like the rest of the module): `signup` (Register.jsx, right after successful registration, before the OTP-verification branch), `session_start` (SessionSetup.jsx, after session creation), `question_answered` (centralized in `api.js`'s `submitBasicAttempt`/`submitEvaluateAttempt` wrappers, gated on `!payload.skipped` so skips don't count), `coach_used` (CoachLanding.jsx, both new-session and resume paths).
  - **`streak_hit` was planned but dropped**: the Streak feature it would have hooked into doesn't exist in the codebase (see Phase 16 note above) — nothing to instrument.
- **Session replay / rage-click detection**: deliberately still off (`disable_session_recording: true`, set when PostHog was first wired) — flip it on from the PostHog dashboard when actually wanted, but add input-masking on the reasoning textarea + Coach chat first so replays never capture what a user typed.

## Performance & Infrastructure (2026-07)

- **DB connection pool**: `server/db.js`'s `pool` was already a genuine app-wide singleton (module-level `const`, Node caches `require`d modules — never one pool per request), just with no `max` set. Now explicit (`max: 10`) so it's a documented decision instead of silently relying on `pg`'s default. Revisit (PgBouncer / Railway pooling, move rate-limit/lockout counters to Redis) only if this ever runs as more than one instance — premature before then.
- **gzip compression**: `app.use(compression())` in `server/index.js`, applied globally (API JSON + the static client build). Verified live — a real endpoint response now carries `Content-Encoding: gzip`.
- **Missing indexes on the actual hot columns**: `sessions.user_id`, `attempts.session_id`, `coach_sessions.user_id`, `coach_attempts.coach_session_id` had zero indexes — every dashboard/session/account-export query was a full table scan. Added in `server/db.js`'s migration block. (`sr_cards` already gets one for free from its `UNIQUE(user_id, question_id)` constraint.) Checked for the N+1-query pattern ("loop that queries the DB per iteration") across all routes — didn't find one; the dashboard aggregation and similar spots already use single `GROUP BY` queries, not per-row loops, so no fix needed there.
- **Optimistic UI on Skip** (`client/src/pages/Practice.jsx`'s `doSkip`): a skip has no correctness data to wait on — unlike answering, where the client genuinely can't know right/wrong ahead of the server's response (the correct answer is intentionally never sent early). Skip now marks the question skipped and advances to the next one immediately, firing the save in the background; rolls back (re-shows the question, shows the error) only if the request actually fails. Verified live both ways: the happy path (server confirms `skipped=1` in the DB) and the rollback path (simulated network failure correctly restored the question and showed the error, no stuck state).
- **CDN in front of the static frontend**: not done — infrastructure/DNS decision (e.g. Cloudflare in front of `graspr.in`), not code. Deferred to whenever it's actually wanted.
- **Load balancing / horizontal scaling**: correctly skipped per the source checklist — premature before one Railway instance actually can't keep up.
- **SSR**: correctly skipped — a full SSR rewrite for a Vite SPA isn't worth it here; the SEO pass (static meta tags, sitemap, OG tags in `index.html`) already covers the actual public-page SEO need.

## Testing, Reliability & Release Engineering (2026-07)

- **CI** (`.github/workflows/ci.yml`): runs on every push to `main` and every PR — installs server + client deps via `npm ci`, `npm audit` on both (server gated at `--audit-level=high`; client gated at `--audit-level=critical` specifically because of the known, accepted Vite dev-server-only high-severity finding — see Security Hardening above), then a full client production build (`vite build`). No test suite exists yet, so nothing to run there. **Branch protection on `main` was deliberately NOT enabled** — the workflow gives visibility on every push, but turning on required-status-checks would block the existing direct-push-to-main workflow this session has used throughout; enable it explicitly if/when that tradeoff is wanted.
- **Expired-token mid-session UX fix**: previously, a 401 on an authenticated request (JWT expired, or the account changed elsewhere) just surfaced a raw error (`"jwt expired"`) wherever the calling component happened to catch it — no clear path back in, and no indication the in-progress Drills/Coach session was still safe. Now: `client/src/api.js`'s `request()` detects a 401 on a request that had a token attached (excluding `/api/auth/login`, `/register`, `/password` — routes where a 401 means something else, like a wrong current password, not a dead token), clears the token, and dispatches a `graspr:session-expired` window event. `AuthProvider` (`auth.jsx`) listens and clears `user` — deliberately does NOT clear `varc_active_session` the way `logout()` does, since this isn't the user choosing to leave. `ProtectedRoute` then redirects to `/login` with `location.state.from` preserved (existing mechanism), and `Login.jsx` shows a reassuring "Your session timed out. Log back in to pick up right where you left off" banner (via a `sessionStorage` flag, read in a `useEffect` — not a `useState` lazy initializer, which double-invokes under React 18 StrictMode in dev and would consume the flag on the throwaway first call). Verified live end-to-end: corrupted token → redirected to `/login` with the banner showing → logged back in → landed back on the exact original path.
- **AI audit of user flows**: run via a background research agent (read-only, no code changes) enumerating unhandled failure paths across auth, Drills, Coach, and account-management flows. Auth flows, account deletion/reset (properly transaction-wrapped), and admin routes all checked out clean. Fixed from its findings:
  - **Practice.jsx's "Retry" button was dead** — after a bootstrap failure (transient network blip loading questions), Retry only reset `error`/`loadingQuestions` state; the fetch effect had already run its once-on-mount course and nothing re-fired, so the user was stuck on "Loading questions…" forever. Bootstrap logic pulled into a `bootstrapSession` callback (with a `bootstrapRunIdRef` counter superseding stale in-flight calls, replacing the old `cancelled`-flag pattern) so both the mount effect and the Retry button can actually re-trigger it.
  - **A session with every question deleted/deactivated rendered a blank page** — `GET /sessions/:id/questions` correctly filters out questions removed after the session started, but if *all* of them were gone, `Practice.jsx` fell through to `if (!question) return null` — no error, no Exit button, just a blank screen. Added an explicit `questions.length === 0` guard with a real error screen and a way back to Session Setup. The same route's index/total numbering was also fixed to renumber *after* filtering (previously left gaps like 1, 3, 4 of "5" whenever one question was dropped).
  - **No timeout on the OpenRouter call** — a hang (not an error — a stall) had only the OpenAI SDK's own ~10-minute default as a backstop; the client showed "Analyzing…"/"Generating…" with no indication anything was wrong. Added an explicit 30s client-level `timeout` in `server/ai/provider.js`; a genuine timeout throws the same way any other AI failure does, so every calling route's existing `catch` block (already logs to `api_calls`, returns `aiError: true`) needed no changes.
  - **Browser back button / tab close bypassed the leave-session guard entirely** — `navGuard.jsx` only intercepts in-app nav clicks that call `attemptNav()`; there was no `beforeunload` handler anywhere in the app (despite one being documented, incorrectly, for Coach — see above). Added to `Practice.jsx` (fires while a session is loaded and not yet ended) and `CoachPractice.jsx` (fires only when there's unsaved text in the reasoning box or Discuss chat input, since the Coach session itself is safely resumable either way).
  - **Coach chat send didn't roll back on failure** — `sendDiscussMessage` in `CoachPractice.jsx` optimistically appended the student's message and cleared the input *before* the request; on failure it only set a generic error, leaving the phantom message bubble on screen forever and losing the typed text. Now reverts `attempts[question.id]` to its pre-optimistic value and restores `discussInput` to the failed message on catch — same rollback shape as the earlier Skip fix.
  - **Not fixed, deliberately**: an orphaned server-side `active` session if the tab dies between `POST /api/sessions` succeeding and the client's `saveActiveSession()` localStorage write — rare, self-heals next visit via `GET /sessions/active`, not worth the added complexity for the exposure.
- **Load/stress testing**: not done — correctly deferred until there's real traffic to protect against; premature for a pre-launch solo app.
- **Email sending subdomain (SPF/DKIM/DMARC)**: not done — `RESEND_FROM_EMAIL` still sends transactional OTP/reset mail from the root `graspr.in` domain rather than a dedicated subdomain (e.g. `send.graspr.in`). Real gap, needs a Resend dashboard change + DNS records — DNS is now on Cloudflare (see below), so this is a Cloudflare DNS record + Resend dashboard change, not GoDaddy.
- **Domain split (app. vs marketing)**: correctly skipped per the source checklist — P2, no marketing site to separate yet, solo operation.

## Infrastructure — Cloudflare (2026-07)

DNS moved from GoDaddy to Cloudflare (free plan) as a CDN/proxy in front of the Railway-hosted app. Nameservers propagated and verified live.

- **SSL/TLS**: mode set to **Full (strict)** (Railway already serves a valid origin cert), **Always Use HTTPS** on. Verified: TLS 1.3, HSTS header present, `server: cloudflare` on responses.
- **Apex domain redirect**: `graspr.in` → `https://www.graspr.in` via a Cloudflare **Redirect Rule** (dynamic, 301, preserves path + query string) — not a Railway custom domain, since Railway's plan only allows one custom domain (already used by `www.graspr.in`) and a bare-apex TLS handshake to Railway was failing (525) without it. The redirect happens at Cloudflare's edge, before the request ever reaches Railway, so this sidesteps that limitation entirely. Verified live: path and query string both survive the redirect.
- **Email preserved**: the ImprovMX MX records (`mx1`/`mx2.improvmx.com`) for `privacy@graspr.in` came across the DNS migration intact and unproxied (DNS-only, as required for MX) — verified via `dig` before and after cutover.
- **GoDaddy's old domain-forwarding setting is now inert** (GoDaddy stopped being the authoritative nameserver) — left in place, harmless, no cleanup needed.

## Product, UX & AI Providers (2026-07)

- **Onboarding checklist** (`client/src/components/OnboardingChecklist.jsx`): shown on Home for logged-in users until both steps are done or dismissed (`localStorage` flag). Steps: finish first Drill (`getDashboard().totalAttempts > 0`), try AI Coach (`coach.stats().totalSessions > 0`) — deliberately no "verify email" step, since login is already blocked for unverified accounts, so anyone who can see this is already verified. Verified live both states: a fresh zero-activity account shows both steps unchecked; dismiss persists and the checklist correctly disappears once both steps are actually done (confirmed against `tester`, who already had both).
- **Loading/type animation polish** (`client/src/components/TypingLoader.jsx`): reuses the same character-reveal technique already used by Home's interactive demo card — plain background, clean font, ~1s type-in then a blinking cursor, nothing else. Wired into the three AI-wait moments that had plain static text before: Drills reasoning analysis, Coach reading-map grading, Coach answer-reasoning check.
- **Admin AI Prompts manager** (`/admin/prompts`, `AdminPrompts.jsx`): the 5 hardcoded `SYSTEM_PROMPT` constants that were spread across `evaluate.js` (1), `coach.js` (3), and `myQuestions.js` (1) are now all admin-editable without a redeploy. New `ai_prompts` table (`key` PK, `content`, `updated_by`, `updated_at`) — a row overrides the hardcoded default in `server/ai/prompts.js`; no row = default. `getPrompt(key)` reads through a small in-process cache (invalidated on every admin save/reset — same in-memory-store caveat as the rate limiters). `my_questions_generate` is the one prompt with a dynamic part (`{{questionType}}`), handled via a minimal `renderPrompt()` token-substitution helper — the other 4 are fully static. Admin UI: one card per prompt, "Default"/"Customized" badge, textarea editor, Save/Reset-to-default/Discard-changes. Verified live end-to-end: full CRUD via the API (save → shows as customized → reset → reverts to the exact original default text), the UI renders and matches the existing `AdminLogs.jsx` styling convention, and — the key integration proof — overriding a prompt and firing a real `/api/attempts/evaluate` call demonstrably changed the model's actual output behavior, confirming `getPrompt()` genuinely feeds live AI calls, not just the admin display.
  - **Incidental finding, not fixed**: while testing, `evaluate.js`'s `JSON.parse(response.text)` occasionally fails when the model wraps its response in markdown fences despite being told not to — `coach.js` already handles this more leniently via an `extractJSON` helper, `evaluate.js` doesn't. Pre-existing, unrelated to the prompts-manager change (reproduced with the default prompt too). Worth a small fix later (strip fences before parsing, matching `coach.js`'s approach) but out of scope for this pass.
- **Multi-provider / cheaper AI tier**: superseded by the Monetization build below — `users.tier` is no longer unread; `server/config/tiers.js` + `resolveModels()` in `provider.js` now route each tier to a different (all still OpenRouter-hosted) model with a fallback chain. Still gated behind `ENABLE_TIERS=false`.
- **Drills-result redesign**: re-checked against the actual current `Results.jsx` (391 lines) — already has a by-question-type accuracy breakdown and a clickable per-question review modal, both built earlier this session. This backlog note appears stale; revisit only if something specific still feels thin.
- **Launch marketing prep**: not code — drafting/outreach work, not started.

## UI/UX Audit Pass (2026-07)

An 11-commit pass fixing broken/blocking issues (P0), scroll/motion/layout fundamentals (P1), and copy/consistency/a11y polish (P2), each with a manual test added to `TESTING.md` (repo root — 21 tests, same conventions as `SECURITY_TESTING.md`).

**P0 — broken/blocking:**
- Responsive `TopNav` — collapses to logo + avatar-chip dropdown (which absorbs Drills/Coach/Dashboard) below 1024px; global `overflow-x: clip` backstop on `body`.
- In-session top bars (Drills timer bar, Coach's bridge bar) fit on one line at 375px; secondary labels ("Question", "Session", "AI COACH") hidden below 640px.
- `client/src/pages/NotFound.jsx` — catch-all 404 for unknown routes (was falling through to blank), correct tab title, "Back home" button.
- AI-feedback retry: an amber "AI feedback unavailable. Your attempt was saved." banner with a **Retry** button (Drills `evaluate.js` path and Coach reading-map grading), re-runs just that call without creating a duplicate `attempts`/`coach_attempts` row.

**P1 — fundamentals:**
- Scroll-to-top on route change (doesn't hijack `#hash` anchors).
- **`client/src/components/Modal.jsx`** — shared modal shell now used by every modal in the app (session-setup confirm, Practice end/leave/flag, share-results, `AccountDangerModals.jsx`, change password, question-review, Coach leave): backdrop fade-in (respects `prefers-reduced-motion`), real focus trap + restoration on unmount, Esc-to-close, `closeOnBackdrop` prop (dismissible modals close on backdrop click; leave/end guards pass `closeOnBackdrop={false}` so they require an explicit button choice). Callers own the panel as `children`.
- Coach's passage panel no longer pins itself over the question on mobile (still sticky at ≥1024px); Discuss chat auto-scroll is scoped to its own box, not the whole page; the text-selection toolbar (Highlight/Underline/Note/Quote) clamps inside the viewport at both edges; Session Setup's mode/timer descriptions show as always-visible text instead of hover-only tooltips.
- Unified Dashboard skeleton (one shimmer style, no width jump between loading and loaded); hover effects (button sheen, `.fx-underline`) now animate `transform` instead of `left`/`width`.

**P2 — copy, consistency, a11y:**
- Removed stale "streak" copy (Login subtitle), aligned footer product list to the live nav, de-ambiguated a few labels, fixed double-period bugs in Drills feedback strings.
- `/pricing` no longer lists shipped-nowhere features (spaced-repetition review queue, streaks) — see the Monetization section below for what actually replaced this page's content shortly after.
- Dashboard heatmap opens scrolled to the current month, not January.
- Profile "Joined" date uses an unambiguous "12 Jul 2026" format.
- Intuition-mode Results shows a points/score stat card (was previously invisible on the results screen despite being tracked).
- Form-label accessibility (real `<label>`s on Login/Register, `aria-pressed` on Intuition's eliminate-option buttons); wide admin tables (`/admin/logs`, `/admin/costs`) scroll horizontally within their card instead of overflowing the page.

> [!note] This pass had no CLAUDE.md entry until this backfill — reconstructed from `git log` + `TESTING.md`, not a live session transcript. If anything here reads imprecise, the actual commits (`2123200`…`f0f273c`) and diffs are the source of truth.

## Monetization (Phase 6 — 2026-07, substantially built)

Tiers, entitlements, tier-aware AI model routing, and Razorpay payments — all gated behind `ENABLE_TIERS=false` (see Environment Variables above), so **nothing changes for current users until the flag flips on**.

- **`server/config/tiers.js`** — single source of truth. 4 tiers reusing existing `users.tier` values (`free` = "Skimmer" display name, no data migration needed). Each tier has a daily cap (`{ drills, coach }` — AI reasonings/day, Coach passages/day), a primary + fallback model pair per call type, a `monthlyCostCeilingInr`, and a `features` list mirroring the pricing page. As set 2026-07:

  Caps are now split into **daily** (`caps`) and **monthly** (`monthlyCaps`) pools: a tier enforces its daily cap when set, otherwise its monthly cap. Free/Inference meter **daily**; the two top tiers meter **monthly** (a larger pool so a heavy study day isn't throttled). Values as set 2026-07 (units: AI reasonings for drills · Coach passages for coach):

  | key | display | ₹/mo | drills cap | coach cap | primary model | fallback | ₹ ceiling/mo |
  |---|---|---|---|---|---|---|---|
  | `free` | Skimmer | 0 | 10/day | 1/day | `openai/gpt-oss-120b` | Gemma 4 26B | 30 |
  | `inference` | Inference | 99 | 25/day | 4/day | `openai/gpt-4o-mini` | Gemma 4 31B | 45 |
  | `ninetyninth` | 99th Percentile | 299 | 1400/mo | 200/mo | `z-ai/glm-4.6` | DeepSeek V3.1 | 130 |
  | `topper` | Topper | 699 | 3000/mo | 500/mo | `anthropic/claude-haiku-4.5` | GLM 4.6 | 300 |

  Billing periods actually implemented are **`monthly` and `cat` ("Till CAT")** only — there is no `annual` period anywhere in `billing.js`/`tiers.js`, and passing `period=annual` is silently treated as `monthly`.

  **Two CAT seasons sell side by side (2026-07-21).** `server/lib/season.js` now holds a `SEASONS` map keyed by year, each with its own end date, upfront discount, and price-revision granularity: **CAT 2026** ends 1 Dec 2026, 10% off, revises every 15 days; **CAT 2027** ends 1 Dec 2027, 20% off, revises every 30 days (2028 is configured but not on sale — `MAX_SEASONS_ON_SALE = 2` caps the offer at the two nearest, so it rolls forward automatically). The end date is a fixed **1 December**, not the exam Sunday, so it's unambiguous to state; `MIN_SELLABLE_DAYS = 30` stops a season selling once it's nearly over. `seasonPrice(monthlyInr, season)` returns `{ months, listTotalInr, totalInr, perMonthInr, discountPct, savingsInr }` — **all money math lives server-side**. `GET /api/billing/plans` now returns a `seasons[]` array where each season carries a per-tier `prices` map (the old single `season` field is kept for back-compat); `/quote`, `/create-order`, and `/dev-activate` all accept a `seasonYear`, resolved through `resolveSeason()`, which **honours an explicit year only if that season is currently on sale** — a forged or stale year falls back to the default rather than buying a closed season. The Pricing page's period state is now `"monthly" | "cat:<year>"`, and it renders **per-month price as the headline with "₹X billed once" + struck-through list price underneath**; it no longer computes `priceInr × months` itself, which would have silently drifted from the real charge once discounts existed. (An earlier plan for "annual = 12 months at 10× monthly" was superseded by the Till-CAT season model; corrected 2026-07-20 after QA found the doc described a non-existent path.) A recurring monthly-autopay path and "Till CAT" season plans exist (see Monetization above). `SAFE_MODEL` (`anthropic/claude-haiku-4-5`) is the final fallback every tier's chain lands on if a configured model ID is wrong — degrades gracefully instead of breaking the call. Model IDs are OpenRouter format; the file has a standing warning to **verify each against openrouter.ai/models before flipping `ENABLE_TIERS` on** (Gemma 4 / GLM 4.6 IDs are best-guesses).
  **Why these models:** the task (grade a paragraph of reasoning → 5-field JSON) caps output naturally, so *thinking* models (DeepSeek R1, Kimi K2 Thinking, o4-mini, Gemini 2.5 Pro, GPT-5) are a cost trap — they emit thousands of hidden reasoning tokens billed as output (R1-0528 averages ~23K on a hard question), making a $1.74/M-output thinking model cost *more per call* than Haiku at $5/M. Prefer non-thinking models (or thinking mode off) everywhere. Full cost analysis — token estimates from the real prompts, per-user cost by usage profile, and the caps rationale — lives in the Obsidian vault: `AI & Content/Tier Pricing & Model Economics.md`.
- **`server/lib/entitlements.js`** — `effectiveTierKey(user)` resolves a user's real tier (an expired paid tier collapses to free, via `users.tier_expires_at`). `countTodayDrills`/`countTodayCoach` meter usage: one AI reasoning eval (`api_calls` row on `/api/attempts/evaluate`) = one drills unit; one Coach passage (`coach_sessions` row created) = one coach unit — both counted from IST day-start (`date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')`), not UTC. `requireEntitlement`/`attachTier` middleware enforce daily caps when `ENABLE_TIERS=true`; **fails open** (a bug in the entitlement check never blocks a legitimate request). The monthly ₹ kill-switch (reads real spend from `api_calls.est_cost_usd × USD_TO_INR`) is gated by a *second*, independently-off flag, `ENABLE_KILL_SWITCH` — deliberately not tied to `ENABLE_TIERS`, since the configured ceilings sit below what the advertised daily caps cost when fully used, so hard-enforcing them today could cut off a paying user mid-cycle. Parked as a "revisit as soft-degrade, not a hard block" decision. Deferred (`feedback_mode='deferred'`) Drills submits don't consume a cap (no AI call happens until batch-evaluate).
- **`resolveModels(tierKey, callType)`** in `server/ai/provider.js` — builds the `[primary, fallback, SAFE_MODEL]` chain per tier/call-type; `callModel()` now returns which model was actually used, so `api_calls` logs real per-user model routing. `evaluate.js` and `coach.js` are wired to both the cap checks and the tier-aware model chain.
- **`server/routes/billing.js`** — `GET /plans` (public, tier list for the pricing page), `GET /me` (current tier key + display name, price, caps, expiry, `isPaid`, plus a `usage: { drills, coach }` object — `null` while `ENABLE_TIERS=false`, otherwise today's counts via `countTodayDrills`/`countTodayCoach`), `GET /payments` (the caller's captured purchase history, newest first), `POST /create-order` (Razorpay order; `period` ∈ `monthly` | `cat` — **not** `annual`, which is unimplemented and silently falls back to monthly), `POST /verify` (HMAC-verifies the Razorpay Checkout success payload for instant activation, alongside the webhook as a backstop), `POST /webhook` (signature-verified via `RAZORPAY_WEBHOOK_SECRET`, `server/index.js` captures the raw request body specifically for this HMAC check), `POST /dev-activate` (auth-gated, **non-prod only** — grants a tier without a real Razorpay order, for testing pre-KYC; note this bypasses the `payments` table entirely, so it won't show up in purchase history — insert a `payments` row directly to test that path).
- **Recurring subscriptions + "Till CAT" plans (added after the initial one-time-order build)** — `server/lib/subscriptions.js` implements the Razorpay **autopay** counterpart to the one-time Orders flow: a Razorpay *Plan* per tier/price (cached in the `razorpay_plans` table) → a per-customer *Subscription* (UPI-Autopay/card mandate registered at Checkout) → `subscription.charged` webhooks extend `users.tier_expires_at` a month each cycle; cancellation is cancel-at-cycle-end by default (admin force-cancel is immediate). State tracked in the `subscriptions` table. `server/lib/grants.js` (`grantTier`, plus a fixed-expiry granter) is now **the only writer of `users.tier`/`tier_expires_at`**, shared by one-time orders, subscriptions, and admin manual grants. `server/lib/season.js` powers **"Till CAT"** plans — a one-time purchase that expires on the CAT exam date (last Sunday of November, IST) instead of N months out, with price auto-computed from time-to-exam (15-day granularity, shrinking as the exam nears) and a ~30-day pre-exam rollover to next year's season. `payments.period` (`monthly`/`annual`/`till_cat`) and `payments.season_year` record which plan shape was bought.
- **`payments` table** (`server/db.js`) — `user_id`, `tier`, `months`, `period`, `season_year`, `amount_inr`, `provider` (default `'razorpay'`), `razorpay_order_id` (unique), `razorpay_payment_id`, `status` (`created`→`captured`), `captured_at`. Order-to-capture audit trail, indexed on `user_id`.
- **Frontend**: `Pricing.jsx` rewritten to be data-driven from `GET /api/billing/plans` (was static copy), **monthly / "Till CAT" toggle** (`period` state is `"monthly" | "cat"`, `Pricing.jsx:54` — not monthly/annual), "Subscribe" launches Razorpay Checkout with client-side payment verification against `/verify`; in dev mode (no Razorpay keys) it simulates activation instead. New `client/src/pages/Refunds.jsx` — refund & cancellation policy (KYC-required framing, one-time N-month purchase terms), linked from the footer and Pricing. New `client/src/components/UpgradePrompt.jsx` — app-level modal that reacts to a `graspr:limit-reached` custom event (dispatched on a 402 from the API), links to `/pricing`; mounted once in `App.jsx`. Admin: `PATCH /api/admin/users/:id/tier` + a plan card in `AdminUserDetail.jsx` to grant/extend/revoke a user's tier by hand, and the user-detail view now shows tier + expiry.
- **"My Plan" self-serve page** (`client/src/pages/MyPlan.jsx`, route `/my-plan`, linked from the TopNav avatar dropdown right below Profile): current tier + price + expiry, an Upgrade CTA on the free tier, today's usage bars (drills/coach, only rendered once `GET /billing/me`'s `usage` is non-null), and a purchase-history list from `GET /billing/payments` with a **Receipt** button per row. **Why no Razorpay-hosted invoice**: researched Razorpay's Invoices API — it's a separate send-first product (create an invoice → customer pays against it) built for a different billing model than this app's Orders+Checkout one-time-purchase flow; an Orders-flow payment has no Razorpay-hosted invoice PDF to link to. Receipts are instead generated entirely client-side (`openReceipt()` in `MyPlan.jsx`) — a self-contained HTML document opened in a new tab and immediately `window.print()`'d (Save-as-PDF from the print dialog), built from data already in the `payments` row (no extra API call, no Razorpay dependency). Verified live end-to-end: seeded a `payments` row directly (dev-activate doesn't touch this table, see above), confirmed the plan card, usage bars, and purchase-history row render real data, and confirmed the receipt HTML template resolves every field correctly (date formatting, billed-to fallback when `name` is unset, order/payment IDs, amount).
- **Verified in dev** (per the commit history, not re-verified in this documentation pass): migrations apply cleanly, `/plans`/`/me`/`/create-order`/`/dev-activate` all work, granting a tier sets expiry + caps correctly, cap-check math is correct with the flag on, Pricing renders real prices from server config, dev-mode subscribe activates and persists, Refunds page renders, no console errors.
- **Not yet done**: Razorpay KYC (real payments blocked until then — dev-mode bypass exists for testing), real load-testing of the payment flow's failure paths (declined, timeout, webhook-lost, double-submit, refund, upgrade/downgrade proration), verifying the OpenRouter model IDs in `tiers.js` resolve (Gemma 4 / GLM 4.6 are best-guesses; wrong IDs fall back to `SAFE_MODEL`), and final confirmation of the ₹ price points (set at ₹0/100/300/700 but not locked) — all before flipping `ENABLE_TIERS` on in production.

## Payment Security Pass + Admin Payments Panel (2026-07-23)

A dedicated security audit of the whole money path ("no one should be able to get a plan without paying, or by paying less"), plus the admin visibility that was missing. All findings below were **found and fixed in this pass** and each fix was verified live against the dev DB — see the verification notes inline.

**Fixed — could have handed out free/underpaid plans:**
- **`dev-activate` failed OPEN on `NODE_ENV`.** The dev-billing guard was `NODE_ENV === "production"`, so an unset, misspelled, or dropped `NODE_ENV` (a Railway config change away) made `IS_PROD` false and let **any logged-in user** `POST /api/billing/dev-activate` and grant themselves Topper for free. Replaced with a **positive allowlist** (`!["development","test"].includes(NODE_ENV)`) — anything unrecognised, including `undefined`, is now treated as production. Verified: a `NODE_ENV=staging` server returns `403 Not available in production` on dev-activate while `create-order`/`create-subscription` correctly go to real Razorpay.
- **Double-grant race between `/verify` and the webhook.** Both did `SELECT status → if not captured → UPDATE → grant`. Fired concurrently (Checkout's callback and the webhook arrive at the same moment) both reads saw `created`, both passed, and one payment bought **two** months. Now a single `UPDATE … WHERE id=$1 AND status <> 'captured'` arbitrates: only the caller whose `rowCount === 1` grants (`captureAndGrant()` in `billing.js`). The same read-modify-write existed in `subscriptions.js`'s `applyCharge` (guarded by an in-JS `last_charge_id` check against a stale row) — now a conditional claim UPDATE too. **Verified: 5 concurrent full-amount webhooks for one order produced exactly 1 grant** (expiry moved +1 month, not +5; one log line, not five).
- **Nothing checked the amount.** Neither path compared what Razorpay actually captured against `payments.amount_inr`, so a partial payment bought a full plan. `captureAndGrant` now refuses when the reported amount is below the order total or the currency isn't INR, leaving the row uncaptured and logging loudly. Deliberately distinguishes *absent* amount (no evidence → allow, `/verify` and later events are the backstop) from *present-but-insufficient* (refuse). **Verified both branches**: a 100-paise webhook against a ₹699 order left the row `created` with no tier granted; the same event with no amount field captured normally.
- **`/verify` never asked Razorpay anything.** A valid Checkout signature is also produced for a merely *authorized* payment, so with auto-capture off a tier would be granted for money that never settled. Now fetches the payment server-side (`payments.fetch`) and requires `status === 'captured'` + matching `order_id` before granting; a lookup failure degrades to the previous signature-only behaviour rather than stranding a real buyer (409 `not_captured` otherwise).

**Fixed — hardening:**
- **No `trust proxy`.** Behind Cloudflare→Railway every request carried the proxy's `req.ip`, which silently collapsed the 10/min auth limiter, the global limiter, and login lockout into one shared bucket for the entire internet. Set to `1` (not `true`, which trusts the whole `X-Forwarded-For` chain and lets a client forge its own IP to rotate around the limiter).
- **The Razorpay webhook sat behind the 100/min-per-IP global limiter** — a 429'd retry means a user paid and never got their plan, the worst failure mode here, for no security gain (the endpoint is HMAC-gated). Now `skip`ped. Verified: 130 rapid webhook POSTs, zero 429s.
- **New `billingLimiter`** (10/min/user) on every billing mutation — unbounded `create-order` was both a Razorpay-API and junk-row problem, and the `/verify` endpoints were an unlimited HMAC oracle.
- **Non-string signatures 500'd.** `Buffer.from({})` threw inside `timingSafeEqual`; all three signature checks now go through one `signatureMatches()` helper that type- and length-checks first. Verified: `{"razorpay_signature":{"a":1}}` → 400, not 500.

**Reviewed and found already correct** (no change needed): pricing is entirely server-authoritative (`season.js`/`quoteFor` — the client cannot influence the charged amount, and `resolveSeason` refuses a season that isn't currently on sale); `/verify` already scoped the order lookup to `req.userId`; all SQL is parameterized; the admin tier grant is bounded (1–36 months) and admin-gated.

**Still open (not code — flagged, not fixed):**
- **`RAZORPAY_WEBHOOK_SECRET` is unset**, so `POST /api/billing/webhook` returns 503 for everything and the client-side `/verify` call is currently the *only* grant path. Set it (and the matching value in the Razorpay dashboard) before going live, or a user who closes the tab after paying gets nothing.

**Admin Payments panel** — `/admin/payments` (`client/src/pages/admin/AdminPayments.jsx`, sidebar "Payments"), backed by `GET /api/admin/payments` (paginated, filterable by search/status/provider/tier) and `GET /api/admin/subscriptions`. Two tabs: **Payments** (every row across all users) and **Subscriptions** (recurring-mandate state, which the payments log can't show — a `halted` mandate is a user quietly about to lose access). Headline stats: all-time and this-month revenue, paying users, abandoned checkouts, plus a live count of who holds which plan.
- **Shows `created` (abandoned) rows too**, unlike the user-facing `/api/billing/payments` — a cluster of never-captured rows on one account is exactly the signature of someone probing the payment flow, and hiding it would hide the attack.
- **Manual admin grants are now audited.** `PATCH /api/admin/users/:id/tier` writes a `provider='manual'`, ₹0, `period='manual'` row attributed to the acting admin via the new `payments.granted_by` column, so *every* plan a user holds traces to either a real payment or a named person. Excluded from revenue totals (counted separately as "manual grants"). Verified end-to-end: granting 2 months showed up as `qa_admin · Inference · 2 mo · ₹0 · by claude_uitest` with revenue unchanged.
- **`payments.granted_by`** added via `ensureColumn`, plus an `idx_payments_created_at DESC` index for the log's sort.

**Users table now shows Plan** — `GET /api/admin/users` returns `tier`/`tierExpiresAt` and `AdminUsers.jsx` renders a Plan column with the expiry underneath. It applies the same expired-collapses-to-free rule as `effectiveTierKey`, so an admin never sees "Topper" for someone the server downgraded weeks ago.
