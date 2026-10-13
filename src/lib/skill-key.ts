// Skills are written two ways: catalog names ("Tailwind CSS") on members, and
// slugs ("tailwind-css") on posts, roles and needs. Comparing lower-cased
// names against slugs never matched, so "My skills", "Recommended", Explore's
// "match" sort and "You could help" silently found nothing. Compare keys.

/** A comparison key: lower-case, non-alphanumerics collapsed to "-". */
export function skillKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every key a catalog skill can appear under (its name and its slug). */
export function skillKeyMap(
  skills: ReadonlyArray<{ name: string; slug?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of skills) {
    map.set(skillKey(skill.name), skill.name);
    if (skill.slug) map.set(skillKey(skill.slug), skill.name);
  }
  return map;
}
