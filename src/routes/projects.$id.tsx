// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors, project_skills,
// milestones, updates, discussions and open roles all carry public SELECT
// policies. Phase 2.1: expanded project model with vision, gallery,
// resources, milestones, weekly updates, discussions, and open roles.
import { useState } from "react";
import { createFileRoute, notFound, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Target,
  Users as UsersIcon,
  MessageCircle,
  UserPlus,
  ImageIcon,
  Trophy,
  Clock,
  Sparkles,
  BookOpen,
  PenSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Until Supabase types are regenerated after migration, cast new columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { safeHref } from "@/lib/validators";
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { Progress } from "@/components/ui/progress";
import {
  PROJECT_LINK_KEYS,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
} from "@/components/tethyr/profile-sections";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useMilestones,
  useProjectUpdates,
  useDiscussions,
  useOpenRoles,
  useUpdateProjectStage,
  type ProjectDetail,
  type ProjectStage,
} from "@/hooks/use-projects";
import { MilestonesTimeline } from "@/components/tethyr/project/project-milestones";
import { ProjectUpdatesJournal } from "@/components/tethyr/project/project-updates";
import { ProjectDiscussions } from "@/components/tethyr/project/project-discussions";
import { OpenRolesSection } from "@/components/tethyr/project/project-open-roles";
import { GallerySection, ResourcesSection } from "@/components/tethyr/project/project-resources";
import { ProjectTimeline } from "@/components/tethyr/project/project-timeline";
// Role application components imported but not yet used in this route
import { ProjectCommunityPosts } from "@/components/tethyr/project/project-community-posts";
import { useProjectCommunityPostCount } from "@/components/tethyr/project/project-community-posts";

type PersonLite = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  avatar_url: string | null;
};

export type Contributor = {
  profile_id: string;
  role: "creator" | "contributor" | "mentor";
  contribution_score: number;
  skills_used: string[];
  profile: PersonLite | null;
};

type SkillLite = { id: string; slug: string; name: string; category: string };

const ROLE_ORDER: Record<Contributor["role"], number> = { creator: 0, mentor: 1, contributor: 2 };
const ROLE_LABEL: Record<Contributor["role"], string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

type Tab = "overview" | "milestones" | "journal" | "discussion" | "contributors";
const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "milestones", label: "Milestones", icon: Target },
  { id: "journal", label: "Journal", icon: Sparkles },
  { id: "discussion", label: "Discussion", icon: MessageCircle },
  { id: "contributors", label: "Contributors", icon: UsersIcon },
];

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project — Tethyr" },
      { name: "description", content: "A project being built on Tethyr." },
    ],
  }),
  component: ProjectPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No project with that ID.
    </div>
  ),
});

function ProjectPage() {
  const { id } = useParams({ from: "/projects/$id" });
  const { data: me } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      // Try full column set first; fall back if extended columns are missing.
      const FULL_COLS =
        "id, profile_id, title, description, goal, vision, status, stage, started_at, progress_percent, cover_url, gallery, resources, links, tags, looking_for_feedback, looking_for_collaborators, is_featured";
      const BASIC_COLS =
        "id, profile_id, title, description, goal, status, started_at, progress_percent, cover_url, links, tags, looking_for_feedback, looking_for_collaborators, is_featured";

      let project: any = null;
      for (const cols of [FULL_COLS, BASIC_COLS]) {
        const res = await sb.from("projects").select(cols).eq("id", id).maybeSingle();
        if (!res.error) {
          project = res.data;
          break;
        }
        if (
          !res.error.message?.includes("column") &&
          !res.error.message?.includes("schema") &&
          !res.error.code?.startsWith("42")
        )
          throw res.error;
      }
      if (!project) throw notFound();

      const FULL_CONTRIB_COLS =
        "profile_id, role, contribution_score, skills_used, profiles(id, handle, display_name, creator_title, avatar_url)";
      const BASIC_CONTRIB_COLS =
        "profile_id, role, profiles(id, handle, display_name, creator_title, avatar_url)";

      let contributorsRes: any = null;
      for (const cols of [FULL_CONTRIB_COLS, BASIC_CONTRIB_COLS]) {
        const res = await (supabase as any)
          .from("project_contributors")
          .select(cols)
          .eq("project_id", id);
        if (!res.error) {
          contributorsRes = res;
          break;
        }
        if (
          !res.error.message?.includes("column") &&
          !res.error.message?.includes("schema") &&
          !res.error.code?.startsWith("42")
        )
          break;
      }
      contributorsRes ??= { data: [] };

      const [skillsRes] = await Promise.all([
        supabase
          .from("project_skills")
          .select("skill_id, skills(id, slug, name, category)")
          .eq("project_id", id),
      ]);

      const contributors = (
        (contributorsRes.data ?? []) as unknown as {
          profile_id: string;
          role: string;
          contribution_score: number;
          skills_used: string[];
          profiles: unknown;
        }[]
      )
        .map((r) => ({
          profile_id: r.profile_id,
          role: r.role as Contributor["role"],
          contribution_score: r.contribution_score ?? 0,
          skills_used: r.skills_used ?? [],
          profile: (r.profiles as unknown as PersonLite) ?? null,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) as Contributor[];

      const skills = (skillsRes.data ?? [])
        .map((r) => r.skills as unknown as SkillLite | null)
        .filter((s): s is SkillLite => !!s);

      let coverSigned: string | null = null;
      if (project.cover_url) {
        const { data: s } = await supabase.storage
          .from("project-media")
          .createSignedUrl(project.cover_url, 60 * 60);
        coverSigned = s?.signedUrl ?? null;
      }

      const avatarTargets = contributors.filter((c) => c.profile?.avatar_url);
      const avatarSigned: Record<string, string> = {};
      await Promise.all(
        avatarTargets.map(async (c) => {
          const { data: s } = await supabase.storage
            .from("avatars")
            .createSignedUrl(c.profile!.avatar_url as string, 60 * 60);
          if (s?.signedUrl) avatarSigned[c.profile_id] = s.signedUrl;
        }),
      );

      return {
        project: project as unknown as ProjectDetail,
        contributors,
        skills,
        coverSigned,
        avatarSigned,
      };
    },
  });

  const accent = useDominantColor(data?.coverSigned ?? null);
  const updateStage = useUpdateProjectStage();

  // Fetch new sections data
  const { data: milestones = [] } = useMilestones(id);
  const { data: updates = [] } = useProjectUpdates(id);
  const { data: discussions = [] } = useDiscussions(id);
  const { data: openRoles = [] } = useOpenRoles(id);
  const { data: communityPostCount = 0 } = useProjectCommunityPostCount(id);

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </Shell>
    );
  }
  if (error || !data) {
    return (
      <Shell>
        <div className="p-8 text-sm text-muted-foreground">Project not found.</div>
      </Shell>
    );
  }

  const { project, contributors, skills, coverSigned, avatarSigned } = data;
  const creator = contributors.find((c) => c.role === "creator");
  const otherContributors = contributors.filter((c) => c.role !== "creator");
  const isOwner = me?.userId === project.profile_id;
  const isContributor = isOwner || contributors.some((c) => c.profile_id === me?.userId);
  const timeSinceStart = project.started_at
    ? formatDistanceToNowStrict(new Date(project.started_at), { addSuffix: true })
    : null;
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);
  const doneCount = milestones.filter((m) => m.status === "done").length;

  return (
    <Shell accentColor={accent}>
      <div className="animate-room-enter mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
        {/* HERO / HEADER */}
        <div className="card-border relative overflow-hidden rounded-3xl border bg-surface">
          <div
            className="relative aspect-[21/9] w-full overflow-hidden border-b transition-colors duration-500 sm:aspect-[3/1]"
            style={{ borderColor: accent ?? "transparent" }}
          >
            {coverSigned ? (
              <img
                src={coverSigned}
                alt={`${project.title} cover`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40">
                <ImageIcon className="h-8 w-8 text-background" />
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                    {project.title}
                  </h1>
                  {project.is_featured && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                {creator?.profile && (
                  <Link
                    to="/u/$handle"
                    params={{ handle: creator.profile.handle ?? "" }}
                    className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Avatar
                      name={creator.profile.display_name ?? creator.profile.handle}
                      src={avatarSigned[creator.profile_id]}
                    />
                    {creator.profile.display_name || creator.profile.handle}
                  </Link>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${PROJECT_STATUS_STYLE[project.status]}`}
              >
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
              {(isOwner || isContributor) && (
                <Link
                  to="/community"
                  search={{ attach_project: id } as Record<string, string>}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                >
                  <PenSquare className="h-3 w-3" />
                  Post to Community
                </Link>
              )}
            </div>

            {project.goal && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground/90">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {project.goal}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <Progress value={project.progress_percent} className="h-2" />
              <span className="shrink-0 text-xs text-muted-foreground">
                {project.progress_percent}% complete
                {milestones.length > 0 && `· ${doneCount}/${milestones.length} milestones`}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {timeSinceStart && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Started {timeSinceStart}
                </span>
              )}
              {otherContributors.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="h-3.5 w-3.5" /> {otherContributors.length}{" "}
                  {otherContributors.length === 1 ? "contributor" : "contributors"}
                </span>
              )}
              {project.looking_for_feedback && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-primary">
                  <MessageCircle className="h-3 w-3" /> Looking for feedback
                </span>
              )}
              {project.looking_for_collaborators && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 px-2.5 py-0.5 text-[var(--brand-purple)]">
                  <UserPlus className="h-3 w-3" /> Open to collaborators
                </span>
              )}
              {communityPostCount > 0 && (
                <Link
                  to="/community"
                  search={{ project: id } as Record<string, string>}
                  className="inline-flex items-center gap-1 rounded-full border border-learning/40 bg-learning px-2.5 py-0.5 text-xs text-learning transition hover:bg-learning"
                >
                  <MessageCircle className="h-3 w-3" /> {communityPostCount} community post
                  {communityPostCount !== 1 ? "s" : ""}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <ProjectTimeline
          currentStage={(project.stage ?? "planning") as ProjectStage}
          isOwner={isOwner}
          onStageChange={(stage) => updateStage.mutate({ projectId: id, stage })}
        />

        {/* TABS */}
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-surface p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === "milestones" && milestones.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] tabular-nums text-primary">
                    {doneCount}/{milestones.length}
                  </span>
                )}
                {tab.id === "discussion" && discussions.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] tabular-nums text-primary">
                    {discussions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Vision */}
            {project.vision && (
              <div className="card-border rounded-3xl border bg-surface p-6">
                <h3 className="mb-2 text-sm font-medium text-foreground/80">Vision</h3>
                <div className="prose-custom text-sm text-foreground/90">
                  <Markdown remarkPlugins={[remarkGfm]}>{project.vision}</Markdown>
                </div>
              </div>
            )}

            {/* Description */}
            {project.description && (
              <div className="card-border rounded-3xl border bg-surface p-6">
                <h3 className="mb-2 text-sm font-medium text-foreground/80">About</h3>
                <div className="prose-custom text-sm leading-relaxed text-foreground/90">
                  <Markdown remarkPlugins={[remarkGfm]}>{project.description}</Markdown>
                </div>
              </div>
            )}

            {/* Skills + Links row */}
            <div className="grid gap-6 md:grid-cols-2">
              <SectionCard title="Skills involved" icon={<Target className="h-4 w-4" />}>
                {skills.length === 0 && project.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No skills tagged yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <Link
                        key={s.id}
                        to="/skills/$slug"
                        params={{ slug: s.slug }}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:opacity-80"
                      >
                        {s.name}
                      </Link>
                    ))}
                    {project.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </SectionCard>

              {links.length > 0 && (
                <SectionCard title="Links">
                  <div className="flex flex-wrap gap-2">
                    {links.map(([key, url]) => {
                      const meta = PROJECT_LINK_KEYS.find((l) => l.key === key);
                      const Icon = meta?.icon;
                      return (
                        <a
                          key={key}
                          href={safeHref(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          {meta?.label ?? key}
                        </a>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Gallery */}
            <GallerySection
              gallery={
                (project.gallery ?? []) as {
                  url: string;
                  caption?: string;
                  type: "image" | "video";
                }[]
              }
              onUpdate={() => {}}
              isOwner={isOwner}
            />

            {/* Resources */}
            <ResourcesSection
              resources={
                (project.resources ?? []) as {
                  title: string;
                  url: string;
                  type: "article" | "tool" | "video" | "doc" | "other";
                }[]
              }
              onUpdate={() => {}}
              isOwner={isOwner}
            />

            {/* Open Roles */}
            {openRoles.length > 0 && (
              <OpenRolesSection roles={openRoles} projectId={id} isOwner={isOwner} />
            )}
          </div>
        )}

        {activeTab === "milestones" && (
          <MilestonesTimeline milestones={milestones} projectId={id} isOwner={isOwner} />
        )}

        {activeTab === "journal" && (
          <ProjectUpdatesJournal updates={updates} projectId={id} isContributor={isContributor} />
        )}

        {activeTab === "discussion" && (
          <ProjectDiscussions
            discussions={discussions}
            projectId={id}
            isContributor={isContributor}
            isOwner={isOwner}
          />
        )}

        {activeTab === "contributors" && (
          <div className="space-y-6">
            <SectionCard title="Contributors" icon={<UsersIcon className="h-4 w-4" />}>
              {contributors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one listed yet.</p>
              ) : (
                <div className="space-y-3">
                  {contributors.map((c) => (
                    <div key={c.profile_id} className="rounded-xl bg-background/40 p-3">
                      <Link
                        to="/u/$handle"
                        params={{ handle: c.profile?.handle ?? "" }}
                        className="flex items-center gap-3 transition hover:opacity-80"
                      >
                        <Avatar
                          name={c.profile?.display_name ?? c.profile?.handle}
                          src={avatarSigned[c.profile_id]}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {c.profile?.display_name || c.profile?.handle || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role]}</p>
                        </div>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c.contribution_score > 0 && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary tabular-nums">
                            Score: {c.contribution_score}
                          </span>
                        )}
                        {c.skills_used.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <OpenRolesSection roles={openRoles} projectId={id} isOwner={isOwner} />
          </div>
        )}

        {/* Community Discussions — always visible */}
        <ProjectCommunityPosts projectId={id} />
      </div>
    </Shell>
  );
}

function Avatar({ name, src }: { name?: string | null; src?: string }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
          {initial}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/80">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Shell({
  children,
  accentColor,
}: {
  children: React.ReactNode;
  accentColor?: string | null;
}) {
  const accentStyle = accentColor
    ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
    : undefined;
  return (
    <div className="min-h-screen bg-background" style={accentStyle}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          Tethyr
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Project</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
