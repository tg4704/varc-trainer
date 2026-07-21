import { Link } from "react-router-dom";
import { LegalDoc, Section } from "./LegalDoc.jsx";
import { resetAnalyticsConsent } from "../analytics.js";
import PageMeta from "../components/PageMeta.jsx";

export default function Privacy() {
  return (
    <LegalDoc title="Privacy Policy" updated="11 July 2026">
      <PageMeta title="Privacy Policy · Graspr" description="How Graspr collects, uses, and protects your data, and your rights under India's DPDP Act 2023." />
      <p>
        Graspr ("Graspr", "we", "us") is operated by Tarun Gupta, an individual based in
        Bangalore, Karnataka, India. This policy explains what data Graspr collects when you use
        the site, why, who we share it with, and the rights you have over it. It's written to be
        read, not skimmed past. If anything here is unclear, email{" "}
        <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
          privacy@graspr.in
        </a>.
      </p>

      <Section title="What we collect">
        <p><strong className="text-foreground">Account information:</strong> username, email address, password (stored as a one-way hash, never in plain text), and optionally your name, avatar choice, favorite topic, and bio. If you sign in with Google, we receive your Google account ID, name, and email from Google instead of a password.</p>
        <p><strong className="text-foreground">Practice data:</strong> every question you answer, the option you select, whether you skip, timing, and, if you write it, your typed reasoning explaining your answer. In AI Coach, this also includes your reading-map notes and the back-and-forth of your 1-on-1 AI coaching conversation.</p>
        <p><strong className="text-foreground">AI-generated feedback:</strong> the scores and written feedback Graspr's AI evaluator produces on your reasoning are stored against your attempt so you can review them later.</p>
        <p><strong className="text-foreground">Technical data:</strong> IP address and request metadata, collected briefly for rate-limiting and abuse prevention (blocking scripted login attempts, for example). It is not used to build an advertising profile of you.</p>
        <p><strong className="text-foreground">Analytics (only if you consent):</strong> if you accept the cookie/analytics banner, we collect anonymized product-usage events (pages viewed, features used) via PostHog. Nothing in this category is collected before you explicitly accept, and you can withdraw consent at any time; see "Cookies" below.</p>
      </Section>

      <Section title="How your reasoning text and Coach content are used">
        <p>
          When you submit an answer with written reasoning, or use AI Coach, that text is sent to
          our AI processing partner (currently OpenRouter, which routes the request to an
          underlying model provider such as Anthropic) purely to generate feedback on your
          reasoning, never to determine whether your answer is correct, which Graspr already
          knows from its own question data. We do not use your reasoning text to train any AI
          model, ours or a third party's.
        </p>
      </Section>

      <Section title="Who we share data with">
        <p>We don't sell your data. We share the minimum necessary with:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li><strong className="text-foreground">OpenRouter / underlying AI model providers:</strong> to generate reasoning feedback and AI Coach responses, as described above.</li>
          <li><strong className="text-foreground">Resend:</strong> to deliver OTP verification, password-reset, and account-notice emails.</li>
          <li><strong className="text-foreground">Railway:</strong> our hosting provider, which stores the database and runs the application.</li>
          <li><strong className="text-foreground">Google:</strong> only if you choose "Continue with Google" to sign in.</li>
          <li><strong className="text-foreground">PostHog:</strong> product analytics, only after you accept the analytics cookie banner.</li>
          <li>Law enforcement or regulators, only if legally required to.</li>
        </ul>
        <p>
          Some of these providers process data on servers outside India. We only work with
          providers that maintain reasonable security practices for the data they process on our
          behalf.
        </p>
      </Section>

      <Section title="Cookies and similar technologies">
        <p>
          Graspr stores your login session as a token in your browser's local storage. This is
          essential to keep you signed in and needs no consent, the same way a login cookie
          wouldn't. We do not set any advertising or cross-site tracking cookies. Analytics
          (PostHog) only loads after you explicitly accept the cookie banner shown on your first
          visit.
        </p>
        <button
          onClick={resetAnalyticsConsent}
          className="fx-underline w-fit text-[14px] font-semibold"
          style={{ color: "var(--teal)" }}
        >
          Manage cookie preferences
        </button>
      </Section>

      <Section title="How long we keep your data">
        <p>
          We keep your account and practice data for as long as your account is active. If you
          use "Reset all data" (Profile menu), your sessions and attempts are deleted immediately
          but your account stays. If you delete your account entirely, your account row and
          everything tied to it is deleted immediately and permanently; see "Your rights" below.
        </p>
      </Section>

      <Section title="Your rights (Digital Personal Data Protection Act, 2023)">
        <p>As a data principal under India's DPDP Act, you have the right to:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li><strong className="text-foreground">Access</strong> your data: download a full copy any time via "Export my data" in the Profile menu.</li>
          <li><strong className="text-foreground">Correct</strong> your data: update your name, username, avatar, and bio directly on your Profile page.</li>
          <li><strong className="text-foreground">Erase</strong> your data: permanently delete your account via "Delete account" in the Profile menu. This is immediate and cannot be undone.</li>
          <li><strong className="text-foreground">Nominate</strong> another individual to exercise these rights on your behalf in the event of your death or incapacity: email us to register a nominee.</li>
          <li><strong className="text-foreground">Withdraw consent</strong> for analytics at any time (see "Cookies" above), and register a grievance if you believe we've mishandled your data.</li>
        </ul>
        <p>
          <strong className="text-foreground">Grievance Officer:</strong> Tarun Gupta,{" "}
          <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>, Bangalore, Karnataka, India.
          We aim to respond to any request or grievance within 30 days. If you're unsatisfied with
          our response, you may escalate to the Data Protection Board of India once it is
          operational.
        </p>
      </Section>

      <Section title="Children's data">
        <p>
          Graspr is intended for users 18 years of age or older (CAT is a graduate-entrance exam,
          so this fits our real userbase). We don't knowingly collect data from anyone under 18,
          and we don't run behavioral tracking or targeted advertising toward minors. If you
          believe a minor has registered an account, email us and we'll delete it.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are hashed (never stored in plain text), traffic is encrypted in transit, and
          we rate-limit and monitor for abusive access patterns. No system is perfectly secure;
          if we ever experience a data breach affecting your personal data, we will notify
          affected users and the relevant authority as required by law.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make a material change to this policy, we'll update the date above and, where
          appropriate, notify you directly (e.g. by email).
        </p>
      </Section>

      <p className="pt-2 text-[13px] dim">
        See also our <Link to="/terms" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms of Service</Link>.
      </p>
    </LegalDoc>
  );
}
