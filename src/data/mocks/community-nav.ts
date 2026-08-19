// Community navigation catalog — the destination set rendered in the sidebar
// rail (desktop) and the mobile nav sheet. Grouped by purpose; the union keeps
// older ids (questions, following) valid so deep links never break even when a
// group doesn't surface them as top-level items.
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  FolderKanban,
  HandHeart,
  Handshake,
  HelpCircle,
  Home,
  Library,
  Lightbulb,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

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

export interface CommunityNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** External destination (rendered as a Link, e.g. the profile page). */
  href?: string;
}

export interface CommunityNavGroup {
  label: string;
  items: CommunityNavItem[];
}

export const COMMUNITY_NAV_GROUPS: CommunityNavGroup[] = [
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
