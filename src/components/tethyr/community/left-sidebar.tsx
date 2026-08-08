import { memo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  Users,
  FolderKanban,
  Library,
  Trophy,
  Bookmark,
  TrendingUp,
  HandHeart,
  Handshake,
  UserRound,
  Sparkles,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosts } from "@/hooks/use-community";

/**
 * Single consolidated destination set, grouped by purpose. The union below
 * keeps older ids (questions, following) valid so deep links and the mobile
 * nav never break — the sidebar just doesn't surface them as top-level items.
 */
export type CommunityNavId =
  | "home"
  | "communities"
  | "help"
  | "collab"
  | "projects"
  | "questions"
  | "resources"
  | "challenges"
  | "following"
  | "saved"
  | "trending"
  | "showcase"
  | "tip"
  | "discussion";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** External destination (rendered as a Link, e.g. the profile page). */
  href?: string;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Feed",
    items: [
      { id: "home", label: "Home feed", icon: Home },
      { id: "help", label: "Help requests", icon: HandHeart },
      { id: "collab", label: "Collaborations", icon: Handshake },
    ],
  },
  {
    label: "Post types",
    items: [
      { id: "showcase", label: "Showcases", icon: Sparkles },
      { id: "questions", label: "Questions", icon: HelpCircle },
      { id: "tip", label: "Tips", icon: Lightbulb },
      { id: "discussion", label: "Discussions", icon: MessageSquare },
    ],
  },
  {
    label: "Discover",
    items: [
      { id: "communities", label: "Communities", icon: Users },
      { id: "challenges", label: "Challenges", icon: Trophy },
      { id: "trending", label: "Trending", icon: TrendingUp },
      { id: "resources", label: "Resources", icon: Library },
    ],
  },
  {
    label: "You",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban },
      { id: "saved", label: "Saved", icon: Bookmark },
      { id: "profile", label: "Profile", icon: UserRound, href: "/profile" },
    ],
  },
];

/**
 * Memoized nav rail. Counts are derived from the shared posts query cache —
 * the rail, feed and sidebar each read the same key, so there is a single
 * network fetch. Re-renders only when the active destination or layout class
 * changes, never when feed/header state updates.
 */
export const CommunityLeftSidebar = memo(function CommunityLeftSidebar({
  active,
  onSelect,
  onNavigate,
  className,
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
  /** Called after any navigation (incl. external links) — used to close sheets. */
  onNavigate?: () => void;
  /** Layout override — the desktop rail is hidden below lg; a sheet passes w-full. */
  className?: string;
}) {
  const { data: posts = [] } = usePosts();
  const helpCount = posts.filter((p) => p.type === "help_request").length;
  const collabCount = posts.filter((p) => p.type === "collaboration_request").length;
  const countFor = (id: string) =>
    id === "help" ? helpCount : id === "collab" ? collabCount : undefined;

  return (
    <aside className={cn("w-64 shrink-0", className)}>
      <nav className="flex flex-col gap-5 rounded-xl border card-border bg-surface p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="section-label mb-1.5 px-3">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                const count = countFor(item.id);
                const rowClass = cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-surface-elevated font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground",
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(rowClass, "no-underline")}
                      title={item.label}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id as CommunityNavId);
                      onNavigate?.();
                    }}
                    className={rowClass}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    {count != null && count > 0 && (
                      <span className="numeric shrink-0 rounded-full bg-[var(--user-accent-subtle,var(--surface-elevated))] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--user-accent,var(--primary))]">
                        {count}
                      </span>
                    )}
                    {isActive && (count == null || count === 0) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
});
