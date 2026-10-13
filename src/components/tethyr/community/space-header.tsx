import {
  Users,
  Settings,
  Lock,
  Check,
  UserPlus,
  Hourglass,
  ShieldAlert,
  MessageCircle,
  ChevronDown,
  CalendarDays,
  X,
} from "lucide-react";
import { useState } from "react";
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
import { SpaceAvatar, SpaceBanner } from "@/components/tethyr/community/space-media";
import { isHexColor, spaceAccent } from "@/lib/space-identity";
import { onColour } from "@/lib/site-appearance";

export type SpaceSortMode = "latest" | "top" | "unanswered";

export function SpaceHeader({
  space,
  myRole,
  onBack,
  sortMode,
  onSortModeChange,
  postCount,
}: {
  space: CommunitySpace;
  /** Threads loaded for the room, shown with the stats. */
  postCount?: number;
  myRole: SpaceMemberRole | null;
  onBack: () => void;
  sortMode: SpaceSortMode;
  onSortModeChange: (mode: SpaceSortMode) => void;
}) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();
  const requestJoin = useRequestToJoinSpace();
  const cancelRequest = useCancelJoinRequest();

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

  const canManage = myRole === "owner" || myRole === "moderator";

  const accentColor = spaceAccent(space);

  return (
    <div className="mb-8">
      {/* Breadcrumb — Spaces / space name */}
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1 py-0.5 transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          Spaces
        </button>
        <span aria-hidden className="text-muted-foreground/50">
          /
        </span>
        <span className="truncate font-medium text-foreground/80">{space.name}</span>
      </nav>

      {/* Forum header: the owner's banner and picture, name, tagline, stats
          and topics. Everything falls back to the space's colour. */}
      <div className="community-card overflow-hidden" style={{ padding: 0 }}>
        <SpaceBanner path={space.banner_url} accent={accentColor} className="h-28 sm:h-36" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3 sm:-mt-12">
            <SpaceAvatar
              name={space.name}
              path={space.avatar_url}
              accent={accentColor}
              className="h-20 w-20 text-3xl ring-4 ring-[var(--card)] sm:h-24 sm:w-24"
            />
            <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
              {canManage && (
                <>
                  <Button size="sm" variant="outline" className="rounded-full bg-card" asChild>
                    <Link to="/spaces/$slug/reports" params={{ slug: space.slug }}>
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                      Reports
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full bg-card" asChild>
                    <Link to="/spaces/$slug/settings" params={{ slug: space.slug }}>
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      {myRole === "owner" ? "Customize" : "Settings"}
                    </Link>
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant={space.is_member || space.has_pending_request ? "outline" : "default"}
                className={
                  space.is_member || space.has_pending_request
                    ? "rounded-full bg-card"
                    : "rounded-full"
                }
                style={
                  space.is_member || space.has_pending_request
                    ? undefined
                    : isHexColor(space.accent_color)
                      ? { background: space.accent_color, color: onColour(space.accent_color) }
                      : undefined
                }
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

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {space.name}
            </h1>
            {space.visibility === "private" && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `color-mix(in oklab, ${accentColor} 14%, transparent)`,
                  color: `color-mix(in oklab, ${accentColor} 75%, var(--foreground))`,
                }}
              >
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            {space.is_member && (
              <span className="inline-flex items-center gap-1 rounded-full bg-trust/10 px-2 py-0.5 text-[11px] font-medium text-trust">
                <Check className="h-3 w-3" />
                Joined
              </span>
            )}
          </div>
          {(space.tagline || space.description) && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {space.tagline || space.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span className="numeric font-medium text-foreground">{space.member_count ?? 0}</span>
              {(space.member_count ?? 0) === 1 ? "member" : "members"}
            </span>
            {postCount !== undefined && (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                <span className="numeric font-medium text-foreground">{postCount}</span>
                {postCount === 1 ? "thread" : "threads"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Since {formatSince(space.created_at)}
            </span>
          </div>

          {(space.topics?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
              {space.topics!.map((topic) => (
                <li
                  key={topic}
                  className="rounded-full border px-2.5 py-0.5 text-xs"
                  style={{
                    borderColor: `color-mix(in oklab, ${accentColor} 35%, var(--border))`,
                    background: `color-mix(in oklab, ${accentColor} 8%, var(--card))`,
                  }}
                >
                  {topic}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {space.join_type === "review" && !space.is_member && !space.has_pending_request && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Hourglass className="h-3 w-3" />
          Owner approval required — requests are reviewed before you can post.
        </p>
      )}

      {space.is_member && space.welcome_message && (
        <SpaceWelcome spaceId={space.id} message={space.welcome_message} accent={accentColor} />
      )}

      {space.rules && space.rules.length > 0 && (
        // Open for people deciding whether to join; folded for members.
        <details
          open={!space.is_member}
          className="community-card group mt-3 xl:hidden [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5">
            <span className="section-label">Room rules · {space.rules.length}</span>
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ol className="space-y-1.5 px-4 pb-4">
            {space.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="section-label">Conversation</span>
        <div
          role="group"
          aria-label="Sort room discussion"
          className="flex items-center gap-0.5 rounded-lg bg-surface-elevated/40 p-0.5"
        >
          {(
            [
              ["latest", "Latest"],
              ["top", "Top"],
              ["unanswered", "Unanswered"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onSortModeChange(value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                sortMode === value
                  ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-[var(--user-accent-text,var(--primary))]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSince(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const WELCOME_KEY = (spaceId: string) => `tethyr-space-welcome-dismissed:${spaceId}`;

/** The owner's welcome note for members, until they dismiss it. */
function SpaceWelcome({
  spaceId,
  message,
  accent,
}: {
  spaceId: string;
  message: string;
  accent: string;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY(spaceId)) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <div
      className="community-card mt-3 flex items-start gap-3 p-4"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 40%, var(--border))`,
        background: `color-mix(in oklab, ${accent} 8%, var(--card))`,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="section-label mb-1">Welcome</p>
        <p className="whitespace-pre-line text-sm leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(WELCOME_KEY(spaceId), "1");
          } catch {
            /* hidden for this visit only */
          }
        }}
        aria-label="Dismiss welcome note"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
