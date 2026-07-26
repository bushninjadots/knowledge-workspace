import { Clock } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";

export function ProfileSessionsTab({ isOwnProfile }: { userId: string; isOwnProfile: boolean }) {
  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display text-base font-semibold">Sessions</h3>
      </div>

      {/* STATS ROW */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-center">
          <div className="text-2xl font-bold text-primary">0</div>
          <div className="mt-1 text-xs text-muted-foreground">Completed</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-center">
          <div className="text-2xl font-bold text-[var(--brand-purple)]">0</div>
          <div className="mt-1 text-xs text-muted-foreground">Hours shared</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-center">
          <div className="text-2xl font-bold text-[var(--brand-green)]">0</div>
          <div className="mt-1 text-xs text-muted-foreground">People helped</div>
        </div>
      </div>

      <EmptyState
        icon={<Clock className="h-5 w-5" />}
        title="No sessions yet"
        description={
          isOwnProfile
            ? "Your completed collaborations will appear here."
            : "This user hasn't completed any sessions yet."
        }
      />
    </div>
  );
}
