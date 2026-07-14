import { Link } from "react-router-dom";
import { LegalDoc, Section } from "./LegalDoc.jsx";
import PageMeta from "../components/PageMeta.jsx";

export default function Refunds() {
  return (
    <LegalDoc title="Refund & Cancellation Policy" updated="14 July 2026">
      <PageMeta title="Refund & Cancellation Policy — Graspr" description="How Graspr paid plans, refunds, and cancellations work." />
      <p>
        This policy covers Graspr's paid plans, operated by Tarun Gupta, an individual based in
        Bangalore, Karnataka, India. It sits alongside our{" "}
        <Link to="/terms" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms of Service</Link>.
      </p>

      <Section title="How our plans work">
        <p>
          Graspr paid plans (Inference, 99th Percentile, Topper) are <strong>one-time purchases for a
          fixed number of months</strong> — not auto-renewing subscriptions. You pay once, your plan
          is active for the period you bought, and it simply expires at the end. Nothing is charged
          automatically, so there is no recurring billing to cancel.
        </p>
      </Section>

      <Section title="Cancellation">
        <p>
          Because there's no auto-renewal, you don't need to cancel anything to avoid a future
          charge. If you decide not to continue, just let your plan lapse — your account stays, and
          you drop back to the free Skimmer tier when the paid period ends. You keep all your
          practice history either way.
        </p>
      </Section>

      <Section title="Refunds">
        <p>
          Our plans unlock AI features that cost us money to run per use, so refunds are limited —
          but we aim to be fair:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Within 7 days, if barely used:</strong> if you bought a plan within the last 7
            days and have used only a small part of its AI features (a handful of AI reasonings or
            Coach passages), email us and we'll refund it in full.
          </li>
          <li>
            <strong>Billing errors:</strong> if you were charged twice, charged the wrong amount, or
            charged for a plan you didn't get, we'll refund the difference in full — no time limit.
          </li>
          <li>
            <strong>After substantial use, or after 7 days:</strong> plans are generally
            non-refundable once you've meaningfully used the AI features or the period is well
            underway, since the cost has already been incurred on your behalf.
          </li>
        </ul>
        <p>
          We don't offer partial or pro-rated refunds for unused days of an active plan. If
          something's genuinely wrong, reach out — we'd rather sort it out than lose your trust.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Email{" "}
          <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>{" "}
          from the address on your account, with the approximate date and plan you purchased. Approved
          refunds are processed back to your original payment method via Razorpay, typically within
          5–7 business days.
        </p>
      </Section>

      <Section title="Failed or pending payments">
        <p>
          If a payment fails but money left your account, it's usually an authorization hold that
          your bank releases automatically within a few business days. If it doesn't, email us with
          the details and we'll help trace it with Razorpay.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as our plans evolve. We'll update the date above when we do.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about billing, refunds, or cancellations:{" "}
          <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
