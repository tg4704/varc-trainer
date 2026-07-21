// Pricing page - data-driven from the server tier config (server/config/tiers.js
// via /api/billing/plans) so prices/caps/features never drift from enforcement.
// Two billing periods: "Monthly" and "Till CAT <year>" (a one-time plan that
// expires on the exam date, auto-priced from the time left to it).
//
// Clicking a plan opens a review screen (what you get + price + end date +
// auto-renewal note) before handing off to Razorpay Checkout. In dev mode (no
// Razorpay keys) the pay button simulates activation so the flow is testable.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { billing } from "../api.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";
import PageMeta from "../components/PageMeta.jsx";

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let rzpLoader = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (rzpLoader) return rzpLoader;
  rzpLoader = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return rzpLoader;
}

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Static fallback so the page renders instantly / when logged out, before the
// (public) /plans call returns. Kept in sync with the server config's shape.
const FALLBACK = [
  { key: "free", name: "Skimmer", tagline: "Get a feel for trap-recognition.", priceInr: 0, caps: { drills: 10, coach: 1 }, monthlyCaps: { drills: null, coach: null }, features: ["Unlimited Drills practice", "10 AI reasonings/day", "1 Coach passage/day", "Accuracy & trap dashboard"] },
  { key: "inference", name: "Inference", tagline: "Build the single most-tested RC skill.", priceInr: 99, caps: { drills: 25, coach: 4 }, monthlyCaps: { drills: null, coach: null }, features: ["Everything in Skimmer", "25 AI reasonings/day", "4 Coach passages/day"] },
  { key: "ninetyninth", name: "Consistent", tagline: "Full AI coaching, every surface.", priceInr: 299, caps: { drills: null, coach: null }, monthlyCaps: { drills: 1400, coach: 200 }, features: ["Everything in Inference", "No daily limit", "1400 AI reasonings/month", "200 Coach passages/month", "Better & faster AI responses"] },
  { key: "topper", name: "Topper", tagline: "For aspirants who want every edge.", priceInr: 699, caps: { drills: null, coach: null }, monthlyCaps: { drills: 3000, coach: 500 }, features: ["Everything in Consistent", "No daily limit", "3000 AI reasonings/month", "500 Coach passages/month", "Best-quality AI responses"] },
];

const POPULAR = "ninetyninth";

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tiers, setTiers] = useState(FALLBACK);
  // Whether the server can actually take money (Razorpay keys configured). In
  // dev this is false but simulation is allowed, so checkout still works; in
  // production false means "not set up yet" and the CTA must not pretend.
  const [canPay, setCanPay] = useState(true);
  const [seasons, setSeasons] = useState([]); // [{ year, label, months, discountPct, prices }]
  const [current, setCurrent] = useState(null); // { tier, ... } for logged-in
  // "monthly" | "cat:<year>" - the season is part of the selection now that
  // more than one CAT season is on sale at once.
  const [period, setPeriod] = useState("monthly");
  const [review, setReview] = useState(null); // { tierKey, loading, quote, error, busy }
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    billing.plans().then((d) => {
      if (d?.tiers?.length) setTiers(d.tiers);
      if (d?.seasons?.length) setSeasons(d.seasons);
      else if (d?.season) setSeasons([d.season]);
      // devMode (no keys, non-prod) still simulates a purchase, so only treat
      // "can't pay" as true when the server is live-capable OR we're in a dev
      // build. `import.meta.env.PROD` distinguishes the two.
      if (typeof d?.live === "boolean") setCanPay(d.live || !import.meta.env.PROD);
    }).catch(() => {});
    if (user) billing.me().then(setCurrent).catch(() => {});
  }, [user]);

  const isCat = period.startsWith("cat");
  const seasonYear = isCat ? Number(period.split(":")[1]) : null;
  const season = seasons.find((s) => s.year === seasonYear) || null;
  const catLabel = season?.label || `Till CAT ${seasonYear || ""}`.trim();

  // Price display for a tier card. Every figure comes from the server's
  // per-season `prices` map - the page never multiplies price × months itself,
  // so what's shown and what's charged can't drift once discounts exist.
  //   perMonth  - the big number
  //   total     - the "₹X billed once" line under it
  function priceView(t) {
    if (!isCat || t.priceInr === 0) {
      return { perMonth: t.priceInr, total: null, listTotal: null, savings: 0, discountPct: 0 };
    }
    const p = season?.prices?.[t.key];
    if (!p) return { perMonth: t.priceInr, total: null, listTotal: null, savings: 0, discountPct: 0 };
    return {
      perMonth: p.perMonthInr,
      total: p.totalInr,
      listTotal: p.listTotalInr,
      savings: p.savingsInr,
      discountPct: p.discountPct,
      months: p.months,
    };
  }

  // Open the review screen for a plan (fetches an authoritative quote).
  function openReview(tierKey) {
    setError(null); setNotice(null);
    if (!user) { navigate("/register", { state: { from: "/pricing" } }); return; }
    setReview({ tierKey, loading: true, quote: null, error: null, busy: false });
    billing.quote(tierKey, isCat ? "cat" : "monthly", seasonYear)
      .then((q) => setReview((r) => (r && r.tierKey === tierKey ? { ...r, loading: false, quote: q } : r)))
      .catch((e) => setReview((r) => (r && r.tierKey === tierKey ? { ...r, loading: false, error: e.message || "Couldn't load plan details." } : r)));
  }

  // Confirm → hand off to Razorpay. Monthly = recurring subscription (autopay);
  // "Till CAT" = one-time order. Dev mode simulates activation for both.
  async function confirmPurchase() {
    if (!review?.quote) return;
    const tierKey = review.tierKey;
    const isSub = !isCat; // monthly is autopay
    setReview((r) => ({ ...r, busy: true, error: null }));
    try {
      const start = isSub
        ? await billing.createSubscription(tierKey)
        : await billing.createOrder(tierKey, "cat", seasonYear);

      if (start.devMode) {
        if (!isSub) await billing.devActivate(tierKey, "cat", seasonYear);
        const me = await billing.me();
        setCurrent(me);
        setReview(null);
        setNotice(`Activated ${me.tierName} (dev mode - no real charge).`);
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load the payment window. Check your connection and retry.");

      const tierName = start.tierName || review.quote.tierName;
      const options = {
        key: start.keyId,
        name: "Graspr",
        prefill: { email: user.email, name: user.name || user.username },
        theme: { color: "#5DCAA5" },
        modal: { ondismiss: () => setReview((r) => (r ? { ...r, busy: false } : r)) },
      };

      if (isSub) {
        options.subscription_id = start.subscriptionId;
        options.description = `${tierName} · monthly (auto-renews)`;
        options.handler = async (resp) => {
          try {
            await billing.verifySubscription({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_subscription_id: resp.razorpay_subscription_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setCurrent(await billing.me());
            setReview(null);
            setNotice(`You're on ${tierName} - auto-renews monthly. Manage it anytime from My Plan.`);
          } catch (e) {
            setReview(null);
            setError("Payment received - activation is taking a moment. Refresh in a bit if your plan isn't updated.");
          }
        };
      } else {
        options.order_id = start.orderId;
        options.amount = start.amount;
        options.currency = start.currency;
        options.description = `${tierName} · ${start.periodLabel || "Till CAT"}`;
        options.handler = async (resp) => {
          try {
            await billing.verify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setCurrent(await billing.me());
            setReview(null);
            setNotice(`You're on ${tierName}. Thank you!`);
          } catch (e) {
            setReview(null);
            setError("Payment received - activation is taking a moment. Refresh in a bit if your plan isn't updated.");
          }
        };
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      // Friendlier message for the "already subscribed" guard.
      const msg = e.code === "SUBSCRIPTION_EXISTS" || /active subscription/i.test(e.message || "")
        ? "You already have an active subscription. Cancel it from My Plan before switching."
        : e.message || "Couldn't start checkout.";
      setReview((r) => (r ? { ...r, busy: false, error: msg } : r));
    }
  }

  const currentKey = current?.tier || (user ? "free" : null);
  // The user is "on a subscription" only when on a paid tier. When they are, the
  // glow follows their current plan; otherwise it sits on the most-popular plan.
  const onPaidPlan = !!(user && currentKey && currentKey !== "free");
  const highlightKey = onPaidPlan ? currentKey : POPULAR;

  function ctaFor(t) {
    if (t.key === "free") {
      if (!user) return { label: "Start free", onClick: () => navigate("/register") };
      return { label: currentKey === "free" ? "Your plan" : "Included", disabled: true };
    }
    if (currentKey === t.key) {
      // A cancelled-but-still-active plan (won't renew) can be re-subscribed to,
      // so the user isn't stuck watching it lapse. A live, still-renewing plan
      // stays a disabled "Current plan".
      if (current?.subscription?.cancelAtCycleEnd) {
        return { label: "Resubscribe", onClick: () => openReview(t.key) };
      }
      return { label: "Current plan", disabled: true };
    }
    // Payments not configured on the server (no Razorpay keys). Show the plan
    // and its price, but don't offer a checkout that can't complete - the
    // server now returns 503 rather than simulating a grant.
    if (!canPay) return { label: "Coming soon", disabled: true };
    const label = user ? (currentKey === "free" ? "Choose plan" : "Switch to this") : "Start free";
    return { label, onClick: () => openReview(t.key) };
  }

  return (
    <div className="mx-auto max-w-[1080px] px-7 py-16">
      <PageMeta
        title="Pricing - Graspr"
        description="Simple, predictable pricing for CAT VARC practice. Start free, upgrade when Drills alone isn't enough."
      />
      <div className="text-center">
        <h1 className="display text-[42px] leading-[1.05] sm:text-[52px]">
          Simple, <span className="italic" style={{ color: "var(--teal)" }}>predictable</span> pricing.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed muted">
          Start free. Upgrade when Drills alone isn't enough. Monthly auto-renews - cancel anytime; <span className="whitespace-nowrap">Till CAT</span> is a one-time pass.
        </p>

        {/* Monthly / Till CAT <year> toggle - one segment per season on sale */}
        <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-lo)" }}>
          <button
            type="button" onClick={() => setPeriod("monthly")}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={period === "monthly" ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
          >Monthly</button>
          {seasons.map((s) => {
            const key = `cat:${s.year}`;
            const on = period === key;
            return (
              <button
                key={s.year}
                type="button" onClick={() => setPeriod(key)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
                style={on ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
              >
                {s.label}
                {s.discountPct > 0 && (
                  <span className="mono rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide" style={{ background: on ? "rgba(7,19,14,0.18)" : "rgba(93,202,165,0.16)", color: on ? "#07130E" : "var(--teal)" }}>
                    {s.discountPct}% off
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {isCat && (
          <p className="mx-auto mt-3 max-w-md text-[12.5px] dim">
            One payment now, full access until {season ? fmtDate(season.endsAt) : "the exam"}
            {season?.discountPct ? ` — ${season.discountPct}% off the monthly rate` : ""}. Price scales to the time remaining, so the closer to CAT, the less you pay.
          </p>
        )}
      </div>

      {notice && (
        <p className="mx-auto mt-8 max-w-md rounded-lg px-4 py-2.5 text-center text-sm" style={{ background: "rgba(74,222,128,0.1)", color: "var(--green)" }}>{notice}</p>
      )}
      {error && (
        <p className="mx-auto mt-8 max-w-md rounded-lg px-4 py-2.5 text-center text-sm text-destructive" style={{ background: "rgba(248,113,113,0.1)" }}>{error}</p>
      )}

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => {
          const isPopular = t.key === POPULAR;
          const isCurrent = currentKey === t.key;
          const isHighlight = t.key === highlightKey;
          const cta = ctaFor(t);
          const pv = priceView(t);
          const paid = t.priceInr !== 0;
          // Current plan takes the badge; otherwise the popular plan gets the tag.
          const badge = isCurrent ? "Current" : isPopular ? "Most popular" : null;
          return (
            <div
              key={t.key}
              className={`glass relative flex flex-col gap-5 p-6 ${isHighlight ? "glasscard" : ""}`}
              style={isHighlight ? { border: "1px solid rgba(93,202,165,0.5)", boxShadow: "0 0 0 1px rgba(93,202,165,0.15), 0 20px 50px rgba(93,202,165,0.08)" } : undefined}
            >
              {badge && (
                <span
                  className="mono absolute rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{
                    top: 0,
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    whiteSpace: "nowrap",
                    background: isHighlight ? "var(--teal)" : "var(--surface-2)",
                    color: isHighlight ? "#07130E" : "var(--text-2)",
                    border: isHighlight ? "none" : "1px solid var(--glass-border-lo)",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                  }}
                >
                  {badge}
                </span>
              )}
              <div>
                <h3 className="display text-[22px]">{t.name}</h3>
                <p className="mt-1 min-h-[36px] text-[13px] leading-snug muted">{t.tagline}</p>
              </div>
              {/* Per-month price is the headline; the one-time total sits small
                  underneath, the way most season/annual plans present it. */}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="mono text-[32px] font-bold text-foreground">₹{pv.perMonth}</span>
                  <span className="text-[13px] dim">{!paid ? "forever" : "/month"}</span>
                  {paid && pv.discountPct > 0 && (
                    <span className="mono ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "rgba(93,202,165,0.16)", color: "var(--teal)" }}>
                      {pv.discountPct}% off
                    </span>
                  )}
                </div>
                <div className="mt-1 min-h-[18px] text-[12px] dim">
                  {paid && pv.total != null ? (
                    <>
                      ₹{pv.total} billed once · {catLabel}
                      {pv.listTotal > pv.total && (
                        <span className="ml-1.5" style={{ textDecoration: "line-through", opacity: 0.6 }}>₹{pv.listTotal}</span>
                      )}
                    </>
                  ) : paid ? (
                    "billed monthly · cancel anytime"
                  ) : null}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2.5">
                {(t.features || []).map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-none" style={{ color: "var(--teal)" }}>
                      <Icon name="check" size={15} stroke={2.4} />
                    </span>
                    <span className="text-[13.5px] leading-snug muted">{f}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={cta.disabled}
                onClick={cta.onClick}
                className={`btn fx-ring mt-auto w-full ${isHighlight && !cta.disabled ? "btn-primary fx-sheen" : "btn-glass"} ${cta.disabled ? "opacity-60" : ""}`}
              >
                {cta.label}
              </button>
            </div>
          );
        })}
      </div>

      <ComparisonTable tiers={tiers} highlightKey={highlightKey} />

      <p className="mx-auto mt-10 max-w-lg text-center text-[13px] dim">
        Prices in ₹, taxes as applicable. See our{" "}
        <Link to="/refunds" className="fx-underline" style={{ color: "var(--text-2)" }}>refund &amp; cancellation policy</Link>.
      </p>

      {review && (
        <ReviewModal
          state={review}
          catLabel={catLabel}
          onClose={() => setReview((r) => (r?.busy ? r : null))}
          onConfirm={confirmPurchase}
        />
      )}
    </div>
  );
}

// Pre-checkout review: exactly what the user is buying, for how long, and the
// resulting end date - before Razorpay ever opens.
function ReviewModal({ state, catLabel, onClose, onConfirm }) {
  const { loading, quote, error, busy } = state;
  return (
    <Modal onClose={onClose} closeOnBackdrop={!busy} labelledBy="review-title" align="top">
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-floating animate-slide-up flex w-full flex-col p-7 sm:p-8"
        style={{ maxWidth: "min(480px, 95vw)" }}
      >
        {loading && (
          <div className="m-auto py-10 text-center text-sm dim">Loading plan details…</div>
        )}

        {!loading && error && (
          <div className="m-auto py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={onClose} className="btn btn-glass mt-5">Close</button>
          </div>
        )}

        {!loading && quote && (
          <div className="w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mono text-[10px] uppercase tracking-[0.14em] dim">You're unlocking</p>
                <h2 id="review-title" className="display mt-1 text-[26px] leading-tight">{quote.tierName}</h2>
                <p className="mt-1 text-[13px] muted">{quote.tagline}</p>
              </div>
              <span className="mono flex-none rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(93,202,165,0.16)", color: "var(--teal)" }}>
                {quote.period === "cat" ? catLabel : "Monthly"}
              </span>
            </div>

            {/* What you get */}
            <div className="mt-5 flex flex-col gap-2">
              {(quote.features || []).map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-none" style={{ color: "var(--teal)" }}>
                    <Icon name="check" size={14} stroke={2.4} />
                  </span>
                  <span className="text-[13px] leading-snug muted">{f}</span>
                </div>
              ))}
            </div>

            {/* Terms */}
            <div className="mt-6 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}>
              <Row label="Price" value={quote.autoRenew ? `₹${quote.amountInr}/mo` : `₹${quote.amountInr}`} strong />
              {quote.period === "cat" && (
                <>
                  <Row label="Duration" value={`${quote.months} month${quote.months === 1 ? "" : "s"} (till exam)`} />
                  <Row label="Works out to" value={`₹${quote.perMonthInr}/month`} />
                  {quote.discountPct > 0 && (
                    <Row label={`${quote.discountPct}% season discount`} value={`− ₹${quote.savingsInr}`} />
                  )}
                </>
              )}
              <Row
                label={quote.autoRenew ? "First charge covers until" : quote.isExtension ? "Extends until" : "Access until"}
                value={fmtDate(quote.endsAt)}
              />
              <Row
                label="Renewal"
                value={quote.autoRenew ? "Auto-renews monthly · cancel anytime" : "One-time - won't auto-renew"}
              />
            </div>

            {quote.isExtension && (
              <p className="mt-3 text-[12px] dim">
                You have time left on your current plan - this adds onto it, so nothing is lost.
              </p>
            )}

            {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="btn btn-primary fx-sheen fx-ring mt-6 w-full"
            >
              {busy
                ? "Starting…"
                : quote.autoRenew
                  ? `Subscribe · ₹${quote.amountInr}/mo →`
                  : `Pay ₹${quote.amountInr} & unlock ${quote.tierName} →`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-2 w-full text-center text-[12.5px] dim hover:text-foreground disabled:opacity-50"
            >
              Maybe later
            </button>
            <p className="mt-4 text-center text-[11px] dim">Secured by Razorpay · UPI, cards &amp; more</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Full plan comparison table ────────────────────────────────────────────────
const QUALITY = {
  free: "Standard",
  inference: "Better",
  ninetyninth: "Better & faster",
  topper: "Best quality",
};

function capText(v) {
  return v == null ? "No daily limit" : String(v);
}
function monthText(v) {
  return v == null ? "-" : Number(v).toLocaleString("en-IN");
}
function Cell({ children, muted }) {
  return (
    <div className="flex items-center justify-center px-4 py-3 text-center text-[13.5px]" style={{ color: muted ? "var(--text-muted)" : "var(--text)" }}>
      {children}
    </div>
  );
}
function CheckCell({ on }) {
  return (
    <Cell muted={!on}>
      {on ? <span style={{ color: "var(--teal)" }}><Icon name="check" size={15} stroke={2.4} /></span> : "-"}
    </Cell>
  );
}

function ComparisonTable({ tiers, highlightKey }) {
  const rows = [
    { label: "Drills practice (no AI reasoning)", cell: () => <Cell>Unlimited</Cell> },
    { label: "AI reasonings per day", cell: (t) => <Cell muted={t.caps?.drills == null}>{capText(t.caps?.drills)}</Cell> },
    { label: "AI reasonings per month", cell: (t) => <Cell muted={t.monthlyCaps?.drills == null}>{monthText(t.monthlyCaps?.drills)}</Cell> },
    { label: "Coach passages per day", cell: (t) => <Cell muted={t.caps?.coach == null}>{capText(t.caps?.coach)}</Cell> },
    { label: "Coach passages per month", cell: (t) => <Cell muted={t.monthlyCaps?.coach == null}>{monthText(t.monthlyCaps?.coach)}</Cell> },
    { label: "AI response quality & speed", cell: (t) => <Cell>{QUALITY[t.key] || "Standard"}</Cell> },
    { label: "Accuracy & trap dashboard", cell: () => <CheckCell on /> },
    { label: "1-on-1 AI coaching on every question", cell: (t) => <CheckCell on={t.key === "ninetyninth" || t.key === "topper"} /> },
  ];

  return (
    <div className="mt-20">
      <h2 className="display text-center text-[28px] sm:text-[34px]">Compare every plan</h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-[14px] muted">
        Unlimited Drills on every plan. What changes is how much AI reasoning &amp; Coach you get - and how sharp and fast the AI is.
      </p>

      <div className="mt-9 overflow-x-auto rounded-[16px]" style={{ border: "1px solid var(--border-subtle)" }}>
        <table className="w-full border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="px-4 py-4 text-left text-[13px] font-semibold" style={{ color: "var(--text-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                Feature
              </th>
              {tiers.map((t) => (
                <th
                  key={t.key}
                  className="px-4 py-4 text-center"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: t.key === highlightKey ? "rgba(93,202,165,0.06)" : undefined,
                  }}
                >
                  <div className="text-[14px] font-semibold" style={{ color: t.key === highlightKey ? "var(--teal)" : "var(--text)" }}>{t.name}</div>
                  <div className="mono mt-0.5 text-[11px] dim">{t.priceInr === 0 ? "Free" : `₹${t.priceInr}/mo`}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} style={{ background: i % 2 ? "rgba(255,255,255,0.015)" : undefined }}>
                <td className="px-4 py-3 text-left text-[13.5px]" style={{ color: "var(--text-2)" }}>{r.label}</td>
                {tiers.map((t) => (
                  <td
                    key={t.key}
                    className="p-0"
                    style={{ background: t.key === highlightKey ? "rgba(93,202,165,0.04)" : undefined }}
                  >
                    {r.cell(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] dim">{label}</span>
      <span className={strong ? "mono text-[16px] font-bold text-foreground" : "text-[13px] text-foreground"}>{value}</span>
    </div>
  );
}
