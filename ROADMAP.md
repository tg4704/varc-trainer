# VARC Trainer — Forward Roadmap (Phases 8+)

This document plans the next wave of features on top of the shipped app (Phases 1–7 complete: backend, frontend, core loop, auth, AI evaluation, dashboard, intuition mode, polish). It was built from a grilling session; the locked decisions below drive the phase sequence.

> Companion docs: [`varc_trainer_build_prompt.md`](varc_trainer_build_prompt.md) (original spec) and [`ai_reading_coach_plan.md`](ai_reading_coach_plan.md) (Coach sub-plan, becomes Phase 14).

---

## Locked Decisions (from planning session)

| Decision | Choice |
|---|---|
| Question data storage | **Migrate all questions from `questions.js` into SQLite** |
| Production DB durability | **Build on local SQLite now; resolve durable storage at the monetization phase** |
| Build sequence | **Foundation first** (data backbone → admin → user content), then enhancements, Coach, retention, monetize/polish |
| AI provider strategy | **Multi-provider tiered** — cheap model (GPT-4o-mini / Gemini Flash) for free tier, Claude for paid |
| Admin auth | **`role` column on `users`** (`'user'` \| `'admin'`) + middleware; retire the `ADMIN_KEY` query-param hack |
| User-submitted questions | **Private to the author only** (no community bank → no moderation in v1) |
| User-question authoring | **Build both** manual + AI-draft; AI path **feature-flagged** for later tier-gating |
| Admin capabilities | **All four**: user analytics, API-cost tracking, quality-flag review queue, user management |
| Retention features | Spaced repetition **and** streaks/daily-goals, as their own later phases |

### Cross-cutting threads (born once, reused everywhere)
- **AI provider abstraction layer** — a thin `callModel({ provider, model, system, messages })` wrapper. First needed by the AI-draft authoring in **Phase 10**; the Coach (Phase 14) and everything else route through it.
- **Question generation endpoint** — `POST /api/generate-questions` (passage → CAT-style question set + validation/retry). First built in **Phase 10** for AI-draft authoring; the Coach extends it.
- **API-call logging** — an `api_calls` table (provider, model, tokens, cost, user, route, timestamp). Built in **Phase 9** for admin cost tracking; monetization reads it for usage metering.
- **Design system** — adopt shadcn/ui + design tokens + dark mode early as a *foundation* (Phase 8.5) so all new screens are built in the target style; a final polish pass (Phase 19) re-skins the legacy screens. *(See "Open: UI sequencing".)*

---

# GROUP 1 — Foundation

## Phase 8 — Questions → SQLite Migration
**Goal:** Questions live in the database; the practice loop reads from DB, not the code file. Unlocks admin editing (Ph 9) and user submissions (Ph 10).

**Depends on:** nothing.

**New / changed DB:**
- New `questions` table + `options` table (or `questions` with an `options_json` column — decide at kickoff; relational is cleaner for admin editing).
  - `questions(id, topic, paragraph, question, type, correct_index, trap_index, trap_type, source_lines, author_user_id NULLABLE, visibility DEFAULT 'seed', is_active, created_at)`
  - `author_user_id` null = built-in seed; set = user-created (used by Ph 10).
- Add `role TEXT NOT NULL DEFAULT 'user'` to `users`.

**Subphases:**
- 8.1 — Schema + seed script: import the 25 questions from `questions.js` into the DB on first run (idempotent). Keep `questions.js` as the seed source of truth checked into git.
- 8.2 — Rewrite `routes/questions.js` `/next` to query the DB (respecting `is_active`, and later `author_user_id`/`visibility`).
- 8.3 — Update `routes/attempts.js` + `routes/evaluate.js` to look up the question from DB instead of the in-memory array.
- 8.4 — Update `routes/dashboard.js` recent-attempts join (it currently re-reads `questions.js` for paragraph/options) to read from DB.
- 8.5 — Startup validation moves from `questions.js` to a DB integrity check.

**Open decisions:** relational `options` table vs `options_json` column.

**Done when:** the full practice + dashboard loop works end-to-end reading only from the DB; deleting the in-memory dependency breaks nothing.

---

## Phase 8.5 — Design System Foundation *(recommended; see Open: UI sequencing)*
**Goal:** Establish the visual system once so every new feature is built in the target look, avoiding a massive re-skin later.

**Subphases:**
- 8.5.1 — Adopt shadcn/ui (or confirm hand-rolled Tailwind), install base components.
- 8.5.2 — Design tokens: color scale, spacing, typography, radius; dark-mode theming via CSS variables.
- 8.5.3 — Port the 3–4 most-reused components (OptionCard, badges, buttons, cards) to the system as the reference.

**Done when:** a new screen can be built entirely from system components + tokens, and dark mode toggles cleanly.

---

## Phase 9 — Admin Page
**Goal:** A real admin UI at `/admin`, gated by role, covering all four capability areas.

**Depends on:** Phase 8 (questions in DB), `role` column.

**New DB:**
- `api_calls(id, user_id, route, provider, model, input_tokens, output_tokens, est_cost_usd, created_at)`.
- `question_flags(id, question_id, user_id, reason, source['user'|'ai'], status['open'|'resolved'], created_at)`.

**Subphases:**
- 9.1 — Auth: `requireAdmin` middleware; promote-to-admin path (manual SQL or a super-admin action); retire `routes/admin.js` `ADMIN_KEY` hack.
- 9.2 — Admin shell: protected `/admin` route, nav, role check on both client and server.
- 9.3 — **User analytics:** signups over time, active users, sessions/attempts per user, base-wide accuracy/trap trends.
- 9.4 — **Question CRUD:** table of all questions with filters; create/edit/delete form (paragraph, options, correct/trap, type, topic, source lines); activate/deactivate.
- 9.5 — **API-cost tracking:** wrap all AI calls to write `api_calls`; admin view of cost per day/user/route with running totals.
- 9.6 — **Quality-flag review queue:** list flagged questions (from user thumbs-down + AI audit), inspect, fix/delete/resolve.
- 9.7 — **User management:** view/deactivate/ban, reset a user's data, change role, impersonate-to-debug (read-only view of their dashboard).

**Open decisions:** impersonation scope (read-only vs full); how the first admin is created.

**Done when:** an admin can edit a question and see the change in practice; cost dashboard reflects real AI calls; a flagged question can be triaged end-to-end.

---

## Phase 10 — User-Submitted Passages & Questions (private)
**Goal:** A user can add their own CAT passages + questions, which appear in their sessions; full CRUD on a single screen. Both manual and AI-draft authoring.

**Depends on:** Phase 8 (questions in DB with `author_user_id`/`visibility`), provider abstraction (born here).

**New / changed:**
- Reuse `questions.author_user_id` + `visibility` ('private'). Practice `/next` includes the user's own private questions in their pool.
- New `POST /api/my-questions` CRUD set (list/create/update/delete, all scoped to `author_user_id = req.userId`).
- **Provider abstraction layer** (`server/ai/provider.js`) — first consumer.
- **`POST /api/generate-questions`** — passage in, validated question set out (validation + one retry, per the Coach plan's quality rules). Reused by Coach later.

**Subphases:**
- 10.1 — Provider abstraction layer (`callModel`), wired to log into `api_calls`.
- 10.2 — Manual authoring UI: passage + question + 4 options + mark correct/trap + type/topic. Validation mirrors seed rules.
- 10.3 — AI-draft authoring: paste passage → `generate-questions` → user reviews/edits → save. **Feature-flagged** (`features.aiAuthoring`) so monetization can gate it.
- 10.4 — "My Questions" management screen: list with edit/delete; toggle include-in-sessions.
- 10.5 — Inject private questions into the session pool (respect `is_active`, dedupe vs seed).

**Open decisions:** do private questions count toward the same daily quota as seed questions (matters once metered in Ph 17)?

**Done when:** a user creates a question both ways, sees it appear in a practice session, and edits/deletes it from one screen.

---

# GROUP 2 — Existing-Loop Enhancements (quick wins)

## Phase 11 — Voice Reasoning Input
**Goal:** Speak your reasoning; live transcription appears; edit, then submit.

**Subphases:**
- 11.1 — Mic capture + live interim transcription into the reasoning textarea.
- 11.2 — Editable result (transcription is a starting draft, not locked); clear/re-record.
- 11.3 — Graceful fallback when unsupported / permission denied.

**Open decisions (resolve at kickoff):**
- *Recommended default:* **Web Speech API** (free, browser-native, best in Chrome) for v1. **Risk:** weak on Indian-English accents — if testing shows poor accuracy, upgrade path is a paid STT API (Whisper/Deepgram) behind the same UI.
- Mobile support in v1? *(Recommended: desktop-first, mobile if Web Speech allows.)*

**Done when:** a user dictates a 2–3 sentence reasoning, edits a word, and submits successfully in Chrome.

---

## Phase 12 — Quote-to-Reasoning
**Goal:** Select passage text → add it to the reasoning box as a cited reference.

**Subphases:**
- 12.1 — Selection popover ("Quote") on highlighting passage text. *(Recommended over right-click — works on touch.)*
- 12.2 — Insert the quote as a **visually distinct chip/blockquote** inside the reasoning input.
- 12.3 — Track quotes separately in the payload so the evaluate prompt knows exactly what the student cited (sharpens AI feedback).

**Open decisions:** chip vs inline-styled text; whether quotes are removable as units.

**Done when:** a user quotes a line, it appears as a styled reference in the textarea and is sent as structured data to `/evaluate`.

---

## Phase 13 — Deferred AI Feedback in Timed Modes
**Goal:** Don't break flow during timed practice — evaluate all reasonings in a batch after the session ends.

**Subphases:**
- 13.1 — In timed modes, save reasoning per question **without** calling the AI inline (store the attempt, AI fields null).
- 13.2 — On session end, batch-evaluate all answered questions; show a **Session Review** screen with the full feedback cards.
- 13.3 — Untimed mode: user toggle — "instant feedback" vs "review at end".
- 13.4 — Persist batch feedback so it's also viewable from the dashboard recent-attempts.

**Open decisions:**
- Does "timed" mean countdown only, or also count-up? *(Recommended: any timer on → deferred; the point is uninterrupted flow.)*
- One batched API call vs one-per-question (cost vs parallelism) — implementation detail, decide at kickoff.

**Done when:** a timed 5-question session collects reasonings, then shows all five AI evaluations together at the end; untimed honors the toggle.

---

# GROUP 3 — The Moat

## Phase 14 — AI Reading Coach
**Goal:** Build the Socratic reading coach per [`ai_reading_coach_plan.md`](ai_reading_coach_plan.md).

**Depends on:** provider abstraction (Ph 10), `generate-questions` endpoint (Ph 10, extended here), multi-provider tiering.

**Subphases (from the Coach plan):**
- 14a — Article ingestion + question generation backend (`coach_sessions`, `coach_attempts`, validation/retry).
- 14b — Generation frontend: paste-article screen, practice layout, static answer reveal.
- 14c — Socratic debrief (core): `POST /api/coach/exchange`, multi-turn loop, exchange limits, chat UI, verdict card, source-line highlight.
- 14d — Session logging + Coach dashboard tab.
- 14e — Quality control (thumbs feedback → `question_flags`, async self-audit) + URL scraping (`@mozilla/readability` + `jsdom`).

**Tiering:** free tier uses the cheap model for exchanges; paid uses Claude. Prompt-caching on the article text (sent every turn) per the plan's cost section.

**Done when:** the plan's per-phase "done when" bars are met (notably: 3 full sessions where the AI genuinely challenges weak reasoning without revealing the answer early).

---

# GROUP 4 — Retention

## Phase 15 — Spaced Repetition
**Goal:** Re-serve the trap types / question types a user keeps failing, on a spacing schedule.

**Subphases:**
- 15.1 — Track per-user weakness (already partly in dashboard: weakest type, most dangerous trap).
- 15.2 — Scheduling model (lightweight SM-2-style or bucketed intervals) over questions the user got wrong.
- 15.3 — A "Review" session type that pulls due items first.

**Done when:** after failing several `real_but_unstated` traps, the user's review queue surfaces more of them on schedule.

---

## Phase 16 — Streaks & Daily Goals
**Goal:** Habit loop — daily streak, daily question goal, light gamification.

**Subphases:**
- 16.1 — Daily activity tracking + streak calculation (consecutive days with ≥ N questions).
- 16.2 — Daily goal setting + progress ring on home/dashboard.
- 16.3 — Streak-at-risk nudge (in-app; email optional later).

**Done when:** streak increments correctly across days and resets on a missed day; daily goal progress is visible.

---

# GROUP 5 — Monetize & Launch (last — depends on the full feature set)

## Phase 17 — Pricing & Monetization
**Goal:** Tiered plans, usage gating, payments, upgrade prompts.

**Depends on:** api-cost data (Ph 9), feature flags (`aiAuthoring`, Coach tier, voice, etc.), durable DB (Ph 18).

**Subphases:**
- 17.1 — Define tiers (free vs paid) and what each gates: daily question cap, session caps, Coach access, AI-draft authoring, voice, advanced dashboard.
- 17.2 — Usage metering + enforcement (per-day/week/month limits) reading from attempts/api_calls.
- 17.3 — Payment integration (provider TBD — Razorpay is India-first for CAT audience; Stripe alt).
- 17.4 — Plan management UI + contextual "Upgrade" prompts wherever a gate is hit.

**Open decisions (resolve at kickoff — you flagged these for the pricing discussion):**
- Free vs paid split (e.g., free = limited daily Analysis/Intuition; paid = unlimited + Coach + AI-draft + voice).
- Gating mechanism: questions/day vs sessions/day vs time-window.
- Price points (₹).
- Payment provider: **Razorpay** (recommended for India) vs Stripe.

**Done when:** a free user hits a cap, sees an upgrade prompt, pays, and the gate lifts.

---

## Phase 18 — Durable Storage & Launch Hardening
**Goal:** Make production data durable before charging money (the deferred "durability" decision).

**Subphases:**
- 18.1 — Choose durable store: Render paid persistent disk (minimal change) **or** migrate to managed Postgres (Neon/Supabase) for scale — decide based on Ph 17 scale expectations.
- 18.2 — Migration scripts + backups.
- 18.3 — Env/secrets hardening, error monitoring, rate limiting on AI endpoints.

**Done when:** a redeploy no longer wipes user data; backups verified.

---

## Phase 19 — UI Revamp Polish Pass
**Goal:** Re-skin the legacy (pre-Phase-8.5) screens to the design system; final UX cleanup.

**Subphases:**
- 19.1 — Audit screens still on the old style; port to system components.
- 19.2 — Responsive + dark-mode pass across the whole app.
- 19.3 — Micro-interactions, empty states, transitions.

**Open decisions:** reference apps/designs you want to emulate (bring to kickoff).

**Done when:** every screen uses the design system; dark mode is consistent app-wide.

---

## Open Decisions Still To Resolve (parked, not blocking)
1. **UI sequencing** — confirm the "design system early (8.5) + polish pass late (19)" split vs a single big revamp. *Recommended: the split, so new features aren't built twice.*
2. **Phase 8** — relational `options` table vs `options_json` column.
3. **Phase 11** — voice STT provider (free Web Speech vs paid); mobile in v1.
4. **Phase 13** — deferred applies to count-up too? batched vs per-question calls.
5. **Phase 17** — full pricing model (tiers, limits, ₹, payment provider).

## Suggested Sequencing (default)
`8 → 8.5 → 9 → 10` (foundation) → `11 / 12 / 13` (quick wins, any order) → `14` (Coach) → `15 → 16` (retention) → `18 → 17` (durable DB then monetize) → `19` (polish).
