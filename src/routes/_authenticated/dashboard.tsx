import { createFileRoute, Outlet, useRouterState, Link } from "@tanstack/react-router";
import { useState, useId, useEffect } from "react";
import {
  Menu,
  X,
  Bell,
  ArrowRight,
  Compass,
  User,
  Sparkles,
  Clock,
  Rocket,
  Zap,
  Folder,
} from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/tethyr/global-search";
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
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import type { AvailabilityStatus } from "@/lib/skill-match";
import { checkAndAwardAchievements } from "@/lib/reputation";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tethyr" },
      { name: "description", content: "Your Tethyr dashboard." },
    ],
  }),
  component: DashboardLayout,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/dashboard";
  const { data } = useCurrentUser();
  const initial =
    data?.profile?.display_name?.charAt(0).toUpperCase() ??
    data?.profile?.handle?.charAt(0).toUpperCase() ??
    "T";
  const cardAccent = useDominantColor(data?.bannerSigned ?? null);
  const accentStyle = cardAccent
    ? ({ "--accent-border": withAlpha(cardAccent, 0.35) } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen bg-background" style={accentStyle}>
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="absolute right-4 top-4 rounded-full bg-surface p-2"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="rounded-full p-2 hover:bg-surface md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch className="hidden flex-1 max-w-md sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Link
              to="/profile"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-brand text-sm font-semibold text-background"
              aria-label="Open profile"
            >
              {data?.avatarSigned ? (
                <img src={data.avatarSigned} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </Link>
          </div>
        </header>

        {/* mobile-only search */}
        <div className="border-b border-border/60 bg-background/70 px-4 py-3 sm:hidden">
          <GlobalSearch />
        </div>

        <main className="flex-1 p-4 sm:p-8">{isIndex ? <DashboardHome /> : <Outlet />}</main>
      </div>
    </div>
  );
}

function DashboardHome() {
  const { data, isLoading, isError, error, refresh } = useCurrentUser();
  const updateAvail = useUpdateAvailability();

  // Check for newly earned achievements on mount
  useEffect(() => {
    if (data?.userId) {
      checkAndAwardAchievements(data.userId).catch(() => {});
    }
  }, [data?.userId]);

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-8 text-center">
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
      <div className="mx-auto max-w-6xl">
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

  const firstName = data.profile?.display_name?.split(" ")[0] ?? data.profile?.handle ?? "creator";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome + availability */}
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
                ? "Finish the last few steps on your profile so other creators can discover you and start exchanging knowledge."
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
        {/* Next steps (only if incomplete) */}
        {pct < 100 && (
          <section className="card-border rounded-3xl border bg-surface p-5 lg:col-span-2 sm:p-6">
            <SectionHeader
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Next steps"
              subtitle="A few things to finish before other creators can find you."
            />
            <div className="mt-4">
              <NextStepsList items={remaining} />
            </div>
          </section>
        )}

        {/* Suggested projects */}
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

        {/* Quick links */}
        {pct < 100 && (
          <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
            <SectionHeader
              icon={<Compass className="h-4 w-4 text-brand-purple" />}
              title="Quick links"
            />
            <div className="mt-4 space-y-2">
              <QuickLink
                to="/profile"
                icon={<User className="h-4 w-4" />}
                label="View your profile"
              />
              <QuickLink
                to="/profile"
                icon={<User className="h-4 w-4" />}
                label="Continue editing"
              />
              <QuickLink
                to="/community"
                icon={<Sparkles className="h-4 w-4" />}
                label="Community feed"
              />
            </div>
          </section>
        )}
      </div>

      {/* Suggested creators — skill-matched */}
      <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-brand-green" />}
          title="Creators you match with"
          subtitle="Based on complementary skills, availability, and language."
        />
        <div className="mt-4">
          <SuggestedCreators />
        </div>
      </section>

      {/* Activity */}
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

      {/* Connections */}
      <ConnectionsCard />

      {/* Discover skills */}
      <section className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title="Discover skills"
          subtitle="Trending across the creator catalog."
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
