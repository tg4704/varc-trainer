// CAT exam-season helper for "Till CAT" plans.
//
// A "Till CAT" plan is a one-time purchase that expires on a fixed season end
// date rather than N months after purchase. Price is auto-computed from the
// time remaining, so it shrinks as the season runs down, and each season
// carries its own upfront discount (the reward for committing early/long).
//
// Two seasons are sold side by side (product decision 2026-07-21):
//
//   CAT 2026 - ends 1 Dec 2026 · 10% off · price revises every 15 days
//   CAT 2027 - ends 1 Dec 2027 · 20% off · price revises every 30 days
//
// The end date is a fixed 1 December (not the exam Sunday) so the plan is
// unambiguous to state on the pricing page and stays valid through exam day.
// Pinned to end-of-day IST.
//
// All money math lives here and is server-authoritative: the pricing page, the
// pre-checkout review screen, and the actual charge all read the same numbers,
// so display and charge can't drift.
const SEASONS = {
  2026: { endsOn: "2026-12-01", discountPct: 10, granularityDays: 15 },
  2027: { endsOn: "2027-12-01", discountPct: 20, granularityDays: 30 },
  2028: { endsOn: "2028-12-01", discountPct: 20, granularityDays: 30 },
};

const DAY_MS = 86400000;

// A season stops being sellable once it's this close to ending - buying a
// "season pass" with three weeks left is bad value and invites refund requests.
const MIN_SELLABLE_DAYS = 30;

function catDate(year) {
  const s = SEASONS[year];
  if (!s) return null;
  return new Date(`${s.endsOn}T23:59:59+05:30`);
}

// Billable months remaining, rounded to the season's revision granularity.
// 15-day granularity bills in half-months (4.5, 5.0, …); 30-day in whole ones.
function billableMonths(daysRemaining, granularityDays) {
  if (granularityDays === 15) {
    const halfUnits = Math.max(1, Math.round(daysRemaining / 15));
    return halfUnits / 2;
  }
  return Math.max(1, Math.round(daysRemaining / granularityDays));
}

// Full descriptor for one season at a point in time. Returns null for an
// unknown year. `sellable` is false once inside MIN_SELLABLE_DAYS.
function seasonFor(year, now = new Date()) {
  const cfg = SEASONS[year];
  if (!cfg) return null;
  const target = catDate(year);
  const daysRemaining = Math.ceil((target - now) / DAY_MS);
  const months = billableMonths(Math.max(1, daysRemaining), cfg.granularityDays);
  return {
    year,
    target,
    targetIso: target.toISOString(),
    daysRemaining,
    months,
    discountPct: cfg.discountPct,
    granularityDays: cfg.granularityDays,
    sellable: daysRemaining >= MIN_SELLABLE_DAYS,
    label: `Till CAT ${year}`,
  };
}

// How many seasons are offered at once. Two (this year + next) is the product
// decision; 2028 stays configured so catDate() resolves for it and so the
// offer rolls forward automatically once 2026 stops being sellable.
const MAX_SEASONS_ON_SALE = 2;

// Every season a buyer can pick right now, soonest first.
function availableSeasons(now = new Date()) {
  return Object.keys(SEASONS)
    .map(Number)
    .sort((a, b) => a - b)
    .map((y) => seasonFor(y, now))
    .filter((s) => s && s.sellable)
    .slice(0, MAX_SEASONS_ON_SALE);
}

// The default season (the nearest sellable one). Falls back to the last
// configured year so callers always get something rather than null - the same
// rollover behaviour the single-season version had.
function currentSeason(now = new Date()) {
  const avail = availableSeasons(now);
  if (avail.length) return avail[0];
  const years = Object.keys(SEASONS).map(Number).sort((a, b) => a - b);
  return seasonFor(years[years.length - 1], now);
}

// Price a tier for a season. Everything the UI needs to show "₹X/mo" big with
// "₹Y total billed" small underneath, plus the struck-through list price.
//   listTotalInr - what it'd cost at full monthly rate, no discount
//   totalInr     - what's actually charged today
//   perMonthInr  - totalInr spread over the billable months (display only)
function seasonPrice(monthlyInr, season) {
  const months = season.months;
  const listTotalInr = Math.round(monthlyInr * months);
  const totalInr = Math.round(listTotalInr * (1 - season.discountPct / 100));
  const perMonthInr = Math.round(totalInr / months);
  return {
    months,
    listTotalInr,
    totalInr,
    perMonthInr,
    discountPct: season.discountPct,
    savingsInr: listTotalInr - totalInr,
  };
}

module.exports = {
  SEASONS,
  catDate,
  seasonFor,
  availableSeasons,
  currentSeason,
  seasonPrice,
  billableMonths,
};
