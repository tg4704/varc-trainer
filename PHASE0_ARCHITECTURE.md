# Phase 0 — Architecture Lock

The fixed target for the restructure build. Grounded in the current `server/db.js` schema and
`client/src/App.jsx` routing.

## Decisions (locked)

- **Names:** ① **Reading Lounge** · ② **Coach** · ③ **Drills**.
- **② keeps the Coach brand and `/coach/*` routes** — it evolves the existing Coach feature *in
  place* (no redirect, no rename). The `coach_*` tables are **rebuilt** to the new model.
- **Fresh rebuild (pre-launch):** the DB is dropped and recreated. Final schema goes straight
  into `createTables()`; no `ensureColumn` gymnastics for the new structure (helper stays for
  future additive migrations).

---

## 1. Product → route → data map

| Product | Stage | UI routes | Data home |
|---|---|---|---|
| **① Reading Lounge** | Intake | `/reading`, `/reading/:id` | `articles` (new) |
| **② Coach** | Comprehend | `/coach`, `/coach/practice`, `/coach/summary`, `/coach/history` *(kept, evolved)* | `passages` + `coach_sessions` + `coach_attempts` (rebuilt); reuses `questions` via `passage_id` |
| **③ Drills** | Solve | `/setup`, `/practice`, `/results`, `/session-review` *(kept, relabelled "Drills")* | `questions` + `sessions` + `attempts` (existing) |
| **④ Mock + Error DNA** | Simulate | *(later)* | *(later)* |

**The chat** becomes a "Stuck? Discuss" capability *inside* ② (and later ③) — no longer the
defining mechanic. ②'s defining mechanic is the **reading-map grade** (b2) before questions.

**Unchanged:** auth, admin, dashboard, SR, streaks, my-questions, profile, email/OTP, OAuth.

---

## 2. Navigation

Logged-in nav, ordered by the journey (Read → Comprehend → Solve):

```
Reading  ·  Coach  ·  Drills  ·  Dashboard  ·  My Questions  · [Admin] · {username}
```

Home page reframed to present the three-step journey instead of a single "Practice" CTA.

---

## 3. Schema (final — defined directly in `createTables()`)

### New

```sql
-- ② full-RC passages (multi-question), with the b2 reading key baked in
CREATE TABLE passages (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  genre TEXT,
  title TEXT,
  body TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  reading_key_json TEXT NOT NULL,   -- { thesis, tone, paragraph_functions:[...], key_turn }
  source TEXT NOT NULL DEFAULT 'ai_generated',
  author_user_id INTEGER REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ① Reading Lounge — curated real CC articles
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  source_name TEXT NOT NULL,        -- "The Conversation"
  source_url TEXT NOT NULL,
  license TEXT NOT NULL,            -- "CC BY-ND 4.0" (attribution stored for compliance)
  genre TEXT NOT NULL,
  body TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  difficulty TEXT,                  -- easy|medium|hard
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `questions` — add `passage_id`

```sql
-- in the CREATE TABLE questions (...) definition:
passage_id INTEGER REFERENCES passages(id)   -- NULL = standalone ③ Drill; set = ② passage-linked
```
Passage-linked questions still store the passage body in `paragraph` (NOT NULL) so
single-question rendering works; `passage_id` is the join for full-RC mode.

### `users` — add `tier`

```sql
tier TEXT NOT NULL DEFAULT 'free'   -- 'free' | 'pro'  (Phase 6 enforces limits)
```

### `attempts` — add `error_category`

```sql
error_category TEXT   -- Phase 5 diagnostics: comprehension | trap | speed | guess
```

### `coach_sessions` — rebuilt for ②

```sql
CREATE TABLE coach_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  passage_id INTEGER NOT NULL REFERENCES passages(id),
  reading_map_json TEXT,            -- what the user submitted BEFORE questions
  reading_grade_json TEXT,          -- grader output (b2)
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```
*(Old `article_text`/`questions_json` columns dropped — ② uses the `passages` bank, not
paste-your-own. Paste-your-own can return later as an option.)*

### `coach_attempts` — rebuilt for ②

```sql
CREATE TABLE coach_attempts (
  id SERIAL PRIMARY KEY,
  coach_session_id INTEGER NOT NULL REFERENCES coach_sessions(id),
  question_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  selected_option_index INTEGER,
  correct_option_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  trap_type TEXT,
  selected_trap INTEGER NOT NULL DEFAULT 0,
  reasoning_text TEXT,
  reasoning_score INTEGER,
  reasoning_feedback TEXT,
  trap_explanation TEXT,
  correct_explanation TEXT,
  key_takeaway TEXT,
  discuss_conversation_json TEXT NOT NULL DEFAULT '[]',  -- "Stuck? Discuss" chat
  exchange_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,              -- Phase 5
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Value-only additions (columns already `TEXT`)

- `questions.source`: add **`'ai_generated'`** (alongside `seed|user|coach`).
- `questions.type`: add **`application`**, **`concept_set`**, **`vocab_in_context`**.
- `questions.trap_type`: add **`too_broad`**, **`distortion`**, **`wrong_question`**,
  **`wrong_location`**, **`mislabelled`**, **`wordplay`** (alongside the existing 4).

---

## 4. Server routes (new/changed)

- `server/routes/coach.js` — **rewritten** for ②: session create (pick/serve a passage),
  submit reading-map + grade, serve questions, submit reasoning, "Stuck? Discuss" exchange,
  complete, summary, history.
- `server/routes/reading.js` — list/get articles (①). **New.**
- `server/questionsRepo.js` — extend to fetch a passage + its `passage_id` questions.
- **Content generation is offline** (admin script/job) — best model per
  `content-pipeline/PIPELINE.md`; runtime eval stays Haiku.

---

## 5. JSON shapes (locked from the spikes)

```
reading_key_json   = { thesis, tone, paragraph_functions: [string], key_turn }
reading_map_json   = { mode: "quick"|"full",                                  // user input
                       crux: [string]?,          // quick mode: 4–5 words per paragraph
                       main_point?, tone?, structure: [string]?, the_turn? }  // full mode
                     // any language accepted (mother-tongue verbalization); graded on understanding
reading_grade_json = { reading_mode, thesis, structure, caught_the_turn,
                       what_you_missed, one_technique, verdict_line }          // grader output
```

---

## 6. Client page changes

- **Nav** (`App.jsx`): `Practice`+`Coach` links → `Reading` · `Coach` · `Drills`.
- **③ Drills:** `SessionSetup`/`Practice` copy relabelled "Drills" (routes unchanged).
- **② Coach:** `CoachLanding` → passage picker (not article paste); `CoachPractice` gains the
  **reading-map step before questions** + reading-grade panel; chat demoted to "Stuck? Discuss".
- **① Reading Lounge:** new `Reading` + `ReadingArticle` pages.

---

## 7. Definition of done — ✅ all agreed

- [x] Names: Reading Lounge / Coach / Drills.
- [x] Migration style: fresh pre-launch rebuild.
- [x] ② keeps `/coach` routes; `coach_*` tables rebuilt.
- [x] Schema finalized (this doc).
