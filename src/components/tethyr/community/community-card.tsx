import type { CSSProperties } from "react";
import { Users, UserPlus, Hourglass, Check, Lock, MessageCircle } from "lucide-react";
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
import {
  SpaceAvatar,
  SpaceBanner,
  useSpaceAccent,
} from "@/components/tethyr/community/space-media";

export function CommunityCard({ space, onClick }: { space: CommunitySpace; onClick?: () => void }) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();
  const requestJoin = useRequestToJoinSpace();
  const cancelRequest = useCancelJoinRequest();

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

  const accentColor = useSpaceAccent(space);
  const kindLabel =
    space.visibility === "private" ? "Private" : space.join_type === "review" ? "Approval" : "Open";

  // Keep the open-space action separate from the Join/Leave button. This
  // avoids nested interactive elements and gives keyboard users one clear
  // target for opening the space.
  return (
    <div
      // Each space's card takes that space's colour.
      style={{ "--community-tint": accentColor } as CSSProperties}
      className="community-card content-safe group relative flex w-full min-w-0 flex-col overflow-hidden p-0 text-left transition-spatial duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--community-tint)_45%,var(--border))]"
    >
      <button
        type="button"
        onClick={() => onClick?.()}
        className="flex w-full flex-col text-left"
        aria-label={`Open ${space.name}`}
      >
        <SpaceBanner path={space.banner_url} accent={accentColor} className="h-16 w-full" />
        <div className="flex w-full items-end gap-3 px-5">
          <SpaceAvatar
            name={space.name}
            path={space.avatar_url}
            accent={accentColor}
            className="-mt-7 h-14 w-14 text-xl ring-4 ring-[color-mix(in_oklab,var(--community-tint,var(--primary))_8%,var(--surface))]"
          />
          <span
            className="mb-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              background: `color-mix(in oklab, ${accentColor} 14%, transparent)`,
              color: `color-mix(in oklab, ${accentColor} 75%, var(--foreground))`,
            }}
          >
            {space.visibility === "private" ? (
              <Lock className="h-2.5 w-2.5" />
            ) : (
              <MessageCircle className="h-2.5 w-2.5" />
            )}
            {kindLabel}
          </span>
        </div>
        <div className="min-w-0 px-5 pt-2.5">
          <h3
            className="truncate font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary"
            title={space.name}
          >
            {space.name}
          </h3>
          {(space.tagline || space.description) && (
            <p
              className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
              title={space.tagline || space.description || undefined}
            >
              {space.tagline || space.description}
            </p>
          )}
          {(space.topics?.length ?? 0) > 0 && (
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {space.topics!.slice(0, 4).join(" · ")}
            </p>
          )}
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3 px-5 pb-5">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated/50 px-2 py-0.5 font-medium text-muted-foreground">
            <Users className="h-3 w-3" />
            {space.member_count ?? 0}
          </span>
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
