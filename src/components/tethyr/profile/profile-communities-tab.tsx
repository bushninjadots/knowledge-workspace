import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";

export function ProfileCommunitiesTab() {
  const { data: spaces = [], isLoading, isError } = useCommunitySpaces();
  const memberships = spaces.filter((space: CommunitySpace) => space.is_member);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Communities</h3>
        </div>
        <Link to="/community" className="text-xs text-primary hover:underline">
          Explore spaces
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading communities">
          {[1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Community memberships could not be loaded. Try again from the Community page.
        </p>
      ) : memberships.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No communities yet"
          description="Join a space to find focused conversations, shared projects, and people building around the same interests."
          actionLabel="Find a community"
          actionHref="/community"
          variant="community"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {memberships.map((space: CommunitySpace) => (
            <Link
              key={space.id}
              to="/community"
              search={{ space: space.slug }}
              className="group rounded-2xl border border-border/60 bg-background/40 p-4 transition hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {space.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {space.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
  );
}
