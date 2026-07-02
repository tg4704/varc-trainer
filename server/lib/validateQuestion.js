// Shared question payload validation + option normalization.
// Used by both admin (routes/admin.js) and user (routes/myQuestions.js).

const VALID_TOPICS = ["economics", "humanities", "philosophy", "science", "social"];
const VALID_TYPES  = [
  "inference", "tone", "title", "detail", "application",
  "main_idea", "function", "concept_set", "vocab_in_context", "weaken_strengthen",
];
const VALID_TRAPS  = [
  "too_extreme", "out_of_scope", "real_but_unstated", "partially_correct",
  "too_broad", "distortion", "wrong_question", "wrong_location", "mislabelled",
  "wordplay", "tone_mismatch",
];

function validateQuestionPayload(body) {
  const required = ["topic", "paragraph", "question", "type", "options", "correctIndex", "sourceLines"];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || String(body[k]).trim() === "") {
      return `Missing required field: ${k}`;
    }
  }
  if (!VALID_TOPICS.includes(body.topic)) return `topic must be one of: ${VALID_TOPICS.join(", ")}`;
  if (!VALID_TYPES.includes(body.type))   return `type must be one of: ${VALID_TYPES.join(", ")}`;
  if (!Array.isArray(body.options) || body.options.length !== 4) {
    return "options must be an array of exactly 4";
  }
  for (let i = 0; i < 4; i++) {
    if (!body.options[i] || typeof body.options[i].text !== "string" || !body.options[i].text.trim()) {
      return `Option ${i} needs text`;
    }
  }
  const ci = body.correctIndex;
  if (![0, 1, 2, 3].includes(ci)) return "correctIndex must be 0, 1, 2, or 3";
  if (body.trapIndex != null) {
    if (![0, 1, 2, 3].includes(body.trapIndex)) return "trapIndex must be 0–3 or null";
    if (body.trapIndex === ci) return "trapIndex and correctIndex must be different";
    if (body.trapType && !VALID_TRAPS.includes(body.trapType)) {
      return `trapType must be one of: ${VALID_TRAPS.join(", ")}`;
    }
  }
  return null; // valid
}

// Normalise the options array to embed isCorrect/isTrap/trapType consistently.
function normalizeOptions(options, correctIndex, trapIndex, trapType) {
  return options.map((o, i) => ({
    text: o.text.trim(),
    isCorrect: i === correctIndex,
    isTrap: trapIndex != null && i === trapIndex,
    trapType: trapIndex != null && i === trapIndex ? (trapType || null) : null,
  }));
}

module.exports = { validateQuestionPayload, normalizeOptions, VALID_TOPICS, VALID_TYPES, VALID_TRAPS };
