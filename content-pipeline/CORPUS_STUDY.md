# CAT RC Corpus Study — the measurements behind the generation prompts

Computed 2026-07-27 over `CAT_Reading_Comprehension_2017_2025.md`: **102 passages** and **438
questions** (CAT 2017–2025, 12 passages/year since 2020). Everything the prompts assert as a
frequency comes from here — if you re-run the study, update both.

## Passages

| Measure | Value |
|---|---|
| Word count | median **518**, IQR **506–525**, min 259, max 556 |
| Turn/concession markers per passage | median **4**; **0 passages had none**; 77% have ≥3 |
| Sentence length | median **14** words; **43% under 12 words**; only **4% over 40** |
| Opening sentence shape | assertion 60% · definition 19% · narrative/scene 9% · historical 9% · question 4% |

**Turn-marker register is plain, not academic:** `but` ×265, `still` ×38, `yet` ×29, `though` ×27,
`however` ×22, `although` ×14 — versus `nevertheless` ×2, `nonetheless` ×2. Generated prose that
reaches for "furthermore/nevertheless/moreover" instantly reads non-CAT.

### Texture / provenance features (share of 102 passages)

CAT passages are **edited excerpts from books and long-form journalism**, not clean self-contained
essays. That provenance leaves marks:

| Feature | Frequency |
|---|---|
| Named person / researcher cited | **85%** |
| Ellipsis (`…` / `. . .`) = elided text | **79%** |
| Colon | 72% |
| First person (I / my / we / our) | **67%** |
| Em-dash aside | 55% |
| Direct quotation (15+ chars in quotes) | **51%** |
| Parenthetical aside | 48% |
| Numeric / date detail | 46% |
| Square-bracket editorial gloss `[of Mexican tetra fish]` | **43%** |
| Semicolon | 37% |
| Rhetorical question | 33% |
| Italics | 0% |

### Topic mix (dominant topic per passage)

| Topic | Share |
|---|---|
| history / archaeology / antiquity | **30%** |
| science / biology / ecology | 19% |
| society / politics / culture | 16% |
| art / aesthetics / literature | 11% |
| economics / markets / labour | 8% |
| technology / AI / digital | 7% |
| language / linguistics | 6% |
| **philosophy / ethics / mind** | **2%** |
| anthropology / indigenous | 1% |

> The app's topic enum was `{economics, humanities, philosophy, science, social}` and generation
> over-weighted philosophy/economics — the two rarest in real CAT. `history` was added to the enum
> 2026-07-27 (`server/lib/validateQuestion.js` + 8 client/server sites).

## Questions (438)

### The option-length control test — the single most important finding

| | Real CAT (438 Qs) | Graspr bank as of 2026-07-24 (210 Qs) |
|---|---|---|
| Correct = single **longest** option | **20%** (below the 25% random baseline) | **73%** (83% in Coach) |
| Correct = single shortest option | 16% | 2% |
| Median intra-question length spread | 32% | 38% |

**The lesson is NOT "make all four options the same length."** Real CAT options vary by ~32%. The
property is that **length is decorrelated from correctness** — the answer is as often the shortest
as the longest. An earlier draft of these prompts demanded "all options within ±15%", which is
wrong and would have produced unnaturally uniform options. Corrected 2026-07-27.

**Options are SHORT:** median **12 words**, IQR 9–16. Long ~35-word options are the exception,
confined to hypothetical/assumption stems.

### Type distribution (438 stems, auto-classified)

| Type | Share | Median option len | Answer-is-longest |
|---|---|---|---|
| **except_set** (`All of the following … EXCEPT`) | **25%** | 13 | 17% |
| inference | 13% | 12 | 27% |
| **author-stance / intent** (`the goal of the author is to…`) | **11%** | — | — |
| **hypothetical** (if true/false → weaken/strengthen/invalidate) | **8%** | 15 | 11% |
| function (purpose of an example/reference) | 6% | 15 | 37% |
| negative (`which is NOT true`) | 5% | — | — |
| quote-anchored `best explains "<quoted line>"` | 5% | — | — |
| main_idea (keyword-set / odd-pair / summary) | 4% | 12 | 19% |
| vocab_in_context | 3% | 7 | 17% |
| assumption | 1% | 18 | 50% |
| **tone** | **1%** (3 questions in 9 years) | 16 | 33% |

### Stem anchoring

| Feature | Share of 438 stems |
|---|---|
| Embeds a **verbatim quotation** from the passage | **13%** |
| Names a specific paragraph ("in the second paragraph") | **6%** |

Generated stems were 100% free-floating and generic ("Which title fits best?", "The author's tone
is best described as:") — no quote anchoring, no paragraph anchoring.

## How the prompts use this

- Passage spec → word band, turn density, sentence rhythm, opening-shape roll, texture roll.
- Type quota → except_set + hypothetical mandatory; tone capped at ≤1.
- Option craft → decorrelate length from correctness; keep options ~9–16 words.
- Stem bank → verbatim anchor questions per type, quoted in the prompts themselves.
