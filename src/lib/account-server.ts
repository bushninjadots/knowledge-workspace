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

/**
 * Permanently delete the signed-in user's account and all of their data.
 * Destructive and irreversible — the caller must confirm before invoking.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => deleteUserAccount(context.userId));
