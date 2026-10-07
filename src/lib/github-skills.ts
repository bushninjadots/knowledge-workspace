// Skills worth suggesting from someone's GitHub: the primary languages of
// their repositories, matched to Tethyr's skill catalog by name. A catalog
// name that combines several ("HTML & CSS", "Swift / iOS") matches each of
// its parts; languages GitHub names differently are mapped first.

const ALIASES: Record<string, string[]> = {
  "Jupyter Notebook": ["Python"],
  Vue: ["Vue.js", "Vue"],
  Shell: ["Bash", "Shell"],
  SCSS: ["CSS", "Sass"],
  Less: ["CSS"],
  "Objective-C": ["Swift", "iOS"],
  Dockerfile: ["Docker"],
  HCL: ["Terraform"],
  PLpgSQL: ["PostgreSQL", "SQL"],
  TSQL: ["SQL"],
};

const key = (name: string) => name.trim().toLowerCase();

/**
 * Catalog skills matching the given repository languages, most-used first,
 * each with how many repos use it. Skills in `exclude` are left out.
 */
export function skillsFromLanguages<S extends { id: string; name: string }>(
  languages: Array<string | null | undefined>,
  catalog: S[],
  exclude: ReadonlySet<string> = new Set(),
): Array<{ skill: S; repos: number }> {
  const byName = new Map<string, S>();
  for (const skill of catalog) {
    byName.set(key(skill.name), skill);
    // "HTML & CSS" answers to "HTML" and "CSS"; an exact name still wins.
    for (const part of skill.name.split(/\s*[/&]\s*/)) {
      if (part && !byName.has(key(part))) byName.set(key(part), skill);
    }
  }
  const counts = new Map<string, { skill: S; repos: number }>();
  for (const language of languages) {
    if (!language) continue;
    const names = ALIASES[language] ?? [language];
    const skill = names.map((name) => byName.get(key(name))).find(Boolean);
    if (!skill || exclude.has(skill.id)) continue;
    const entry = counts.get(skill.id) ?? { skill, repos: 0 };
    entry.repos += 1;
    counts.set(skill.id, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.repos - a.repos || a.skill.name.localeCompare(b.skill.name),
  );
}
