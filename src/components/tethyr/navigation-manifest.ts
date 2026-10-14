import {
  Bell,
  Compass,
  Home,
  Link2,
  MessageSquare,
  Rocket,
  Settings,
  Swords,
  Tags,
  User,
  Users,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";

type PrimaryNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: Home },
      // The weekly habit. (Library left the nav on purpose: it's a notes tool,
      // not part of the loop; projects and search still open it.)
      { to: "/ships", label: "Ship log", icon: Rocket },
    ],
  },
  {
    label: "Discover",
    items: [
      { to: "/explore", label: "Explore", icon: Compass },
      { to: "/skills", label: "Skills", icon: Tags },
      { to: "/challenges", label: "Challenges", icon: Swords },
      { to: "/sessions", label: "Sessions", icon: Video },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/community", label: "Community", icon: Users },
      { to: "/teams", label: "Teams", icon: UsersRound },
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/messages", label: "Messages", icon: MessageSquare },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "You",
    items: [
      { to: "/profile", label: "Your Studio", icon: User },
      { to: "/studio", label: "Edit Studio", icon: Settings },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const satisfies readonly { label: string; items: readonly PrimaryNavItem[] }[];

export const mobilePrimaryNav = [
  navigationGroups[0].items[0],
  navigationGroups[0].items[1],
  navigationGroups[1].items[0],
  navigationGroups[2].items[3],
] as const;

export function isNavItemActive(pathname: string, to: string) {
  return to === "/dashboard" ? pathname === to : pathname.startsWith(to);
}
