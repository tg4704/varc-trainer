# Generation Backlog — the full campaign

**Target: 200 Coach passages (②) + 2000 Drills (③).** This file is the master plan — the whole
structure is laid out up front; you cover it in batches over time, ticking progress as you go.
Every line below has a **ready copy-paste command** — the Project's custom instructions supply all
the rules, so the command IS the whole prompt.

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
  **Admin → Passages** (Coach coverage) / **Admin → Questions** (drills) and reconcile the trackers
  below. If in doubt, trust the DB and update this file.
- **Anti-repeat:** for Coach, run a genre's 4 passages in *different rounds* (not back-to-back) so
  they don't come out similar. For Drills, vary the subtopic of every paragraph.

## How to tick / track progress

These trackers are **plain text, not clickable checkboxes** — to tick one you edit this file
(on GitHub: the ✏️ pencil on this file → change the text → commit; or edit locally and push).

- **Coach** — each genre has four boxes `[ ][ ][ ][ ]`, one per round. After you generate *and
  import* a passage for that genre, change a space to `x`. Example after two rounds of "aesthetics":
  `[x][x][ ][ ]`. A genre is done when all four read `[x][x][x][x]`.
- **Drills** — fill the running count in the matrix (each 10-item command you import = **+10**).
  Example: after 3 easy-economics batches, the economics/easy cell reads `30 / 100`.

> **Prior work to reconcile:** a 2026-07-02 batch of 4 philosophy Coach passages (aesthetics,
> epistemology, ethics of technology, philosophy of language) predates this reset. If they're
> already imported, tick Round 1 `[x]` on those four philosophy genres.

---

# ② COACH — 200 passages  (5 topics × 10 genres × 4 passages)

40 per topic. Run in **4 rounds**: one pass through all 50 genres per round = 50 passages/round.
Copy the command on each line as-is (optionally append `, QUESTIONS=5` or `6` for more questions).

### Philosophy (40)
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=aesthetics`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=epistemology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=ethics of technology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=philosophy of language`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=philosophy of mind`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=political philosophy`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=metaphysics`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=ethics & moral philosophy`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=existentialism & phenomenology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=philosophy, GENRE=philosophy of science`

### Science (40)
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=evolutionary biology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=neuroscience & consciousness`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=climate science`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=scientific method & epistemology of science`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=epidemiology & public health`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=genetics & biotechnology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=physics & cosmology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=ecology & biodiversity`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=materials science & technology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=science, GENRE=medicine & the body`

### Economics (40)
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=behavioral economics`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=development economics`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=monetary policy`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=economics of technology & labor`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=game theory & strategy`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=economic history`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=inequality & distribution`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=environmental economics`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=trade & globalization`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=economics, GENRE=market design & incentives`

### Humanities (40)
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=post-colonial literature`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=art history & criticism`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=linguistics & translation`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=history of ideas`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=literary theory & criticism`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=classical & ancient history`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=music & performance studies`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=film & visual culture`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=mythology & religion studies`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=humanities, GENRE=rhetoric & the essay tradition`

### Social (40)
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=sociology of institutions`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=urban studies`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=anthropology`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=media & technology's social effects`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=gender & identity studies`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=migration & diaspora`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=education & society`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=law & society`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=social movements & collective action`
- [ ][ ][ ][ ] `Generate passage_set, TOPIC=social, GENRE=work, labor & organizations`

---

# ③ DRILLS — 2000 drills  (5 topics × 400)

Per topic: **100 easy · 200 medium · 100 tough**. Generate **10 per command**. Copy the topic's
command below and **fill in the blank difficulty** (`easy`, `medium`, or `tough`) each time; run it
10× for easy, 20× for medium, 10× for tough per topic.

- **economics:**  `Generate 10 drills, TOPIC=economics, DIFFICULTY=`
- **philosophy:** `Generate 10 drills, TOPIC=philosophy, DIFFICULTY=`
- **science:**    `Generate 10 drills, TOPIC=science, DIFFICULTY=`
- **humanities:** `Generate 10 drills, TOPIC=humanities, DIFFICULTY=`
- **social:**     `Generate 10 drills, TOPIC=social, DIFFICULTY=`

Track progress (each imported command = +10):

| Topic | easy (100 = 10×10) | medium (200 = 20×10) | tough (100 = 10×10) | topic total |
|---|---|---|---|---|
| economics  | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| philosophy | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| science    | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| humanities | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |
| social     | ____ / 100 | ____ / 200 | ____ / 100 | ____ / 400 |

**Subtopic variety (so drills don't clump):** draw each paragraph's subject from that topic's Coach
genre list above, plus anything adjacent — the drill schema has no `genre` field, so variety lives
entirely in the paragraph content. Try not to repeat a subtopic within the same 10-item batch.

**Suggested order:** finish one topic's easy → medium → tough block before moving to the next topic,
so you review and activate a coherent slice at a time rather than 2000 loose items at the end.

---

## Golden-set note

The old target was a hand-vetted golden set of ~150–200 as the quality bar. That's now the *floor*,
not the ceiling — the first full topic (400 drills + 40 passages) already clears it. Keep the
validator pass ruthless (target ~25–40% acceptance on first generation); quality is made in
validation, not generation.
