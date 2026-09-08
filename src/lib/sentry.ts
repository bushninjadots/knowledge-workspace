let initialized = false;
let sentryLoad: Promise<typeof import("@sentry/react")> | undefined;

/**
 * Initialize Sentry exactly once. `RootShell` re-renders on SSR, hydration, and
 * every client-side navigation, so calling `Sentry.init` unconditionally would
 * throw "Multiple Sentry Session Replay instances are not supported" on the
 * second call and take down the whole page via the error boundary.
 */
export function initSentry() {
  if (initialized) return;
  initialized = true;

  // Telemetry is browser-only and non-critical to the first render. Keep the
  // SDK (including Replay) out of the root client chunk and load it after the
  // application has mounted.
  if (import.meta.env.DEV || typeof window === "undefined") return;
  sentryLoad ??= import("@sentry/react");
  void sentryLoad.then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        // Text and media stay masked (GDPR / Spain) — replays show interaction
        // structure, never the contents of messages, forms, or uploaded media.
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  });
}
