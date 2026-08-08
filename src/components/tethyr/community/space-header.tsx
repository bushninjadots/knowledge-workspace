import { Users, Settings, Lock, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useJoinSpace,
  useLeaveSpace,
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
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);

  function handleToggleMembership() {
    if (space.is_member) {
      leaveSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Left ${space.name}`),
        onError: () => toast.error("Failed to leave"),
      });
    } else {
      joinSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Joined ${space.name}!`),
        onError: (err) => toast.error(`Failed to join: ${(err as Error).message}`),
      });
    }
  }

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
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-purple/10 text-xl font-bold text-brand-purple">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-title truncate text-2xl font-semibold tracking-tight">
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
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/spaces/$slug/settings" params={{ slug: space.slug }}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Settings
              </Link>
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

      {space.description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {space.description}
        </p>
      )}
    </div>
  );
}
