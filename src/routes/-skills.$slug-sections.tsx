// Skill hub tabs: the overview, the people lists, and the projects and needs
// that use the skill. Composed by SkillPage (-skills.$slug-page.tsx).

import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { VerificationBadge, ExperienceBadge } from "@/components/tethyr/profile-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { AvailabilityBadge } from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { SkillGraphSummary } from "@/components/tethyr/skill/skill-graph-summary";
import {
  HubStats,
  SkillProjectRow,
  SkillNeedRow,
  useSharingPeople,
  useGrowingPeople,
  useSkillProjects,
  useSkillNeeds,
  useRelatedSkills,
} from "./-skills.$slug-queries";

export const CATEGORY_BADGES: Record<string, { icon: typeof Wrench; color: string }> = {
  Creative: { icon: Palette, color: "border-ai/40 bg-ai/10 text-ai" },
  Development: {
    icon: Hammer,
    color:
      "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent-text,var(--primary))]",
  },
  Community: { icon: Users, color: "border-trust/40 bg-trust/10 text-trust" },
};

export const WORKSHOP_ICONS = [Wrench, Hammer, Palette, Sparkles, Globe];

export const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  launch: "Launching",
  growing: "Growing",
};

export const STAGE_COLORS: Record<string, string> = {
  planning: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
  building: "border-primary/30 bg-primary/10 text-primary",
  testing: "border-ai/30 bg-ai/10 text-ai",
  launch: "border-trust/30 bg-trust/10 text-trust",
  growing: "border-trust/30 bg-trust/10 text-trust",
};

export const URGENCY_LABELS: Record<string, string> = {
  low: "Low priority",
  normal: "Open need",
  high: "Urgent",
};

export const URGENCY_COLORS: Record<string, string> = {
  low: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
  normal: "border-trust/30 bg-trust/10 text-trust",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function formatSummary(stats: HubStats) {
  const parts: string[] = [];
  if (stats.sharing > 0) parts.push(`${stats.sharing} sharing`);
  if (stats.growing > 0) parts.push(`${stats.growing} growing`);
  if (stats.projects > 0) parts.push(`${stats.projects} projects`);
  return parts.length > 0 ? parts.join(" · ") : "No activity yet";
}

// ── Overview Tab ──────────────────────────────────────────────

export function SkillOverview({
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

      <SkillGraphSummary
        skillName={skillName}
        peopleCount={(stats?.sharing ?? 0) + (stats?.growing ?? 0)}
        projectCount={stats?.projects ?? 0}
        relatedSkills={(relatedSkills.data ?? []).map((row) => row.name).slice(0, 5)}
      />

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

export function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
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

export type PreviewPerson = {
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  availability: string | null;
};

export function PeoplePreviewColumn({
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

export function CompactPersonRow({
  person,
  accentClass,
}: {
  person: PreviewPerson;
  accentClass: string;
}) {
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

export function SkillPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
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
              ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent-text,var(--primary))]"
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

export function SkillSharingPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useSharingPeople(skillId);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
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

export function SkillGrowingPeople({ skillId, skillName }: { skillId: string; skillName: string }) {
  const { data, isLoading } = useGrowingPeople(skillId);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
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

export function SkillProjects({ skillId, skillName }: { skillId: string; skillName: string }) {
  const projects = useSkillProjects(skillId);
  const needs = useSkillNeeds(skillId);

  const projectRows = (projects.data ?? []).filter((row) => row.projects);
  const openNeeds = (needs.data ?? []).filter((need) => need.projects);

  if (projects.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
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

export function ProjectTile({ row }: { row: SkillProjectRow }) {
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
export function NeedRow({ need }: { need: SkillNeedRow }) {
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
