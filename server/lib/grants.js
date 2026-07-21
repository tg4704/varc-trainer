// Tier-granting helpers, shared by the billing routes (one-time orders +
// recurring subscriptions) and the admin routes (manual grant / force-cancel).
// Tier access is expressed purely as users.tier + users.tier_expires_at; these
// functions are the only writers of those two columns for paid access.
const db = require("../db");
const { catDate } = require("./season");

// Add N months of a tier, stacking onto any still-active expiry.
async function grantTier(userId, tier, months) {
  await db.run(
    `UPDATE users
        SET tier = $1,
            tier_expires_at = GREATEST(NOW(), COALESCE(tier_expires_at, NOW())) + ($2 || ' months')::interval
      WHERE id = $3`,
    [tier, String(months), userId]
  );
}

// Grant a tier that expires on a fixed date ("Till CAT" plans). Never shortens
// an already-later expiry (so it stacks sensibly with an active monthly plan).
async function grantTierUntil(userId, tier, endDate) {
  await db.run(
    `UPDATE users
        SET tier = $1,
            tier_expires_at = GREATEST(COALESCE(tier_expires_at, NOW()), $2::timestamptz)
      WHERE id = $3`,
    [tier, endDate.toISOString(), userId]
  );
}

// Apply a captured one-time payment to the user's tier, honouring its period.
async function grantForPayment(p) {
  if (p.period === "cat" && p.season_year) {
    await grantTierUntil(p.user_id, p.tier, catDate(p.season_year));
  } else {
    await grantTier(p.user_id, p.tier, p.months);
  }
}

// Immediately revoke paid access - used by admin force-cancel. Drops to free now.
async function downgradeToFree(userId) {
  await db.run("UPDATE users SET tier = 'free', tier_expires_at = NULL WHERE id = $1", [userId]);
}

module.exports = { grantTier, grantTierUntil, grantForPayment, downgradeToFree };
