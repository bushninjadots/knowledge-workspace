// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors, project_skills,
// milestones, updates, discussions and open roles all carry public SELECT
// policies. Single-scroll layout: full-bleed hero → two-column (sticky
// sidebar + main content) with a scroll-spy dot nav on the left.
import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  notFound,
  useParams,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Trophy, Clock, Users as UsersIcon, MessageCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Until Supabase types are regenerated after migration, cast new columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE } from "@/components/tethyr/profile-sections";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useProjectScrollSpy } from "@/hooks/use-project-scroll-spy";
import {
  useMilestones,
  useProjectUpdates,
  useDiscussions,
  useOpenRoles,
  useUpdateProjectStage,
  type ProjectDetail,
  type ProjectStage,
} from "@/hooks/use-projects";
import { ProjectHero } from "@/components/tethyr/project/project-hero";
import { ProjectScrollSpy } from "@/components/tethyr/project/project-scroll-spy";
import { ProjectSidebar } from "@/components/tethyr/project/project-sidebar";
import {
  ProjectMainContent,
  type Contributor,
  type ProjectSection,
} from "@/components/tethyr/project/project-main-content";
import { ProjectJoinModal } from "@/components/tethyr/project/project-join-modal";
import { useProjectCommunityPostCount } from "@/components/tethyr/project/project-community-posts";
import type { ProjectFile } from "@/components/tethyr/project/project-files";

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
  const navigate = useNavigate();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  // Which role to spotlight when the modal opens (from the sidebar's per-role Apply).
  const [joinRoleId, setJoinRoleId] = useState<string | null>(null);

  // Deep-link: ?section=roles scrolls to that section once the page has data.
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const sectionParam = searchParams.section;

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      // Try full column set first; fall back if extended columns are missing.
      const FULL_COLS =
        "id, profile_id, title, description, goal, vision, status, stage, started_at, progress_percent, cover_url, gallery, resources, links, tags, uploaded_files, looking_for_feedback, looking_for_collaborators, is_featured";
      // Fallback deliberately omits the newest column (uploaded_files) so a
      // database that hasn't run the latest migration still loads every project.
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
  const updateStage = useUpdateProjectStage();

  // Fetch new sections data
  const { data: milestones = [] } = useMilestones(id);
  const { data: updates = [] } = useProjectUpdates(id);
  const { data: discussions = [] } = useDiscussions(id);
  const { data: openRoles = [] } = useOpenRoles(id);
  const { data: communityPostCount = 0 } = useProjectCommunityPostCount(id);

  const isOwner = !!me?.userId && data?.project.profile_id === me?.userId;

  // Sections are driven by the data so the scroll-spy and content never drift.
  // Owners always get gallery/resources sections (even empty) so they can add
  // the first item — the sub-components self-hide for non-owners when empty.
  const sections = useMemo(() => {
    if (!data) return [] as ProjectSection[];
    const { project, contributors, skills } = data;
    const s: ProjectSection[] = [];
    if (project.vision) s.push({ id: "vision", label: "Vision" });
    if (project.description) s.push({ id: "about", label: "About" });
    if (project.goal) s.push({ id: "goals", label: "Goal" });
    if (skills.length > 0 || project.tags.length > 0) s.push({ id: "skills", label: "Skills" });
    if (openRoles.length > 0) s.push({ id: "roles", label: "Open Roles" });
    if (milestones.length > 0) s.push({ id: "milestones", label: "Milestones" });
    if (updates.length > 0) s.push({ id: "journal", label: "Journal" });
    if (discussions.length > 0) s.push({ id: "discussion", label: "Discussion" });
    if (contributors.length > 0) s.push({ id: "contributors", label: "Contributors" });
    if (isOwner || (project.gallery ?? []).length > 0) s.push({ id: "gallery", label: "Gallery" });
    if (isOwner || (project.resources ?? []).length > 0)
      s.push({ id: "resources", label: "Resources" });
    if (isOwner || ((project.uploaded_files ?? []) as ProjectFile[]).length > 0)
      s.push({ id: "files", label: "Files" });
    if (isOwner) s.push({ id: "repos", label: "Repositories" });
    s.push({ id: "community", label: "Community" });
    return s;
  }, [data, openRoles, milestones, updates, discussions, isOwner]);

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const { activeSection, scrollTo } = useProjectScrollSpy(sectionIds);

  // Scroll to a deep-linked section (e.g. ?section=roles) once data is ready.
  useEffect(() => {
    if (!data || !sectionParam) return;
    const t = setTimeout(() => {
      document.getElementById(sectionParam)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, [data, sectionParam]);

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
  const isContributor = isOwner || contributors.some((c) => c.profile_id === me?.userId);
  const canJoin = !!me?.userId && !isOwner && !isContributor;
  const isSignedOut = !me?.userId && !isOwner && !isContributor;
  // Signed-out visitors go to /login?redirect=/projects/:id and come back to the join modal.
  const signInToJoin = () =>
    navigate({
      to: "/login",
      search: { redirect: `/projects/${id}` } as Record<string, string>,
    });
  const timeSinceStart = project.started_at
    ? formatDistanceToNowStrict(new Date(project.started_at), { addSuffix: true })
    : null;
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);
  const doneCount = milestones.filter((m) => m.status === "done").length;

  return (
    <Shell accentColor={accent}>
      <ProjectHero
        project={project}
        coverSigned={coverSigned}
        creator={creator}
        avatarSigned={avatarSigned}
        onJoin={
          canJoin
            ? () => {
                setJoinRoleId(null);
                setJoinModalOpen(true);
              }
            : undefined
        }
        onSignIn={isSignedOut ? signInToJoin : undefined}
        onPostUpdate={
          isOwner || isContributor
            ? () =>
                navigate({
                  to: "/community",
                  search: { attach_project: id } as Record<string, string>,
                })
            : undefined
        }
      />

      <ProjectScrollSpy
        sections={sections}
        activeSection={activeSection}
        onSectionClick={scrollTo}
      />

      <div className="animate-room-enter min-h-screen bg-noise">
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            {/* Status + meta strip */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${PROJECT_STATUS_STYLE[project.status]}`}
              >
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
              {project.is_featured && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
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
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-purple/40 bg-brand-purple/10 px-2.5 py-0.5 text-brand-purple">
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

            {/* Progress summary */}
            <div className="flex items-center gap-3">
              <Progress value={project.progress_percent} className="h-2 flex-1" />
              <span className="shrink-0 text-xs text-muted-foreground">
                {project.progress_percent}% complete
                {milestones.length > 0 && ` · ${doneCount}/${milestones.length} milestones`}
              </span>
            </div>

            {/* Single-scroll content */}
            <ProjectMainContent
              project={project}
              projectFiles={(project.uploaded_files ?? []) as ProjectFile[]}
              contributors={contributors}
              skills={skills}
              links={links}
              milestones={milestones}
              updates={updates}
              discussions={discussions}
              openRoles={openRoles}
              avatarSigned={avatarSigned}
              isOwner={isOwner}
              isContributor={isContributor}
              sections={sections}
            />
          </div>

          {/* Sticky sidebar */}
          <ProjectSidebar
            project={project}
            skills={skills}
            links={links}
            openRoles={openRoles}
            milestones={milestones}
            contributors={contributors}
            isOwner={isOwner}
            isContributor={isContributor}
            onOpenRoleApply={(roleId) => {
              setJoinRoleId(roleId);
              setJoinModalOpen(true);
            }}
            onJoin={
              canJoin
                ? () => {
                    setJoinRoleId(null);
                    setJoinModalOpen(true);
                  }
                : undefined
            }
            onSignIn={isSignedOut ? signInToJoin : undefined}
          />
        </div>
        </div>
      </div>

      <ProjectJoinModal
        open={joinModalOpen}
        projectId={id}
        openRoles={openRoles}
        meId={me?.userId ?? null}
        focusRoleId={joinRoleId}
        onClose={() => {
          setJoinRoleId(null);
          setJoinModalOpen(false);
        }}
      />
    </Shell>
  );
}

const ROLE_ORDER: Record<Contributor["role"], number> = {
  creator: 0,
  mentor: 1,
  contributor: 2,
};

type SkillLite = { id: string; slug: string; name: string; category: string };

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
