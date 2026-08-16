// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors, project_skills,
// milestones, updates, discussions and open roles all carry public SELECT
// policies. Repository-workspace layout: compact header → sticky tab bar
// (README as homepage, with Files / Activity / People / Discussions) below.
import { useCallback, useEffect, useState } from "react";
import {
  createFileRoute,
  notFound,
  useParams,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
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
  type ProjectDetail,
} from "@/hooks/use-projects";
import { useProjectRepos } from "@/hooks/use-project-repos";
import { ProjectHeader } from "@/components/tethyr/project/project-header";
import { ProjectTabs, type ProjectTab } from "@/components/tethyr/project/project-tabs";
import { ProjectReadmeTab } from "@/components/tethyr/project/project-readme";
import { ProjectNeeds } from "@/components/tethyr/project/project-needs";
import { ProjectCredits } from "@/components/tethyr/project/project-credits";
import { ProjectFilesExplorer } from "@/components/tethyr/project/project-files-explorer";
import { ProjectActivityTab } from "@/components/tethyr/project/project-activity";
import { ProjectPeopleTab } from "@/components/tethyr/project/project-people";
import { ProjectDiscussions } from "@/components/tethyr/project/project-discussions";
import {
  ProjectCommunityPosts,
  useProjectCommunityPostCount,
} from "@/components/tethyr/project/project-community-posts";
import { ProjectJoinModal } from "@/components/tethyr/project/project-join-modal";
import { ProjectSearchDialog } from "@/components/tethyr/project/project-search";
import type { Contributor } from "@/components/tethyr/project/project-main-content";
import type { ProjectFile } from "@/components/tethyr/project/project-files";

export const Route = createFileRoute("/projects/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Project — Tethyr" },
      {
        name: "description",
        content: "Explore this project and the work being built with Tethyr.",
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

const TAB_IDS: ProjectTab[] = ["files", "activity", "people", "discussions"];

function isTab(value: unknown): value is ProjectTab {
  return typeof value === "string" && (TAB_IDS as string[]).includes(value);
}

function ProjectPage() {
  const { id } = useParams({ from: "/projects/$id" });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [preselectPath, setPreselectPath] = useState<string | null>(null);
  const [preselectNonce, setPreselectNonce] = useState(0);

  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const tabParam = searchParams.tab;
  const [tab, setTabState] = useState<ProjectTab | null>(() => (isTab(tabParam) ? tabParam : null));

  // Keep the tab in sync with the URL (back/forward, deep links).
  useEffect(() => {
    if (isTab(tabParam) && tabParam !== tab) setTabState(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const jumpToDiscussion = useCallback(
    (discussionId: string) => {
      setTab("discussions", { scrollToTop: false });
      // Double-rAF + timeout: let the discussions tab mount before scrolling.
      requestAnimationFrame(() => {
        setTimeout(() => {
          document
            .getElementById(`discussion-${discussionId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      });
    },
    [setTab],
  );

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

      if (e.key >= "1" && e.key <= "4") {
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
        "id, profile_id, title, description, goal, vision, status, visibility, stage, started_at, progress_percent, cover_url, gallery, resources, links, tags, uploaded_files, readme, tools, looking_for_feedback, looking_for_collaborators, is_featured";
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
  const { data: communityPostCount = 0 } = useProjectCommunityPostCount(id);

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
  const creator = contributors.find((c) => c.role === "creator");
  const isContributor = isOwner || contributors.some((c) => c.profile_id === me?.userId);
  const canJoin = !!me?.userId && !isOwner && !isContributor;
  const isSignedOut = !me?.userId && !isOwner && !isContributor;
  const signInToJoin = () =>
    navigate({
      to: "/login",
      search: { redirect: `/projects/${id}` } as Record<string, string>,
    });
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);
  const projectFiles = (project.uploaded_files ?? []) as ProjectFile[];
  const repoStats = repos[0]?.metadata
    ? {
        language: repos[0].metadata.language ?? null,
        stars: repos[0].metadata.stargazers_count ?? undefined,
        forks: repos[0].metadata.forks_count ?? undefined,
      }
    : undefined;

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
        onJoin={canJoin ? () => setJoinModalOpen(true) : undefined}
        onSignIn={isSignedOut ? signInToJoin : undefined}
        onPostUpdate={isOwner || isContributor ? () => setTab("activity") : undefined}
        onOpenDiscussions={() => setTab("discussions")}
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
            />
          </section>

          <ProjectNeeds needs={needs} projectId={id} canManage={isOwner || isContributor} />

          {/* Secondary workspace navigation: deeper project evidence and collaboration views. */}
          <div role="group" aria-label="Project workspace views" className="mt-10">
            <ProjectTabs
              active={tab}
              onSelect={setTab}
              counts={{
                files: projectFiles.length,
                discussions: discussions.length + communityPostCount,
              }}
            />
          </div>

          <div className="pt-6">
            {tab === "files" && (
              <section aria-label="Project files">
                <ProjectFilesExplorer
                  projectId={id}
                  projectFiles={projectFiles}
                  isOwner={isOwner}
                  preselectPath={preselectPath}
                  preselectNonce={preselectNonce}
                />
              </section>
            )}
            {tab === "activity" && (
              <section aria-label="Project activity">
                <ProjectActivityTab
                  projectId={id}
                  milestones={milestones}
                  updates={updates}
                  discussions={discussions}
                  projectFiles={projectFiles}
                  repos={repos}
                  isContributor={isContributor}
                />
              </section>
            )}
            {tab === "people" && (
              <section aria-label="Project people">
                <ProjectPeopleTab
                  projectId={id}
                  contributors={contributors}
                  avatarSigned={avatarSigned}
                  openRoles={openRoles}
                  isOwner={isOwner}
                  isContributor={isContributor}
                />
              </section>
            )}
            {tab === "discussions" && (
              <section aria-label="Project discussions" className="space-y-6">
                <ProjectDiscussions
                  discussions={discussions}
                  projectId={id}
                  isContributor={isContributor}
                  isOwner={isOwner}
                />
                <ProjectCommunityPosts projectId={id} />
              </section>
            )}
          </div>

          <ProjectCredits projectId={id} />
        </div>
      </div>

      <ProjectJoinModal
        open={joinModalOpen}
        projectId={id}
        openRoles={openRoles}
        meId={me?.userId ?? null}
        onClose={() => setJoinModalOpen(false)}
      />

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
    </Shell>
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
