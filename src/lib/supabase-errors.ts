type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/**
 * True when an error means "the published schema doesn't have this column or
 * table yet" (a PostgREST column/schema error, 42P01/42703/…). The app's
 * convention is to degrade gracefully to local defaults on these — the same
 * feature keeps working on an un-migrated database — while every other error
 * is treated as a genuine failure.
 */
export function isColumnSchemaError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code?.startsWith("42")) return true;
  return /column|schema/i.test(error.message ?? "");
}
