import { ArrowLeft, Users, Settings, Pin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useJoinSpace,
  useLeaveSpace,
  isDefaultSpace,
  type CommunitySpace,
  type SpaceMemberRole,
} from "@/hooks/use-community-spaces";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

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
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);

  function handleToggleMembership() {
    if (space.is_member) {
      leaveSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Left ${space.name}`),
        onError: () => toast.error("Failed to leave"),
      });
    } else {
      joinSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Joined ${space.name}`),
        onError: (err) => toast.error(`Failed to join: ${(err as Error).message}`),
      });
    }
  }

  const initial = space.name.charAt(0).toUpperCase();
  const canManage = myRole === "owner" || myRole === "moderator";

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-0.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-base font-semibold text-foreground">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full rounded-md object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{space.name}</h2>
            {isDefaultSpace(space) && (
              <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                <Pin className="h-3 w-3" />
                Default
              </span>
            )}
            {myRole && (
              <span className="rounded border border-border px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                {myRole}
              </span>
            )}
          </div>
          {space.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{space.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
            </span>
            <span>/{space.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-md px-2.5 text-xs"
              onClick={onOpenSettings}
            >
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          )}
          <Button
            size="sm"
            variant={space.is_member ? "outline" : "default"}
            className="group h-8 rounded-md px-3 text-xs"
            onClick={handleToggleMembership}
            disabled={joinSpace.isPending || leaveSpace.isPending}
          >
            {space.is_member ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                <span className="group-hover:hidden">Joined</span>
                <span className="hidden group-hover:inline">Leave</span>
              </>
            ) : (
              "Join space"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
