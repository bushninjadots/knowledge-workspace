// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

const capturedErrors = new Map<number, { error: unknown; at: number }>();
const TTL_MS = 5_000;

function record(error: unknown) {
  const now = Date.now();
  capturedErrors.set(now, { error, at: now });

  // Clean up expired entries
  for (const [key, entry] of capturedErrors) {
    if (now - entry.at > TTL_MS) capturedErrors.delete(key);
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  const now = Date.now();
  let latest: { error: unknown; at: number } | undefined;

  for (const [, entry] of capturedErrors) {
    if (now - entry.at > TTL_MS) continue;
    if (!latest || entry.at > latest.at) latest = entry;
  }

  if (latest) {
    capturedErrors.delete(latest.at);
    return latest.error;
  }
  return undefined;
}
