import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PostRow, PostType } from "@/hooks/use-community";
import { fetchPostEngagement } from "@/lib/post-engagement";

const sb = supabase;

type LandingCountTable =
  "profiles" | "projects" | "community_spaces" | "skills" | "posts" | "comments" | "challenges";

/** Counts up from 0 to a real stat value once it scrolls into view. */
export function AnimatedStat({ value }: { value: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [inView, setInView] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    // If the stat is already in the viewport on mount (e.g. above the fold),
    // start animating immediately instead of flashing "0" until the observer fires.
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setInView(true);
        return;
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "-40px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 1200, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, prefersReducedMotion, value]);

  return (
    <p ref={ref} className="numeric font-display text-xl font-semibold leading-none">
      {display.toLocaleString()}
    </p>
  );
}

// The fetchers are exported separately so the landing route loader can
// prefetch them server-side (content streams with the HTML instead of
// flashing skeletons, and the client skips the refetch on hydration).
export async function fetchLandingStats() {
  const count = async (table: LandingCountTable) => {
    try {
      const { count: c, error } = await sb.from(table).select("id", { count: "exact", head: true });
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
}

/**
 * True only after the first client render (post-hydration).
 */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * Hydration parity for the landing sections. The route streams its HTML and
 * serializes the query cache at different moments, so the server paints these
 * sections in their loading/empty state (dehydrate also only includes queries
 * that have already succeeded). A warm client cache can then resolve *during*
 * concurrent hydration and render real content where the server rendered a
 * skeleton, which React reports as a hydration mismatch. Withholding the data
 * until after mount keeps the client's first render identical to the server's,
 * then the real content appears in the same tick the effect runs.
 */
function useHydrationStableQuery<T extends { data: unknown; isLoading: boolean }>(query: T): T {
  const hydrated = useHydrated();
  if (hydrated) return query;
  return { ...query, data: undefined, isLoading: true } as T;
}

export function useLandingStats() {
  return useHydrationStableQuery(
    useQuery({
      queryKey: ["landing-stats"],
      queryFn: fetchLandingStats,
      staleTime: 5 * 60 * 1000,
    }),
  );
}

type LandingProject = {
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

const FEATURED_PROJECTS_SELECT =
  "id, title, description, status, tags, progress_percent, is_featured, cover_url, profiles!projects_profile_id_fkey(id, handle, display_name)" as const;

export async function fetchFeaturedProjects(): Promise<LandingProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select<typeof FEATURED_PROJECTS_SELECT, LandingProject>(FEATURED_PROJECTS_SELECT)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  // cover_url stays a raw storage path; signed URLs are resolved client-side
  // via useSignedStorageUrl so the server HTML and the hydrated client always
  // match (storage sign tokens differ on every generation).
  return (data ?? []) as LandingProject[];
}

export function useFeaturedProjects() {
  return useHydrationStableQuery(
    useQuery({
      queryKey: ["landing-featured-projects"],
      queryFn: fetchFeaturedProjects,
      staleTime: 60_000,
    }),
  );
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

type LandingActivityPost = {
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

export async function fetchRecentActivity(): Promise<LandingActivityPost[]> {
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

  const postIds = posts.map((p) => p.id);
  const engagement = await fetchPostEngagement(postIds, null);

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
    likes: engagement.get(p.id)?.likes ?? 0,
    comments: engagement.get(p.id)?.comment_count ?? 0,
  }));
}

export function useRecentActivity() {
  return useHydrationStableQuery(
    useQuery({
      queryKey: ["landing-activity"],
      queryFn: fetchRecentActivity,
      staleTime: 60_000,
    }),
  );
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
