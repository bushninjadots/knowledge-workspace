// User-facing auth error messages.
//
// Supabase returns credential/validation problems as `{ error }` objects whose
// `.message` is already friendly ("Invalid login credentials"). But when the
// Supabase server can't be reached at all, supabase-js *throws* (TypeError /
// "Failed to fetch" / "NetworkError when attempting to fetch resource") and the
// raw message is useless to a user. This helper turns those into a clear,
// actionable message — and detects the offline case up front.

const NETWORK_ERROR_PATTERNS = [
  /networkerror/i,
  /failed to fetch/i,
  /load failed/i,
  /fetch failed/i,
  /internet disconnected/i,
  /ERR_CONNECTION/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /timed out/i,
  /aborted/i,
];

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true; // fetch rejects with TypeError on network failures
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isNetworkError(error)) {
    return "Can't reach Tethyr's servers. Check your connection and try again.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
