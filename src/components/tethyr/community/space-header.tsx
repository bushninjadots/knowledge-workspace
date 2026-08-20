import { Users, Settings, Lock, Check, UserPlus, Hourglass, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  useJoinSpace,
  useLeaveSpace,
  useRequestToJoinSpace,
  useCancelJoinRequest,
  type CommunitySpace,
  type SpaceMemberRole,
} from "@/hooks/use-community-spaces";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export function SpaceHeader({
  space,
  myRole,
  onBack,
}: {
  space: CommunitySpace;
  myRole: SpaceMemberRole | null;
  onBack: () => void;
}) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();
  const requestJoin = useRequestToJoinSpace();
  const cancelRequest = useCancelJoinRequest();
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);

  function handleToggleMembership() {
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
          onSuccess: () => toast.success("Join request sent — an owner will review it"),
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
  const canManage = myRole === "owner" || myRole === "moderator";

  return (
    <div className="mb-8">
      {/* Breadcrumb — Communities / space name */}
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1 py-0.5 transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          Communities
        </button>
        <span aria-hidden className="text-muted-foreground/50">
          /
        </span>
        <span className="truncate font-medium text-foreground/80">{space.name}</span>
      </nav>

      {/* Page title row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-purple/10 text-xl font-bold text-brand-purple">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                width="56"
                height="56"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
                {space.name}
              </h1>
              {space.visibility === "private" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
              {space.is_member && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-green">
                  <Check className="h-3.5 w-3.5" />
                  Joined
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="outline" className="rounded-full" asChild>
                <Link to="/spaces/$slug/reports" params={{ slug: space.slug }}>
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                  Reports
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" asChild>
                <Link to="/spaces/$slug/settings" params={{ slug: space.slug }}>
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Settings
                </Link>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={space.is_member || space.has_pending_request ? "outline" : "default"}
            className="rounded-full"
            onClick={handleToggleMembership}
            disabled={joinPending}
            title={
              space.join_type === "review" && !space.is_member
                ? "Owner approval required to join"
                : undefined
            }
          >
            <ButtonIcon className="mr-1.5 h-3.5 w-3.5" />
            {buttonLabel}
          </Button>
        </div>
      </div>

      {space.join_type === "review" && !space.is_member && !space.has_pending_request && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Hourglass className="h-3 w-3" />
          Owner approval required — requests are reviewed before you can post.
        </p>
      )}

      {space.rules && space.rules.length > 0 && (
        <div className="mt-4 rounded-xl border card-border bg-background/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Community rules
          </p>
          <ol className="mt-2 space-y-1.5">
            {space.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>
        </div>
      )}

      {space.description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {space.description}
        </p>
      )}
    </div>
  );
}
