import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostReportRow, ModerationLogRow } from "@/hooks/community-space-types";

const sb = supabase;

const POST_REPORTS_KEY = ["post-reports"] as const;
const SPACE_POST_REPORTS_KEY = (spaceId: string) => ["space-post-reports", spaceId] as const;
const MODERATION_LOG_KEY = (spaceId: string) => ["moderation-log", spaceId] as const;
const SPACE_REPORTED_POST_IDS_KEY = (spaceId: string) =>
  ["space-reported-post-ids", spaceId] as const;

/**
 * Post id → number of open reports, in a space — used by moderators to badge
 * reported posts directly in the space feed and to auto-dimm posts with many
 * reports. RLS scopes this to reports the current user can see (their own, or
 * any report in a space they moderate).
 */
export function useSpaceReportedPostCounts(spaceId: string) {
  return useQuery({
    queryKey: SPACE_REPORTED_POST_IDS_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select("post_id")
        .eq("status", "open")
        .limit(1000);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return new Map<string, number>();
        }
        throw error;
      }

      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        if (!r.post_id) continue;
        counts.set(r.post_id as string, (counts.get(r.post_id as string) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function usePostReports() {
  return useQuery({
    queryKey: POST_REPORTS_KEY,
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const [{ data: reporters }, { data: posts }] = await Promise.all([
        reporterIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("posts").select("id, title, space_id").in("id", postIds)
          : { data: [] },
      ]);

      const reporterMap = new Map(
        (reporters ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const postMap = new Map(
        (posts ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return reports.map((r): PostReportRow => ({
        ...r,
        post: r.post_id
          ? ((postMap.get(r.post_id) as PostReportRow["post"]) ?? {
              title: null,
              space_id: null,
              body: null,
              author_id: null,
            })
          : {
              title: r.post_title_snapshot ?? null,
              space_id: null,
              body: null,
              author_id: null,
            },
        reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
          display_name: "Unknown",
          handle: "user",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
  });
}

/**
 * Full report history for a space (open + resolved + dismissed) — powers the
 * moderation reports inbox. Moderators can see every status; the resolved/
 * dismissed rows carry the moderator's note and timestamp.
 */
export function useSpaceReportHistory(spaceId: string) {
  return useQuery({
    queryKey: ["space-report-history", spaceId] as const,
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, space_id_snapshot, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
      const [postsRes, reportersRes] = await Promise.all([
        postIds.length > 0
          ? supabase.from("posts").select("id, title, space_id, body, author_id").in("id", postIds)
          : { data: [] },
        reporterIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] },
      ]);
      const postAuthorIds = [
        ...new Set((postsRes.data ?? []).map((p) => p.author_id).filter(Boolean)),
      ] as string[];
      const { data: authorsData } =
        postAuthorIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle")
              .in("id", postAuthorIds)
          : { data: [] };
      const authorMap = new Map(
        (authorsData ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const postMap = new Map(
        (postsRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const reporterMap = new Map(
        (reportersRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return reports
        .filter((r) => {
          if (r.post_id != null) return postMap.get(r.post_id)?.space_id === spaceId;
          // Post removed — use the snapshot taken when it was deleted.
          return r.space_id_snapshot === spaceId;
        })
        .map((r): PostReportRow => {
          const postRow = r.post_id ? (postMap.get(r.post_id) as PostReportRow["post"]) : null;
          return {
            ...r,
            post: r.post_id
              ? (postRow ?? {
                  title: r.post_title_snapshot ?? null,
                  space_id: null,
                  body: null,
                  author_id: null,
                })
              : {
                  title: r.post_title_snapshot ?? null,
                  space_id: null,
                  body: null,
                  author_id: null,
                },
            post_author: postRow?.author_id
              ? ((authorMap.get(postRow.author_id) as PostReportRow["post_author"]) ?? {
                  display_name: "Unknown",
                  handle: "user",
                })
              : undefined,
            reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
              display_name: "Unknown",
              handle: "user",
              avatar_url: null,
            },
          };
        });
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useSpacePostReports(spaceId: string) {
  return useQuery({
    queryKey: SPACE_POST_REPORTS_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, space_id")
        .in("id", postIds);
      const postMap = new Map(
        (posts ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const inSpace = reports.filter(
        (r) => r.post_id != null && postMap.get(r.post_id)?.space_id === spaceId,
      );

      const reporterIds = [...new Set(inSpace.map((r) => r.reporter_id))];
      const { data: reporters } =
        reporterIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] };
      const reporterMap = new Map(
        (reporters ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return inSpace.map((r): PostReportRow => ({
        ...r,
        post: r.post_id
          ? ((postMap.get(r.post_id) as PostReportRow["post"]) ?? {
              title: null,
              space_id: null,
              body: null,
              author_id: null,
            })
          : {
              title: r.post_title_snapshot ?? null,
              space_id: null,
              body: null,
              author_id: null,
            },
        reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
          display_name: "Unknown",
          handle: "user",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reportId: string;
      status: "resolved" | "dismissed";
      note?: string;
    }) => {
      const { error } = await sb
        .from("post_reports")
        .update({
          status: input.status,
          moderator_note: input.note?.trim() || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POST_REPORTS_KEY });
      qc.invalidateQueries({ queryKey: ["space-post-reports"] });
      qc.invalidateQueries({ queryKey: ["space-reported-post-ids"] });
    },
  });
}

export function useModerationLog(spaceId: string) {
  return useQuery({
    queryKey: MODERATION_LOG_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("moderation_log")
        .select("id, space_id, post_id, post_title, actor_id, action, created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as ModerationLogRow[];
        }
        throw error;
      }

      const rows = (data ?? []) as ModerationLogRow[];
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const { data: actors } =
        actorIds.length > 0
          ? await supabase.from("profiles").select("id, display_name, handle").in("id", actorIds)
          : { data: [] };
      const actorMap = new Map(
        (actors ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return rows.map((r): ModerationLogRow => ({
        ...r,
        actor: (actorMap.get(r.actor_id ?? "") as ModerationLogRow["actor"]) ?? {
          display_name: "Unknown",
          handle: "user",
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}
