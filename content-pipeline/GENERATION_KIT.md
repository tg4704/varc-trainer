# Generation Kit — run these in Claude chat (Opus 4.8)

> **Using a Claude Project?** There are now TWO — use [`PROJECT_INSTRUCTIONS_COACH.md`](PROJECT_INSTRUCTIONS_COACH.md)
> for full passages and [`PROJECT_INSTRUCTIONS_DRILLS.md`](PROJECT_INSTRUCTIONS_DRILLS.md) for drills.
> They're this kit condensed into always-on custom instructions, so each chat is a one-liner and the
> PYQ corpus is wired in. This file is the **standalone / reference** version: self-contained
> prompts for a plain chat (no Project), and the fuller explanation of what each prompt does.

You generate content manually in Claude chat, then paste the JSON into the admin importer
(`/admin/import`). These prompts are **self-contained** — the chat doesn't have our repo, so
everything it needs is embedded. Use **Opus 4.8**.

## Workflow

1. Open Claude chat → select **Opus 4.8**.
2. Paste **Prompt A** (full passage → ② Coach) or **Prompt B** (short drills → ③ Drills),
   filling in the `TOPIC`/`GENRE`/`COUNT` at the top.
3. It returns JSON. In the **same chat**, paste **Prompt C (validator)**.
4. Keep only items the validator marks `pass`. Regenerate or drop the rest.
4b. **Run the repo validator** on the JSON before importing — it checks the batch against the
   measured corpus (option-length tell, answer position, type quota, passage rhythm/texture):

   ```bash
   node content-pipeline/validate-content.js batch.json
   ```

   It exits non-zero on any FAIL. It also accepts an **admin export**
   (`{passages, questions}`) so you can audit content already in the bank.
5. Paste the final JSON into `/admin/import`. Items land **inactive** for your review, then you
   activate them.
6. Repeat for variety. **Target mix follows real CAT (2022–2025): except_set + hypothetical are the
   two dominant shapes**, then function / inference / application / assumption / vocab; tone rare,
   pure detail near-banned. Topic mix follows real CAT: history/archaeology 30%, science 19%,
   society 16%, art/literature 11%, economics 8%, technology 7%, language 6%, philosophy 2%.

Legal: never paste real CAT/GMAT/Aeon/news passage text into the prompt. Topics only. The output
must be original expression.

---

## Shared reference (embedded in the prompts below — here for your understanding)

**Distractor archetypes** (correct option = no tag; every wrong option carries exactly one):

| tag | what it is | BEAST |
|---|---|---|
| `too_extreme` | absolute modifiers (always/never/all/only) | **E**xtreme |
| `out_of_scope` | concept never in the passage | **A**lien |
| `too_broad` | true but too general to answer *this* stem | **B**road |
| `partially_correct` | a true detail offered as the main point | **S**ide-track |
| `tone_mismatch` | facts fit but tone/stance clashes with author | **T**one |
| `real_but_unstated` | true in general, passage never claims it | — |
| `distortion` | reverses a relationship the passage states | — |
| `wrong_question` | accurate but answers a different stem | — |
| `wrong_location` | true, but stated in a different part of the passage | — |
| `mislabelled` | right content, wrong label attached | — |
| `wordplay` | puns on the term's surface form | — |

**Rule:** if a wrong option needs no tag to explain why it's wrong, it's too obviously wrong —
regenerate it. At most ONE distractor per question may use absolute words.

---

## PROMPT A — Full passage for ② Coach (paste, edit the top line)

```
TOPIC = history   |   GENRE = archaeology   |   QUESTIONS = 4

You are a CAT VARC item-setter. Produce ONE reading passage and its questions in the exact
register and difficulty of CAT Reading Comprehension. Output ONLY valid JSON (schema at the end).

PASSAGE (500–540 words — real CAT: median 518, IQR 506–525):
- On the TOPIC/GENRE above. Original text only — do not reproduce any real article.
- Imply the thesis; do NOT announce it ("This essay argues…" is banned).
- Include a counterposition, then a qualification that partially concedes.
- Measured authorial stance (e.g. skeptical-but-fair), not cheerleading or dismissive.
- Embed one in-context academic term and one non-linear move (aside / concession / reversal).
- Dense but grammatical. No lists, no headings.
- MUST be 3–5 distinct paragraphs separated by a blank line (\n\n in the JSON string) — never
  one unbroken block. Each paragraph plays a DIFFERENT rhetorical role relative to the thesis:
  sets up / supports / complicates-qualifies / reverses-counters / synthesizes. No two adjacent
  paragraphs share a role, and at least one paragraph must push AGAINST the direction of the
  previous one (concession, counterexample, reversal) — this positive/negative tracking across
  paragraphs is the actual CAT skill being tested.

READING KEY — MANDATORY. This is the answer key for the reading-map step: the student writes a
map BEFORE seeing any question, and the grader scores it against this. A missing or empty key
does not fail loudly — the grader just silently grades against "undefined" and produces
confident-sounding commentary that measures nothing. All four fields are required and the
importer rejects the set outright if any are missing, empty, or the wrong shape.
- thesis: the author's actual ARGUMENT in one sentence (not the topic). Non-empty string.
- tone: a short phrase. Non-empty string.
- paragraph_functions: an array with EXACTLY ONE ENTRY PER PARAGRAPH of the body, in order.
  Each states what that paragraph DOES (sets up / concedes / reverses / illustrates /
  qualifies), never what it is about. If the body has 4 paragraphs this array has 4 entries —
  a count mismatch is a hard import rejection, because it means the key doesn't describe
  this passage and the grader's "structure" band becomes meaningless.
- key_turn: the single pivotal shift/tension a strong reader must catch. Non-empty string.
  This is what separates argument-mapping from information-gathering — be specific about
  WHERE it happens and what a reader who misses it would wrongly conclude.

QUESTIONS (produce {QUESTIONS}) — GENERATE TO THE REAL CAT DISTRIBUTION, not the easy four.
CAT RC (measured 2022–2025) is dominated by EXCEPT-format and hypothetical-logic questions; bare
tone/title questions are rare. Types: except_set, hypothetical, function, inference, assumption,
application, vocab_in_context, main_idea, tone, detail.
- TYPE QUOTA (hard): the set MUST contain ≥1 except_set, ≥1 hypothetical (if true/false →
  weaken/strengthen/invalidate/contradict), ≥1 function, ≥1 inference. tone ≤1. Bare "which title
  fits?" and pure detail/retrieval are BANNED. For {QUESTIONS}≥5 add application/assumption/vocab.
  A set that is all inference/tone/title/detail is an automatic reject.
- Stem shapes (reword, never copy): except → "All of the following … EXCEPT"; hypothetical →
  "Which observation would most strengthen the claim that…?" / "…if true, would weaken … EXCEPT
  that…" / "Which result would invalidate X's inference?"; function → "What does the author wish to
  communicate by referring to X?" / "The author uses the example of X to illustrate that…";
  inference → "The author is least likely to agree with…"; assumption → "Which assumption is most
  necessary for that to hold?"; vocab → "best substitute for '<word>'" / "closest to the OPPOSITE
  of '<term>'"; main_idea → "which set of terms is closest to the key arguments?" / "odd pair out".
- Each question: exactly ONE defensible correct option + THREE distractors, each tagged with one
  archetype: too_extreme | out_of_scope | too_broad | partially_correct | tone_mismatch |
  real_but_unstated | distortion | wrong_question | wrong_location | mislabelled | wordplay.
- OPTION CRAFT (where CAT difficulty lives — enforce ALL): (1) DECORRELATE LENGTH FROM TRUTH —
  real CAT options vary ~32% in length, but the answer is the longest only 20% of the time (below
  random). Across a set the correct option may be longest at most once and must be shortest at
  least once. Keep options short (median 9–16 words). The answer must not be the only hedged option. (2) parallel grammar/
  register across all four. (3) distractors BUILT FROM THE PASSAGE's own words — a true claim from
  the wrong paragraph (wrong_location), a real detail answering a different stem (wrong_question), a
  stated relation reversed (distortion); generic outside-the-text absolutes are BANNED. (4) EXCEPT:
  three options are genuinely passage-supported statements, the answer is the one that isn't. (5)
  weaken/strengthen: four parallel hypothetical findings, only one bears on the specific claim; some
  describe the OPPOSITE result. At most ONE distractor per question may use absolute words.
- Mark the single most-dangerous distractor as the "primary trap" (isTrap:true); it sets
  trapIndex/trapType. Other wrong options have isTrap:false but still carry a trapType tag.
- correctIndex points to the correct option; give sourceLines that justify it.

OUTPUT JSON (exactly this shape):
{
  "kind": "passage_set",
  "passage": {
    "topic": "<economics|history|humanities|philosophy|science|social>",
    "genre": "<free text>",
    "title": "<short>",
    "body": "<the passage>",
    "reading_key": {
      "thesis": "...", "tone": "...",
      "paragraph_functions": ["¶1: ...", "¶2: ...", "..."],
      "key_turn": "..."
    }
  },
  "questions": [
    {
      "type": "inference",
      "question": "...",
      "options": [
        {"text":"...","isCorrect":true,"isTrap":false,"trapType":null},
        {"text":"...","isCorrect":false,"isTrap":true,"trapType":"distortion"},
        {"text":"...","isCorrect":false,"isTrap":false,"trapType":"too_extreme"},
        {"text":"...","isCorrect":false,"isTrap":false,"trapType":"out_of_scope"}
      ],
      "correctIndex": 0,
      "trapIndex": 1,
      "trapType": "distortion",
      "sourceLines": "...",
      "rationaleCorrect": "...",
      "rationaleEachWrong": ["...","...","..."]
    }
  ]
}
```

---

## PROMPT B — Short drills for ③ Drills (paste, edit the top line)

```
TOPIC = history   |   COUNT = 5   |   DIFFICULTY = medium

You are a CAT VARC item-setter. Produce {COUNT} standalone single-question RC drills, each a
SHORT paragraph (90–120 words) with ONE question, at {DIFFICULTY} difficulty. CAT register. Output
ONLY valid JSON (schema at the end). Original text only — never reproduce real articles.

Each paragraph: a self-contained argument with an implied point and a measured tone. Write it with
3–4 distinct claims so it can carry EXCEPT / function / hypothetical questions, not just inference.
Each question: exactly ONE defensible correct option + THREE tagged distractors.

TYPE QUOTA across the {COUNT} items (hard — do NOT make them all inference): at least ⌈COUNT/4⌉
must be except_set or hypothetical (the two dominant CAT shapes); include ≥1 function when COUNT≥4;
spread the rest across inference/application/assumption/vocab_in_context/main_idea; tone ≤1; bare
"which title fits?" and pure detail/retrieval are BANNED. Types: except_set, hypothetical, function,
inference, assumption, application, vocab_in_context, main_idea, tone.

OPTION CRAFT (enforce ALL — this is where difficulty lives): DECORRELATE length from correctness
(real CAT: answer is longest only 20% of the time, below random; median option 12 words). Across the
batch the answer must be longest in <=25% of items and shortest in some; never the only hedged one; parallel grammar across all four; distractors
BUILT FROM THE PARAGRAPH's own words (wrong_location / wrong_question / distortion), never generic
outside-the-text absolutes; for EXCEPT, three options are genuinely paragraph-supported and the
answer is the one that isn't. Same archetype list as CAT; at most one absolute-word distractor. Mark
the most-dangerous distractor isTrap:true (sets trapIndex/trapType); others isTrap:false but tagged.

Calibrate every item to {DIFFICULTY} and set each item's "difficulty" field to it — the level
governs BOTH the paragraph AND the question, never an easy question on a dense paragraph:
- easy: PLAIN paragraph — state the point fairly directly (relax the "implied point" rule here),
  short-to-medium sentences, no dense jargon, no reversal/aside. The question tests a light
  inference or a clear paraphrase of a stated idea; the correct option closely restates the text;
  the trap is clearly over-stated or off-topic (a careful reader rejects it fast).
- medium: true exam level; the correct option needs a real inferential step; the trap differs from
  the answer by scope or emphasis and is tempting to a 90th-percentile student.
- tough: denser paragraph; the answer turns on a subtle distinction (scope, degree, which claim is
  actually supported); the trap is a near-miss (real_but_unstated / partially_correct) that would
  catch a 95th-percentile student.

Vary topics/subtopics across the {COUNT} items and skew the type mix toward inference.

OUTPUT JSON (every item MUST include "difficulty"):
{
  "kind": "drills",
  "items": [
    {
      "topic": "<economics|history|humanities|philosophy|science|social>",
      "difficulty": "<easy|medium|tough>",
      "paragraph": "<90–120 words>",
      "type": "inference",
      "question": "...",
      "options": [
        {"text":"...","isCorrect":true,"isTrap":false,"trapType":null},
        {"text":"...","isCorrect":false,"isTrap":true,"trapType":"partially_correct"},
        {"text":"...","isCorrect":false,"isTrap":false,"trapType":"too_extreme"},
        {"text":"...","isCorrect":false,"isTrap":false,"trapType":"out_of_scope"}
      ],
      "correctIndex": 0,
      "trapIndex": 1,
      "trapType": "partially_correct",
      "sourceLines": "...",
      "rationaleCorrect": "...",
      "rationaleEachWrong": ["...","...","..."]
    }
  ]
}
```

---

## PROMPT C — Validator (paste AFTER A or B, in the same chat)

```
Now switch roles: you are a RUTHLESS CAT answer-key auditor. Audit every question you just
produced against these gates. Be adversarial — assume it's wrong until proven otherwise.

1. ONE-ANSWER GATE (most important): is there EXACTLY ONE defensible answer? If a smart,
   evidence-driven test-taker could justify any other option from the text → FAIL.
2. SUPPORT GATE: is the keyed-correct option fully supported by the sourceLines? If it needs
   outside knowledge or an unsupported leap → FAIL.
3. RETRIEVAL GATE: is it answerable by keyword-matching rather than inference/structure → FAIL.
4. DISTRACTOR GATE: does every wrong option have a concrete reason matching its tag, AND is none
   of them secretly also-correct? Over-reliance on absolute words (>1 per question) → FAIL.
4b. OPTION-CRAFT GATE: all four options within ±15% length, parallel in form, correct one NOT the
   longest/only-hedged, distractors built from passage material (not outside absolutes)? else FAIL.
4c. TYPE-QUOTA GATE: does the set/batch carry ≥1 except_set and ≥1 hypothetical (plus ≥1 function
   for a passage_set or COUNT≥4 batch), tone ≤1, and no bare-title/pure-detail item? else FAIL.
5. READING-KEY GATE (passage_set only): do paragraph_functions describe FUNCTION (not topic),
   and does thesis capture the argument (not the subject)? Also COUNT them: there must be
   exactly one entry per body paragraph, in order. And confirm thesis / tone / key_turn are
   all present and non-empty — an empty `reading_key: {}` passes a naive "is it an object"
   check but breaks grading silently.
6. STRUCTURE GATE (passage_set only): does the body actually contain 3-5 paragraphs separated
   by blank lines (`\n\n`)? A single unbroken block is a hard import rejection — Coach asks the
   student for one crux entry per paragraph, so one block gives them one box and leaves the
   grader nothing to score.

For each question return: { index, verdict: "pass"|"fail", failed_gates:[...], reason,
fixed_question? }  — if fixable, include the corrected question in the SAME output JSON shape so
I can use it directly. Then output the FULL corrected JSON of only the passing/fixed items.
```

---

## Import contract — what gets HARD-REJECTED

`POST /api/admin/import` (`server/routes/admin.js`) validates shape before writing anything. A
`passage_set` is rejected outright — nothing is inserted — if any of these fail:

| Rule | Why |
|---|---|
| `passage.body` has 3–5 paragraphs separated by blank lines | Coach's reading map is one crux entry per paragraph; a single block leaves the grader's structure band nothing to score |
| `reading_key.thesis` / `.tone` / `.key_turn` are non-empty strings | an empty `{}` used to pass the old `typeof === "object"` check and silently broke grading |
| `reading_key.paragraph_functions` is a non-empty array of non-empty strings | same |
| `paragraph_functions.length` equals the body's paragraph count | a mismatch means the key doesn't describe this passage |
| every question passes `validateQuestionPayload` | one bad question rejects the whole set (atomic) |

Soft (imported anyway, reported in `errors[]`): body outside 480–560 words (the importer keeps the
wider 480–560 gate; the prompts aim tighter at 500–540, real CAT's IQR).

> These mirror the rules above. If you change one, change both — the prompt and the importer are
> two halves of the same contract, and the 2026-07-20 QA found the gap between them the hard way
> (all 5 seeded passages had `reading_key_json = '{}'`; they were hand-inserted and never went
> through this importer, which at the time would have accepted them regardless).

## Notes for import

- The importer sets `source='ai_generated'`, `is_active=0` (inactive), assigns question IDs, and
  for `passage_set` links every question to the new passage via `passage_id` and copies the
  passage body into each question's `paragraph`.
- Review inactive items in `/admin/questions` (and the passages view) → activate the good ones.
- `word_count` is computed at import; you don't need to supply it.
