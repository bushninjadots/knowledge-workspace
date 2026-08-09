import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const POST_TYPE_LABEL: Record<string, string> = {
  showcase: "Showcase",
  question: "Question",
  project_update: "Update",
  tutorial: "Tutorial",
  resource: "Resource",
  achievement: "Achievement",
  discussion: "Discussion",
  help_request: "Help",
  collaboration_request: "Collab",
  progress_update: "Progress",
  lesson_learned: "Lesson",
  feedback_request: "Feedback",
  open_role: "Open Role",
};

type PostLite = {
  id: string;
  title: string;
  type: string;
  author_id: string;
  space_id: string | null;
  created_at: string;
  author?: { display_name: string | null; handle: string | null };
};

export function useProjectCommunityPostCount(projectId: string) {
  return useQuery({
    queryKey: ["project-community-post-count", projectId],
    queryFn: async () => {
      const { count, error } = await sb
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) {
        if (error.code === "42P01") return 0;
        throw error;
      }
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function ProjectCommunityPosts({ projectId }: { projectId: string }) {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["project-community-posts", projectId],
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("posts")
        .select("id, title, type, author_id, space_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }

      const rows = (raw ?? []) as PostLite[];
      if (rows.length === 0) return [];

      const authorIds = [...new Set(rows.map((r) => r.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", authorIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      const spaceIds = [...new Set(rows.map((r) => r.space_id).filter(Boolean))] as string[];
      let spaceSlugMap = new Map<string, string>();
      if (spaceIds.length > 0) {
        const { data: spaces } = await sb
          .from("community_spaces")
          .select("id, slug")
          .in("id", spaceIds);
        spaceSlugMap = new Map(
          (spaces ?? []).map((s: { id: string; slug: string }) => [s.id, s.slug]),
        );
      }

      return rows.map((r) => ({
        ...r,
        space_slug: r.space_id ? (spaceSlugMap.get(r.space_id) ?? null) : null,
        author: (profileMap.get(r.author_id) as {
          display_name: string | null;
          handle: string | null;
        }) ?? {
          display_name: "Unknown",
          handle: "unknown",
        },
      }));
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border card-border bg-surface p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Loading community posts...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border card-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/80">
        <MessageCircle className="h-4 w-4" />
        Community Discussions
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No community discussions yet. Be the first to post about this project.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              to="/community"
              search={
                {
                  post: post.id,
                  ...(post.space_slug ? { space: post.space_slug } : {}),
                } as Record<string, string>
              }
              className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-elevated"
            >
              <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0 text-[11px] text-muted-foreground">
                {POST_TYPE_LABEL[post.type] ?? post.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{post.title}</span>
              <span className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(post.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
