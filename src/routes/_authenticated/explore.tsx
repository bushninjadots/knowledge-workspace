// Creative Studios — discover projects, creators, and open opportunities.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Search,
  Folder,
  Users,
  Briefcase,
  ArrowRight,
  Sparkles,
  BadgeCheck,
  Star,
  TrendingUp,
  Hash,
  Zap,
  Hammer,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ProjectShelf } from "@/components/tethyr/project-shelf/project-shelf";
import { ApplyToRoleButton } from "@/components/tethyr/project/project-role-applications";
import { CreateProjectButton } from "@/components/tethyr/create-project-button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSkillsCatalog, useTrendingSkills } from "@/hooks/use-current-user";
import {
  NEED_BADGE,
  NEED_LABEL,
  OPPORTUNITY_NEED_CHIPS,
  PROJECT_CATEGORIES,
  STAGE_RANK,
} from "@/data/mocks/catalog";
import { jsonLd, seoMeta } from "@/lib/seo";

const OPP_FILTER_KEY = "tethyr-opportunity-filters";

type OppSortMode = "latest" | "match" | "popular";

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

type Tab = "projects" | "creators" | "opportunities";
type ExploreIntent = "build" | "contribute" | "learn" | "feedback" | null;

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

type NeedRow = {
  id: string;
  title: string;
  note: string | null;
  urgency: "low" | "normal" | "high";
  created_at: string;
  skills: { name: string } | null;
  projects: {
    id: string;
    title: string;
    status: string;
    profile_id: string;
    profiles: {
      handle: string | null;
      display_name: string | null;
    } | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => {
    const base = seoMeta({
      path: "/explore",
      title: "Explore",
      description:
        "Discover projects, builders, and open opportunities on Tethyr — the collaboration network where you get known for what you make.",
      noindex: true,
    });
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Skill discovery on Tethyr",
          description:
            "Browse creative disciplines and skills to find projects, people, and open opportunities.",
          itemListElement: PROJECT_CATEGORIES.map((category, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: category,
          })),
        }),
      ],
    };
  },
  component: ExplorePage,
});

function IntentButton({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
        pressed
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 bg-surface/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ExplorePage() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  function loadOppFilters() {
    try {
      const raw = localStorage.getItem(OPP_FILTER_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  function saveOppFilters(state: Record<string, unknown>) {
    try {
      localStorage.setItem(OPP_FILTER_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  const savedOpp = loadOppFilters();
  const [tab, setTab] = useState<Tab>("projects");
  const [intent, setIntent] = useState<ExploreIntent>(null);
  const [q, setQ] = useState((savedOpp.q as string) ?? "");
  const [category, setCategory] = useState<string>((savedOpp.category as string) ?? "All");
  const [oppSort, setOppSort] = useState<OppSortMode>((savedOpp.oppSort as OppSortMode) ?? "match");
  const [activeNeed, setActiveNeed] = useState<string>((savedOpp.activeNeed as string) ?? "");
  const { data: skills = [] } = useSkillsCatalog();

  // Persist opportunity filters
  useEffect(() => {
    if (tab === "opportunities") {
      saveOppFilters({ q, category, oppSort, activeNeed });
    }
  }, [q, category, oppSort, activeNeed, tab]);

  // Build user skill names for matching
  const mySkillNames = useMemo(() => {
    const names = new Set<string>();
    if (!me) return names;
    const allIds = new Set([...(me.teachIds ?? []), ...(me.learnIds ?? [])]);
    for (const skill of skills) {
      if (allIds.has(skill.id)) names.add(skill.name.toLowerCase());
    }
    return names;
  }, [me, skills]);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["explore-projects"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const PROJECTS_SELECT =
        "id, profile_id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, looking_for_feedback, created_at, profiles!projects_profile_id_fkey(id, handle, display_name, creator_title, avatar_url)" as const;
      const { data, error } = await supabase
        .from("projects")
        .select<typeof PROJECTS_SELECT, ProjectRow>(PROJECTS_SELECT)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      const rows = data ?? [];
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
      const OPPORTUNITIES_SELECT =
        // profiles is disambiguated via the direct FK — without it, PostgREST
        // 300s (PGRST201) because projects↔profiles also has a many-to-many
        // path through project_contributors.
        "id, title, description, skills, projects(id, title, description, stage, status, profile_id, profiles!projects_profile_id_fkey(handle, display_name, creator_title))" as const;
      const { data, error } = await supabase
        .from("project_open_roles")
        .select<typeof OPPORTUNITIES_SELECT, OpportunityQueryRow>(OPPORTUNITIES_SELECT)
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;

      return (data ?? []).flatMap((row) => {
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

  // One batched query for my application status across all visible roles —
  // avoids each Apply button firing its own query on the Opportunities tab.
  const { data: myRoleStatus = {} } = useQuery({
    queryKey: ["my-role-applications", "batch", meId ?? "anon"],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!meId) return {};
      const { data, error } = await supabase
        .from("project_role_applications")
        .select("role_id, status")
        .eq("profile_id", meId);
      if (error) return {};
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { role_id: string; status: string }[]) {
        map[row.role_id] = row.status;
      }
      return map;
    },
    enabled: !!meId && tab === "opportunities",
    staleTime: 30_000,
  });

  // Open "need help now" asks, surfaced at the top of the Opportunities tab.
  const { data: needs = [] } = useQuery({
    queryKey: ["explore-needs"],
    queryFn: async (): Promise<NeedRow[]> => {
      const { data, error } = await supabase
        .from("project_needs")
        .select(
          // profiles!projects_profile_id_fkey: disambiguate from the
          // project_contributors m2m path (PGRST201 otherwise).
          "id, title, note, urgency, created_at, skills(name), projects(id, title, status, profile_id, profiles!projects_profile_id_fkey(handle, display_name))",
        )
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      const rank = { high: 0, normal: 1, low: 2 } as const;
      return ((data ?? []) as NeedRow[])
        .filter((n) => n.projects && ["planning", "active"].includes(n.projects.status))
        .sort((a, b) => {
          const diff = rank[a.urgency] - rank[b.urgency];
          if (diff !== 0) return diff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      if (intent === "feedback" && !p.looking_for_feedback) return false;
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
  }, [projects, q, category, intent]);

  const filteredOpportunities = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = opportunities.filter((opportunity) => {
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

    // Need-based filter
    if (activeNeed) {
      const needChip = OPPORTUNITY_NEED_CHIPS.find((n) => n.label === activeNeed);
      if (needChip) {
        list = list.filter((opp) =>
          opp.skills.some((s) => needChip.skills.includes(s.toLowerCase())),
        );
      }
    }

    // Skill-match sorting
    if (oppSort === "match" && mySkillNames.size > 0) {
      list = [...list].sort((a, b) => {
        const aMatch = a.skills.filter((s) => mySkillNames.has(s.toLowerCase())).length;
        const bMatch = b.skills.filter((s) => mySkillNames.has(s.toLowerCase())).length;
        return bMatch - aMatch;
      });
    }

    // Popularity sorting — more skills + active project stage = higher ranking
    if (oppSort === "popular") {
      list = [...list].sort((a, b) => {
        const aScore = a.skills.length + (STAGE_RANK[a.project.stage ?? ""] ?? 0);
        const bScore = b.skills.length + (STAGE_RANK[b.project.stage ?? ""] ?? 0);
        return bScore - aScore;
      });
    }

    return list;
  }, [opportunities, skills, q, category, oppSort, mySkillNames, activeNeed]);

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
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto flex max-w-[90rem] gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <section
            aria-labelledby="explore-intent-heading"
            className="mb-6 border-b border-border/60 pb-5"
          >
            <p className="section-label">Choose a direction</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1
                  id="explore-intent-heading"
                  className="font-display text-2xl font-semibold tracking-tight"
                >
                  What are you here to do?
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with an intention, then find the work or people that make it possible.
                </p>
              </div>
              {intent && (
                <button
                  type="button"
                  onClick={() => setIntent(null)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear direction
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Explore intentions">
              <IntentButton
                icon={<Hammer className="h-3.5 w-3.5" />}
                label="Build something"
                pressed={intent === "build"}
                onClick={() => {
                  setIntent("build");
                  setTab("projects");
                  setCategory("Projects");
                }}
              />
              <IntentButton
                icon={<Users className="h-3.5 w-3.5" />}
                label="Contribute"
                pressed={intent === "contribute"}
                onClick={() => {
                  setIntent("contribute");
                  setTab("opportunities");
                  setCategory("All");
                }}
              />
              <IntentButton
                icon={<GraduationCap className="h-3.5 w-3.5" />}
                label="Learn with people"
                pressed={intent === "learn"}
                onClick={() => {
                  setIntent("learn");
                  setTab("creators");
                  setCategory("All");
                }}
              />
              <IntentButton
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                label="Get feedback"
                pressed={intent === "feedback"}
                onClick={() => {
                  setIntent("feedback");
                  setTab("projects");
                  setCategory("Projects");
                }}
              />
            </div>
          </section>

          {/* Tab bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Explore views"
              className="flex items-center gap-1 rounded-xl border card-border bg-surface p-1 w-fit"
            >
              <button
                type="button"
                aria-pressed={tab === "projects"}
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
                type="button"
                aria-pressed={tab === "creators"}
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
                type="button"
                aria-pressed={tab === "opportunities"}
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
            <CreateProjectButton label="Create project" className="rounded-full" />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-4 px-4 py-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-48 w-64 shrink-0 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : tab === "opportunities" ? (
            <>
              {needs.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-destructive" />
                    <h2 className="text-sm font-semibold">Needs now</h2>
                    <span className="text-xs text-muted-foreground">
                      Urgent asks from projects looking for help
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {needs.slice(0, 6).map((n) => (
                      <Link
                        key={n.id}
                        to="/projects/$id"
                        params={{ id: n.projects!.id }}
                        className="group flex items-start justify-between gap-3 rounded-xl border card-border bg-surface p-3 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-primary">
                            {n.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {n.projects?.title}
                            {n.projects?.profiles?.display_name
                              ? ` · by ${n.projects.profiles.display_name}`
                              : ""}
                          </p>
                          {n.skills?.name && (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                mySkillNames.has(n.skills.name.toLowerCase())
                                  ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
                                  : "border-brand-purple/30 bg-brand-purple/5 text-brand-purple"
                              }`}
                            >
                              {n.skills.name}
                              {mySkillNames.has(n.skills.name.toLowerCase()) && (
                                <BadgeCheck className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${NEED_BADGE[n.urgency]}`}
                        >
                          {NEED_LABEL[n.urgency]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {filteredOpportunities.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="h-5 w-5" />}
                  title="No open opportunities match"
                  description="Try a different need or check back as projects open new roles."
                  actionLabel="Browse projects"
                  onAction={() => setTab("projects")}
                  variant="projects"
                />
              ) : (
                <>
                  {/* Browse by need — quick chips */}
                  <div className="mb-4">
                    <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Browse by need
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {OPPORTUNITY_NEED_CHIPS.map((need) => (
                        <button
                          key={need.label}
                          type="button"
                          aria-pressed={activeNeed === need.label}
                          onClick={() => setActiveNeed(activeNeed === need.label ? "" : need.label)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            activeNeed === need.label
                              ? "border-[var(--user-accent,var(--primary))] bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
                              : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                          }`}
                        >
                          Need {need.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search + Sort */}
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search roles, skills, or projects…"
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border card-border bg-surface p-0.5">
                      <button
                        type="button"
                        aria-pressed={oppSort === "latest"}
                        onClick={() => setOppSort("latest")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          oppSort === "latest"
                            ? "bg-surface-elevated text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Latest
                      </button>
                      <button
                        type="button"
                        aria-pressed={oppSort === "popular"}
                        onClick={() => setOppSort("popular")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          oppSort === "popular"
                            ? "bg-surface-elevated text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TrendingUp className="mr-1 inline h-3 w-3" />
                        Popular
                      </button>
                      <button
                        type="button"
                        aria-pressed={oppSort === "match"}
                        onClick={() => setOppSort("match")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          oppSort === "match"
                            ? "bg-surface-elevated text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Star className="mr-1 inline h-3 w-3" />
                        Best match
                      </button>
                    </div>
                  </div>

                  {/* Applied filters */}
                  {(activeNeed || oppSort !== "latest" || (q && tab === "opportunities")) && (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      {activeNeed && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-2 py-0.5 text-[11px] text-[var(--user-accent,var(--primary))]">
                          Need {activeNeed}
                          <button
                            type="button"
                            onClick={() => setActiveNeed("")}
                            aria-label={`Remove ${activeNeed} filter`}
                            className="ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {oppSort === "popular" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[11px] text-brand-green">
                          <TrendingUp className="h-3 w-3" />
                          Popular first
                        </span>
                      )}
                      {oppSort === "match" && (
                        <span className="text-[11px] text-muted-foreground">
                          Sorted by skill match
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mb-4 flex flex-wrap gap-2">
                    {PROJECT_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
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
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredOpportunities.map((opportunity, i) => {
                      const skillMatchCount =
                        oppSort === "match"
                          ? opportunity.skills.filter((s) => mySkillNames.has(s.toLowerCase()))
                              .length
                          : 0;
                      return (
                        <div
                          key={opportunity.id}
                          className="animate-room-enter group rounded-xl border card-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <Link
                            to="/projects/$id"
                            params={{ id: opportunity.project.id }}
                            search={{ tab: "people" } as Record<string, string>}
                            className="block"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs uppercase tracking-wider text-brand-purple">
                                    <Briefcase className="mr-1 inline h-3.5 w-3.5" />
                                    Open role
                                  </span>
                                  {skillMatchCount > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-1.5 py-0 text-[11px] font-medium text-[var(--user-accent,var(--primary))]">
                                      <BadgeCheck className="h-3 w-3" />
                                      {skillMatchCount} match{skillMatchCount !== 1 ? "es" : ""}
                                    </span>
                                  )}
                                </div>
                                <h2
                                  className="mt-2 truncate font-display text-lg font-semibold"
                                  title={opportunity.title}
                                >
                                  {opportunity.title}
                                </h2>
                              </div>
                              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                            {opportunity.description && (
                              <p
                                className="mt-2 line-clamp-2 text-sm text-muted-foreground"
                                title={opportunity.description ?? undefined}
                              >
                                {opportunity.description}
                              </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {opportunity.skills.length > 0 ? (
                                opportunity.skills.map((skill) => {
                                  const isMySkill = mySkillNames.has(skill.toLowerCase());
                                  return (
                                    <span
                                      key={skill}
                                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                        isMySkill
                                          ? "border-[var(--user-accent,var(--primary))]/25 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
                                          : "border-primary/25 bg-primary/5 text-primary"
                                      }`}
                                    >
                                      {skill}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Sparkles className="h-3 w-3" /> Open to a range of skills
                                </span>
                              )}
                            </div>
                          </Link>{" "}
                          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                            <div className="min-w-0 truncate text-xs text-muted-foreground">
                              <Link
                                to="/projects/$id"
                                params={{ id: opportunity.project.id }}
                                search={{ tab: "people" } as Record<string, string>}
                                className="font-medium text-foreground hover:underline"
                              >
                                {opportunity.project.title}
                              </Link>
                              {opportunity.project.profile?.display_name && (
                                <span> · by {opportunity.project.profile.display_name}</span>
                              )}
                              {opportunity.project.stage && (
                                <span className="ml-1 capitalize">
                                  · {opportunity.project.stage}
                                </span>
                              )}
                            </div>
                            <ApplyToRoleButton
                              roleId={opportunity.id}
                              projectId={opportunity.project.id}
                              isOwner={opportunity.project.profile_id === meId}
                              meId={meId}
                              myStatus={myRoleStatus[opportunity.id] ?? null}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
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
              <div className="mb-4 flex items-center gap-2 rounded-xl border card-border bg-surface px-3 py-2">
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
                {PROJECT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCreators.map((c, i) => {
                  const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
                  return (
                    <Link
                      key={c.id}
                      to="/u/$handle"
                      params={{ handle: c.handle ?? "" }}
                      className="animate-room-enter rounded-xl border card-border bg-surface p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-purple text-sm font-semibold text-background">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-medium"
                            title={c.display_name || c.handle || undefined}
                          >
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

        {/* Right sidebar — Discover panel */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <DiscoverSidebar tab={tab} />
        </aside>
      </div>
    </div>
  );
}

// ── Discover Sidebar ──────────────────────────────────────────

function DiscoverSidebar({ tab }: { tab: Tab }) {
  const { data: stats } = useQuery({
    queryKey: ["discover-sidebar-stats"],
    queryFn: async () => {
      const [projects, creators, skills, opportunities] = await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("skills")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("project_open_roles")
          .select("id", { count: "exact", head: true })
          .eq("is_filled", false)
          .then(({ count }) => count ?? 0),
      ]);
      return { projects, creators, skills, opportunities };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Ranked by real usage (teach/learn/project references), not catalog insert
  // order — the old query surfaced the most-recently-added catalog batch
  // (a wall of wellness skills) instead of what the community actually uses.
  const { data: trendingSkills = [] } = useTrendingSkills();

  return (
    <div className="sticky top-24 space-y-5">
      {/* Stats card */}
      <div className="rounded-xl border card-border bg-surface/60 p-4 backdrop-blur-sm">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick stats
        </h3>
        <div className="mt-3 space-y-2">
          <StatRow
            icon={<Folder className="h-3.5 w-3.5" />}
            label="Projects"
            value={stats?.projects}
          />
          <StatRow
            icon={<Users className="h-3.5 w-3.5" />}
            label="Creators"
            value={stats?.creators}
          />
          <StatRow
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Open roles"
            value={stats?.opportunities}
          />
          <StatRow
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Skills"
            value={stats?.skills}
          />
        </div>
      </div>

      {/* Trending skills */}
      {trendingSkills && trendingSkills.length > 0 && (
        <div className="rounded-xl border card-border bg-surface/60 p-4 backdrop-blur-sm">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            Trending skills
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trendingSkills.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to="/skills/$slug"
                params={{ slug: s.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground hover:bg-surface-elevated"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Contextual hint based on tab */}
      <div className="rounded-xl border border-dashed border-border/40 bg-surface/30 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {tab === "projects"
            ? "Browse projects from the community. Use the shelf to flip through covers, or search for something specific."
            : tab === "creators"
              ? "Find people to collaborate with. Filter by craft or search by name."
              : "Open roles waiting for someone like you. Match based on your skills."}
        </p>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="numeric font-medium tabular-nums text-foreground">
        {value != null ? value.toLocaleString() : "–"}
      </span>
    </div>
  );
}
