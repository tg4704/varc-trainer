import { Link } from "react-router-dom";
import { LegalDoc, Section } from "./LegalDoc.jsx";
import PageMeta from "../components/PageMeta.jsx";

export default function Refunds() {
  return (
    <LegalDoc title="Refund & Cancellation Policy" updated="17 July 2026">
      <PageMeta title="Refund & Cancellation Policy · Graspr" description="How Graspr paid plans, refunds, and cancellations work." />
      <p>
        This policy covers Graspr's paid plans, operated by Tarun Gupta, an individual based in
        Bangalore, Karnataka, India. It sits alongside our{" "}
        <Link to="/terms" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms of Service</Link>.
      </p>

      <Section title="How our plans work">
        <p>
          Graspr paid tiers (Inference, 99th Percentile, Topper) come in two forms:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Monthly (auto-renews):</strong> a recurring subscription billed once a month via
            Razorpay autopay (UPI Autopay or a card mandate). It renews automatically each month until
            you cancel.
          </li>
          <li>
            <strong>Till CAT (one-time pass):</strong> a single payment that unlocks the tier until the
            CAT exam date. It does <strong>not</strong> auto-renew and simply expires on that date,
            so there's nothing to cancel.
          </li>
        </ul>
      </Section>

      <Section title="Cancelling a monthly subscription">
        <p>
          You can cancel anytime from{" "}
          <Link to="/my-plan" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>My Plan</Link>.
          Cancellation takes effect <strong>at the end of the period you've already paid for</strong>.
          It stops the plan from renewing, rather than ending it immediately:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>You keep full access to your tier until the current paid period ends.</li>
          <li>
            Your Razorpay autopay mandate is cancelled, so <strong>you will not be charged again</strong>.
          </li>
          <li>
            The current period is not pro-rated or refunded, because you keep full access to it (see
            Refunds below).
          </li>
          <li>When the paid period ends you return to the free Skimmer tier. Your practice history stays.</li>
        </ul>
        <p>
          The one-time Till CAT pass has no auto-renewal, so there's nothing to cancel; it simply
          expires on the exam date.
        </p>
      </Section>

      <Section title="Refunds">
        <p>
          Our paid tiers unlock AI features that cost us money each time they're used, so we keep
          refunds simple and predictable:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Cancellation is not a refund.</strong> Cancelling a monthly plan stops future
            renewals; it does not refund the current period, since you keep full access to it.
          </li>
          <li>
            <strong>Renewals are non-refundable.</strong> Once a monthly renewal has been charged,
            that month is not refundable. To avoid the next charge, cancel before your renewal date;
            you can see it on{" "}
            <Link to="/my-plan" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>My Plan</Link>.
          </li>
          <li>
            <strong>Goodwill window (first purchase only):</strong> if this was your first payment for
            a tier, you made it within the last 7 days, and you've used almost none of its AI features
            (a handful of AI reasonings or Coach passages at most), email us and we'll refund it in
            full. This is a one-time courtesy, not available on renewals.
          </li>
          <li>
            <strong>Billing errors, always refunded:</strong> if you were charged twice, charged the
            wrong amount, or charged for something you didn't receive, we'll refund the difference in
            full, with no time limit.
          </li>
        </ul>
        <p>
          Outside these cases, payments are non-refundable, and we don't pro-rate unused days of an
          active plan. If something's genuinely wrong, reach out; we'd rather sort it out than lose
          your trust.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Email{" "}
          <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>{" "}
          from the email address on your account, telling us the plan, the approximate date, and the
          reason. Approved refunds go back to your original payment method via Razorpay, typically
          within 5 to 7 business days (your bank may take a little longer to show it).
        </p>
      </Section>

      <Section title="Failed, retried, or paused payments">
        <p>
          If a payment fails but money left your account, it's usually a temporary authorization hold
          your bank releases on its own within a few business days. For monthly plans, if an
          automatic renewal fails, Razorpay may retry it; you keep access until your paid-through
          date, and if the charge still can't be collected the subscription pauses and access ends at
          that date. If anything looks wrong, email us with the details and we'll trace it with
          Razorpay.
        </p>
      </Section>

      <Section title="Suspension for misuse">
        <p>
          We may suspend or cancel access without a refund if a plan is used in breach of our{" "}
          <Link to="/terms" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms of Service</Link>,
          for example fraud, payment chargebacks, or automated abuse of the AI features.
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
