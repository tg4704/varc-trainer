# VARC Option Differentiation Trainer — Phased Build Prompt for Claude Code

## What You Are Building

A web application that trains CAT aspirants to stop picking trap options in Reading Comprehension questions. The core insight: most students fail VARC not because they can't read, but because they can't distinguish the correct option from a carefully designed trap.

This app isolates that skill. It presents a short paragraph (not a full RC passage), a question, and 4 options. The user picks an answer, explains their reasoning, and receives structured AI feedback that evaluates HOW they thought — not just WHAT they picked.

---

## Architecture Overview

- **Frontend**: React (Vite), Tailwind CSS, React Router v6
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3`
- **AI**: Anthropic Claude API (`claude-haiku-4-5`) — used ONLY for reasoning evaluation, never for finding the correct answer
- **Language**: Plain JavaScript throughout, no TypeScript

---

## Data Design Philosophy (Read Before Writing Any Code)

### Why Short Paragraphs, Not Full RC Passages

This app does NOT use full RC passages. Each question is anchored to a **short paragraph of 5–7 lines (~90–120 words)**. This is a deliberate product decision:

The app trains option differentiation as an isolated skill. With a short paragraph, the user has no excuse — they can re-read it in 10 seconds. If they still pick the trap, the failure is definitively in how they read options, not how they read passages. Full passages introduce reading fatigue and retention as confounding variables, which muddies what is being trained.

### Source Lines Field

Each question also has a `sourceLines` field: 3–4 sentences from the paragraph that directly contain the answer. This is NOT shown to the user during the question. It is used in the AI prompt so Claude knows exactly where the answer comes from, making the reasoning evaluation more precise.

### Question Data Format

```javascript
{
  id: "q001",
  topic: "economics",           // 'economics' | 'humanities' | 'philosophy' | 'science' | 'social'
  paragraph: `...90-120 word paragraph text...`,
  question: "Which of the following can be most reasonably inferred?",
  type: "inference",            // 'inference' | 'tone' | 'title' | 'detail' | 'application'
  options: [
    { text: "...", isCorrect: false, isTrap: true,  trapType: "too_extreme" },
    { text: "...", isCorrect: true,  isTrap: false, trapType: null },
    { text: "...", isCorrect: false, isTrap: false, trapType: null },
    { text: "...", isCorrect: false, isTrap: false, trapType: null }
  ],
  correctIndex: 1,
  trapIndex: 0,
  trapType: "too_extreme",      // 'too_extreme' | 'out_of_scope' | 'real_but_unstated' | 'partially_correct'
  sourceLines: "...the 3-4 specific lines from which the answer is drawn..."
}
```

### Option Construction Rules (Critical)

Every question must have:
- **1 correct option**: Requires inference or judgment, not direct recall
- **1 trap option**: Either too extreme, out of scope, true-in-real-world-but-not-stated, or partially correct — must feel genuinely tempting to a 90-percentile student
- **2 distractor options**: Clearly wrong but not obviously so

Option text rules:
- 12–25 words each
- No "always", "never", "completely", "only", "entirely" in the correct option (these are giveaways it's wrong)
- Those absolute words ARE allowed in trap and wrong options
- Same register and vocabulary as the paragraph

### Question Type Distribution (Across the Full Bank)

- Inference: 35%
- Tone/Attitude: 20%
- Title/Main Idea: 15%
- Detail with trap: 15%
- Application: 15%

### Seed Data Requirement

Write **25 questions across 5 topic areas** (5 per topic) in `server/data/questions.js`. Each question has its own paragraph — questions are not grouped by passage. This is different from standard RC. Every question is self-contained.

Write real content. No placeholders. These must pass the quality bar of: "would a serious CAT student find this genuinely tricky?"

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  selected_option_index INTEGER NOT NULL,
  correct_option_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,           -- 0 or 1
  trap_option_index INTEGER,
  trap_type TEXT,
  selected_trap INTEGER NOT NULL,        -- 0 or 1 (did they pick the trap specifically)
  reasoning_text TEXT,                   -- null until Phase 4
  reasoning_score INTEGER,              -- 1-5, null until Phase 4
  reasoning_feedback TEXT,              -- Claude's feedback, null until Phase 4
  trap_explanation TEXT,                -- Claude's trap deconstruction, null until Phase 4
  correct_explanation TEXT,             -- Claude's correct answer explanation, null until Phase 4
  key_takeaway TEXT,                    -- Claude's one-line lesson, null until Phase 4
  mode TEXT NOT NULL DEFAULT 'analysis', -- 'analysis' | 'intuition'
  time_taken_seconds INTEGER,
  eliminated_indices TEXT,             -- JSON array, used in intuition mode
  intuition_points INTEGER,            -- null unless intuition mode
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

---

# PHASE 1 — Backend Foundation

**Goal**: Working Express server, SQLite database, question data, and basic API routes. No frontend. Test everything with curl or Postman.

## Project Setup

```
varc-trainer/
├── server/
│   ├── index.js
│   ├── db.js
│   ├── data/
│   │   └── questions.js       ← write all 25 questions here
│   └── routes/
│       ├── sessions.js
│       └── questions.js
├── .env
└── package.json
```

## package.json (server)

```json
{
  "name": "varc-trainer-server",
  "type": "commonjs",
  "scripts": {
    "dev": "nodemon server/index.js",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@anthropic-ai/sdk": "^0.20.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.3"
  }
}
```

## server/db.js

Initialize SQLite. Create both tables on startup. Export the db instance.

## server/data/questions.js

Write all 25 questions here using the data format defined above. 5 questions each for: economics, humanities, philosophy, science, social. Every question must have a unique id (q001–q025), a real paragraph, real options, correct trapType labeling.

## API Routes for Phase 1

### POST /api/sessions
Creates a new session. Returns `{ sessionId: number }`.

### GET /api/questions/next?sessionId=X
Logic:
1. Fetch all question IDs already attempted in this session from the attempts table
2. Return a random question the user hasn't seen yet
3. If all 25 are seen, return questions from the user's weakest type first (lowest accuracy)
4. Never return the `correctIndex`, `trapIndex`, `sourceLines` fields to the client — these are server-only
5. Return: `{ id, topic, paragraph, question, type, options: [{ text }] }` — options have text only, no isCorrect, no isTrap

### POST /api/attempts/basic
Saves a basic attempt (Phase 1 — no reasoning, no AI). Body:
```json
{
  "sessionId": 1,
  "questionId": "q001",
  "selectedOptionIndex": 2,
  "timeTakenSeconds": 45,
  "mode": "analysis"
}
```
Server looks up the question, determines correctness, saves to DB, returns:
```json
{
  "isCorrect": true,
  "correctOptionIndex": 1,
  "trapOptionIndex": 0,
  "trapType": "too_extreme",
  "selectedTrap": false
}
```

## Phase 1 Done When:
- [ ] Server starts without errors
- [ ] POST /api/sessions returns a sessionId
- [ ] GET /api/questions/next returns a question without leaking correct/trap info
- [ ] POST /api/attempts/basic saves to DB and returns correct feedback
- [ ] All 25 questions are written and valid

---

# PHASE 2 — Frontend Foundation

**Goal**: React app scaffolded, routed, styled, with placeholder UI. No API calls yet. Just structure and navigation.

## Project Setup

```
varc-trainer/
├── client/
│   ├── index.html
│   ├── vite.config.js         ← proxy /api to localhost:3001
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Practice.jsx
│   │   │   └── Dashboard.jsx
│   │   └── components/
│   │       ├── OptionCard.jsx
│   │       ├── FeedbackCard.jsx
│   │       ├── TopicBadge.jsx
│   │       └── TypeBadge.jsx
```

## vite.config.js

Proxy all `/api` requests to `http://localhost:3001` during development.

## Routing

- `/` → Home
- `/practice` → Practice
- `/dashboard` → Dashboard

## Home Page

- Headline: "Stop picking the trap option."
- Subheadline: "Most CAT students know the passage. They still pick the wrong answer. This trains the skill that fixes that."
- Single CTA: "Start Practice"
- Three value prop cards below: "Reasoning evaluated, not just answers" / "Every trap option deconstructed" / "Your exact weakness identified"
- On load: check localStorage for existing sessionId. If found, show "Continue Session" link.

## Practice Page Layout

Two-column layout on desktop (≥768px), stacked on mobile.

**Left column (55% width):**
- Topic badge (color-coded by topic)
- Paragraph text — 16px, line-height 1.85, max-width 600px, comfortable reading font
- A subtle elapsed timer in top-right of this column

**Right column (45% width):**
- Question type badge
- Question text (bold, 17px)
- 4 option cards stacked vertically — each is a clickable card with:
  - Hover state: border highlight
  - Selected state: filled background
  - Letter label (A/B/C/D) on the left
  - Option text on the right
  - Before submission: no correct/wrong color
  - After submission: correct = green, selected-wrong = red, unselected-correct = green-outlined
- Submit button at the bottom (disabled until option selected)
- In Phase 2 this is placeholder — button just logs to console

## TypeBadge Component

Color-coded pill badges for question types:
- Inference → blue
- Tone → purple
- Title → teal
- Detail → amber
- Application → coral/orange

## TopicBadge Component

Small gray badge showing the topic area.

## Phase 2 Done When:
- [ ] App runs on localhost:5173
- [ ] Navigation between all 3 pages works
- [ ] Practice page layout renders correctly on desktop and mobile
- [ ] Option cards have correct hover/selected states
- [ ] No API calls yet — all data is hardcoded placeholder

---

# PHASE 3 — Core Practice Loop (No AI)

**Goal**: Full working practice loop. User can answer questions, see correct/wrong feedback, session is tracked. No reasoning input, no AI. This is the minimum usable product.

## What Changes

### Frontend

**Practice.jsx** — wire up real API calls:

1. On page load: call `POST /api/sessions` if no sessionId in localStorage. Store sessionId.
2. Call `GET /api/questions/next?sessionId=X` to get first question. Store in state.
3. When user selects an option and clicks submit:
   - Call `POST /api/attempts/basic` with sessionId, questionId, selectedOptionIndex, timeTakenSeconds, mode: 'analysis'
   - Show feedback inline without page reload
4. Feedback shown directly below the options (no separate card yet):
   - Large "Correct" or "Incorrect" text
   - Option cards update colors (green/red)
   - Show which option was the trap and what type it was
   - Simple text: "The trap was option B — it was [trapType description]"
5. "Next Question" button loads the next question via another API call
6. Timer: start when question loads, stop when submit is clicked, send timeTakenSeconds to API

**Trap type descriptions** (for display):
- `too_extreme` → "Too extreme — used absolute language the passage doesn't support"
- `out_of_scope` → "Out of scope — introduced an idea not discussed in the paragraph"
- `real_but_unstated` → "True in general, but the paragraph never actually says this"
- `partially_correct` → "Partially right — but misses a key qualification the author makes"

### No Reasoning Input Yet
No textarea, no AI call. Phase 3 is purely about getting the question → answer → feedback loop working end-to-end.

### Session State in localStorage
```javascript
{
  sessionId: 12,
  questionsAnswered: 0,
  correctCount: 0
}
```
Update after every submission.

### Basic Dashboard (Phase 3 version)
Wire up `GET /api/dashboard?sessionId=X` which returns:
```json
{
  "totalAttempts": 10,
  "correctCount": 6,
  "accuracy": 0.60,
  "trapPickRate": 0.30,
  "byType": {
    "inference": { "attempts": 4, "correct": 2 },
    "tone": { "attempts": 3, "correct": 1 }
  },
  "byTopic": {
    "economics": { "attempts": 5, "correct": 3 }
  }
}
```

Dashboard page renders this as simple stat cards and a text list. No charts yet. Just numbers.

## Phase 3 Done When:
- [ ] User can complete a full question loop: load → answer → see feedback → next question
- [ ] Session persists across page refresh via localStorage
- [ ] Correct/wrong option colors update correctly after submission
- [ ] Trap type is shown with a plain-language description
- [ ] Timer works and timeTakenSeconds is saved
- [ ] Dashboard shows real data from the DB
- [ ] Tested with at least 10 questions in sequence

---

# PHASE 4 — AI Reasoning Evaluation

**Goal**: Add the reasoning input field and Claude API integration. This is the core differentiator of the app.

## The AI Design Principle

**Claude is NOT used to find the correct answer.** The correct answer is already known from the question data. Claude is used exclusively to:
1. Evaluate the quality of the student's reasoning process
2. Explain why the correct answer is right (citing the paragraph)
3. Deconstruct why the trap option was tempting and where it breaks down
4. Give one actionable takeaway

This makes the API call token-efficient and the feedback focused.

## New Backend: POST /api/attempts/evaluate

Accepts:
```json
{
  "sessionId": 1,
  "questionId": "q001",
  "selectedOptionIndex": 2,
  "reasoningText": "I chose this because the paragraph says...",
  "timeTakenSeconds": 87,
  "mode": "analysis"
}
```

Server logic:
1. Look up the question from questions.js (has correctIndex, trapIndex, sourceLines)
2. Determine isCorrect, selectedTrap
3. Save attempt to DB immediately (before Claude call) with is_correct, selected_trap filled in, reasoning_text saved, AI fields as null
4. Call Claude API with the evaluation prompt (see below)
5. Parse Claude's JSON response
6. Update the attempt row with reasoning_score, reasoning_feedback, trap_explanation, correct_explanation, key_takeaway
7. Return the full evaluation to the client

If Claude call fails: return what you have (isCorrect, correctIndex) with a message "AI feedback unavailable — your attempt was saved." Never lose the attempt.

## The Claude API Evaluation Prompt

### System Prompt:
```
You are a CAT (Common Admission Test) Reading Comprehension coach. A student has answered an RC question. You already know the correct answer. Your job is to evaluate the QUALITY of the student's reasoning process, explain the correct answer precisely, and deconstruct the trap option.

Respond ONLY with a valid JSON object. No preamble, no markdown fences, no text outside the JSON.

JSON schema:
{
  "reasoningScore": integer 1-5,
  "reasoningFeedback": string,
  "correctExplanation": string,
  "trapExplanation": string,
  "keyTakeaway": string
}

Reasoning score rubric:
1 — No reasoning shown, or circular ("I chose this because it seemed right")
2 — Paraphrased the paragraph but didn't connect it to option logic
3 — Found the right part of the paragraph but made a reasoning error connecting it to the option
4 — Sound reasoning but missed a nuance or used imprecise language
5 — Identified the author's intent, eliminated the trap with a specific reason, arrived at answer through logic

Rules for your response:
- reasoningFeedback: 2-3 sentences on HOW the student thought, not just whether they were right. Be specific.
- correctExplanation: 2-3 sentences. Reference specific lines from the source excerpt. Explain WHY this option is correct, not just that it is.
- trapExplanation: 2-3 sentences. Name the exact flaw. For too_extreme: which word makes it extreme. For out_of_scope: what concept is introduced that wasn't in the paragraph. For real_but_unstated: what the paragraph actually says instead. For partially_correct: what the option gets right and what it misses.
- keyTakeaway: One sentence. A generalizable rule the student can apply to future similar questions.
- Never be vague. Always reference specific words from the options or paragraph.
```

### User Message (constructed server-side):
```
PARAGRAPH:
{paragraph text}

SOURCE LINES (where the answer comes from):
{sourceLines}

QUESTION:
{question text}

QUESTION TYPE: {type}

OPTIONS:
A) {option 0 text}
B) {option 1 text}
C) {option 2 text}
D) {option 3 text}

CORRECT ANSWER: Option {correct letter} — "{correct option text}"
TRAP OPTION: Option {trap letter} — "{trap option text}"
TRAP TYPE: {trapType}
TRAP TYPE MEANING:
- too_extreme: the option uses absolute language (always/never/only/completely) that the paragraph does not support
- out_of_scope: introduces a concept or claim not present in the paragraph
- real_but_unstated: may be true in the world but the paragraph does not say or imply it
- partially_correct: captures part of the author's point but misses a key qualification or nuance

STUDENT SELECTED: Option {selected letter}
STUDENT'S REASONING:
{reasoningText}
```

## Claude API Call (server/routes/evaluate.js)

```javascript
const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userMessage }]
});

const rawText = response.content[0].text;
const evaluation = JSON.parse(rawText); // wrap in try/catch
```

## Frontend Changes

### ReasoningInput Component (new)

Appears between the option cards and the submit button AFTER an option is selected:

- Label: "Why did you choose this option?"
- Subtext: "Reference the paragraph or the author's logic — 2 to 3 sentences"
- Textarea: min-height 80px, grows with content
- Character counter: shows current count, minimum 50 required
- Submit button text: "Evaluate My Reasoning"
- Submit button disabled until option selected AND reasoning ≥ 50 chars
- While API is loading: button shows spinner + "Evaluating..." text, textarea disabled

### FeedbackCard Component (upgraded from Phase 3)

Replace the basic Phase 3 feedback with a structured card:

**Section 1 — Result header**
Large "Correct ✓" (green) or "Incorrect ✗" (red). Show the correct option text highlighted in green.

**Section 2 — Reasoning Score**
Label: "Your Reasoning"
Show 1–5 filled/empty circles (not stars — circles feel less judgmental)
Below: reasoningFeedback text in normal weight

**Section 3 — Why the correct answer is right**
Blue-tinted card
Label: "Why this is correct"
Text: correctExplanation

**Section 4 — Why the trap fooled you**
Amber-tinted card
Label: "The trap: [trap option text]"
Subtext: trapType in plain language (use the descriptions from Phase 3)
Text: trapExplanation
Only show this section if the student either selected the trap OR got the question wrong. Always show it if they were correct too — they should know which was the trap even if they got it right.

**Section 5 — Key Takeaway**
Distinct highlighted callout box (slightly elevated background)
Label: "Remember this"
Text: keyTakeaway

**Next Question button** at bottom of feedback card.

### Loading State

While waiting for Claude response:
- Options are frozen (no interaction)
- Submit button replaced with a loading indicator
- Small text below: "Analyzing your reasoning..."
- Do NOT show a blank screen or hide the paragraph

## Phase 4 Done When:
- [ ] Reasoning textarea appears after option selection
- [ ] Submit button enforces 50 char minimum
- [ ] Claude API call works and returns valid JSON
- [ ] All 5 feedback sections render correctly
- [ ] Loading state is handled gracefully
- [ ] If Claude API fails, user sees "AI feedback unavailable" and their result is still saved
- [ ] Reasoning score, feedback, and trap explanation are saved to DB
- [ ] Tested with at least 5 questions including both correct and incorrect answers

---

# PHASE 5 — Dashboard and Error Intelligence

**Goal**: A real dashboard that tells the user exactly what their weakness is, not just aggregate accuracy.

## Backend: GET /api/dashboard?sessionId=X

Returns:
```json
{
  "totalAttempts": 24,
  "correctCount": 14,
  "accuracy": 0.583,
  "trapPickRate": 0.25,
  "avgReasoningScore": 3.2,
  "byType": {
    "inference":    { "attempts": 8, "correct": 5, "trapPicked": 1, "avgReasoningScore": 3.8 },
    "tone":         { "attempts": 6, "correct": 2, "trapPicked": 3, "avgReasoningScore": 2.1 },
    "title":        { "attempts": 4, "correct": 3, "trapPicked": 0, "avgReasoningScore": 3.5 },
    "detail":       { "attempts": 4, "correct": 2, "trapPicked": 2, "avgReasoningScore": 2.8 },
    "application":  { "attempts": 2, "correct": 2, "trapPicked": 0, "avgReasoningScore": 4.0 }
  },
  "byTopic": {
    "economics":   { "attempts": 7, "correct": 3 },
    "humanities":  { "attempts": 5, "correct": 4 }
  },
  "byTrapType": {
    "too_extreme":       { "encountered": 8, "fell_for": 2 },
    "real_but_unstated": { "encountered": 6, "fell_for": 4 },
    "out_of_scope":      { "encountered": 5, "fell_for": 1 },
    "partially_correct": { "encountered": 5, "fell_for": 2 }
  },
  "weakestType": "tone",
  "mostDangerousTrap": "real_but_unstated",
  "recentAttempts": [
    {
      "questionId": "q005",
      "questionSnippet": "Which of the following best...",
      "type": "tone",
      "topic": "philosophy",
      "isCorrect": false,
      "selectedTrap": true,
      "trapType": "too_extreme",
      "reasoningScore": 2,
      "reasoningFeedback": "...",
      "correctExplanation": "...",
      "trapExplanation": "...",
      "keyTakeaway": "...",
      "timeTakenSeconds": 112
    }
  ]
}
```

## Dashboard Frontend

**Row 1 — Header stats (4 cards in a row)**
- Total Questions Answered
- Overall Accuracy (as %)
- Trap Pick Rate (as %)
- Average Reasoning Score (as X/5)

**Row 2 — Accuracy by Question Type**
Horizontal bar chart built with plain SVG (no chart library):
- Each bar represents a question type
- Bar width proportional to accuracy
- Color: red if accuracy < 50%, amber if 50–70%, green if > 70%
- Show attempt count next to each bar
- Click a bar to start a filtered session of that type (future feature hook — just log for now)

**Row 3 — Two side-by-side cards**

Left: **Your Trap Weakness**
Show the 4 trap types ranked by "fell for" rate. Highest at top. Each row shows:
- Trap type name + plain language description
- How many times encountered vs fell for (e.g., "fell for 4 of 6")
- A simple fill bar showing the rate
Highlight the worst one with a callout: "This is your biggest blind spot"

Right: **Topic Accuracy**
Simple list of topics with accuracy percentages. Color-coded same as type chart.

**Row 4 — Weakest Area Callout**
Full-width highlighted box:
"Your weakest area is [weakestType] questions. You picked the trap [X] out of [Y] times, and your average reasoning score here is [Z]/5. Your most dangerous trap type is [mostDangerousTrap]."
Button: "Practice [type] questions" (logs to console for now, filtered sessions in a future phase)

**Row 5 — Recent Attempts**
Last 10 attempts as expandable cards. Collapsed state shows:
- Question snippet (first 8 words + "...")
- Type badge, topic badge
- Correct/Incorrect badge
- Reasoning score dots
- Time taken

Expanded state (click to toggle):
- Full question text
- What they selected vs what was correct
- All 5 feedback sections (same as FeedbackCard in Practice)

## Phase 5 Done When:
- [ ] Dashboard loads real data for a session
- [ ] All stat cards show correct numbers
- [ ] SVG bar chart renders correctly for all question types
- [ ] Trap weakness breakdown shows real percentages
- [ ] Weakest area callout identifies the right type
- [ ] Recent attempts expand to show full AI feedback
- [ ] Dashboard works even if user has 0 attempts (empty state with prompts to start)

---

# PHASE 6 — Intuition Mode

**Goal**: A second practice mode that trains fast pattern recognition under time pressure. No reasoning required. Bonus points for eliminating wrong options confidently.

## What Intuition Mode Is

The user gets the same paragraph + question + options, but:
- There is a countdown timer (default 60 seconds, user can set 30/45/60)
- No reasoning textarea — they just pick an answer fast
- Before picking a final answer, they can optionally **eliminate options** they're confident are wrong by clicking an "X" on them
- Points system rewards both correct answers AND confident correct eliminations

## Points System

| Action | Points |
|---|---|
| Correct answer | 10 |
| Correct answer under 30 seconds | +3 bonus |
| Correct elimination of a wrong option | +2 per elimination |
| Eliminating the correct option | -5 |
| Incorrect answer | 0 |
| Time runs out | -2 |

A "correct elimination" means they marked an option as "definitely not this" AND that option was indeed not the correct answer.
Eliminating the correct answer is penalized heavily — this trains them not to be reckless.

## UI for Intuition Mode

**Mode selector on Home page** — before starting a session, two buttons:
- "Analysis Mode" (default) — full reasoning + AI feedback
- "Intuition Mode" — fast, timer-based, points

**Intuition Practice UI:**

The paragraph panel stays the same. The question panel changes:

- Large countdown timer at the top (circular progress ring preferred, or just a large number)
- Timer color shifts: green → amber (under 20s) → red (under 10s)
- Each option card has a small "✕ eliminate" button on the right
  - Clicking it crosses out the option and marks it as eliminated
  - The option is still selectable (they can eliminate AND pick — picking overrides elimination)
  - Eliminated options show a strikethrough text and reduced opacity
  - Can undo elimination by clicking the ✕ again
- Submit button (or auto-submit when timer hits 0)
- No reasoning textarea

**After submission (Intuition mode feedback):**

Much lighter feedback than Analysis mode:
- Correct/Incorrect badge
- Points earned this question (breakdown: base + bonus + eliminations)
- Running total points for the session
- Which was the trap (just the label and trap type — no deep explanation)
- No AI call in intuition mode. Feedback is instant, client-side.
- "Next" button

**Intuition Dashboard Section** (added to Dashboard page):

New tab or toggle: "Analysis" | "Intuition"

Intuition dashboard shows:
- Total points across all intuition sessions
- Average time per question
- Elimination accuracy (correct eliminations / total eliminations as %)
- Most common wrong eliminations (question types they accidentally eliminate correct answers for)

## Backend Changes for Phase 6

POST /api/attempts/basic already handles mode: 'intuition'. Add:
- `eliminatedIndices` — JSON array of indices the user eliminated
- `intuitionPoints` — calculated server-side

Server calculates points and returns them in the response.

## Phase 6 Done When:
- [ ] Mode selector on Home works
- [ ] Intuition mode countdown timer works correctly
- [ ] Option elimination works (cross out, restore, visual feedback)
- [ ] Auto-submit on timer expiry
- [ ] Points calculated correctly on server
- [ ] Lightweight feedback shown after submission (no AI call)
- [ ] Intuition stats shown on Dashboard
- [ ] Tested with 10 questions in intuition mode

---

# PHASE 7 — Polish, Error Handling, and Deployment

**Goal**: Make the app production-ready. Handle all edge cases. Deploy publicly.

## Error Handling Checklist

- [ ] API call fails → show user-friendly message, never lose their attempt
- [ ] Claude returns invalid JSON → catch parse error, return isCorrect result without AI fields
- [ ] Network drops mid-session → localStorage preserves sessionId and question count
- [ ] All 25 questions exhausted → loop back starting with weakest type, show "You've seen all questions — now repeating your weakest areas"
- [ ] Empty session on Dashboard → show empty state with "Start your first session" CTA
- [ ] Question loads but has missing fields → validate question schema on server startup

## Loading States

Every API call must have a visible loading state. Minimum:
- Submit button: shows spinner + "Loading..." text, is disabled
- Dashboard: skeleton cards while data loads
- Next question: paragraph fades out, new one fades in (simple CSS transition)

## Mobile Responsiveness

On screens < 768px:
- Practice page: paragraph on top, question panel below — full width stacked
- Paragraph section is collapsible (default expanded) with a "▲ Hide paragraph" toggle
- Option cards are full width
- FeedbackCard is full width below the question
- Dashboard: stats row scrolls horizontally, charts stack vertically

## Performance

- Debounce the reasoning textarea input (don't trigger re-renders on every keystroke)
- Cache the dashboard data response for 30 seconds (simple in-memory cache on server)
- Lazy load the Dashboard page component (React.lazy)

## Deployment Configuration

**Frontend → Vercel**
- Build command: `cd client && npm run build`
- Output directory: `client/dist`
- Environment variable: `VITE_API_URL=https://your-render-app.onrender.com`

**Backend → Render**
- Build command: `npm install`
- Start command: `node server/index.js`
- Environment variables: `ANTHROPIC_API_KEY`, `PORT=3001`
- Database: SQLite file at `/data/varc.db` (Render persistent disk — $1/month)

**Update vite.config.js** to use `VITE_API_URL` in production and proxy in development.

## Phase 7 Done When:
- [ ] App is live on a public URL
- [ ] All error states handled gracefully
- [ ] Mobile layout tested on actual phone (Safari + Chrome)
- [ ] No console errors in production
- [ ] Claude API key is in environment variables, never in code
- [ ] A complete session (10 questions, analysis mode) works end to end on production

---

# Summary: Build Order

| Phase | What | AI needed? | Estimated effort |
|---|---|---|---|
| 1 | Backend: server, DB, data, basic routes | No | Medium |
| 2 | Frontend: scaffold, routing, static UI | No | Small |
| 3 | Core loop: question → answer → feedback | No | Medium |
| 4 | AI reasoning evaluation + full feedback card | Yes | Large |
| 5 | Dashboard: error intelligence, charts | No | Medium |
| 6 | Intuition mode: timer, eliminations, points | No | Medium |
| 7 | Polish, error handling, deployment | No | Small |

Complete each phase fully before starting the next. Each phase has a "Done When" checklist — do not proceed until all boxes are checked.
