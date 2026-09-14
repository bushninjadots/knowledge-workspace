import { memo, useMemo } from "react";
import { TrendingUp, UserPlus, MessageSquare } from "lucide-react";
import { useCommunityActivity, type ActivityPoint } from "@/hooks/use-community-activity";

/* ---------- helpers ---------- */

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return String(d.getDate());
}

/* ---------- mini bar chart ---------- */

function MiniBarChart({
  data,
  color,
  label,
  icon: Icon,
}: {
  data: ActivityPoint[];
  color: string;
  label: string;
  icon: typeof TrendingUp;
}) {
  const { bars, maxVal, total } = useMemo(() => {
    const values = data.map((d) => (label === "joins" ? d.joins : d.posts));
    const max = Math.max(1, ...values);
    return {
      bars: values.map((v, i) => ({
        value: v,
        height: (v / max) * 100,
        date: data[i].date,
      })),
      maxVal: max,
      total: values.reduce((a, b) => a + b, 0),
    };
  }, [data, label]);

  return (
    <div className="flex-1">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-foreground">{label === "joins" ? "New Members" : "New Posts"}</span>
        </div>
        <span className="numeric text-sm font-semibold text-foreground">{total}</span>
      </div>
      <div className="flex h-20 items-end gap-1">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="group/bar relative flex-1"
            title={`${formatDay(bar.date)}: ${bar.value}`}
          >
            <div
              className="w-full rounded-t-sm transition-all duration-300"
              style={{
                height: `${Math.max(bar.height, bar.value > 0 ? 6 : 2)}%`,
                background: bar.value > 0 ? color : `color-mix(in oklch, ${color} 15%, transparent)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground/60">
        <span>{formatShortDay(bars[0]?.date ?? "")}</span>
        <span>{formatShortDay(bars[Math.floor(bars.length / 2)]?.date ?? "")}</span>
        <span>{formatShortDay(bars[bars.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}

/* ---------- main component ---------- */

export const ActivityCharts = memo(function ActivityCharts() {
  const { data: activity = [], isLoading } = useCommunityActivity();

  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl bg-surface-elevated/30 p-4">
        <div className="mb-4 h-4 w-32 animate-gentle-pulse rounded bg-surface-elevated" />
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="mb-3 h-7 w-32 animate-gentle-pulse rounded bg-surface-elevated" />
            <div className="h-20 animate-gentle-pulse rounded bg-surface-elevated/40" />
          </div>
          <div className="flex-1">
            <div className="mb-3 h-7 w-32 animate-gentle-pulse rounded bg-surface-elevated" />
            <div className="h-20 animate-gentle-pulse rounded bg-surface-elevated/40" />
          </div>
        </div>
      </div>
    );
  }

  const totalJoins = activity.reduce((a, b) => a + b.joins, 0);
  const totalPosts = activity.reduce((a, b) => a + b.posts, 0);
  const isEmpty = totalJoins === 0 && totalPosts === 0;

  return (
    <section className="mb-6 rounded-xl bg-surface-elevated/30 p-4">
      <div className="mb-3.5 flex items-center gap-1.5 px-1">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <p className="section-label">Community Activity</p>
        <span className="ml-auto text-[11px] text-muted-foreground">Last 14 days</span>
      </div>

      {isEmpty ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          Activity will appear here as people join spaces and start posting.
        </p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
          <MiniBarChart
            data={activity}
            color="var(--brand-green)"
            label="joins"
            icon={UserPlus}
          />
          <div className="hidden sm:block w-px bg-border/40" />
          <MiniBarChart
            data={activity}
            color="var(--primary)"
            label="posts"
            icon={MessageSquare}
          />
        </div>
      )}
    </section>
  );
});
