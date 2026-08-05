import { Users, Pin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useJoinSpace,
  useLeaveSpace,
  isDefaultSpace,
  type CommunitySpace,
} from "@/hooks/use-community-spaces";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export function CommunityCard({ space, onClick }: { space: CommunitySpace; onClick?: () => void }) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);
  const isDefault = isDefaultSpace(space);

  function handleToggleMembership(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

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
  const pending = joinSpace.isPending || leaveSpace.isPending;

  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      className="group flex w-full flex-col rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border hover:bg-surface-elevated/60"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-sm font-semibold text-foreground">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full rounded-md object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{space.name}</h3>
            {isDefault && (
              <span className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                <Pin className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">/{space.slug}</p>
          {space.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
          {space.my_role && space.my_role !== "member" && (
            <span className="ml-1 rounded border border-border px-1.5 py-0.5 capitalize">
              {space.my_role}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={space.is_member ? "outline" : "default"}
          className="h-7 rounded-md px-2.5 text-xs"
          onClick={handleToggleMembership}
          disabled={pending}
        >
          {space.is_member ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              <span className="group-hover:hidden">Joined</span>
              <span className="hidden group-hover:inline">Leave</span>
            </>
          ) : (
            "Join"
          )}
        </Button>
      </div>
    </button>
  );
}
