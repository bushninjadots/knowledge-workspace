// User-facing error messages for transient toasts.
//
// Supabase's PostgrestError carries internal table/RLS/column/constraint
// details that should never reach a user. This helper returns either a
// friendly, actionable message (network failures, genuinely user-facing
// validation) or a safe fallback — never raw SQL/database internals.

import { isNetworkError } from "./auth-error";

// Patterns that identify a Supabase/Postgres internal error rather than a
// user-facing validation message. Keep these conservative so genuine
// validation messages (e.g. "Invalid login credentials") still pass through.
const INTERNAL_PATTERNS = [
  /could not find the table/i,
  /row-level security/i,
  /schema cache/i,
  /(?:column|table|relation|function|type|policy|role)\b[^]*\bdoes not exist/i,
  /violates (?:foreign key|unique|not-null|check) constraint/i,
  /duplicate key value/i,
  /permission denied/i,
  /new row violates/i,
  /syntax error at/i,
  /invalid input syntax/i,
  /parse error/i,
  /JSON object requested/i,
];

/**
 * Returns a message safe to show in a toast. Network failures become an
 * offline message, Supabase/Postgres internals become `fallback`, and
 * everything else (typically already-friendly validation) passes through.
 */
export function friendlyError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isNetworkError(error)) {
    return "Can't reach Tethyr's servers. Check your connection and try again.";
  }

  let message = "";
  if (error instanceof Error) message = error.message;
  else if (typeof error === "string") message = error;
  else {
    // An error object (e.g. `{ message }`) from non-throwing SDKs.
    const m = (error as { message?: unknown } | null)?.message;
    if (typeof m === "string") message = m;
  }

  if (!message.trim()) return fallback;
  if (message.startsWith("{") || message.startsWith("[")) return fallback;
  if (INTERNAL_PATTERNS.some((re) => re.test(message))) return fallback;
  return message;
}
