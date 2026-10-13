import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LinkedSpaceCard } from "@/components/tethyr/community/linked-space-card";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useMilestones,
  useProjectUpdates,
  useDiscussions,
  useOpenRoles,
  useProjectNeeds,
  useUpdateProjectPresentation,
  useProjectCommunityPostCount,
  useProjectActivity,
  useForkProject,
  useProjectForks,
  type ProjectDetail,
} from "@/hooks/use-projects";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { getProjectPresentationOption, type ProjectSectionKey } from "@/lib/project-presentation";
import { useProjectRepos } from "@/hooks/use-project-repos";
import { useRelatedProjects } from "@/hooks/use-related-projects";
import { useProjectSessions } from "@/hooks/use-sessions";
import { useProjectChallenges } from "@/hooks/use-challenges";
import { ProjectChallengesSection } from "@/components/tethyr/project/project-challenges-section";
import { ProjectSessionsSection } from "@/components/tethyr/project/project-sessions-section";
import { ProjectHeader } from "@/components/tethyr/project/project-header";
import { useMarkProjectVisited } from "@/hooks/use-project-loop";
import {
  ProjectWorkbench,
  type ProjectWorkbenchAction,
} from "@/components/tethyr/project/project-workbench";
import { ProjectTabs, type ProjectTab } from "@/components/tethyr/project/project-tabs";
import { ProjectReadmeTab } from "@/components/tethyr/project/project-readme";
import { ProjectLiveRoom } from "@/components/tethyr/project/project-live-room";
import { getRepoFullName } from "@/lib/github";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectFile } from "@/components/tethyr/project/project-files";
import { SectionShell } from "@/components/tethyr/section-shell";
import { ProjectGraphSummary } from "@/components/tethyr/project/project-graph-summary";
import { projectContributionsFromLog, projectHistoryFromActivity } from "@/lib/project-graph";
import { fetchProjectContributionLog, fetchProjectPage } from "./-projects-page-data";

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
const ProjectCommunityPosts = lazy(() =>
  import("@/components/tethyr/project/project-community-posts").then((m) => ({
    default: m.ProjectCommunityPosts,
  })),
);
const RelatedProjectsSection = lazy(() =>
  import("@/components/tethyr/project/project-related").then((m) => ({
    default: m.RelatedProjectsSection,
  })),
);
const ProjectJoinModal = lazy(() =>
  import("@/components/tethyr/project/project-join-modal").then((m) => ({
    default: m.ProjectJoinModal,
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

const TAB_IDS: ProjectTab[] = ["files", "activity"];

function isTab(value: unknown): value is ProjectTab {
  return typeof value === "string" && (TAB_IDS as string[]).includes(value);
}
export function ProjectPage() {
  const { id } = useParams({ from: "/projects/$id" });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [preselectPath, setPreselectPath] = useState<string | null>(null);
  const [preselectNonce, setPreselectNonce] = useState(0);
  const [presentationSaveState, setPresentationSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const presentationResetTimer = useRef<number | null>(null);

  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const tabParam = searchParams.tab;

  const [postRequest, setPostRequest] = useState(0);
  // Activity is open by default: the tabs sit under the README, and with
  // nothing selected they left an empty band there.
  const [tab, setTabState] = useState<ProjectTab | null>(() =>
    isTab(tabParam) ? tabParam : "activity",
  );

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
        // Only the URL changes; the router's reset-to-top on navigation sent
        // people away from the tab they had just opened.
        resetScroll: false,
      });
      // The tabs live mid-page; jumping to the top took people away from the
      // content they just opened. Bring the tabs into view only if needed.
      if (opts?.scrollToTop !== false) {
        document
          .getElementById("project-workspace-tabs")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
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

  const openProjectActivity = useCallback(
    (focus: "contribution" | "weekly" = "contribution") => {
      setTab("activity", { scrollToTop: false });
      setTimeout(() => {
        scrollToSection("project-activity");
        window.dispatchEvent(
          new CustomEvent("tethyr:project-activity-focus", { detail: { focus } }),
        );
      }, 80);
    },
    [scrollToSection, setTab],
  );

  // "Link repository" from the README code panel — jump to the Files tab's
  // connected-repositories section so the GitHub import is one click away.
  const linkRepo = useCallback(() => {
    setTab("files", { scrollToTop: false });
    let attempts = 0;
    const tryScroll = () => {
      attempts += 1;
      const el = document.getElementById("project-repos");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts < 10) {
        setTimeout(tryScroll, 150);
      }
    };
    setTimeout(tryScroll, 120);
  }, [setTab]);

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
    // §29 — the fork parent gate depends on the viewer, so the cache must too.
    queryKey: ["project-detail", id, me?.userId ?? null],
    queryFn: () => fetchProjectPage(id, me?.userId ?? null),
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
  // Project graph connections. The activity feed is the project's real event
  // history — contribution entries become contribution nodes, the rest become
  // dated timeline events. The related-project engine (same one behind "More to
  // explore") supplies lineage edges to sibling projects.
  const { data: activityRows = [] } = useProjectActivity(id);
  // The contribution ledger credits work to people; it is the same source the
  // profile contribution graph reads.
  const { data: contributionLog = [] } = useQuery({
    queryKey: ["project-contributions", id],
    queryFn: () => fetchProjectContributionLog(id),
    enabled: !!id,
  });
  const { data: relatedProjects = [] } = useRelatedProjects({
    projectId: id,
    tags: data?.project?.tags ?? [],
    skillIds: (data?.skills ?? []).map((skill) => skill.id),
    contributorIds: (data?.contributors ?? []).map((contributor) => contributor.profile_id),
  });
  const { data: forks = [] } = useProjectForks(id);

  // Spec §7 — the GitHub commits already imported onto the project become
  // graph contributions, carrying the repository and author the import named.
  const importedCommits = activityRows
    .filter((row) => row.kind === "github_commit")
    .map((row) => {
      const meta = (row.metadata ?? {}) as {
        repository?: string | null;
        url?: string | null;
        author_login?: string | null;
        author_name?: string | null;
      };
      return {
        id: row.id,
        label: row.title,
        authorLogin: meta.author_login ?? null,
        authorName: meta.author_name ?? null,
        date: row.created_at,
        url: meta.url ?? null,
        repository: meta.repository ?? null,
      };
    });
  const updatePresentation = useUpdateProjectPresentation();
  const markProjectVisited = useMarkProjectVisited();
  const forkProject = useForkProject();

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
        <div className="space-y-6 p-8" aria-hidden="true">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
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

  const {
    project,
    contributors,
    skills,
    coverSigned,
    avatarSigned,
    contributorsDegraded,
    forkedFrom,
    aiTagCount,
    aiUserTagged,
  } = data;
  const presentation = getProjectPresentationOption(project.presentation_preset);
  const creator = contributors.find((c) => c.role === "creator");
  const isContributor = isOwner || contributors.some((c) => c.profile_id === me?.userId);
  const canJoin = !!me?.userId && !isOwner && !isContributor;
  // A project can be forked by any signed-in visitor other than its owner, and
  // only when the owner has opted in.
  const canFork = !!me?.userId && !isOwner && !!project.allow_forks;
  const handleFork = () =>
    forkProject.mutate(
      { projectId: id },
      {
        onSuccess: (newId) => {
          toast.success("Forked — your copy is a private draft until you publish it");
          navigate({ to: "/projects/$id", params: { id: newId } });
        },
        onError: (err) => toast.error(friendlyError(err)),
      },
    );
  const hasOpenWork =
    needs.some((need) => !need.is_filled) || openRoles.some((role) => !role.is_filled);
  const roomIdentity = me?.userId
    ? {
        userId: me.userId,
        name: me.profile?.display_name ?? me.profile?.handle ?? "A builder",
        handle: me.profile?.handle ?? null,
      }
    : null;
  const isSignedOut = !me?.userId && !isOwner && !isContributor;
  const signInToJoin = () =>
    navigate({
      to: "/login",
      search: { redirect: `/projects/${id}` } as Record<string, string>,
    });

  const handleWorkbenchAction = (action: ProjectWorkbenchAction) => {
    if (action === "update") {
      openProjectActivity("contribution");
      return;
    }
    const sectionByAction: Partial<Record<ProjectWorkbenchAction, string>> = {
      demonstrations: "project-demonstrations",
      readme: "project-homepage-heading",
      needs: "project-needs",
      milestones: "project-current-work",
      people: "project-people",
      join: "project-people",
      discussions: "project-discussions",
    };
    const sectionId = sectionByAction[action];
    if (sectionId) scrollToSection(sectionId);
  };
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);
  const projectFiles = (project.uploaded_files ?? []) as ProjectFile[];
  const repoStats = repos[0]
    ? {
        language: repos[0].metadata?.language ?? null,
        stars: repos[0].metadata?.stargazers_count ?? undefined,
        forks: repos[0].metadata?.forks_count ?? undefined,
        url: repos[0].url ?? null,
        name: getRepoFullName(repos[0]) ?? null,
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
        forkedFrom={forkedFrom}
        forkCount={project.fork_count ?? 0}
        canFork={canFork}
        onFork={handleFork}
        onJoin={canJoin ? () => setJoinModalOpen(true) : undefined}
        onSignIn={isSignedOut ? signInToJoin : undefined}
        onPostUpdate={
          isOwner || isContributor
            ? () => {
                // Opens the update form itself, not just the Activity list.
                setTab("activity", { scrollToTop: false });
                setPostRequest((n) => n + 1);
                setTimeout(() => scrollToSection("project-activity"), 80);
              }
            : undefined
        }
        onOpenDiscussions={() => scrollToSection("project-discussions")}
        onOpenNeeds={() => scrollToSection("project-needs")}
        onOpenPeople={() => scrollToSection("project-people")}
        aiTagCount={aiTagCount}
        aiUserTagged={aiUserTagged}
        canAiTag={!!me?.userId && !isOwner}
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

      {/* The interactive workspace IS the canonical project page — README,
          files/activity tools, current work, people, conversation, and evidence
          all render here for every project. */}
      <div className="animate-room-enter min-h-screen bg-noise">
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-8">
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
              onLinkRepo={linkRepo}
            />
          </section>

          <ProjectSectionNav sectionOrder={presentation.sectionOrder} />

          {/* Files + activity live right under the README so the workspace tools
              (upload files, see what changed) are reachable without scrolling
              past the whole story. */}
          <div
            id="project-workspace-tabs"
            role="group"
            aria-label="Project files and activity"
            className="mt-6 scroll-mt-20"
          >
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
                    postRequest={postRequest}
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
              <ProjectGraphSummary
                input={{
                  project: {
                    id: project.id,
                    title: project.title,
                    description: project.description,
                    visibility: project.visibility,
                    profile_id: project.profile_id,
                    status: project.status,
                    stage: project.stage,
                  },
                  contributors: contributors.map((contributor) => ({
                    profile_id: contributor.profile_id,
                    role: contributor.role,
                    profile: contributor.profile,
                    skills_used: contributor.skills_used,
                  })),
                  milestones: milestones.map((milestone) => ({
                    id: milestone.id,
                    title: milestone.title,
                    description: milestone.description,
                    status: milestone.status,
                  })),
                  skills: skills.map((skill) => ({ id: skill.id, name: skill.name })),
                  roles: openRoles.map((role) => ({
                    id: role.id,
                    title: role.title,
                    is_filled: role.is_filled,
                    filled_by: role.filled_by,
                  })),
                  discussions: discussions.map((discussion) => ({
                    id: discussion.id,
                    title: discussion.title,
                  })),
                  needs: needs.map((need) => ({
                    id: need.id,
                    title: need.title,
                  })),
                  repositories: repos.map((repo) => ({
                    id: repo.id,
                    name: repo.metadata.full_name ?? repo.url,
                    url: repo.url,
                    provider: repo.provider,
                    importedAt: repo.created_at,
                    fullName: getRepoFullName(repo),
                    language: repo.metadata.language ?? null,
                    topics: repo.metadata.topics ?? null,
                  })),
                  importedCommits,
                  contributions: projectContributionsFromLog(contributionLog),
                  history: projectHistoryFromActivity(activityRows),
                  forkedFrom: forkedFrom ? { id: forkedFrom.id, title: forkedFrom.title } : null,
                  relatedProjects: [
                    ...relatedProjects.map((related) => ({
                      id: related.id,
                      title: related.title,
                      description: related.description,
                      relationship: "related_to" as const,
                    })),
                    ...forks.map((fork) => ({
                      id: fork.id,
                      title: fork.title,
                      description: fork.description,
                      relationship: "derived_from" as const,
                    })),
                  ],
                }}
              />
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
                      degraded={contributorsDegraded}
                      avatarSigned={avatarSigned}
                      openRoles={openRoles}
                      isOwner={isOwner}
                      isContributor={isContributor}
                      openNeedCount={needs.filter((need) => !need.is_filled).length}
                      onJoin={canJoin ? () => setJoinModalOpen(true) : undefined}
                      onSignIn={isSignedOut ? signInToJoin : undefined}
                      onOpenNeeds={() => scrollToSection("project-needs")}
                    />
                  </Suspense>
                </div>
              </section>
            </div>

            {/* Live "jump in" room — real-time co-presence for projects that are
                actively looking for help. Ephemeral presence + scratch chat that
                can be formalized into a real session. */}
            {hasOpenWork && (
              <div className="min-w-0" style={sectionStyle("work")}>
                <ProjectLiveRoom
                  projectId={id}
                  me={roomIdentity}
                  canStartSession={isContributor}
                  onStartSession={() => setScheduleOpen(true)}
                  onSignIn={isSignedOut ? signInToJoin : undefined}
                />
              </div>
            )}

            {/* Sessions — live working time on this project, visible to the team. */}
            {isContributor && (
              <div className="min-w-0" style={sectionStyle("work")}>
                <ProjectSessionsSection
                  sessions={projectSessions}
                  canSchedule={isContributor}
                  onSchedule={() => setScheduleOpen(true)}
                />
              </div>
            )}

            {/* Challenges — structured builds tied to this project. */}
            <div className="min-w-0" style={sectionStyle("work")}>
              <ProjectChallengesSection
                projectId={id}
                challenges={projectChallenges}
                canCreate={isContributor}
              />
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
                  The team&rsquo;s threads, and what the community is saying about this project.
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
                  <LinkedSpaceCard kind="project" id={id} canStart={isOwner} />
                  <Suspense fallback={<Skeleton className="h-24" />}>
                    <ProjectCommunityPosts
                      projectId={id}
                      canAsk={isContributor}
                      project={{
                        id,
                        title: project.title,
                        description: project.description,
                        status: project.status,
                        stage: project.stage,
                        skills,
                      }}
                    />
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

          {/* Related projects — discovery surface at the end of the story */}
          <RelatedProjectsSection
            project={{ id, tags: project.tags, profile_id: project.profile_id }}
            skills={skills}
            contributors={contributors}
          />
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

const PROJECT_SECTIONS: Record<ProjectSectionKey, { id: string; label: string }> = {
  overview: { id: "project-homepage-heading", label: "Overview" },
  work: { id: "project-current-work", label: "Work" },
  people: { id: "project-people", label: "People" },
  conversation: { id: "project-discussions", label: "Conversation" },
  evidence: { id: "project-evidence", label: "Evidence" },
};

function ProjectSectionNav({ sectionOrder }: { sectionOrder: ProjectSectionKey[] }) {
  const [activeSection, setActiveSection] = useState<string>("project-homepage-heading");

  useEffect(() => {
    const targets = sectionOrder
      .map((sectionKey) => document.getElementById(PROJECT_SECTIONS[sectionKey].id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sectionOrder]);

  return (
    <nav
      aria-label="Project sections"
      className="sticky top-16 z-20 mt-6 border-y border-border/60 bg-background/90 py-3 backdrop-blur-sm"
    >
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
        <span className="section-label shrink-0">Jump to</span>
        {sectionOrder.map((sectionKey) => {
          const section = PROJECT_SECTIONS[sectionKey];
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`shrink-0 rounded-md px-2 py-1 text-sm underline-offset-4 transition-lift hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeSection === section.id
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
              aria-current={activeSection === section.id ? "location" : undefined}
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
  const accentStyle: React.CSSProperties = {
    ...(accentColor
      ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
      : {}),
  };
  // The shared section frame owns the sidebar navigation and the Back button
  // (same chrome as every other hub page); the accent var still cascades
  // into the project's cards below.
  return <SectionShell style={accentStyle}>{children}</SectionShell>;
}
