# Generation Backlog — commands to run when building out the content bank

Run each command in your Claude Project (see `PROJECT_INSTRUCTIONS.md`), then `Validate`,
then paste the JSON into **Admin → Import**. One command per chat message; start a fresh chat
per command so Project Knowledge is read cleanly each time.

Check items off as you run them (or just delete lines once imported) so this stays a live queue.

## Full passages (② Coach) — 4 per topic, 20 total

**Philosophy** — *all 4 already generated (2026-07-02); confirm they're imported in Admin →
Questions before re-running*
- [x] `Generate passage_set, TOPIC=philosophy, GENRE=aesthetics`
- [x] `Generate passage_set, TOPIC=philosophy, GENRE=epistemology`
- [x] `Generate passage_set, TOPIC=philosophy, GENRE=ethics of technology`
- [x] `Generate passage_set, TOPIC=philosophy, GENRE=philosophy of language`

**Science**
- [ ] `Generate passage_set, TOPIC=science, GENRE=evolutionary biology`
- [ ] `Generate passage_set, TOPIC=science, GENRE=neuroscience & consciousness`
- [ ] `Generate passage_set, TOPIC=science, GENRE=climate science`
- [ ] `Generate passage_set, TOPIC=science, GENRE=philosophy of science / scientific method`
- [ ] `Generate passage_set, TOPIC=science, GENRE=epidemiology & public health`

**Economics**
- [ ] `Generate passage_set, TOPIC=economics, GENRE=behavioral economics`
- [ ] `Generate passage_set, TOPIC=economics, GENRE=development economics`
- [ ] `Generate passage_set, TOPIC=economics, GENRE=monetary policy`
- [ ] `Generate passage_set, TOPIC=economics, GENRE=economics of technology & labor`

**Humanities**
- [ ] `Generate passage_set, TOPIC=humanities, GENRE=post-colonial literature`
- [ ] `Generate passage_set, TOPIC=humanities, GENRE=art history & criticism`
- [ ] `Generate passage_set, TOPIC=humanities, GENRE=linguistics & translation`
- [ ] `Generate passage_set, TOPIC=humanities, GENRE=history of ideas`

**Social**
- [ ] `Generate passage_set, TOPIC=social, GENRE=sociology of institutions`
- [ ] `Generate passage_set, TOPIC=social, GENRE=urban studies`
- [ ] `Generate passage_set, TOPIC=social, GENRE=anthropology`
- [ ] `Generate passage_set, TOPIC=social, GENRE=media & technology's social effects`

## Drills (③) — 5 commands, ~5 items each ≈ 25 drills

- [ ] `Generate 5 drills, TOPIC=economics`
- [ ] `Generate 5 drills, TOPIC=philosophy`
- [ ] `Generate 5 drills, TOPIC=science`
- [ ] `Generate 5 drills, TOPIC=humanities`
- [ ] `Generate 5 drills, TOPIC=social`

## After this batch (~105 questions)

Still short of the 150–200 golden-set target. When you come back for more, keep the same
topic/genre spread — add fresh genres per topic (avoid repeating a genre, it biases the bank)
and consider generating a second round of drills once the first is reviewed.
