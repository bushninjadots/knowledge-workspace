import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import {
  ArrowRight,
  Sparkles,
  Clock,
  Folder,
  Users,
  UserPlus,
  TrendingUp,
  Award,
  Swords,
  Ticket,
  Plus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { useCurrentUser } from "@/hooks/use-current-user";
import { completenessPercent, nextSteps, sections } from "@/lib/profile-completeness";
import { NextStepsList } from "@/components/tethyr/next-steps";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";
import { SuggestedCreators } from "@/components/tethyr/suggested-creators";
import { SuggestedProjects } from "@/components/tethyr/suggested-projects";
import { DiscoverSkills } from "@/components/tethyr/discover-skills";
import { ConnectionsCard } from "@/components/tethyr/connections-card";
import { CreateProjectButton } from "@/components/tethyr/create-project-button";
import { WelcomeModal } from "@/components/tethyr/welcome-modal";
const WorkspaceGrid = lazy(() =>
  import("@/components/tethyr/workspace/workspace-grid").then((m) => ({
    default: m.WorkspaceGrid,
  })),
);
import { DASHBOARD_LAYOUT_PRESETS, DASHBOARD_MODULES } from "@/lib/workspace-layouts";

import { checkAndAwardAchievements } from "@/lib/reputation";
import { useSessionRequests } from "@/hooks/use-sessions";
import { useConnections } from "@/hooks/use-connections";
import { useUnreadCounts } from "@/hooks/use-messages";
import type { ProjectRow } from "@/components/tethyr/profile-sections";
import { useChallenges } from "@/hooks/use-challenges";
import { useProjectReturnChanges } from "@/hooks/use-project-loop";
import { supabase } from "@/integrations/supabase/client";
import { seoMeta } from "@/lib/seo";
import { BannerStrip } from "@/components/tethyr/profile/banner-strip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () =>
    seoMeta({
      path: "/dashboard",
      title: "Dashboard",
      description:
        "Your Tethyr dashboard — projects, applications, connections, and next steps in one workspace.",
      noindex: true,
    }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useCurrentUser();
  if (isLoading) {
    return (
      <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;
  return <DashboardContent data={data} />;
}

/* ── Dashboard content (the workspace grid) ──────────────────────────────── */

function DashboardContent({
  data,
}: {
  data: NonNullable<ReturnType<typeof useCurrentUser>["data"]>;
}) {
  const { data: sessionRequests = [] } = useSessionRequests();
  const { data: connections = [] } = useConnections();
  const queryClient = useQueryClient();
  const { data: unreadData } = useUnreadCounts();

  const { data: myChallenges = [], isLoading: challengesLoading } = useChallenges("active");
  const joinedChallenges = useMemo(() => myChallenges.filter((c) => c.is_joined), [myChallenges]);

  const { data: myApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["my-applications", data?.userId],
    queryFn: async () => {
      const { data: apps, error } = await supabase
        .from("project_role_applications")
        .select("id, status, role_id, created_at, project_open_roles(title, projects(title, id))")
        .eq("profile_id", data?.userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return apps ?? [];
    },
    enabled: !!data?.userId,
    staleTime: 30_000,
  });

  const { data: todayOpps = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ["today-opportunities", data?.userId],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("project_open_roles")
        .select("id, title, skills, projects(title, id, status)")
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (roles ?? []).filter(
        (r) => r.projects && ["planning", "active"].includes(r.projects.status),
      );
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data?.userId) return;
    checkAndAwardAchievements()
      .then(() => queryClient.invalidateQueries({ queryKey: ["achievements", data.userId] }))
      .catch(() => {});
  }, [data?.userId, queryClient]);

  const input = useMemo(
    () => ({
      profile: data?.profile ?? null,
      teachCount: (data?.teachIds ?? []).length,
      learnCount: (data?.learnIds ?? []).length,
      projectsCount: (data?.projects ?? []).length,
    }),
    [data?.profile, data?.teachIds, data?.learnIds, data?.projects],
  );
  const myProjects = useMemo(
    () =>
      [...(data?.projects ?? [])].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      ),
    [data?.projects],
  );
  const pct = useMemo(() => (data ? completenessPercent(input) : 0), [data, input]);
  const remaining = useMemo(() => (data ? nextSteps(input, 5) : []), [data, input]);
  const totalSteps = useMemo(() => (data ? sections(input).length : 0), [data, input]);
  const doneSteps = useMemo(
    () => (data ? totalSteps - sections(input).filter((s) => !s.done).length : 0),
    [data, input, totalSteps],
  );
  const pendingSessionCount = useMemo(
    () =>
      sessionRequests.filter((r) => r.status === "pending" && r.to_user_id === data?.userId).length,
    [sessionRequests, data?.userId],
  );
  const pendingConnectionCount = useMemo(
    () =>
      connections.filter((c) => c.status === "pending" && c.addressee_id === data?.userId).length,
    [connections, data?.userId],
  );
  const pendingInviteCount = useMemo(
    () => pendingSessionCount + pendingConnectionCount,
    [pendingSessionCount, pendingConnectionCount],
  );
  const firstName = useMemo(
    () => data?.profile?.display_name?.split(/\s+/)[0] ?? data?.profile?.handle ?? "member",
    [data?.profile],
  );
  const unreadMessageCount = useMemo(() => unreadData?.total ?? 0, [unreadData]);
  const activeProjects = useMemo(
    () => myProjects.filter((p: ProjectRow) => p.status === "active" || p.status === "planning"),
    [myProjects],
  );

  const renderModule = useCallback(
    (id: string): React.ReactNode => {
      switch (id) {
        case "projects":
          return (
            <SectionCard
              icon={<Folder className="h-4 w-4" />}
              title="Your projects"
              action={
                <Link
                  to="/profile"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              }
            >
              {activeProjects.length === 0 ? (
                <DashboardModuleEmpty
                  copy="Give people a clear place to find what you're building."
                  action={<CreateProjectButton label="Start a project" variant="outline" />}
                />
              ) : (
                <div className="space-y-2">
                  {activeProjects.slice(0, 3).map((p) => (
                    <Link
                      key={p.id}
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="block rounded-xl border card-border bg-background/40 p-3 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium" title={p.title}>
                          {p.title}
                        </p>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress
                          value={p.progress_percent ?? 0}
                          className="h-1"
                          aria-label={`Progress: ${p.progress_percent ?? 0}%`}
                        />
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {p.progress_percent ?? 0}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          );

        case "applications":
          if (applicationsLoading) return <DashboardModuleLoading title="Applications" />;
          return (
            <SectionCard
              icon={<Ticket className="h-4 w-4" />}
              title="Applications"
              subtitle={`${myApplications.length} sent`}
            >
              {myApplications.length === 0 ? (
                <DashboardModuleEmpty
                  copy="Applications you send will stay visible here."
                  action={
                    <Link
                      to="/explore"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Find open roles →
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  {myApplications.slice(0, 4).map((app) => (
                    <Link
                      key={app.id}
                      to="/projects/$id"
                      params={{ id: app.project_open_roles?.projects?.id ?? "" }}
                      search={{ tab: "people" } as Record<string, string>}
                      className="flex items-center justify-between rounded-lg border card-border bg-background/40 px-3 py-2 text-sm transition hover:bg-surface-elevated/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {app.project_open_roles?.title ?? "Role"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {app.project_open_roles?.projects?.title ?? "Project"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          app.status === "accepted"
                            ? "bg-trust/10 text-trust"
                            : app.status === "declined"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-surface-elevated text-muted-foreground"
                        }`}
                      >
                        {app.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          );

        case "challenges":
          if (challengesLoading) return <DashboardModuleLoading title="Challenges" />;
          return (
            <SectionCard
              icon={<Swords className="h-4 w-4" />}
              title="Challenges"
              subtitle={`${joinedChallenges.length} joined`}
            >
              {joinedChallenges.length === 0 ? (
                <DashboardModuleEmpty
                  copy="Join a challenge to turn practice into visible contribution."
                  action={
                    <Link
                      to="/challenges"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Browse challenges →
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  {joinedChallenges.slice(0, 3).map((c) => (
                    <Link
                      key={c.id}
                      to="/challenges/$id"
                      params={{ id: c.id }}
                      className="flex items-center justify-between rounded-lg border card-border bg-background/40 px-3 py-2 text-sm transition hover:bg-surface-elevated/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" title={c.title}>
                          {c.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {c.difficulty}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {c.my_participation?.review_status === "passed"
                          ? "Verified"
                          : c.my_participation?.status === "in_progress"
                            ? "In progress"
                            : c.my_participation?.status === "completed"
                              ? "Pending verification"
                              : "Joined"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          );

        case "connections":
          return <ConnectionsCard />;

        case "suggested-projects":
          return (
            <SectionCard
              icon={<Folder className="h-4 w-4" />}
              title="Projects for you"
              subtitle="Matched to your skills"
            >
              <SuggestedProjects />
            </SectionCard>
          );

        case "suggested-creators":
          return (
            <SectionCard
              icon={<Users className="h-4 w-4" />}
              title="People you'd connect with"
              subtitle="Complementary skills"
            >
              <SuggestedCreators />
            </SectionCard>
          );

        case "trending-skills":
          return (
            <SectionCard
              icon={<Sparkles className="h-4 w-4" />}
              title="Trending skills"
              subtitle="Across the network"
            >
              <DiscoverSkills />
            </SectionCard>
          );

        case "today":
          return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TodayCard
                icon={activeProjects.length > 0 ? Folder : Plus}
                accent="var(--trust)"
                title={activeProjects.length > 0 ? "Continue your project" : "Start a project"}
                href={activeProjects.length > 0 ? `/projects/${activeProjects[0].id}` : undefined}
                action={
                  activeProjects.length === 0 ? (
                    <CreateProjectButton
                      label="Create project"
                      variant="outline"
                      className="mt-3"
                    />
                  ) : undefined
                }
                highlight={activeProjects.length > 0}
              >
                {activeProjects.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="truncate text-sm font-semibold" title={activeProjects[0].title}>
                      {activeProjects[0].title}
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={activeProjects[0].progress_percent ?? 0}
                        className="h-1.5"
                        aria-label={`Progress: ${activeProjects[0].progress_percent ?? 0}%`}
                      />
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {activeProjects[0].progress_percent ?? 0}%
                      </span>
                    </div>
                    {activeProjects.length > 1 && (
                      <p className="text-[11px] text-muted-foreground">
                        +{activeProjects.length - 1} more project
                        {activeProjects.length > 2 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Create your first project to start building in public.
                  </p>
                )}
              </TodayCard>
              <TodayCard
                icon={UserPlus}
                accent="var(--learning)"
                title={
                  pendingInviteCount > 0 || unreadMessageCount > 0
                    ? "You have activity"
                    : "No pending invites"
                }
                href={
                  pendingSessionCount > 0
                    ? "/sessions"
                    : pendingConnectionCount > 0
                      ? "/connections"
                      : "/messages"
                }
                search={pendingSessionCount > 0 ? { tab: "requests" } : undefined}
                highlight={pendingInviteCount > 0 || unreadMessageCount > 0}
              >
                <div className="mt-3 space-y-1.5">
                  {pendingSessionCount > 0 && (
                    <p className="text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {pendingSessionCount}
                      </span>{" "}
                      session request{pendingSessionCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  {pendingConnectionCount > 0 && (
                    <p className="text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {pendingConnectionCount}
                      </span>{" "}
                      connection request{pendingConnectionCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  {unreadMessageCount > 0 && (
                    <p className="text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {unreadMessageCount}
                      </span>{" "}
                      unread message{unreadMessageCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  {pendingInviteCount === 0 && unreadMessageCount === 0 && (
                    <p className="text-xs text-muted-foreground">
                      All clear — nothing needs your attention.
                    </p>
                  )}
                </div>
              </TodayCard>
              <TodayCard icon={Users} accent="var(--ai)" title="Find collaborators" href="/explore">
                <p className="mt-3 text-xs text-muted-foreground">
                  Discover people with complementary skills who are open to team-ups.
                </p>
              </TodayCard>
              <TodayCard
                icon={TrendingUp}
                accent="var(--brand-purple)"
                title={
                  todayOpps.length > 0
                    ? `${todayOpps.length} open role${todayOpps.length !== 1 ? "s" : ""}`
                    : "Browse opportunities"
                }
                href="/explore"
                highlight={todayOpps.length > 0}
              >
                {opportunitiesLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Loading open roles…</p>
                ) : todayOpps.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {todayOpps.slice(0, 2).map((opp) => (
                      <p key={opp.id} className="truncate text-xs text-muted-foreground">
                        {opp.title} — {opp.projects?.title}
                      </p>
                    ))}
                    {todayOpps.length > 2 && (
                      <p className="text-[11px] text-muted-foreground">
                        +{todayOpps.length - 2} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Check back as projects open new roles.
                  </p>
                )}
              </TodayCard>
            </div>
          );

        case "next-steps":
          if (pct >= 100) {
            return (
              <div className="rounded-xl border border-[var(--user-accent,var(--trust))]/30 bg-[var(--user-accent-subtle,var(--learning-subtle))] p-5">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
                  <h2 className="text-sm font-semibold">Profile complete!</h2>
                  <span className="text-[11px] text-muted-foreground">
                    — {doneSteps}/{totalSteps} done
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your studio is fully set up. People can see everything you're about — projects,
                  skills, and what you're building next.
                </p>
              </div>
            );
          }
          if (remaining.length === 0) return null;
          return (
            <div className="rounded-xl border border-[var(--user-accent,var(--trust))]/30 bg-[var(--user-accent-subtle,var(--learning-subtle))] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
                <h2 className="text-sm font-semibold">Finish setting up your profile</h2>
                <span className="text-[11px] text-muted-foreground">
                  — {doneSteps}/{totalSteps} done
                </span>
              </div>
              <NextStepsList items={remaining} />
            </div>
          );

        case "activity":
          return (
            <SectionCard
              icon={<Clock className="h-4 w-4" />}
              title="Recent activity"
              subtitle="Every action builds your reputation."
            >
              <ActivityTimeline profileId={data?.userId} events={data?.activity} limit={6} />
            </SectionCard>
          );

        default:
          return null;
      }
    },
    [
      data,
      activeProjects,
      joinedChallenges,
      myApplications,
      pct,
      remaining,
      doneSteps,
      totalSteps,
      pendingSessionCount,
      pendingConnectionCount,
      pendingInviteCount,
      unreadMessageCount,
      todayOpps,
      opportunitiesLoading,
      applicationsLoading,
      challengesLoading,
    ],
  );

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section aria-labelledby="dashboard-next-move-heading" className="space-y-6">
          <h2 id="dashboard-next-move-heading" className="sr-only">
            Your next move
          </h2>
          <WelcomeModal />
          <DashboardWelcomeBanner
            bannerSigned={data?.bannerSigned ?? null}
            bannerCaption={data?.profile?.banner_caption ?? null}
            bannerOverlay={data?.background?.bannerOverlay ?? "soft"}
            bannerCaptionPosition={data?.background?.bannerCaptionPosition ?? "right"}
            userId={data.userId}
            onBannerChange={queryClient.invalidateQueries.bind(queryClient, {
              queryKey: ["current-user"],
            })}
            firstName={firstName}
            pendingSessionCount={pendingSessionCount}
            activeProjectId={activeProjects[0]?.id ?? null}
            hasOpenRole={todayOpps.length > 0}
            reputationScore={data?.profile?.reputation_score ?? null}
          />
          {renderModule("today")}
          <ProjectReturnShelf />
          <WeeklyShowYourWorkPrompt projectId={activeProjects[0]?.id ?? null} />
          {renderModule("next-steps")}
        </section>

        <section aria-labelledby="dashboard-modules-heading" className="space-y-4">
          <div>
            <h2 id="dashboard-modules-heading" className="font-display text-lg font-semibold">
              Build and discover
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your active work, collaboration signals, discovery, and contribution evidence.
            </p>
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>
            <WorkspaceGrid
              page="dashboard"
              userId={data?.userId}
              modules={DASHBOARD_MODULES}
              layoutPresets={DASHBOARD_LAYOUT_PRESETS}
              canCustomize={true}
              showModuleTitles={false}
              showPresetPicker
              presetPickerLabel="Focus"
              renderModule={renderModule}
              migrateRetiredModules
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

/* ── Welcome banner ── */

function DashboardWelcomeBanner({
  bannerSigned,
  bannerCaption,
  bannerOverlay,
  bannerCaptionPosition,
  userId,
  onBannerChange,
  firstName,
  pendingSessionCount,
  activeProjectId,
  hasOpenRole,
  reputationScore,
}: {
  bannerSigned: string | null;
  bannerCaption: string | null;
  bannerOverlay: string | null;
  bannerCaptionPosition: "left" | "center" | "right" | null;
  userId: string;
  onBannerChange: () => void;
  firstName: string;
  pendingSessionCount: number;
  activeProjectId: string | null;
  hasOpenRole: boolean;
  reputationScore: number | null;
}) {
  return (
    <section
      aria-labelledby="dashboard-welcome-heading"
      className="overflow-hidden rounded-xl bg-surface-elevated/30"
    >
      <BannerStrip
        bannerSigned={bannerSigned}
        bannerCaption={bannerCaption}
        overlay={bannerOverlay}
        captionPosition={bannerCaptionPosition}
        userId={userId}
        onChange={onBannerChange}
        readonly
      />
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
        <div className="min-w-0">
          <p className="section-label">Welcome back</p>
          <h1
            id="dashboard-welcome-heading"
            className="mt-1 font-display text-2xl font-semibold sm:text-3xl"
          >
            Hey {firstName},{" "}
            <span className="text-[var(--user-accent,var(--trust))]">what&apos;s next?</span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {pendingSessionCount > 0 ? (
            <Link
              to="/sessions"
              search={{ tab: "requests" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
            >
              Review requests <ArrowRight className="h-3 w-3" />
            </Link>
          ) : activeProjectId ? (
            <Link
              to="/projects/$id"
              params={{ id: activeProjectId }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
            >
              Continue building <ArrowRight className="h-3 w-3" />
            </Link>
          ) : hasOpenRole ? (
            <Link
              to="/explore"
              search={{ tab: "opportunities" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
            >
              Find a role <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <CreateProjectButton size="sm" variant="default" className="rounded-full" />
          )}
          {reputationScore != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent-subtle,var(--learning-subtle))]/80 px-3 py-1.5 text-xs font-medium text-[var(--user-accent,var(--trust))]">
              <Award className="h-3.5 w-3.5" />
              {reputationScore} rep
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Today focus card ── */

function WeeklyShowYourWorkPrompt({ projectId }: { projectId: string | null }) {
  if (!projectId) return null;

  return (
    <section
      aria-labelledby="weekly-show-your-work-heading"
      className="border-y border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--user-accent,var(--primary))]" />
          <div className="min-w-0">
            <p className="section-label">Weekly ritual</p>
            <h2 id="weekly-show-your-work-heading" className="mt-1 text-sm font-semibold">
              What moved your work forward this week?
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              One sentence, image, GIF, video, or link is enough. Leave a useful trace for the
              people following along.
            </p>
          </div>
        </div>
        <Link
          to="/projects/$id"
          params={{ id: projectId }}
          search={{ tab: "activity", focus: "weekly" } as Record<string, string>}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--user-accent,var(--primary))] px-3 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
        >
          Add this week’s evidence <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function ProjectReturnShelf() {
  const { data: changes = [], isLoading } = useProjectReturnChanges();
  if (!isLoading && changes.length === 0) return null;

  return (
    <section aria-labelledby="return-shelf-heading" className="border-y border-border/60 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Since your last visit</p>
          <h2 id="return-shelf-heading" className="mt-1 font-display text-lg font-semibold">
            Your projects moved
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          A quiet return path into work you care about.
        </p>
      </div>
      {isLoading ? (
        <div
          className="mt-3 h-12 animate-pulse rounded-lg bg-surface"
          aria-label="Loading project changes"
        />
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {changes.slice(0, 6).map((change) => (
            <Link
              key={change.id}
              to="/projects/$id"
              params={{ id: change.projectId }}
              search={{ tab: "activity" } as Record<string, string>}
              className="min-w-0 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface"
            >
              <p className="truncate text-xs font-medium">{change.projectTitle}</p>
              <p className="mt-0.5 truncate text-sm text-foreground/85">{change.title}</p>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                {change.kind.replace(/_/g, " ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardModuleEmpty({ copy, action }: { copy: string; action: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">{copy}</p>
      {action}
    </div>
  );
}

function DashboardModuleLoading({ title }: { title: string }) {
  return (
    <SectionCard icon={<Clock className="h-4 w-4" />} title={title}>
      <div className="space-y-2" aria-label={`Loading ${title}`}>
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-elevated" />
      </div>
    </SectionCard>
  );
}

function TodayCard({
  icon: Icon,
  accent,
  title,
  href,
  search,
  action,
  children,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  href?: string;
  search?: Record<string, string>;
  action?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const className = `group relative flex flex-col rounded-xl border p-5 transition-spatial duration-200 ${
    highlight
      ? "card-border bg-surface shadow-sm hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md"
      : "card-border bg-surface/60 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface"
  }`;
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: accent, color: "#fff" }}
        >
          <Icon className="h-4 w-4" />
        </div>
        {href && (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {children}
      {action}
    </>
  );

  return href ? (
    <Link to={href} search={search} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/* ── Section card ── */

function SectionCard({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl bg-surface-elevated/30 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <h2 className="text-sm font-semibold truncate" title={title}>
            {title}
          </h2>
          {subtitle && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">— {subtitle}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
