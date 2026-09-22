import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  BookOpen,
  Folder,
  Star,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Wrench,
  Hammer,
  Palette,
  Globe,
  ArrowRight,
  Compass,
  Swords,
  Tags,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VerificationBadge, ExperienceBadge } from "@/components/tethyr/profile-sections";
import { AvailabilityBadge } from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import { Card } from "@/components/ui/card";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
const sb = supabase;

type TabId = "overview" | "people" | "projects";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: Star },
  { id: "people", label: "People", icon: Users },
  { id: "projects", label: "Projects", icon: Folder },
];

const CATEGORY_BADGES: Record<string, { icon: typeof Wrench; color: string }> = {
  Creative: { icon: Palette, color: "border-ai/40 bg-ai/10 text-ai" },
  Development: {
    icon: Hammer,
    color:
      "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  },
  Community: { icon: Users, color: "border-trust/40 bg-trust/10 text-trust" },
};

const WORKSHOP_ICONS = [Wrench, Hammer, Palette, Sparkles, Globe];

export function SkillPage() {
  const { slug } = useParams({ from: "/skills/$slug" });
  const [tab, setTab] = useState<TabId>("overview");

  const { data: skill, isLoading: skillLoading } = useQuery({
    queryKey: ["skill", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as {
        id: string;
        slug: string;
        name: string;
        category: string;
        description: string | null;
        tools: string[];
      } | null;
    },
  });

  if (skillLoading) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl p-8">
          <div className="h-40 animate-gentle-pulse rounded-xl bg-surface/60" />
        </div>
      </Shell>
    );
  }

  if (!skill) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground">Skill not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t find a hub for &ldquo;{slug}&rdquo; yet.
            </p>
            <Link to="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
              Back to explore
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const categoryBadge = CATEGORY_BADGES[skill.category] ?? CATEGORY_BADGES["Creative"];
  const WorkshopIcon = WORKSHOP_ICONS[Math.abs(skill.name.charCodeAt(0)) % WORKSHOP_ICONS.length];

  return (
    <Shell>
      <div className="animate-room-enter mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to="/skills"
            aria-label="Back to skills directory"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-muted-foreground transition-lift hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Skills /</span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WorkshopIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">{skill.name}</h1>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${categoryBadge.color}`}
                >
                  <categoryBadge.icon className="h-2.5 w-2.5" />
                  {skill.category}
                </span>
                <span className="text-xs text-muted-foreground">Hub</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workshop divider */}
        <div className="h-px bg-border" />

        {/* Tabs — Workshop sections */}
        <div className="relative">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            ariaLabel="Skill workshop sections"
            options={TABS.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              ariaLabel: t.label,
              id: `skill-tab-${t.id}`,
              ariaControls: `skill-panel-${t.id}`,
              hideLabelOnMobile: true,
            }))}
          />
          {/* Room divider under tabs */}
          <div className="mt-2 h-px bg-border/40" />
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div id="skill-panel-overview" role="tabpanel" aria-labelledby="skill-tab-overview">
            <SkillOverview
              skillId={skill.id}
              skillName={skill.name}
              description={skill.description}
              tools={skill.tools ?? []}
            />
          </div>
        )}
        {tab === "people" && (
          <div id="skill-panel-people" role="tabpanel" aria-labelledby="skill-tab-people">
            <SkillPeople skillId={skill.id} skillName={skill.name} />
          </div>
        )}
        {tab === "projects" && (
          <div id="skill-panel-projects" role="tabpanel" aria-labelledby="skill-tab-projects">
            <SkillProjects skillId={skill.id} skillName={skill.name} />
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Overview Tab ──────────────────────────────────────────────

function SkillOverview({
  skillId,
  skillName,
  description,
  tools,
}: {
  skillId: string;
  skillName: string;
  description: string | null;
  tools: string[];
}) {
  const { data: stats } = useQuery({
    queryKey: ["skill-stats", skillId],
    queryFn: async () => {
      const [teachRes, learnRes, projectRes, endorseRes] = await Promise.all([
        sb
          .from("profile_skills_teach")
          .select("profile_id", { count: "exact", head: true })
          .eq("skill_id", skillId),
        sb
          .from("profile_skills_learn")
          .select("profile_id", { count: "exact", head: true })
          .eq("skill_id", skillId),
        sb
          .from("project_skills")
          .select("project_id", { count: "exact", head: true })
          .eq("skill_id", skillId),
        sb
          .from("skill_endorsements")
          .select("id", { count: "exact", head: true })
          .eq("skill_id", skillId),
      ]);
      return {
        teachers: teachRes.count ?? 0,
        learners: learnRes.count ?? 0,
        projects: projectRes.count ?? 0,
        endorsements: endorseRes.count ?? 0,
      };
    },
  });

  const { data: relatedSkills } = useQuery({
    queryKey: ["related-skills", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_skills")
        .select("skill_id, skills(id, name, slug, category)")
        .neq("skill_id", skillId)
        .limit(6);
      if (!data) return [];
      const seen = new Set<string>();
      return data
        .filter((r) => {
          if (seen.has(r.skill_id)) return false;
          seen.add(r.skill_id);
          return true;
        })
        .slice(0, 4)
        .map((r) => r.skills)
        .filter((s): s is { id: string; name: string; slug: string; category: string } => !!s);
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats grid — pegboard items */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<GraduationCap className="h-5 w-5 text-primary" />}
          label="Sharing"
          value={stats?.teachers ?? 0}
          delay={0}
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-ai" />}
          label="Growing"
          value={stats?.learners ?? 0}
          delay={1}
        />
        <StatCard
          icon={<Folder className="h-5 w-5 text-trust" />}
          label="Projects"
          value={stats?.projects ?? 0}
          delay={2}
        />
        <StatCard
          icon={<Star className="h-5 w-5 text-teaching" />}
          label="Endorsements"
          value={stats?.endorsements ?? 0}
          delay={3}
        />
      </div>

      {/* Workshop description */}
      <div className="rounded-xl bg-surface-elevated/30 p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">What is {skillName}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description ||
            `This is a dedicated space for ${skillName}. Browse the People tab to find people sharing and growing, or check Projects to see what's being built with this skill.`}
        </p>
        {tools.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Common tools
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tools.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated px-2.5 py-1 text-xs text-foreground transition-lift hover:border-primary/40"
                >
                  <Wrench className="h-3 w-3 text-muted-foreground" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/explore"
            search={{ tab: "creators" }}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-lift hover:bg-primary/20"
          >
            Find people sharing <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Related skills */}
      {relatedSkills && relatedSkills.length > 0 && (
        <div>
          <h3 className="font-display text-sm font-semibold text-muted-foreground mb-3">
            Related Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedSkills.map((rs) => (
              <Link
                key={rs.id}
                to="/skills/$slug"
                params={{ slug: rs.slug }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              >
                {rs.name}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delay: number;
}) {
  return (
    <Card
      className="p-4 text-center animate-room-enter"
      style={{ animationDelay: `${delay * 75}ms` }}
    >
      <div className="flex justify-center">{icon}</div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

// ── People Tab ────────────────────────────────────────────────

function SkillPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const [filter, setFilter] = useState<"teachers" | "learners">("teachers");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={filter === "teachers"}
          onClick={() => setFilter("teachers")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-lift ${
            filter === "teachers"
              ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="mr-1.5 inline h-3.5 w-3.5" />
          Sharing
        </button>
        <button
          type="button"
          aria-pressed={filter === "learners"}
          onClick={() => setFilter("learners")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-lift ${
            filter === "learners"
              ? "border-[var(--ai)]/40 bg-[var(--ai)]/10 text-[var(--ai)]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />
          Growing
        </button>
      </div>

      {/* Section divider */}
      <div className="h-px bg-border/40" />

      {filter === "teachers" ? (
        <SkillTeachers skillId={skillId} skillName={skillName} />
      ) : (
        <SkillLearners skillId={skillId} skillName={skillName} />
      )}
    </div>
  );
}

function SkillTeachers({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["skill-teachers", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_teach")
        .select(
          "profile_id, verification_level, experience_level, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-5 w-5" />}
        title="No one sharing yet"
        description={`Be the first to share ${skillName} on Tethyr.`}
        variant="skills"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((row) => {
        const p = row.profiles;
        if (!p) return null;
        const initial = (p.display_name ?? p.handle ?? "?").charAt(0).toUpperCase();
        return (
          <ProfileLink
            key={row.profile_id}
            handle={p.handle}
            className="flex items-center gap-3 rounded-xl border border-transparent bg-surface-elevated/40 p-4 transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 animate-room-enter"
            title={p.display_name || p.handle || undefined}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-background">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.display_name || p.handle || "Member"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.creator_title || "Member"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <VerificationBadge level={row.verification_level} />
                <ExperienceBadge level={row.experience_level} />
                <AvailabilityBadge status={p.availability as AvailabilityStatus} size="xs" />
              </div>
            </div>
            {/* Connection line */}
            <div className="hidden h-6 w-px bg-primary/20 sm:block" />
          </ProfileLink>
        );
      })}
    </div>
  );
}

function SkillLearners({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["skill-learners", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_learn")
        .select(
          "profile_id, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-5 w-5" />}
        title="No one growing yet"
        description={`Be the first to start growing ${skillName} on Tethyr.`}
        variant="skills"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((row) => {
        const p = row.profiles;
        if (!p) return null;
        const initial = (p.display_name ?? p.handle ?? "?").charAt(0).toUpperCase();
        return (
          <ProfileLink
            key={row.profile_id}
            handle={p.handle}
            className="flex items-center gap-3 rounded-xl border border-transparent bg-surface-elevated/40 p-4 transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 animate-room-enter"
            title={p.display_name || p.handle || undefined}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ai)] text-sm font-semibold text-background">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.display_name || p.handle || "Member"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.creator_title || "Member"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <AvailabilityBadge status={p.availability as AvailabilityStatus} size="xs" />
              </div>
            </div>
            <div className="hidden h-6 w-px bg-ai/20 sm:block" />
          </ProfileLink>
        );
      })}
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────

function SkillProjects({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["skill-projects", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_skills")
        .select(
          "project_id, projects(id, title, description, stage, looking_for_collaborators, looking_for_feedback, profile_id)",
        )
        .eq("skill_id", skillId);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Folder className="h-5 w-5" />}
        title="No projects yet"
        description={`No projects are using ${skillName} yet. Start one!`}
        actionLabel="Open your studio"
        actionHref="/profile"
        variant="projects"
      />
    );
  }

  const STAGE_LABELS: Record<string, string> = {
    planning: "Planning",
    building: "Building",
    testing: "Testing",
    launch: "Launching",
    growing: "Growing",
  };

  const STAGE_COLORS: Record<string, string> = {
    planning: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
    building: "border-primary/30 bg-primary/10 text-primary",
    testing: "border-ai/30 bg-ai/10 text-ai",
    launch: "border-trust/30 bg-trust/10 text-trust",
    growing: "border-trust/30 bg-trust/10 text-trust",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((row, i) => {
        const proj = row.projects;
        if (!proj) return null;
        return (
          <Card
            asChild
            key={row.project_id}
            className="p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Link
              to="/projects/$id"
              params={{ id: proj.id }}
              className="transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 animate-room-enter"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium" title={proj.title}>
                  {proj.title}
                </p>
                {proj.stage && (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[proj.stage] ?? STAGE_COLORS.building}`}
                  >
                    {STAGE_LABELS[proj.stage] ?? proj.stage}
                  </span>
                )}
              </div>
              {proj.description && (
                <p
                  className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                  title={proj.description ?? undefined}
                >
                  {proj.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {proj.looking_for_collaborators && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-trust/30 bg-trust/5 px-2 py-0.5 text-[11px] text-trust">
                    <Users className="h-2.5 w-2.5" />
                    Seeking collaborators
                  </span>
                )}
                {proj.looking_for_feedback && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-ai/30 bg-ai/5 px-2 py-0.5 text-[11px] text-ai">
                    Wants feedback
                  </span>
                )}
              </div>
              {/* Skill-project connection line */}
              <div className="mt-3 h-px bg-border" />
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  const navItems = [
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/skills", label: "Skills", icon: Tags },
    { to: "/challenges", label: "Challenges", icon: Swords },
  ] as const;

  return (
    <div className="min-h-screen bg-background bg-noise">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0 font-display text-lg font-semibold text-foreground">
            Tethyr
          </Link>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">Skill hub</span>
          <nav aria-label="Primary navigation" className="ml-auto flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground sm:px-3"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
            <Link
              to="/skills"
              aria-label="Browse all skills"
              className="ml-1 inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken sm:px-3"
            >
              <Menu className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Browse all skills</span>
              <ArrowRight className="hidden h-3.5 w-3.5 sm:inline" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
