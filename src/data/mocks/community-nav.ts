// Community navigation catalog — the destination set rendered in the sidebar
// rail (desktop) and the mobile nav sheet. Post-type views remain valid for
// deep links and are surfaced as secondary filters in the feed header.
import type { LucideIcon } from "lucide-react";
import { Bookmark, Home, UserRound, Users } from "lucide-react";

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
      { id: "following", label: "Following", icon: UserRound },
    ],
  },
  {
    label: "Discover",
    items: [{ id: "communities", label: "Communities", icon: Users }],
  },
  {
    label: "You",
    items: [{ id: "saved", label: "Saved", icon: Bookmark }],
  },
];
