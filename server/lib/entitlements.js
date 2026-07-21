// ── Entitlements - daily caps + monthly kill-switch ───────────────────────────
// Resolves a user's effective tier and enforces the per-tier daily caps and the
// monthly ₹-cost kill-switch from config/tiers.js. Enforcement is gated behind
// ENABLE_TIERS - when off, every check passes (the scaffolding ships inert).
//
// Metered units (matching the pricing model):
//   • drills - one AI reasoning eval = one api_calls row on /api/attempts/evaluate
//   • coach  - one passage = one coach_sessions row created
// The kill-switch reads real spend from api_calls.est_cost_usd × USD_TO_INR.
const db = require("../db");
const { getTier, PAID_TIERS, DEFAULT_TIER, ENABLE_TIERS, USD_TO_INR } = require("../config/tiers");

// The monthly ₹ kill-switch is OFF by default - the report's ceilings sit below
// what the advertised daily caps cost when fully used, so hard-enforcing them
// would cut a heavy paying user off mid-cycle (a broken promise). Parked as a
// deliberate decision: revisit as a soft-degrade (drop to a cheaper model past
// the ceiling) rather than a hard block. Daily caps stay enforced regardless.
const ENABLE_KILL_SWITCH = process.env.ENABLE_KILL_SWITCH === "true";

// Start-of-today and start-of-month as timestamptz instants, in IST (the day a
// user's cap resets is their local day, not UTC).
const DAY_START = "date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";
const MONTH_START = "date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";

// Loads the tier-relevant user row once per request and memoises it on req.
// Three middlewares here need the same row (attachTier, requireEntitlement,
// requireGuidedCoaching) and attachTier now runs ahead of the rate limiter on
// AI routes, so without this the common chain would query the same PK twice.
// Also stashes req.userTier/req.userRole, which the tier-aware AI rate limiter
// reads (see lib/rateLimiters.js).
async function loadTierUser(req) {
  if (req._tierUser !== undefined) return req._tierUser;
  const user = await db.get(
    "SELECT id, role, tier, tier_expires_at FROM users WHERE id = $1",
    [req.userId]
  );
  req._tierUser = user || null;
  if (user) {
    req.userTier = effectiveTierKey(user);
    req.userRole = user.role;
  }
  return req._tierUser;
}

// The user's effective tier key: a paid tier whose expiry has passed collapses
// to free. Accepts the user row (needs tier + tier_expires_at).
function effectiveTierKey(user) {
  const key = user?.tier || DEFAULT_TIER;
  if (!PAID_TIERS.includes(key)) return DEFAULT_TIER;
  if (user.tier_expires_at && new Date(user.tier_expires_at) < new Date()) return DEFAULT_TIER;
  return key;
}

// ── Feature gates (not usage caps) ────────────────────────────────────────────
// "1-on-1 AI coaching" - the multi-turn back-and-forth tutor chat in Coach
// (POST /api/coach/exchange). Lower tiers still get the full instant answer +
// written explanation from /attempts; only the interactive dialogue is gated.
const GUIDED_COACHING_TIERS = new Set(["ninetyninth", "topper"]);

function canUseGuidedCoaching(user) {
  if (!ENABLE_TIERS) return true;            // scaffolding inert when flag off
  if (user?.role === "admin") return true;   // admins bypass, like the caps do
  return GUIDED_COACHING_TIERS.has(effectiveTierKey(user));
}

// Middleware for POST /api/coach/exchange: sets req.userTier (for model routing,
// same as attachTier) and 402s lower tiers with structured upgrade info so the
// app-wide upgrade prompt fires. Fails OPEN - a lookup hiccup never hard-blocks.
function requireGuidedCoaching(req, res, next) {
  loadTierUser(req)
    .then((user) => {
      if (!user || canUseGuidedCoaching(user)) return next();
      const upgradeTo = "ninetyninth";
      return res.status(402).json({
        error: "1-on-1 AI coaching is available on the Consistent and Topper plans.",
        reason: "feature_locked",
        feature: "guided_coaching",
        tier: effectiveTierKey(user),
        upgradeTo,
        upgradeName: getTier(upgradeTo).name,
      });
    })
    .catch(() => next());
}

// Next paid tier up from the current one (for the upgrade prompt). null at the top.
function nextTierUp(key) {
  const idx = PAID_TIERS.indexOf(key);
  if (key === DEFAULT_TIER) return PAID_TIERS[0];
  if (idx === -1 || idx === PAID_TIERS.length - 1) return null;
  return PAID_TIERS[idx + 1];
}

// Both routes that actually grade a reasoning. Instant sessions hit
// /attempts/evaluate one question at a time; timed (deferred) sessions skip
// that entirely and grade the whole set later via batch-evaluate. Counting
// only the first route left every timed session unmetered, which made the
// daily cap avoidable just by choosing a timer.
const DRILL_EVAL_ROUTES = "('/api/attempts/evaluate', '/api/sessions/batch-evaluate')";

async function countTodayDrills(userId) {
  // SUM(units), not COUNT(*) - one batch call grades N questions and is logged
  // with units = N. Only successful evals count: a failed AI call (logged with
  // status='error') must not burn the user's daily allowance.
  const row = await db.get(
    `SELECT COALESCE(SUM(units), 0)::int AS n FROM api_calls
      WHERE user_id = $1 AND route IN ${DRILL_EVAL_ROUTES}
        AND status = 'ok' AND created_at >= ${DAY_START}`,
    [userId]
  );
  return row?.n || 0;
}

// Note: deliberately NOT filtered on deleted_at. A soft-deleted session still
// consumed its passage, so it must keep counting. Filtering here would restore
// the exact refund-on-delete hole the soft delete exists to close.
async function countTodayCoach(userId) {
  const row = await db.get(
    `SELECT COUNT(*)::int AS n FROM coach_sessions
      WHERE user_id = $1 AND created_at >= ${DAY_START}`,
    [userId]
  );
  return row?.n || 0;
}

async function countMonthDrills(userId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(units), 0)::int AS n FROM api_calls
      WHERE user_id = $1 AND route IN ${DRILL_EVAL_ROUTES}
        AND status = 'ok' AND created_at >= ${MONTH_START}`,
    [userId]
  );
  return row?.n || 0;
}

async function countMonthCoach(userId) {
  const row = await db.get(
    `SELECT COUNT(*)::int AS n FROM coach_sessions
      WHERE user_id = $1 AND created_at >= ${MONTH_START}`,
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

  // Kill-switch (off by default - see ENABLE_KILL_SWITCH note above).
  if (ENABLE_KILL_SWITCH) {
    const spent = await monthCostInr(user.id);
    if (spent >= tier.monthlyCostCeilingInr) {
      return { allowed: false, reason: "cost_ceiling", tier: tierKey, upgradeTo: nextTierUp(tierKey) };
    }
  }

  // Daily cap takes precedence; a tier with no daily cap is metered monthly.
  const dailyCap = tier.caps?.[kind];
  if (dailyCap != null) {
    const used = kind === "coach" ? await countTodayCoach(user.id) : await countTodayDrills(user.id);
    if (used >= dailyCap) {
      return { allowed: false, reason: "daily_cap", tier: tierKey, cap: dailyCap, used, period: "day", upgradeTo: nextTierUp(tierKey) };
    }
    return { allowed: true, reason: "ok", tier: tierKey, cap: dailyCap, used, period: "day" };
  }

  const monthlyCap = tier.monthlyCaps?.[kind];
  if (monthlyCap != null) {
    const used = kind === "coach" ? await countMonthCoach(user.id) : await countMonthDrills(user.id);
    if (used >= monthlyCap) {
      return { allowed: false, reason: "monthly_cap", tier: tierKey, cap: monthlyCap, used, period: "month", upgradeTo: nextTierUp(tierKey) };
    }
    return { allowed: true, reason: "ok", tier: tierKey, cap: monthlyCap, used, period: "month" };
  }

  // No cap configured for this kind → unlimited.
  return { allowed: true, reason: "ok", tier: tierKey, cap: null, used: 0, period: null };
}

// Express middleware factory. Loads the user, stashes req.userTier for
// downstream model routing, and 402s when a limit is hit. Fails OPEN on any
// internal error - a metering hiccup must never break the core product; the
// kill-switch is the real backstop.
function requireEntitlement(kind) {
  return async function (req, res, next) {
    try {
      const user = await loadTierUser(req);
      if (!user) return res.status(401).json({ error: "Invalid session" });

      // Deferred drills submits (timed sessions) only SAVE the attempt - no AI
      // call fires now, so they don't consume a reasoning. The later batch-
      // evaluate is where those get graded.
      if (kind === "drills" && req.body && req.body.deferred === true) return next();

      const result = await checkEntitlement(user, kind);
      if (result.allowed) return next();

      const upgradeName = result.upgradeTo ? getTier(result.upgradeTo).name : null;
      const unit = kind === "coach" ? "Coach passages" : "AI reasonings";
      const message =
        result.reason === "cost_ceiling"
          ? "You've reached this month's AI usage limit for your plan."
          : result.reason === "monthly_cap"
            ? `You've used all ${result.cap} of this month's ${unit}.`
            : `You've used all ${result.cap} of today's ${unit}.`;
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
      // Fail open - don't let a counting bug take down AI feedback.
      console.error("[entitlements] check failed (allowing through):", e.message);
      next();
    }
  };
}

// Resolves req.userTier without enforcing any cap - for AI routes that run
// inside an already-metered unit (e.g. Coach reading-map/attempt/exchange all
// live inside one passage, which was metered at session creation). They still
// need the tier for model routing. Fails open to undefined tier (→ DEFAULT_MODEL).
function attachTier(req, res, next) {
  loadTierUser(req).then(() => next()).catch(() => next());
}

module.exports = {
  effectiveTierKey,
  nextTierUp,
  checkEntitlement,
  requireEntitlement,
  attachTier,
  canUseGuidedCoaching,
  requireGuidedCoaching,
  monthCostInr,
  countTodayDrills,
  countTodayCoach,
  countMonthDrills,
  countMonthCoach,
};
