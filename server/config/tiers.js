// ── Pricing tiers - the single source of truth ───────────────────────────────
// Mirrors the 2026-07 pricing report: per-tier daily caps, model routing,
// monthly kill-switch ceiling, and price. Everything downstream (entitlements,
// model selection, billing, the pricing page) reads from here.
//
// Tier keys reuse the existing users.tier values: 'free' is the free tier
// (display name "Skimmer") so no data migration is needed for existing users.
//
// Model IDs are OpenRouter format. VERIFY each against openrouter.ai/models
// before flipping ENABLE_TIERS on in production - an unknown ID simply falls
// back to SAFE_MODEL (the known-good model the app already runs), so a wrong
// ID degrades gracefully rather than breaking a call.

// Final fallback for every tier - the model the app is already proven on.
const SAFE_MODEL = "anthropic/claude-haiku-4.5";

// Cap model:
//   • caps.{drills,coach}        - per-DAY limits (null = no daily limit)
//   • monthlyCaps.{drills,coach} - per-MONTH limits (null = not metered monthly)
// A tier enforces its daily cap when set; otherwise its monthly cap; otherwise
// it's unlimited. The top tiers ("Consistent", "Topper") drop the daily cap for
// a larger monthly pool so a heavy study day isn't artificially throttled.
const TIERS = {
  free: {
    key: "free",
    name: "Skimmer",
    tagline: "Get a feel for trap-recognition.",
    priceInr: 0,
    order: 0,
    caps: { drills: 10, coach: 1 }, // AI reasonings/day · Coach passages/day
    monthlyCaps: { drills: null, coach: null },
    models: { drills: "openai/gpt-oss-120b", coach: "openai/gpt-oss-120b" },
    fallbackModels: { drills: "google/gemma-4-26b-a4b-it", coach: "google/gemma-4-26b-a4b-it" },
    // Kill-switch: pause/degrade AI once this month's real cost crosses here.
    // Generous vs the ~₹13 capped max - this only ever catches abuse/scripts.
    monthlyCostCeilingInr: 30,
    // Per-minute burst ceiling on AI routes. This is abuse protection, NOT the
    // monetization lever - caps/monthlyCaps are what meter real usage. Every
    // tier sits far above normal human pace (a reasoning takes ~30s to write),
    // so this only ever catches a script. Free stays at the historical flat 20
    // so no existing user gets a worse limit than before tiers existed.
    aiRateLimitPerMin: 20,
    features: ["Unlimited Drills practice", "10 AI reasonings/day", "1 Coach passage/day", "Accuracy & trap dashboard"],
  },
  inference: {
    key: "inference",
    name: "Inference",
    tagline: "Build the single most-tested RC skill.",
    priceInr: 99,
    order: 1,
    caps: { drills: 25, coach: 4 },
    monthlyCaps: { drills: null, coach: null },
    models: { drills: "openai/gpt-4o-mini", coach: "openai/gpt-4o-mini" },
    fallbackModels: { drills: "google/gemma-4-31b-it", coach: "google/gemma-4-31b-it" },
    monthlyCostCeilingInr: 45,
    aiRateLimitPerMin: 30,
    features: ["Everything in Skimmer", "25 AI reasonings/day", "4 Coach passages/day"],
  },
  ninetyninth: {
    key: "ninetyninth",
    name: "Consistent",
    tagline: "Full AI coaching, every surface.",
    priceInr: 299,
    order: 2,
    caps: { drills: null, coach: null }, // no daily limit - metered monthly instead
    monthlyCaps: { drills: 1400, coach: 200 },
    models: { drills: "z-ai/glm-4.6", coach: "z-ai/glm-4.6" },
    fallbackModels: { drills: "deepseek/deepseek-chat-v3.1", coach: "deepseek/deepseek-chat-v3.1" },
    monthlyCostCeilingInr: 130,
    aiRateLimitPerMin: 45,
    features: ["Everything in Inference", "No daily limit", "1400 AI reasonings/month", "200 Coach passages/month", "Better & faster AI responses"],
  },
  topper: {
    key: "topper",
    name: "Topper",
    tagline: "For aspirants who want every edge.",
    priceInr: 699,
    order: 3,
    caps: { drills: null, coach: null }, // no daily limit - metered monthly instead
    monthlyCaps: { drills: 3000, coach: 500 },
    models: { drills: "anthropic/claude-haiku-4.5", coach: "anthropic/claude-haiku-4.5" },
    fallbackModels: { drills: "z-ai/glm-4.6", coach: "z-ai/glm-4.6" },
    monthlyCostCeilingInr: 300,
    aiRateLimitPerMin: 60,
    features: ["Everything in Consistent", "No daily limit", "3000 AI reasonings/month", "500 Coach passages/month", "Best-quality AI responses"],
  },
};

const DEFAULT_TIER = "free";
const PAID_TIERS = ["inference", "ninetyninth", "topper"];

// Enforcement + per-tier model routing are OFF until this is set true - the
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
    .map(({ key, name, tagline, priceInr, order, caps, monthlyCaps, features }) => ({
      key, name, tagline, priceInr, order, caps, monthlyCaps, features,
    }));
}

module.exports = {
  TIERS, DEFAULT_TIER, PAID_TIERS, SAFE_MODEL, USD_TO_INR, ENABLE_TIERS,
  getTier, isValidPaidTier, publicTiers,
};
