import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type Source = "all" | "building" | "collaboration" | "community" | "learning";

/** Map a raw activity kind onto one of Tethyr's activity families. */
function familyOf(kind: string): Exclude<Source, "all"> {
  const k = kind.toLowerCase();
  if (/(session|learn|teach|skill|mentor)/.test(k)) return "learning";
  if (/(contribut|collab|role|team|crew|join|endorse)/.test(k)) return "collaboration";
  if (/(post|comment|discussion|community|space|prompt|challenge|show_your_work)/.test(k))
    return "community";
  return "building";
}

const RANGE_WEEKS: Record<string, number> = { "3": 13, "6": 26, "12": 53 };
const DAY = 86_400_000;

function ProfileActivityHeatmapBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const source = (config.source as Source) ?? "all";
  const weeks = RANGE_WEEKS[String(config.range ?? "12")] ?? 53;
  const showSummary = config.showSummary !== false;

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() - (weeks - 1) * 7);
    return d;
  }, [weeks]);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-activity-heatmap", profileId, weeks],
    queryFn: async () => {
      if (!profileId) return [] as { kind: string; created_at: string }[];
      const { data: rows, error } = await supabase
        .from("activity_events")
        .select("kind, created_at")
        .eq("profile_id", profileId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return rows ?? [];
    },
    enabled: !!profileId,
  });

  const { cells, total, activeDays, max } = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of data ?? []) {
      if (source !== "all" && familyOf(r.kind) !== source) continue;
      const d = new Date(r.created_at);
      d.setHours(0, 0, 0, 0);
      counts.set(d.getTime(), (counts.get(d.getTime()) ?? 0) + 1);
    }
    const today = Date.now();
    const list: { t: number; n: number; future: boolean }[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const t = since.getTime() + i * DAY;
      list.push({ t, n: counts.get(t) ?? 0, future: t > today });
    }
    let sum = 0;
    let peak = 0;
    for (const n of counts.values()) {
      sum += n;
      peak = Math.max(peak, n);
    }
    return { cells: list, total: sum, activeDays: counts.size, max: peak };
  }, [data, source, since, weeks]);

  const hasContent = total > 0;
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (!hasContent) {
    if (isEditing)
      return (
        <BlockEmptyState
          label="Activity"
          detail="Your building, collaboration and community rhythm appears here."
        />
      );
    return null;
  }

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4)));
  const shade = ["bg-muted", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"];

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium text-foreground">Activity</h4>
        {showSummary && (
          <p className="text-xs text-muted-foreground">
            {total} contributions · {activeDays} active days
          </p>
        )}
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`${total} contributions over the last ${weeks} weeks`}
          className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
        >
          {cells.map((c) => (
            <span
              key={c.t}
              title={c.future ? undefined : `${c.n} on ${new Date(c.t).toLocaleDateString()}`}
              className={`h-[11px] w-[11px] rounded-[2px] ${c.future ? "opacity-0" : shade[level(c.n)]}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

registerBlock({
  type: "profile-activity-heatmap",
  category: "people",
  label: "Activity heatmap",
  description: "Your rhythm of building, collaborating and contributing.",
  icon: "Activity",
  defaults: { source: "all", range: "12", showSummary: true },
  fields: [
    {
      key: "source",
      label: "Activity source",
      type: "select",
      options: [
        { label: "All activity", value: "all" },
        { label: "Building", value: "building" },
        { label: "Collaboration", value: "collaboration" },
        { label: "Community", value: "community" },
        { label: "Learning", value: "learning" },
      ],
    },
    {
      key: "range",
      label: "Time range",
      type: "select",
      options: [
        { label: "3 months", value: "3" },
        { label: "6 months", value: "6" },
        { label: "12 months", value: "12" },
      ],
    },
    { key: "showSummary", label: "Show totals", type: "toggle" },
  ],
  component: ProfileActivityHeatmapBlock,
});
export { ProfileActivityHeatmapBlock };
