import type { Skill } from "@/hooks/use-current-user";

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