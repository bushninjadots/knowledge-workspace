import { memo } from "react";
import {
  ArrowDownUp,
  BookmarkCheck,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { DISCOVERY_FILTERS, type DiscoveryFocus } from "@/lib/community-data";
import type { CommunityNavId } from "@/data/mocks/community-nav";

export type SortMode = "latest" | "hot" | "helpful" | "offers" | "recommended";

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Latest", value: "latest" },
  { label: "Hot", value: "hot" },
  { label: "Recommended", value: "recommended" },
  { label: "Most helpful", value: "helpful" },
  { label: "Most offers", value: "offers" },
];

// Ordered by what most needs a response, then what people share.
const POST_TYPE_FILTERS: { label: string; value: CommunityNavId }[] = [
  { label: "Everything", value: "home" },
  { label: "Help requests", value: "help" },
  { label: "Collaborations", value: "collab" },
  { label: "Questions", value: "questions" },
  { label: "Showcases", value: "showcase" },
  { label: "Project updates", value: "projects" },
  { label: "Discussions", value: "discussion" },
  { label: "Resources", value: "resources" },
  { label: "Tips", value: "tip" },
];

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent-border,var(--border-strong))]/60 bg-[var(--user-accent-subtle,var(--surface-elevated))] px-2 py-0.5 text-[11px] text-[var(--user-accent-text,var(--primary))]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function navTitle(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Community";
    case "communities":
      return "Spaces";
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

function navDescription(nav: CommunityNavId): string {
  switch (nav) {
    case "home":
      return "Find work worth responding to, share progress, and leave useful context.";
    case "communities":
      return "Smaller rooms around a craft — join one to post, reply and keep up.";
    case "help":
      return "People who need a hand with something real.";
    case "collab":
      return "Open calls for teammates, feedback, and shared work.";
    case "projects":
      return "Project updates from people building in public.";
    case "questions":
      return "Questions with enough context to earn a useful answer.";
    case "resources":
      return "Tools, references, and working knowledge worth passing on.";
    case "showcase":
      return "Show the work, the process, and what changed.";
    case "tip":
      return "Lessons learned from making the thing.";
    case "discussion":
      return "Open-ended conversations with a reason to exist.";
    case "challenges":
      return "Practice with visible outcomes.";
    case "following":
      return "Posts from people whose work you want to keep up with.";
    case "saved":
      return "The posts and ideas you chose to keep close.";
    case "trending":
      return "What is drawing useful attention across Tethyr.";
    default:
      return "A place for purposeful posts, useful context, and collaboration.";
  }
}

/**
 * Memoized presentational header: title, search, and one row of feed controls
 * (post-type chips, a Sort menu and a Filters menu). All props are controlled
 * by the feed owner, so the header re-renders only when a control value or
 * the result count actually changes.
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
  onNavChange,
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
  onNavChange: (value: CommunityNavId) => void;
}) {
  const showFeedControls =
    nav !== "communities" && nav !== "challenges" && nav !== "following" && !isSearching;
  // Type chips live on the main feed; the type views keep them so you can hop
  // between types without going back to "All".
  const typeView = POST_TYPE_FILTERS.some((filter) => filter.value === nav);
  const narrowCount = (focusFilter !== "all" ? 1 : 0) + (mySkillsOnly ? 1 : 0);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Latest";

  return (
    <header className="mb-6">
      <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {navTitle(nav)}
          </h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{navDescription(nav)}</p>
        </div>
        {nav !== "communities" && (
          <div className="relative w-full @3xl:w-80">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search the community"
              placeholder="Search posts, skills, people…"
              className="h-10 rounded-lg border-border/60 bg-surface pl-9 pr-9 text-sm"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {isSearching && (
        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {resultCount} result{resultCount !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
        </p>
      )}

      {showFeedControls && (
        <div className="mt-5 flex items-center gap-2">
          {(nav === "home" || typeView) && (
            <div
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-6 scrollbar-none [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]"
              role="group"
              aria-label="Post types"
            >
              {POST_TYPE_FILTERS.map((filter) => {
                const active = nav === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onNavChange(filter.value)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors duration-150",
                      active
                        ? "border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] font-medium text-[var(--user-accent-text,var(--foreground))]"
                        : "border-transparent text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Sort: ${sortLabel}`}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden @lg:inline">{sortLabel}</span>
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Sort posts</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortMode}
                  onValueChange={(value) => onSortModeChange(value as SortMode)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                    narrowCount > 0
                      ? "border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] text-[var(--user-accent-text,var(--foreground))]"
                      : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={narrowCount ? `Filters, ${narrowCount} on` : "Filters"}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden @lg:inline">Filters</span>
                  {narrowCount > 0 && (
                    <span className="numeric rounded-full bg-[var(--user-accent,var(--primary))] px-1.5 text-[10px] font-semibold text-[var(--user-accent-foreground,var(--primary-foreground))]">
                      {narrowCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={mySkillsOnly}
                  onCheckedChange={(checked) => onMySkillsOnlyChange(checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Only my skills
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Focus</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={focusFilter}
                  onValueChange={(value) => onFocusFilterChange(value as DiscoveryFocus | "all")}
                >
                  <DropdownMenuRadioItem value="all">Any focus</DropdownMenuRadioItem>
                  {DISCOVERY_FILTERS.map((focus) => (
                    <DropdownMenuRadioItem key={focus} value={focus}>
                      {focus}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {!isSearching && activeFilterCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            <FilterBadge label={`Sort: ${sortLabel}`} onRemove={() => onSortModeChange("latest")} />
          )}
          {activeFilterCount > 1 && (
            <button
              type="button"
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
    </header>
  );
});
