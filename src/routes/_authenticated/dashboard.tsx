import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useEffect } from "react";
import { ArrowRight, Compass, Sparkles, Clock, Zap, Folder } from "lucide-react";
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

  useEffect(() => {
    if (data?.userId) {
      checkAndAwardAchievements().catch(() => {});
    }
  }, [data?.userId]);

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8 text-center">
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
      <div className="mx-auto max-w-6xl p-4 sm:p-8">
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
  const firstName = data.profile?.display_name?.split(" ")[0] ?? data.profile?.handle ?? "member";

  return (
    <div className="animate-room-enter mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      {/* Welcome */}
      <section className="relative overflow-hidden card-border rounded-3xl border bg-surface p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--brand-purple), transparent 60%)" }}
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
              Hey {firstName}, let's <span className="text-gradient-brand">keep going</span>.
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

      <div className="grid gap-6 lg:grid-cols-3">
        {pct < 100 && (
          <section className="card-border rounded-3xl border bg-surface p-5 lg:col-span-2 sm:p-6">
            <SectionHeader
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Next steps"
              subtitle="A few things to finish before other people can find you."
            />
            <div className="mt-4">
              <NextStepsList items={remaining} />
            </div>
          </section>
        )}

        <section
          className={`card-border rounded-3xl border bg-surface p-5 sm:p-6 ${pct < 100 ? "" : "lg:col-span-2"}`}
        >
          <SectionHeader
            icon={<Folder className="h-4 w-4 text-brand-green" />}
            title="Projects for you"
            subtitle="Projects matching your skills and interests."
          />
          <div className="mt-4">
            <SuggestedProjects />
          </div>
        </section>

        {pct < 100 && (
          <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
            <SectionHeader
              icon={<Compass className="h-4 w-4 text-brand-purple" />}
              title="Quick links"
            />
            <div className="mt-4 space-y-2">
              <QuickLink
                to="/explore"
                icon={<Compass className="h-4 w-4" />}
                label="Explore people"
              />
              <QuickLink
                to="/community"
                icon={<Sparkles className="h-4 w-4" />}
                label="Community feed"
              />
              <QuickLink
                to="/explore"
                icon={<Compass className="h-4 w-4" />}
                label="Explore skills & studios"
              />
            </div>
          </section>
        )}
      </div>

      <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-brand-green" />}
          title="People you connect with"
          subtitle="Based on complementary skills, availability, and language."
        />
        <div className="mt-4">
          <SuggestedCreators />
        </div>
      </section>

      <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Clock className="h-4 w-4 text-primary" />}
          title="Recent activity"
          subtitle="Every meaningful action becomes part of your reputation history."
        />
        <div className="mt-4">
          <ActivityTimeline profileId={data.userId} events={data.activity} limit={6} />
        </div>
      </section>

      <ConnectionsCard />

      <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title="Discover skills"
          subtitle="Trending across the network."
        />
        <div className="mt-4">
          <DiscoverSkills />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-3 transition hover:border-primary/40 hover:bg-surface"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
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
              <stop offset="0" stopColor="var(--brand-green)" />
              <stop offset="1" stopColor="var(--brand-purple)" />
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
