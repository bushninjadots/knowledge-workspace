// Creative Studios — discover projects and the creators behind them.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Search, Users, Folder, ArrowRight, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/tethyr/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stage: string;
  tags: string[];
  progress_percent: number;
  cover_url: string | null;
  is_featured: boolean;
  looking_for_collaborators: boolean;
  looking_for_feedback: boolean;
  created_at: string;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
  } | null;
};

type Creator = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  category: string | null;
  country: string | null;
};

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "Active", dot: "bg-brand-green", badge: "bg-brand-green/15 text-brand-green" },
  planning: { label: "Planning", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400" },
  paused: {
    label: "Paused",
    dot: "bg-muted-foreground/40",
    badge: "bg-muted-foreground/10 text-muted-foreground",
  },
  completed: { label: "Completed", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
};

const CATEGORIES = [
  "All",
  "Projects",
  "Design",
  "Development",
  "Video",
  "Photography",
  "Music",
  "Writing",
  "Marketing",
] as const;

type Tab = "projects" | "creators";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Tethyr" },
      {
        name: "description",
        content: "Discover projects in progress and the people building them on Tethyr.",
      },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const [tab, setTab] = useState<Tab>("projects");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["explore-projects"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, looking_for_feedback, created_at, profiles(id, handle, display_name, creator_title, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
    staleTime: 60_000,
  });

  const { data: creators, isLoading: creatorsLoading } = useQuery({
    queryKey: ["explore-creators", meId ?? "anon"],
    queryFn: async (): Promise<Creator[]> => {
      let query = supabase
        .from("profiles")
        .select("id, handle, display_name, creator_title, category, country")
        .not("display_name", "is", null)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (meId) query = query.neq("id", meId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Creator[];
    },
    staleTime: 60_000,
  });

  const filteredProjects = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      if (category !== "All" && category !== "Projects") {
        if (!p.tags.some((t) => t.toLowerCase() === category.toLowerCase())) return false;
      }
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        p.description?.toLowerCase().includes(needle) ||
        p.tags.some((t) => t.toLowerCase().includes(needle)) ||
        p.profiles?.display_name?.toLowerCase().includes(needle) ||
        p.profiles?.handle?.toLowerCase().includes(needle)
      );
    });
  }, [projects, q, category]);

  const filteredCreators = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (creators ?? []).filter((c) => {
      if (category !== "All" && category !== "Projects") {
        if (!c.category || c.category.toLowerCase() !== category.toLowerCase()) return false;
      }
      if (!needle) return true;
      return [c.handle, c.display_name, c.creator_title, c.category].some((v) =>
        (v ?? "").toLowerCase().includes(needle),
      );
    });
  }, [creators, q, category]);

  const isLoading = tab === "projects" ? projectsLoading : creatorsLoading;

  return (
    <div className="animate-room-enter mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-primary/70">Explore</p>
        <h1 className="font-display text-2xl font-semibold">What's being built right now</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Browse active projects, find people to collaborate with, and discover what the community
          is working on.
        </p>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        className="mb-4 flex items-center gap-1 rounded-2xl border border-border/60 bg-surface p-1 w-fit"
      >
        <button
          role="tab"
          aria-selected={tab === "projects"}
          onClick={() => setTab("projects")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "projects"
              ? "bg-surface-elevated text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Folder className="h-3.5 w-3.5" />
          Projects
        </button>
        <button
          role="tab"
          aria-selected={tab === "creators"}
          onClick={() => setTab("creators")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "creators"
              ? "bg-surface-elevated text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          People
        </button>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            tab === "projects"
              ? "Search projects, tags, or people…"
              : "Search by name, handle, craft…"
          }
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              category === c
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-2xl border border-border/60 bg-surface ${
                i % 3 === 0 ? "h-56" : "h-40"
              }`}
            />
          ))}
        </div>
      ) : tab === "projects" ? (
        filteredProjects.length === 0 ? (
          <EmptyState
            icon={<Compass className="h-5 w-5" />}
            title="No projects found"
            description="Try clearing filters or searching a different term."
          />
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_var(--surface)]">
            {filteredProjects.map((project, i) => {
              const creatorName =
                project.profiles?.display_name || project.profiles?.handle || "Member";
              const creatorInitial = creatorName.charAt(0).toUpperCase();
              const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
              const isLarge = project.is_featured || (project.description?.length ?? 0) > 150;
              return (
                <Link
                  key={project.id}
                  to="/projects/$id"
                  params={{ id: project.id }}
                  className={`group mb-4 block break-inside-avoid rounded-2xl border border-border/60 bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lifted animate-stagger ${
                    isLarge ? "" : ""
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {project.cover_url && (
                    <div className="relative overflow-hidden rounded-t-2xl">
                      <div className="h-36 w-full bg-surface-elevated" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${status.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      {project.looking_for_collaborators && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-medium text-brand-purple">
                          <Zap className="h-2.5 w-2.5" />
                          Open
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-sm font-semibold leading-snug">
                      {project.title}
                    </h3>
                    {project.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    {project.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {project.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-purple text-[10px] font-semibold text-background">
                        {creatorInitial}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{creatorName}</span>
                      <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : filteredCreators.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No people match yet"
          description="Try clearing filters or searching a different craft."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCreators.map((c) => {
            const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
            return (
              <Link
                key={c.id}
                to="/u/$handle"
                params={{ handle: c.handle ?? "" }}
                className="rounded-2xl border border-border/60 bg-surface p-4 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-purple text-sm font-semibold text-background">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.display_name || c.handle || "Untitled member"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.creator_title || c.category || "New member"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                  {c.handle ? <span className="truncate">@{c.handle}</span> : <span />}
                  {c.country && <span>{c.country}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
