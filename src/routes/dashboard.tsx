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
  LogIn,
  UserRoundPlus,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { AuthShell } from "@/components/tethyr/auth-shell";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { NotificationDropdown } from "@/components/tethyr/notifications/notification-dropdown";
import { GlobalSearch } from "@/components/tethyr/global-search";
import { ThemeToggle } from "@/components/tethyr/theme-toggle";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tethyr" },
      { name: "description", content: "Your Tethyr dashboard." },
    ],
  }),
  component: DashboardPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function DashboardPage() {
  const { data, isLoading, isError, error, refresh } = useCurrentUser();
  const isAuthed = Boolean(data?.userId);

  // ── Unauthenticated state: clean login / join gateway ──────────────────
  if (!isLoading && !isAuthed) {
    return (
      <AuthShell
        title="Your workspace awaits"
        subtitle="Log in to pick up where you left off, or join Tethyr to start building in public."
        footer={
          <>
            Already a member?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <Button asChild variant="default" size="lg" className="w-full rounded-full">
            <Link to="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full rounded-full">
            <Link to="/signup">
              <UserRoundPlus className="mr-2 h-4 w-4" />
              Join Tethyr
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  // ── Authenticated state: sidebar layout + dashboard grid ───────────────
  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block w-60 shrink-0" />
        <div className="flex-1 p-4 sm:p-8">
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-2xl bg-surface/60" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block w-60 shrink-0" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">Couldn't load your dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error?.message ?? "Something went wrong loading your data."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refresh()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AuthenticatedDashboardLayout data={data} />;
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
            className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border card-border bg-surface shadow-lg transition hover:scale-105 hover:bg-surface-elevated"
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
  const { data: sessionRequests = [], isLoading: sessionsLoading } = useSessionRequests();
  const { data: connections = [], isLoading: connectionsLoading } = useConnections();
  const { data: unreadData, isLoading: unreadLoading } = useUnreadCounts();

  const { data: myChallenges = [] } = useChallenges("active");
  const joinedChallenges = useMemo(
    () => myChallenges.filter((c: any) => c.is_joined),
    [myChallenges],
  );

  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-applications", data?.userId],
    queryFn: async () => {
      const { data: apps, error } = await (supabase as any)
        .from("project_role_applications")
        .select("id, status, role_id, created_at, project_open_roles(title, projects(title, id))")
        .eq("profile_id", data?.userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (apps ?? []) as any[];
    },
    enabled: !!data?.userId,
    staleTime: 30_000,
  });

  const weeklyRep = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = (data?.activity ?? []).filter((e: any) => new Date(e.created_at) >= weekAgo);
    return thisWeek.length;
  }, [data?.activity]);

  const { data: todayOpps = [] } = useQuery({
    queryKey: ["today-opportunities", data?.userId],
    queryFn: async () => {
      const { data: roles, error } = await (supabase as any)
        .from("project_open_roles")
        .select("id, title, skills, projects(title, id, status)")
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return ((roles ?? []) as any[]).filter(
        (r: any) => r.projects && ["planning", "active"].includes(r.projects.status),
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
        (a: any, b: any) =>
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
        case "welcome":
          return (
            <section className="animate-border-glow relative h-full overflow-hidden rounded-2xl border card-border bg-surface p-5 sm:p-6">
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
                  background: data?.bannerSigned
                    ? "radial-gradient(circle, var(--user-accent-subtle, var(--brand-purple)), transparent 60%)"
                    : "radial-gradient(circle, var(--brand-purple), transparent 60%)",
                }}
              />
              <div className="relative flex h-full flex-wrap items-center justify-between gap-4">
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
            </section>
          );

        case "today":
          return (
            <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TodayCard
                icon={activeProjects.length > 0 ? Folder : Plus}
                accent="var(--trust)"
                title={activeProjects.length > 0 ? "Continue your project" : "Start a project"}
                href={activeProjects.length > 0 ? `/projects/${activeProjects[0].id}` : "/explore"}
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
                  sessionsLoading || connectionsLoading || unreadLoading
                    ? "Loading activity…"
                    : pendingInviteCount > 0 || unreadMessageCount > 0
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
                {todayOpps.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {todayOpps.slice(0, 2).map((opp: any) => (
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

        case "quick-actions":
          return (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border card-border bg-surface p-4">
              <CreateProjectButton size="sm" variant="default" className="rounded-full" />
            </div>
          );

        case "next-steps":
          if (pct >= 100 || remaining.length === 0) return null;
          return (
            <div className="rounded-2xl border border-[var(--user-accent,var(--trust))]/30 bg-[var(--user-accent-subtle,var(--learning-subtle))] p-5">
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

        case "projects":
          if (activeProjects.length === 0) return null;
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
              <div className="space-y-2">
                {activeProjects.slice(0, 3).map((p: any) => (
                  <Link
                    key={p.id}
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="block rounded-2xl border card-border bg-background/40 p-3 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
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
            </SectionCard>
          );

        case "applications":
          if (myApplications.length === 0) return null;
          return (
            <SectionCard
              icon={<Ticket className="h-4 w-4" />}
              title="Applications"
              subtitle={`${myApplications.length} sent`}
            >
              <div className="space-y-1.5">
                {myApplications.slice(0, 4).map((app: any) => (
                  <Link
                    key={app.id}
                    to="/projects/$id"
                    params={{ id: app.project_open_roles?.projects?.id ?? "" }}
                    search={{ section: "roles" } as Record<string, string>}
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
            </SectionCard>
          );

        case "challenges":
          if (joinedChallenges.length === 0) return null;
          return (
            <SectionCard
              icon={<Swords className="h-4 w-4" />}
              title="Challenges"
              subtitle={`${joinedChallenges.length} joined`}
            >
              <div className="space-y-1.5">
                {joinedChallenges.slice(0, 3).map((c: any) => (
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
                      <p className="text-[11px] text-muted-foreground capitalize">{c.difficulty}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground capitalize">
                      {c.my_participation?.status ?? "joined"}
                    </span>
                  </Link>
                ))}
              </div>
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

        case "week":
          if (weeklyRep === 0) return null;
          return (
            <SectionCard
              icon={<Award className="h-4 w-4" />}
              title="This week"
              subtitle={`${weeklyRep} activity event${weeklyRep !== 1 ? "s" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-xl font-semibold tabular-nums text-[var(--user-accent,var(--trust))]">
                  {data?.profile?.reputation_score ?? 0}
                </span>
                <span className="text-[11px] text-muted-foreground">reputation</span>
                <Link
                  to="/profile"
                  className="ml-auto text-[11px] font-medium text-primary hover:underline"
                >
                  Achievements →
                </Link>
              </div>
            </SectionCard>
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
      updateAvail,
      myProjects,
      activeProjects,
      pct,
      remaining,
      totalSteps,
      doneSteps,
      firstName,
      joinedChallenges,
      myApplications,
      todayOpps,
      weeklyRep,
      pendingSessionCount,
      pendingConnectionCount,
      pendingInviteCount,
      unreadMessageCount,
      sessionsLoading,
      connectionsLoading,
      unreadLoading,
    ],
  );

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <WorkspaceGrid
          page="dashboard"
          userId={data.userId}
          modules={DASHBOARD_MODULES}
          renderModule={renderModule}
          canCustomize={true}
        />
      </div>
    </div>
  );
}

/* ── Today focus card ── */

function TodayCard({
  icon: Icon,
  accent,
  title,
  href,
  children,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      to={href}
      className={`group relative flex flex-col rounded-2xl border p-5 transition-all duration-200 ${
        highlight
          ? "card-border bg-surface shadow-sm hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md"
          : "card-border bg-surface/60 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: accent, color: "#fff" }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {children}
    </Link>
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
    <div className="h-full rounded-2xl border card-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <h2 className="text-sm font-semibold truncate">{title}</h2>
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
