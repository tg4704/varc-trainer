// Rate limiters — "Balanced" profile (see Operations/Launch & Production
// Readiness.md in the Graspr Obsidian vault for the security checklist this
// implements). In-memory store, fine for the current single Railway
// instance; move to a Redis (Upstash) store if/when the app scales to
// multiple instances, since counts wouldn't be shared across them otherwise.
//
// TODO (backlog, not built yet): the AI limiter below is a single flat
// per-user rate for everyone. Once paid tiers exist (users.tier column,
// Razorpay — see Roadmap/Phase 6 - Monetization.md), this should become
// tier-aware (e.g. free = 20/min, paid = higher/unlimited). Revisit then —
// swap the flat `limit` for a function reading req.user's tier once auth
// middleware exposes it, or add a second limiter keyed by tier.
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Keys by the authenticated user when available (all AI routes require
// auth), falling back to a properly-normalized IP for the rare unauthenticated
// hit (e.g. a request with a bad/missing token that 401s before this runs on
// some route orderings) — ipKeyGenerator handles IPv6 subnets correctly,
// which a raw req.ip string does not.
function userOrIpKey(req) {
  return req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip);
}

// Global — every /api request. Loose enough that no real usage pattern
// should ever hit it; just stops a runaway script or scraper.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Auth routes — login/register/forgot-password. Tighter, keyed by IP since
// there's no authenticated user yet at this point in the request.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: "Too many attempts. Please wait a minute and try again." },
});

// AI routes — the ones that actually call the model (evaluate, coach
// reading-map/attempts/exchange, my-questions draft generation,
// batch-evaluate). Keyed per-user, not per-IP, so one heavy user can't use
// up the whole office's/campus NAT's shared budget, and so it lines up with
// the future tier-aware version described above.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: "You're sending AI requests too quickly. Please wait a moment and try again." },
});

module.exports = { apiLimiter, authLimiter, aiLimiter };
