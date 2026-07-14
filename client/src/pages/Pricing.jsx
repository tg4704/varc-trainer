// Pricing page — data-driven from the server tier config (server/config/tiers.js
// via /api/billing/plans) so prices/caps/features never drift from enforcement.
// Purchases are one-time "N months" (monthly or annual) via Razorpay Checkout;
// in dev mode (no Razorpay keys) the buttons simulate activation so the whole
// flow is testable before KYC.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { billing } from "../api.js";
import Icon from "../components/Icon.jsx";
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

// Static fallback so the page renders instantly / when logged out, before the
// (public) /plans call returns. Kept in sync with the server config's shape.
const FALLBACK = [
  { key: "free", name: "Skimmer", tagline: "Get a feel for trap-recognition.", priceInr: 0, features: ["Unlimited question practice", "15 AI reasonings/day", "2 Coach passages/day", "Accuracy & trap dashboard"] },
  { key: "inference", name: "Inference", tagline: "Build the single most-tested RC skill.", priceInr: 100, features: ["Everything in Skimmer", "30 AI reasonings/day", "5 Coach passages/day", "Trap-type weakness analytics"] },
  { key: "ninetyninth", name: "99th Percentile", tagline: "Full AI coaching, every surface.", priceInr: 300, features: ["Everything in Inference", "50 AI reasonings/day", "10 Coach passages/day", "Socratic debrief on every question"] },
  { key: "topper", name: "Topper", tagline: "For aspirants who want every edge.", priceInr: 700, features: ["Everything in 99th Percentile", "100 AI reasonings/day", "20 Coach passages/day", "Priority AI response times"] },
];

const POPULAR = "ninetyninth";

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tiers, setTiers] = useState(FALLBACK);
  const [current, setCurrent] = useState(null); // { tier, ... } for logged-in
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState(null);       // tier key mid-purchase
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    billing.plans().then((d) => { if (d?.tiers?.length) setTiers(d.tiers); }).catch(() => {});
    if (user) billing.me().then(setCurrent).catch(() => {});
  }, [user]);

  const months = annual ? 12 : 1;
  const priceFor = (t) => (annual ? t.priceInr * 10 : t.priceInr); // annual = 10× (2 mo free)

  async function subscribe(tierKey) {
    setError(null); setNotice(null);
    if (!user) { navigate("/register", { state: { from: "/pricing" } }); return; }
    setBusy(tierKey);
    try {
      const order = await billing.createOrder(tierKey, months);

      if (order.devMode) {
        // No Razorpay keys — simulate a successful payment (dev only).
        await billing.devActivate(tierKey, months);
        const me = await billing.me();
        setCurrent(me);
        setNotice(`Activated ${me.tierName} (dev mode — no real charge).`);
        setBusy(null);
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load the payment window. Check your connection and retry.");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Graspr",
        description: `${order.tierName} · ${months} month${months > 1 ? "s" : ""}`,
        prefill: { email: user.email, name: user.name || user.username },
        theme: { color: "#5DCAA5" },
        handler: async (resp) => {
          try {
            const me = await billing.verify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setCurrent(await billing.me());
            setNotice(`You're on ${order.tierName}. Thank you!`);
          } catch (e) {
            setError("Payment received — activation is taking a moment. Refresh in a bit if your plan isn't updated.");
          } finally {
            setBusy(null);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (e) {
      setError(e.message || "Couldn't start checkout.");
      setBusy(null);
    }
  }

  const currentKey = current?.tier || (user ? "free" : null);

  function ctaFor(t) {
    if (t.key === "free") {
      if (!user) return { label: "Start free", onClick: () => navigate("/register") };
      return { label: currentKey === "free" ? "Your plan" : "Included", disabled: true };
    }
    if (currentKey === t.key) return { label: "Current plan", disabled: true };
    const label = user ? (currentKey === "free" ? "Subscribe" : "Switch to this") : "Start free";
    return { label, onClick: () => subscribe(t.key) };
  }

  return (
    <div className="mx-auto max-w-[1080px] px-7 py-16">
      <PageMeta
        title="Pricing — Graspr"
        description="Simple, predictable pricing for CAT VARC practice. Start free, upgrade when Drills alone isn't enough."
      />
      <div className="text-center">
        <h1 className="display text-[42px] leading-[1.05] sm:text-[52px]">
          Simple, <span className="italic" style={{ color: "var(--teal)" }}>predictable</span> pricing.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed muted">
          Start free. Upgrade when Drills alone isn't enough. One-time plans — nothing auto-renews.
        </p>

        {/* Monthly / annual toggle */}
        <div className="mt-7 inline-flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-lo)" }}>
          <button
            type="button" onClick={() => setAnnual(false)}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={!annual ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
          >Monthly</button>
          <button
            type="button" onClick={() => setAnnual(true)}
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={annual ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
          >
            Annual
            <span className="mono rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide" style={{ background: annual ? "rgba(7,19,14,0.18)" : "rgba(93,202,165,0.16)", color: annual ? "#07130E" : "var(--teal)" }}>2 mo free</span>
          </button>
        </div>
      </div>

      {notice && (
        <p className="mx-auto mt-8 max-w-md rounded-lg px-4 py-2.5 text-center text-sm" style={{ background: "rgba(74,222,128,0.1)", color: "var(--green)" }}>{notice}</p>
      )}
      {error && (
        <p className="mx-auto mt-8 max-w-md rounded-lg px-4 py-2.5 text-center text-sm text-destructive" style={{ background: "rgba(248,113,113,0.1)" }}>{error}</p>
      )}

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => {
          const popular = t.key === POPULAR;
          const cta = ctaFor(t);
          const price = priceFor(t);
          return (
            <div
              key={t.key}
              className={`glass flex flex-col gap-5 p-6 ${popular ? "glasscard" : ""}`}
              style={popular ? { border: "1px solid rgba(93,202,165,0.5)", boxShadow: "0 0 0 1px rgba(93,202,165,0.15), 0 20px 50px rgba(93,202,165,0.08)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                {popular && (
                  <span className="mono rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(93,202,165,0.16)", color: "var(--teal)" }}>
                    Most popular
                  </span>
                )}
                {currentKey === t.key && (
                  <span className="mono rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}>
                    Current
                  </span>
                )}
              </div>
              <div>
                <h3 className="display text-[22px]">{t.name}</h3>
                <p className="mt-1 text-[13px] leading-snug muted">{t.tagline}</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="mono text-[32px] font-bold text-foreground">₹{price}</span>
                <span className="text-[13px] dim">{t.priceInr === 0 ? "forever" : annual ? "/year" : "/month"}</span>
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
                disabled={cta.disabled || busy === t.key}
                onClick={cta.onClick}
                className={`btn fx-ring mt-auto w-full ${popular ? "btn-primary fx-sheen" : "btn-glass"} ${cta.disabled ? "opacity-60" : ""}`}
              >
                {busy === t.key ? "Starting…" : cta.label}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-lg text-center text-[13px] dim">
        Prices in ₹, taxes as applicable. See our{" "}
        <Link to="/refunds" className="fx-underline" style={{ color: "var(--text-2)" }}>refund &amp; cancellation policy</Link>.
      </p>
    </div>
  );
}
