# AI Reading Coach — Full Product and Build Plan

---

## What This Is

The AI Reading Coach is a Socratic tutoring loop for Reading Comprehension. The user pastes any article — from The Economist, Aeon, The Atlantic, or any dense long-form source. The AI generates CAT-quality questions on it. The user answers. Then, instead of getting a one-shot feedback card, they enter a back-and-forth conversation where the AI asks why they chose what they chose, challenges weak reasoning, and guides them toward the correct understanding — without ever giving away the answer directly.

It is the closest thing to having a VARC tutor sit next to you.

---

## How This Is Different From the VARC Trainer

These two products are complementary, not competing. They train different parts of the same skill:

| | VARC Trainer | Reading Coach |
|---|---|---|
| Passage length | 5–7 lines | Full article (400–1200 words) |
| Questions | Hardcoded, quality-guaranteed | AI-generated from any article |
| Feedback style | One-shot evaluation | Multi-turn Socratic dialogue |
| Primary skill | Option differentiation | Full RC comprehension + reasoning |
| User control | Fixed question bank | Any article they choose |
| Cost per question | Low (1 API call) | High (3–5 API calls) |
| Best used for | Daily drilling | Weekly deep practice |

Both live in the same app. The VARC Trainer is the gym. The Reading Coach is the coach.

---

## The Core User Flow

```
1. User pastes article text (or provides URL)
         ↓
2. App validates article (length 300–1500 words)
         ↓
3. One API call generates 4 CAT-style questions + options
         ↓
4. Question 1 appears alongside the article
         ↓
5. User reads the article, selects an option
         ↓
6. Socratic debrief begins:
   AI: "Why did you choose that option? Point me to the part of the article that supports it."
         ↓
   User types their reasoning
         ↓
   AI evaluates internally (knows the correct answer), then either:
     - Challenges: asks a follow-up question targeting the gap in reasoning
     - Validates: confirms the logic, deepens understanding
         ↓
   This continues for 2–3 exchanges
         ↓
7. AI ends the debrief with the verdict: correct/incorrect, full explanation, key takeaway
         ↓
8. User moves to Question 2 on the same article
         ↓
9. After all 4 questions, session summary is shown
         ↓
10. Attempt saved to DB (with full conversation logged)
```

---

## The Socratic Conversation — Design Specification

This is the most important design decision in the entire product. Get this wrong and the app feels like a chatbot. Get it right and it feels like a tutor.

### Three Conversation States

Every exchange is in one of three states. The AI must track this internally.

**State 1 — Probe**
User just picked an option. AI doesn't know why yet. It asks for evidence.
> "Why did you choose option B? What specific part of the article led you there?"

**State 2 — Challenge or Validate**
User has given a reason. AI evaluates it against the correct answer logic.

If reasoning is correct but incomplete:
> "You've identified the right part of the passage. But the question asks about the author's *attitude*, not just what they described. Based on the words used, would you say the author is reporting this neutrally or expressing a view?"

If reasoning is plausible but wrong:
> "That's a natural reading. But look at the word 'tentatively' in line 4. How does that qualifier change what we can draw from that sentence?"

If reasoning is fundamentally wrong:
> "You're focusing on what the paragraph *says* about X. But the question asks what can be *inferred* — something not directly stated. Is there a conclusion the author is building toward that they never state explicitly?"

**State 3 — Close**
User has either reached the correct understanding or the conversation has gone 3 exchanges. AI reveals the verdict.
> "Exactly — you've got it. The key was [X]. The trap option B was designed to fool students who [Y]. Here's what to remember for this type of question: [takeaway]."

### The Hard Rule: Never Give the Answer

The AI must never say "the correct answer is C." It must guide the user to figure it out. If after 3 exchanges the user still hasn't arrived, the AI says:

> "Let me redirect you. Go back to lines 6–8. Read just those lines again and tell me: what is the author *assuming* rather than stating?"

Only after 4 failed exchanges does the AI reveal the answer directly, with a full explanation.

### Conversation Turn Limits

- Maximum 4 exchanges per question (after that, reveal and explain)
- Each exchange: user message ≤ 300 words (enforce in UI)
- AI response: 60–120 words per exchange (not a wall of text — it's a conversation)

---

## System Prompts

### Prompt A — Question Generation

Used once per article. Returns structured JSON.

**System:**
```
You are an expert CAT (Common Admission Test) RC question designer. You will be given an article. Your job is to generate 4 high-quality CAT-style questions on it.

Rules for questions:
- Each question must require inference or judgment — no pure factual recall
- One question per type: inference, tone/attitude, title/main idea, detail-with-trap
- Every question must have exactly 4 options
- Options: 1 correct, 1 trap (tempting but wrong), 2 distractors (clearly wrong)
- Correct option: 12–25 words, no absolute language (never/always/only/completely)
- Trap option: plausible, either too extreme, out of scope, real-but-unstated, or partially correct
- Distractor options: wrong but not obviously so

For each question also identify:
- sourceLines: the 2–4 sentences from the article that directly contain or imply the answer
- trapType: one of "too_extreme" | "out_of_scope" | "real_but_unstated" | "partially_correct"
- correctIndex: 0–3 (which option is correct)
- trapIndex: 0–3 (which option is the trap)

Respond ONLY with a valid JSON array. No preamble, no markdown. Format:
[
  {
    "type": "inference",
    "question": "...",
    "options": [
      { "text": "...", "isCorrect": false, "isTrap": true, "trapType": "too_extreme" },
      { "text": "...", "isCorrect": true, "isTrap": false, "trapType": null },
      { "text": "...", "isCorrect": false, "isTrap": false, "trapType": null },
      { "text": "...", "isCorrect": false, "isTrap": false, "trapType": null }
    ],
    "correctIndex": 1,
    "trapIndex": 0,
    "trapType": "too_extreme",
    "sourceLines": "The specific 2–4 sentence excerpt from the article that the answer comes from."
  }
]
```

**User message:**
```
ARTICLE:
{full article text}

Generate 4 CAT-style questions on this article following the rules above. Ensure the questions collectively cover: inference, tone, title/main idea, and detail-with-trap.
```

---

### Prompt B — Socratic Debrief (Multi-Turn)

Used on every exchange during the debrief. The full article, question, correct answer info, and conversation history are sent every time.

**System:**
```
You are a CAT RC tutor conducting a Socratic debrief. A student has answered an RC question. You know the correct answer. Your job is NOT to reveal it — your job is to guide the student to figure it out themselves through targeted questions.

You are given:
- The full article
- The question and all 4 options (you know which is correct and which is the trap)
- The student's selected option
- The conversation history so far
- Which exchange number this is (1, 2, 3, or 4)

Your response rules:
- Keep your response under 100 words. This is a conversation, not a lecture.
- Never state the correct answer directly (unless exchange_number is 4)
- Never say "good job" or "you're wrong" — guide through questions
- Each response must end with a question that moves the student closer to the answer
- Target the specific gap in the student's reasoning — don't give generic advice
- Reference specific words or lines from the article when pushing back
- If the student's reasoning is essentially correct (even if they picked the wrong option), acknowledge the sound logic before redirecting

Exchange number rules:
- Exchange 1: Probe — ask them to show their evidence from the article
- Exchange 2: Challenge or validate based on their response
- Exchange 3: If still wrong, give a strong redirect to the relevant section of the article
- Exchange 4: Reveal the correct answer with full explanation (150–200 words)

Tone: direct, intellectually honest, no false praise, patient but not soft. Like a good teacher who respects the student enough to push them.

Respond ONLY with your conversational message. No JSON, no labels, no preamble.
```

**User message (constructed every turn):**
```
ARTICLE:
{full article text}

QUESTION: {question text}

OPTIONS:
A) {option 0}
B) {option 1}
C) {option 2}
D) {option 3}

CORRECT ANSWER: Option {letter} — "{correct option text}"
TRAP OPTION: Option {letter} — "{trap text}" (trap type: {trapType})
STUDENT SELECTED: Option {letter} — "{selected text}"
IS STUDENT CORRECT: {true/false}

CONVERSATION SO FAR:
{each prior exchange, labeled as TUTOR and STUDENT}

CURRENT EXCHANGE NUMBER: {1/2/3/4}
STUDENT'S LATEST MESSAGE: {student's current message}

Now respond as the tutor.
```

---

## Technical Architecture

### New Routes (added to existing Express server)

```
POST /api/coach/generate       — generate questions from article text
POST /api/coach/sessions       — create a coach session (tied to an article)
POST /api/coach/exchange       — send one Socratic exchange, get response
GET  /api/coach/sessions/:id   — get full session with all exchanges
GET  /api/coach/history        — all past coach sessions for this user
```

### New DB Tables

```sql
CREATE TABLE IF NOT EXISTS coach_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,           -- links to main sessions table
  article_text TEXT NOT NULL,
  article_source TEXT,                   -- URL or "pasted"
  article_title TEXT,
  word_count INTEGER,
  questions_json TEXT NOT NULL,          -- full generated question set as JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS coach_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_session_id INTEGER NOT NULL,
  question_index INTEGER NOT NULL,       -- 0–3
  question_type TEXT NOT NULL,
  selected_option_index INTEGER NOT NULL,
  correct_option_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  selected_trap INTEGER NOT NULL,
  trap_type TEXT,
  exchange_count INTEGER NOT NULL,       -- how many turns it took
  conversation_json TEXT NOT NULL,       -- full conversation as JSON array
  final_verdict TEXT,                    -- Claude's closing explanation
  key_takeaway TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_session_id) REFERENCES coach_sessions(id)
);
```

### URL Scraping (optional, Phase 2)

If the user provides a URL instead of pasting text, use Mozilla's `@mozilla/readability` package with `jsdom` to extract the article body. This strips navigation, ads, and boilerplate. Return the clean article text to the frontend before generating questions — let the user review and edit it before proceeding.

### Token Cost Management

Full article + conversation history grows with every exchange. Implement a hard token limit:
- Max article length: 1,200 words (≈ 1,800 tokens)
- If article is longer: truncate and inform the user
- Max conversation history sent per call: last 6 exchanges only (older context dropped)

---

## Frontend — New Pages and Components

### Route: `/coach`

**Article Input Screen**

Two input modes, toggled by a tab:

Tab 1 — "Paste Article":
- Large textarea, min-height 300px
- Word counter (minimum 300, maximum 1200)
- Optional "Article title" field
- Optional "Source URL" field (for reference only, not for scraping)
- "Generate Questions" button — disabled until minimum word count met

Tab 2 — "Enter URL" (Phase 2):
- Single URL input field
- "Fetch and Preview" button — fetches article, shows extracted text for review
- User can edit the extracted text before generating

After clicking "Generate Questions":
- Button shows spinner + "Reading article..."
- On success: transition to Practice Screen

---

**Practice Screen Layout**

Three-panel layout:

**Panel 1 — Article (left, 45% width)**
- Article title
- Full article text, 15px, line-height 1.9, scrollable
- Important: article stays visible throughout the entire session — never hidden
- Highlight sourceLines of the current question with a subtle yellow background (shown AFTER the debrief for that question ends — not during)

**Panel 2 — Question + Options (right top, 55% width)**
- Question type badge
- Question text
- 4 option cards (same style as VARC trainer)
- Submit button — "Start Debrief" (not "Evaluate")
- Timer (elapsed, not countdown — this is reading, not intuition)

**Panel 3 — Socratic Chat (right bottom, 55% width)**
Appears after option selection. This replaces the static feedback card with a chat interface.

Chat UI:
- Tutor messages: left-aligned, subtle background
- Student messages: right-aligned, stronger background
- Input field at the bottom with send button
- Character counter (max 300)
- Exchange counter: "Exchange 2 of 4" shown above input
- "I give up — show me the answer" button (skips to exchange 4 reveal)

After final verdict:
- "Next Question" button appears
- Source lines in the article panel are highlighted
- A compact verdict card appears above the chat showing: correct/incorrect, trap type, key takeaway

---

**Session Summary Screen**

After all 4 questions:

- Article title + source
- Overall: X of 4 correct
- Per question: type, correct/wrong, exchanges needed, whether they picked the trap
- "Exchanges needed" is important — 1 = got it immediately, 4 = needed full reveal
- Key takeaways from all 4 questions listed
- Two CTAs: "Practice Another Article" | "Go to Dashboard"

---

### Dashboard Addition — Coach Tab

Add a "Reading Coach" tab to the existing Dashboard.

Shows:
- Total articles practiced
- Average accuracy across coach sessions
- Average exchanges needed per question (lower = better reasoning)
- Accuracy by question type (same chart style as VARC trainer)
- Improvement over time: exchanges needed per question in session 1 vs recent sessions
- Articles practiced list (title, date, score) — click to review full session

---

## Quality Control for AI-Generated Questions

Since questions are AI-generated, quality is not guaranteed. Three layers of quality control:

**Layer 1 — Server-side validation before showing to user**

After generating questions, the server validates:
- JSON is parseable and has all required fields
- Exactly 4 options per question, exactly 1 marked correct
- All option texts are 10–30 words
- sourceLines is not empty
- trapType is one of the 4 valid values

If validation fails: retry the generation API call once. If it fails again: show user an error — "Couldn't generate good questions for this article. Try a different article or shorten it."

**Layer 2 — User feedback per question**

After each debrief, show a small feedback row below the verdict card:
- "Was this question fair?" — thumbs up / thumbs down
- If thumbs down: "What was wrong?" — 3 options: "Question was unclear" | "Options were ambiguous" | "Answer seemed wrong"

Store this in DB. Questions with >30% thumbs-down rate are flagged for review.

**Layer 3 — Self-audit prompt (optional, runs async)**

After question generation, send a second API call (async, doesn't block the user) asking Claude to review its own questions:

```
Review these 4 questions you generated for this article. For each:
1. Is the correct answer clearly supported by the sourceLines?
2. Is the trap option genuinely tempting (not obviously wrong)?
3. Could a reasonable CAT aspirant argue the trap is correct?

Rate each question 1-3. Questions rated 1 are likely to confuse users unfairly.
Return JSON: [{ "questionIndex": 0, "qualityScore": 2, "concern": "..." }]
```

Flag quality score 1 questions before showing. In Phase 1 just log these; in Phase 2 replace flagged questions automatically.

---

## Phased Build Plan

### Phase A — Article Ingestion + Question Generation Backend
**Goal**: Working API that accepts article text and returns 4 valid CAT-style questions.

Tasks:
- Create `coach_sessions` and `coach_attempts` tables
- `POST /api/coach/generate` endpoint with question generation prompt
- JSON validation and retry logic
- Article word count validation (300–1200 words)
- Unit test: send 5 different articles, verify all return valid JSON structure

**Done when**: 5 different articles generate valid, parseable question sets every time.

---

### Phase B — Question Generation Frontend
**Goal**: User can paste an article and see the 4 generated questions. No debrief yet.

Tasks:
- `/coach` route with article input screen
- Word counter, validation, submit flow
- Loading state ("Reading article..." with progress message rotation)
- Practice screen layout: article panel + question panel
- Static option selection (no debrief, just correct/wrong reveal)
- Session summary screen (basic)

**Done when**: User can paste The Economist article, get questions, answer them, see correct/wrong.

---

### Phase C — Socratic Debrief (Core Feature)
**Goal**: Full multi-turn conversation after option selection.

Tasks:
- `POST /api/coach/exchange` endpoint with Socratic prompt
- Full conversation history management (server-side, stored per attempt)
- Exchange counter logic (1 through 4, reveal on 4)
- Chat UI component: tutor + student bubbles, input, send
- "I give up" button handling
- Final verdict card after debrief closes
- Source line highlighting in article after debrief

**Done when**: Complete 3 full sessions (12 questions) with the Socratic loop working correctly — AI genuinely challenges weak reasoning and doesn't reveal the answer early.

---

### Phase D — Session Logging + Coach Dashboard
**Goal**: All coach sessions saved, accessible in dashboard.

Tasks:
- Save full conversation_json per attempt
- `GET /api/coach/history` endpoint
- Coach tab in Dashboard
- Per-session summary cards
- Accuracy and exchanges-needed charts
- Past session review (click to see full conversation)

**Done when**: After 5 sessions, the dashboard correctly shows accuracy trend and exchanges-needed trend.

---

### Phase E — Quality Control + URL Scraping
**Goal**: Improve question quality and add URL input mode.

Tasks:
- User thumbs-up/down feedback per question
- Store quality feedback in DB
- Async self-audit prompt (quality score)
- Log flagged questions
- URL input tab
- `@mozilla/readability` + `jsdom` integration for article extraction
- Article preview + edit before generating questions

**Done when**: URL scraping works on 10 test URLs (Economist, Aeon, Atlantic). Quality feedback is stored and visible in server logs.

---

## Cost Per Session

One session = 1 article + 4 questions with Socratic debrief.

**Tokens per session:**

| API Call | Input tokens | Output tokens |
|---|---|---|
| Question generation (×1) | ~2,200 | ~700 |
| Socratic exchange (×avg 2.5 per question × 4 questions) | ~2,000 each | ~120 each |
| Total exchanges: ~10 | ~20,000 | ~1,200 |
| **Session total** | **~22,200** | **~1,900** |

**Cost per session on different models:**

| Model | Input cost | Output cost | Per session | Per week (3 sessions) |
|---|---|---|---|---|
| Gemini Flash-Lite | $0.10/M | $0.40/M | $0.003 | $0.009 |
| GPT-4o mini | $0.15/M | $0.60/M | $0.004 | $0.013 |
| Gemini 2.5 Flash | $0.30/M | $2.50/M | $0.011 | $0.034 |
| Claude Haiku 4.5 | $1.00/M | $5.00/M | $0.032 | $0.095 |
| Claude Sonnet 4.6 | $3.00/M | $15.00/M | $0.095 | $0.285 |

**Recommendation**: The Socratic loop demands more nuanced conversation than the VARC trainer. GPT-4o mini is genuinely good at this (conversational, targeted pushback). Claude Haiku is better but at 8x the cost of GPT-4o mini for the same session. For a premium feature, Haiku is the right call. For free users, GPT-4o mini works well.

**Prompt caching saves significantly here**: The full article text is sent with every exchange call. With prompt caching, after the first call, the article tokens cost 10% of normal. Over 10 exchanges on the same article, this can cut 40–50% off the total session cost.

---

## Article Source Recommendations (For Users)

Tell your users where to find good CAT-level articles to practice with. Include this as an in-app guide:

**High match with CAT style:**
- The Economist (any article, all sections)
- Aeon.co (philosophy, science, society)
- Nautilus Magazine (science and ideas)
- The Atlantic (long-form commentary)
- Project Syndicate (economics and policy)

**Medium match:**
- New Yorker (sometimes too literary/cultural)
- Harvard Business Review (good for economics topics)
- Foreign Affairs (international relations)

**Avoid:**
- News articles (too factual, not argumentative enough)
- Wikipedia (no authorial voice or argument structure)
- Technical papers (too domain-specific)

---

## What Makes This a Moat

Three things that are genuinely hard to copy:

**1. The conversation design, not the technology.** Any developer can call an AI API. The hard part is designing a Socratic loop that actually feels like a tutor — knowing when to challenge, when to validate, when to redirect, and how to sequence questions across 4 exchanges. This is product design work that takes iteration. Your first version will be imperfect. By the time a competitor notices, you'll have iterated 20 times.

**2. You are the user.** Every student testing this is validating assumptions you've already lived through. You know what CAT questions feel like, you know what traps feel like, you know what it feels like when a tutor helps vs. when they just give answers. That intuition goes directly into prompt design and UI decisions.

**3. The data.** Every conversation is logged. Over thousands of sessions, you'll have data on which question types trip students up, which trap types are most dangerous, which Socratic moves actually help. This becomes a feedback loop for improving the AI prompts in ways a competitor starting from zero cannot replicate quickly.

---

## Integration With the Existing VARC Trainer

Both products live in the same app. The recommended navigation:

```
Home
├── Practice Mode (VARC Trainer — existing)
│   ├── Analysis Mode
│   └── Intuition Mode
├── Reading Coach (new)
│   ├── Paste Article
│   └── Enter URL
└── Dashboard
    ├── Practice Stats
    └── Coach Stats
```

Shared: sessions table, user identity (if you add auth later), dashboard.
Separate: question bank vs article bank, attempt tables, feedback mechanisms.

The pitch to users: "Use the VARC Trainer daily for 20 minutes to drill option differentiation. Use the Reading Coach 3 times a week with a full article to build comprehension and reasoning. These two together cover everything VARC tests."
