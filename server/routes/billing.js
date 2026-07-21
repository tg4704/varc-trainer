// ── Billing (Razorpay) ────────────────────────────────────────────────────────
// One-time "buy N months of a tier" payments - the right model for an
// unregistered individual Razorpay account (simpler KYC than recurring
// e-mandate; see the pricing report). Recurring subscriptions can be layered
// on later without changing this schema.
//
// Flow: create-order → Razorpay Checkout (client) → payment.captured webhook
// (signature-verified) → grant tier. The webhook - not the client callback - is
// the source of truth for granting access (a client can be tampered with).
//
// DEV MODE: with no RAZORPAY_KEY_ID/SECRET set, real orders aren't created and
// POST /dev-activate lets you grant a tier directly (non-production only), so
// the whole tier system is testable before KYC is done - same spirit as the
// email module's console-log dev mode.
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const { getTier, isValidPaidTier, publicTiers, ENABLE_TIERS } = require("../config/tiers");
const { effectiveTierKey, countTodayDrills, countTodayCoach, countMonthDrills, countMonthCoach, canUseGuidedCoaching } = require("../lib/entitlements");
const { currentSeason, catDate, seasonFor, availableSeasons, seasonPrice } = require("../lib/season");

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const IS_LIVE = Boolean(KEY_ID && KEY_SECRET);
const IS_PROD = process.env.NODE_ENV === "production";

let _rzp = null;
function razorpay() {
  if (!_rzp) {
    const Razorpay = require("razorpay");
    _rzp = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return _rzp;
}

const { grantTier, grantTierUntil, grantForPayment } = require("../lib/grants");
const subs = require("../lib/subscriptions");

// Resolves the season a "Till CAT" purchase targets. An explicit year is
// honoured only if that season is actually on sale right now - otherwise we
// fall back to the default. This is the guard against a stale pricing page (or
// a hand-crafted request) buying a season that has closed or isn't offered.
function resolveSeason(requestedYear, now = new Date()) {
  const year = Number(requestedYear);
  if (Number.isFinite(year)) {
    const match = availableSeasons(now).find((s) => s.year === year);
    if (match) return match;
  }
  return currentSeason(now);
}

// Price + duration for a (tier, period, seasonYear) triple. `period` is
// "monthly" (default) or "cat" (one-time, auto-priced from time left in the
// season, with that season's upfront discount applied). Server-authoritative so
// the pricing page, the review screen, and the actual charge never drift.
function quoteFor(tierKey, period, now = new Date(), seasonYear = null) {
  const tier = getTier(tierKey);
  if (period === "cat") {
    const s = resolveSeason(seasonYear, now);
    const p = seasonPrice(tier.priceInr, s);
    return {
      period: "cat",
      months: s.months,
      seasonYear: s.year,
      amountInr: p.totalInr,
      perMonthInr: p.perMonthInr,
      listTotalInr: p.listTotalInr,
      savingsInr: p.savingsInr,
      discountPct: p.discountPct,
      periodLabel: s.label,
      endsAt: s.targetIso,   // absolute expiry (the season end date)
      autoRenew: false,
    };
  }
  return {
    period: "monthly",
    months: 1,
    seasonYear: null,
    amountInr: tier.priceInr,
    perMonthInr: tier.priceInr,
    listTotalInr: tier.priceInr,
    savingsInr: 0,
    discountPct: 0,
    periodLabel: "Monthly · auto-renews",
    endsAt: null,            // relative to the buyer's current expiry (see /quote)
    autoRenew: true,         // monthly is a recurring autopay subscription
  };
}

// ── GET /api/billing/plans - public tier list for the pricing page ────────────
router.get("/plans", (req, res) => {
  const tiers = publicTiers();
  const seasons = availableSeasons().map((s) => ({
    year: s.year,
    label: s.label,
    months: s.months,
    endsAt: s.targetIso,
    discountPct: s.discountPct,
    daysRemaining: s.daysRemaining,
    // Per-tier prices computed here rather than on the client. The old page
    // did `Math.round(priceInr * months)` itself, which silently drifts from
    // the real charge the moment a discount exists. Display now reads the same
    // numbers the order is created from.
    prices: Object.fromEntries(
      tiers
        .filter((t) => t.priceInr > 0)
        .map((t) => [t.key, seasonPrice(t.priceInr, s)])
    ),
  }));
  res.json({
    tiers,
    live: IS_LIVE,
    currency: "INR",
    seasons,
    // Back-compat: the single-season field the previous pricing page read.
    season: seasons[0] || null,
  });
});

// ── GET /api/billing/quote - priced summary for the pre-checkout review screen ─
// The exact figures the user is about to pay for, incl. the resulting end date.
router.get("/quote", authenticate, async (req, res, next) => {
  try {
    const tierKey = String(req.query.tier || "");
    const period = req.query.period === "cat" ? "cat" : "monthly";
    if (!isValidPaidTier(tierKey)) {
      return res.status(400).json({ error: "Unknown or non-purchasable plan" });
    }
    const tier = getTier(tierKey);
    const q = quoteFor(tierKey, period, new Date(), req.query.seasonYear);

    const user = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    const currentExpiry = user?.tier_expires_at ? new Date(user.tier_expires_at) : null;
    const now = new Date();
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;

    // Resolve the concrete end date this purchase would produce.
    let endsAt;
    if (period === "cat") {
      const target = new Date(q.endsAt);
      endsAt = (currentExpiry && currentExpiry > target ? currentExpiry : target).toISOString();
    } else {
      const e = new Date(base);
      e.setMonth(e.getMonth() + 1);
      endsAt = e.toISOString();
    }

    res.json({
      tier: tierKey,
      tierName: tier.name,
      tagline: tier.tagline,
      features: tier.features,
      caps: tier.caps,
      monthlyCaps: tier.monthlyCaps,
      period: q.period,
      periodLabel: q.periodLabel,
      months: q.months,
      amountInr: q.amountInr,
      perMonthInr: q.perMonthInr,
      listTotalInr: q.listTotalInr,
      savingsInr: q.savingsInr,
      discountPct: q.discountPct,
      seasonYear: q.seasonYear,
      currency: "INR",
      startsAt: now.toISOString(),
      endsAt,
      autoRenew: q.autoRenew,
      currentExpiry: currentExpiry ? currentExpiry.toISOString() : null,
      isExtension: Boolean(currentExpiry && currentExpiry > now),
    });
  } catch (e) { next(e); }
});

// ── GET /api/billing/me - the caller's current plan ───────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await db.get("SELECT id, role, tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    const key = effectiveTierKey(user);
    const tier = getTier(key);
    // A tier with no daily cap is metered monthly - report usage against whatever
    // period actually applies to it, so the My Plan usage bars match enforcement.
    // Usage counters are cheap (single indexed COUNT each) and only meaningful
    // once caps are actually enforced - skip the extra queries while the flag
    // is off so this endpoint stays fast for every current user.
    const meteredMonthly = tier.caps?.drills == null && tier.caps?.coach == null;
    const usage = ENABLE_TIERS
      ? meteredMonthly
        ? { period: "month", drills: await countMonthDrills(user.id), coach: await countMonthCoach(user.id) }
        : { period: "day", drills: await countTodayDrills(user.id), coach: await countTodayCoach(user.id) }
      : null;
    // Recurring subscription state (for the "Cancel subscription" UI).
    const sub = await subs.getActiveSubscription(user.id);
    const subscription = sub
      ? {
          id: sub.razorpay_subscription_id,
          tier: sub.tier,
          status: sub.status,
          cancelAtCycleEnd: sub.cancel_at_cycle_end,
          currentEnd: sub.current_end || null,
        }
      : null;
    res.json({
      tier: key,
      tierName: tier.name,
      priceInr: tier.priceInr,
      caps: tier.caps,
      monthlyCaps: tier.monthlyCaps,
      usage,
      expiresAt: user?.tier_expires_at || null,
      isPaid: key !== "free",
      canCoach: canUseGuidedCoaching(user),
      subscription,
    });
  } catch (e) { next(e); }
});

// ── GET /api/billing/payments - the caller's purchase history ─────────────────
// Captured purchases only (a 'created'-but-never-paid row is just an abandoned
// Checkout, not something to show as history). No Razorpay-hosted invoice PDF
// exists for this Orders+Checkout flow (that's a separate Razorpay product,
// "Invoices" - a send-first flow that doesn't fit how this app charges), so the
// frontend renders its own printable receipt from this data instead.
router.get("/payments", authenticate, async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT id, tier, months, amount_inr, provider, razorpay_order_id, razorpay_payment_id, captured_at, period, season_year
         FROM payments
        WHERE user_id = $1 AND status = 'captured'
        ORDER BY captured_at DESC`,
      [req.userId]
    );
    res.json({
      payments: rows.map((p) => ({
        id: p.id,
        tier: p.tier,
        tierName: getTier(p.tier)?.name || p.tier,
        months: p.months,
        amountInr: p.amount_inr,
        provider: p.provider,
        orderId: p.razorpay_order_id,
        paymentId: p.razorpay_payment_id,
        capturedAt: p.captured_at,
        period: p.period || "monthly",
        seasonYear: p.season_year || null,
      })),
    });
  } catch (e) { next(e); }
});

// ── POST /api/billing/create-order - start a purchase ─────────────────────────
router.post("/create-order", authenticate, async (req, res, next) => {
  try {
    const tierKey = String(req.body?.tier || "");
    const period = req.body?.period === "cat" ? "cat" : "monthly";
    if (!isValidPaidTier(tierKey)) {
      return res.status(400).json({ error: "Unknown or non-purchasable plan" });
    }
    const tier = getTier(tierKey);
    const q = quoteFor(tierKey, period, new Date(), req.body?.seasonYear);
    const amountInr = q.amountInr;
    // months is stored as an integer audit value; the period + season_year drive
    // the actual grant, so a fractional "Till CAT" duration is fine to round here.
    const storedMonths = Math.max(1, Math.round(q.months));

    if (!IS_LIVE) {
      // Dev mode - no real order; the client shows a "simulate payment" path.
      const devOrderId = `dev_order_${Date.now()}`;
      await db.run(
        `INSERT INTO payments (user_id, tier, months, amount_inr, provider, razorpay_order_id, status, period, season_year)
         VALUES ($1, $2, $3, $4, 'dev', $5, 'created', $6, $7)`,
        [req.userId, tierKey, storedMonths, amountInr, devOrderId, period, q.seasonYear]
      );
      return res.json({ devMode: true, orderId: devOrderId, amountInr, tier: tierKey, months: storedMonths, period, periodLabel: q.periodLabel, tierName: tier.name });
    }

    const order = await razorpay().orders.create({
      amount: amountInr * 100, // paise
      currency: "INR",
      receipt: `u${req.userId}_${tierKey}_${Date.now()}`,
      notes: { userId: String(req.userId), tier: tierKey, period, months: String(storedMonths) },
    });
    await db.run(
      `INSERT INTO payments (user_id, tier, months, amount_inr, provider, razorpay_order_id, status, period, season_year)
       VALUES ($1, $2, $3, $4, 'razorpay', $5, 'created', $6, $7)`,
      [req.userId, tierKey, storedMonths, amountInr, order.id, period, q.seasonYear]
    );
    res.json({
      devMode: false,
      keyId: KEY_ID,
      orderId: order.id,
      amount: order.amount,      // paise, for Checkout
      amountInr,
      currency: "INR",
      tier: tierKey,
      tierName: tier.name,
      months: storedMonths,
      period,
      periodLabel: q.periodLabel,
    });
  } catch (e) { next(e); }
});

// ── POST /api/billing/verify - client confirms a completed Checkout ───────────
// Razorpay's Checkout success handler returns order_id + payment_id + signature.
// Verifying that signature (HMAC with the API secret) lets us grant the tier
// instantly for good UX, without waiting on the webhook. The webhook is still
// the reliable backstop (e.g. if the user closes the tab before this fires).
// Both paths are idempotent, so a double-grant can't happen.
router.post("/verify", authenticate, async (req, res, next) => {
  try {
    if (!IS_LIVE) return res.status(400).json({ error: "Not in live mode" });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }
    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    const ok =
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!ok) return res.status(400).json({ error: "Invalid payment signature" });

    // The order must be this user's (defense-in-depth beyond the signature).
    const payment = await db.get(
      "SELECT * FROM payments WHERE razorpay_order_id = $1 AND user_id = $2",
      [razorpay_order_id, req.userId]
    );
    if (!payment) return res.status(404).json({ error: "Order not found" });
    if (payment.status !== "captured") {
      await db.run(
        "UPDATE payments SET status = 'captured', razorpay_payment_id = $1, captured_at = NOW() WHERE id = $2",
        [razorpay_payment_id, payment.id]
      );
      await grantForPayment(payment);
    }
    const user = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true, tier: user.tier, expiresAt: user.tier_expires_at });
  } catch (e) { next(e); }
});

// ── POST /api/billing/webhook - Razorpay → us (signature-verified) ────────────
// No auth: authenticity comes from the HMAC signature over the raw body.
router.post("/webhook", async (req, res) => {
  try {
    if (!WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook not configured" });
    const signature = req.headers["x-razorpay-signature"];
    const raw = req.rawBody; // Buffer, captured by express.json({ verify }) in index.js
    if (!raw || !signature) return res.status(400).json({ error: "Missing signature" });

    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
    // Constant-time compare; lengths must match or timingSafeEqual throws.
    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) return res.status(400).json({ error: "Invalid signature" });

    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity || {};
    const orderId = entity.order_id || entity.id;
    const paymentId = entity.id;

    if (event === "payment.captured" || event === "order.paid") {
      const payment = await db.get(
        "SELECT * FROM payments WHERE razorpay_order_id = $1",
        [orderId]
      );
      if (payment && payment.status !== "captured") {
        await db.run(
          "UPDATE payments SET status = 'captured', razorpay_payment_id = $1, captured_at = NOW() WHERE id = $2",
          [paymentId || null, payment.id]
        );
        await grantForPayment(payment);
        console.log(`[billing] tier '${payment.tier}' granted to user ${payment.user_id} (${payment.period === "cat" ? payment.period + " " + payment.season_year : payment.months + "mo"})`);
      }
    }

    // ── Recurring subscription events ──
    if (event && event.startsWith("subscription.")) {
      const subEntity = req.body?.payload?.subscription?.entity || {};
      const subId = subEntity.id;
      const sub = subId ? await subs.getSubscriptionByRzpId(subId) : null;
      if (sub) {
        if (event === "subscription.charged") {
          // The charge payment id lives in the payment payload of this event.
          const chargePaymentId = req.body?.payload?.payment?.entity?.id || null;
          await subs.applyCharge(sub, chargePaymentId);
          console.log(`[billing] subscription ${subId} charged → +1mo ${sub.tier} for user ${sub.user_id}`);
        } else if (event === "subscription.cancelled" || event === "subscription.completed") {
          await subs.setStatus(subId, "cancelled");
          console.log(`[billing] subscription ${subId} ${event.split(".")[1]} for user ${sub.user_id}`);
        } else if (event === "subscription.halted") {
          await subs.setStatus(subId, "halted"); // payments failing - keep access until expiry
        } else if (event === "subscription.activated") {
          await subs.setStatus(subId, "active");
        }
      }
    }
    // Always 200 on a verified event so Razorpay doesn't retry.
    res.json({ received: true });
  } catch (e) {
    console.error("[billing] webhook error:", e.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── POST /api/billing/dev-activate - grant a tier without paying (dev only) ───
// Disabled in production. Lets you exercise tier gating + the pricing UI before
// Razorpay KYC is live.
router.post("/dev-activate", authenticate, async (req, res, next) => {
  try {
    if (IS_PROD) return res.status(403).json({ error: "Not available in production" });
    const tierKey = String(req.body?.tier || "");
    const period = req.body?.period === "cat" ? "cat" : "monthly";
    if (tierKey === "free") {
      await db.run("UPDATE users SET tier = 'free', tier_expires_at = NULL WHERE id = $1", [req.userId]);
    } else if (isValidPaidTier(tierKey)) {
      if (period === "cat") {
        // Honour the requested season so dev testing can exercise both offers,
        // not just the nearest one.
        await grantTierUntil(req.userId, tierKey, catDate(resolveSeason(req.body?.seasonYear).year));
      } else {
        await grantTier(req.userId, tierKey, 1);
      }
    } else {
      return res.status(400).json({ error: "Unknown plan" });
    }
    const user = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true, tier: user.tier, expiresAt: user.tier_expires_at });
  } catch (e) { next(e); }
});

// ── POST /api/billing/create-subscription - start a monthly autopay plan ──────
// Monthly = recurring. Returns a Razorpay subscription_id for Checkout to open a
// mandate against (or a devMode flag when no keys are configured).
router.post("/create-subscription", authenticate, async (req, res, next) => {
  try {
    const tierKey = String(req.body?.tier || "");
    if (!isValidPaidTier(tierKey)) {
      return res.status(400).json({ error: "Unknown or non-purchasable plan" });
    }
    // One live subscription at a time - keeps the mandate model simple. Switching
    // tiers means cancelling the current plan first (surfaced in the UI).
    // A cancel-at-cycle-end subscription stays status='active' (so the user keeps
    // access until the period ends), but it will NOT renew - so it must not block
    // starting a new one, otherwise a user who has already cancelled is stuck
    // unable to buy anything.
    const existing = await subs.getActiveSubscription(req.userId);
    if (existing && !existing.cancel_at_cycle_end) {
      return res.status(409).json({
        error: "You already have an active subscription. Cancel it from My Plan before starting a new one.",
        code: "SUBSCRIPTION_EXISTS",
      });
    }

    if (!IS_LIVE) {
      // Dev mode - simulate an active subscription + one month of access.
      await grantTier(req.userId, tierKey, 1);
      const devSubId = `dev_sub_${Date.now()}`;
      await db.run(
        `INSERT INTO subscriptions (user_id, tier, razorpay_subscription_id, status, current_end)
         VALUES ($1, $2, $3, 'active', (SELECT tier_expires_at FROM users WHERE id = $1))`,
        [req.userId, tierKey, devSubId]
      );
      return res.json({ devMode: true, subscriptionId: devSubId, tier: tierKey });
    }

    const sub = await subs.createSubscription(req.userId, tierKey);
    res.json({
      devMode: false,
      keyId: KEY_ID,
      subscriptionId: sub.id,
      tier: tierKey,
      tierName: getTier(tierKey).name,
    });
  } catch (e) { next(e); }
});

// ── POST /api/billing/verify-subscription - client confirms the mandate ───────
// Checkout's subscription success handler returns payment_id + subscription_id +
// signature. Signature = HMAC(payment_id + '|' + subscription_id). We grant the
// first month instantly; subscription.charged webhooks handle every cycle after.
router.post("/verify-subscription", authenticate, async (req, res, next) => {
  try {
    if (!IS_LIVE) return res.status(400).json({ error: "Not in live mode" });
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }
    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");
    const ok =
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!ok) return res.status(400).json({ error: "Invalid payment signature" });

    const sub = await subs.getSubscriptionByRzpId(razorpay_subscription_id);
    if (!sub || sub.user_id !== req.userId) return res.status(404).json({ error: "Subscription not found" });
    await subs.applyCharge(sub, razorpay_payment_id);

    const user = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true, tier: user.tier, expiresAt: user.tier_expires_at });
  } catch (e) { next(e); }
});

// ── POST /api/billing/cancel-subscription - user cancels (at cycle end) ───────
// No refund; access continues until the paid-through date, then stops renewing.
router.post("/cancel-subscription", authenticate, async (req, res, next) => {
  try {
    const sub = await subs.getActiveSubscription(req.userId);
    if (!sub) return res.status(404).json({ error: "No active subscription to cancel." });
    if (!IS_LIVE) {
      await db.run(
        "UPDATE subscriptions SET status = 'cancelled', cancel_at_cycle_end = true, cancelled_at = NOW() WHERE id = $1",
        [sub.id]
      );
    } else {
      await subs.cancelSubscription(sub, { immediate: false });
    }
    const user = await db.get("SELECT tier_expires_at FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true, accessUntil: user?.tier_expires_at || sub.current_end || null });
  } catch (e) { next(e); }
});

module.exports = router;
