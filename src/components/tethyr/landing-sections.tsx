import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  Building2,
  Compass,
  FolderKanban,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";
import { DiscoverSkills } from "./discover-skills";
import { STATUS_STYLES } from "./project-shelf/project-shelf-cover";

// ============================================================================
// Real data hooks — graceful fallbacks so the landing page never breaks
// ============================================================================

function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const count = async (table: string) => {
        try {
          const { count: c, error } = await (supabase as any)
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
