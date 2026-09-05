// ── Pending-schema Supabase accessor ─────────────────────────────────────────
// A handful of tables, views and RPCs (Studio page versions, project visits,
// recognitions, the safe repositories view, per-space read state) exist in the
// migration history but are not present in the generated `Database` types,
// because the migration role cannot own or alter those objects in this
// environment. Routing those specific calls through this loosely-typed handle
// keeps the type checker honest about everything else while the queries stay
// exactly as written. Remove a usage as soon as the object lands in `types.ts`.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** The same client instance, without the generated schema constraints. */
export const supabasePending = supabase as unknown as SupabaseClient<any, "public", any>;
