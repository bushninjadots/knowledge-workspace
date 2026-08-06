import { Calendar } from "lucide-react";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";
import { ContributionGraph } from "./contribution-graph";
import type { ActivityRow } from "@/components/tethyr/profile-sections";

export function ProfileActivityTab({
  userId,
  activity,
}: {
  userId: string;
  activity: ActivityRow[];
}) {
  return (
    <div className="space-y-6">
      {/* CONTRIBUTION GRAPH */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Contribution Graph</h3>
        </div>
        <ContributionGraph activity={activity} />
      </div>

      {/* ACTIVITY TIMELINE */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Activity Timeline</h3>
        </div>
        <ActivityTimeline profileId={userId} events={activity} />
      </div>
    </div>
  );
}
