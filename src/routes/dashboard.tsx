import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useId, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
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
  Menu,
  Search,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { FirstSessionOnboarding } from "@/components/tethyr/first-session-onboarding";
import { WorkspaceGrid } from "@/components/tethyr/workspace/workspace-grid";
import { DASHBOARD_MODULES } from "@/lib/workspace-layouts";

import {
  AvailabilitySelector,
  useUpdateAvailability,
} from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { checkAndAwardAchievements } from "@/lib/reputation";
import { useSessionRequests } from "@/hooks/use-sessions";
import { useConnections } from "@/hooks/use-connections";
import { useUnreadCounts } from "@/hooks/use-messages";
import type { ProjectRow } from "@/components/tethyr/profile-sections";
import { useChallenges } from "@/hooks/use-challenges";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStateBoundary } from "@/components/tethyr/dashboard-state-boundary";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { NotificationDropdown } from "@/components/tethyr/notifications/notification-dropdown";
import { GlobalSearch } from "@/components/tethyr/global-search";
import { ThemeToggle } from "@/components/tethyr/theme-toggle";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";
import { canonicalLinks, robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tethyr" },
      { name: "description", content: "Your Tethyr dashboard." },
      ...robotsMeta(),
    ],
    links: canonicalLinks("/dashboard"),
  }),
  component: DashboardPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Please try again.
        </p>
      </div>
    </div>
  ),
});

function DashboardPage() {
  const { data, isLoading, isError, error, refresh } = useCurrentUser();

  return (
    <DashboardStateBoundary
      data={data}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refresh()}
    >
      <AuthenticatedDashboardLayout data={data!} />
    </DashboardStateBoundary>
  );
}

/* ── Sidebar layout (matches AuthenticatedShell) ─────────────────────────── */

function AuthenticatedDashboardLayout({
  data,
}: {
  data: NonNullable<ReturnType<typeof useCurrentUser>["data"]>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const palette = useUserPalette(data?.bannerSigned ?? null);
  const themeStyle = useMemo(() => paletteToStyle(palette), [palette]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen bg-background" style={themeStyle}>
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 md:block">
        <DashboardSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
          <button
            className="absolute right-3 top-3 rounded-md border border-border bg-background p-1.5"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header bar */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
          <button
            className="rounded-md p-1.5 hover:bg-surface-sunken md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-tight md:hidden">Tethyr</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <NotificationDropdown />
          </div>
        </header>

        {/* Dashboard content */}
        <main className="flex-1">
          <DashboardContent data={data} />
        </main>

        {/* Scroll-to-top */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border card-border bg-surface shadow-sm transition hover:scale-105 hover:bg-surface-elevated"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

/* ── Dashboard content (the workspace grid) ──────────────────────────────── */

function DashboardContent({
  data,
}: {
  data: NonNullable<ReturnType<typeof useCurrentUser>["data"]>;
}) {
  const updateAvail = useUpdateAvailability();
  const { data: sessionRequests = [] } = useSessionRequests();
  const { data: connections = [] } = useConnections();
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
    if (data?.userId) {
      checkAndAwardAchievements().catch(() => {});
    }
  }, [data?.userId]);

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
  const firstName = useMemo(
    () => data?.profile?.display_name?.split(/\s+/)[0] ?? data?.profile?.handle ?? "member",
    [data?.profile],
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
                  to="/explore"
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
                        <Progress value={p.progress_percent ?? 0} className="h-1" />
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

        case "welcome":
          return (
            <div className="relative overflow-hidden rounded-xl bg-surface-elevated/30 p-6 sm:p-8">
              {data?.bannerSigned && (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08] saturate-50"
                    style={{ backgroundImage: `url(${data?.bannerSigned})` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/60 via-transparent to-background/80" />
                </div>
              )}
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, var(--user-accent-subtle, var(--brand-purple)), transparent 60%)",
                }}
              />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Welcome back
                    </p>
                    <AvailabilitySelector
                      current={data?.profile?.availability as AvailabilityStatus}
                      onSave={(s) => updateAvail.mutate(s)}
                    />
                  </div>
                  <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
                    Hey {firstName},{" "}
                    <span className="bg-gradient-to-r from-[var(--user-accent,var(--trust))] to-[var(--ai)] bg-clip-text text-transparent">
                      what's next?
                    </span>
                  </h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CreateProjectButton size="sm" variant="default" className="rounded-full" />
                  {pct < 100 && (
                    <Link
                      to="/profile"
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
                    >
                      <CompletenessMini percent={pct} size={18} />
                      {pct}% complete
                    </Link>
                  )}
                  {data?.profile?.reputation_score != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent-subtle,var(--learning-subtle))]/80 px-3 py-1.5 text-xs font-medium text-[var(--user-accent,var(--trust))] backdrop-blur-sm">
                      <Award className="h-3.5 w-3.5" />
                      {data?.profile?.reputation_score} rep
                    </span>
                  )}
                </div>
              </div>
            </div>
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
                      <Progress value={activeProjects[0].progress_percent ?? 0} className="h-1.5" />
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
                      ? "/profile"
                      : "/messages"
                }
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
      firstName,
      pendingSessionCount,
      pendingConnectionCount,
      pendingInviteCount,
      unreadMessageCount,
      todayOpps,
      opportunitiesLoading,
      applicationsLoading,
      challengesLoading,
      updateAvail,
    ],
  );

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section aria-label="Dashboard priorities" className="space-y-6">
          {renderModule("welcome")}
          <FirstSessionOnboarding data={data} />
          {renderModule("next-steps")}
          {renderModule("today")}
        </section>

        <section aria-labelledby="dashboard-modules-heading" className="space-y-4">
          <div>
            <h2 id="dashboard-modules-heading" className="font-display text-lg font-semibold">
              Your workspace
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the tools and signals you use to build, connect, and contribute close at hand.
            </p>
          </div>
          <WorkspaceGrid
            page="dashboard"
            userId={data?.userId}
            modules={DASHBOARD_MODULES}
            canCustomize={true}
            showModuleTitles={false}
            renderModule={renderModule}
            migrateRetiredModules
          />
        </section>
      </div>
    </div>
  );
}

/* ── Today focus card ── */

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
  action,
  children,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  href?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const className = `group relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
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
    <Link to={href} className={className}>
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

/* ── Profile completeness mini ring ── */

function CompletenessMini({ percent, size = 18 }: { percent: number; size?: number }) {
  const gradientId = useId();
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const center = size / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[18px] w-[18px] shrink-0 -rotate-90">
      <circle cx={center} cy={center} r={r} stroke="var(--border)" strokeWidth="2" fill="none" />
      <circle
        cx={center}
        cy={center}
        r={r}
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--user-accent, var(--trust))" />
          <stop offset="1" stopColor="var(--ai)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
