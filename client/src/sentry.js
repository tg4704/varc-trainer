// Sentry browser integration (Phase 18 / deployment).
// Loaded lazily so it never blocks the initial render — and skipped entirely
// when VITE_SENTRY_DSN is unset (local dev, preview builds).
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;

  import("@sentry/react")
    .then(({ init, browserTracingIntegration }) => {
      init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [browserTracingIntegration()],
        tracesSampleRate: 0.1,
        enabled: import.meta.env.PROD,
      });
    })
    .catch(() => {
      // Non-critical — monitoring is nice-to-have; never block the app.
    });
}
