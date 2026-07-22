# Project Instructions — SPLIT into two Claude Projects (2026-07)

This combined file is **retired**. Drills and Coach now use **two separate Claude Projects**, each
with its own custom instructions, because their passage requirements conflict (Coach forces
difficulty on every paragraph; Drills relax it for easy items) and each project's Knowledge should
hold different PYQ exemplars (full passages vs. short single-paragraphs).

- ② **Coach** (full passages) → [`PROJECT_INSTRUCTIONS_COACH.md`](PROJECT_INSTRUCTIONS_COACH.md)
- ③ **Drills** (short single-question) → [`PROJECT_INSTRUCTIONS_DRILLS.md`](PROJECT_INSTRUCTIONS_DRILLS.md)

Blocks marked `⟨SHARED CORE⟩` (project-knowledge rule, distractor archetypes, question types) are
byte-identical across the two — **if you change one, change both.**

The generation campaign (200 Coach passages + 2000 Drills) is tracked in
[`GENERATION_BACKLOG.md`](GENERATION_BACKLOG.md). The import contract these prompts must satisfy is
in [`GENERATION_KIT.md`](GENERATION_KIT.md) ("Import contract — what gets HARD-REJECTED").
