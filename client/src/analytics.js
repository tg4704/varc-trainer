// PostHog analytics - loaded lazily and ONLY after the user has explicitly
// accepted the cookie/analytics consent banner (CookieConsent.jsx). Nothing
// analytics-related ever fires before that, and nothing fires at all if
// VITE_POSTHOG_KEY is unset (local dev without a key configured).
const CONSENT_KEY = "graspr_analytics_consent"; // "granted" | "denied"

export function getAnalyticsConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

export function hasAnalyticsConsent() {
  return getAnalyticsConsent() === "granted";
}

let posthogInstance = null;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || !hasAnalyticsConsent() || posthogInstance) return;

  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        disable_session_recording: true,
        person_profiles: "identified_only",
      });
      posthogInstance = posthog;
    })
    .catch(() => {
      // Non-critical - analytics is nice-to-have; never block the app.
    });
}

// Fires a named funnel event (signup, session_start, question_answered,
// coach_used). No-op before consent/init - same silent-fail posture as the
// rest of this module.
export function track(event, props) {
  posthogInstance?.capture(event, props);
}

function shutdownAnalytics() {
  if (posthogInstance) posthogInstance.opt_out_capturing();
}

export function grantAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, "granted");
  initAnalytics();
}

export function denyAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, "denied");
  shutdownAnalytics();
}

// Clears the stored decision so the consent banner reappears - used by the
// "Manage cookie preferences" link on the Privacy Policy page.
export function resetAnalyticsConsent() {
  localStorage.removeItem(CONSENT_KEY);
  shutdownAnalytics();
  window.dispatchEvent(new Event("graspr:reopen-cookie-banner"));
}
