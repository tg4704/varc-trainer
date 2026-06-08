// Phase 18 prep — Sentry browser error monitoring.
// Only activates when VITE_SENTRY_DSN is set at build time (i.e., in production).
// Wrap in try/catch so a missing package never crashes the app in development.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    import("@sentry/react").then(({ init, browserTracingIntegration }) => {
      init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [browserTracingIntegration()],
        tracesSampleRate: 0.1,
        // Don't send errors in dev
        enabled: import.meta.env.PROD,
      });
    });
  } catch {
    // Sentry is non-critical — never crash the app for it
  }
}
