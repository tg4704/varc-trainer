// ── Pricing tiers — the single source of truth ───────────────────────────────
// Mirrors the 2026-07 pricing report: per-tier daily caps, model routing,
// monthly kill-switch ceiling, and price. Everything downstream (entitlements,
// model selection, billing, the pricing page) reads from here.
//
// Tier keys reuse the existing users.tier values: 'free' is the free tier
// (display name "Skimmer") so no data migration is needed for existing users.
//
// Model IDs are OpenRouter format. VERIFY each against openrouter.ai/models
// before flipping ENABLE_TIERS on in production — an unknown ID simply falls
// back to SAFE_MODEL (the known-good model the app already runs), so a wrong
// ID degrades gracefully rather than breaking a call.

// Final fallback for every tier — the model the app is already proven on.
const SAFE_MODEL = "anthropic/claude-haiku-4-5";

const TIERS = {
  free: {
    key: "free",
    name: "Skimmer",
    tagline: "Get a feel for trap-recognition.",
    priceInr: 0,
    order: 0,
    caps: { drills: 15, coach: 2 }, // AI reasonings/day · Coach passages/day
    models: { drills: "openai/gpt-oss-120b", coach: "openai/gpt-oss-120b" },
    fallbackModels: { drills: "google/gemma-4-26b", coach: "google/gemma-4-26b" },
    // Kill-switch: pause/degrade AI once this month's real cost crosses here.
    // Generous vs the ~₹13 capped max — this only ever catches abuse/scripts.
    monthlyCostCeilingInr: 30,
    features: ["Unlimited question practice", "15 AI reasonings/day", "2 Coach passages/day", "Accuracy & trap dashboard"],
  },
  inference: {
    key: "inference",
    name: "Inference",
    tagline: "Build the single most-tested RC skill.",
    priceInr: 100,
    order: 1,
    caps: { drills: 30, coach: 5 },
    models: { drills: "openai/gpt-4o-mini", coach: "openai/gpt-4o-mini" },
    fallbackModels: { drills: "google/gemma-4-31b", coach: "google/gemma-4-31b" },
    monthlyCostCeilingInr: 45,
    features: ["Everything in Skimmer", "30 AI reasonings/day", "5 Coach passages/day", "Trap-type weakness analytics"],
  },
  ninetyninth: {
    key: "ninetyninth",
    name: "99th Percentile",
    tagline: "Full AI coaching, every surface.",
    priceInr: 300,
    order: 2,
    caps: { drills: 50, coach: 10 },
    models: { drills: "z-ai/glm-4.6", coach: "z-ai/glm-4.6" },
    fallbackModels: { drills: "deepseek/deepseek-chat-v3.1", coach: "deepseek/deepseek-chat-v3.1" },
    monthlyCostCeilingInr: 130,
    features: ["Everything in Inference", "50 AI reasonings/day", "10 Coach passages/day", "Socratic debrief on every question"],
  },
  topper: {
    key: "topper",
    name: "Topper",
    tagline: "For aspirants who want every edge.",
    priceInr: 700,
    order: 3,
    caps: { drills: 100, coach: 20 },
    models: { drills: "anthropic/claude-haiku-4-5", coach: "anthropic/claude-haiku-4-5" },
    fallbackModels: { drills: "google/gemini-2.5-pro", coach: "google/gemini-2.5-pro" },
    monthlyCostCeilingInr: 300,
    features: ["Everything in 99th Percentile", "100 AI reasonings/day", "20 Coach passages/day", "Priority AI response times"],
  },
};

const DEFAULT_TIER = "free";
const PAID_TIERS = ["inference", "ninetyninth", "topper"];

// Enforcement + per-tier model routing are OFF until this is set true — the
// scaffolding can ship safely; nothing changes for current users until launch.
const ENABLE_TIERS = process.env.ENABLE_TIERS === "true";

// Used to convert api_calls.est_cost_usd → ₹ for the kill-switch.
const USD_TO_INR = Number(process.env.USD_TO_INR || 95);

function getTier(key) {
  return TIERS[key] || TIERS[DEFAULT_TIER];
}

function isValidPaidTier(key) {
  return PAID_TIERS.includes(key);
}

// Public-safe view for the pricing page (no model internals or kill-switch).
function publicTiers() {
  return Object.values(TIERS)
    .sort((a, b) => a.order - b.order)
    .map(({ key, name, tagline, priceInr, order, caps, features }) => ({
      key, name, tagline, priceInr, order, caps, features,
    }));
}

module.exports = {
  TIERS, DEFAULT_TIER, PAID_TIERS, SAFE_MODEL, USD_TO_INR, ENABLE_TIERS,
  getTier, isValidPaidTier, publicTiers,
};
