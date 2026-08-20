// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors, project_skills,
// milestones, updates, discussions and open roles all carry public SELECT
// policies. Repository-workspace layout: compact header → sticky tab bar
// (README as homepage, with Files / Activity / People / Discussions) below.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  createFileRoute,
  notFound,
  useParams,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase;
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { canonicalLinks } from "@/lib/seo";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useMilestones,
  useProjectUpdates,
  useDiscussions,
  useOpenRoles,
  useProjectNeeds,
  useUpdateProjectPresentation,
  type ProjectDetail,
} from "@/hooks/use-projects";
import { getProjectPresentationOption, type ProjectSectionKey } from "@/lib/project-presentation";
import { useProjectRepos } from "@/hooks/use-project-repos";
import { useProjectSessions } from "@/hooks/use-sessions";
import { useProjectChallenges } from "@/hooks/use-challenges";
import { ProjectHeader } from "@/components/tethyr/project/project-header";
import { ProjectPulse } from "@/components/tethyr/project/project-pulse";
import { useMarkProjectVisited } from "@/hooks/use-project-loop";
import {
  ProjectWorkbench,
  type ProjectWorkbenchAction,
} from "@/components/tethyr/project/project-workbench";
import { ProjectTabs, type ProjectTab } from "@/components/tethyr/project/project-tabs";
import { ProjectReadmeTab } from "@/components/tethyr/project/project-readme";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contributor } from "@/components/tethyr/project/project-main-content";
import type { ProjectFile } from "@/components/tethyr/project/project-files";

const ProjectNeeds = lazy(() =>
  import("@/components/tethyr/project/project-needs").then((m) => ({ default: m.ProjectNeeds })),
);
const ProjectCredits = lazy(() =>
  import("@/components/tethyr/project/project-credits").then((m) => ({
    default: m.ProjectCredits,
  })),
);
const ProjectFilesExplorer = lazy(() =>
  import("@/components/tethyr/project/project-files-explorer").then((m) => ({
    default: m.ProjectFilesExplorer,
  })),
);
const ProjectActivityTab = lazy(() =>
  import("@/components/tethyr/project/project-activity").then((m) => ({
    default: m.ProjectActivityTab,
  })),
);
const MilestonesTimeline = lazy(() =>
  import("@/components/tethyr/project/project-milestones").then((m) => ({
    default: m.MilestonesTimeline,
  })),
);
const ProjectPeopleTab = lazy(() =>
  import("@/components/tethyr/project/project-people").then((m) => ({
    default: m.ProjectPeopleTab,
  })),
);
const ProjectDiscussions = lazy(() =>
  import("@/components/tethyr/project/project-discussions").then((m) => ({
    default: m.ProjectDiscussions,
  })),
);
import { useProjectCommunityPostCount } from "@/components/tethyr/project/project-community-posts";

const ProjectCommunityPosts = lazy(() =>
  import("@/components/tethyr/project/project-community-posts").then((m) => ({
    default: m.ProjectCommunityPosts,
  })),
);
const ProjectJoinModal = lazy(() =>
  import("@/components/tethyr/project/project-join-modal").then((m) => ({
    default: m.ProjectJoinModal,
  })),
);
const CreateChallengeDialog = lazy(() =>
  import("@/components/tethyr/community/create-challenge-dialog").then((m) => ({
    default: m.CreateChallengeDialog,
  })),
);
const ScheduleSessionWizard = lazy(() =>
  import("@/components/tethyr/sessions/schedule-session-wizard").then((m) => ({
    default: m.ScheduleSessionWizard,
  })),
);
const ProjectSearchDialog = lazy(() =>
  import("@/components/tethyr/project/project-search").then((m) => ({
    default: m.ProjectSearchDialog,
  })),
);

export const Route = createFileRoute("/projects/$id")({
  // Lightweight title fetch so the SSR/meta <title> carries the real project
  // name (the component's useQuery still drives the full detail). Best-effort:
  // on any error we fall back to the generic title rather than failing the page.
  loader: async ({ params }) => {
    try {
      const { data } = await sb.from("projects").select("title").eq("id", params.id).maybeSingle();
      return { title: (data?.title ?? null) as string | null };
    } catch {
      return { title: null };
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: loaderData?.title ? `${loaderData.title} — Tethyr` : "Project — Tethyr",
      },
      {
        name: "description",
        content: loaderData?.title
          ? `Explore ${loaderData.title} and the work being built with Tethyr.`
          : "Explore this project and the work being built with Tethyr.",
      },
    ],
    links: canonicalLinks(`/projects/${encodeURIComponent(params.id)}`),
  }),
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  component: ProjectPage,
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This project couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No project with that ID.
    </div>
  ),
});

const ROLE_ORDER: Record<Contributor["role"], number> = {
  creator: 0,
  mentor: 1,
  contributor: 2,
};

type SkillLite = { id: string; slug: string; name: string; category: string };

const TAB_IDS: ProjectTab[] = ["files", "activity"];

function isTab(value: unknown): value is ProjectTab {
  return typeof value === "string" && (TAB_IDS as string[]).includes(value);
}

function ProjectPage() {
  const { id } = useParams({ from: "/projects/$id" });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [preselectPath, setPreselectPath] = useState<string | null>(null);
  const [preselectNonce, setPreselectNonce] = useState(0);
  const [directionEditing, setDirectionEditing] = useState(false);
  const [presentationSaveState, setPresentationSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const presentationResetTimer = useRef<number | null>(null);

  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const tabParam = searchParams.tab;
  const [tab, setTabState] = useState<ProjectTab | null>(() => (isTab(tabParam) ? tabParam : null));

  // Keep the tab in sync with the URL (back/forward, deep links).
  useEffect(() => {
    if (isTab(tabParam) && tabParam !== tab) setTabState(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // Legacy deep links (?tab=people / ?tab=discussions) now target the inline
  // sections instead of tabs, since People and Conversation are always visible.
  useEffect(() => {
    if (tabParam === "people" || tabParam === "discussions") {
      const sectionId = tabParam === "people" ? "project-people" : "project-discussions";
      requestAnimationFrame(() => {
        setTimeout(() => {
          document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      });
    }
  }, [tabParam]);

  const setTab = useCallback(
    (next: ProjectTab | null, opts?: { scrollToTop?: boolean }) => {
      setTabState(next);
      navigate({
        to: "/projects/$id",
        params: { id },
        search: next ? { tab: next } : undefined,
        replace: true,
      });
      if (opts?.scrollToTop !== false) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate, id],
  );

  // Project search jump handlers — switch tab, then scroll/preselect once
  // the target tab has mounted.
  const jumpToFile = useCallback(
    (path: string) => {
      setTab("files", { scrollToTop: false });
      requestAnimationFrame(() => {
        setPreselectPath(path);
        setPreselectNonce((n) => n + 1);
      });
    },
    [setTab],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const jumpToDiscussion = useCallback((discussionId: string) => {
    // Discussions are inline now, so jump straight to the thread.
    requestAnimationFrame(() => {
      setTimeout(() => {
        document
          .getElementById(`discussion-${discussionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    });
  }, []);

  const jumpToSection = useCallback((sectionId: string) => {
    // README is always visible — just scroll to the section
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    });
  }, []);

  // Keyboard shortcuts: 1–4 switch secondary tabs, "/" focuses the file search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= "1" && e.key <= "2") {
        const idx = Number(e.key) - 1;
        if (TAB_IDS[idx]) {
          e.preventDefault();
          setTab(TAB_IDS[idx]);
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setProjectSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, setTab]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      // Try full column set first; fall back if extended columns are missing.
      const FULL_COLS =
        "id, profile_id, title, description, goal, vision, status, visibility, stage, started_at, progress_percent, cover_url, gallery, resources, links, tags, uploaded_files, readme, tools, presentation_preset, season, collaboration_brief, lineage, looking_for_feedback, looking_for_collaborators, is_featured";
      // Fallback deliberately omits the newest columns (uploaded_files, readme,
      // tools, visibility) so a database that hasn't run the latest migrations
      // still loads.
      const BASIC_COLS =
        "id, profile_id, title, description, goal, status, started_at, progress_percent, cover_url, links, tags, looking_for_feedback, looking_for_collaborators, is_featured";

      let project: ProjectDetail | null = null;
      for (const cols of [FULL_COLS, BASIC_COLS]) {
        const res = await sb.from("projects").select(cols).eq("id", id).maybeSingle();
        if (!res.error) {
          project = res.data as unknown as ProjectDetail;
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

      let contributorsRes: { data: unknown[] | null } | null = null;
      for (const cols of [FULL_CONTRIB_COLS, BASIC_CONTRIB_COLS]) {
        const res = await supabase.from("project_contributors").select(cols).eq("project_id", id);
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

      const { data: skillsRes } = await supabase
        .from("project_skills")
        .select("skill_id, skills(id, slug, name, category)")
        .eq("project_id", id);

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
          profile: (r.profiles as unknown as Contributor["profile"]) ?? null,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) as Contributor[];

      const skills = (skillsRes ?? [])
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

  const projectLoaded = !!data?.project;
  useEffect(() => {
    if (!projectLoaded || !me?.userId || !data?.project?.id) return;
    markProjectVisited.mutate(data.project.id);
    // A visit is intentionally recorded once per mounted project page. It
    // powers the member's return shelf without adding visible tracking UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectLoaded, me?.userId, data?.project?.id]);

  useEffect(() => {
    if (searchParams.focus !== "demonstrations" || !projectLoaded) return;
    const timer = window.setTimeout(() => scrollToSection("project-demonstrations"), 100);
    return () => window.clearTimeout(timer);
  }, [searchParams.focus, projectLoaded, scrollToSection]);

  // Replace the generic tab title with the project's real title once loaded.
  useEffect(() => {
    if (data?.project?.title) document.title = `${data.project.title} — Tethyr`;
  }, [data?.project?.title]);

  // Tab data
  const { data: milestones = [] } = useMilestones(id);
  const { data: updates = [] } = useProjectUpdates(id);
  const { data: discussions = [] } = useDiscussions(id);
  const { data: openRoles = [] } = useOpenRoles(id);
  const { data: needs = [] } = useProjectNeeds(id);
  const { data: repos = [] } = useProjectRepos(id);
  const { data: projectSessions = [] } = useProjectSessions(id);
  const { data: projectChallenges = [] } = useProjectChallenges(id);
  const { data: communityPostCount = 0 } = useProjectCommunityPostCount(id);
  const updatePresentation = useUpdateProjectPresentation();
  const markProjectVisited = useMarkProjectVisited();

  // A successful save flashes "Saved" briefly, then resets so the label doesn't
  // read "Saved" forever once isSuccess has been true.
  useEffect(() => {
    return () => {
      if (presentationResetTimer.current) window.clearTimeout(presentationResetTimer.current);
    };
  }, []);

  const isOwner = !!me?.userId && data?.project.profile_id === me?.userId;

  if (isLoading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-6 p-8" aria-hidden="true">
          <div className="h-40 rounded-xl bg-surface" />
          <div className="h-8 w-2/3 rounded bg-surface" />
          <div className="h-4 w-full rounded bg-surface" />
          <div className="h-4 w-5/6 rounded bg-surface" />
        </div>
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
  const presentation = getProjectPresentationOption(project.presentation_preset);
  const creator = contributors.find((c) => c.role === "creator");
  const isContributor = isOwner || contributors.some((c) => c.profile_id === me?.userId);
  const canJoin = !!me?.userId && !isOwner && !isContributor;
  const isSignedOut = !me?.userId && !isOwner && !isContributor;
  const signInToJoin = () =>
    navigate({
      to: "/login",
      search: { redirect: `/projects/${id}` } as Record<string, string>,
    });

  const handleWorkbenchAction = (action: ProjectWorkbenchAction) => {
    if (action === "update") {
      setTab("activity", { scrollToTop: false });
      setTimeout(() => scrollToSection("project-activity"), 80);
      return;
    }
    const sectionByAction: Partial<Record<ProjectWorkbenchAction, string>> = {
      demonstrations: "project-demonstrations",
      readme: "project-homepage-heading",
      needs: "project-needs",
      milestones: "project-current-work",
      people: "project-people",
      join: "project-people",
    };
    const sectionId = sectionByAction[action];
    if (sectionId) scrollToSection(sectionId);
  };
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);
  const projectFiles = (project.uploaded_files ?? []) as ProjectFile[];
  const repoStats = repos[0]?.metadata
    ? {
        language: repos[0].metadata.language ?? null,
        stars: repos[0].metadata.stargazers_count ?? undefined,
        forks: repos[0].metadata.forks_count ?? undefined,
      }
    : undefined;
  const sectionRank = new Map(
    presentation.sectionOrder.map((sectionKey, index) => [sectionKey, index]),
  );
  const sectionStyle = (sectionKey: ProjectSectionKey): React.CSSProperties => ({
    order: sectionRank.get(sectionKey) ?? 99,
  });

  return (
    <Shell accentColor={accent}>
      <ProjectHeader
        project={project}
        coverSigned={coverSigned}
        creator={creator}
        contributors={contributors}
        avatarSigned={avatarSigned}
        links={links}
        repoStats={repoStats}
        communityPostCount={communityPostCount}
        openNeedCount={needs.filter((need) => !need.is_filled).length}
        onJoin={canJoin ? () => setJoinModalOpen(true) : undefined}
        onSignIn={isSignedOut ? signInToJoin : undefined}
        onPostUpdate={
          isOwner || isContributor
            ? () => {
                setTab("activity", { scrollToTop: false });
                setTimeout(() => scrollToSection("project-activity"), 80);
              }
            : undefined
        }
        onOpenDiscussions={() => scrollToSection("project-discussions")}
        onOpenNeeds={() => scrollToSection("project-needs")}
      />

      <ProjectWorkbench
        project={project}
        gallery={(project.gallery ?? []) as ProjectDetail["gallery"]}
        milestones={milestones}
        openRoles={openRoles}
        needs={needs}
        isOwner={isOwner}
        isContributor={isContributor}
        canWatch={!!me?.userId && !isOwner}
        onShapeDirection={isOwner ? () => setDirectionEditing(true) : undefined}
        onAction={handleWorkbenchAction}
        onPresentationChange={(preset) => {
          setPresentationSaveState("saving");
          updatePresentation.mutate(
            { projectId: id, presentationPreset: preset },
            {
              onSuccess: () => {
                setPresentationSaveState("saved");
                if (presentationResetTimer.current)
                  window.clearTimeout(presentationResetTimer.current);
                presentationResetTimer.current = window.setTimeout(
                  () => setPresentationSaveState("idle"),
                  2000,
                );
              },
              onError: () => setPresentationSaveState("error"),
            },
          );
        }}
        presentationSaveState={presentationSaveState}
      />

      <ProjectPulse
        project={project}
        isOwner={isOwner}
        editing={directionEditing}
        onEditingChange={setDirectionEditing}
        gallery={(project.gallery ?? []) as ProjectDetail["gallery"]}
        milestones={milestones}
        openNeedCount={needs.filter((need) => !need.is_filled).length}
      />

      <div className="animate-room-enter min-h-screen bg-noise">
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-8">
          {/* The README is the project's homepage: identity, intent, and work context. */}
          <section aria-labelledby="project-homepage-heading" className="pt-6">
            <h2 id="project-homepage-heading" className="sr-only">
              Project homepage
            </h2>
            <ProjectReadmeTab
              project={project}
              skills={skills}
              projectFiles={projectFiles}
              isOwner={isOwner}
              presentationPreset={presentation.id}
            />
          </section>

          <ProjectSectionNav sectionOrder={presentation.sectionOrder} />

          {/* Files + activity live right under the README so the workspace tools
              (upload files, see what changed) are reachable without scrolling
              past the whole story. */}
          <div role="group" aria-label="Project files and activity" className="mt-6">
            <ProjectTabs active={tab} onSelect={setTab} counts={{ files: projectFiles.length }} />
          </div>

          <div className="pt-6">
            {tab === "files" && (
              <section aria-label="Project files">
                <Suspense fallback={<Skeleton className="h-48" />}>
                  <ProjectFilesExplorer
                    projectId={id}
                    projectFiles={projectFiles}
                    isOwner={isOwner}
                    preselectPath={preselectPath}
                    preselectNonce={preselectNonce}
                  />
                </Suspense>
              </section>
            )}
            {tab === "activity" && (
              <section id="project-activity" aria-label="Project activity">
                <Suspense fallback={<Skeleton className="h-48" />}>
                  <ProjectActivityTab
                    projectId={id}
                    milestones={milestones}
                    updates={updates}
                    discussions={discussions}
                    projectFiles={projectFiles}
                    repos={repos}
                    isContributor={isContributor}
                    isOwner={isOwner}
                    openWeeklyPrompt={searchParams.focus === "weekly"}
                  />
                </Suspense>
              </section>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            {/* Current work — the README's natural follow-up: what's done, in
                progress, and up next. (Milestones previously had no home on the
                page; they only surfaced as completed events in Activity.) */}
            <div className="min-w-0" style={sectionStyle("work")}>
              <section
                id="project-current-work"
                aria-labelledby="project-current-work-heading"
                className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
              >
                <div>
                  <h2
                    id="project-current-work-heading"
                    className="font-display text-lg font-semibold tracking-tight"
                  >
                    Current work
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Milestones the team is moving through — what's done, in progress, and up next.
                  </p>
                </div>
                <div className="mt-4">
                  <Suspense fallback={<Skeleton className="h-32" />}>
                    <MilestonesTimeline milestones={milestones} projectId={id} isOwner={isOwner} />
                  </Suspense>
                </div>
              </section>
            </div>

            <div className="min-w-0" style={sectionStyle("work")}>
              <Suspense fallback={<Skeleton className="h-24" />}>
                <ProjectNeeds needs={needs} projectId={id} canManage={isOwner || isContributor} />
              </Suspense>
            </div>

            {/* People & roles */}
            <div className="min-w-0" style={sectionStyle("people")}>
              <section
                id="project-people"
                aria-labelledby="project-people-heading"
                className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
              >
                <h2
                  id="project-people-heading"
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  People
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Who's building this, and the roles they're looking to fill.
                </p>
                <div className="mt-4">
                  <Suspense fallback={<Skeleton className="h-48" />}>
                    <ProjectPeopleTab
                      projectId={id}
                      projectTitle={project.title}
                      contributors={contributors}
                      avatarSigned={avatarSigned}
                      openRoles={openRoles}
                      isOwner={isOwner}
                      isContributor={isContributor}
                    />
                  </Suspense>
                </div>
              </section>
            </div>

            {/* Sessions — live working time on this project, visible to the team. */}
            {isContributor && (
              <div className="min-w-0" style={sectionStyle("work")}>
                <section
                  id="project-sessions"
                  aria-labelledby="project-sessions-heading"
                  className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id="project-sessions-heading"
                        className="font-display text-lg font-semibold tracking-tight"
                      >
                        Sessions
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Live working time on this project — past, present, and next.
                      </p>
                    </div>
                    {isContributor && (
                      <button
                        type="button"
                        onClick={() => setScheduleOpen(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <CalendarPlus className="h-3 w-3" />
                        Schedule session
                      </button>
                    )}
                  </div>

                  {projectSessions.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No sessions scheduled for this project yet.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-border/50">
                      {projectSessions.map((s) => (
                        <li key={s.id}>
                          <Link
                            to="/sessions/$id"
                            params={{ id: s.id }}
                            className="flex items-center justify-between gap-4 py-3 transition hover:bg-surface-elevated/40"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{s.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {s.starts_at
                                  ? new Date(s.starts_at).toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "Unscheduled"}
                                {s.organizer?.display_name ? ` · ${s.organizer.display_name}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                              {s.status.replace(/_/g, " ")}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {/* Challenges — structured builds tied to this project. */}
            <div className="min-w-0" style={sectionStyle("work")}>
              <section
                id="project-challenges"
                aria-labelledby="project-challenges-heading"
                className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="project-challenges-heading"
                      className="font-display text-lg font-semibold tracking-tight"
                    >
                      Challenges
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Structured builds tied to this project — join one to level up and earn
                      evidence.
                    </p>
                  </div>
                  {isContributor && (
                    <Suspense fallback={null}>
                      <CreateChallengeDialog projectId={id} />
                    </Suspense>
                  )}
                </div>

                {projectChallenges.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No challenges tied to this project yet.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border/50">
                    {projectChallenges.map((c) => (
                      <li key={c.id}>
                        <Link
                          to="/challenges/$id"
                          params={{ id: c.id }}
                          className="flex items-center justify-between gap-4 py-3 transition hover:bg-surface-elevated/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {c.difficulty}
                              {c.end_date
                                ? ` · ends ${new Date(c.end_date).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                            {c.type.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Conversation */}
            <div className="min-w-0" style={sectionStyle("conversation")}>
              <section
                id="project-discussions"
                aria-labelledby="project-discussions-heading"
                className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
              >
                <h2
                  id="project-discussions-heading"
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  Conversation
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Questions, feedback, and updates from the team.
                </p>
                <div className="mt-4 space-y-6">
                  <Suspense fallback={<Skeleton className="h-32" />}>
                    <ProjectDiscussions
                      discussions={discussions}
                      projectId={id}
                      isContributor={isContributor}
                      isOwner={isOwner}
                    />
                  </Suspense>
                  <Suspense fallback={<Skeleton className="h-24" />}>
                    <ProjectCommunityPosts projectId={id} />
                  </Suspense>
                </div>
              </section>
            </div>

            {/* Evidence */}
            <div className="min-w-0" style={sectionStyle("evidence")}>
              <section id="project-evidence" className="scroll-mt-24">
                <Suspense fallback={<Skeleton className="h-24" />}>
                  <ProjectCredits projectId={id} />
                </Suspense>
              </section>
            </div>
          </div>
        </div>
      </div>

      {joinModalOpen && (
        <Suspense fallback={null}>
          <ProjectJoinModal
            open={joinModalOpen}
            projectId={id}
            projectTitle={project.title}
            openRoles={openRoles}
            meId={me?.userId ?? null}
            onClose={() => setJoinModalOpen(false)}
          />
        </Suspense>
      )}

      {scheduleOpen && (
        <Suspense fallback={null}>
          <ScheduleSessionWizard
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            projectId={id}
          />
        </Suspense>
      )}

      {projectSearchOpen && (
        <Suspense fallback={null}>
          <ProjectSearchDialog
            open={projectSearchOpen}
            onOpenChange={setProjectSearchOpen}
            projectFiles={projectFiles}
            discussions={discussions}
            readme={project.readme}
            onJumpFile={jumpToFile}
            onJumpDiscussion={jumpToDiscussion}
            onJumpSection={jumpToSection}
          />
        </Suspense>
      )}
    </Shell>
  );
}

function ProjectSectionNav({ sectionOrder }: { sectionOrder: ProjectSectionKey[] }) {
  const sections: Record<ProjectSectionKey, { id: string; label: string }> = {
    overview: { id: "project-homepage-heading", label: "Overview" },
    work: { id: "project-current-work", label: "Work" },
    people: { id: "project-people", label: "People" },
    conversation: { id: "project-discussions", label: "Conversation" },
    evidence: { id: "project-evidence", label: "Evidence" },
  };

  return (
    <nav aria-label="Project sections" className="mt-6 border-y border-border/60 py-3">
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
        <span className="section-label shrink-0">Jump to</span>
        {sectionOrder.map((sectionKey) => {
          const section = sections[sectionKey];
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function Shell({
  children,
  accentColor,
}: {
  children: React.ReactNode;
  accentColor?: string | null;
}) {
  const navigate = useNavigate();
  const accentStyle = accentColor
    ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
    : undefined;
  return (
    <div className="min-h-screen bg-background" style={accentStyle}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
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
