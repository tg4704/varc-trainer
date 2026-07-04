# UI Redesign (v2) — Glass / Editorial Dark

Design system v2: a glassmorphism reskin over the existing dark editorial theme, sourced
from the Claude Design project handed off in `UI redesign project/` (Foundations.dc.html,
Home/Login/Dashboard/RC Trainer/AI Coach `.dc.html` files). This doc tracks what changed,
why, and what's still open. See also [[UI Redesign System]] in the Obsidian vault.

## Design language

| | Before | v2 |
|---|---|---|
| Canvas | `#0F1117` solid | `#0B0D13` + soft teal/periwinkle ambient glow (fixed) |
| Surfaces | solid `--surface` cards | 3-tier glass: `.glass-recessed` / `.glass` / `.glass-floating` |
| Accent | teal only | teal `#5DCAA5` + **new** periwinkle `#8B9DFF` secondary |
| UI font | Inter | **Instrument Sans** (Newsreader + IBM Plex Mono unchanged) |
| Radii | 8px controls / 12px cards | 10px controls / 16px cards / fully-round chips |
| Nav | one top bar everywhere | **v3: one universal floating pill everywhere** (`TopNav.jsx`) — Practice▾ (Trainer/AI Coach) · Dashboard · avatar▾ (Profile/My Questions/Admin/Log out). `/practice` gets its own minimal session bar instead (see v3 section below). Superseded the v2 contextual model (floating pill on Home only / sidebar on hub pages / plain bar elsewhere) described below. |
| Copy rule | — | **no em dashes anywhere** (hard rule from the redesign project's own CLAUDE.md) |

Tokens live in `client/src/index.css` (`--glass*`, `--periwinkle`, `.glass*` utility classes,
`.fx-sheen`/`.fx-ring`/`.fx-underline` hover effects, `.eyebrow` mono micro-label) and
`client/tailwind.config.js` (Instrument Sans, `periwinkle`/`info` colors). Solid HSL tokens
(`bg-card`, `bg-muted`, etc.) were remapped to readable stand-ins so **every existing page
inherited the new palette for free** before any per-page reskin — this is why `Practice.jsx`
needed almost no changes: `Button`, `OptionCard`, and badges already read the shared tokens.

**Deliberate exception: reading text stays near-solid, never heavy glass.** Passage bodies,
reasoning textareas, and the Coach passage column are plain canvas/near-solid surfaces, not
blurred glass — legibility and mobile GPU cost both matter more there than the frost effect.

## Nav model (v3 — supersedes the v2 contextual model)

- **`TopNav.jsx`** — one universal floating glass pill on every logged-in, non-session page
  (Home, Dashboard, Coach landing/history, Drills setup, Profile, My Questions, Results,
  SessionReview, CoachSummary). Three items: **Practice ▾** dropdown (Trainer → `/setup`,
  AI Coach → `/coach`, with icons and a twinkle animation on the AI Coach item), **Dashboard**
  (plain link, no dropdown), and the **avatar ▾** dropdown (Profile / My Questions / Admin
  [if `role === 'admin'`] / Log out). Logged-out shows plain Log in / Sign up buttons.
- **`/practice`** renders its own `SessionTopBar` internally (Exit / progress bar / timer /
  mode pill) instead of `TopNav` — this is the in-session minimal bar that was explicitly
  held off during the v2 pass, now built as part of the Drills rebuild (see below).
- **`/coach/practice`** keeps a temporary bridge bar (`SessionNavBar`, the old inline `NavBar`
  function renamed) rather than adopting the RC-Trainer-style `SessionTopBar` — Coach's
  Socratic debrief-exchange flow doesn't map onto a question-by-question progress/timer
  model, so retrofitting the Trainer's bar risked breaking its already-shipped, distinct flow.
  A real Coach-specific session bar is a candidate for a future pass, not this one.
- Auth family (`/login`, `/register`, etc.) has **no persistent top nav** — `AuthShell`'s own
  gradient brand mark is the only chrome, matching the design's full-bleed card.

Superseded: `FloatingNav.jsx`, `SidebarNav.jsx`, `HubLayout.jsx` are deleted. Dashboard, Coach
landing, and Coach history no longer wrap in a sidebar layout — they're plain pages under
`TopNav` like everything else.

## Page-by-page status

| Page(s) | Status | Notes |
|---|---|---|
| Foundation (tokens) | ✅ Done | `index.css`, `tailwind.config.js` |
| Login | ✅ Done | Reference glass card; first full-glass page |
| Register / VerifyEmail / ForgotPassword / ResetPassword / ChooseUsername | ✅ Done | All on `AuthCard`; OTP boxes use new `.otp-box` class |
| Home | ✅ Done | 3-stage journey framing (Reading Lounge / Coach / Drills) replaces the old two-product framing that started this whole conversation |
| Dashboard | ✅ Done (v3 polish) | No longer wrapped in `HubLayout`/`SidebarNav` (see nav model); glow removed from `HeaderStats` status dots; SR widget and Streak widget removed |
| Drills (SessionSetup, Practice, Results, SessionReview) | ✅ Done (v3 full rebuild) | See "Drills rebuild (v3)" section below — Practice.jsx went from an unreskinned page to full RC Trainer parity |
| Coach (Landing, History, Practice, Summary) | ✅ Done | Landing + History are now plain pages under `TopNav` (previously `HubLayout`); Practice/Summary keep their own bar |
| Reading Lounge | Not built | Phase 4, unbuilt — no pages exist yet |
| Profile | ✅ Done | New editable `NameRow` (`PATCH /api/auth/name`); Streak & Daily Goal section removed (v3) |
| My Questions, My Question Editor | ✅ Done | Editor deliberately skips the shared `Card`/`Button`/`Input` primitives (raw `.glass` divs + `.btn`/`.input` classes) to avoid bleeding into Admin, which shares those components |
| Admin (all pages) | Out of scope | Internal tool, left as-is per the original design review |
| In-session minimal top bar | ✅ Done (v3) | Built as `SessionTopBar.jsx`, wired into `/practice` only — see nav model above |

## Drills rebuild (v3)

`Practice.jsx` had never actually been reskinned in the v2 pass beyond a few modals — it still
used the raw shadcn `Button`/token classes throughout. This pass rebuilt it to full parity with
the `RC Trainer.dc.html` mockup (the user's explicit scope choice — "full feature parity", not
a visual-only reskin):

- **`SessionTopBar.jsx`** — Exit / centered progress bar / session timer / mode pill, replacing
  the old distributed header. Rendered by `Practice.jsx` itself now, not `App.jsx`.
- **`QuestionStepper.jsx`** — floating vertical stepper docked to the left edge (desktop),
  showing prev/current/next; hovering the current one reveals a popover with every question in
  a grid + a colour legend. Same underlying `questionStates[]` data as the old inline pill row,
  which is now removed. A simple horizontal dot row (`MobileQuestionDots`, inline in
  `Practice.jsx`) covers mobile, where the floating stepper is hidden.
- **Annotation system** (new) — `lib/textAnnotations.js` does offset-based text segmentation
  (`domOffsetToTextOffset`, `buildTextSegments`) so highlight/underline/note render as styled
  `<mark>` spans over the plain passage text, without making it contentEditable. Stored per
  question in `questionStates[i].annotations`, session-scoped only (not persisted to the DB or
  across a refresh — same durability as a tentative selection). The existing Phase-12 "Quote"
  action is unchanged and lives alongside these three in the same selection popover.
- **`PassageFontMenu.jsx`** — typeface (5 options, importing Lora/Spectral/Atkinson Hyperlegible
  alongside the already-loaded Newsreader/Instrument Sans), text size, line spacing. Persists to
  `localStorage` (`varc_passage_font_prefs`).
- **`TimerRing.jsx`** — pausable SVG donut for the per-question timer, replacing the plain
  MM:SS text. Pause is intentionally scoped to `timerScope === 'per_question'` only (pausing a
  shared per-session countdown from within one question doesn't make sense) and only pre-lock.
- **`FeedbackSections.jsx`** — restructured into two tabs, "Explanation" (unchanged
  score/why-correct/trap/takeaway content) and "Every option" (one-line verdict per option,
  built client-side from data already returned by the eval call — no new AI call or schema
  change). Also gained an optional reasoning-echo box when `reasoningText` is passed (wired in
  Practice.jsx and SessionReview.jsx; Dashboard and CoachPractice don't have raw reasoning text
  available server-side yet, so they simply don't show the echo box).
- **Flag modal** — reason codes changed to match the mockup's five ("Confusing wording",
  "Possible error", "Ambiguous options", "Too difficult", "Revisit later"). The server's
  `VALID_REASONS` allowlist in `questions.js` keeps the old four codes alongside the new five
  so nothing breaks; `AdminFlags.jsx`'s label map covers both sets.
- **`Results.jsx`** overhaul — accuracy donut ring, Time/Trap-rate stat cards, a by-question-type
  breakdown (reusing Dashboard's bar-list pattern), a "tap to revisit" review grid that scrolls
  to and briefly highlights the matching row below, and an AI-style "session takeaway" line
  templated client-side from the same stats (no new AI call).
- Intuition mode is functionally untouched — it isn't part of the RC Trainer mockup — but now
  shares `SessionTopBar`/`QuestionStepper` for a consistent shell.

## Spaced Repetition & Streaks — removed (v3)

Both features added maintenance surface without earning their keep, per explicit instruction.
Code and UI are fully removed (`server/sr.js`, `server/routes/sr.js`, `server/routes/streak.js`,
`StreakWidget.jsx`, all client `sr`/`streak` API exports, SessionSetup's session-type selector,
Dashboard's SR/Streak widgets, Profile's streak editor). The `sr_cards` table and
`users.daily_goal` column are deliberately left in the database, unused — removing them would
require a destructive production migration for no real benefit, since the dead columns cost
nothing sitting idle.

## Non-visual changes that rode along

These weren't purely cosmetic and are worth knowing about separately from the reskin:

- **`users.name` column** (additive migration, `server/db.js` + `ensureColumn`). Collected
  as an optional field on Register; auto-captured from the Google OAuth profile for free on
  signup. Powers the "Good evening, {name}" Dashboard greeting, falling back to username.
  `publicUser()` in `server/routes/auth.js` now returns `name`.
- **Two new Dashboard endpoints**: `GET /api/dashboard/trend?range=7d|30d|all` (daily
  accuracy) and `GET /api/dashboard/heatmap` (35-day activity grid). Defined in **both**
  `server/index.js` and `server/routes/dashboard.js`, mirroring the existing
  `computeDashboard` pattern — the router file has a documented history of not reliably
  going live on Railway, so `index.js` is the source of truth and the router copy is a
  fallback only.
- **Drill → typeFilter deep link**: Dashboard's "Where you're losing points" list and the
  weakest-area callout now link to `/setup?type=<questionType>`; `SessionSetup.jsx` reads
  that param and applies it as the session's `typeFilter`, overriding the inference-only
  toggle, with a "Drilling: X · Clear" banner in its place when active.
- **Two admin endpoints for passage activation**: `GET/PATCH /api/admin/passages` — a
  passage's own `is_active` flag gates whether it appears in the Coach picker at all,
  separately from activating its individual questions. This was a real bug found mid-session
  (Coach picker showed nothing even with active questions) — see `Admin → Passages` page.

## Known gaps / deferred

- No build tooling in the working environment (no local `node_modules`) — verification for the
  v3 pass upgraded from brace-balance checks to actual `esbuild` compiles (per-file, and a full
  `--bundle --packages=external` pass over `App.jsx` that resolves every relative import,
  including lazy-loaded admin chunks). This catches real syntax/import errors but still isn't a
  browser render. The user has already flagged a dedicated "intense test check" pass is coming.
- Reading Lounge — out of scope for this pass; it's unbuilt (Phase 4), not unreskinned.
- Custom-styled range slider (SessionSetup question-count slider) — left on native
  `accent-primary` styling rather than building the design's gradient-thumb slider; low value
  for the effort.
- `/coach/practice` still on the temporary bridge bar (see nav model above) — a real
  Coach-specific session bar is unbuilt.
- Passage annotations (highlight/underline/note) are session-only, not persisted — closing the
  tab loses them. This was a deliberate scope call, not an oversight (see Drills rebuild section).
- The note-annotation popover has no explicit "cancel" once opened (Save is disabled until you
  type something, but there's no dedicated close button) — selecting different text elsewhere
  in the passage implicitly resets it, but a stray click on empty space won't. Minor, low-risk.

With Profile / My Questions / My Question Editor done, every existing user-facing page is now
on the glass redesign except Admin (explicitly out of scope) and the in-session top bar
(explicitly deferred). The Reading Lounge (Phase 4) will be designed and built fresh, not
retrofitted.

## Bug-fix pass after first live review (v3.1)

The user's first live test of the v3 pass surfaced real, concrete gaps beyond what static
esbuild checks could catch. Fixed:

- **Home demo card is genuinely interactive now** — clicking any of the 3 options (not a
  `setTimeout`) drives the select → type → feedback flow, each option has its own canned
  reasoning/feedback tuned to its verdict (correct/trap/wrong), and "Try another answer" resets
  to a blank slate. Matches the mockup's own `selectDemo`/`submitDemo`/`retryDemo` script.
- **`BrandMark` (the logo icon) was soft/smudgy** — its box-shadow blur (20px at size 30) was
  proportionally much larger than the mockup's (16px), plus a rounder outer radius. Fixed to
  scale all three (radius, shadow, inner-square radius) proportionally from the `size` prop.
- **Home hero spacing** tightened to the mockup's actual ratios: grid `0.82fr 1.18fr` (was
  `1.05fr 0.95fr`), headline 56px/1.02 line-height, feature-list 13px row gap, and the demo
  card now sits in its own bordered/padded column matching the mockup's right-column treatment.
- **`.opt`'s left accent bar removed app-wide** — a pre-existing Graspr design element
  (`border-left: 3px solid transparent`, colored on hover/select/correct/wrong/trap) that
  predates the RC Trainer mockup and the user disliked ("that little green thing"). Single CSS
  class fix in `index.css` cleans it up everywhere `OptionCard`/`.opt` is used: Practice.jsx,
  CoachPractice.jsx, the Home demo card. Full-perimeter border-color states are unchanged.
- **Options couldn't be deselected** — `Practice.jsx`'s option `onClick` always set
  `tentativeSelected: i`; now toggles to `null` if the same option is clicked again (both
  Analysis and Intuition modes).
- **Question stepper overlapped passage text** — the floating `QuestionStepper` needed more
  left clearance than the passage panel reserved; bumped `md:pl-12` → `md:pl-24` to match the
  mockup's own 96px passage-panel left padding.
- **Per-question timer donut was missing for count-up sessions** — `TimerRing` only rendered
  for `countdown` mode; now renders for `count_up` too (as a static filled ring, since there's
  no fixed total to deplete against). Pause stays scoped to countdown + per-question only.
- **Dashboard rebuilt to match `Dashboard.dc.html` precisely** (confirmed against the mockup's
  own component script, not just appearance): container `1240px`/`36px 44px 56px` padding,
  greeting 34px/1.1 line-height, KPI cards `18px 19px` padding with 30px mono values, `18px`
  grid gaps, the "Resume where you left off" card gained a second **"Start fresh"** button
  (discards the in-progress Coach session via `coach.deleteSession`, then routes to `/coach`)
  and a decorative gradient blob, range-toggle buttons at exact `5px 11px` padding, **Recent
  attempts flattened** from expandable cards into single-line rows (colored initial badge +
  title + type·topic + status + relative date — required adding `createdAt` to the
  `recentAttempts` payload in both `server/index.js` and `server/routes/dashboard.js`), and the
  **weekly heatmap transposed** from 5-columns-by-calendar-week to the mockup's 7-columns-by-
  weekday (Mon-first) × 5-cells, at 15px cells with 1.28× hover scale. Per explicit confirmation,
  the mockup's "Day streak" KPI and heatmap streak footer were **not** resurrected — Streaks
  stay removed; the existing 4 KPI metrics (Answered/Accuracy/Trap rate/Reasoning) carry the
  mockup's typography instead.
- **Change Password / Reset all data moved into the `TopNav` avatar dropdown** as
  directly-triggered modals (reusing the exact logic that used to live inline on
  `Profile.jsx`), alongside the existing Log out. Profile.jsx keeps only Name/Username/Email/
  Joined and the stat cards — no more standalone Log out button there either, since that's now
  exclusively a dropdown action too.
- **Nav dropdown blur wasn't visible** — `TopNav`'s two dropdowns used an 86%-opaque dark
  background (`rgba(24,27,35,0.86)`), which hides most of the `backdrop-filter` blur happening
  underneath. Switched to the same recipe `.glass-floating` uses elsewhere (`rgba(255,255,255,
  0.08)` + an inset highlight), where the frosted effect reads correctly.

## Related

- Design source: `UI redesign project/` (Foundations, Home - Build, Login, Dashboard,
  RC Trainer, AI Coach `.dc.html` files) — Claude Design handoff, not auto-synced.
- Obsidian vault: `Architecture/UI Redesign System` note (mirrors this file for
  cross-linking with the rest of the Graspr brain).
