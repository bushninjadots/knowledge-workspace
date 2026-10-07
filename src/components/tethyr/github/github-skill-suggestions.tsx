// "From your GitHub" in the skills picker: the languages of a connected
// member's repositories, as catalog skills they can add with one tap.
// Nothing shows when GitHub isn't connected or nothing matches.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, Plus } from "lucide-react";
import { useGithubConnection } from "@/hooks/use-github";
import { listGithubRepos } from "@/lib/github-server";
import { skillsFromLanguages } from "@/lib/github-skills";

export function GitHubSkillSuggestions<S extends { id: string; name: string }>({
  catalog,
  chosen,
  onAdd,
}: {
  catalog: S[];
  chosen: ReadonlySet<string>;
  onAdd: (ids: string[]) => void;
}) {
  const { connected } = useGithubConnection();
  const { data: repos = [] } = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: connected,
    staleTime: 5 * 60_000,
  });
  const suggestions = useMemo(
    () =>
      skillsFromLanguages(
        repos.map((repo) => repo.language),
        catalog,
        chosen,
      ).slice(0, 8),
    [repos, catalog, chosen],
  );
  if (!connected || suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Github className="h-3.5 w-3.5" aria-hidden />
          From your GitHub
        </p>
        {suggestions.length > 1 && (
          <button
            type="button"
            onClick={() => onAdd(suggestions.map((s) => s.skill.id))}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Add all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map(({ skill, repos: count }) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onAdd([skill.id])}
            title={`Used in ${count} of your repositories`}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden />
            {skill.name}
            <span className="tabular-nums text-muted-foreground/80">· {count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
