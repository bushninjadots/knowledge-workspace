// Skill ecosystem page at /skills/:slug. Each skill becomes a creative
// workshop — a dedicated learning space with teachers, learners, and projects.
import { useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VerificationBadge, ExperienceBadge } from "@/components/tethyr/profile-sections";
import { AvailabilityBadge } from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { EmptyState } from "@/components/tethyr/empty-state";

const sb = supabase as any;

export const Route = createFileRoute("/skills/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Tethyr` },
      {
        name: "description",
        content: `Enter ${params.slug} on Tethyr — find people sharing, growing, and discover projects.`,
      },
    ],
  }),
  component: SkillPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Skill not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to explore
        </Link>
      </div>
    </div>
  ),
});

type TabId = "overview" | "people" | "projects";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: Star },
  { id: "people", label: "People", icon: Users },
  { id: "projects", label: "Projects", icon: Folder },
];

const CATEGORY_BADGES: Record<string, { icon: typeof Wrench; color: string }> = {
  Creative: { icon: Palette, color: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple" },
  Development: {
    icon: Hammer,
    color:
      "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  },
  Community: { icon: Users, color: "border-brand-green/40 bg-brand-green/10 text-brand-green" },
};

const WORKSHOP_ICONS = [Wrench, Hammer, Palette, Sparkles, Globe];

function SkillPage() {
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
          <div className="h-40 animate-pulse rounded-xl bg-surface/60" />
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
            to="/explore"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
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
        <div className="h-px bg-gradient-to-r from-primary/20 via-border to-brand-purple/20" />

        {/* Tabs — Workshop sections */}
        <div className="relative">
          <div className="flex gap-1 rounded-xl border border-border/60 bg-surface p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-surface-elevated text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>
          {/* Room divider under tabs */}
          <div className="mt-2 h-px bg-border/40" />
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <SkillOverview
            skillId={skill.id}
            skillName={skill.name}
            description={skill.description}
            tools={skill.tools ?? []}
          />
        )}
        {tab === "people" && <SkillPeople skillId={skill.id} skillName={skill.name} />}
        {tab === "projects" && <SkillProjects skillId={skill.id} skillName={skill.name} />}
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
      return (data as any[])
        .filter((r) => {
          if (seen.has(r.skill_id)) return false;
          seen.add(r.skill_id);
          return true;
        })
        .slice(0, 4)
        .map((r) => r.skills) as { id: string; name: string; slug: string; category: string }[];
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
          icon={<BookOpen className="h-5 w-5 text-brand-purple" />}
          label="Growing"
          value={stats?.learners ?? 0}
          delay={1}
        />
        <StatCard
          icon={<Folder className="h-5 w-5 text-brand-green" />}
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
      <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated px-2.5 py-1 text-xs text-foreground transition hover:border-primary/40"
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
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
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
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
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
    <div
      className="card-border rounded-xl border bg-surface p-4 text-center shadow-sm transition hover:shadow-md animate-room-enter"
      style={{ animationDelay: `${delay * 75}ms` }}
    >
      <div className="flex justify-center">{icon}</div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── People Tab ────────────────────────────────────────────────

function SkillPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const [filter, setFilter] = useState<"teachers" | "learners">("teachers");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("teachers")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            filter === "teachers"
              ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="mr-1.5 inline h-3.5 w-3.5" />
          Sharing
        </button>
        <button
          onClick={() => setFilter("learners")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            filter === "learners"
              ? "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]"
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
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface/60" />
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
      {data.map((row, i) => {
        const p = row.profiles;
        if (!p) return null;
        const initial = (p.display_name ?? p.handle ?? "?").charAt(0).toUpperCase();
        return (
          <Link
            key={row.profile_id}
            to="/u/$handle"
            params={{ handle: p.handle ?? "" }}
            className="card-border flex items-center gap-3 rounded-xl border bg-surface p-4 transition-all duration-200 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md hover:-translate-y-0.5 animate-room-enter"
            style={{ animationDelay: `${i * 60}ms` }}
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
          </Link>
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
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface/60" />
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
      {data.map((row, i) => {
        const p = row.profiles;
        if (!p) return null;
        const initial = (p.display_name ?? p.handle ?? "?").charAt(0).toUpperCase();
        return (
          <Link
            key={row.profile_id}
            to="/u/$handle"
            params={{ handle: p.handle ?? "" }}
            className="card-border flex items-center gap-3 rounded-xl border bg-surface p-4 transition-all duration-200 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md hover:-translate-y-0.5 animate-room-enter"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-purple)] text-sm font-semibold text-background">
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
            <div className="hidden h-6 w-px bg-brand-purple/20 sm:block" />
          </Link>
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
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface/60" />
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
    testing: "border-brand-purple/30 bg-brand-purple/10 text-brand-purple",
    launch: "border-brand-green/30 bg-brand-green/10 text-brand-green",
    growing: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((row, i) => {
        const proj = row.projects;
        if (!proj) return null;
        return (
          <Link
            key={row.project_id}
            to="/projects/$id"
            params={{ id: proj.id }}
            className="card-border rounded-xl border bg-surface p-4 transition-all duration-200 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md hover:-translate-y-0.5 animate-room-enter"
            style={{ animationDelay: `${i * 60}ms` }}
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
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[11px] text-brand-green">
                  <Users className="h-2.5 w-2.5" />
                  Seeking collaborators
                </span>
              )}
              {proj.looking_for_feedback && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-purple/30 bg-brand-purple/5 px-2 py-0.5 text-[11px] text-brand-purple">
                  Wants feedback
                </span>
              )}
            </div>
            {/* Skill-project connection line */}
            <div className="mt-3 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          </Link>
        );
      })}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-noise">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          Tethyr
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Hub</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
