import { Home, Users, HandHeart, Bookmark, Menu } from "lucide-react";
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
  onOpenSidebar,
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
  onOpenSidebar: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border/60 bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
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
            <Icon className={`h-5 w-5 ${isActive ? "fill-[var(--user-accent,var(--trust))]/15" : ""}`} />
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
    </nav>
  );
}
