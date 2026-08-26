import * as Sentry from "@sentry/react";

let initialized = false;

/**
 * Initialize Sentry exactly once. `RootShell` re-renders on SSR, hydration, and
 * every client-side navigation, so calling `Sentry.init` unconditionally would
 * throw "Multiple Sentry Session Replay instances are not supported" on the
 * second call and take down the whole page via the error boundary.
 */
export function initSentry() {
  if (initialized) return;
  initialized = true;

  if (import.meta.env.DEV) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
