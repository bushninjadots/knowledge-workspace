// Dashboard module rows — the demoted half of the dashboard workspace.
//
// The priority zone above the grid previews one thing in full: the project the
// member is in the middle of. Everything else earns a compact row — label, one
// line of real content, and the one action that leads to the surface where that
// content lives in full. Rows fetch their own data, so a hidden module costs
// nothing.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, Folder, Kanban, Sparkles, Star, Swords, Ticket, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CreateProjectButton } from "@/components/tethyr/create-project-button";
import { describeActivity, relativeActivityTime } from "@/components/tethyr/activity-timeline";
import type { ActivityRow, ProjectRow } from "@/components/tethyr/profile-sections";
import { useChallenges } from "@/hooks/use-challenges";
import { useConnections } from "@/hooks/use-connections";
import { useCurrentUser, useTrendingSkills } from "@/hooks/use-current-user";
import { useMyProjects } from "@/hooks/use-projects";
import { useWatchedProjects } from "@/hooks/use-project-loop";
import { supabase } from "@/integrations/supabase/client";
import { isColumnSchemaError } from "@/lib/supabase-errors";

/** Secondary row actions share one weight so the demoted rows read as one list. */
const ROW_ACTION = "text-[11px] font-medium text-primary hover:underline";

type ApplicationRow = {
  id: string;
  status: string;
  role_id: string;
  created_at: string;
  project_open_roles?: {
    title?: string;
    projects?: { title?: string };
  } | null;
};

/** Projects the member is actively building, most recently touched first. */
export function selectActiveProjects(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter((p) => p.status === "active" || p.status === "planning")
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime(),
    );
}

function Preview({ text }: { text: string }) {
  return (
    <p className="mt-1 truncate text-xs text-muted-foreground" title={text}>
      {text}
    </p>
  );
}

/* ── Module row: compact label · content · action strip ───────────────────── */

function ModuleRow({
  icon,
  title,
  subtitle,
  action,
  degraded,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** True when this row's data source was unavailable (schema drift / load error). */
  degraded?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="h-full min-w-0">
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-3 px-3.5 py-2.5">
          {/* Narrow screens stack the label: a squeezed row truncates titles to
              "Appli…" before it drops a single character of context copy. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
              <h2 className="min-w-0 truncate text-sm font-semibold" title={title}>
                {title}
              </h2>
            </div>
            {subtitle && (
              <span className="min-w-0 truncate text-xs text-muted-foreground" title={subtitle}>
                <span className="hidden sm:inline">— </span>
                {subtitle}
              </span>
            )}
          </div>
          {action && <span className="shrink-0">{action}</span>}
        </div>
        {degraded && (
          <p className="px-3.5 pb-1.5 text-[11px] text-muted-foreground">
            Details are temporarily unavailable.
          </p>
        )}
        {children && <div className="px-3.5 pb-3">{children}</div>}
      </div>
    </Card>
  );
}

function ModuleRowLoading({ title }: { title: string }) {
  return (
    <ModuleRow icon={<Clock className="h-4 w-4" />} title={title}>
      <div className="space-y-2" aria-label={`Loading ${title}`}>
        <div className="h-3 w-2/3 animate-gentle-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-1/2 animate-gentle-pulse rounded bg-surface-elevated" />
      </div>
    </ModuleRow>
  );
}

/* ── Work ─────────────────────────────────────────────────────────────────── */

export function ProjectsModuleRow({ projects }: { projects: ProjectRow[] }) {
  const preview = projects
    .slice(0, 3)
    .map((project) => `${project.title} ${project.progress_percent ?? 0}%`)
    .join(" · ");

  return (
    <ModuleRow
      icon={<Folder className="h-4 w-4" />}
      title="Your projects"
      subtitle={
        projects.length === 0
          ? "Give people a clear place to find what you're building."
          : `${projects.length} active`
      }
      action={
        projects.length === 0 ? (
          <CreateProjectButton label="Start a project" variant="outline" />
        ) : (
          <Link to="/profile" className={ROW_ACTION}>
            View all
          </Link>
        )
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function ApplicationsModuleRow() {
  const { data: me } = useCurrentUser();
  const { data = { items: [], degraded: false }, isLoading } = useQuery({
    queryKey: ["my-applications", me?.userId],
    queryFn: async () => {
      const profileId = me?.userId;
      if (!profileId) return { items: [], degraded: false };
      const { data, error } = await supabase
        .from("project_role_applications")
        .select("id, status, role_id, created_at, project_open_roles(title, projects(title, id))")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        if (isColumnSchemaError(error)) {
          console.warn("[tethyr] applications: schema not published yet — degraded.", error);
        } else {
          console.error("[tethyr] applications: failed to load.", error);
        }
        return { items: [], degraded: true };
      }
      return { items: (data ?? []) as ApplicationRow[], degraded: false };
    },
    enabled: !!me?.userId,
    staleTime: 30_000,
  });
  const { items: applications, degraded } = data;

  if (isLoading) return <ModuleRowLoading title="Applications" />;

  const preview = applications
    .slice(0, 2)
    .map(
      (application) =>
        `${application.project_open_roles?.title ?? "Role"} — ${
          application.project_open_roles?.projects?.title ?? "Project"
        }`,
    )
    .join(" · ");

  return (
    <ModuleRow
      icon={<Ticket className="h-4 w-4" />}
      title="Applications"
      degraded={degraded}
      subtitle={
        applications.length === 0
          ? "Applications you send will stay visible here."
          : `${applications.length} sent`
      }
      action={
        <Link
          to="/explore"
          search={{ tab: "opportunities" } as Record<string, string>}
          className={ROW_ACTION}
        >
          {applications.length === 0 ? "Find open roles →" : "View"}
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function WatchlistModuleRow() {
  const { data: watched = [], isLoading } = useWatchedProjects(8);

  if (isLoading) return <ModuleRowLoading title="Watchlist" />;

  const preview = watched
    .slice(0, 3)
    .map((project) => project.title)
    .join(" · ");

  return (
    <ModuleRow
      icon={<Star className="h-4 w-4" />}
      title="Watchlist"
      subtitle={
        watched.length === 0
          ? "Watch a project to keep it on your dashboard."
          : `${watched.length} watched`
      }
      action={
        watched.length === 0 ? (
          <Link to="/explore" className={ROW_ACTION}>
            Find a project →
          </Link>
        ) : (
          <Link to="/projects/$id" params={{ id: watched[0].id }} className={ROW_ACTION}>
            View
          </Link>
        )
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

/** The member's milestone boards, summarized — the one place that points at the
 *  per-project Roadmap surface most people don't know exists yet. */
export function RoadmapModuleRow() {
  const { data: projects = [], isLoading: loadingProjects } = useMyProjects();
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);

  const { data = { items: [], degraded: false }, isLoading: loadingMilestones } = useQuery({
    queryKey: ["my-milestone-summary", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return { items: [], degraded: false };
      const { data, error } = await supabase
        .from("project_milestones")
        .select("project_id, status")
        .in("project_id", projectIds);
      if (error) {
        if (isColumnSchemaError(error)) {
          console.warn("[tethyr] roadmap: schema not published yet — degraded.", error);
        } else {
          console.error("[tethyr] roadmap: failed to load.", error);
        }
        return { items: [], degraded: true };
      }
      return { items: (data ?? []) as { project_id: string; status: string }[], degraded: false };
    },
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  });
  const { items: milestoneRows, degraded } = data;

  if (loadingProjects || loadingMilestones) return <ModuleRowLoading title="Roadmap" />;

  const active = projects.filter(
    (project) => project.status === "active" || project.status === "planning",
  );
  const anchored = active[0];
  const counts = new Map<string, { total: number; done: number }>();
  for (const row of milestoneRows) {
    const entry = counts.get(row.project_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.status === "done") entry.done += 1;
    counts.set(row.project_id, entry);
  }
  const projectsWithRoadmaps = active.filter((project) => (counts.get(project.id)?.total ?? 0) > 0);
  const totalMilestones = [...counts.values()].reduce((sum, c) => sum + c.total, 0);

  const preview =
    projectsWithRoadmaps.length > 0
      ? projectsWithRoadmaps
          .slice(0, 3)
          .map((project) => {
            const c = counts.get(project.id)!;
            return `${project.title} ${Math.round((c.done / c.total) * 100)}%`;
          })
          .join(" · ")
      : active.length > 0
        ? "Milestones on a project page become a board"
        : null;

  return (
    <ModuleRow
      icon={<Kanban className="h-4 w-4" />}
      title="Roadmap"
      degraded={degraded}
      subtitle={
        projectsWithRoadmaps.length > 0
          ? `${totalMilestones} milestones across ${projectsWithRoadmaps.length} project${projectsWithRoadmaps.length === 1 ? "" : "s"}`
          : active.length > 0
            ? "Add milestones to build a board"
            : "No projects yet"
      }
      action={
        active.length === 0 ? (
          <CreateProjectButton label="Start a project" variant="outline" />
        ) : projectsWithRoadmaps.length > 0 && anchored ? (
          <Link to="/projects/$id" params={{ id: anchored.id }} className={ROW_ACTION}>
            Open board
          </Link>
        ) : anchored ? (
          <Link to="/projects/$id" params={{ id: anchored.id }} className={ROW_ACTION}>
            Add milestones →
          </Link>
        ) : undefined
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function ChallengesModuleRow() {
  const { data: challenges = [], isLoading } = useChallenges("active");
  const joined = challenges.filter((challenge) => challenge.is_joined);

  if (isLoading) return <ModuleRowLoading title="Challenges" />;

  const preview = joined
    .slice(0, 3)
    .map((challenge) => challenge.title)
    .join(" · ");

  return (
    <ModuleRow
      icon={<Swords className="h-4 w-4" />}
      title="Challenges"
      subtitle={
        joined.length === 0
          ? "Join a challenge to turn practice into visible contribution."
          : `${joined.length} joined`
      }
      action={
        <Link to="/challenges" className={ROW_ACTION}>
          {joined.length === 0 ? "Browse challenges →" : "View all"}
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function ConnectionsModuleRow() {
  const { data: connections = [] } = useConnections();
  const accepted = connections.filter((connection) => connection.status === "accepted");
  const preview = accepted
    .slice(0, 3)
    .map((connection) => connection.other?.display_name ?? connection.other?.handle ?? "Member")
    .join(" · ");

  return (
    <ModuleRow
      icon={<Users className="h-4 w-4" />}
      title="Connections"
      subtitle={accepted.length > 0 ? `${accepted.length} connected` : "No connections yet"}
      action={
        <Link to="/connections" className={ROW_ACTION}>
          View
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

/* ── Discovery ────────────────────────────────────────────────────────────── */

export function SuggestedProjectsModuleRow() {
  const { data: me } = useCurrentUser();
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["suggested-projects", me?.userId ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("match_projects", {
        p_user_id: me?.userId as string,
        p_limit: 3,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me,
    staleTime: 60_000,
  });

  if (isLoading) return <ModuleRowLoading title="Projects for you" />;

  const preview = matches
    .slice(0, 3)
    .map((project) => project.title)
    .join(" · ");

  return (
    <ModuleRow
      icon={<Folder className="h-4 w-4" />}
      title="Projects for you"
      subtitle={matches.length > 0 ? "Matched to your skills" : "Add skills to unlock matches"}
      action={
        <Link to="/explore" className={ROW_ACTION}>
          Explore
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function SuggestedCreatorsModuleRow() {
  const { data: me } = useCurrentUser();
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["suggested-creators", me?.userId ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("match_creators", {
        p_user_id: me?.userId as string,
        p_limit: 3,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me,
    staleTime: 60_000,
  });

  if (isLoading) return <ModuleRowLoading title="People you'd connect with" />;

  const preview = matches
    .slice(0, 3)
    .map((candidate) => candidate.display_name ?? candidate.handle ?? "Member")
    .join(" · ");

  return (
    <ModuleRow
      icon={<Users className="h-4 w-4" />}
      title="People you'd connect with"
      subtitle={matches.length > 0 ? "Complementary skills" : "Add skills to unlock matches"}
      action={
        <Link to="/explore" className={ROW_ACTION}>
          Explore
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

export function TrendingSkillsModuleRow() {
  const { data: skills = [], isLoading } = useTrendingSkills();

  if (isLoading) return <ModuleRowLoading title="Trending skills" />;

  const preview = skills
    .slice(0, 5)
    .map((skill) => skill.name)
    .join(" · ");

  return (
    <ModuleRow
      icon={<Sparkles className="h-4 w-4" />}
      title="Trending skills"
      subtitle="Across the network"
      action={
        <Link to="/explore" className={ROW_ACTION}>
          Explore
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}

/* ── Evidence ─────────────────────────────────────────────────────────────── */

export function ActivityModuleRow({ activity }: { activity: ActivityRow[] }) {
  const latest = activity[0];
  const preview = latest
    ? `${describeActivity(latest.kind, latest.metadata)} · ${relativeActivityTime(latest.created_at)}`
    : null;

  return (
    <ModuleRow
      icon={<Clock className="h-4 w-4" />}
      title="Recent activity"
      subtitle={activity.length > 0 ? `${activity.length} events` : "No activity yet"}
      action={
        <Link to="/profile" className={ROW_ACTION}>
          View
        </Link>
      }
    >
      {preview && <Preview text={preview} />}
    </ModuleRow>
  );
}
