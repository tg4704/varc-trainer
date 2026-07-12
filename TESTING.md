# UI/UX Fixes — Manual Test Plan

Companion to the 2026-07 UI/UX audit fixes (see the audit plan for the full
findings list). Same conventions as `SECURITY_TESTING.md`: each test is
copy-pasteable — run it, compare to "Expected," check the box.

- **Part A — P0 fixes** (tests 1–6): mobile nav/top-bar overflow, 404, AI retry.
- **Part B — P1 fixes** (tests 7+): scroll/motion/layout fundamentals.
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

## 3. In-session top bars fit on one line on mobile (P0-2)

**Drills, timed:**
1. At 375px, start a Drills session: 1 question, Countdown, Per question.
2. Look at the in-session header.

Expected: `← Exit`, a compact `1 / 1` + progress bar, and the timer all sit
on ONE line with nothing wrapped, clipped, or overlapping. (The word
"Question" and the timer's "Session" label only appear at ≥640px.)

- [ ] Pass

**Coach:**
3. At 375px, start any Coach passage.

Expected: `← Exit | Mapping the passage | ✳` on one line (the "AI COACH"
text label only appears at ≥640px). After the map step, the question
progress segments shrink to fit instead of forcing a fixed width.

- [ ] Pass

## 4. 404 page for unknown routes (P0-3)

1. With the app running, visit http://localhost:5173/definitely-not-a-page

Expected: styled "Page not found." screen (red target icon, explanation,
"Back home" button) — not a blank page. Browser tab title reads
"Page not found — Graspr". The nav still renders and works.

2. Click "Back home".

Expected: lands on `/`.

- [ ] Pass

## 5. AI feedback works, and failures can be retried (P0-4)

**Model config (do this first):**
1. Confirm `.env` has NO active `AI_MODEL` line pointing at a `:free`
   OpenRouter model (it's commented out; unset falls back to
   `anthropic/claude-haiku-4-5`). Restart the backend if you changed it.

**Happy path:**
2. Start an untimed Analysis Drills session, answer a question, write a
   sentence of reasoning, click "Get AI feedback".

Expected: after a few seconds a real 5-section feedback card appears (a
reasoning score, correct-answer explanation, trap breakdown) — NOT the
"AI feedback unavailable" banner.

- [ ] Pass

**Retry path (simulate a failure):**
3. Stop the backend, set `AI_MODEL=this/does-not-exist` in `.env`, restart.
4. Answer a question with reasoning, click "Get AI feedback".

Expected: an amber "AI feedback unavailable. Your attempt was saved."
banner with a **"Retry AI feedback"** button beside it. The ✓/✗ verdict
and correct answer still show (those don't need AI).

5. Fix `AI_MODEL` back (comment it out), restart the backend, then click
   "Retry AI feedback" on that same banner (navigate back to the question
   if needed).

Expected: button shows "Retrying…", then the banner is replaced by the
full AI feedback sections for that attempt. No duplicate attempt is
created (check `attempts` table count is unchanged).

- [ ] Pass

## 6. Coach reading-map grade can be retried (P0-4)

1. With a broken `AI_MODEL` (see test 5 step 3), start a Coach passage,
   fill the reading map, click "Grade my reading".

Expected: proceeds to the questions with an amber "Reading feedback
unavailable" banner that now has a **"Retry grade"** button.

2. Fix `AI_MODEL`, restart, click "Retry grade".

Expected: button shows "Retrying…", then the banner turns teal with a
real reading grade ("Your reading: …", verdict line, technique tip).

- [ ] Pass

---

# Part B — P1 fixes

## 7. Scroll resets to top on route change (P1-5)

1. Open `/privacy`, scroll to the bottom.
2. Click "Terms" (or any nav link) to go to another route.

Expected: the new page opens scrolled to the TOP, not mid-page.

3. On the Home page, click a footer anchor that uses a `#hash` (if any).

Expected: hash/anchor links still jump to their target section (scroll
reset does NOT hijack in-page anchors).

- [ ] Pass

## 10. Coach: passage panel & chat scroll behave on all sizes (P1-7 / P1-8)

**Mobile passage panel (375px):**
1. Start a Coach passage, map it, reach the questions phase at 375px.
2. Scroll down through the passage into the question.

Expected: the passage scrolls away normally — it is NOT a pinned/sticky
box overlapping the question. (At ≥1024px the passage IS sticky beside
the question, as before.)

**Discuss chat auto-scroll (desktop):**
3. On a question, answer it, open "Discuss with Coach", send a few
   messages so the chat fills and scrolls.

Expected: each new reply scrolls the CHAT box to the latest message only —
the whole page (article + question columns) does NOT jump/scroll. Reaching
the top/bottom of the chat does not chain-scroll the page behind it.

- [ ] Pass

## 11. Practice selection toolbar stays on-screen (P1-9)

1. In a Drills question, select passage text right at the LEFT edge of the
   screen, then right at the RIGHT edge (narrow viewport, ~375px).

Expected: the Highlight/Underline/Note/Quote toolbar stays fully within
the viewport both times — no button is clipped off either edge.

- [ ] Pass

## 12. Session-setup option descriptions show on touch (P1-10)

1. On the Session Setup page (touch device or no mouse), look at the
   Practice mode (Analysis/Intuition) and Timer selectors.

Expected: the selected option's description appears as a line of text
below the buttons and updates when you switch — it is NOT hidden behind a
hover-only tooltip.

- [ ] Pass

## 13. Dashboard loads without a double-flash or width jump (P1-11)

1. Hard-reload `/dashboard` (throttle network to see the loading state if
   needed).

Expected: a single skeleton style (the `.skel` shimmer blocks) at the same
width as the final content — no switch between two different skeleton
looks, and no container-width jump when the real data appears.

- [ ] Pass

## 14. Hover FX are smooth; reduced-motion is respected (P1-12)

1. Hover a primary button (e.g. the Session-setup CTA) and a `.fx-underline`
   link.

Expected: the sheen sweep and underline grow animate smoothly (they now
animate `transform`, not `left`/`width`).

2. Enable "Reduce motion" (macOS: System Settings → Accessibility → Display).
   Click the logged-out nav "Toolkit" link (jumps to the toolkit section).

Expected: the jump is instant, not an animated smooth-scroll. CSS
animations/transitions are also effectively disabled.

- [ ] Pass

---

# Part C — P2 fixes

## 15. Copy & naming consistency (P2-13)

Check each, expecting the stated result:

- Login page subtitle reads "Sign in to pick up where you left off." (no
  "streak" — that feature was removed).
- Home footer Product column reads **Drills / Coach / Lounge** (matching the
  nav), with a small "Soon" badge on Lounge. Company column has **Blog** and
  **Contact** (Contact opens `mailto:privacy@graspr.in`); there is no dead
  "About" text-styled-as-link.
- Nav "Lounge" pill shows a "Soon" badge (not just dimmed).
- Home hero: the mono label beside "Start free" reads "No card needed"
  (not the redundant "Free to start").
- Session Setup primary button reads "Start N-question session →" (not
  "Review …", which read like SR review mode).
- Avatar dropdown "Log out" is neutral-colored, not the destructive red used
  for "Delete account".
- Drills feedback: for a correct answer, "You chose A. …teaching." has a
  single period; for wrong, "…informed. The correct answer was C. …visible."
  has no double periods.

- [ ] Pass

## 16. Pricing lists only shipped features (P2-14)

1. Visit `/pricing`.

Expected: no bullet mentions "Spaced repetition review queue" or "Streak +
daily goal tracking" (neither is in the app). They're replaced with
"Trap-type weakness analytics" and "Voice-to-text reasoning input".

- [ ] Pass

## 17. Dashboard heatmap opens on the current month (P2-15)

1. Open `/dashboard` at a width where the activity heatmap overflows (e.g.
   375px, or a narrow window).

Expected: the heatmap is scrolled to the RIGHT edge on load — the current
month and today's cell are visible, not January off the left.

- [ ] Pass

## 18. Profile join date is unambiguous (P2-16)

1. Open `/profile`.

Expected: "Joined" shows a "12 Jul 2026"-style date (day + short month +
year), not an ambiguous "11/07/2026".

- [ ] Pass

## 19. Intuition results show the points score (P2-17)

1. Run an Intuition-mode Drills session and finish it.

Expected: the Results page stat row includes a third "Points / intuition
score" card (alongside Time and Trap rate) with the session's total
intuition points.

- [ ] Pass
