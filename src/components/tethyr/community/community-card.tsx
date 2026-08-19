import { Users, UserPlus, Hourglass, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  useJoinSpace,
  useLeaveSpace,
  useRequestToJoinSpace,
  useCancelJoinRequest,
  type CommunitySpace,
} from "@/hooks/use-community-spaces";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export function CommunityCard({ space, onClick }: { space: CommunitySpace; onClick?: () => void }) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();
  const requestJoin = useRequestToJoinSpace();
  const cancelRequest = useCancelJoinRequest();
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);

  function handleToggleMembership(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (space.is_member) {
      leaveSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Left ${space.name}`),
        onError: () => toast.error("Failed to leave"),
      });
    } else if (space.has_pending_request) {
      cancelRequest.mutate(space.id, {
        onSuccess: () => toast.success("Request cancelled"),
        onError: () => toast.error("Failed to cancel request"),
      });
    } else if (space.join_type === "review") {
      requestJoin.mutate(
        { spaceId: space.id },
        {
          onSuccess: () => toast.success("Join request sent"),
          onError: (err) => toast.error(friendlyError(err, "Failed to request")),
        },
      );
    } else {
      joinSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Joined ${space.name}!`),
        onError: (err) => toast.error(friendlyError(err, "Failed to join")),
      });
    }
  }

  const joinPending =
    joinSpace.isPending || leaveSpace.isPending || requestJoin.isPending || cancelRequest.isPending;
  const buttonLabel = space.is_member
    ? "Joined"
    : space.has_pending_request
      ? "Requested"
      : space.join_type === "review"
        ? "Request to join"
        : "Join";
  const ButtonIcon = space.is_member ? Check : space.has_pending_request ? Hourglass : UserPlus;

  const initial = space.name.charAt(0).toUpperCase();

  // The card is a click target that contains its own Join/Leave button, so it
  // must not be a <button> (a button cannot contain a button). A keyboard-
  // accessible div keeps the open-space action while staying valid HTML.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group flex w-full cursor-pointer flex-col rounded-xl border card-border bg-surface p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))] hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-lg font-semibold text-brand-purple">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors"
            title={space.name}
          >
            {space.name}
          </h3>
          {space.description && (
            <p
              className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
              title={space.description ?? undefined}
            >
              {space.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
        </div>
        <Button
          size="sm"
          variant={space.is_member || space.has_pending_request ? "outline" : "default"}
          className="rounded-full text-xs h-8 px-3.5"
          onClick={handleToggleMembership}
          disabled={joinPending}
        >
          <ButtonIcon className="mr-1 h-3 w-3" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
