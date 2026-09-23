import type { Skill, SkillActivityCounts } from "@/hooks/use-current-user";

export type SkillCategoryGroup = {
  category: string;
  skills: Skill[];
};

/**
 * Group a flat skill catalog by category, preserving first-appearance order
 * (the catalog query is already ordered by category then name) and skipping
 * empty categories. Backs the public skill directory page.
 */
export function groupSkillsByCategory(skills: readonly Skill[]): SkillCategoryGroup[] {
  const groups: SkillCategoryGroup[] = [];
  const byCategory = new Map<string, SkillCategoryGroup>();
  for (const skill of skills) {
    let group = byCategory.get(skill.category);
    if (!group) {
      group = { category: skill.category, skills: [] };
      byCategory.set(skill.category, group);
      groups.push(group);
    }
    group.skills.push(skill);
  }
  return groups;
}

/**
 * Combined real activity for a skill — sharing + growing + projects. Ranks the
 * "Trending now" rail on the directory without inventing numbers: a skill only
 * appears when at least one of these is non-zero.
 */
export function skillActivityTotal(stats: SkillActivityCounts | undefined): number {
  return (stats?.sharing ?? 0) + (stats?.growing ?? 0) + (stats?.projects ?? 0);
}
