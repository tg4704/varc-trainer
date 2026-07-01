# Reading Grader — the ② Comprehension Trainer core

The differentiator. Before seeing any question, the user submits a **reading map**; the AI
grades the *reading process* and diagnoses **how** they read — not whether an answer is right.
This is what turns the app from a question bank into a coach, and it targets the report's #1
root cause: the "information-gathering fallacy" (finishing a passage with a false sense of
comprehension, having catalogued facts but missed the argument).

## What the user submits (keep it light — friction kills adoption)

The user picks an input **depth** (low friction is the default so people actually do it):

**Quick mode — paragraph crux (default):**
- **4–5 words per paragraph** capturing that paragraph's crux. That's it.
- Mirrors the topper "note 3–5 keywords per paragraph to build a mental map" technique.
- The grader checks whether those crux-words capture each paragraph's *function*, and infers the
  overall thesis/turn from them.

**Full mode (optional, for serious sessions):**
1. **Main point** (one sentence): the author's central claim.
2. **Tone / stance** (a word or short phrase).
3. **Structure map**: one short line per paragraph — *what it does*, not what it's about.
4. *(optional)* **The turn**: the single most important shift/tension in the passage.

> **Write in any language.** The user may summarise in their mother tongue / Hinglish / their own
> broken words — this is the community-loved "mother-tongue verbalization" technique (re-tell each
> paragraph in the language you think in). VARC is logic, not grammar; we grade *understanding*,
> not English. The grader must accept and evaluate non-English / ungrammatical input.

## Canonical key (pre-computed at passage-creation time)

Store a `reading_key` with every ② passage (like `sourceLines` for questions), so grading is
consistent and cheap and doesn't re-derive structure each call:
```
{ thesis, tone, paragraph_functions: [...], key_turn }
```

## Grading rubric (score each band: strong / partial / weak)

| dimension | strong | weak |
|---|---|---|
| **Thesis capture** | states the author's *argument* | restates the *topic* / a detail |
| **Structure grasp** | tags each part's *function* (claim/evidence/counter/qualification) | says what each part is *about* |
| **The turn** | names the pivotal tension/shift | misses it entirely |
| **Reading mode** *(the signature diagnosis)* | argument-mapping | information-gathering |

## Grader prompt

```
You are a CAT VARC reading coach. You are given a passage, its canonical reading_key, and a
student's reading map submitted BEFORE they saw any questions. Grade their READING PROCESS.

RULES:
- Do NOT be generic or encouraging-by-default. If the reading is shallow, say so plainly.
- Diagnose the READING MODE: is the student argument-mapping (tracking claims, evidence, turns)
  or information-gathering (cataloguing topics/facts)? Name it explicitly — this is the point.
- Be specific: quote what they wrote and contrast it with the passage's actual architecture.
- Grade UNDERSTANDING and LOGIC, never grammar or language. The map may be in the student's
  mother tongue, Hinglish, or ungrammatical English — evaluate whether they grasped the argument.
- End with ONE concrete technique they should apply on the very next passage.

Return JSON: {
  reading_mode: "argument-mapping" | "mixed" | "information-gathering",
  thesis: "strong"|"partial"|"weak",
  structure: "strong"|"partial"|"weak",
  caught_the_turn: true|false,
  what_you_missed: "specific, quotes their words vs the passage",
  one_technique: "a single actionable instruction for the next read",
  verdict_line: "one blunt sentence"
}
```

## Why grade reading, not answers
A student can guess a right answer with broken reading; they cannot fake a reading map. Grading
the map catches the process error *before* it produces a wrong answer — the coaching moment the
one-shot verdict (③ Trap Drills) structurally cannot provide.
