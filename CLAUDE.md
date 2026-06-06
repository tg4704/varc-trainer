# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

VARC Option Differentiation Trainer — a web app for CAT aspirants to practice distinguishing correct RC answers from trap options. Each question is anchored to a short paragraph (~90–120 words, not a full passage). The user picks an answer, explains their reasoning, and receives AI feedback evaluating the quality of their thinking.

The original phased build spec is in [`varc_trainer_build_prompt.md`](varc_trainer_build_prompt.md). The forward roadmap (Phases 8+) lives in [`ROADMAP.md`](ROADMAP.md); the user-facing feature list lives in [`USER_FEATURES.md`](USER_FEATURES.md). The AI Reading Coach sub-plan (becomes Phase 14) is in [`ai_reading_coach_plan.md`](ai_reading_coach_plan.md).

## Tech Stack

- **Frontend**: React (Vite) + Tailwind CSS + React Router v6 — lives in `client/`
- **UI system** (Phase 8.5): shadcn/ui-style primitives in `client/src/components/ui/`, built on Radix Slot + `class-variance-authority` + `tailwind-merge`. Design tokens via CSS variables in `client/src/index.css` (light + dark). Icons from `lucide-react`. UI font Inter, reading font Lora.
- **Backend**: Node.js + Express — lives in `server/`
- **Database**: SQLite via `better-sqlite3` (file `varc.db` at repo root, gitignored)
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
├── db.js                   ← SQLite init, lightweight migrations, seed bootstrap
├── auth.js                 ← signToken() + authenticate middleware (JWT)
├── questionsRepo.js        ← shared DB accessor for questions (Phase 8)
├── data/questions.js       ← 25 seed questions (SEED SOURCE only; read at first-run seed,
│                              never at request time — see Phase 8 below)
└── routes/
    ├── auth.js             ← register / login / me / password
    ├── sessions.js         ← create/list/active/get/complete (all auth-gated)
    ├── questions.js        ← GET /next (auth + session-ownership + quota)
    ├── attempts.js         ← POST /basic (answer or skip)
    ├── evaluate.js         ← POST /evaluate (AI reasoning eval, Phase 4)
    ├── dashboard.js        ← user-scoped aggregate stats
    ├── account.js          ← DELETE /reset (account data wipe)
    └── admin.js            ← legacy ADMIN_KEY data dump (retires in Phase 9)
client/src/
├── App.jsx                 ← AuthProvider + nav + routes (protected & public)
├── main.jsx                ← bootstrap; wraps in ThemeProvider + BrowserRouter
├── api.js                  ← fetch wrapper; injects Bearer token; all endpoints
├── auth.jsx                ← AuthProvider / useAuth context
├── theme.jsx               ← ThemeProvider + useTheme (Phase 8.5)
├── session.js              ← active-session localStorage helpers
├── lib/utils.js            ← cn() class-name helper (Phase 8.5)
├── pages/                  ← Home, Login, Register, SessionSetup, Practice,
│                              Results, Dashboard, Profile
└── components/
    ├── ui/                 ← Phase 8.5 primitives (button, card, badge, input)
    ├── ThemeToggle         ← nav toggle (light/dark/system cycle)
    ├── OptionCard          ← practice option card (uses tokens)
    ├── FeedbackSections    ← 5-section attempt review (uses tokens)
    ├── TopicBadge/TypeBadge← wrap ui/badge
    ├── IntuitionTimer      ← circular countdown
    └── ProtectedRoute      ← auth gate
.env                        ← ANTHROPIC_API_KEY, PORT, JWT_SECRET
```

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

**Dashboard frontend** (`client/src/pages/Dashboard.jsx`) has 5 rows: header stat cards → SVG accuracy-by-type bar chart (red/amber/green thresholds) → trap weakness + topic accuracy cards → weakest-area callout → expandable recent-attempt cards. The `FeedbackSections` component (`client/src/components/FeedbackSections.jsx`) renders attempt reviews with graceful degradation (AI sections hidden pre-Phase-4). Shared trap-type metadata lives in `client/src/trapTypes.js`.

## Database Schema (recreated by `server/db.js` on startup)

- `users(id, username UNIQUE, email UNIQUE, password_hash, role['user'|'admin'], created_at)`
- `sessions(id, user_id FK, num_questions, timer_mode, timer_scope, timer_seconds, status['active'|'completed'], created_at, completed_at)`
- `attempts(id, session_id FK, question_id, question_type, topic, selected_option_index NULLABLE, correct_option_index, is_correct, trap_option_index, trap_type, selected_trap, skipped, reasoning_* + AI fields, mode, time_taken_seconds, eliminated_indices, intuition_points, created_at)`
- `questions(id, topic, paragraph, question, type, options_json, correct_index, trap_index, trap_type, source_lines, source['seed'|'user'], author_user_id FK NULLABLE, is_active, created_at)` — **Phase 8**; built-ins have `source='seed'`/`author_user_id=NULL`. User-created questions (Phase 10) set `author_user_id`.

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

Done: **Phase 1** (backend), **Phase 2** (frontend scaffold), **Phase 3** (core loop), **Auth & Configurable Sessions** (added on top of Phase 3), **Phase 4** (AI reasoning evaluation: `POST /api/attempts/evaluate`, Claude Haiku integration, reasoning textarea + 5-section feedback card in `Practice.jsx`), **Phase 5** (dashboard intelligence: SVG chart, trap weakness, weakest-area callout, expandable recent attempts), **Phase 6** (intuition mode), **Phase 7** (polish: dashboard 30s server cache, skeleton loading, lazy `Dashboard` with `React.lazy`, mobile paragraph toggle, question-repeat banner, `client/vercel.json` SPA routing config), **Deployment** (Vercel frontend + Render backend), **Phase 8** (questions migrated from `questions.js` into the `questions` SQLite table; all runtime routes read through `server/questionsRepo.js`; auto-seed on first run; `users.role` column added for Phase 9), **Phase 8.5** (design system foundation: shadcn-style primitives, indigo-based brand, Inter + Lora fonts, dark mode with system-pref + manual override, theme toggle in nav, ported screens: Home, Login, Register, SessionSetup, Practice, FeedbackSections, OptionCard, TypeBadge, TopicBadge).
Remaining: see [`ROADMAP.md`](ROADMAP.md) — Phase 9 (admin), 10 (user questions), 11–13 (loop enhancements), 14 (Coach), 15–16 (retention), 17–19 (monetize + launch). Pages still on legacy styling: Results, Dashboard, Profile (re-skinned in Phase 19 polish pass).

**Account reset**: `DELETE /api/account/reset` (auth-gated, `server/routes/account.js`) deletes all sessions and attempts for the user while keeping the account. Frontend: "Reset all data" button on the Profile page opens a confirmation dialog, then shows a toast notification on success. `clearActiveSession()` is called client-side so any in-progress session is cleared.

## Environment Variables

```
ANTHROPIC_API_KEY=...    # Phase 4
PORT=3001
JWT_SECRET=...           # change in production
```

In production, the frontend uses `VITE_API_URL` to point at the deployed backend instead of the dev proxy.
