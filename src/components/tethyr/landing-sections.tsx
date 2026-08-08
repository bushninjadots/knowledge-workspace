import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { animate, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Building2,
  Clock,
  Compass,
  FolderKanban,
  Heart,
  MessageCircle,
  MessageSquare,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";
import type { PostRow, PostType } from "@/hooks/use-community";
import { POST_TYPE_LABEL } from "@/lib/community-data";
import { timeAgo } from "@/lib/time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiscoverSkills } from "./discover-skills";
import { STATUS_STYLES } from "./project-shelf/project-shelf-cover";
import { TYPE_ACCENT, TYPE_ICON } from "./community/post-card";

// Untyped tables (posts/comments/post_actions aren't in generated types yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ============================================================================
// Real data hooks — graceful fallbacks so the landing page never breaks
// ============================================================================

/** Counts up from 0 to a real stat value once it scrolls into view. */
function AnimatedStat({ value }: { value: number }) {
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

function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const count = async (table: string) => {
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

function useFeaturedProjects() {
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

// ============================================================================
// Sections
// ============================================================================

export function LandingStats() {
  const { data: stats } = useLandingStats();
  if (
    !stats ||
    (stats.members === 0 &&
      stats.projects === 0 &&
      stats.spaces === 0 &&
      stats.skills === 0 &&
      stats.posts === 0 &&
      stats.comments === 0 &&
      stats.challenges === 0)
  ) {
    return null;
  }
  const items = [
    { value: stats.members, label: "Members", icon: Users },
    { value: stats.projects, label: "Projects", icon: FolderKanban },
    { value: stats.spaces, label: "Community spaces", icon: Boxes },
    { value: stats.skills, label: "Skills in the catalog", icon: Sparkles },
    { value: stats.posts, label: "Community posts", icon: MessageSquare },
    { value: stats.comments, label: "Comments shared", icon: MessageCircle },
    { value: stats.challenges, label: "Challenges", icon: Trophy },
  ];
  return (
    <section className="group border-y border-border/60 bg-surface/40">
      <div className="marquee-viewport overflow-hidden">
        <div className="marquee-track mx-auto flex w-max animate-marquee items-center py-8 group-hover:[animation-play-state:paused]">
          {[false, true].map((duplicate) => (
            <div
              key={duplicate ? "copy" : "original"}
              aria-hidden={duplicate}
              className="marquee-half flex items-center gap-10 pr-10"
            >
              {items.map((item) => (
                <div key={item.label} className="flex shrink-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <AnimatedStat value={item.value} />
                    <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Claim your profile",
      desc: "Add your handle, your craft, and the skills you can teach or want to learn. Your profile tells the story of what you've built.",
      icon: UserPlus,
      href: "/signup",
      cta: "Start building",
    },
    {
      n: "02",
      title: "Find collaborators",
      desc: "Explore projects, open roles, and community spaces. Connect with builders working on the same things — matched by complementary skills.",
      icon: Compass,
      href: "/explore",
      cta: "Discover",
    },
    {
      n: "03",
      title: "Build & earn recognition",
      desc: "Join a project, contribute, and share progress. Every contribution builds your reputation — recognition comes from what you make, not what you claim.",
      icon: FolderKanban,
      href: "/community",
      cta: "See the community",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-12 max-w-2xl">
        <p className="section-label mb-3">How it works</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Build, connect, get recognized
        </h2>
        <p className="mt-3 text-muted-foreground">
          Three steps from claiming your identity to earning recognition through real work — not
          résumés.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="card-border group relative overflow-hidden rounded-2xl border bg-surface p-6 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
          >
            <span className="numeric text-xs font-medium text-muted-foreground-subtle">
              {step.n}
            </span>
            <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated">
              <step.icon className="h-4 w-4 text-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            <Link
              to={step.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition group-hover:gap-2.5"
            >
              {step.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrendingSkills() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label mb-3">Trending skills</p>{" "}
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Skills people are building with right now
          </h2>
        </div>
        <Link
          to="/explore"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
        >
          Browse the catalog <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <DiscoverSkills limit={18} />
    </section>
  );
}

export function FeaturedProjects() {
  const { data: projects = [], isLoading } = useFeaturedProjects();
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (projects.length === 0) return null;

  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-3">Featured projects</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              What the community is building
            </h2>
          </div>
          <Link
            to="/explore"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
          >
            Explore projects <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const status = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="card-border group flex flex-col overflow-hidden rounded-2xl border bg-surface transition hover:border-[var(--user-accent-border,var(--border-strong))]"
              >
                <div className="relative h-36 overflow-hidden bg-surface-sunken">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="truncate font-display text-base font-semibold group-hover:text-primary">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  {p.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/60 bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs text-muted-foreground">
                      {p.profiles?.display_name || p.profiles?.handle || "Member"}
                    </span>
                    <span className="numeric text-xs text-muted-foreground">
                      {p.progress_percent ?? 0}% complete
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CommunitySpaces() {
  const { data, isLoading } = useCommunitySpaces();
  const spaces = (data ?? []) as CommunitySpace[];
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (spaces.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label mb-3">Community spaces</p>{" "}
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Spaces where builders connect
          </h2>
        </div>
        <Link
          to="/community"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
        >
          Browse spaces <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {spaces.slice(0, 4).map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </section>
  );
}

function SpaceCard({ space }: { space: CommunitySpace }) {
  const initial = space.name.charAt(0).toUpperCase();
  // community_spaces.avatar_url stores a storage path — sign it to render.
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);
  return (
    <Link
      to="/community"
      className="card-border group rounded-2xl border bg-surface p-5 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated text-base font-semibold">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
        ) : (
          initial
        )}
      </div>
      <h3 className="mt-4 truncate font-display text-base font-semibold group-hover:text-primary">
        {space.name}
      </h3>
      {space.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{space.description}</p>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        {space.visibility === "private" ? "Private space" : "Community space"}
      </div>
    </Link>
  );
}

// ============================================================================
// Real activity — recent community posts with real authors and counts
// ============================================================================

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

function useRecentActivity() {
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

      return posts.map(
        (p): LandingActivityPost => ({
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
        }),
      );
    },
    staleTime: 60_000,
  });
}

function ActivityAuthor({
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

export function HeroActivityPanel() {
  const { data: posts, isLoading } = useRecentActivity();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-3xl border border-border/60 bg-surface/80 p-5 backdrop-blur-sm">
        <div className="mb-4 h-4 w-44 rounded bg-surface-elevated" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-surface-elevated" />
              <div className="h-3 w-full rounded bg-surface-elevated" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!posts || posts.length === 0) return null;
  const featured = posts.slice(0, 3);

  return (
    <div className="card-border rounded-3xl border bg-surface/80 p-5 backdrop-blur-sm transition hover:border-[var(--user-accent-border,var(--border-strong))]">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live from the community
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {featured.map((post) => {
          const TypeIcon = TYPE_ICON[post.type];
          const name = post.author.display_name || post.author.handle || "Member";
          return (
            <Link
              key={post.id}
              to="/community"
              className="group -mx-2 rounded-xl px-2 py-2.5 transition hover:bg-surface-elevated/60"
            >
              <div className="flex items-center gap-2.5">
                <ActivityAuthor author={post.author} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      · {timeAgo(post.created_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-muted-foreground transition group-hover:text-primary">
                    {post.title}
                  </p>
                </div>{" "}
                <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${TYPE_ACCENT[post.type]}`} />
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        to="/community"
        className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/50 px-3 py-2 text-xs font-medium text-primary transition hover:bg-surface-elevated"
      >
        Open the community <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ============================================================================
// Featured project hero card — real project with real contributor count
// ============================================================================

function useContributorCount(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["landing-project-contributors", projectId],
    queryFn: async () => {
      if (!projectId) return 0;
      const { count, error } = await sb
        .from("project_contributors")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export function FeaturedHeroCard() {
  const { data: projects, isLoading } = useFeaturedProjects();
  // Show a genuinely featured project when one exists, otherwise the newest one
  // (labeled accordingly — never a misleading "Featured" badge).
  const featuredProject = projects?.find((p) => p.is_featured) ?? null;
  const latestProject = featuredProject ? null : (projects?.[0] ?? null);
  const project = featuredProject ?? latestProject;
  const isFeatured = featuredProject != null;
  const { data: contributorCount } = useContributorCount(project?.id);

  if (isLoading) {
    return (
      <div className="animate-pulse overflow-hidden rounded-3xl border border-border/60 bg-surface/80">
        <div className="h-36 bg-surface-sunken" />
        <div className="space-y-3 p-5">
          <div className="h-3 w-28 rounded bg-surface-elevated" />
          <div className="h-4 w-3/4 rounded bg-surface-elevated" />
          <div className="h-3 w-full rounded bg-surface-elevated" />
        </div>
      </div>
    );
  }
  if (!project) return null;

  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const authorName = project.profiles?.display_name || project.profiles?.handle || "Member";
  const progress = project.progress_percent ?? 0;

  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="card-border group overflow-hidden rounded-3xl border bg-surface/80 backdrop-blur-sm transition-lift hover:border-[var(--user-accent-border,var(--border-strong))]"
    >
      <div className="relative h-36 overflow-hidden bg-surface-sunken">
        {project.cover_url ? (
          <img
            src={project.cover_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isFeatured ? (
            <>
              <Star className="h-3 w-3 text-primary" /> Featured project
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 text-primary" /> Latest project
            </>
          )}
        </div>
        <h3 className="mt-2 truncate font-display text-lg font-semibold group-hover:text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">by {authorName}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {contributorCount ?? "–"} contributors
            </span>
            <span className="numeric">{progress}% complete</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function HeroShowcase() {
  return (
    <div className="relative hidden flex-col gap-6 lg:flex">
      <HeroActivityPanel />
      <FeaturedHeroCard />
    </div>
  );
}

export function RecentActivity() {
  const { data: posts, isLoading } = useRecentActivity();

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (!posts || posts.length === 0) return null;

  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-3">Real activity</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              What the community is talking about
            </h2>
            <p className="mt-3 text-muted-foreground">
              Showcases, project updates, collaboration requests, and discussions — live from
              builders across the network.
            </p>
          </div>
          <Link
            to="/community"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
          >
            Join the conversation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {posts.map((post) => {
            const TypeIcon = TYPE_ICON[post.type];
            const name = post.author.display_name || post.author.handle || "Member";
            return (
              <Link
                key={post.id}
                to="/community"
                className="card-border group flex flex-col rounded-2xl border bg-surface p-5 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
              >
                <div className="flex items-center gap-2.5">
                  <ActivityAuthor author={post.author} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                  <TypeIcon className={`h-3 w-3 ${TYPE_ACCENT[post.type]}`} />
                  <span className={TYPE_ACCENT[post.type]}>{POST_TYPE_LABEL[post.type]}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold group-hover:text-primary">
                  {post.title}
                </h3>
                {post.body && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                )}
                <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> {post.comments}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
