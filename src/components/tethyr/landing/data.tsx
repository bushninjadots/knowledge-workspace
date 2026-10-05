import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PostRow, PostType } from "@/hooks/use-community";
import { fetchPostEngagement } from "@/lib/post-engagement";

const sb = supabase;

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

type LandingProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[];
  progress_percent: number;
  stage: string | null;
  is_featured: boolean;
  cover_url: string | null;
  profiles: {
    handle: string | null;
    display_name: string | null;
  } | null;
};

const FEATURED_PROJECTS_SELECT =
  "id, title, description, status, stage, tags, progress_percent, is_featured, cover_url, profiles!projects_profile_id_fkey(id, handle, display_name)" as const;

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

type WorkRecordCredit = {
  role: string;
  name: string;
  handle: string | null;
};

export type WorkRecordMilestone = {
  id: string;
  title: string;
  status: string;
};

export type WorkRecord = {
  project: LandingProject;
  credits: WorkRecordCredit[];
  milestones: WorkRecordMilestone[];
};

const CREDIT_ORDER: Record<string, number> = { creator: 0, mentor: 1, contributor: 2 };

/** The hero's subject: the top featured project with who made it and what
 *  has shipped. Same ordering as the work index so the two agree. */
export async function fetchWorkRecord(): Promise<WorkRecord | null> {
  const [project] = await fetchFeaturedProjects();
  if (!project) return null;
  const [credits, milestones] = await Promise.all([
    sb
      .from("project_contributors")
      .select("role, profiles!project_contributors_profile_id_fkey(display_name, handle)")
      .eq("project_id", project.id)
      .limit(8),
    sb
      .from("project_milestones")
      .select("id, title, status")
      .eq("project_id", project.id)
      .order("position", { ascending: true })
      .limit(5),
  ]);
  type CreditRow = {
    role: string;
    profiles: { display_name: string | null; handle: string | null } | null;
  };
  return {
    project,
    credits: ((credits.data ?? []) as CreditRow[])
      .map((row) => ({
        role: row.role,
        name: row.profiles?.display_name || row.profiles?.handle || "Member",
        handle: row.profiles?.handle ?? null,
      }))
      .sort((a, b) => (CREDIT_ORDER[a.role] ?? 9) - (CREDIT_ORDER[b.role] ?? 9)),
    milestones: (milestones.data ?? []) as WorkRecordMilestone[],
  };
}

export function useWorkRecord() {
  return useHydrationStableQuery(
    useQuery({
      queryKey: ["landing-work-record"],
      queryFn: fetchWorkRecord,
      staleTime: 60_000,
    }),
  );
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
