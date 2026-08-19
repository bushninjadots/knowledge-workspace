import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PostRow, PostType } from "@/hooks/use-community";

const sb = supabase;

type LandingCountTable =
  "profiles" | "projects" | "community_spaces" | "skills" | "posts" | "comments" | "challenges";

/** Counts up from 0 to a real stat value once it scrolls into view. */
export function AnimatedStat({ value }: { value: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, prefersReducedMotion]);

  return (
    <p ref={ref} className="numeric font-display text-xl font-semibold leading-none">
      {display.toLocaleString()}
    </p>
  );
}

export function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const count = async (table: LandingCountTable) => {
        try {
          const { count: c, error } = await sb
            .from(table)
            .select("id", { count: "exact", head: true });
          if (error) return 0;
          return c ?? 0;
        } catch {
          return 0;
        }
      };
      const [members, projects, spaces, skills, posts, comments, challenges] = await Promise.all([
        count("profiles"),
        count("projects"),
        count("community_spaces"),
        count("skills"),
        count("posts"),
        count("comments"),
        count("challenges"),
      ]);
      return { members, projects, spaces, skills, posts, comments, challenges };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type LandingProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[];
  progress_percent: number;
  is_featured: boolean;
  cover_url: string | null;
  profiles: {
    handle: string | null;
    display_name: string | null;
  } | null;
};

export function useFeaturedProjects() {
  return useQuery({
    queryKey: ["landing-featured-projects"],
    queryFn: async (): Promise<LandingProject[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, status, tags, progress_percent, is_featured, cover_url, profiles!projects_profile_id_fkey(id, handle, display_name)",
        )
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LandingProject[];
      await Promise.all(
        rows.map(async (p) => {
          if (!p.cover_url) return;
          const { data: s } = await supabase.storage
            .from("project-media")
            .createSignedUrl(p.cover_url, 60 * 60);
          if (s?.signedUrl) p.cover_url = s.signedUrl;
        }),
      );
      return rows;
    },
    staleTime: 60_000,
  });
}

export function useContributorCount(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["landing-project-contributors", projectId],
    queryFn: async () => {
      if (!projectId) return 0;
      // project_contributors is a composite-key join table (no `id` column)
      const { count, error } = await sb
        .from("project_contributors")
        .select("profile_id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export type LandingActivityPost = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  created_at: string;
  author: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  likes: number;
  comments: number;
};
const ACTIVITY_FEED_SIZE = 6;

export function useRecentActivity() {
  return useQuery({
    queryKey: ["landing-activity"],
    queryFn: async (): Promise<LandingActivityPost[]> => {
      const { data: rawPosts, error } = await sb
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_FEED_SIZE);

      if (error) {
        // Table may not exist yet in fresh databases — return empty instead of crashing
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [];
        }
        throw error;
      }
      const posts = rawPosts as PostRow[];
      if (posts.length === 0) return [];

      // Authors
      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", authorIds);
      const profileMap = new Map<string, LandingActivityPost["author"]>(
        (profiles ?? []).map((p) => [
          p.id,
          {
            display_name: p.display_name,
            handle: p.handle,
            avatar_url: p.avatar_url,
          },
        ]),
      );

      // Counts (posts, comments, post_actions are all viewable by everyone)
      const postIds = posts.map((p) => p.id);
      const [{ data: rawLikes }, { data: rawComments }] = await Promise.all([
        sb.from("post_actions").select("post_id").eq("action", "like").in("post_id", postIds),
        sb.from("comments").select("post_id").in("post_id", postIds),
      ]);

      const likeCount = new Map<string, number>();
      for (const a of (rawLikes ?? []) as { post_id: string }[]) {
        likeCount.set(a.post_id, (likeCount.get(a.post_id) ?? 0) + 1);
      }
      const commentCount = new Map<string, number>();
      for (const c of (rawComments ?? []) as { post_id: string }[]) {
        commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
      }

      return posts.map((p): LandingActivityPost => ({
        id: p.id,
        type: p.type,
        title: p.title,
        body: p.body,
        created_at: p.created_at,
        author: profileMap.get(p.author_id) ?? {
          display_name: null,
          handle: null,
          avatar_url: null,
        },
        likes: likeCount.get(p.id) ?? 0,
        comments: commentCount.get(p.id) ?? 0,
      }));
    },
    staleTime: 60_000,
  });
}

export function ActivityAuthor({
  author,
  className,
}: {
  author: LandingActivityPost["author"];
  className?: string;
}) {
  const name = author.display_name || author.handle || "Member";
  // profiles.avatar_url stores a storage path — it needs a signed URL to render.
  const { data: avatarUrl } = useSignedStorageUrl("avatars", author.avatar_url);
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="text-[11px]">{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
