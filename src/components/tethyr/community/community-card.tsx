import { Users, UserPlus, Hourglass, Check, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const accentColor =
    space.visibility === "private"
      ? "var(--ai)"
      : space.join_type === "review"
        ? "var(--primary)"
        : "var(--trust)";

  // Keep the open-space action separate from the Join/Leave button. This
  // avoids nested interactive elements and gives keyboard users one clear
  // target for opening the space.
  return (
    <Card className="group relative flex w-full flex-col overflow-hidden p-5 text-left transition-spatial duration-150 hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))]">
      <span
        className="absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: accentColor }}
      />
      <button
        type="button"
        onClick={() => onClick?.()}
        className="flex w-full items-start gap-3 text-left"
        aria-label={`Open ${space.name}`}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-semibold"
          style={{
            background: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width="56"
              height="56"
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary"
            title={space.name}
          >
            {space.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
                color: accentColor,
              }}
            >
              {space.visibility === "private" ? (
                <Lock className="h-2.5 w-2.5" />
              ) : (
                <MessageCircle className="h-2.5 w-2.5" />
              )}
              {space.visibility === "private"
                ? "Private"
                : space.join_type === "review"
                  ? "Approval"
                  : "Open"}
            </span>
          </div>
          {space.description && (
            <p
              className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
              title={space.description ?? undefined}
            >
              {space.description}
            </p>
          )}
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3">
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
    </Card>
  );
}
