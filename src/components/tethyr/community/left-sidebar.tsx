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
} from "lucide-react";

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
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
      <nav className="card-border rounded-3xl border bg-surface p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
