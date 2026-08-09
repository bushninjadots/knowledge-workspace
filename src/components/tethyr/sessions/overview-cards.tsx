import { CalendarDays, CheckCircle, Clock, Users, CalendarClock } from "lucide-react";
import type { useSessionStats } from "@/hooks/use-sessions";

type Stats = ReturnType<typeof useSessionStats>["data"];

export function OverviewCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: "Upcoming Sessions",
      value: stats?.upcomingCount ?? 0,
      icon: CalendarDays,
      color: "text-learning",
      bg: "bg-learning-subtle",
    },
    {
      label: "Completed Sessions",
      value: stats?.completedCount ?? 0,
      icon: CheckCircle,
      color: "text-trust",
      bg: "bg-trust-subtle",
    },
    {
      label: "Pending Requests",
      value: stats?.pendingCount ?? 0,
      icon: Users,
      color: "text-teaching",
      bg: "bg-teaching-subtle",
    },
    {
      label: "Hours This Month",
      value: stats?.hoursThisMonth ?? 0,
      icon: Clock,
      color: "text-ai",
      bg: "bg-ai-subtle",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="group rounded-2xl border card-border bg-surface/30 p-4 transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface/50"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </p>
              </div>
              <div
                className={`rounded-xl ${card.bg} p-2.5 transition-transform group-hover:scale-105`}
              >
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NextSessionCountdown({
  nextSession,
}: {
  nextSession?: { title: string; starts_at: string | null } | null;
}) {
  if (!nextSession?.starts_at) return null;

  const start = new Date(nextSession.starts_at);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  if (diffMs < 0) return null;

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

  let timeStr = "";
  if (days > 0) timeStr += `${days}d`;
  if (hours > 0) timeStr += `${hours}h`;
  timeStr += `${minutes}m`;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4">
      <div className="rounded-xl bg-brand-green/10 p-2.5">
        <CalendarClock className="h-5 w-5 text-brand-green" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-brand-green/80">
          Next Session
        </p>
        <p className="truncate text-sm font-medium text-foreground">{nextSession.title}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold tabular-nums text-brand-green">{timeStr}</p>
        <p className="text-[11px] text-muted-foreground">
          {start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
