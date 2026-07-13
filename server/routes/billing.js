// ── Billing (Razorpay) ────────────────────────────────────────────────────────
// One-time "buy N months of a tier" payments — the right model for an
// unregistered individual Razorpay account (simpler KYC than recurring
// e-mandate; see the pricing report). Recurring subscriptions can be layered
// on later without changing this schema.
//
// Flow: create-order → Razorpay Checkout (client) → payment.captured webhook
// (signature-verified) → grant tier. The webhook — not the client callback — is
// the source of truth for granting access (a client can be tampered with).
//
// DEV MODE: with no RAZORPAY_KEY_ID/SECRET set, real orders aren't created and
// POST /dev-activate lets you grant a tier directly (non-production only), so
// the whole tier system is testable before KYC is done — same spirit as the
// email module's console-log dev mode.
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");
const { getTier, isValidPaidTier, publicTiers } = require("../config/tiers");
const { effectiveTierKey } = require("../lib/entitlements");

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

// Grant (or extend) a paid tier. Stacks months onto any still-active expiry so
// a mid-cycle renewal adds time rather than resetting it.
async function grantTier(userId, tier, months) {
  await db.run(
    `UPDATE users
        SET tier = $1,
            tier_expires_at = GREATEST(NOW(), COALESCE(tier_expires_at, NOW())) + ($2 || ' months')::interval
      WHERE id = $3`,
    [tier, String(months), userId]
  );
}

// ── GET /api/billing/plans — public tier list for the pricing page ────────────
router.get("/plans", (req, res) => {
  res.json({ tiers: publicTiers(), live: IS_LIVE, currency: "INR" });
});

// ── GET /api/billing/me — the caller's current plan ───────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await db.get("SELECT id, tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    const key = effectiveTierKey(user);
    const tier = getTier(key);
    res.json({
      tier: key,
      tierName: tier.name,
      priceInr: tier.priceInr,
      caps: tier.caps,
      expiresAt: user?.tier_expires_at || null,
      isPaid: key !== "free",
    });
  } catch (e) { next(e); }
});

// ── POST /api/billing/create-order — start a purchase ─────────────────────────
router.post("/create-order", authenticate, async (req, res, next) => {
  try {
    const tierKey = String(req.body?.tier || "");
    const months = Math.min(12, Math.max(1, parseInt(req.body?.months, 10) || 1));
    if (!isValidPaidTier(tierKey)) {
      return res.status(400).json({ error: "Unknown or non-purchasable plan" });
    }
    const tier = getTier(tierKey);
    const amountInr = tier.priceInr * months;

    if (!IS_LIVE) {
      // Dev mode — no real order; the client shows a "simulate payment" path.
      const devOrderId = `dev_order_${Date.now()}`;
      await db.run(
        `INSERT INTO payments (user_id, tier, months, amount_inr, provider, razorpay_order_id, status)
         VALUES ($1, $2, $3, $4, 'dev', $5, 'created')`,
        [req.userId, tierKey, months, amountInr, devOrderId]
      );
      return res.json({ devMode: true, orderId: devOrderId, amountInr, tier: tierKey, months, tierName: tier.name });
    }

    const order = await razorpay().orders.create({
      amount: amountInr * 100, // paise
      currency: "INR",
      receipt: `u${req.userId}_${tierKey}_${Date.now()}`,
      notes: { userId: String(req.userId), tier: tierKey, months: String(months) },
    });
    await db.run(
      `INSERT INTO payments (user_id, tier, months, amount_inr, provider, razorpay_order_id, status)
       VALUES ($1, $2, $3, $4, 'razorpay', $5, 'created')`,
      [req.userId, tierKey, months, amountInr, order.id]
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
      months,
    });
  } catch (e) { next(e); }
});

// ── POST /api/billing/webhook — Razorpay → us (signature-verified) ────────────
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
        await grantTier(payment.user_id, payment.tier, payment.months);
        console.log(`[billing] tier '${payment.tier}' granted to user ${payment.user_id} (${payment.months}mo)`);
      }
    }
    // Always 200 on a verified event so Razorpay doesn't retry.
    res.json({ received: true });
  } catch (e) {
    console.error("[billing] webhook error:", e.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── POST /api/billing/dev-activate — grant a tier without paying (dev only) ───
// Disabled in production. Lets you exercise tier gating + the pricing UI before
// Razorpay KYC is live.
router.post("/dev-activate", authenticate, async (req, res, next) => {
  try {
    if (IS_PROD) return res.status(403).json({ error: "Not available in production" });
    const tierKey = String(req.body?.tier || "");
    const months = Math.min(12, Math.max(1, parseInt(req.body?.months, 10) || 1));
    if (tierKey === "free") {
      await db.run("UPDATE users SET tier = 'free', tier_expires_at = NULL WHERE id = $1", [req.userId]);
    } else if (isValidPaidTier(tierKey)) {
      await grantTier(req.userId, tierKey, months);
    } else {
      return res.status(400).json({ error: "Unknown plan" });
    }
    const user = await db.get("SELECT tier, tier_expires_at FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true, tier: user.tier, expiresAt: user.tier_expires_at });
  } catch (e) { next(e); }
});

module.exports = router;
