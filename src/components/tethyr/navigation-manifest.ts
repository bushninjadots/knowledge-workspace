import {
  Bell,
  Compass,
  FolderOpen,
  Home,
  Link2,
  MessageSquare,
  Settings,
  Swords,
  Trophy,
  User,
  Users,
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
      { to: "/library", label: "Library", icon: FolderOpen },
    ],
  },
  {
    label: "Discover",
    items: [
      { to: "/explore", label: "Explore", icon: Compass },
      { to: "/challenges", label: "Challenges", icon: Swords },
      { to: "/sessions", label: "Sessions", icon: Trophy },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/community", label: "Community", icon: Users },
      { to: "/teams", label: "Teams", icon: Users },
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/messages", label: "Messages", icon: MessageSquare },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Your Studio", icon: User },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const satisfies readonly { label: string; items: readonly PrimaryNavItem[] }[];

export const mobilePrimaryNav = [
  navigationGroups[0].items[0],
  navigationGroups[1].items[0],
  navigationGroups[3].items[0],
  navigationGroups[2].items[3],
] as const;

export function isNavItemActive(pathname: string, to: string) {
  return to === "/dashboard" ? pathname === to : pathname.startsWith(to);
}
