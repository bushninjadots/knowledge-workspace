import {
  Home,
  Users,
  FolderKanban,
  HelpCircle,
  Library,
  Trophy,
  Heart,
  Bookmark,
  TrendingUp,
  HandHeart,
  Handshake,
  Plus,
  Pin,
} from "lucide-react";
import { useMySpaces, isDefaultSpace, type CommunitySpace } from "@/hooks/use-community-spaces";

const NAV = [
  { id: "home", label: "Home Feed", icon: Home },
  { id: "communities", label: "Communities", icon: Users },
  { id: "help", label: "Help Requests", icon: HandHeart },
  { id: "collab", label: "Collaborations", icon: Handshake },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "resources", label: "Resources", icon: Library },
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "following", label: "Following", icon: Heart },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "trending", label: "Trending", icon: TrendingUp },
] as const;

export type CommunityNavId = (typeof NAV)[number]["id"];

export function CommunityLeftSidebar({
  active,
  onSelect,
  activeSpaceSlug,
  onSelectSpace,
  onCreateSpace,
  mobile = false,
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
  activeSpaceSlug?: string | null;
  onSelectSpace?: (slug: string) => void;
  onCreateSpace?: () => void;
  mobile?: boolean;
}) {
  const { data: mySpaces = [] } = useMySpaces();

  return (
    <aside
      className={
        mobile
          ? "flex w-full flex-col gap-4"
          : "hidden w-60 shrink-0 flex-col gap-4 lg:flex"
      }
    >

      <nav className="rounded-lg border border-border bg-surface p-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id && !activeSpaceSlug;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-lg border border-border bg-surface p-1.5">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            My spaces
          </p>
          {onCreateSpace && (
            <button
              onClick={onCreateSpace}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Create space"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {mySpaces.length === 0 ? (
          <p className="px-2.5 pb-2 text-xs text-muted-foreground">
            Join a space to see it pinned here.
          </p>
        ) : (
          mySpaces.map((space: CommunitySpace) => {
            const isActive = activeSpaceSlug === space.slug;
            return (
              <button
                key={space.id}
                onClick={() => onSelectSpace?.(space.slug)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-surface-elevated font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-xs">
                  {space.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{space.name}</span>
                {isDefaultSpace(space) && (
                  <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
