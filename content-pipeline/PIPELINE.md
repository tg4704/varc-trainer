# Content Pipeline — CAT-grade passage + question generation

The hard part is **distractors**, not passages. This pipeline's whole job is to manufacture
the "close 50/50" and then **throw away** everything that doesn't survive an ambiguity gate.

Mindset: generation is cheap ore; **validation is where quality is made.** Generate many,
keep few (target 20–40% acceptance). Never ship straight to users — everything lands in the
admin/flag queue first.

Legal: taxonomy + few-shots from **CAT/XAT PYQs only**. No GMAT/Aeon/Hindu/Economist/competitor
text in prompts — register reference only, never source text.

---

## 1. Distractor taxonomy (the core craft)

Backward-compatible with the app's existing 4 types; adds 3 from the report (BANE + distortion).

| key | name | what it is | why it tempts | how it's killed |
|---|---|---|---|---|
| `too_extreme` | Extreme (E) | absolute modifiers — *always, never, all, none, only, entirely* | feels decisive | passage is nuanced; one counter-instance breaks it |
| `out_of_scope` | Alien (A) | introduces a concept/entity never in the passage | sounds academic/plausible | can't be traced to any sentence or valid inference |
| `too_broad` | Broad (B) | generally true / supported, but too general to answer *this* stem | "it's not wrong…" | correct in the world ≠ answers the specific question |
| `partially_correct` | Narrow (N) | a true supporting detail offered as the main point | matches words on the page | a premise can't be the holistic conclusion |
| `real_but_unstated` | Unstated | true in general, passage never actually claims it | reader fills the gap | not asserted or entailed by the text |
| `distortion` | Distortion | reverses a relationship the passage states (causality/direction) | near-identical wording | direction of the claim is flipped |
| `wrong_question` | Wrong-question | accurate to the passage but answers a *different* stem | every word is "true" | answers a question that wasn't asked |
| `wrong_location` | Displaced | true/stated *elsewhere* in the passage, irrelevant to this stem | you recognise the phrase verbatim | it answers from the wrong part of the text |
| `mislabelled` | Mislabelled | correct content with the *wrong term/label* attached | the label matches the stem | the described content contradicts its own label |
| `wordplay` | Wordplay | puns on the key term's surface form/spelling | the word looks familiar | plays on homophony/spelling, not meaning |
| `tone_mismatch` | Tone-mismatch | content is defensible but the *tone/stance* clashes with the author's | the facts line up | register (critical vs celebratory, etc.) doesn't match |

> **PYQ-calibrated (2026-07):** `wrong_location`, `mislabelled`, `wordplay` added after comparing
> to real CAT questions; `tone_mismatch` added from Reddit research — it's the "T" in **BEAST**,
> the elimination framework CAT aspirants actually use.
>
> **BEAST map (surface the letter in feedback — students know this framework):**
> **B**road→`too_broad` · **E**xtreme→`too_extreme` · **A**lien→`out_of_scope` ·
> **S**ide-track→`wrong_question`/`partially_correct` · **T**one→`tone_mismatch`.

> Rule for every item: the **correct** option is the only one with *no* archetype tag, and
> **every** distractor must carry exactly one nameable tag. If a wrong option needs no tag to
> explain why it's wrong, it's too obviously wrong — regenerate it.

## 2. Question-type taxonomy

| type | stem shape | tests |
|---|---|---|
| `inference` | "most reasonably inferred / the author would agree" | entailment beyond the literal text |
| `main_idea` | "primary purpose / central argument" | the holistic thesis, not a detail |
| `function` | "why does the author mention X / role of ¶2" | structural awareness |
| `tone` | "the author's attitude / tone is" | register & stance nuance |
| `detail` | "according to the passage" | precise reading (use sparingly — CAT rarely pure-retrieval) |
| `weaken_strengthen` | "which would most weaken/support" | argument manipulation |
| `vocab_in_context` | "as used in the passage, X most nearly means" | meaning from context, not dictionary |
| `application` | "which scenario/design is most consistent with argument X" / "closest to the opposite of X" | transfer of the argument to a novel concrete case — **CAT's hardest common type** |
| `concept_set` | "which set of concepts is conceptually closest to the passage's concerns" | grasp of the core theme |

Mix target (**updated from CAT 2021–2025 data**: inference is ~50% of RC and the single
most-tested skill in the whole exam — treat it as its own skill with dedicated drill sets):
**inference ~45–50%**, main_idea ~15%, application ~10%, function ~10%, tone ~10%,
detail/vocab/concept_set ~5–10%. **Minimize pure `detail`** — CAT is inferential.

## 3. Passage structural spec (forces difficulty — fights AI's "too clean" default)

Every generated passage MUST have:
- a **thesis** that is *implied, not announced* (no "This essay argues that…");
- a **counterposition** or tension, then a **qualification** that partially concedes;
- a **tonal stance** that is measured (skeptical-but-fair, not cheerleading or dismissive);
- **embedded difficulty**: at least one piece of academic jargon used in context, one
  non-linear move (an aside, a concession, a reversal);
- length: ~90–120 words for ③ Trap Drills (single question); ~350–500 words for ②
  Comprehension (4–6 questions).

**Paragraph structure (② Comprehension — mandatory, not optional):**
- The passage body MUST be split into **3–5 distinct paragraphs**, separated by a blank line
  (`\n\n`) in the JSON string. A single unbroken block of text is a hard fail — CAT passages are
  always visibly paragraphed, and paragraph-level structure is exactly what the reading-map
  exercise grades.
- **Each paragraph must play a distinct rhetorical role relative to the thesis** — this is the
  actual skill CAT tests: can the student track whether the argument is being built up or pushed
  back on as they read? Assign each paragraph one function from: **sets up** the claim, **supports**
  it with evidence, **complicates/qualifies** it, **reverses/counters** it, **synthesizes** or
  resolves the tension. No two adjacent paragraphs may have the same function. At least one
  paragraph must clearly work *against* the surface direction of the previous one (a concession,
  a counterexample, a reversal) — the positive/negative alternation is what makes the argument
  hard to summarize on a single read.
- `reading_key.paragraph_functions` must have **exactly one entry per paragraph**, in order, and
  each entry must name that paragraph's rhetorical role (not just its topic) — e.g. "¶2: concedes
  a real cost of the author's position before rebutting it," not "¶2: discusses costs."

Calibrate density/obliqueness against a real CAT PYQ passage held side-by-side (register only).

## 4. Generation prompt (offline, best model)

```
You are a CAT VARC item-setter. Write ONE reading passage and N questions in the exact
register and difficulty of CAT Reading Comprehension.

PASSAGE REQUIREMENTS:
- Topic: {genre}. Length: {wordcount} words.
- Imply the thesis; do not announce it. Include a counterposition, then a qualification.
- Measured authorial stance. Embed one in-context jargon term and one non-linear move
  (aside / concession / reversal). Dense but grammatical. No lists, no headings.

QUESTION REQUIREMENTS (produce {N}, spread across types {types}):
- Stems must be inferential/structural, NOT fact-retrieval.
- Each question: exactly ONE defensible correct option + THREE distractors.
- Tag each distractor with EXACTLY ONE archetype from:
  too_extreme | out_of_scope | too_broad | partially_correct | real_but_unstated |
  distortion | wrong_question
- The correct option must be traceable to specific sentence(s); list them as source_lines.
- Distractors must be *tempting*: each should be defensible until the precise reason
  (its archetype) is applied.

Return JSON: { passage, questions:[ { type, question, options:[{text,isCorrect,trapType}],
correctIndex, sourceLines, rationale_correct, rationale_each_wrong } ] }
```

## 5. Adversarial validation gate (separate calls; the kill-test)

Run each question through ALL checks. **Any fail → reject or regenerate.**

```
You are a ruthless CAT answer-key auditor. For the given passage + question + options:

1. ONE-ANSWER GATE (most important): Is there EXACTLY ONE defensible answer? If a smart,
   evidence-driven test-taker could justify any other option from the text, FAIL.
2. SUPPORT GATE: Is the keyed-correct option fully supported by specific sentence(s)? If it
   requires outside knowledge or an unsupported leap, FAIL.
3. RETRIEVAL GATE: Is this pure fact-retrieval? If the answer is found by keyword-matching
   rather than inference/structure, FAIL.
4. DISTRACTOR GATE: Does every wrong option have a concrete, nameable reason it's wrong that
   matches its tagged archetype? If any wrong option is "just obviously wrong" or, worse,
   "also kind of right", FAIL.
5. ECHO GATE: Does any text copy distinctive phrasing from known PYQ sources? If yes, FAIL.

Return JSON: { verdict: "pass"|"fail", failed_gates:[...], reason, fix_suggestion }
```

## 5b. CAT style rules (learned from PYQ calibration — enforce in generation)

These close the gap found when generated items were compared to real CAT questions:

1. **No absolute-word crutch.** At most ONE distractor per question may use `always/never/all/
   only/entirely`. CAT rarely gifts an eliminate-on-modality option; distractors are *qualified*
   ("often", "in some cases") so modality alone can't kill them.
2. **Every full passage gets ≥1 `application` question** — transfer the argument to a novel
   concrete scenario (a pay design, a policy, a real-world case). This is CAT's signature hard type.
3. **Summary / main-idea distractors are LONG and multi-claim** — each packs 3–4 assertions with
   exactly ONE buried error. No one-line summary distractors.
4. **Definition / vocab distractors use `wordplay` or `mislabelled`**, not clean wrong-senses
   (e.g. alienist → "extraterrestrials"; a democratic measure labelled "autocratic").
5. **Use `wrong_location` traps** — lift a real phrase from a *different* paragraph and offer it
   as the answer to this stem.
6. **Near-retrieval definition questions are allowed** (CAT includes them) — but only when dressed
   with wordplay/mislabel distractors, never as bare fact-matching.

## 6. Workflow

```
generate(N×oversample)  →  validate(all)  →  founder spot-check  →  admin queue  →  publish
                              ↑ keep ~25–40%                          ↑ source='ai_generated'
```

- Seed a hand-vetted **golden set (~150–200)** first as the quality bar + few-shot anchor.
- User thumbs-down / flags → fix loop → quality compounds (reuse `question_flags`).
- DB: add `source='ai_generated'` to the `questions.source` enum.
