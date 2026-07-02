# Roadmap (Restructure) — Graspr

> This supersedes the old Phase 17–19 plan in `ROADMAP.md`. It restructures the three
> learning products on top of the existing, working foundation (auth, sessions, SR,
> streaks, dashboards, email, admin). Nothing in the foundation is being rebuilt.

## The strategic reframe

CAT RC is a **4-stage skill funnel**. The app today only occupies Stage 3 (answering),
which is why "RC Trainer" and "RC Coach" feel like copies of each other — they fight over
the same slice while the stages where aspirants are actually weakest have no product.

```
STAGE 1 — INTAKE        STAGE 2 — COMPREHEND     STAGE 3 — SOLVE          STAGE 4 — SIMULATE
(read widely)           (read ONE passage right) (pick the right option)  (under exam pressure)
─────────────────       ─────────────────────    ──────────────────       ──────────────────
topics feel alien       "read but don't          50/50 close options      time mgmt / 8-min rule
vocab gaps               understand"              all options seem right   stamina, zoning out
slow reading             forget what I read       fall for traps           panic / ego
no reading habit         info-gathering fallacy   second-guessing          the PLATEAU
zoning out / fatigue     can't map the argument   gut not evidence         error diagnostics
─────────────────       ─────────────────────    ──────────────────       ──────────────────
① Reading Lounge        ② Comprehension Trainer  ③ Trap Drills            ④ Mock + Error DNA
   (NEW)                    (NEW — the hero)         (current USP, kept)      (later)
```

**Launch scope:** ① + ② + ③. Hold ④.
**"Coach" dissolves** from a standalone feature into a "Stuck? Discuss" capability inside
②/③ — it appears only on genuinely confusing questions, never as a separate destination.

### The three products, by job

- **① Reading Lounge** — curated **real** CC-licensed articles (The Conversation, Wikipedia,
  NASA, PLOS) across CAT genres. Job: kill topic-unfamiliarity, build the reading habit.
  Free top-of-funnel. *(Real articles, NOT AI — the point is authentic reading exposure.)*
- **② Comprehension Trainer** — full passage. **Before** seeing questions, the user maps the
  argument (thesis + what each paragraph does); the **AI grades the reading**, not the answer.
  Then questions + reasoning verdict. Job: fix forgetting, passive reading, structural mapping.
  This is the differentiator and the premium hero. *(Evolves the existing Coach.)*
- **③ Trap Drills** — short para + 1 Q + reasoning → verdict. Fast, high-volume, SR, streaks.
  Job: trap recognition + splitting the close 50/50. The current USP, kept pure.

## Content strategy

- **Reading Lounge:** curated real CC content + attribution. Not AI.
- **Drills + Comprehension (②③):** AI-generated passages + questions, behind a **brutal
  validation gate** (most generations are thrown away).
- Legal: build taxonomy/few-shots from **CAT/XAT PYQs only** (officially released). GMAT and
  paywalled sources (Aeon/Hindu/Economist) and competitor test series are off-limits for text;
  used at most as abstract register reference, never in prompts.
- The hard part is **distractors**, not passages. AI passages are good enough *only* with a
  structural spec (thesis/counter/qualification/tone) + PYQ difficulty calibration.
- Generate offline with the **best model** (cost is amortized); runtime reasoning-eval stays Haiku.
- Output flows through the existing **admin editor + flag queue**; hand-curate a **golden set
  of ~150–200** first as the quality bar and few-shot anchor. Never ship straight from generator
  to users.

## Data isolation — user-submitted questions (My Questions, Phase 10)

**Guarantee:** a question a user writes in My Questions is visible and attemptable **only by
that user** (and admins, for oversight). It is never surfaced to other users' Drills sessions,
practice pools, or listings.

**Status: already correctly implemented — no schema change, no Phase 0 repeat needed.**
User questions live in the same shared `questions` table (`source='user'`,
`author_user_id=<creator>`), not a separate per-user table — isolation is enforced by
row-level ownership filtering on every read/write path, which is the correct pattern (a
physical per-user table would not scale and is not how this is normally done):
- `questionsRepo.listForUser(userId)` — the pool every Drills session draws from — only
  includes `source IN ('seed','ai_generated')` OR `author_user_id = <that user>`. Another
  user's private question matches neither condition and is excluded.
- `GET/PATCH/DELETE /api/my-questions/:id` all scope by `author_user_id = req.userId`; a
  question owned by someone else simply doesn't match, even if the ID is guessed.
- The admin panel can see all questions — intentional oversight, gated by `requireAdmin`.

**Known minor gap (low priority, not yet fixed):** `POST /api/questions/:id/flag` checks
`is_active = 1` but not ownership, so a user could flag (not view/read) another user's private
question if they guessed its ID (`user_{userId}_{timestamp}` — not fully random). No content
leaks, only a flag record gets created. Fix: add `AND (source != 'user' OR author_user_id =
$userId)` to the flag route's lookup. Low priority; do opportunistically.

---

## Phases

Effort tags: `S` small · `M` medium · `L` large. The content engine (Phase 1) runs as a
**parallel track** feeding ② and ③.

### Phase 0 — Lock the architecture · `S`
- Final names: Reading Lounge / Comprehension Trainer / Trap Drills.
- IA/nav map; Coach dissolves into "Stuck? Discuss".
- Schema diff: comprehension attempts + stored reading-map; article-library table;
  `source='ai_generated'`; per-attempt error-category field; tier fields.
- **Done when:** one-page spec + schema diff agreed.

### Phase 1 — Content engine + golden set · `L` · *parallel · de-risk #1*
- Distractor + question-type taxonomy from CAT/XAT PYQs only.
- Generation pipeline: structural passage spec → typed distractors.
- Adversarial validation gate (the "exactly one defensible answer" kill-test).
- Run on real PYQ passages; founder spot-checks as an aspirant.
- Hand-curate golden set ~150–200 via admin/flag queue.
- **Done when:** curated AI questions are indistinguishable from PYQs and ambiguity ≈ 0.

### Phase 2 — Coach ② · `L` · *the hero · de-risk #2*
- **Spike first (done ✓):** prompt that grades a user's reading-map against passage structure.
- Reading-map step before questions, with **two input depths**: *quick* (4–5-word crux per
  paragraph — the default) and *full* (main point/tone/structure/turn). **Any language accepted**
  (mother-tongue verbalization) — grade understanding, not grammar.
- AI reading-evaluation + feedback → then questions (reuse flow) + reasoning verdict.
- Demote chat → "Stuck? Discuss" escalation. Evolve `coach_*` infra.
- **Done when:** map → reading feedback → answer → verdict, and the reading feedback is genuinely useful.

### Phase 3 — Reposition Drills ③ + unified nav · `M`
- Rebrand Trainer → Drills, tightened to its job.
- **Inference-focused drill mode** — dedicated inference sets (data: inference is ~50% of RC,
  the single highest-leverage skill). Filter drills by question type, inference front-and-centre.
- New home presenting the 3 as a journey: Read → Comprehend → Solve.
- Wire golden-set content into ③.
- **Done when:** nav shows 3 distinct products; inference mode live.

### Phase 4 — Reading Lounge ① · `M`
- Article-library table; ingest curated CC articles with attribution.
- Reading UI: daily article, genre browse, vocab-in-context, optional jargon-strip exercise.
- **Difficulty ladder** — progressive easy→hard path (novels-register → news → Aeon-register),
  not just genre browse (research: build UP to dense essays or they "put you to sleep").
- **Topic cross-linking** — from a passage you struggled with in ②/③, surface related Lounge
  articles on the same topic ("build domain knowledge on this theme").
- Hook into streaks.
- **Done when:** user reads a daily curated article, ladder + cross-links working.

### Phase 5 — Discuss + BEAST error-log · `M`
- "Stuck? Discuss" chat in ②③ on confusing questions.
- **BEAST error-log**: auto-categorize every wrong answer by trap archetype (mapped to
  Broad/Extreme/Alien/Side-track/Tone) into a running per-user log — the most-recommended topper
  habit. Also tag root-cause (comprehension / trap / speed / guess).
- Dashboard surfaces error-DNA (your recurring trap patterns).
- **Done when:** users can escalate to discussion; every wrong answer is BEAST-categorized in a log.

### Phase 6 — Monetization & limits · `M`
- Caps: free Trap Drills/day; 1–2 free Comprehension; Lounge free.
- Paywall around Comprehension + diagnostics; payment integration.
- **Done when:** a free user hits a limit and can upgrade.

### Phase 7 — Mock + Error DNA ④ · *hold*
- Exam-realistic timed sectional + topper-grade diagnostic. Build after validation + content depth.

### Phase 8 — VA module (Verbal Ability) · *post-launch*
- VA is 33% of VARC (RC is 67%) — currently 0% of the app. Add it once RC is proven.
- **Start with Para Summary** (11% of VARC, and *learnable* — find intro + conclusion, eliminate
  options that break flow / add new ideas). It's reasoning-based, so it fits the reasoning-feedback
  USP naturally.
- Then Para Jumble (11%, practice-heavy), Sentence Insertion (8%), Odd-One-Out (4%).
- Skip Para Completion (effectively gone from CAT 2021–2025).
- **Done when:** Para Summary practice with reasoning-feedback ships; other VA types follow.

---

## Where we start

Run the two de-risk spikes first, in parallel:
- **b1 — content spike:** taxonomy + generate ~10 questions on real PYQ passages, validate, judge.
- **b2 — comprehension spike:** the "grade my argument-map" prompt, tested on a couple of passages.

If both land, commit to the full build. If one wobbles, we've spent days, not weeks.
