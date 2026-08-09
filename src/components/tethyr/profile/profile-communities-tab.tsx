import { Link } from "@tanstack/react-router";
import { Users, Plus, Clock, Lock } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";
import { Button } from "@/components/ui/button";
import {
  useCommunitySpaces,
  useJoinSpace,
  useRequestToJoinSpace,
  type CommunitySpace,
} from "@/hooks/use-community-spaces";

export function ProfileCommunitiesTab() {
  const { data: spaces = [], isLoading, isError } = useCommunitySpaces();
  const joinSpace = useJoinSpace();
  const requestJoin = useRequestToJoinSpace();

  const list = spaces as CommunitySpace[];
  const memberships = list.filter((space) => space.is_member);
  const discoverable = list
    .filter((space) => !space.is_member && !space.has_pending_request)
    .slice(0, 6);
  const pendingSpaces = list.filter((space) => space.has_pending_request);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-xl bg-surface p-5">
          <div className="mb-4 h-5 w-32 rounded bg-surface-elevated" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-24 rounded-xl bg-surface-elevated" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-surface-elevated/30 p-4">
        <p className="text-sm text-muted-foreground">
          Community spaces could not be loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Joined communities */}
      <div className="rounded-xl bg-surface-elevated/30 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Your communities</h3>
            <span className="text-xs text-muted-foreground">({memberships.length})</span>
          </div>
          <Link to="/community" className="text-xs text-primary hover:underline">
            All spaces →
          </Link>
        </div>

        {memberships.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No communities yet"
            description="Join a space to find focused conversations, shared projects, and people building around the same interests."
            variant="community"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.map((space) => (
              <Link
                key={space.id}
                to="/community"
                search={{ space: space.slug }}
                className="group rounded-xl border card-border bg-background/40 p-4 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {space.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={space.name}>
                      {space.name}
                    </p>
                    <p
                      className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                      title={space.description || undefined}
                    >
                      {space.description || "A Tethyr community space"}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {space.my_role === "owner"
                        ? "Owner"
                        : space.my_role === "moderator"
                          ? "Moderator"
                          : "Member"}
                      {" · "}
                      {space.member_count ?? 0} member{space.member_count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pending join requests */}
      {pendingSpaces.length > 0 && (
        <div className="rounded-xl border border-teaching/20 bg-teaching/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-teaching" />
            <h3 className="text-sm font-semibold">Pending requests</h3>
          </div>
          <div className="grid gap-2">
            {pendingSpaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center justify-between rounded-xl border card-border bg-background/40 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teaching/10 text-xs font-semibold text-teaching">
                    {space.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{space.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {space.member_count ?? 0} members · Awaiting approval
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-teaching/10 px-2.5 py-1 text-[11px] font-medium text-teaching">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discover more spaces */}
      {discoverable.length > 0 && (
        <div className="rounded-xl bg-surface-elevated/30 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Discover spaces</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {discoverable.map((space) => (
              <div
                key={space.id}
                className="rounded-xl border card-border bg-background/40 p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-purple)]/10 text-sm font-semibold text-[var(--brand-purple)]">
                    {space.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{space.name}</p>
                    <p
                      className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                      title={space.description || undefined}
                    >
                      {space.description || "A Tethyr community space"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {space.member_count ?? 0} members
                        {space.visibility === "private" && (
                          <>
                            {" "}
                            <Lock className="inline h-2.5 w-2.5" />
                          </>
                        )}
                      </span>
                      {space.join_type === "review" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px]"
                          disabled={requestJoin.isPending}
                          onClick={() => requestJoin.mutate({ spaceId: space.id })}
                        >
                          Request to join
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px]"
                          disabled={joinSpace.isPending}
                          onClick={() => joinSpace.mutate(space.id)}
                        >
                          Join
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
