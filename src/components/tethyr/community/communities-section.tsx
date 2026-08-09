import { memo, useMemo, useState } from "react";
import { Plus, Search, Users, TrendingUp, Clock } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";
import { CommunityCard } from "@/components/tethyr/community/community-card";
import { CreateSpaceDialog } from "@/components/tethyr/community/create-space-dialog";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SortMode = "newest" | "popular";

/**
 * Self-contained communities view: fetches its own spaces and owns its own
 * search + dialog state. Only mounts while the Communities destination is
 * active, and only notifies the page when a space is opened.
 */
export const CommunitiesSection = memo(function CommunitiesSection({
  onOpenSpace,
}: {
  onOpenSpace: (space: CommunitySpace) => void;
}) {
  const { data: spaces = [], isLoading } = useCommunitySpaces();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("popular");

  const sortedSpaces = useMemo(() => {
    const filtered = spaces.filter((s: CommunitySpace) =>
      search.trim()
        ? s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
        : true,
    );
    if (sortMode === "popular") {
      return [...filtered].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
    }
    return filtered; // newest first (default from hook)
  }, [spaces, search, sortMode]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spaces..."
            className="h-9 rounded-xl border card-border bg-surface pr-4 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-xl border card-border bg-surface p-0.5">
            <button
              onClick={() => setSortMode("popular")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                sortMode === "popular"
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Sort by member count"
            >
              <TrendingUp className="h-3 w-3" />
              Popular
            </button>
            <button
              onClick={() => setSortMode("newest")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                sortMode === "newest"
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Sort by newest first"
            >
              <Clock className="h-3 w-3" />
              Newest
            </button>
          </div>
          <Button size="sm" className="shrink-0 rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border card-border bg-surface h-32 p-5"
            />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No communities yet"
          description="Be the first to create a community space and bring people together."
          actionLabel="Create your first space"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedSpaces
            .map((space: CommunitySpace) => (
              <CommunityCard key={space.id} space={space} onClick={() => onOpenSpace(space)} />
            ))}
        </div>
      )}
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
});
