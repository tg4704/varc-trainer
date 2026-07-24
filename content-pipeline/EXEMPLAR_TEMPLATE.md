# Exemplar Annotation — teach the generator CAT's real question shapes & option craft

Turn raw CAT PYQs into **labeled exemplars** that teach the generator our taxonomy. This is the
single highest-signal thing in Project Knowledge — 20–30 well-annotated questions beat 400 raw
ones. Put the finished file in the Project's Knowledge.

> **2026-07 rebuild.** The old exemplars over-taught easy types. The worked set below is rebuilt
> from CAT 2025 to cover the shapes that actually dominate the exam and that the generator was
> weakest on: **except_set, hypothetical (weaken/strengthen/invalidate), function, assumption,
> application, vocab-in-context, keyword-set main_idea**. Each block also names the OPTION-CRAFT
> lesson — because the hardest thing to teach is not the stem, it's how CAT makes four options look
> identical.

## The one option-craft rule to internalise from every block below

In every real CAT question, **the four options are the same length, same register, and built from
the passage's own words.** You cannot pick the answer by "it's the longest / most hedged one." If
your generated answer is the longest option and the distractors are short outside-the-text
absolutes, you have written a fake CAT question — regenerate it.

## What to annotate (aim for ~20–30, spanning EVERY priority type + EVERY archetype)

Prioritise the high-value types: **except_set, hypothetical, function, assumption, application**,
and the **wrong_location / wrong_question / mislabelled / distortion** distractor archetypes (these
are how CAT builds "all four look passage-like"). Make each of the 11 archetypes appear ≥ twice.

## Format (one block per question)

```
### <YEAR Passage topic> — <question type>
STEM: <the question stem>
CORRECT: <letter> — <why it's correct, one line, pointing to the relevant lines>
DISTRACTORS:
  - <option text, abbreviated> → <archetype> — <one line: why it tempts / why it's wrong>
  - ...
CRAFT: <the option-construction technique this question exercises>
```

Archetypes: too_extreme, out_of_scope, too_broad, partially_correct, tone_mismatch,
real_but_unstated, distortion, wrong_question, wrong_location, mislabelled, wordplay.

---

## Worked examples (real CAT 2025 PYQs — annotate yours the same way)

```
### 2025 Cavefish adaptation — except_set
STEM: All of the following statements from the passage describe adaptation in Mexican tetra
cavefish EXCEPT:
CORRECT: C — "when these cells get too big, they can burst… chronic inflammation" describes a
  general fat-storage PROBLEM in animals, not a cavefish adaptation.
DISTRACTORS (each IS a real adaptation statement, so each is wrong-for-an-EXCEPT):
  - "disadvantage if they maintain expensive tissues they aren't using" → wrong_question — a true
    adaptation rationale; tempts because it's clearly about adaptation.
  - "surviving on a meagre diet of mostly bat feces…" → wrong_question — real adaptive context.
  - "wild cavefish can sometimes get very fat" → wrong_question — the storage adaptation itself.
CRAFT: EXCEPT — all four options are LIFTED passage sentences of similar length; three genuinely fit
  the category "adaptation", one describes a general mechanism. Difficulty = categorisation, not
  plausibility. This is the #1 CAT shape and the generator produced ZERO of it before.

### 2025 Cavefish adaptation — hypothetical (invalidate an experiment)
STEM: Which result for the cross between surface fish (eyes) and cavefish (no eyes) would invalidate
Riddle's inference [that carotenoids are unrelated to eyelessness]?
CORRECT: C — "Only eyeless offspring had yellow fat" would re-link carotenoids to eyelessness,
  destroying her "no link" claim.
DISTRACTORS:
  - "Some offspring with eyes had white fat" → distortion — consistent with no-link, doesn't invalidate.
  - "Some offspring with eyes had yellow fat" → distortion — also consistent with no-link.
  - "Some eyeless offspring had white fat" → distortion — again supports, not invalidates.
CRAFT: hypothetical — four near-identical 6-word options differing only in {eyes/eyeless} ×
  {white/yellow}. The reader must run the logic, not weigh wording. Options are UNIFORM by design.

### 2025 Cavefish adaptation — application (function of a substance)
STEM: What is the most likely function of carotenoids in Mexican tetra cavefish?
CORRECT: D — to control inflammation from bursting fat cells (Riddle's actual hypothesis).
DISTRACTORS:
  - "act as a substitute for eyes" → mislabelled — the vivid WRONG guess the passage explicitly rejects.
  - "help fat cells store nutrients" → wrong_location — real passage idea (nutrient storage), wrong link.
  - "render bright yellow colour" → too_broad — a true effect, but a by-product, not the function.
CRAFT: the trap (A) is the intuitively appealing story the passage sets up THEN overturns — CAT
  rewards the reader who caught the reversal. Options are all short and parallel.

### 2025 Dams — main_idea (keyword-set mapping — NOT "which title fits")
STEM: Which set of terms is closest to mapping the key arguments of the passage?
CORRECT: C — Mega-infrastructure / Sacrifice zone / Worshipping modernity / Water impoundment —
  the four load-bearing ideas in order.
DISTRACTORS (all built from REAL passage words):
  - Partisan act / Threatened livelihoods / Toxic algae / Quarter century → wrong_location — real
    terms, but mixes one load-bearing idea with peripheral details.
  - Lucrative contracts / Sacrifice zone / Expected lives / Global balance → wrong_location — same trick.
  - Physical instantiation / Partisan act / Decided democratically / Alternative energy → wrong_location.
CRAFT: the CAT way to test "main idea." Every option is a 4-term chain of ACTUAL passage vocabulary;
  the trap is picking a set stuffed with words that "appear" but aren't the spine. Never a bare title.

### 2025 Dams — function (why the author mentions X)
STEM: What does the author wish to communicate by referring to the Hoover and Aswan dams?
CORRECT: D — the drive to control nature shows up not only in mega-dams but in smaller dams too.
DISTRACTORS:
  - "Colorado and Nile may be seen as thin blue lines" → wrong_location — real passage image, wrong purpose.
  - "large-scale employers became messianic figures" → distortion — recombines passage words into a
    claim never made.
  - "designers were highly charismatic individuals" → wordplay — puns on "charismatic mega-infrastructure".
CRAFT: function question — the distractors are all made of the paragraph's own phrases ("thin blue
  line", "messianic", "charismatic") reassembled wrongly. That reuse is what makes them tempting.

### 2025 Dams — vocab_in_context
STEM: Best substitute for "instantiation" as used in the first paragraph?
CORRECT: A — Exemplification and manifestation.
DISTRACTORS (all offered as PAIRS — parallel form):
  - Concreteness and viability → partially_correct — "concrete" is close, "viability" isn't.
  - Durability and timeliness → out_of_scope.
  - Development and construction → mislabelled — plausible for "dam", wrong for the word's sense.
CRAFT: vocab options come as matched pairs, not single words — uniform shape. One near-miss (A vs B)
  turns on the second word. This is how CAT dresses vocab so it can't be keyword-matched.

### 2025 Dams — except_set (inference variant)
STEM: All of the following may be considered valid inferences from the passage EXCEPT that:
CORRECT: B — "smaller dams are safer than large dam projects" — the passage calls small dams "not
  inconsequential" but never ranks their safety.
DISTRACTORS (each IS a supported inference):
  - opposition/alternatives grow yet dams keep being built → wrong_question — supported, so wrong here.
  - colonisation used dam-building to displace people → wrong_question — stated.
  - dam-building is costly and may be unjustifiable → wrong_question — supported.
CRAFT: EXCEPT + inference. Three options are defensible inferences; the answer is the one that SOUNDS
  reasonable but the passage never supports (real_but_unstated dressed as an inference).

### 2025 Tail events — hypothetical (strengthen a causal claim)
STEM: Which observation would most STRENGTHEN the claim that a first-order tail event raises the
probability of further tail events in complex systems?
CORRECT: C — after an equity crash, dense clusters of large daily moves for weeks, extreme days far
  more frequent than normal — directly instantiates "one tail event raises probability of more."
DISTRACTORS (all ~35-word empirical findings — UNIFORM length):
  - epidemic super-spreading is an isolated spike, later sizes match baseline → distortion — describes
    INDEPENDENCE, the opposite of the claim.
  - river discharge fits a normal thin-tailed distribution regardless of storms → out_of_scope —
    no tail-clustering at all.
  - after big earthquakes activity returns to baseline within hours, events independent → distortion —
    again the opposite finding, dressed in domain detail.
CRAFT: the model exemplar for weaken/strengthen. Four parallel dense findings; only one bears on the
  SPECIFIC claim; two describe the opposite result. The reader cannot use length or tone — only logic.

### 2025 Tail events — assumption
STEM: The passage suggests contact-tracing apps could inadvertently raise risky interactions by
altering behaviour. Which assumption is most NECESSARY for that to hold?
CORRECT: B — people base movement partly on observed infections and others' behaviour, so local
  responses interact and scale up — the interdependence the suggestion requires.
DISTRACTORS (all ~35 words, each a plausible-sounding assumption):
  - most users uninstall within a week, neutralising bias → distortion — removes the effect, doesn't enable it.
  - alerts always include 1-metre location, perfectly accurate → too_extreme — irrelevant precision.
  - urban traffic uniform at all hours, routing perfectly predictable → distortion — makes
    interdependence negligible, the OPPOSITE of what's needed.
CRAFT: assumption question — the answer is the enabling premise; distractors either kill the effect
  or assert irrelevant certainties. Uniform length hides which is load-bearing.
```

## Legal note
These exemplars live in Project Knowledge as *reference*. The Project Instructions forbid the
generator from reproducing PYQ text in its output (echo gate). Annotating officially-released
CAT/XAT PYQs for your own prep tool is fine; do not annotate GMAT / paywalled sources.
