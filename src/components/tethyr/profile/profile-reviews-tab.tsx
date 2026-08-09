import { Star } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";

export function ProfileReviewsTab({ isOwnProfile }: { isOwnProfile: boolean }) {
  return (
    <div className="rounded-2xl border card-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display text-base font-semibold">Reviews</h3>
      </div>
      <EmptyState
        icon={<Star className="h-5 w-5" />}
        title={isOwnProfile ? "No reviews yet" : "No reviews yet"}
        description={
          isOwnProfile
            ? "Reviews from collaborators you've worked with will appear here."
            : "Reviews from people they've worked with will appear here."
        }
      />
    </div>
  );
}
