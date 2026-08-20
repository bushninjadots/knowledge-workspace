import { memo } from "react";
import { Search, SlidersHorizontal, X, BookmarkCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DISCOVERY_FILTERS, type DiscoveryFocus } from "@/lib/community-data";
import type { CommunityNavId } from "@/components/tethyr/community/left-sidebar";

export type SortMode = "latest" | "hot" | "helpful" | "offers" | "recommended";

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Latest", value: "latest" },
  { label: "Hot", value: "hot" },
  { label: "Recommended", value: "recommended" },
  { label: "Most helpful", value: "helpful" },
  { label: "Most offers", value: "offers" },
];

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent-border,var(--border-strong))]/60 bg-[var(--user-accent-subtle,var(--surface-elevated))] px-2 py-0.5 text-[11px] text-[var(--user-accent,var(--primary))]">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full p-0.5 hover:bg-surface-elevated">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function navTitle(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Community Feed";
    case "communities":
      return "Communities";
    case "help":
      return "Help Requests";
    case "collab":
      return "Collaboration Requests";
    case "projects":
      return "Project Updates";
    case "questions":
      return "Questions";
    case "resources":
      return "Resources";
    case "showcase":
      return "Showcases";
    case "tip":
      return "Tips";
    case "discussion":
      return "Discussions";
    case "challenges":
      return "Challenges";
    case "following":
      return "Following";
    case "saved":
      return "Saved";
    case "trending":
      return "Trending";
    default:
      return "Community";
  }
}

/**
 * Memoized presentational header: title block, search, active-filter badges and
 * the sticky sort/focus controls. All props are controlled by the feed owner,
 * so the header re-renders only when a control value or the result count
 * actually changes.
 */
export const CommunityHeader = memo(function CommunityHeader({
  nav,
  searchQuery,
  onSearchChange,
  isSearching,
  resultCount,
  activeFilterCount,
  focusFilter,
  onFocusFilterChange,
  mySkillsOnly,
  onMySkillsOnlyChange,
  sortMode,
  onSortModeChange,
  onOpenTrending,
}: {
  nav: CommunityNavId;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  resultCount: number;
  activeFilterCount: number;
  focusFilter: DiscoveryFocus | "all";
  onFocusFilterChange: (value: DiscoveryFocus | "all") => void;
  mySkillsOnly: boolean;
  onMySkillsOnlyChange: (value: boolean) => void;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
  onOpenTrending: () => void;
}) {
  const showFeedControls = nav === "home" && !isSearching;

  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary/70">Community</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{navTitle(nav)}</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Share project updates, ask for help, request collaboration, or drop a resource. Every
            post has purpose.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTrending}
          className="flex min-h-11 items-center gap-2 rounded-xl border card-border bg-surface px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground xl:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Trending
        </button>
      </div>

      <div className="relative mt-4">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search the community"
          placeholder="Search projects, skills, people, or ideas..."
          className="h-10 rounded-xl border-border/60 bg-surface pl-9 pr-9 text-sm transition-shadow focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSearching && (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {resultCount} result{resultCount !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
        </p>
      )}
      {!isSearching && activeFilterCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {focusFilter !== "all" && (
            <FilterBadge
              label={`Focus: ${focusFilter}`}
              onRemove={() => onFocusFilterChange("all")}
            />
          )}
          {mySkillsOnly && (
            <FilterBadge label="My skills only" onRemove={() => onMySkillsOnlyChange(false)} />
          )}
          {sortMode !== "latest" && (
            <FilterBadge label={`Sort: ${sortMode}`} onRemove={() => onSortModeChange("latest")} />
          )}
          {activeFilterCount > 1 && (
            <button
              onClick={() => {
                onFocusFilterChange("all");
                onMySkillsOnlyChange(false);
                onSortModeChange("latest");
              }}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {showFeedControls && (
        <div className="sticky top-0 z-20 -mx-2 space-y-1.5 border-b border-border/40 bg-background/85 px-2 py-2 mb-4">
          {/* Row 1: sort + my-skills (post types now live in the sidebar nav) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => onMySkillsOnlyChange(!mySkillsOnly)}
              className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                mySkillsOnly
                  ? "bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookmarkCheck className="mr-1 inline h-3 w-3" />
              My skills
            </button>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortModeChange(opt.value)}
                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                  sortMode === opt.value
                    ? "bg-surface-elevated text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Row 2: focus chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => onFocusFilterChange("all")}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition-colors duration-200 ${
                focusFilter === "all"
                  ? "bg-surface-elevated text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:bg-surface-elevated/30 hover:text-foreground"
              }`}
            >
              Any focus
            </button>
            {DISCOVERY_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => onFocusFilterChange(focusFilter === f ? "all" : f)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition-colors duration-200 ${
                  focusFilter === f
                    ? "bg-surface-elevated text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-surface-elevated/30 hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
});
