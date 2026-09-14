import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { ArrowRight, Sparkles, Folder, UserPlus, Award, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { completenessPercent, nextSteps, sections, type Section } from "@/lib/profile-completeness";
import { NextStepsList } from "@/components/tethyr/next-steps";
import { CreateProjectButton } from "@/components/tethyr/create-project-button";
import { FirstSessionOnboarding } from "@/components/tethyr/first-session-onboarding";
import {
  ActivityModuleRow,
  ApplicationsModuleRow,
  ChallengesModuleRow,
  ConnectionsModuleRow,
  ProjectsModuleRow,
  RoadmapModuleRow,
  SuggestedCreatorsModuleRow,
  SuggestedProjectsModuleRow,
  TrendingSkillsModuleRow,
  selectActiveProjects,
} from "@/components/tethyr/workspace/dashboard-module-rows";
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
        <div className="h-32 animate-gentle-pulse rounded-xl bg-surface" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-gentle-pulse rounded-lg bg-surface" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-gentle-pulse rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="max-w-md text-center">
          <p className="section-label">Workspace unavailable</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            We couldn&apos;t load your workspace.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Refresh the page or return to the sign-in flow to reconnect your Tethyr space.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button asChild>
              <Link to="/login">Go to login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!data.profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="max-w-md text-center">
          <p className="section-label">One step to go</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Set up your Studio.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Add your name and what you make so people can recognize the work behind your account.
          </p>
          <Button asChild className="mt-5">
            <Link to="/profile">Open Your Studio</Link>
          </Button>
        </div>
      </div>
    );
  }
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

  const { data: todayOpps = [] } = useQuery({
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

  // DB triggers (trg_award_earned_achievements) award achievements primarily;
  // this client call is a backstop/recompute for sessions/streak-tracked ones.
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
  const activity = useMemo(() => data?.activity ?? [], [data?.activity]);
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
    () => selectActiveProjects(data?.projects ?? []),
    [data?.projects],
  );

  const renderModule = useCallback(
    (id: string): React.ReactNode => {
      switch (id) {
        case "projects":
          return <ProjectsModuleRow projects={activeProjects} />;

        case "applications":
          return <ApplicationsModuleRow />;

        case "challenges":
          return <ChallengesModuleRow />;

        case "roadmap":
          return <RoadmapModuleRow />;

        case "connections":
          return <ConnectionsModuleRow />;

        case "suggested-projects":
          return <SuggestedProjectsModuleRow />;

        case "suggested-creators":
          return <SuggestedCreatorsModuleRow />;

        case "trending-skills":
          return <TrendingSkillsModuleRow />;

        case "today":
          return (
            <section
              aria-labelledby="today-heading"
              className="rounded-xl border border-[var(--user-accent,var(--trust))]/20 bg-surface-elevated/40 p-5"
            >
              <h2 id="today-heading" className="section-label mb-3">
                Your next move
              </h2>
              <div className="divide-y divide-border/50">
                <TodayRow
                  primary
                  icon={activeProjects.length > 0 ? Folder : Plus}
                  accent="var(--trust)"
                  foreground="var(--trust-foreground)"
                  title={activeProjects.length > 0 ? "Continue your project" : "Start a project"}
                  href={activeProjects.length > 0 ? `/projects/${activeProjects[0].id}` : undefined}
                >
                  {activeProjects.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="truncate text-sm font-medium" title={activeProjects[0].title}>
                        {activeProjects[0].title}
                      </p>
                      <Progress
                        value={activeProjects[0].progress_percent ?? 0}
                        className="h-1 w-20"
                        aria-label={`Progress: ${activeProjects[0].progress_percent ?? 0}%`}
                      />
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {activeProjects[0].progress_percent ?? 0}%
                      </span>
                      {activeProjects.length > 1 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{activeProjects.length - 1} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Create your first project to start building in public.
                      </p>
                      <CreateProjectButton
                        label="Create project"
                        variant="outline"
                        className="mt-2"
                      />
                    </>
                  )}
                </TodayRow>

                <TodayRow
                  icon={UserPlus}
                  accent="var(--learning)"
                  foreground="var(--learning-foreground)"
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
                >
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {pendingSessionCount > 0 && (
                      <span>
                        <span className="font-medium tabular-nums text-foreground">
                          {pendingSessionCount}
                        </span>{" "}
                        session request{pendingSessionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {pendingConnectionCount > 0 && (
                      <span>
                        <span className="font-medium tabular-nums text-foreground">
                          {pendingConnectionCount}
                        </span>{" "}
                        connection request{pendingConnectionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {unreadMessageCount > 0 && (
                      <span>
                        <span className="font-medium tabular-nums text-foreground">
                          {unreadMessageCount}
                        </span>{" "}
                        unread message{unreadMessageCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {pendingInviteCount === 0 && unreadMessageCount === 0 && (
                      <span>All clear — nothing needs your attention.</span>
                    )}
                  </div>
                </TodayRow>
              </div>
            </section>
          );

        case "activity":
          return <ActivityModuleRow activity={activity} />;

        default:
          return null;
      }
    },
    [
      activity,
      activeProjects,
      pendingSessionCount,
      pendingConnectionCount,
      pendingInviteCount,
      unreadMessageCount,
    ],
  );

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section aria-labelledby="dashboard-next-move-heading" className="space-y-6">
          <h2 id="dashboard-next-move-heading" className="sr-only">
            Your next move
          </h2>
          <FirstSessionOnboarding data={data} />
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
          <FocusBand
            projectId={activeProjects[0]?.id ?? null}
            pct={pct}
            remaining={remaining}
            doneSteps={doneSteps}
            totalSteps={totalSteps}
          />
        </section>

        <section aria-labelledby="dashboard-modules-heading" className="space-y-6">
          <div>
            <h2 id="dashboard-modules-heading" className="font-display text-lg font-semibold">
              Build and discover
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your active work, collaboration signals, discovery, and contribution evidence.
            </p>
          </div>
          <Suspense fallback={<div className="h-64 animate-gentle-pulse rounded-xl bg-surface" />}>
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
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition-fade hover:opacity-90"
            >
              Review requests <ArrowRight className="h-3 w-3" />
            </Link>
          ) : activeProjectId ? (
            <Link
              to="/projects/$id"
              params={{ id: activeProjectId }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition-fade hover:opacity-90"
            >
              Continue building <ArrowRight className="h-3 w-3" />
            </Link>
          ) : hasOpenRole ? (
            <Link
              to="/explore"
              search={{ tab: "opportunities" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--user-accent,var(--trust))] px-3 py-1.5 text-xs font-medium text-[var(--user-accent-foreground,var(--background))] transition-fade hover:opacity-90"
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

/* ── Focus band: weekly ritual + profile setup folded into one band ── */

function FocusBand({
  projectId,
  pct,
  remaining,
  doneSteps,
  totalSteps,
}: {
  projectId: string | null;
  pct: number;
  remaining: Section[];
  doneSteps: number;
  totalSteps: number;
}) {
  const showWeekly = !!projectId;
  const showComplete = pct >= 100;
  const showSetup = !showComplete && remaining.length > 0;
  if (!showWeekly && !showComplete && !showSetup) return null;

  const twoCol = showWeekly && (showComplete || showSetup);

  return (
    <section
      aria-labelledby={showWeekly ? "weekly-show-your-work-heading" : "dashboard-focus-heading"}
      className="border-y border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] py-4"
    >
      <div className={twoCol ? "grid gap-6 lg:grid-cols-2" : ""}>
        {showWeekly && projectId && (
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--user-accent,var(--primary))] px-3 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition-fade hover:opacity-90"
            >
              Add this week’s evidence <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {showComplete && (
          <div className={twoCol ? "min-w-0 lg:border-l lg:border-border/60 lg:pl-6" : "min-w-0"}>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
              <h2 id="dashboard-focus-heading" className="text-sm font-semibold">
                Profile complete!
              </h2>
              <span className="text-[11px] text-muted-foreground">
                — {doneSteps}/{totalSteps} done
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your studio is fully set up. People can see everything you're about — projects,
              skills, and what you're building next.
            </p>
          </div>
        )}

        {showSetup && (
          <div className={twoCol ? "min-w-0 lg:border-l lg:border-border/60 lg:pl-6" : "min-w-0"}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
              <h2 id="dashboard-focus-heading" className="text-sm font-semibold">
                Finish setting up your profile
              </h2>
              <span className="text-[11px] text-muted-foreground">
                — {doneSteps}/{totalSteps} done
              </span>
            </div>
            <NextStepsList items={remaining} />
          </div>
        )}
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
          className="mt-3 h-12 animate-gentle-pulse rounded-lg bg-surface"
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
              className="min-w-0 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface"
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

function TodayRow({
  icon: Icon,
  accent,
  foreground = "#fff",
  title,
  href,
  search,
  primary = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  foreground?: string;
  title: string;
  href?: string;
  search?: Record<string, string>;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const content = (
    <div className={`flex items-start gap-3 ${primary ? "py-5" : "py-3.5 first:pt-2 last:pb-1"}`}>
      <span
        className={`mt-0.5 flex shrink-0 items-center justify-center rounded-lg ${
          primary ? "h-11 w-11" : "h-8 w-8"
        }`}
        style={{ backgroundColor: accent, color: foreground }}
      >
        <Icon className={primary ? "h-5 w-5" : "h-3.5 w-3.5"} />
      </span>
      <div className="min-w-0 flex-1">
        <h3
          className={
            primary ? "text-lg font-semibold leading-snug sm:text-xl" : "text-sm font-medium"
          }
        >
          {title}
        </h3>
        {children}
      </div>
      {href && (
        <ArrowRight
          className={`${
            primary ? "mt-3 h-4 w-4" : "mt-2 h-3.5 w-3.5"
          } shrink-0 text-muted-foreground opacity-0 transition-spatial group-hover:opacity-100 group-hover:translate-x-0.5`}
        />
      )}
    </div>
  );

  return href ? (
    <Link to={href} search={search} className="group block">
      {content}
    </Link>
  ) : (
    <div className="group block">{content}</div>
  );
}
