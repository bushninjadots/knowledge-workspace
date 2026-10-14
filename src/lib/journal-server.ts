// Creating a journal token happens on the server: the plain token is shown to
// the member once and only its hash is stored (journal-tokens.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createJournalToken = createServerFn({ method: "POST" })
  .validator((d: { name: string }) => ({
    name: String(d?.name ?? "")
      .trim()
      .slice(0, 60),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateToken, hashToken, MAX_ACTIVE_TOKENS, tokenPrefix } =
      await import("./journal-tokens");
    const { count } = await supabaseAdmin
      .from("journal_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    if ((count ?? 0) >= MAX_ACTIVE_TOKENS)
      return { ok: false as const, error: "You have 10 active tokens — revoke one first." };
    const token = generateToken();
    const { data: row, error } = await supabaseAdmin
      .from("journal_tokens")
      .insert({
        user_id: context.userId,
        name: data.name || "My tools",
        token_hash: await hashToken(token),
        prefix: tokenPrefix(token),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Couldn't create the token." };
    return { ok: true as const, id: row.id, token };
  });

/** Pull feat/fix commits from the member's project repos into their journal. */
export const syncProjectJournal = createServerFn({ method: "POST" })
  .validator((d: { projectId?: string } | undefined) => ({
    projectId: typeof d?.projectId === "string" ? d.projectId : undefined,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncProjectsToJournal } = await import("./project-journal-sync");
    const { publicGithubToken } = await import("./github-refresh");
    const { data: stored } = await supabaseAdmin
      .from("user_github_tokens")
      .select("token")
      .eq("user_id", context.userId)
      .maybeSingle();
    return syncProjectsToJournal(supabaseAdmin, context.userId, {
      projectId: data.projectId,
      githubToken: stored?.token ?? publicGithubToken(),
    });
  });
