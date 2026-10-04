import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  Coins,
  Flag,
  FolderGit2,
  GitBranch,
  Hammer,
  LifeBuoy,
  MessageSquare,
  Target,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { GraphNodeType } from "@/lib/graph-model";
import { cn } from "@/lib/utils";

/**
 * Phase 9 node design (spec §21): node types are visually distinguishable
 * without relying on colour. Every graph view draws the same glyph for the
 * same type, so "what this dot is" reads identically on the map, in the
 * outline, and on the summary chips.
 */

const NODE_GLYPHS: Record<GraphNodeType, LucideIcon> = {
  person: User,
  project: FolderGit2,
  skill: Wrench,
  contribution: Hammer,
  knowledge: BookOpen,
  milestone: Flag,
  repository: GitBranch,
  discussion: MessageSquare,
  community: Users,
  session: CalendarDays,
  role: BadgeCheck,
  badge: Award,
  library_item: BookMarked,
  challenge: Target,
  credit: Coins,
  need: LifeBuoy,
  organization: Building2,
};

export function GraphNodeGlyph({ type, className }: { type: GraphNodeType; className?: string }) {
  const Icon = NODE_GLYPHS[type];
  return <Icon className={cn("h-3.5 w-3.5", className)} aria-hidden="true" />;
}

export default GraphNodeGlyph;
