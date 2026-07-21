// Sentry browser integration (Phase 18 / deployment).
// Loaded lazily so it never blocks the initial render - and skipped entirely
// when VITE_SENTRY_DSN is unset (local dev, preview builds).
let sentryModule = null;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;

  import("@sentry/react")
    .then((mod) => {
      mod.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [mod.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        enabled: import.meta.env.PROD,
      });
      sentryModule = mod;
    })
    .catch(() => {
      // Non-critical - monitoring is nice-to-have; never block the app.
    });
}

// Safe to call even if Sentry never loaded (dev, missing DSN, still loading) -
// silently no-ops. Used by ErrorBoundary so render crashes are actually visible.
export function captureException(error, context) {
  sentryModule?.captureException(error, context ? { extra: context } : undefined);
}
