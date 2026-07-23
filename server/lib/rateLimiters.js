// Rate limiters - "Balanced" profile (see Operations/Launch & Production
// Readiness.md in the Graspr Obsidian vault for the security checklist this
// implements). In-memory store, fine for the current single Railway
// instance; move to a Redis (Upstash) store if/when the app scales to
// multiple instances, since counts wouldn't be shared across them otherwise.
//
// The AI limiter is tier-aware (2026-07): its per-minute ceiling comes from
// tiers.js's `aiRateLimitPerMin`, read off req.userTier. This is deliberately
// separate from the daily/monthly caps in entitlements.js - caps meter real
// usage and are the monetization lever; this is pure burst/abuse protection
// and every tier's value sits far above human pace.
//
// ORDERING REQUIREMENT: req.userTier is set by attachTier/requireEntitlement/
// requireGuidedCoaching. A tier-resolving middleware MUST run before aiLimiter
// on every route, or the limiter silently sees `undefined` and falls back to
// the free-tier ceiling for everyone. attachTier is the cheap one (single PK
// lookup) and is what belongs in front of the limiter; requireEntitlement
// (which runs cap-counting queries) stays *after*, so a flood gets rejected
// before it can trigger the expensive counting.
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { getTier, DEFAULT_TIER, TIERS } = require("../config/tiers");

// Keys by the authenticated user when available (all AI routes require
// auth), falling back to a properly-normalized IP for the rare unauthenticated
// hit (e.g. a request with a bad/missing token that 401s before this runs on
// some route orderings) - ipKeyGenerator handles IPv6 subnets correctly,
// which a raw req.ip string does not.
function userOrIpKey(req) {
  return req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip);
}

// Global - every /api request. Loose enough that no real usage pattern
// should ever hit it; just stops a runaway script or scraper.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // The Razorpay webhook is exempt. It's authenticated by HMAC over the raw
  // body (so the limiter buys nothing), it arrives from a small pool of
  // Razorpay IPs, and Razorpay retries a failed delivery a limited number of
  // times. A 429 here means a user who genuinely paid never gets their plan -
  // the worst possible failure mode for this app, traded against no real
  // security gain.
  skip: (req) => req.path === "/billing/webhook",
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Auth routes - login/register/forgot-password. Tighter, keyed by IP since
// there's no authenticated user yet at this point in the request.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: "Too many attempts. Please wait a minute and try again." },
});

// Highest ceiling any tier defines - what admins get, so an operator running
// a bulk/QA script against their own account never rate-limits themselves.
const MAX_TIER_RATE = Math.max(
  ...Object.values(TIERS).map((t) => t.aiRateLimitPerMin || 0)
);

// Per-minute AI ceiling for this request. Unknown/missing tier → free-tier
// value: the safe direction to fail, since an unresolved tier means we can't
// prove the user is entitled to more.
function aiLimitForRequest(req) {
  if (req.userRole === "admin") return MAX_TIER_RATE;
  const tier = getTier(req.userTier || DEFAULT_TIER);
  return tier.aiRateLimitPerMin || getTier(DEFAULT_TIER).aiRateLimitPerMin;
}

// AI routes - the ones that actually call the model (evaluate, coach
// reading-map/attempts/exchange, my-questions draft generation,
// batch-evaluate). Keyed per-user, not per-IP, so one heavy user can't use
// up the whole office's/campus NAT's shared budget.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: aiLimitForRequest,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: "You're sending AI requests too quickly. Please wait a moment and try again." },
});

// Billing mutations - order/subscription creation and the signature-verify
// callbacks. Tight on purpose:
//   • order creation hits Razorpay's API and writes a `payments` row, so an
//     unthrottled loop is both a cost and a junk-data problem;
//   • the /verify endpoints compare an attacker-supplied HMAC, and while
//     brute-forcing SHA-256 is not realistic, there is no legitimate reason to
//     offer an unlimited oracle for it.
// 10/min per authenticated user is far above any real checkout (a human buys
// once, occasionally retries) and far below anything scripted.
const billingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: "Too many billing requests. Please wait a minute and try again." },
});

module.exports = { apiLimiter, authLimiter, aiLimiter, billingLimiter, aiLimitForRequest };
