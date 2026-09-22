// Server-side error capture. The browser gets the full Sentry React SDK, but
// the SSR/server runtime never reported errors anywhere — a 500-producing
// regression was invisible unless someone read container logs.
//
// Rather than pull @sentry/node (unavailable here) or @sentry/core's internals
// into the server bundle, this posts the Sentry Envelope format directly to
// the DSN ingest endpoint. Same event model Sentry expects (groupable stack
// traces, environment, extra context), zero dependencies, and it works on any
// Nitro runtime (Node, Cloudflare Workers) since it only uses fetch.
//
// Docs: https://develop.sentry.dev/sdk/envelopes/
// The DSN is not a secret — it only permits event submission.

type SentryDsn = { url: string; publicKey: string };

type SerializedError = {
  type: string;
  value: string;
  stacktrace?: {
    frames: {
      filename: string;
      function?: string;
      lineno: number;
      colno: number;
      in_app: boolean;
    }[];
  };
};

const pendingReports: [unknown, Record<string, string> | undefined][] = [];
const MAX_PENDING = 25;

let dsn: SentryDsn | null | undefined;
let environment: string | undefined;
let initialized = false;

const ENV = (key: string) => (typeof process !== "undefined" ? process.env[key] : undefined);

function parseDsn(raw: string | undefined): SentryDsn | null {
  if (!raw) return null;
  // https://examplePublicKey@o0.ingest.sentry.io/0
  const match = /^(https?):\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(raw.trim());
  if (!match) return null;
  const [, scheme, publicKey, host, projectId] = match;
  return { url: `${scheme}://${host}/api/${projectId}/envelope/`, publicKey };
}

function eventId(): string {
  const g = globalThis.crypto;
  if (g?.randomUUID) return g.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    .padEnd(32, "0")
    .slice(0, 32);
}

/** Parse `at fn (file:line:col)` / `at file:line:col` stack lines minimally. */
type StackFrame = NonNullable<SerializedError["stacktrace"]>["frames"][number];

function parseStack(stack: string): SerializedError["stacktrace"] | undefined {
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n").slice(1)) {
    const m = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!m) continue;
    const [, fn, filename, lineno, colno] = m;
    frames.push({
      filename,
      function: fn || undefined,
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !/[node_modules|node:internal]/.test(filename),
    });
  }
  if (frames.length === 0) return undefined;
  // Sentry wants innermost frame last.
  return { frames: frames.reverse() };
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      value: error.message,
      ...(error.stack ? { stacktrace: parseStack(error.stack) } : {}),
    };
  }
  return { type: "Unknown", value: String(error) };
}

async function sendToSentry(error: unknown, context?: Record<string, string>) {
  if (!dsn) return;
  const serialized = serializeError(error);
  const event = {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    environment: environment ?? "production",
    server_name: "tethyr-ssr",
    exception: { values: [serialized] },
    ...(context && Object.keys(context).length > 0 ? { extra: context } : {}),
  };
  const envelope =
    JSON.stringify({ event_id: event.event_id, sent_at: event.timestamp }) +
    "\n" +
    JSON.stringify({ type: "event", content_type: "application/json" }) +
    "\n" +
    JSON.stringify(event) +
    "\n";

  try {
    const response = await fetch(dsn.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=tethyr-server/1.0`,
      },
      body: envelope,
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) console.warn(`[server-error] Sentry ingest returned ${response.status}`);
  } catch (err) {
    console.warn("[server-error] Sentry ingest failed", err);
  }
}

/**
 * Report an error from server-only code (server entry, middleware, server
 * functions). Fire-and-forget and never throws: telemetry must not turn one
 * failure into two. Safe to call before init — while the DSN is being
 * resolved the event is queued (bounded) and flushed afterwards.
 */
export function reportServerError(error: unknown, context?: Record<string, string>) {
  if (dsn) {
    void sendToSentry(error, context);
    return;
  }
  if (initialized) {
    // No DSN configured — stay on the console pipeline.
    console.error("[server-error]", error, context ?? "");
    return;
  }
  if (pendingReports.length < MAX_PENDING) pendingReports.push([error, context]);
}

export function initServerErrorReporting() {
  if (initialized) return;
  initialized = true;

  dsn = parseDsn(ENV("SENTRY_DSN") ?? ENV("VITE_SENTRY_DSN"));
  environment = ENV("SENTRY_ENVIRONMENT") ?? ENV("NODE_ENV") ?? undefined;

  const pending = pendingReports.splice(0);
  for (const [error, context] of pending) reportServerError(error, context);

  // Route uncaught failures to the same pipeline.
  const g = globalThis as {
    addEventListener?: (type: string, listener: (event: Event) => void) => void;
  };
  g.addEventListener?.("error", (event) => reportServerError((event as ErrorEvent).error ?? event));
  g.addEventListener?.("unhandledrejection", (event) =>
    reportServerError((event as PromiseRejectionEvent).reason),
  );
}
