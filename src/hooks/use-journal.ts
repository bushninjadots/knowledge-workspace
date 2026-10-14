// The dev journal (20261014160000_dev_journal.sql): short log lines, private
// by default, plus the personal access tokens a member's tools use to write
// to it (see src/lib/journal-api.ts).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createJournalToken } from "@/lib/journal-server";
import type { JournalEntryLite, JournalKind } from "@/lib/journal";

const sb = supabase;

export type JournalEntry = {
  id: string;
  author_id: string;
  kind: JournalKind;
  body: string;
  detail: string | null;
  project_id: string | null;
  source: string;
  source_url: string | null;
  is_public: boolean;
  resolved_at: string | null;
  occurred_at: string;
  created_at: string;
  project: { id: string; title: string } | null;
};

type JournalToken = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const JOURNAL_KEY = ["journal"] as const;
const TOKENS_KEY = ["journal-tokens"] as const;

const SELECT =
  "id, author_id, kind, body, detail, project_id, source, source_url, is_public, resolved_at, occurred_at, created_at, project:projects(id, title)";

/** For the pure helpers in lib/journal. */
export function toLite(entries: JournalEntry[]): JournalEntryLite[] {
  return entries.map((e) => ({
    kind: e.kind,
    body: e.body,
    occurred_at: e.occurred_at,
    project_title: e.project?.title ?? null,
    resolved_at: e.resolved_at,
    source_url: e.source_url,
  }));
}

/** The signed-in member's entries in [from, to), newest first. */
export function useJournalEntries(range: { from: string; to?: string }, enabled = true) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  return useQuery({
    queryKey: [...JOURNAL_KEY, "mine", userId ?? "", range.from, range.to ?? ""],
    queryFn: async () => {
      let query = sb
        .from("journal_entries")
        .select(SELECT)
        .eq("author_id", userId!)
        .gte("occurred_at", range.from)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (range.to) query = query.lt("occurred_at", range.to);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as JournalEntry[];
    },
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

/** Entries a member chose to show on their profile. */
export function usePublicJournal(profileId: string | undefined, limit = 8) {
  return useQuery({
    queryKey: [...JOURNAL_KEY, "public", profileId ?? "", limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from("journal_entries")
        .select(SELECT)
        .eq("author_id", profileId!)
        .eq("is_public", true)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as JournalEntry[];
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useAddJournalEntry() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: {
      kind: JournalKind;
      body: string;
      project_id?: string | null;
      detail?: string | null;
    }) => {
      const { error } = await sb.from("journal_entries").insert({
        author_id: me!.userId,
        kind: input.kind,
        body: input.body.trim(),
        project_id: input.project_id ?? null,
        detail: input.detail ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: JOURNAL_KEY }),
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      is_public?: boolean;
      resolved_at?: string | null;
      body?: string;
      kind?: JournalKind;
    }) => {
      const { error } = await sb.from("journal_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: JOURNAL_KEY }),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: JOURNAL_KEY }),
  });
}

/* ── Tokens ────────────────────────────────────────────────────────────── */

export function useJournalTokens() {
  const { data: me } = useCurrentUser();
  return useQuery({
    queryKey: TOKENS_KEY,
    queryFn: async () => {
      const { data, error } = await sb
        .from("journal_tokens")
        .select("id, name, prefix, created_at, last_used_at, revoked_at")
        .eq("user_id", me!.userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JournalToken[];
    },
    enabled: !!me?.userId,
  });
}

export function useCreateJournalToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createJournalToken({ data: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

export function useRevokeJournalToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from("journal_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

type ProjectJournalEntry = JournalEntry & {
  author: { display_name: string | null; handle: string | null } | null;
};

/** Entries any member shared under a project — they join its timeline. */
export function useProjectJournal(projectId: string | undefined) {
  return useQuery({
    queryKey: [...JOURNAL_KEY, "project", projectId ?? ""],
    queryFn: async () => {
      const { data, error } = await sb
        .from("journal_entries")
        .select(`${SELECT}, author:profiles!author_id(display_name, handle)`)
        .eq("project_id", projectId!)
        .eq("is_public", true)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectJournalEntry[];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
