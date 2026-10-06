// ── Block suggestions ─────────────────────────────────────────────────────────
// "Suggested for you" in the Studio's Add panel: blocks that would show
// something the member already has (projects, skills, links…) or that most
// strong Studios carry (a next step, a few numbers), and that aren't on the
// page yet. Pure, so the ranking is testable.

import type { PageLayout } from "@/lib/page-blocks";

export interface SuggestionFacts {
  projectCount: number;
  skillCount: number;
  hasBio: boolean;
  linkCount: number;
  toolCount: number;
  yearsExperience: number | null;
  availability: string | null;
}

export interface BlockSuggestion {
  type: string;
  reason: string;
}

/** Up to `limit` blocks worth adding, best first, never one already placed. */
export function suggestBlocks(
  layout: PageLayout,
  facts: SuggestionFacts,
  limit = 4,
): BlockSuggestion[] {
  const used = new Set(layout.sections.flatMap((s) => s.blocks.map((b) => b.type)));
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  const candidates: Array<BlockSuggestion & { when: boolean }> = [
    {
      type: "profile-projects",
      when: facts.projectCount > 0,
      reason: `You have ${plural(facts.projectCount, "project")} visitors can't see yet.`,
    },
    {
      type: "call-to-action",
      when: true,
      reason: "Give visitors one clear next step — hire me, book a call.",
    },
    {
      type: "profile-skills",
      when: facts.skillCount > 0,
      reason: `Show the ${plural(facts.skillCount, "skill")} on your profile.`,
    },
    {
      type: "highlights",
      when: true,
      reason:
        facts.yearsExperience && facts.yearsExperience > 0
          ? `Lead with numbers — ${facts.yearsExperience} years is a good first one.`
          : "Lead with a few numbers that tell your story.",
    },
    {
      type: "services",
      when: !!facts.availability,
      reason: "You're open to work — say what you offer.",
    },
    {
      type: "profile-bio",
      when: facts.hasBio,
      reason: "Your bio is written but not on the page.",
    },
    {
      type: "profile-links",
      when: facts.linkCount > 0,
      reason: `You have ${plural(facts.linkCount, "link")} to show.`,
    },
    {
      type: "quote",
      when: true,
      reason: "A testimonial says what you can't say about yourself.",
    },
    { type: "timeline", when: true, reason: "Show the path that got you here." },
    {
      type: "profile-tools",
      when: facts.toolCount > 0,
      reason: `Show the ${plural(facts.toolCount, "tool")} you work with.`,
    },
    { type: "faq", when: true, reason: "Answer what people ask before working with you." },
  ];
  return candidates
    .filter((c) => c.when && !used.has(c.type))
    .slice(0, limit)
    .map(({ type, reason }) => ({ type, reason }));
}
