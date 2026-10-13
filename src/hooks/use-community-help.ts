// Community help that counts: the asker marks a reply as the solution, anyone
// can thank a reply with a reason, and both add up into a person's public
// help summary (see 20261014100000_community_help.sql).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COMMENTS_KEY, POSTS_KEY } from "@/hooks/use-community";

const sb = supabase;

/** Kinds of post that ask for something and can be marked solved. */
export const ASK_TYPES = new Set(["question", "help_request", "feedback_request"]);
export const isAsk = (type: string) => ASK_TYPES.has(type);

export const THANKS_REASON_MIN = 3;
export const THANKS_REASON_MAX = 140;

export type ReplyThanks = {
  id: string;
  comment_id: string;
  giver_id: string;
  reason: string;
  created_at: string;
  giver: { display_name: string | null; handle: string | null } | null;
};

const THANKS_KEY = (postId: string) => ["post-thanks", postId] as const;
export const HELP_SUMMARY_KEY = (profileId: string) => ["help-summary", profileId] as const;

/** Every thanks on a post's replies, oldest first. */
export function usePostThanks(postId: string, enabled = true) {
  return useQuery({
    queryKey: THANKS_KEY(postId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("community_kudos")
        .select(
          "id, comment_id, giver_id, reason, created_at, giver:profiles!giver_id(display_name, handle)",
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReplyThanks[];
    },
    enabled: enabled && !!postId,
    staleTime: 30_000,
  });
}

/** The asker picks (or with `on: false`, unpicks) a reply as the solution. */
export function useMarkSolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string; on: boolean }) => {
      const { error } = await sb.rpc("mark_solution", {
        p_comment_id: input.commentId,
        p_on: input.on,
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(input.postId) });
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: ["space-posts"] });
      qc.invalidateQueries({ queryKey: ["project-community-posts"] });
      qc.invalidateQueries({ queryKey: ["help-summary"] });
    },
  });
}

/** Thank a reply's author with a short reason (again = change the reason). */
export function useThankReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string; reason: string }) => {
      const { error } = await sb.rpc("thank_reply", {
        p_comment_id: input.commentId,
        p_reason: input.reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: THANKS_KEY(input.postId) });
      qc.invalidateQueries({ queryKey: ["project-community-posts"] });
      qc.invalidateQueries({ queryKey: ["help-summary"] });
    },
  });
}

/** Take back your own thanks. */
export function useRemoveThanks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; postId: string }) => {
      const { error } = await sb.from("community_kudos").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: THANKS_KEY(input.postId) });
      qc.invalidateQueries({ queryKey: ["help-summary"] });
    },
  });
}

export type HelpSummary = {
  solutions: number;
  thanks: number;
  people_helped: number;
  skills: { slug: string; name: string; count: number }[];
  recent: {
    reason: string;
    created_at: string;
    post_id: string;
    post_title: string;
    from_name: string | null;
    from_handle: string | null;
  }[];
};

const EMPTY_SUMMARY: HelpSummary = {
  solutions: 0,
  thanks: 0,
  people_helped: 0,
  skills: [],
  recent: [],
};

/** A person's public help: solutions, thanks, who and what it was for. */
export function useHelpSummary(profileId: string | null | undefined) {
  return useQuery({
    queryKey: HELP_SUMMARY_KEY(profileId ?? ""),
    queryFn: async (): Promise<HelpSummary> => {
      const { data, error } = await sb.rpc("community_help_summary", {
        p_profile_id: profileId as string,
      });
      if (error) throw error;
      return { ...EMPTY_SUMMARY, ...(data as Partial<HelpSummary> | null) };
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

/** Has this person helped anyone in public yet? */
export const hasHelped = (summary: HelpSummary | undefined) =>
  !!summary && (summary.solutions > 0 || summary.thanks > 0);
