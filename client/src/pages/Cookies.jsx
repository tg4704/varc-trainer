import { LegalDoc, Section } from "./LegalDoc.jsx";
import PageMeta from "../components/PageMeta.jsx";
import { resetAnalyticsConsent } from "../analytics.js";

export default function Cookies() {
  return (
    <LegalDoc title="Cookie Policy" updated="15 July 2026">
      <PageMeta title="Cookie Policy · Graspr" description="What Graspr stores in your browser, why, and how to change your choice." />
      <p>
        This is the short version of how Graspr uses cookies and similar browser storage. It sits
        alongside our{" "}
        <a href="/privacy" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Privacy Policy</a>, which covers what
        we collect in more depth.
      </p>

      <Section title="Strictly necessary: no consent needed">
        <p>
          Your login session is stored as a token in your browser's local storage, and your cookie
          choice itself is remembered the same way. Neither is optional; without them you can't
          stay signed in, and we'd ask you the cookie question on every single page. These aren't
          cookies in the tracking sense, and nothing here is used to profile you across other sites.
        </p>
      </Section>

      <Section title="Your consent choice: analytics">
        <p>
          The only thing we actually ask permission for is product analytics (PostHog), which helps
          us see which parts of Graspr get used and where people get stuck. It does not load, and no
          analytics request leaves your browser, until you click <strong>Accept</strong> on the
          banner. Session replay is off by default. If you click <strong>Decline</strong>, none of
          this loads and nothing is tracked.
        </p>
      </Section>

      <Section title="What we do not use">
        <p>
          No advertising cookies, no cross-site tracking pixels, no third-party ad networks, and no
          selling of browsing data. Graspr doesn't run ads, so there's no ad-tech stack to opt out of
          in the first place.
        </p>
      </Section>

      <Section title="Changing your choice later">
        <p>
          You can reopen the consent banner at any time and switch between Accept and Decline.
          Nothing about your account or practice history is affected either way.
        </p>
        <button
          onClick={resetAnalyticsConsent}
          className="fx-underline w-fit text-[14px] font-semibold"
          style={{ color: "var(--teal)" }}
        >
          Manage cookie preferences
        </button>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If what we store or why changes, we'll update this page and the date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about cookies or analytics:{" "}
          <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
