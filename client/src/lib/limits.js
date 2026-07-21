// Client-side mirror of the server's input caps.
//
// The server is the real gate (server/lib/schemas.js for the zod-validated
// routes, server/lib/validateQuestion.js for question CRUD). This file exists
// so the UI can stop the user *before* they hit that gate: without it, a
// student writes 900 characters of reasoning, clicks submit, and gets a bare
// 400 back with their typed work still sitting in a textarea they now have to
// hand-trim. Especially bad on the AI routes, where the click also costs a
// cap unit.
//
// RULE: every value here must equal its server counterpart, not merely be
// smaller. A client cap that is stricter than the server's is a silent
// truncation - the user hits an invisible wall mid-sentence with no counter
// explaining why. Where a field has a hard `maxLength`, pair it with a visible
// counter so the wall is never a surprise.
//
// Keep in sync with:
//   server/lib/schemas.js          (auth, evaluate, coach, sessions, drafts)
//   server/lib/validateQuestion.js (question CRUD field caps)
//   server/routes/admin.js         (bulletin title/body)
//   server/routes/questions.js     (flag note)

// ── auth ─────────────────────────────────────────────────────────────────────
export const AUTH = {
  // bcrypt silently ignores bytes past 72, so anything longer is a password
  // the user thinks is stronger than it is. Server rejects at 72; match it.
  PASSWORD_MAX: 72,
  PASSWORD_MIN: 6,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  EMAIL_MAX: 254, // RFC 5321
  NAME_MAX: 60,
  OTP_LENGTH: 6,
};

// ── profile ──────────────────────────────────────────────────────────────────
export const PROFILE = {
  BIO_WORD_LIMIT: 40, // what the user is shown + what the route enforces
  BIO_CHAR_MAX: 1000, // the zod ceiling behind it; a backstop, not the UX limit
};

// ── AI inputs ────────────────────────────────────────────────────────────────
// These are the ones that cost money per submit and burn a daily cap unit, so
// a rejected request is worse here than anywhere else in the app.
export const AI = {
  // Drills reasoning -> evaluateSchema.reasoningText
  DRILL_REASONING_MAX: 500,
  // Coach answer reasoning -> coachAttemptSchema.reasoningText
  COACH_REASONING_MAX: 1000,
  // Coach "Stuck? Discuss" chat -> coachExchangeSchema.message
  COACH_DISCUSS_MAX: 300,
  // Reading map -> coachReadingMapSchema
  READING_CRUX_MAX: 200,
  READING_CRUX_ROWS: 20,
  READING_MAIN_POINT_MAX: 1000,
  READING_TONE_MAX: 200,
  READING_STRUCTURE_MAX: 300,
  READING_STRUCTURE_ROWS: 20,
  READING_TURN_MAX: 500,
  // AI question draft -> generateDraftSchema.paragraph
  DRAFT_PARAGRAPH_MIN: 100,
  DRAFT_PARAGRAPH_MAX: 9000,
};

// ── question CRUD ────────────────────────────────────────────────────────────
export const QUESTION = {
  PARAGRAPH_MAX: 9000,
  QUESTION_MAX: 600,
  OPTION_MAX: 600,
  SOURCE_LINES_MAX: 2000,
};

// ── misc ─────────────────────────────────────────────────────────────────────
export const MISC = {
  FLAG_NOTE_MAX: 300,
  PASSAGE_NOTE_MAX: 300, // Practice passage annotation (local only, but unbounded input is still a bug)
  BULLETIN_TITLE_MAX: 200,
  BULLETIN_BODY_MAX: 4000,
  // express.json({ limit: "100kb" }) in server/index.js. Checked client-side so
  // a big import paste reports something better than a bare 413.
  JSON_IMPORT_MAX_BYTES: 100 * 1024,
};
