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
  Code2,
  Bot,
  ShieldCheck,
  Languages,
  Gamepad2,
  Palette,
  Briefcase,
  Camera,
  Music2,
  Dumbbell,
  HandHeart,
  Handshake,
} from "lucide-react";
import { COMMUNITIES, ACTIVE_LEARNING_GOALS, type Community } from "@/lib/community-data";

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

export const COMMUNITY_ICON: Record<string, typeof Code2> = {
  programming: Code2,
  ai: Bot,
  cybersecurity: ShieldCheck,
  languages: Languages,
  "game-dev": Gamepad2,
  design: Palette,
  business: Briefcase,
  photography: Camera,
  music: Music2,
  fitness: Dumbbell,
};

export function formatMembers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}

export type CommunityNavId = (typeof NAV)[number]["id"];

export function CommunityLeftSidebar({
  active,
  onSelect,
  activeCommunity,
  onSelectCommunity,
  mobile = false,
}: {
  active: CommunityNavId;
  onSelect: (id: CommunityNavId) => void;
  activeCommunity: string | null;
  onSelectCommunity: (id: string | null) => void;
  mobile?: boolean;
}) {
  return (
    <aside className={`${mobile ? "flex" : "hidden w-64 shrink-0 flex-col gap-6 lg:flex"}`}>
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

      <div className="card-border rounded-3xl border bg-surface p-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Currently learning
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {ACTIVE_LEARNING_GOALS.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="card-border rounded-3xl border bg-surface p-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Popular communities
        </p>
        <div className="mt-2 flex flex-col gap-0.5">
          {COMMUNITIES.map((c: Community) => {
            const Icon = COMMUNITY_ICON[c.id] ?? Users;
            const isActive = activeCommunity === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelectCommunity(isActive ? null : c.id)}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 text-brand-purple" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatMembers(c.members)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
