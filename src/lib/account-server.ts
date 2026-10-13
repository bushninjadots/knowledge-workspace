// Server-side account operations that need the service-role client.
//
// Deleting a user can't run from the browser — the anon key has no admin
// rights — so it lives here as a server function. The DB schema references
// auth.users(id) with ON DELETE CASCADE (74 references) or SET NULL (8), so
// deleting the auth user clears all of the person's data.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Core deletion logic, extracted from the server function so it's unit-testable
 * without a request context. The service-role client is loaded lazily so it
 * never lands in the client bundle.
 */
export async function deleteUserAccount(userId: string): Promise<{ ok: true }> {
  // Dynamic import keeps the service-role client out of the client bundle.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
  return { ok: true as const };
}

/** How recently the person must have signed in to delete their account. */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

/**
 * When the session's holder last actually authenticated, in epoch seconds.
 * Supabase records each sign-in method in the JWT's `amr` claim with the time
 * it happened; unlike `iat`, that timestamp survives token refreshes, so a
 * session left open for days still reads as an old sign-in.
 */
export function lastSignInAt(claims: { amr?: unknown }): number | null {
  if (!Array.isArray(claims.amr)) return null;
  const times = claims.amr
    .map((entry) => (entry as { timestamp?: unknown } | null)?.timestamp)
    .filter((time): time is number => typeof time === "number");
  return times.length ? Math.max(...times) : null;
}

export function signedInRecently(claims: { amr?: unknown }, nowSeconds = Date.now() / 1000) {
  const at = lastSignInAt(claims);
  return at !== null && nowSeconds - at <= RECENT_SIGN_IN_SECONDS;
}

/**
 * Permanently delete the signed-in user's account and all of their data.
 * Destructive and irreversible — the caller must confirm before invoking, and
 * the session must come from a sign-in in the last few minutes, so a stolen or
 * left-open session cannot wipe the account.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!signedInRecently(context.claims as { amr?: unknown })) {
      return { ok: false as const, reason: "reauth" as const };
    }
    return deleteUserAccount(context.userId);
  });
