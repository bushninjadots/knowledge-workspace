import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  Building2,
  Compass,
  FolderKanban,
  Heart,
  MessageSquare,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      const [members, projects, spaces, skills] = await Promise.all([
        count("profiles"),
        count("projects"),
        count("community_spaces"),
        count("skills"),
      ]);
      return { members, projects, spaces, skills };
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
          "id, title, description, status, tags, progress_percent, cover_url, profiles!projects_profile_id_fkey(id, handle, display_name)",
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
    (stats.members === 0 && stats.projects === 0 && stats.spaces === 0 && stats.skills === 0)
  ) {
    return null;
  }
  const items = [
    { value: stats.members.toLocaleString(), label: "Members", icon: Users },
    { value: stats.projects.toLocaleString(), label: "Projects", icon: FolderKanban },
    { value: stats.spaces.toLocaleString(), label: "Community spaces", icon: Boxes },
    { value: stats.skills.toLocaleString(), label: "Skills in the catalog", icon: Sparkles },
  ];
  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-8 sm:px-6 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="numeric font-display text-xl font-semibold leading-none">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Claim your profile",
      desc: "Add your handle, your craft, and the skills you know or want to learn. Your profile is how people find you.",
      icon: UserPlus,
      href: "/signup",
      cta: "Join Tethyr",
    },
    {
      n: "02",
      title: "Find your people",
      desc: "Explore projects, open roles, and community spaces. Follow creators and connect with people working on the same things you are.",
      icon: Compass,
      href: "/explore",
      cta: "Explore",
    },
    {
      n: "03",
      title: "Build together",
      desc: "Join a project, contribute, and share progress. The work you build together becomes part of your reputation.",
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
          Three steps to building together
        </h2>
        <p className="mt-3 text-muted-foreground">
          Tethyr is a collaborative network — people become known through what they build, not
          through profiles.
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
          <p className="section-label mb-3">Trending skills</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            What people are sharing right now
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
              Built by the community
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
          <p className="section-label mb-3">Community spaces</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Find your people
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
        {spaces.slice(0, 4).map((space) => {
          const initial = space.name.charAt(0).toUpperCase();
          return (
            <Link
              key={space.id}
              to="/community"
              className="card-border group rounded-2xl border bg-surface p-5 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated text-base font-semibold">
                {space.avatar_url ? (
                  <img
                    src={space.avatar_url}
                    alt=""
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <h3 className="mt-4 truncate font-display text-base font-semibold group-hover:text-primary">
                {space.name}
              </h3>
              {space.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {space.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {space.visibility === "private" ? "Private space" : "Community space"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
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
  return (
    <Avatar className={className}>
      {author.avatar_url ? <AvatarImage src={author.avatar_url} alt="" /> : null}
      <AvatarFallback className="text-[11px]">{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function HeroActivityPanel() {
  const { data: posts, isLoading } = useRecentActivity();

  if (isLoading) {
    return (
      <div className="hidden lg:block">
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
      </div>
    );
  }
  if (!posts || posts.length === 0) return null;
  const featured = posts.slice(0, 3);

  return (
    <div className="relative hidden lg:block">
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
                      <span className="shrink-0 text-[10px] text-muted-foreground">
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
              What's happening in the community
            </h2>
            <p className="mt-3 text-muted-foreground">
              Showcases, questions, project updates, and collaboration requests — straight from the
              feed.
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
