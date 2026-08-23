import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  GraduationCap,
  Link as LinkIcon,
  Sparkles,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";
import { safeHref } from "@/lib/validators";
import { ContributionGraph } from "@/components/tethyr/profile/contribution-graph";
import {
  ExperienceBadge,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  VerificationBadge,
} from "@/components/tethyr/profile-sections";
import type { SkillExperienceLevel, SkillVerificationLevel } from "@/hooks/use-current-user";
import { WorkspaceGrid } from "@/components/tethyr/workspace/workspace-grid";
import { Button } from "@/components/ui/button";
import { useUpdateEvidenceShelf, type EvidenceShelfItem } from "@/hooks/use-project-loop";
import { PUBLIC_STUDIO_MODULES, PUBLIC_STUDIO_PRESETS } from "@/lib/workspace-layouts";
import type { LayoutStorage } from "@/hooks/use-layout-preferences";

export type PublicStudioProfile = {
  id: string;
  display_name: string | null;
  handle: string | null;
  bio: string | null;
  learning_goals: string | null;
  portfolio_links: { label: string; url: string }[];
  social_links: Record<string, string>;
  favourite_tools: string[];
  software_stack: string[];
  evidence_shelf: EvidenceShelfItem[];
};

export type PublicStudioSkill = {
  id: string;
  slug: string;
  name: string;
  category: string;
  verification_level: SkillVerificationLevel;
  experience_level: SkillExperienceLevel;
  proof_url: string | null;
  endorsementCount: number;
  endorsedByIds: string[];
};

export type PublicStudioGrowingSkill = {
  id: string;
  slug: string;
  name: string;
};

export type PublicStudioProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress_percent: number | null;
  role: string;
};

type Props = {
  profile: PublicStudioProfile;
  profileId: string;
  meId: string | null;
  teachSkills: PublicStudioSkill[];
  learnSkills: PublicStudioGrowingSkill[];
  contributedProjects: PublicStudioProject[];
  layoutStorage: LayoutStorage;
  canCustomize: boolean;
  onEndorse: (skill: PublicStudioSkill) => void;
  endorsePending: boolean;
};

export function PublicStudioWorkspace({
  profile,
  profileId,
  meId,
  teachSkills,
  learnSkills,
  contributedProjects,
  layoutStorage,
  canCustomize,
  onEndorse,
  endorsePending,
}: Props) {
  const builtProjects = useMemo(
    () => contributedProjects.filter((project) => project.role === "creator"),
    [contributedProjects],
  );
  const joinedProjects = useMemo(
    () => contributedProjects.filter((project) => project.role !== "creator"),
    [contributedProjects],
  );
  const featuredProject = builtProjects[0] ?? contributedProjects[0] ?? null;
  const updateShelf = useUpdateEvidenceShelf();
  const shelf = useMemo(() => profile.evidence_shelf ?? [], [profile.evidence_shelf]);
  const featureLatestProject = useCallback(() => {
    if (!featuredProject || shelf.some((item) => item.project_id === featuredProject.id)) return;
    updateShelf.mutate({
      profileId,
      items: [
        ...shelf,
        {
          project_id: featuredProject.id,
          title: featuredProject.title,
          note: "Featured from my current Studio work.",
          kind: "project",
        },
      ],
    });
  }, [featuredProject, profileId, shelf, updateShelf]);

  const renderModule = useCallback(
    (id: string): React.ReactNode => {
      switch (id) {
        case "featured-work":
          return (
            <SectionCard
              title="Featured work"
              subtitle="The thing this person is making visible"
              icon={<Sparkles className="h-4 w-4" />}
              featured
            >
              {featuredProject ? (
                <div className="space-y-3">
                  <Link
                    to="/projects/$id"
                    params={{ id: featuredProject.id }}
                    className="block rounded-lg border-2 border-[var(--user-accent-border,var(--primary))] bg-background/50 p-5 transition hover:bg-surface"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 text-base font-semibold text-foreground">
                        {featuredProject.title}
                      </h3>
                      <span className="shrink-0 text-xs text-muted-foreground">Open project →</span>
                    </div>
                    {featuredProject.description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {featuredProject.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-secondary/60 px-2 py-0.5 capitalize">
                        {featuredProject.status}
                      </span>
                      {featuredProject.progress_percent != null && (
                        <span>{featuredProject.progress_percent}% complete</span>
                      )}
                      <span className="capitalize">{featuredProject.role}</span>
                    </div>
                  </Link>
                </div>
              ) : (
                <EmptyCopy>
                  Featured work will appear here as this person builds in public.
                </EmptyCopy>
              )}
            </SectionCard>
          );

        case "contributions":
          return (
            <SectionCard
              title="Contributions"
              subtitle={
                contributedProjects.length > 0
                  ? `${contributedProjects.length} project${contributedProjects.length !== 1 ? "s" : ""}`
                  : "Projects this person has worked on"
              }
              icon={<BookOpen className="h-4 w-4" />}
            >
              {contributedProjects.length === 0 ? (
                <EmptyCopy>No project contributions are visible yet.</EmptyCopy>
              ) : (
                <div className="space-y-5">
                  {builtProjects.length > 0 && (
                    <ContributionGroup label="Built" projects={builtProjects} />
                  )}
                  {joinedProjects.length > 0 && (
                    <ContributionGroup label="Contributing to" projects={joinedProjects} />
                  )}
                </div>
              )}
            </SectionCard>
          );

        case "evidence-shelf":
          return (
            <SectionCard
              title="Evidence shelf"
              subtitle="A few pieces of work worth remembering"
              icon={<Sparkles className="h-4 w-4" />}
            >
              {shelf.length === 0 ? (
                <div className="space-y-2">
                  <EmptyCopy>Curate a small set of project evidence here.</EmptyCopy>
                  {canCustomize && featuredProject && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={featureLatestProject}
                      disabled={updateShelf.isPending}
                    >
                      {updateShelf.isPending ? "Featuring…" : "Feature current project"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {shelf.slice(0, 6).map((item) => (
                    <Link
                      key={`${item.project_id}-${item.title}`}
                      to="/projects/$id"
                      params={{ id: item.project_id }}
                      className="block min-w-0 rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                    >
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      {item.note && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.note}</p>
                      )}
                    </Link>
                  ))}
                  {canCustomize &&
                    featuredProject &&
                    !shelf.some((item) => item.project_id === featuredProject.id) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={featureLatestProject}
                        disabled={updateShelf.isPending}
                      >
                        Feature current project
                      </Button>
                    )}
                </div>
              )}
            </SectionCard>
          );

        case "activity":
          return (
            <SectionCard
              title="Contribution activity"
              subtitle="What they have shipped and completed recently"
              icon={<Calendar className="h-4 w-4" />}
            >
              <ContributionGraph profileId={profileId} />
              <div className="mt-5">
                <ActivityTimeline profileId={profileId} limit={6} />
              </div>
            </SectionCard>
          );

        case "skills-share":
          return (
            <SectionCard
              title="Skills they share"
              subtitle="What they can help you with"
              icon={<GraduationCap className="h-4 w-4" />}
            >
              {teachSkills.length === 0 ? (
                <EmptyCopy>Not sharing any skills yet.</EmptyCopy>
              ) : (
                <div className="space-y-3">
                  {teachSkills.map((skill) => {
                    const alreadyEndorsed = !!meId && skill.endorsedByIds.includes(meId);
                    const canEndorse = !!meId && meId !== profileId && !alreadyEndorsed;
                    return (
                      <div
                        key={skill.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--user-accent-border,var(--primary))] bg-[var(--user-accent-subtle,var(--learning-subtle))] px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Link
                            to="/skills/$slug"
                            params={{ slug: skill.slug }}
                            className="truncate text-sm font-medium text-primary hover:underline"
                          >
                            {skill.name}
                          </Link>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <VerificationBadge
                              level={skill.verification_level}
                              proofUrl={skill.proof_url}
                            />
                            <ExperienceBadge level={skill.experience_level} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {skill.endorsementCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <ThumbsUp className="h-3 w-3" /> {skill.endorsementCount}
                            </span>
                          )}
                          {canEndorse && (
                            <button
                              type="button"
                              disabled={endorsePending}
                              onClick={() => onEndorse(skill)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                            >
                              <ThumbsUp className="h-3 w-3" /> Endorse
                            </button>
                          )}
                          {alreadyEndorsed && (
                            <span className="text-[11px] text-primary">Endorsed</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );

        case "skills-growing":
          return (
            <SectionCard title="Skills they’re growing" icon={<BookOpen className="h-4 w-4" />}>
              {learnSkills.length === 0 ? (
                <EmptyCopy>Nothing here yet.</EmptyCopy>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {learnSkills.map((skill) => (
                    <Link
                      key={skill.id}
                      to="/skills/$slug"
                      params={{ slug: skill.slug }}
                      className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-primary"
                    >
                      {skill.name}
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          );

        case "links":
          if (
            profile.portfolio_links.length === 0 &&
            Object.keys(profile.social_links).length === 0
          ) {
            return null;
          }
          return (
            <SectionCard title="Links" icon={<LinkIcon className="h-4 w-4" />}>
              <div className="space-y-2">
                {profile.portfolio_links.map((link, index) => (
                  <a
                    key={`${link.url}-${index}`}
                    href={safeHref(link.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm text-foreground hover:bg-surface hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{link.label || link.url}</span>
                  </a>
                ))}
                {Object.entries(profile.social_links).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {Object.entries(profile.social_links).map(([key, url]) => (
                      <a
                        key={key}
                        href={safeHref(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                      >
                        {key}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          );

        case "about":
          if (
            !profile.bio &&
            profile.favourite_tools.length === 0 &&
            profile.software_stack.length === 0
          ) {
            return null;
          }
          return (
            <SectionCard title="About" icon={<UserRound className="h-4 w-4" />}>
              {profile.bio && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
                  {profile.bio}
                </p>
              )}
              <ToolGroup label="Tools" values={profile.favourite_tools} />
              <ToolGroup label="Stack" values={profile.software_stack} />
            </SectionCard>
          );

        default:
          return null;
      }
    },
    [
      builtProjects,
      contributedProjects,
      endorsePending,
      featuredProject,
      canCustomize,
      featureLatestProject,
      updateShelf.isPending,
      joinedProjects,
      learnSkills,
      meId,
      onEndorse,
      profile,
      profileId,
      shelf,
      teachSkills,
    ],
  );

  return (
    <section aria-labelledby="public-studio-work-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Public Studio</p>
          <h2 id="public-studio-work-heading" className="mt-1 font-display text-xl font-semibold">
            Work, contribution, and direction
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            See the work this person is building and the contribution behind it.
          </p>
        </div>
      </div>
      <WorkspaceGrid
        page="profile"
        userId={profileId}
        modules={PUBLIC_STUDIO_MODULES}
        canCustomize={false}
        layoutStorage={layoutStorage}
        layoutPresets={PUBLIC_STUDIO_PRESETS}
        showModuleTitles={false}
        showPresetPicker={false}
        showSectionNav
        workspaceLabel="public Studio"
        renderModule={renderModule}
      />
    </section>
  );
}

function ContributionGroup({
  label,
  projects,
}: {
  label: string;
  projects: PublicStudioProject[];
}) {
  return (
    <div>
      <p className="mb-2 section-label">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: PublicStudioProject }) {
  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="group block rounded-lg border border-border/60 bg-background/40 p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-foreground group-hover:text-primary">
          {project.title}
        </h3>
        {project.status && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${PROJECT_STATUS_STYLE[project.status as keyof typeof PROJECT_STATUS_STYLE] ?? "border-border/60 text-muted-foreground"}`}
          >
            {PROJECT_STATUS_LABEL[project.status as keyof typeof PROJECT_STATUS_LABEL] ??
              project.status}
          </span>
        )}
      </div>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="capitalize">{project.role}</span>
        {project.progress_percent != null && <span>{project.progress_percent}%</span>}
      </div>
    </Link>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  featured = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`h-full rounded-xl p-4 sm:p-5 ${featured ? "border card-border bg-surface" : "bg-surface-elevated/30"}`}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          {icon}
          {title}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyCopy({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ToolGroup({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="section-label">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-[11px] text-muted-foreground"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
