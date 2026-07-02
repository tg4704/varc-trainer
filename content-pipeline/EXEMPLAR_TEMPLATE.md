# Exemplar Annotation Template

Turn raw CAT PYQs into **labeled exemplars** that teach the generator our taxonomy. This is the
single highest-signal thing in Project Knowledge — 20–30 well-annotated questions beat 400 raw
ones. Put the finished file in the Project's Knowledge.

## What to annotate (aim for ~20–30, spanning EVERY type + EVERY archetype)

Prioritize coverage of the hard/rare types the generator is weakest on: **application**,
**concept_set**, **function**, and the **wordplay / mislabelled / wrong_location** distractor
archetypes. Make sure each of the 11 distractor archetypes appears at least twice across the set.

## Format (one block per question)

```
### <YEAR Slot N — Passage topic> — <question type>
STEM: <the question stem>
CORRECT: <letter/index> — <why it's correct, in one line, pointing to the relevant lines>
DISTRACTORS:
  - <option text> → <archetype> — <one line: why it tempts / why it's wrong>
  - <option text> → <archetype> — ...
  - <option text> → <archetype> — ...
NOTE: <optional: the specific CAT technique this question exercises>
```

Archetypes to use: too_extreme, out_of_scope, too_broad, partially_correct, tone_mismatch,
real_but_unstated, distortion, wrong_question, wrong_location, mislabelled, wordplay.

---

## Worked examples (from real CAT PYQs — annotate yours the same way)

```
### CAT — Income inequality & growth — application
STEM: Per the incentive/moral-hazard argument, which design best fits "some inequality can raise growth"?
CORRECT: (4) Pay rewards on verifiable performance — the argument says compensation must track
  (otherwise unobservable) effort to elicit it; this is exactly that design.
DISTRACTORS:
  - Concentrates stock ownership for corporate governance → wrong_question — that's the SEPARATE
    governance argument, not the incentive one.
  - Rents from market power that raise top incomes without linking pay to results → partially_correct
    — inequality, yes, but stripped of the incentive mechanism the stem asks about.
  - Wages set by tenure rather than output → distortion — reverses the incentive logic entirely.
NOTE: classic CAT "apply the argument to a novel scenario" transfer question.

### CAT — Criminal responsibility & alienists — concept_set
STEM: Which set of concepts is conceptually closest to the passage's concerns?
CORRECT: (3) Judgement, Insanity, Punishment, Responsibility — the four load-bearing ideas.
DISTRACTORS:
  - Empathy, Prosecution, Knowledge, Business → out_of_scope — "Business" is never a concern.
  - Judgement, Belief, Accounts, Patronage → wrong_location — real words from the passage, but
    peripheral ones; misses the insanity/responsibility core.
  - Assessment, Empathy, Prosecution, Patriotism → wrong_location — same trick, scattered minor terms.
NOTE: theme-identification; the trap is picking a set full of words that "appear" in the passage.

### CAT — Criminal responsibility & alienists — vocab/definition
STEM: According to the passage, who or what was an "alienist"?
CORRECT: (3) A physician who specialised in the study of madness and care of the insane.
DISTRACTORS:
  - Examined accounts of extraterrestrials/'aliens' → wordplay — puns on "alien".
  - Responsible for the condition of immigrants/'aliens' → wordplay — same pun, different sense.
  - Professionals who pushed their field till it became unrecognisable → mislabelled — attaches a
    real passage idea to the wrong term.
NOTE: CAT dresses even near-definition questions with wordplay distractors.
```

## Legal note
These exemplars live in Project Knowledge as *reference*. The Project Instructions forbid the
generator from reproducing PYQ text in its output (echo gate). Annotating officially-released
CAT/XAT PYQs for your own prep tool is fine; do not annotate GMAT / paywalled sources.
