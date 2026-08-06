import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useEffect } from "react";
import { ArrowRight, Sparkles, Clock, Zap, Folder, Calendar, Users, MessageSquare, Briefcase, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const actionsLoading = sessionsLoading || connectionsLoading || unreadLoading || projectsLoading;

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
  const hasActions = pendingInviteCount > 0 || unreadMessageCount > 0 || activeProjectCount > 0;
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

      {/* Action hub — what needs attention right now */}
      {actionsLoading ? (
        <div className="surface-section bg-noise">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-elevated" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
              ))}
            </div>
          </div>
        </div>
      ) : hasActions ? (
        <div className="surface-section bg-noise">
          <div className="px-5 py-3 sm:px-6 sm:py-4">
            <div className="mb-3 flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-[var(--user-accent,var(--trust))]" />
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-foreground">
                Action hub
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pendingInviteCount > 0 && (
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
              )}
              {unreadMessageCount > 0 && (
                <ActionCard
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Unread messages"
                  count={unreadMessageCount}
                  accent="var(--learning)"
                  href="/messages"
                  detail={`${unreadMessageCount} unread message${unreadMessageCount > 1 ? "s" : ""}`}
                />
              )}
              {activeProjectCount > 0 && (
                <ActionCard
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Active projects"
                  count={activeProjectCount}
                  accent="var(--brand-purple)"
                  href={firstActiveProjectId ? `/projects/${firstActiveProjectId}` : "/profile"}
                  detail={activeProjects.slice(0, 3).map((p) => p.title).join(", ")}
                />
              )}
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
      ) : null}

      {/* Continuous workspace surface — replaces floating cards */}
      <div className="surface-section surface-divide bg-noise">
        {pct < 100 && (
          <WorkspaceSection
            icon={<Sparkles className="h-4 w-4" />}
            title="Next steps"
            subtitle="A few things to finish before other people can find you."
          >
            <NextStepsList items={remaining} />
          </WorkspaceSection>
        )}

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
          icon={<Clock className="h-4 w-4" />}
          title="Recent activity"
          subtitle="Every meaningful action becomes part of your reputation history."
        >
          <ActivityTimeline profileId={data.userId} events={data.activity} limit={6} />
        </WorkspaceSection>

        <ConnectionsCard />

        <WorkspaceSection
          icon={<Sparkles className="h-4 w-4" />}
          title="Discover skills"
          subtitle="Trending across the network."
        >
          <DiscoverSkills />
        </WorkspaceSection>
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
