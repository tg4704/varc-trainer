// Dummy pricing page (no billing wired up) — inspired by a reference layout
// the user attached (big bold headline, checkmarked feature cards), rebuilt
// in Graspr's dark editorial theme. Tier names borrow the app's own RC
// question-type taxonomy (detail/inference/application, see trapTypes.js)
// plus the "99th percentile" framing used across the marketing copy — a
// CAT RC-flavored spin on the usual Free/Basic/Pro/Team ladder.
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";

const TIERS = [
  {
    name: "Skimmer",
    tagline: "Get a feel for trap-recognition.",
    price: "₹0",
    period: "forever",
    cta: "Start free",
    to: "/register",
    features: [
      "10 Drills questions a day",
      "Basic accuracy dashboard",
      "Community question bank",
    ],
  },
  {
    name: "Inference",
    tagline: "Build the single most-tested RC skill.",
    price: "₹299",
    period: "/month",
    cta: "Start free",
    to: "/register",
    features: [
      "Everything in Skimmer",
      "Unlimited Drills, all question types",
      "AI reasoning feedback on every answer",
      "Spaced repetition review queue",
    ],
  },
  {
    name: "99th Percentile",
    tagline: "Full AI coaching, every surface.",
    price: "₹599",
    period: "/month",
    cta: "Start free",
    to: "/register",
    popular: true,
    features: [
      "Everything in Inference",
      "AI Reading Coach with Socratic debrief",
      "Full passage library access",
      "Priority AI response times",
      "Streak + daily goal tracking",
    ],
  },
  {
    name: "Topper",
    tagline: "For aspirants who want every edge.",
    price: "₹999",
    period: "/month",
    cta: "Start free",
    to: "/register",
    features: [
      "Everything in 99th Percentile",
      "Custom question sets by weak area",
      "Early access to Reading Lounge",
      "Downloadable performance reports",
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-[1080px] px-7 py-16">
      <div className="text-center">
        <h1 className="display text-[42px] leading-[1.05] sm:text-[52px]">
          Simple, <span className="italic" style={{ color: "var(--teal)" }}>predictable</span> pricing.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed muted">
          Start free. Upgrade when Drills alone isn't enough. Cancel any time, no questions asked.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`glass flex flex-col gap-5 p-6 ${t.popular ? "glasscard" : ""}`}
            style={t.popular ? { border: "1px solid rgba(93,202,165,0.5)", boxShadow: "0 0 0 1px rgba(93,202,165,0.15), 0 20px 50px rgba(93,202,165,0.08)" } : undefined}
          >
            {t.popular && (
              <span
                className="mono self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ background: "rgba(93,202,165,0.16)", color: "var(--teal)" }}
              >
                Most popular
              </span>
            )}
            <div>
              <h3 className="display text-[22px]">{t.name}</h3>
              <p className="mt-1 text-[13px] leading-snug muted">{t.tagline}</p>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="mono text-[32px] font-bold text-foreground">{t.price}</span>
              <span className="text-[13px] dim">{t.period}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {t.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-none" style={{ color: "var(--teal)" }}>
                    <Icon name="check" size={15} stroke={2.4} />
                  </span>
                  <span className="text-[13.5px] leading-snug muted">{f}</span>
                </div>
              ))}
            </div>
            <Link
              to={user ? "/setup" : t.to}
              className={`btn fx-ring mt-auto w-full ${t.popular ? "btn-primary fx-sheen" : "btn-glass"}`}
            >
              {user ? "Go to Drills" : t.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-lg text-center text-[13px] dim">
        This is a preview pricing page. No card required, no billing is wired up yet.
      </p>
    </div>
  );
}
