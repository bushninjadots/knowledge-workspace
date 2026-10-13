// The community's own navigation: one tab row at the top of the page on every
// width. It replaces the desktop nav card (four links in a 256px column that
// repeated the app sidebar) and the phone tab bar whose floating "+" sat on
// top of the Following label.
import { memo } from "react";
import { Activity, Bookmark, Home, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityNavId } from "@/data/mocks/community-nav";

const TABS: { id: CommunityNavId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "For you", icon: Home },
  { id: "following", label: "Following", icon: UserRound },
  { id: "communities", label: "Spaces", icon: Users },
  { id: "saved", label: "Saved", icon: Bookmark },
];

/** Post-type views are filters of the main feed, so "For you" stays lit. */
const FEED_VIEWS = new Set<CommunityNavId>([
  "home",
  "help",
  "collab",
  "projects",
  "questions",
  "resources",
  "showcase",
  "tip",
  "discussion",
  "trending",
]);

export const CommunityTabs = memo(function CommunityTabs({
  active,
  inSpace,
  onSelect,
  onOpenPulse,
}: {
  active: CommunityNavId;
  /** A space is open — the Spaces tab is where it lives. */
  inSpace: boolean;
  onSelect: (id: CommunityNavId) => void;
  /** Below xl the right rail lives in a drawer; this opens it. */
  onOpenPulse: () => void;
}) {
  const current: CommunityNavId = inSpace
    ? "communities"
    : FEED_VIEWS.has(active)
      ? "home"
      : active;

  return (
    <div className="mb-6 flex items-end gap-2 border-b border-border/60">
      <nav
        aria-label="Community"
        className="-mb-px flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto scrollbar-none"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = current === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-2 px-2.5 pb-3 pt-2 text-sm transition-colors @md:px-3",
                isActive
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "hidden h-4 w-4 @md:block",
                  isActive && "text-[var(--user-accent-text,var(--primary))]",
                )}
                aria-hidden
              />
              {tab.label}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity",
                  isActive ? "bg-[var(--user-accent,var(--primary))] opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onOpenPulse}
        aria-label="Pulse: today, trending skills and your spaces"
        className="mb-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated/60 hover:text-foreground xl:hidden"
      >
        <Activity className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden @lg:inline">Pulse</span>
      </button>
    </div>
  );
});
