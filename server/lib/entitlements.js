// ── Entitlements — daily caps + monthly kill-switch ───────────────────────────
// Resolves a user's effective tier and enforces the per-tier daily caps and the
// monthly ₹-cost kill-switch from config/tiers.js. Enforcement is gated behind
// ENABLE_TIERS — when off, every check passes (the scaffolding ships inert).
//
// Metered units (matching the pricing model):
//   • drills — one AI reasoning eval = one api_calls row on /api/attempts/evaluate
//   • coach  — one passage = one coach_sessions row created
// The kill-switch reads real spend from api_calls.est_cost_usd × USD_TO_INR.
const db = require("../db");
const { getTier, PAID_TIERS, DEFAULT_TIER, ENABLE_TIERS, USD_TO_INR } = require("../config/tiers");

// The monthly ₹ kill-switch is OFF by default — the report's ceilings sit below
// what the advertised daily caps cost when fully used, so hard-enforcing them
// would cut a heavy paying user off mid-cycle (a broken promise). Parked as a
// deliberate decision: revisit as a soft-degrade (drop to a cheaper model past
// the ceiling) rather than a hard block. Daily caps stay enforced regardless.
const ENABLE_KILL_SWITCH = process.env.ENABLE_KILL_SWITCH === "true";

// Start-of-today and start-of-month as timestamptz instants, in IST (the day a
// user's cap resets is their local day, not UTC).
const DAY_START = "date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";
const MONTH_START = "date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";

// The user's effective tier key: a paid tier whose expiry has passed collapses
// to free. Accepts the user row (needs tier + tier_expires_at).
function effectiveTierKey(user) {
  const key = user?.tier || DEFAULT_TIER;
  if (!PAID_TIERS.includes(key)) return DEFAULT_TIER;
  if (user.tier_expires_at && new Date(user.tier_expires_at) < new Date()) return DEFAULT_TIER;
  return key;
}

// Next paid tier up from the current one (for the upgrade prompt). null at the top.
function nextTierUp(key) {
  const idx = PAID_TIERS.indexOf(key);
  if (key === DEFAULT_TIER) return PAID_TIERS[0];
  if (idx === -1 || idx === PAID_TIERS.length - 1) return null;
  return PAID_TIERS[idx + 1];
}

async function countTodayDrills(userId) {
  const row = await db.get(
    `SELECT COUNT(*)::int AS n FROM api_calls
      WHERE user_id = $1 AND route = '/api/attempts/evaluate' AND created_at >= ${DAY_START}`,
    [userId]
  );
  return row?.n || 0;
}

async function countTodayCoach(userId) {
  const row = await db.get(
    `SELECT COUNT(*)::int AS n FROM coach_sessions
      WHERE user_id = $1 AND created_at >= ${DAY_START}`,
    [userId]
  );
  return row?.n || 0;
}

async function monthCostInr(userId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(est_cost_usd), 0) AS usd FROM api_calls
      WHERE user_id = $1 AND created_at >= ${MONTH_START}`,
    [userId]
  );
  return (Number(row?.usd) || 0) * USD_TO_INR;
}

// Core check. Returns { allowed, reason, tier, cap, used, upgradeTo }.
// reason ∈ 'ok' | 'disabled' | 'admin' | 'daily_cap' | 'cost_ceiling'.
async function checkEntitlement(user, kind) {
  if (!ENABLE_TIERS) return { allowed: true, reason: "disabled", tier: effectiveTierKey(user) };
  if (user?.role === "admin") return { allowed: true, reason: "admin", tier: "topper" };

  const tierKey = effectiveTierKey(user);
  const tier = getTier(tierKey);

  // Kill-switch (off by default — see ENABLE_KILL_SWITCH note above).
  if (ENABLE_KILL_SWITCH) {
    const spent = await monthCostInr(user.id);
    if (spent >= tier.monthlyCostCeilingInr) {
      return { allowed: false, reason: "cost_ceiling", tier: tierKey, upgradeTo: nextTierUp(tierKey) };
    }
  }

  const cap = tier.caps[kind];
  const used = kind === "coach" ? await countTodayCoach(user.id) : await countTodayDrills(user.id);
  if (used >= cap) {
    return { allowed: false, reason: "daily_cap", tier: tierKey, cap, used, upgradeTo: nextTierUp(tierKey) };
  }
  return { allowed: true, reason: "ok", tier: tierKey, cap, used };
}

// Express middleware factory. Loads the user, stashes req.userTier for
// downstream model routing, and 402s when a limit is hit. Fails OPEN on any
// internal error — a metering hiccup must never break the core product; the
// kill-switch is the real backstop.
function requireEntitlement(kind) {
  return async function (req, res, next) {
    try {
      const user = await db.get(
        "SELECT id, role, tier, tier_expires_at FROM users WHERE id = $1",
        [req.userId]
      );
      if (!user) return res.status(401).json({ error: "Invalid session" });
      req.userTier = effectiveTierKey(user);

      // Deferred drills submits (timed sessions) only SAVE the attempt — no AI
      // call fires now, so they don't consume a reasoning. The later batch-
      // evaluate is where those get graded.
      if (kind === "drills" && req.body && req.body.deferred === true) return next();

      const result = await checkEntitlement(user, kind);
      if (result.allowed) return next();

      const upgradeName = result.upgradeTo ? getTier(result.upgradeTo).name : null;
      const message =
        result.reason === "cost_ceiling"
          ? "You've reached this month's AI usage limit for your plan."
          : `You've used all ${result.cap} of today's ${kind === "coach" ? "Coach passages" : "AI reasonings"}.`;
      return res.status(402).json({
        error: message,
        reason: result.reason,
        tier: result.tier,
        cap: result.cap,
        used: result.used,
        upgradeTo: result.upgradeTo,
        upgradeName,
      });
    } catch (e) {
      // Fail open — don't let a counting bug take down AI feedback.
      console.error("[entitlements] check failed (allowing through):", e.message);
      next();
    }
  };
}

// Resolves req.userTier without enforcing any cap — for AI routes that run
// inside an already-metered unit (e.g. Coach reading-map/attempt/exchange all
// live inside one passage, which was metered at session creation). They still
// need the tier for model routing. Fails open to undefined tier (→ DEFAULT_MODEL).
function attachTier(req, res, next) {
  db.get("SELECT id, role, tier, tier_expires_at FROM users WHERE id = $1", [req.userId])
    .then((user) => { if (user) req.userTier = effectiveTierKey(user); next(); })
    .catch(() => next());
}

module.exports = {
  effectiveTierKey,
  nextTierUp,
  checkEntitlement,
  requireEntitlement,
  attachTier,
  monthCostInr,
  countTodayDrills,
  countTodayCoach,
};
