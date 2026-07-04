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
| Nav | one top bar everywhere | **contextual**: floating pill (Home) / glass sidebar (hub pages) / existing top bar (in-session, unchanged for now) |
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

## Contextual nav model

- **Floating glass pill** (`FloatingNav.jsx`) — Home only. Scroll-reactive shadow/frost.
  Logged-in: direct **Coach / Drills / Dashboard** links in one segmented pill + a single
  user-avatar dropdown (Profile / My Questions / Admin / Log out). Deliberately does **not**
  reintroduce the design reference's nested "Practice → Trainer/AI Coach" dropdown — that's
  the exact pre-restructure framing this whole effort replaced.
- **Glass sidebar** (`SidebarNav.jsx` + `HubLayout.jsx`) — hub/landing pages: `/dashboard`,
  `/coach` (picker), `/coach/history`. Wired in `App.jsx` via `SIDEBAR_EXACT_ROUTES` /
  `SIDEBAR_PREFIX_ROUTES` — `/coach` is an **exact** match so it doesn't prefix-swallow
  `/coach/practice` or `/coach/summary`.
- **Existing top bar** (`NavBar` in `App.jsx`, unchanged) — everywhere else, including
  in-session Coach/Drills. A bespoke minimal in-session bar (the AI Coach design's
  "← Practice · eyebrow · score" pattern) was scoped but **explicitly held off** per the
  user's instruction; `/practice`, `/coach/practice`, `/coach/summary` still show the full
  top bar.
- Auth family (`/login`, `/register`, etc.) has **no persistent top nav** — `AuthShell`'s own
  gradient brand mark is the only chrome, matching the design's full-bleed card.

## Page-by-page status

| Page(s) | Status | Notes |
|---|---|---|
| Foundation (tokens) | ✅ Done | `index.css`, `tailwind.config.js` |
| Login | ✅ Done | Reference glass card; first full-glass page |
| Register / VerifyEmail / ForgotPassword / ResetPassword / ChooseUsername | ✅ Done | All on `AuthCard`; OTP boxes use new `.otp-box` class |
| Home | ✅ Done | 3-stage journey framing (Reading Lounge / Coach / Drills) replaces the old two-product framing that started this whole conversation |
| Dashboard | ✅ Done | First `HubLayout` + `SidebarNav` page; new trend chart, heatmap, resume-Coach card |
| Drills (SessionSetup, Practice, Results, SessionReview) | ✅ Done | Practice needed only modal/toast fixes — most chrome inherited the palette for free |
| Coach (Landing, History, Practice, Summary) | ✅ Done | Landing + History on `HubLayout`; Practice/Summary keep the top bar |
| Reading Lounge | Not built | Phase 4, unbuilt — no pages exist yet |
| Profile, My Questions, My Question Editor | Not started | Still on pre-redesign styling |
| Admin (all pages) | Out of scope | Internal tool, left as-is per the original design review |
| In-session minimal top bar | **Held off** | Explicit user instruction; existing top bar stays for now |

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

- No build tooling in the working environment (no local `node_modules`) — every change this
  pass was verified by brace-balance + import-resolution checks, not an actual Vite build or
  browser render. Worth a real smoke test pass before calling any of this done-done.
- In-session minimal top bar (see above) — deferred, not forgotten.
- Reading Lounge, Profile, My Questions, My Question Editor — untouched, still legacy styling.
- Custom-styled range slider (SessionSetup question-count slider) — left on native
  `accent-primary` styling rather than building the design's gradient-thumb slider; low value
  for the effort.

## Related

- Design source: `UI redesign project/` (Foundations, Home - Build, Login, Dashboard,
  RC Trainer, AI Coach `.dc.html` files) — Claude Design handoff, not auto-synced.
- Obsidian vault: `Architecture/UI Redesign System` note (mirrors this file for
  cross-linking with the rest of the Graspr brain).
