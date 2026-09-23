import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Folder,
  GraduationCap,
  Hammer,
  Palette,
  Sparkles,
  Star,
  Users,
  Wrench,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VerificationBadge, ExperienceBadge } from "@/components/tethyr/profile-sections";
import { AvailabilityBadge } from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { SectionShell } from "@/components/tethyr/section-shell";
import { fetchSkillBySlug, skillQueryKey } from "./-skills.$slug-data";

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

const URGENCY_LABELS: Record<string, string> = {
  low: "Low priority",
  normal: "Open need",
  high: "Urgent",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
  normal: "border-trust/30 bg-trust/10 text-trust",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
};

type HubStats = {
  sharing: number;
  growing: number;
  projects: number;
  needs: number;
  endorsements: number;
};

type SharingRow = {
  profile_id: string;
  verification_level: "self_declared" | "proof_certified" | "community_recognized" | null;
  experience_level: "beginner" | "intermediate" | "advanced" | "expert" | null;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
    country: string | null;
    timezone: string | null;
    availability: string | null;
  } | null;
};

type GrowingRow = {
  profile_id: string;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
    country: string | null;
    timezone: string | null;
    availability: string | null;
  } | null;
};

type SkillProjectRow = {
  project_id: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    looking_for_collaborators: boolean;
    looking_for_feedback: boolean;
  } | null;
};

type SkillNeedRow = {
  id: string;
  title: string;
  note: string | null;
  urgency: string;
  project_id: string;
  projects: {
    id: string;
    title: string;
    stage: string | null;
  } | null;
};

// ── Shared queries ────────────────────────────────────────────
// Overview previews and the People/Projects tabs read the *same* query keys,
// so switching tabs never refetches — the overview warms the tab data.

function useHubStats(skillId: string | undefined) {
  return useQuery({
    queryKey: ["skill-stats", skillId ?? "none"],
    enabled: Boolean(skillId),
    queryFn: async (): Promise<HubStats> => {
      const [{ data: stats }, { count: endorseCount }] = await Promise.all([
        sb.rpc("skill_directory_stats", { p_skill_ids: [skillId!] }),
        sb
          .from("skill_endorsements")
          .select("id", { count: "exact", head: true })
          .eq("skill_id", skillId!),
      ]);
      const row = (stats ?? [])[0];
      return {
        sharing: Number(row?.sharing_count ?? 0),
        growing: Number(row?.growing_count ?? 0),
        projects: Number(row?.project_count ?? 0),
        needs: Number(row?.need_count ?? 0),
        endorsements: endorseCount ?? 0,
      };
    },
  });
}

function useSharingPeople(skillId: string) {
  return useQuery({
    queryKey: ["skill-sharing-people", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_teach")
        .select(
          "profile_id, verification_level, experience_level, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return (data ?? []) as SharingRow[];
    },
  });
}

function useGrowingPeople(skillId: string) {
  return useQuery({
    queryKey: ["skill-growing-people", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_learn")
        .select(
          "profile_id, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return (data ?? []) as GrowingRow[];
    },
  });
}

function useSkillProjects(skillId: string) {
  return useQuery({
    queryKey: ["skill-projects", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_skills")
        .select(
          "project_id, projects(id, title, description, stage, looking_for_collaborators, looking_for_feedback, profile_id)",
        )
        .eq("skill_id", skillId);
      return (data ?? []) as SkillProjectRow[];
    },
  });
}

function useSkillNeeds(skillId: string) {
  return useQuery({
    queryKey: ["skill-needs", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_needs")
        .select("id, title, note, urgency, project_id, projects(id, title, stage)")
        .eq("skill_id", skillId)
        .eq("is_filled", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as SkillNeedRow[];
    },
  });
}

/**
 * Related skills = skills that co-occur with this one on shared projects.
 * That is a real relationship signal (worked together / used together), not
 * "whichever project_skills rows happened to be returned first".
 */
function useRelatedSkills(skillId: string) {
  return useQuery({
    queryKey: ["skill-related", skillId],
    queryFn: async () => {
      const { data: projectRows } = await sb
        .from("project_skills")
        .select("project_id")
        .eq("skill_id", skillId);
      const projectIds = [...new Set((projectRows ?? []).map((row) => row.project_id))].slice(
        0,
        24,
      );
      if (projectIds.length === 0) return [];
      const { data: rows } = await sb
        .from("project_skills")
        .select("skill_id, skills(id, name, slug, category)")
        .neq("skill_id", skillId)
        .in("project_id", projectIds);
      const frequency = new Map<string, number>();
      const byId = new Map<string, { id: string; name: string; slug: string; category: string }>();
      for (const row of rows ?? []) {
        frequency.set(row.skill_id, (frequency.get(row.skill_id) ?? 0) + 1);
        if (row.skills) byId.set(row.skill_id, row.skills);
      }
      return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => byId.get(id))
        .filter((skill): skill is { id: string; name: string; slug: string; category: string } =>
          Boolean(skill),
        );
    },
  });
}

// ── Page ──────────────────────────────────────────────────────

export function SkillPage() {
  const { slug } = useParams({ from: "/skills/$slug" });
  const [tab, setTab] = useState<TabId>("overview");

  const { data: skill, isLoading: skillLoading } = useQuery({
    queryKey: skillQueryKey(slug),
    queryFn: () => fetchSkillBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });

  // Kept outside the early returns so hook order stays stable while the skill
  // loads; disabled until we know the id.
  const stats = useHubStats(skill?.id);

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
        {/* Header — the frame's Back button handles going back */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WorkshopIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{skill.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${categoryBadge.color}`}
              >
                <categoryBadge.icon className="h-2.5 w-2.5" />
                {skill.category}
              </span>
              <span className="text-xs text-muted-foreground">Hub</span>
            </div>
            {stats.data && (
              <p className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                {formatSummary(stats.data)}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Tabs — Skill hub sections */}
        <div className="relative">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            ariaLabel="Skill hub sections"
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
          <div className="mt-2 h-px bg-border/40" />
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div id="skill-panel-overview" role="tabpanel" aria-labelledby="skill-tab-overview">
            <h2 className="sr-only">Overview</h2>
            <SkillOverview
              skillId={skill.id}
              skillName={skill.name}
              description={skill.description}
              tools={skill.tools ?? []}
              stats={stats.data}
              onShowPeople={() => setTab("people")}
              onShowProjects={() => setTab("projects")}
            />
          </div>
        )}
        {tab === "people" && (
          <div id="skill-panel-people" role="tabpanel" aria-labelledby="skill-tab-people">
            <h2 className="sr-only">People</h2>
            <SkillPeople skillId={skill.id} skillName={skill.name} />
          </div>
        )}
        {tab === "projects" && (
          <div id="skill-panel-projects" role="tabpanel" aria-labelledby="skill-tab-projects">
            <h2 className="sr-only">Projects</h2>
            <SkillProjects skillId={skill.id} skillName={skill.name} />
          </div>
        )}
      </div>
    </Shell>
  );
}

function formatSummary(stats: HubStats) {
  const parts: string[] = [];
  if (stats.sharing > 0) parts.push(`${stats.sharing} sharing`);
  if (stats.growing > 0) parts.push(`${stats.growing} growing`);
  if (stats.projects > 0) parts.push(`${stats.projects} projects`);
  return parts.length > 0 ? parts.join(" · ") : "No activity yet";
}

// ── Overview Tab ──────────────────────────────────────────────

function SkillOverview({
  skillId,
  skillName,
  description,
  tools,
  stats,
  onShowPeople,
  onShowProjects,
}: {
  skillId: string;
  skillName: string;
  description: string | null;
  tools: string[];
  stats: HubStats | undefined;
  onShowPeople: () => void;
  onShowProjects: () => void;
}) {
  const sharing = useSharingPeople(skillId);
  const growing = useGrowingPeople(skillId);
  const projects = useSkillProjects(skillId);
  const needs = useSkillNeeds(skillId);
  const relatedSkills = useRelatedSkills(skillId);

  const sharingPeople = (sharing.data ?? []).filter((row) => row.profiles).slice(0, 3);
  const growingPeople = (growing.data ?? []).filter((row) => row.profiles).slice(0, 3);
  const projectRows = (projects.data ?? []).filter((row) => row.projects).slice(0, 2);
  const openNeeds = (needs.data ?? []).filter((need) => need.projects);

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<GraduationCap className="h-5 w-5 text-primary" />}
          label="Sharing"
          value={stats?.sharing ?? 0}
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-ai" />}
          label="Growing"
          value={stats?.growing ?? 0}
        />
        <StatCard
          icon={<Folder className="h-5 w-5 text-trust" />}
          label="Projects"
          value={stats?.projects ?? 0}
        />
        <StatCard
          icon={<Star className="h-5 w-5 text-teaching" />}
          label="Endorsements"
          value={stats?.endorsements ?? 0}
        />
      </div>

      {/* What is this skill? */}
      <section
        aria-labelledby="overview-whatis"
        className="rounded-xl bg-surface-elevated/30 p-4 sm:p-5"
      >
        <h3 id="overview-whatis" className="font-display text-lg font-semibold">
          What is {skillName}?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description ||
            `This is a dedicated hub for ${skillName}. Find people sharing and growing it, or check the projects using it — and the ones looking for it.`}
        </p>
        {tools.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Common tools
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tools.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated px-2.5 py-1 text-xs text-foreground transition-lift hover:border-primary/40"
                >
                  <Wrench className="h-3 w-3 text-muted-foreground" />
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            to="/explore"
            search={{ tab: "creators" }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Find people sharing <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onShowProjects}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            See projects using {skillName} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* People preview */}
      <section aria-labelledby="overview-people">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="overview-people" className="font-display text-base font-semibold">
            People
          </h3>
          <button
            type="button"
            onClick={onShowPeople}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PeoplePreviewColumn
            title="Sharing"
            description="Can contribute, teach, or collaborate around this skill"
            icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
            accentClass="bg-primary"
            people={sharingPeople.map((row) => row.profiles!)}
            emptyText={`No one sharing ${skillName} yet`}
          />
          <PeoplePreviewColumn
            title="Growing"
            description="People currently developing this skill"
            icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            accentClass="bg-[var(--ai)]"
            people={growingPeople.map((row) => row.profiles!)}
            emptyText={`No one growing ${skillName} yet`}
          />
        </div>
      </section>

      {/* Projects preview */}
      <section aria-labelledby="overview-projects">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="overview-projects" className="font-display text-base font-semibold">
            Projects using {skillName}
          </h3>
          <button
            type="button"
            onClick={onShowProjects}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
        {projectRows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {projectRows.map((row) => (
              <ProjectTile key={row.project_id} row={row as SkillProjectRow} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border/60 bg-surface/30 px-4 py-6 text-sm text-muted-foreground">
            No projects are using {skillName} yet.{" "}
            {sharingPeople.length > 0 ? "Start one." : "Be the first."}
          </p>
        )}
      </section>

      {/* Opportunities — projects looking for this skill */}
      {openNeeds.length > 0 && (
        <section aria-labelledby="overview-needs">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-trust" aria-hidden="true" />
            <h3 id="overview-needs" className="font-display text-base font-semibold">
              Projects that need {skillName}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {openNeeds.map((need) => (
              <NeedRow key={need.id} need={need} />
            ))}
          </div>
        </section>
      )}

      {/* Related skills */}
      {relatedSkills.data && relatedSkills.data.length > 0 && (
        <section aria-labelledby="overview-related">
          <h3 id="overview-related" className="font-display text-base font-semibold">
            Related skills
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedSkills.data.map((related) => (
              <Link
                key={related.id}
                to="/skills/$slug"
                params={{ slug: related.slug }}
                preload="intent"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              >
                {related.name}
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const { ref, value: count } = useCountUp(value);
  return (
    <Card className="p-4 text-center animate-room-enter">
      <div className="flex justify-center">{icon}</div>
      <p ref={ref} className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {count}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

type PreviewPerson = {
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  availability: string | null;
};

function PeoplePreviewColumn({
  title,
  description,
  icon,
  accentClass,
  people,
  emptyText,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  people: PreviewPerson[];
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md text-background ${accentClass}`}
        >
          {icon}
        </span>
        {title}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 space-y-0.5">
        {people.length > 0 ? (
          people.map((person) => (
            <CompactPersonRow
              key={person.handle ?? "?"}
              person={person}
              accentClass={accentClass}
            />
          ))
        ) : (
          <p className="px-1 py-3 text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function CompactPersonRow({ person, accentClass }: { person: PreviewPerson; accentClass: string }) {
  const name = person.display_name ?? person.handle ?? "Member";
  const initial = name.charAt(0).toUpperCase();
  return (
    <ProfileLink
      handle={person.handle}
      title={name}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-sunken"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-background ${accentClass}`}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {person.creator_title || "Member"}
        </span>
      </span>
      <AvailabilityBadge status={person.availability as AvailabilityStatus} size="xs" />
    </ProfileLink>
  );
}

// ── People Tab ────────────────────────────────────────────────

function SkillPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const [filter, setFilter] = useState<"sharing" | "growing">("sharing");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={filter === "sharing"}
          onClick={() => setFilter("sharing")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-lift ${
            filter === "sharing"
              ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Sharing
        </button>
        <button
          type="button"
          aria-pressed={filter === "growing"}
          onClick={() => setFilter("growing")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-lift ${
            filter === "growing"
              ? "border-[var(--ai)]/40 bg-[var(--ai)]/10 text-[var(--ai)]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Growing
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {filter === "sharing"
          ? `People who share ${skillName} can contribute, teach, or collaborate around it.`
          : `People growing ${skillName} are developing it right now.`}
      </p>

      {/* Section divider */}
      <div className="h-px bg-border/40" />

      {filter === "sharing" ? (
        <SkillSharingPeople skillId={skillId} skillName={skillName} />
      ) : (
        <SkillGrowingPeople skillId={skillId} skillName={skillName} />
      )}
    </div>
  );
}

function SkillSharingPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useSharingPeople(skillId);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  const rows = (data ?? []).filter((row) => row.profiles);
  if (rows.length === 0) {
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
      {rows.map((row) => {
        const p = row.profiles!;
        const name = p.display_name ?? p.handle ?? "Member";
        const initial = name.charAt(0).toUpperCase();
        return (
          <ProfileLink
            key={row.profile_id}
            handle={p.handle}
            className="flex items-center gap-3 rounded-xl border border-transparent bg-surface-elevated/40 p-4 transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 animate-room-enter"
            title={name}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-background">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.creator_title || "Member"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.verification_level && <VerificationBadge level={row.verification_level} />}
                {row.experience_level && <ExperienceBadge level={row.experience_level} />}
                <AvailabilityBadge status={p.availability as AvailabilityStatus} size="xs" />
              </div>
            </div>
            <div className="hidden h-6 w-px bg-primary/20 sm:block" aria-hidden="true" />
          </ProfileLink>
        );
      })}
    </div>
  );
}

function SkillGrowingPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useGrowingPeople(skillId);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  const rows = (data ?? []).filter((row) => row.profiles);
  if (rows.length === 0) {
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
      {rows.map((row) => {
        const p = row.profiles!;
        const name = p.display_name ?? p.handle ?? "Member";
        const initial = name.charAt(0).toUpperCase();
        return (
          <ProfileLink
            key={row.profile_id}
            handle={p.handle}
            className="flex items-center gap-3 rounded-xl border border-transparent bg-surface-elevated/40 p-4 transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 animate-room-enter"
            title={name}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ai)] text-sm font-semibold text-background">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.creator_title || "Member"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <AvailabilityBadge status={p.availability as AvailabilityStatus} size="xs" />
              </div>
            </div>
            <div className="hidden h-6 w-px bg-ai/20 sm:block" aria-hidden="true" />
          </ProfileLink>
        );
      })}
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────

function SkillProjects({ skillId, skillName }: { skillId: string; skillName: string }) {
  const projects = useSkillProjects(skillId);
  const needs = useSkillNeeds(skillId);

  const projectRows = (projects.data ?? []).filter((row) => row.projects);
  const openNeeds = (needs.data ?? []).filter((need) => need.projects);

  if (projects.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-gentle-pulse rounded-xl bg-surface/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="projects-using">
        <h3 id="projects-using" className="font-display text-base font-semibold">
          Projects using {skillName}
        </h3>
        <div className="mt-3">
          {projectRows.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {projectRows.map((row) => (
                <ProjectTile key={row.project_id} row={row} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Folder className="h-5 w-5" />}
              title="No projects yet"
              description={`No projects are using ${skillName} yet. Start one!`}
              actionLabel="Open your studio"
              actionHref="/profile"
              variant="projects"
            />
          )}
        </div>
      </section>

      {openNeeds.length > 0 && (
        <section aria-labelledby="projects-needs">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-trust" aria-hidden="true" />
            <h3 id="projects-needs" className="font-display text-base font-semibold">
              Projects that need {skillName}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {openNeeds.map((need) => (
              <NeedRow key={need.id} need={need} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectTile({ row }: { row: SkillProjectRow }) {
  const proj = row.projects!;
  return (
    <Card asChild className="p-4">
      <Link
        to="/projects/$id"
        params={{ id: proj.id }}
        className="transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5"
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
              <Users className="h-2.5 w-2.5" aria-hidden="true" />
              Seeking collaborators
            </span>
          )}
          {proj.looking_for_feedback && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ai/30 bg-ai/5 px-2 py-0.5 text-[11px] text-ai">
              Wants feedback
            </span>
          )}
        </div>
        <div className="mt-3 h-px bg-border" aria-hidden="true" />
      </Link>
    </Card>
  );
}

/** An open project need for this skill — a project explicitly looking for
 * someone with it. The need title is surfaced so the skill→opportunity
 * relationship is obvious, not just another project card. */
function NeedRow({ need }: { need: SkillNeedRow }) {
  const proj = need.projects!;
  return (
    <Card asChild className="p-4">
      <Link
        to="/projects/$id"
        params={{ id: proj.id }}
        className="transition-spatial duration-150 hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium" title={need.title}>
            {need.title}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${URGENCY_COLORS[need.urgency] ?? URGENCY_COLORS.normal}`}
          >
            {URGENCY_LABELS[need.urgency] ?? "Open need"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Needs someone with this skill in{" "}
          <span className="font-medium text-foreground">{proj.title}</span>
        </p>
        {need.note && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={need.note}>
            {need.note}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1">
          {proj.stage && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${STAGE_COLORS[proj.stage] ?? STAGE_COLORS.building}`}
            >
              <Folder className="h-2.5 w-2.5" aria-hidden="true" />
              {STAGE_LABELS[proj.stage] ?? proj.stage}
            </span>
          )}
        </div>
      </Link>
    </Card>
  );
}

// ── Shell ─────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell backTo="/skills" className="bg-noise">
      {children}
    </SectionShell>
  );
}
