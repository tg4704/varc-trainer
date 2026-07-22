# Generation Backlog — the full campaign

**Target: 200 Coach passages (②) + 2000 Drills (③).** This file is the master plan — the whole
structure is laid out up front; you cover it in batches over time, ticking progress as you go.

## How to run it

- Two Claude Projects now (see `PROJECT_INSTRUCTIONS_COACH.md` / `PROJECT_INSTRUCTIONS_DRILLS.md`).
  Run Coach commands in the Coach project, Drills commands in the Drills project.
- **One command per chat; start a fresh chat per command** so Project Knowledge is read cleanly.
  After each generation, send `Validate` in the same chat, keep only passing/fixed items, then
  paste into **Admin → Import**.
- Everything imports **inactive**. For `passage_set`, activate the **passage** (Admin → Passages)
  AND its questions (Admin → Questions). For drills, activate the questions.
- **The database is the source of truth for "what exists," not this file.** Chats are stateless —
  a Claude chat cannot know what you've already generated. Before a session, glance at
  **Admin → Passages** (Coach coverage) / **Admin → Questions** (drills) and reconcile the counts
  below. If in doubt, trust the DB and update this file.
- **Anti-repeat:** for Coach, vary GENRE per the lists below and run a genre's 4 passages in
  *different rounds* (not back-to-back) so they don't come out similar. For Drills, vary the
  subtopic of every paragraph. Reusing a genre/subtopic is fine and expected (you want many per
  genre eventually) — the thing to avoid is near-duplicate *content*, not a reused label.

> **Prior work to reconcile:** a 2026-07-02 batch of 4 philosophy Coach passages (aesthetics,
> epistemology, ethics of technology, philosophy of language) was generated before this reset —
> if they're already imported, count them against Round 1 of the matching philosophy genres below
> and tick those boxes.

---

# ② COACH — 200 passages  (5 topics × 10 genres × 4 passages)

40 per topic. Run in **4 rounds**: one pass through all 50 genres per round = 50 passages/round.
Each genre line has 4 boxes — tick one per round. Command:
`Generate passage_set, TOPIC=<t>, GENRE=<genre>`  (QUESTIONS=4 default; use 5–6 for variety).

### Philosophy (40)
- [ ][ ][ ][ ] aesthetics
- [ ][ ][ ][ ] epistemology
- [ ][ ][ ][ ] ethics of technology
- [ ][ ][ ][ ] philosophy of language
- [ ][ ][ ][ ] philosophy of mind
- [ ][ ][ ][ ] political philosophy
- [ ][ ][ ][ ] metaphysics
- [ ][ ][ ][ ] ethics & moral philosophy
- [ ][ ][ ][ ] existentialism & phenomenology
- [ ][ ][ ][ ] philosophy of science

### Science (40)
- [ ][ ][ ][ ] evolutionary biology
- [ ][ ][ ][ ] neuroscience & consciousness
- [ ][ ][ ][ ] climate science
- [ ][ ][ ][ ] scientific method & epistemology of science
- [ ][ ][ ][ ] epidemiology & public health
- [ ][ ][ ][ ] genetics & biotechnology
- [ ][ ][ ][ ] physics & cosmology
- [ ][ ][ ][ ] ecology & biodiversity
- [ ][ ][ ][ ] materials science & technology
- [ ][ ][ ][ ] medicine & the body

### Economics (40)
- [ ][ ][ ][ ] behavioral economics
- [ ][ ][ ][ ] development economics
- [ ][ ][ ][ ] monetary policy
- [ ][ ][ ][ ] economics of technology & labor
- [ ][ ][ ][ ] game theory & strategy
- [ ][ ][ ][ ] economic history
- [ ][ ][ ][ ] inequality & distribution
- [ ][ ][ ][ ] environmental economics
- [ ][ ][ ][ ] trade & globalization
- [ ][ ][ ][ ] market design & incentives

### Humanities (40)
- [ ][ ][ ][ ] post-colonial literature
- [ ][ ][ ][ ] art history & criticism
- [ ][ ][ ][ ] linguistics & translation
- [ ][ ][ ][ ] history of ideas
- [ ][ ][ ][ ] literary theory & criticism
- [ ][ ][ ][ ] classical & ancient history
- [ ][ ][ ][ ] music & performance studies
- [ ][ ][ ][ ] film & visual culture
- [ ][ ][ ][ ] mythology & religion studies
- [ ][ ][ ][ ] rhetoric & the essay tradition

### Social (40)
- [ ][ ][ ][ ] sociology of institutions
- [ ][ ][ ][ ] urban studies
- [ ][ ][ ][ ] anthropology
- [ ][ ][ ][ ] media & technology's social effects
- [ ][ ][ ][ ] gender & identity studies
- [ ][ ][ ][ ] migration & diaspora
- [ ][ ][ ][ ] education & society
- [ ][ ][ ][ ] law & society
- [ ][ ][ ][ ] social movements & collective action
- [ ][ ][ ][ ] work, labor & organizations

---

# ③ DRILLS — 2000 drills  (5 topics × 400)

Per topic: **100 easy · 200 medium · 100 tough** (medium is the exam-realistic bulk; easy builds a
gentle on-ramp, tough builds the near-miss stretch). Generate in batches of **10 per command**, so
each topic/difficulty is a fixed number of chats:

`Generate 10 drills, TOPIC=<t>, DIFFICULTY=<easy|medium|tough>`

Track progress by filling the count (each command adds 10). Reconcile against Admin → Questions.

| Topic | easy (100 = 10×10) | medium (200 = 20×10) | tough (100 = 10×10) | topic total |
|---|---|---|---|---|
| economics  | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| philosophy | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| science    | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| humanities | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| social     | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |

**Subtopic variety (so drills don't clump):** draw each paragraph's subject from that topic's Coach
genre list above, plus anything adjacent — the drill schema has no `genre` field, so variety lives
entirely in the paragraph content. Aim not to repeat a subtopic within the same 10-item batch.

**Suggested order:** finish one topic's easy → medium → tough block before moving to the next topic,
so you can review and activate a coherent slice at a time rather than 2000 loose items at the end.

---

## Golden-set note

The old target was a hand-vetted golden set of ~150–200 as the quality bar. That's now the *floor*,
not the ceiling — the first full topic (400 drills + 40 passages) already clears it. Keep the
validator pass ruthless (target ~25–40% acceptance on first generation); quality is made in
validation, not generation.
