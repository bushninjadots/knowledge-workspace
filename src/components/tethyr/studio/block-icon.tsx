// The Lucide icon each block names in its registration, from an explicit map
// (importing Lucide's whole icon index would ship every icon to the editor).

import {
  Activity,
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  Camera,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  GitCommitVertical,
  GraduationCap,
  Hammer,
  Heading,
  Heart,
  Image,
  Layout,
  Lightbulb,
  Link2,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  Milestone,
  Minus,
  MousePointerClick,
  Network,
  Quote,
  Search,
  Sparkles,
  Square,
  Type,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Activity,
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  Camera,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  GitCommitVertical,
  GraduationCap,
  Hammer,
  Heading,
  Heart,
  Image,
  Layout,
  Lightbulb,
  Link2,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  Milestone,
  Minus,
  MousePointerClick,
  Network,
  Quote,
  Search,
  Sparkles,
  Type,
  User,
  Users,
  Wrench,
};

/** A block's icon in a small accent-tinted tile. */
export function BlockIcon({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const Icon = ICONS[name] ?? Square;
  return (
    <span
      aria-hidden
      className={
        size === "sm"
          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[var(--user-accent-subtle,var(--surface-sunken))] text-[var(--user-accent-text,var(--primary))]"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--user-accent-subtle,var(--surface-sunken))] text-[var(--user-accent-text,var(--primary))]"
      }
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}
