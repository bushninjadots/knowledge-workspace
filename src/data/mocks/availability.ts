// Availability status catalog — the set of statuses a member can advertise on
// their profile. Mirrors the `availability` column on `profiles`
// (see src/lib/skill-match.ts for the DB-facing type). Presentation details
// (icon, badge colors) live here too so every surface renders identically.
import type { LucideIcon } from "lucide-react";
import { BookOpen, Circle, Clock, GraduationCap, Users } from "lucide-react";

import type { AvailabilityStatus } from "@/lib/skill-match";

export interface AvailabilityOption {
  value: NonNullable<AvailabilityStatus>;
  label: string;
  icon: LucideIcon;
  /** Text/accent color classes for the badge. */
  color: string;
  /** Background + border classes for the badge. */
  bg: string;
}

export const AVAILABILITY_OPTIONS: AvailabilityOption[] = [
  {
    value: "available",
    label: "Available",
    icon: Circle,
    color: "text-[var(--user-accent,var(--trust))]",
    bg: "bg-[var(--user-accent,var(--trust))]/10 border-[var(--user-accent,var(--trust))]/30",
  },
  {
    value: "busy",
    label: "Busy",
    icon: Clock,
    color: "text-teaching",
    bg: "bg-teaching/10 border-teaching/30",
  },
  {
    value: "learning",
    label: "Learning",
    icon: BookOpen,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
  },
  {
    value: "looking_for_team",
    label: "Looking for Team",
    icon: Users,
    color: "text-brand-purple",
    bg: "bg-brand-purple/10 border-brand-purple/30",
  },
  {
    value: "mentoring",
    label: "Mentoring",
    icon: GraduationCap,
    color: "text-[var(--user-accent,var(--trust))]",
    bg: "bg-[var(--user-accent,var(--trust))]/10 border-[var(--user-accent,var(--trust))]/30",
  },
];
