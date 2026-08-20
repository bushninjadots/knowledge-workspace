import { Home, Users, HandHeart, Bookmark, Menu, Plus } from "lucide-react";
import type { CommunityNavId } from "./left-sidebar";

const MOBILE_NAV = [
  { id: "home" as CommunityNavId, label: "Home", icon: Home },
  { id: "communities" as CommunityNavId, label: "Communities", icon: Users },
  { id: "help" as CommunityNavId, label: "Help", icon: HandHeart },
  { id: "saved" as CommunityNavId, label: "Saved", icon: Bookmark },
] as const;

export function MobileBottomNav({
  active,
  onSelect,
  onPost,
  onOpenSidebar,
  position = "bottom",
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
  /** Opens the composer — mobile needs a visible write affordance. */
  onPost: () => void;
  onOpenSidebar: () => void;
  position?: "bottom" | "top";
}) {
  return (
    <nav
      aria-label="Community navigation"
      className={`${
        position === "bottom"
          ? "fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
          : "relative mb-4 border-b"
      } border-border/60 bg-surface/95 backdrop-blur-xl lg:hidden`}
    >
      <div className="relative">
        <div className="flex items-stretch px-2">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  isActive
                    ? "text-[var(--user-accent,var(--trust))] font-semibold"
                    : "text-muted-foreground active:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? "fill-[var(--user-accent,var(--trust))]/15" : ""}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={onOpenSidebar}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors active:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
        {/* Raised post action — anchored to the wrapper so it stays above the bar */}
        <button
          onClick={onPost}
          aria-label="Write a post"
          title="Write a post"
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-95"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <Plus className="h-5 w-5" />
          </span>
        </button>
      </div>
    </nav>
  );
}
