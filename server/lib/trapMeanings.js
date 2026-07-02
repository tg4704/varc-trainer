// Shared distractor-archetype meanings for AI prompts (evaluate.js, coach.js).
// Covers the full taxonomy from content-pipeline/PIPELINE.md — the old 4-type dict
// in evaluate.js was stale once ai_generated questions (7 more archetypes) went live.
const TRAP_MEANINGS = {
  too_extreme: "uses absolute language (always/never/only/completely) that the text doesn't support",
  out_of_scope: "introduces a concept or claim not present in the text",
  real_but_unstated: "may be true in general but the text doesn't say or imply it",
  partially_correct: "captures part of the point but misses a key qualification or nuance",
  too_broad: "is true or supported but too general to answer this specific question",
  distortion: "reverses a relationship or causal direction the text actually states",
  wrong_question: "is accurate to the text but answers a different question than the one asked",
  wrong_location: "is true, but drawn from a different part of the text than this question concerns",
  mislabelled: "attaches the right content to the wrong term or label",
  wordplay: "puns on a term's surface form/spelling rather than its meaning in context",
  tone_mismatch: "the facts may fit, but the tone/stance clashes with the author's actual attitude",
};

function trapMeaning(trapType) {
  return TRAP_MEANINGS[trapType] || "does not correctly follow from the text";
}

// Builds a "TRAP TYPE MEANINGS" reference block for only the meanings relevant to
// this question (its own trapType, or all of them if unspecified).
function buildTrapMeaningsBlock(trapTypes) {
  const keys = trapTypes && trapTypes.length ? trapTypes : Object.keys(TRAP_MEANINGS);
  return keys
    .filter((k) => TRAP_MEANINGS[k])
    .map((k) => `- ${k}: ${TRAP_MEANINGS[k]}`)
    .join("\n");
}

module.exports = { TRAP_MEANINGS, trapMeaning, buildTrapMeaningsBlock };
