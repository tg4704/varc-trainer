# UI/UX Fixes — Manual Test Plan

Companion to the 2026-07 UI/UX audit fixes (see the audit plan for the full
findings list). Same conventions as `SECURITY_TESTING.md`: each test is
copy-pasteable — run it, compare to "Expected," check the box.

- **Part A — P0 fixes** (tests 1–5): mobile nav/top-bar overflow, 404, AI retry.
- **Part B — P1 fixes**: scroll/motion/layout fundamentals.
- **Part C — P2 fixes**: copy, consistency, a11y.

## Setup

```
Frontend dev server: http://localhost:5173  (client/: npm run dev)
Backend dev server:  http://localhost:3001  (repo root: npm run dev)
```

Width-sensitive tests use Chrome DevTools responsive mode (Cmd+Opt+I →
device toolbar). "375px" means set the viewport width to 375 — the iPhone SE
preset is fine. Log in with any test account.

---

# Part A — P0 fixes

## 1. TopNav collapses correctly on mobile (P0-1)

**Logged in, 375px:**
1. Open http://localhost:5173/dashboard at 375px width.
2. Look at the top nav bar.

Expected: logo (`graspr.in`) fully visible on the left; on the right only a
small avatar chip + chevron (no username text, no Lounge/Drills/Coach pills,
no Dashboard button). Nothing pokes past the right edge of the screen and
the page cannot be panned sideways.

3. Tap the avatar chip.

Expected: dropdown opens with **Drills / Coach / Dashboard** at the top
(above a divider), then Profile / Change Password / Export my data / Reset
all data / Delete account / Log out. Tapping Drills navigates to `/setup`.

- [ ] Pass

**Logged in, desktop (≥1024px):**
4. Widen the viewport to 1280px.

Expected: nav returns to normal — center pills (Lounge · Drills · Coach),
Dashboard button, avatar with username. The dropdown no longer contains
Drills/Coach/Dashboard.

- [ ] Pass

**Logged out, 375px:**
5. Log out, return to `/` at 375px.

Expected: logo + "Log in" + "Sign up" all fully visible; Toolkit/Pricing/Blog
hidden (still reachable via footer). No horizontal scroll.

- [ ] Pass

## 2. No page-level horizontal scroll anywhere on mobile (P0-1)

1. At 375px, visit each of: `/`, `/dashboard`, `/setup`, `/pricing`,
   `/privacy`, a Drills session, a Coach session.
2. On each page, try to scroll/pan sideways (or check in the console:
   `document.documentElement.scrollWidth === document.documentElement.clientWidth`).

Expected: `true` on every page — the viewport never pans horizontally
(`body { overflow-x: clip }` backstop + real fixes).

- [ ] Pass
