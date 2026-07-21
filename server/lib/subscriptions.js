// Razorpay recurring (autopay) helpers - the monthly-subscription counterpart to
// the one-time Orders flow in routes/billing.js.
//
// Model: a Razorpay *Plan* (fixed amount + monthly interval, one per tier/price)
// → a *Subscription* per customer (registers a UPI-Autopay / card mandate at
// Checkout) → `subscription.charged` webhooks each cycle, which extend the
// user's tier by a month. Cancellation is cancel-at-cycle-end by default (the
// user keeps paid access to the period end); admin force-cancel is immediate.
const db = require("../db");
const { getTier } = require("../config/tiers");
const { grantTier } = require("./grants");

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const IS_LIVE = Boolean(KEY_ID && KEY_SECRET);
const MODE = KEY_ID && KEY_ID.startsWith("rzp_live") ? "live" : "test";

// Cycles a mandate authorizes before it must be renewed. 120 months = 10 years,
// effectively "until cancelled" for our purposes.
const TOTAL_COUNT = 120;

// Statuses that mean "this user currently has a live recurring plan".
const ACTIVE_STATES = ["authenticated", "active", "pending", "halted"];

let _rzp = null;
function razorpay() {
  if (!_rzp) {
    const Razorpay = require("razorpay");
    _rzp = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return _rzp;
}

// Reuse a Plan for (tier, mode, price), creating it on Razorpay the first time.
async function ensurePlan(tierKey) {
  const tier = getTier(tierKey);
  const amountInr = tier.priceInr;
  const existing = await db.get(
    "SELECT plan_id FROM razorpay_plans WHERE tier = $1 AND mode = $2 AND amount_inr = $3",
    [tierKey, MODE, amountInr]
  );
  if (existing) return existing.plan_id;

  const plan = await razorpay().plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Graspr ${tier.name} (monthly)`,
      amount: amountInr * 100, // paise
      currency: "INR",
      description: `${tier.name} tier - monthly auto-renewing subscription`,
    },
  });
  await db.run(
    "INSERT INTO razorpay_plans (tier, mode, amount_inr, plan_id) VALUES ($1, $2, $3, $4) ON CONFLICT (tier, mode, amount_inr) DO NOTHING",
    [tierKey, MODE, amountInr, plan.id]
  );
  return plan.id;
}

// The user's current live subscription row, if any.
async function getActiveSubscription(userId) {
  return db.get(
    `SELECT * FROM subscriptions
      WHERE user_id = $1 AND status = ANY($2)
      ORDER BY created_at DESC LIMIT 1`,
    [userId, ACTIVE_STATES]
  );
}

async function getSubscriptionByRzpId(subId) {
  return db.get("SELECT * FROM subscriptions WHERE razorpay_subscription_id = $1", [subId]);
}

// Create a Razorpay subscription (mandate is registered when the user completes
// Checkout with this subscription_id).
async function createSubscription(userId, tierKey) {
  const plan_id = await ensurePlan(tierKey);
  const sub = await razorpay().subscriptions.create({
    plan_id,
    total_count: TOTAL_COUNT,
    customer_notify: 1,
    notes: { userId: String(userId), tier: tierKey },
  });
  await db.run(
    `INSERT INTO subscriptions (user_id, tier, razorpay_subscription_id, status)
     VALUES ($1, $2, $3, $4)`,
    [userId, tierKey, sub.id, sub.status || "created"]
  );
  return sub;
}

// Apply one successful charge: extend the tier by a month (idempotent per
// payment id) and mark the subscription active. Called by verify + webhook.
async function applyCharge(sub, paymentId) {
  if (paymentId && sub.last_charge_id === paymentId) return; // already applied
  await grantTier(sub.user_id, sub.tier, 1);
  const user = await db.get("SELECT tier_expires_at FROM users WHERE id = $1", [sub.user_id]);
  await db.run(
    "UPDATE subscriptions SET status = 'active', last_charge_id = $1, current_end = $2 WHERE id = $3",
    [paymentId || sub.last_charge_id, user?.tier_expires_at || null, sub.id]
  );
}

async function setStatus(subId, status) {
  await db.run("UPDATE subscriptions SET status = $1 WHERE razorpay_subscription_id = $2", [status, subId]);
}

// Cancel on Razorpay + record it. immediate=false → at cycle end (keeps access);
// immediate=true → now (admin force-cancel; caller handles the downgrade).
async function cancelSubscription(sub, { immediate }) {
  try {
    await razorpay().subscriptions.cancel(sub.razorpay_subscription_id, immediate ? false : true);
  } catch (e) {
    // A subscription that never got past 'created' (abandoned checkout) can't be
    // cancelled on Razorpay's side - treat as already gone rather than erroring.
    if (!/not.*cancel|already/i.test(e?.error?.description || e?.message || "")) throw e;
  }
  await db.run(
    `UPDATE subscriptions
        SET status = $1, cancel_at_cycle_end = $2, cancelled_at = NOW()
      WHERE id = $3`,
    [immediate ? "cancelled" : sub.status, !immediate, sub.id]
  );
}

module.exports = {
  IS_LIVE, MODE, razorpay,
  ensurePlan, getActiveSubscription, getSubscriptionByRzpId,
  createSubscription, applyCharge, setStatus, cancelSubscription,
  ACTIVE_STATES,
};
