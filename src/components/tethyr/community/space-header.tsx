import { ArrowLeft, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useJoinSpace,
  useLeaveSpace,
  type CommunitySpace,
  type SpaceMemberRole,
} from "@/hooks/use-community-spaces";

export function SpaceHeader({
  space,
  myRole,
  onBack,
  onOpenSettings,
}: {
  space: CommunitySpace;
  myRole: SpaceMemberRole | null;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();

  function handleToggleMembership() {
    if (space.is_member) {
      leaveSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Left ${space.name}`),
        onError: () => toast.error("Failed to leave"),
      });
    } else {
      joinSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Joined ${space.name}!`),
        onError: () => toast.error("Failed to join"),
      });
    }
  }

  const initial = space.name.charAt(0).toUpperCase();
  const canManage = myRole === "owner" || myRole === "moderator";

  return (
    <div className="mb-6 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-xl font-bold text-brand-purple">
          {space.avatar_url ? (
            <img src={space.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">{space.name}</h2>
          {space.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{space.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={onOpenSettings}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          )}
          <Button
            size="sm"
            variant={space.is_member ? "outline" : "default"}
            className="rounded-full"
            onClick={handleToggleMembership}
            disabled={joinSpace.isPending || leaveSpace.isPending}
          >
            {space.is_member ? "Joined" : "Join"}
          </Button>
        </div>
      </div>
    </div>
  );
}
