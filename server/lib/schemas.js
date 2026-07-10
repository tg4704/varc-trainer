// zod schemas for auth + AI routes (the highest-risk surface: auth guards
// account takeover, AI routes are the ones that cost real money per call).
// Most of these routes already had decent hand-written length/presence
// checks — what zod adds on top is STRICT TYPING. A hand check like
// `if (!message || !message.trim())` lets a non-string truthy value (e.g.
// `{}`, `123`, `["x"]`) sail through and then crash on `.trim()` a few
// lines later (an unhandled 500, and with a malicious/buggy client hammering
// it, a cheap DoS). zod rejects the wrong shape before any of that code runs.
//
// Other route families (question CRUD, admin, sessions config, dashboard,
// flags) aren't covered here yet — see the backlog note in CLAUDE.md /
// the Obsidian vault's Launch & Production Readiness doc for the plan to
// extend this incrementally.
const { z } = require("./validate");
const { VALID_TOPICS, VALID_TYPES } = require("./validateQuestion");

// ── auth.js ──────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(72), // bcrypt silently ignores bytes past 72
  name: z.string().trim().max(60).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(72),
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim().length(6),
});

const resendOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  purpose: z.enum(["email_verification", "password_reset"]),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim().length(6),
  newPassword: z.string().min(6).max(72),
});

const usernamePatchSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/i),
});

const namePatchSchema = z.object({
  name: z.string().trim().max(60).optional().default(""),
});

const avatarPatchSchema = z.object({
  avatarId: z.string().min(1).max(40),
});

const profilePatchSchema = z.object({
  favoriteTopic: z.enum(VALID_TOPICS).nullable().optional(),
  bio: z.string().max(1000).optional(), // route trims + re-checks the real 240-word-ish cap; this is just a hard ceiling
});

const passwordPatchSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72),
});

// ── evaluate.js ──────────────────────────────────────────────────────────────
const evaluateSchema = z.object({
  sessionId: z.union([z.string(), z.number()]),
  questionId: z.union([z.string(), z.number()]),
  selectedOptionIndex: z.number().int().min(0).max(3),
  reasoningText: z.string().max(500).optional().default(""),
  timeTakenSeconds: z.number().nonnegative().max(86400).nullable().optional(),
  mode: z.enum(["analysis", "intuition"]).optional().default("analysis"),
  quotedLines: z.array(z.string().max(500)).max(20).optional(),
  deferred: z.boolean().optional().default(false),
});

// ── coach.js ─────────────────────────────────────────────────────────────────
const coachCreateSessionSchema = z.object({
  passageId: z.union([z.string(), z.number()]),
});

const coachReadingMapSchema = z.object({
  mode: z.enum(["quick", "full"]),
  crux: z.array(z.string().max(200)).max(20).optional(),
  mainPoint: z.string().max(1000).optional(),
  tone: z.string().max(200).optional(),
  structure: z.array(z.string().max(300)).max(20).optional(),
  theTurn: z.string().max(500).optional(),
});

const coachAttemptSchema = z.object({
  coachSessionId: z.union([z.string(), z.number()]),
  questionId: z.string().min(1).max(100),
  questionIndex: z.number().int().min(0).max(50).optional(),
  selectedOptionIndex: z.number().int().min(0).max(3),
  reasoningText: z.string().max(1000).optional().default(""),
});

const coachExchangeSchema = z.object({
  coachSessionId: z.union([z.string(), z.number()]),
  questionId: z.string().min(1).max(100),
  message: z.string().trim().min(1).max(300),
});

// ── sessions.js ──────────────────────────────────────────────────────────────
const createSessionSchema = z.object({
  numQuestions: z.number().int().min(1).max(25),
  timerMode: z.enum(["untimed", "count_up", "countdown"]),
  timerScope: z.enum(["per_question", "per_session"]).nullable().optional(),
  timerSeconds: z.number().int().positive().max(7200).nullable().optional(),
  feedbackMode: z.enum(["instant", "deferred"]).optional(),
  sessionType: z.enum(["practice", "review"]).optional(),
  typeFilter: z.string().max(50).nullable().optional(),
});

// ── myQuestions.js ───────────────────────────────────────────────────────────
const generateDraftSchema = z.object({
  paragraph: z.string().trim().min(100).max(9000),
  type: z.enum(VALID_TYPES).optional(),
  topic: z.enum(VALID_TOPICS).optional(),
});

module.exports = {
  registerSchema, loginSchema, verifyEmailSchema, resendOtpSchema,
  forgotPasswordSchema, resetPasswordSchema, usernamePatchSchema, namePatchSchema,
  avatarPatchSchema, profilePatchSchema, passwordPatchSchema,
  evaluateSchema,
  coachCreateSessionSchema, coachReadingMapSchema, coachAttemptSchema, coachExchangeSchema,
  createSessionSchema,
  generateDraftSchema,
};
