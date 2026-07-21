// Seeds `passages.reading_key_json` — the canonical key the Coach reading-map
// grader scores a student's map against (see READING_GRADER.md).
//
// WHY THIS EXISTS: as of the 2026-07-20 pre-launch QA, all 5 seeded passages
// had reading_key_json = '{}'. coach.js destructures that key straight into the
// grader prompt, so every grade was being produced from "Thesis: undefined /
// Tone: undefined / Paragraph functions: (empty) / Key turn: undefined" — the
// grader was giving free-floating commentary rather than grading against a
// canonical reading. See FAILURE_REPORT.md, P1-6.
//
// These keys are DRAFTS written from the passage text. They encode teaching
// judgment, so review and edit them before relying on them — then re-run:
//   node content-pipeline/seed_reading_keys.js
// Re-running is idempotent (it overwrites the key for each listed id).
//
// Schema per READING_GRADER.md: { thesis, tone, paragraph_functions: [], key_turn }
//   thesis              — the author's ARGUMENT, not the topic.
//   tone                — the author's stance/register.
//   paragraph_functions — what each part DOES (claim / evidence / counter /
//                         qualification), not what it's about.
//   key_turn            — the pivot a strong reader must catch; the single
//                         thing that separates argument-mapping from
//                         information-gathering on this passage.
//
// NOTE ON STRUCTURE: passages 7-10 are single-paragraph blocks (~180 words), so
// their paragraph_functions below describe LOGICAL MOVEMENTS rather than literal
// paragraphs. A student submitting a "quick" map gets only one crux box for
// these, which blunts the structure-grasp dimension. Passage 11 (4 real
// paragraphs) is the only one shaped like a true CAT RC passage. Consider
// re-authoring 7-10 as 400-600 words across 3-5 paragraphs.

require("dotenv").config();
const { Pool } = require("pg");

const KEYS = {
  // ── 7 · The Economics of Attention (economics, argument) ──────────────────
  7: {
    thesis:
      "The dispute over the attention economy is ultimately normative rather than factual: both sides largely agree on how engagement-optimized platforms behave, and disagree about how much responsibility sits with the individual user versus the platform designing the interface.",
    tone: "Analytical and even-handed — lays out competing positions without endorsing either.",
    paragraph_functions: [
      "Opening claim: attention is now the scarce resource, and platforms compete for it the way firms once competed for capital.",
      "Complication: attention's price is set by what advertisers pay to interrupt it, not what users would pay to spend it — so an engagement-optimized feed serves whoever profits from a longer session, not the reader.",
      "Presents two rival framings: an ordinary market inefficiency correctable by disclosure and competition, versus attention as structurally unlike other goods (cannot be stockpiled, degrades with use, seller cannot judge its value at the moment of sale).",
      "Scales the stakes: a single scroll never feels like a transaction, but in aggregate these choices redirect hours from work, sleep, and family.",
      "Surveys the policy range (mandatory friction, bans on engagement-optimized recommendation for minors) and the counter that users retain agency — blockers, limits, logging off.",
      "Closing reframe: locates the real disagreement in the allocation of responsibility rather than in any contested fact.",
    ],
    key_turn:
      "The final sentence's reframing — 'the disagreement is less about facts than about how much responsibility sits with the individual versus the platform.' Everything before it reads like an economics explainer; this line retroactively recasts the whole passage as a debate about moral responsibility. A reader who only catalogues the harms of the attention economy has missed the author's actual point.",
  },

  // ── 8 · Why Oral Traditions Persist (humanities, exposition) ───────────────
  8: {
    thesis:
      "Oral tradition persists deliberately, not as a pre-literate remnant, because it embodies a different theory of what knowledge is for — a continuously renegotiated shared understanding that binds a community, rather than a fixed archive.",
    tone: "Corrective and appreciative — overturns a condescending assumption with scholarly evidence.",
    paragraph_functions: [
      "Sets up the conventional assumption (oral tradition as a stage literate societies outgrow) in order to reject it, noting communities keep it deliberately alongside widespread literacy.",
      "Draws the operative contrast: writing fixes a single version, while oral performance adapts to its audience and foregrounds what the moment requires.",
      "Names the objection this invites — that adaptability means unreliability, memory as a degraded copy of text.",
      "Rebuts that objection with counter-evidence: oral cultures embed strict verification, with elders cross-checking and errors corrected publicly and in real time, which a printed page cannot do.",
      "Reframes what is actually preserved: not a transcript but a living argument about what the past means to the present.",
      "Corroborates with disciplinary practice: anthropologists moved from treating oral history as inferior evidence to using it as a primary source.",
      "Concludes with the thesis proper: persistence reflects a different theory of knowledge, not nostalgia.",
    ],
    key_turn:
      "The 'But' that inverts the reliability charge — the claim that oral cultures verify MORE strictly and more immediately than text does. This converts the apparent weakness (flexibility) into the foundation of the author's positive case. A reader who treats the passage as 'oral traditions are valuable too' has missed that the author is attacking the text-as-gold-standard premise itself.",
  },

  // ── 9 · The Limits of Predictive Models (science, analysis) ────────────────
  9: {
    thesis:
      "Predictive models are only conditionally reliable — conditional on a stability the model itself has no way to verify — so their failures under structural change reflect a mismatch between the question asked and the question that matters, not a statistical defect.",
    tone: "Measured and diagnostic — cautionary about overreliance without dismissing prediction.",
    paragraph_functions: [
      "States the buried assumption: models trained on historical data assume the future resembles the past in the respects that matter.",
      "Concedes the domain where it holds — short horizons and stable systems, hence steady gains in weather and traffic forecasting.",
      "Contrasts the domain where it fails: under structural change, a credit model trained on stable behaviour breaks precisely when a recession redefines 'normal'.",
      "Diagnoses that failure precisely — not a bug in the statistics but a mismatch between 'what usually happens' and 'what happens when circumstances break from the usual'.",
      "Reports the field's responses: stress-testing against extreme scenarios, and flagging low-confidence predictions instead of presenting all output as equally certain.",
      "Undercuts those responses as partial: no model can be stress-tested against an unanticipated scenario, and confidence scores are themselves generated by the very assumptions they are meant to qualify.",
      "Closes with a careful qualification rather than a dismissal: prediction is not useless, but its reliability rests on a stability it cannot check.",
    ],
    key_turn:
      "The pivot at 'But these are partial fixes' — and specifically the self-referential point that confidence scores inherit the same historical assumptions they exist to caveat. That is what forces the conclusion up from 'models sometimes fail' to 'reliability is conditional on something unverifiable from inside the model'. Missing it reduces the passage to a list of modelling caveats.",
  },

  // ── 10 · On the Ethics of Forgetting (philosophy, reflection) ──────────────
  10: {
    thesis:
      "Forgetting is not simply a failure of memory; in specific, bounded circumstances it is an active ethical practice — the morally decisive line being whether the forgetting releases a burden the rememberer no longer needs to carry or erases an obligation someone still owes.",
    tone: "Reflective and carefully qualified — argues a counterintuitive position while explicitly fencing off its abuse.",
    paragraph_functions: [
      "States the default philosophical assumption it will argue against: forgetting as lapse, failure, a debt owed to the past.",
      "Pivots ('Yet') to traditions that treat selective forgetting as an active ethical practice rather than a passive defect.",
      "First supporting case — restorative justice: formally setting a wrong aside after restitution, on the grounds that perpetual rehearsal of grievance can itself become harm.",
      "Second supporting case — religious forgiveness: deliberately choosing to stop returning to an offense, treating continued recollection as morally weighted rather than involuntary.",
      "Imposes a crucial limit on its own claim: erasing historical atrocity to spare the guilty is a recognized wrong that no tradition praises.",
      "States the operative distinction the traditions actually draw — releasing a burden versus erasing an outstanding obligation.",
      "Concludes: so understood, forgetting can be an expression of ethical seriousness rather than its opposite.",
    ],
    key_turn:
      "The self-imposed concession, 'This does not mean all forgetting is virtuous.' It is the hinge that converts a loose defence of forgetting into a precise criterion. A reader who takes the passage as straightforwardly pro-forgetting has inverted its actual claim, which is narrow and conditional — the author is drawing a line, not clearing a space.",
  },

  // ── 11 · The Reproducibility Crisis in Science (science, analysis) ─────────
  // The only passage with real paragraph breaks — these map 1:1 to ¶1-¶4.
  11: {
    thesis:
      "The reproducibility crisis is a failure of incentive design rather than of individual integrity: reproducibility was assumed to be a byproduct of good research instead of a separately rewarded deliverable, and current reforms amount to retrofitting that assumption into the system's explicit rules.",
    tone: "Diagnostic and sober — critical of the system's structure rather than of researchers.",
    paragraph_functions: [
      "¶1 Establishes the scale (replication succeeds less than half the time) and immediately rejects the intuitive explanation, relocating the cause from fraud to a long sequence of small, unknowing analytic choices.",
      "¶2 Explains the mechanism and why it stays invisible: each choice is individually defensible, and the damage appears only in aggregate, as a garden of forking paths where the surviving path is the one that happened to produce significance.",
      "¶3 Surveys the two families of proposed fixes — procedural (pre-registration) and cultural (journals rewarding replication and null results) — and shows each is insufficient alone, tracing the cultural fix back to universities and funders.",
      "¶4 Steps up a level to the root cause: reproducibility was never in the incentive structure at all, recasting the reforms of ¶3 as retrofitting rather than repair.",
    ],
    key_turn:
      "The move into ¶4 — from cataloguing fixes and their limits to the structural claim that reproducibility was never an incentivized deliverable to begin with. This reframes everything prior: the fixes are not corrections to a working system but attempts to install a requirement that was only ever assumed. A reader who stops at 'pre-registration and journal reform, both imperfect' has collected the content and missed the argument.",
  },
};

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const [id, key] of Object.entries(KEYS)) {
      const res = await pool.query(
        "UPDATE passages SET reading_key_json = $1 WHERE id = $2 RETURNING id, title",
        [JSON.stringify(key), Number(id)]
      );
      if (!res.rows.length) {
        console.warn(`  ! passage ${id} not found — skipped`);
        continue;
      }
      console.log(`  ✓ ${res.rows[0].id}  ${res.rows[0].title}`);
    }
    console.log("\nDone. Verify with:");
    console.log(`  psql "$DATABASE_URL" -c "SELECT id, length(reading_key_json::text) FROM passages ORDER BY id;"`);
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
