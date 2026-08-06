import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useEffect, useMemo } from "react";
import { ArrowRight, Sparkles, Clock, Zap, Folder, Calendar, Users, MessageSquare, Briefcase, UserPlus, TrendingUp, Award, Swords, Ticket } from "lucide-react";
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
import {
  AvailabilitySelector,
  useUpdateAvailability,
} from "@/components/tethyr/availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { checkAndAwardAchievements } from "@/lib/reputation";
import { useSessionRequests } from "@/hooks/use-sessions";
import { useConnections } from "@/hooks/use-connections";
import { useUnreadCounts } from "@/hooks/use-messages";
import { useMyProjects } from "@/hooks/use-projects";
import { useChallenges } from "@/hooks/use-challenges";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/dashboard")({
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
  const updateAvail = useUpdateAvailability();
  const { data: sessionRequests = [], isLoading: sessionsLoading } = useSessionRequests();
  const { data: connections = [], isLoading: connectionsLoading } = useConnections();
  const { data: unreadData, isLoading: unreadLoading } = useUnreadCounts();
  const { data: myProjects = [], isLoading: projectsLoading } = useMyProjects();

  // My Challenges
  const { data: myChallenges = [] } = useChallenges("active");
  const joinedChallenges = useMemo(
    () => myChallenges.filter((c: any) => c.is_joined),
    [myChallenges],
  );

  // Role Applications — sent by me
  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-applications", data.userId],
    queryFn: async () => {
      const { data: apps, error } = await (supabase as any)
        .from("project_role_applications")
        .select("id, status, role_id, created_at, project_open_roles(title, projects(title, id))")
        .eq("applicant_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (apps ?? []) as any[];
    },
    enabled: !!data.userId,
    staleTime: 30_000,
  });

  // Weekly reputation
  const weeklyRep = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = (data.activity ?? []).filter(
      (e: any) => new Date(e.created_at) >= weekAgo,
    );
    return thisWeek.length;
  }, [data.activity]);

  // Today's opportunities
  const { data: todayOpps = [] } = useQuery({
    queryKey: ["today-opportunities", data.userId],
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

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Couldn't load your dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "Something went wrong loading your data. Please try again."}
        </p>
        <Button variant="outline" onClick={() => refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="h-40 animate-pulse rounded-3xl bg-surface/60" />
      </div>
    );
  }

  const input = {
    profile: data.profile,
    teachCount: data.teachIds.length,
    learnCount: data.learnIds.length,
    projectsCount: data.projects.length,
  };
  const pct = completenessPercent(input);
  const remaining = nextSteps(input, 5);
  const totalSteps = sections(input).length;
  const doneSteps = totalSteps - sections(input).filter((s) => !s.done).length;
  const firstName = data.profile?.display_name?.split(/\s+/)[0] ?? data.profile?.handle ?? "member";

  // Action hub counts
  const pendingSessionCount = sessionRequests.filter((r) => r.status === "pending" && r.to_user_id === data.userId).length;
  const pendingConnectionCount = connections.filter((c) => c.status === "pending" && c.addressee_id === data.userId).length;
  const pendingInviteCount = pendingSessionCount + pendingConnectionCount;
  const unreadMessageCount = unreadData?.total ?? 0;
  const activeProjects = myProjects.filter((p) => p.status === "active" || p.status === "planning");
  const activeProjectCount = activeProjects.length;
  const firstActiveProjectId = activeProjects[0]?.id;

  return (
    <div className="animate-room-enter mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Welcome */}
      <section className="animate-border-glow relative rounded-xl border card-border bg-surface p-5 sm:p-6">
        {/* Personalised banner background */}
        {data.bannerSigned && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.12] saturate-50"
              style={{ backgroundImage: `url(${data.bannerSigned})` }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/60 via-transparent to-background/80" />
          </div>
        )}
        {/* Fallback accent glow */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{
            background: data.bannerSigned
              ? "radial-gradient(circle, var(--user-accent-subtle, var(--brand-purple)), transparent 60%)"
              : "radial-gradient(circle, var(--brand-purple), transparent 60%)",
          }}
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Welcome back
              </p>
              <AvailabilitySelector
                current={data.profile?.availability as AvailabilityStatus}
                onSave={(s) => updateAvail.mutate(s)}
              />
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Hey {firstName}, let's{" "}
              <span
                className="bg-gradient-to-r from-[var(--user-accent,var(--trust))] to-[var(--ai)] bg-clip-text text-transparent"
              >
                keep going
              </span>
              .
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {pct < 100
                ? "Finish the last few steps on your profile so other people can discover you and start building together."
                : "Your profile is looking great. Here's what's happening on Tethyr right now."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {pct < 100 && (
                <Button asChild>
                  <Link to="/profile">
                    Continue profile <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/community">Community feed</Link>
              </Button>
            </div>
          </div>
          <CompletenessRing percent={pct} done={doneSteps} total={totalSteps} />
        </div>
      </section>

      {/* Action hub — each card loads independently, no blocking */}
      <div className="surface-section bg-noise">
        <div className="px-5 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-foreground">
              Action hub
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Pending invitations */}
            {sessionsLoading || connectionsLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
            ) : pendingInviteCount > 0 ? (
              <ActionCard
                icon={<UserPlus className="h-4 w-4" />}
                label="Pending invitations"
                count={pendingInviteCount}
                accent="var(--user-accent, var(--trust))"
                href={pendingSessionCount > 0 ? "/sessions" : "/profile"}
                detail={
                  pendingSessionCount > 0 && pendingConnectionCount > 0
                    ? `${pendingSessionCount} session, ${pendingConnectionCount} connection`
                    : pendingSessionCount > 0
                      ? `${pendingSessionCount} session request${pendingSessionCount > 1 ? "s" : ""}`
                      : `${pendingConnectionCount} connection request${pendingConnectionCount > 1 ? "s" : ""}`
                }
              />
            ) : null}

            {/* Unread messages */}
            {unreadLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
            ) : unreadMessageCount > 0 ? (
              <ActionCard
                icon={<MessageSquare className="h-4 w-4" />}
                label="Unread messages"
                count={unreadMessageCount}
                accent="var(--learning)"
                href="/messages"
                detail={`${unreadMessageCount} unread message${unreadMessageCount > 1 ? "s" : ""}`}
              />
            ) : null}

            {/* Active projects */}
            {projectsLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
            ) : activeProjectCount > 0 ? (
              <ActionCard
                icon={<Briefcase className="h-4 w-4" />}
                label="Active projects"
                count={activeProjectCount}
                accent="var(--brand-purple)"
                href={firstActiveProjectId ? `/projects/${firstActiveProjectId}` : "/profile"}
                detail={activeProjects.slice(0, 3).map((p) => p.title).join(", ")}
              />
            ) : null}

            {/* Profile completion — always shows if incomplete, no loading needed */}
            {pct < 100 && (
              <ActionCard
                icon={<Sparkles className="h-4 w-4" />}
                label="Profile completion"
                count={pct}
                countSuffix="%"
                accent="var(--user-accent-subtle, var(--learning-subtle))"
                href="/profile"
                detail={`${doneSteps}/${totalSteps} sections done`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Continuous workspace surface — action-first ordering */}
      <div className="surface-section surface-divide bg-noise">
        {/* 1. YOUR WORK (highest priority) */}
        {activeProjects.length > 0 && (
          <WorkspaceSection
            icon={<Briefcase className="h-4 w-4" />}
            title="Continue your projects"
            subtitle={`${activeProjects.length} active project${activeProjects.length !== 1 ? "s" : ""}`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {activeProjects.slice(0, 4).map((p: any) => (
                <Link
                  key={p.id}
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="group rounded-xl border card-border bg-surface-elevated/40 p-4 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={p.progress_percent ?? 0} className="h-1.5" />
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {p.progress_percent ?? 0}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="capitalize">{p.status}</span>
                    {p.stage && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{p.stage}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </WorkspaceSection>
        )}

        {myApplications.length > 0 && (
          <WorkspaceSection
            icon={<Ticket className="h-4 w-4" />}
            title="Your applications"
            subtitle={`${myApplications.length} application${myApplications.length !== 1 ? "s" : ""}`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {myApplications.slice(0, 4).map((app: any) => (
                <Link
                  key={app.id}
                  to="/projects/$id"
                  params={{ id: app.project_open_roles?.projects?.id ?? "" }}
                  className="flex items-center justify-between rounded-lg border card-border bg-surface-elevated/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{app.project_open_roles?.title ?? "Role"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.project_open_roles?.projects?.title ?? "Project"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    app.status === "accepted"
                      ? "bg-trust/10 text-trust"
                      : app.status === "declined"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-surface-elevated text-muted-foreground"
                  }`}>
                    {app.status}
                  </span>
                </Link>
              ))}
            </div>
          </WorkspaceSection>
        )}

        {joinedChallenges.length > 0 && (
          <WorkspaceSection
            icon={<Swords className="h-4 w-4" />}
            title="Your challenges"
            subtitle={`${joinedChallenges.length} joined`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {joinedChallenges.slice(0, 4).map((c: any) => (
                <Link
                  key={c.id}
                  to="/challenges/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between rounded-lg border card-border bg-surface-elevated/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.difficulty}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground capitalize">
                    {c.my_participation?.status ?? "joined"}
                  </span>
                </Link>
              ))}
            </div>
          </WorkspaceSection>
        )}

        {/* 2. CONNECTIONS */}
        <ConnectionsCard />

        {todayOpps.length > 0 && (
          <WorkspaceSection
            icon={<TrendingUp className="h-4 w-4" />}
            title="Today's opportunities"
            subtitle={`${todayOpps.length} open role${todayOpps.length !== 1 ? "s" : ""}`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {todayOpps.slice(0, 4).map((opp: any) => (
                <Link
                  key={opp.id}
                  to="/projects/$id"
                  params={{ id: opp.projects?.id ?? "" }}
                  className="flex items-center justify-between rounded-lg border card-border bg-surface-elevated/40 px-3 py-2.5 text-sm transition hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{opp.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{opp.projects?.title}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(opp.skills ?? []).slice(0, 2).map((s: string) => (
                      <span key={s} className="rounded-full bg-[var(--user-accent-subtle,var(--surface-elevated))] px-1.5 py-0 text-[10px] text-[var(--user-accent,var(--primary))]">
                        {s}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </WorkspaceSection>
        )}

        {/* 3. DISCOVERY */}
        <WorkspaceSection
          icon={<Folder className="h-4 w-4" />}
          title="Projects for you"
          subtitle="Projects matching your skills and interests."
        >
          <SuggestedProjects />
        </WorkspaceSection>

        <WorkspaceSection
          icon={<Zap className="h-4 w-4" />}
          title="People you connect with"
          subtitle="Based on complementary skills, availability, and language."
        >
          <SuggestedCreators />
        </WorkspaceSection>

        <WorkspaceSection
          icon={<Sparkles className="h-4 w-4" />}
          title="Discover skills"
          subtitle="Trending across the network."
        >
          <DiscoverSkills />
        </WorkspaceSection>

        {/* 4. ACTIVITY & PROGRESS (bottom) */}
        <WorkspaceSection
          icon={<Clock className="h-4 w-4" />}
          title="Recent activity"
          subtitle="Every meaningful action becomes part of your reputation history."
        >
          <ActivityTimeline profileId={data.userId} events={data.activity} limit={6} />
        </WorkspaceSection>

        {weeklyRep > 0 && (
          <WorkspaceSection
            icon={<Award className="h-4 w-4" />}
            title="This week"
            subtitle={`${weeklyRep} reputation event${weeklyRep !== 1 ? "s" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-semibold tabular-nums text-[var(--user-accent,var(--trust))]">
                  {data.profile?.reputation_score ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">reputation</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <Link to="/profile" className="text-xs text-primary hover:underline">
                View achievements →
              </Link>
            </div>
          </WorkspaceSection>
        )}

        {pct < 100 && (
          <WorkspaceSection
            icon={<Sparkles className="h-4 w-4" />}
            title="Next steps"
            subtitle="A few things to finish before other people can find you."
          >
            <NextStepsList items={remaining} />
          </WorkspaceSection>
        )}
      </div>
    </div>
  );
}

function WorkspaceSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-foreground">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">— {subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  icon,
  label,
  count,
  countSuffix,
  accent,
  href,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  countSuffix?: string;
  accent: string;
  href: string;
  detail?: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-start gap-3 rounded-xl border card-border bg-surface-elevated/60 p-4 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: accent, color: "#fff" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
          {count}
          {countSuffix ?? ""}
        </p>
        {detail && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
        )}
      </div>
    </Link>
  );
}

function CompletenessRing({
  percent,
  done,
  total,
}: {
  percent: number;
  done: number;
  total: number;
}) {
  const gradientId = useId();
  const radius = 46;
  const c = 2 * Math.PI * radius;
  const offset = c - (percent / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="var(--surface-elevated)"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--user-accent, var(--trust))" />
              <stop offset="1" stopColor="var(--user-accent-subtle, var(--learning-subtle))" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-2xl font-semibold">{percent}%</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">complete</p>
        </div>
      </div>
      <div className="text-sm">
        <p className="font-medium">Profile completion</p>
        <p className="mt-0.5 text-muted-foreground">
          {done} of {total} sections done
        </p>
      </div>
    </div>
  );
}
