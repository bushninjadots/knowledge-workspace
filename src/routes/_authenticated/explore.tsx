// Creative Studios — discover projects and the creators behind them.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Search, Folder, Users, Briefcase, ArrowRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ProjectShelf } from "@/components/tethyr/project-shelf/project-shelf";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";

export type ProjectRow = {
  id: string;
  profile_id: string;
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

type Tab = "projects" | "creators" | "opportunities";

type OpportunityQueryRow = {
  id: string;
  title: string;
  description: string | null;
  skills: string[] | null;
  projects: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    status: string;
    profile_id: string;
    profiles: {
      handle: string | null;
      display_name: string | null;
      creator_title: string | null;
    } | null;
  } | null;
};

type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  skills: string[];
  project: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    status: string;
    profile_id: string;
    profile: {
      handle: string | null;
      display_name: string | null;
      creator_title: string | null;
    } | null;
  };
};

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Tethyr" },
      {
        name: "description",
        content: "Discover projects, creators, and open opportunities on Tethyr.",
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
  const [category, setCategory] = useState<string>("All");
  const { data: skills = [] } = useSkillsCatalog();

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["explore-projects"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, profile_id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, looking_for_feedback, created_at, profiles!projects_profile_id_fkey(id, handle, display_name, creator_title, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ProjectRow[];
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

  const { data: contributors } = useQuery({
    queryKey: ["explore-contributors", meId ?? "anon"],
    queryFn: async (): Promise<{ project_id: string }[]> => {
      if (!meId) return [];
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("project_contributors")
        .select("project_id")
        .in("project_id", ids)
        .eq("profile_id", meId);
      if (error) throw error;
      return (data ?? []) as { project_id: string }[];
    },
    enabled: !!meId && (projects ?? []).length > 0,
    staleTime: 60_000,
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ["explore-opportunities"],
    queryFn: async (): Promise<Opportunity[]> => {
      const { data, error } = await supabase
        .from("project_open_roles")
        .select(
          "id, title, description, skills, projects(id, title, description, stage, status, profile_id, profiles(handle, display_name, creator_title))",
        )
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;

      return ((data ?? []) as unknown as OpportunityQueryRow[]).flatMap((row) => {
        const project = row.projects;
        if (!project || !["planning", "active"].includes(project.status)) return [];
        return [
          {
            id: row.id,
            title: row.title,
            description: row.description ?? null,
            skills: Array.isArray(row.skills) ? row.skills : [],
            project: {
              id: project.id,
              title: project.title,
              description: project.description ?? null,
              stage: project.stage ?? null,
              status: project.status,
              profile_id: project.profile_id,
              profile: project.profiles ?? null,
            },
          },
        ];
      });
    },
    enabled: tab === "opportunities",
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

  const contributorIds = useMemo(() => {
    if (!meId) return new Set<string>();
    return new Set((contributors ?? []).map((c) => c.project_id));
  }, [contributors, meId]);

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

  const filteredOpportunities = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      const relatedSkills = opportunity.skills.map((skill) => skill.toLowerCase());
      const skillCategories = skills
        .filter((skill) =>
          relatedSkills.some(
            (roleSkill) =>
              roleSkill === skill.name.toLowerCase() || roleSkill === skill.slug.toLowerCase(),
          ),
        )
        .map((skill) => skill.category.toLowerCase());
      const matchesCategory =
        category === "All" ||
        category === "Projects" ||
        skillCategories.some((value) => value.includes(category.toLowerCase())) ||
        opportunity.skills.some((skill) => skill.toLowerCase().includes(category.toLowerCase()));
      if (!matchesCategory) return false;
      if (!needle) return true;
      return [
        opportunity.title,
        opportunity.description,
        opportunity.project.title,
        opportunity.project.description,
        opportunity.project.profile?.display_name,
        opportunity.project.profile?.creator_title,
        ...opportunity.skills,
      ].some((value) => (value ?? "").toLowerCase().includes(needle));
    });
  }, [opportunities, skills, q, category]);

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

  const isLoading =
    tab === "projects"
      ? projectsLoading
      : tab === "creators"
        ? creatorsLoading
        : opportunitiesLoading;

  return (
    <div className="animate-room-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
        <button
          role="tab"
          aria-selected={tab === "opportunities"}
          onClick={() => setTab("opportunities")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "opportunities"
              ? "bg-surface-elevated text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Opportunities
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-4 px-4 py-6" style={{ perspective: "1200px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-48 w-64 shrink-0 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : tab === "opportunities" ? (
        filteredOpportunities.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No open opportunities match"
            description="Try a different need or check back as projects open new roles."
            actionLabel="Browse projects"
            actionHref="/explore"
            variant="projects"
          />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search roles, skills, or projects…"
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
                      : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredOpportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  to="/projects/$id"
                  params={{ id: opportunity.project.id }}
                  className="group rounded-2xl border border-border/60 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-purple">
                        <Briefcase className="h-3.5 w-3.5" />
                        Open role
                      </div>
                      <h2 className="mt-2 truncate font-display text-lg font-semibold">
                        {opportunity.title}
                      </h2>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  {opportunity.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {opportunity.description}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {opportunity.skills.length > 0 ? (
                      opportunity.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] text-primary"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> Open to a range of skills
                      </span>
                    )}
                  </div>
                  <div className="mt-5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{opportunity.project.title}</span>
                    {opportunity.project.profile?.display_name && (
                      <span> · by {opportunity.project.profile.display_name}</span>
                    )}
                    {opportunity.project.stage && (
                      <span className="ml-1 capitalize">· {opportunity.project.stage}</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs font-medium text-primary">View project and apply →</p>
                </Link>
              ))}
            </div>
          </>
        )
      ) : tab === "projects" ? (
        <ProjectShelf
          projects={filteredProjects}
          meId={meId}
          contributorIds={contributorIds}
          q={q}
          setQ={setQ}
          category={category}
          setCategory={setCategory}
        />
      ) : filteredCreators.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No people match yet"
          description="Try clearing filters or searching a different craft."
        />
      ) : (
        <>
          {/* People tab search bar */}
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, handle, craft…"
              className="border-0 bg-transparent focus-visible:ring-0"
            />
          </div>
          {/* People tab filter chips */}
          <div className="mb-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  category === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* People grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCreators.map((c) => {
              const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
              return (
                <Link
                  key={c.id}
                  to="/u/$handle"
                  params={{ handle: c.handle ?? "" }}
                  className="rounded-2xl border border-border/60 bg-surface p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
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
        </>
      )}
    </div>
  );
}
