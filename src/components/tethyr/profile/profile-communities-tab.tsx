import { Users } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";

export function ProfileCommunitiesTab() {
  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display text-base font-semibold">Communities</h3>
      </div>
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Coming soon"
        description="Community memberships, roles, and contributions will appear here."
      />
    </div>
  );
}
