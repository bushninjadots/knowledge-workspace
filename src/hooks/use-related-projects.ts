import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RelatedProject = {
  id: string;
  title: string;
  description: string | null;
  profile_id: string;
  tags: string[];
  creator: { handle: string | null; display_name: string | null } | null;
  matchTags: string[];
  sharedSkills: number;
  coContributors: boolean;
};

type RelatedProjectsInput = {
  projectId: string;
  tags: string[];
  skillIds: string[];
  contributorIds: string[];
};

/**
 * On-the-fly related-project engine. Public projects are scored by how much
 * they overlap the current project in three dimensions:
 *   - shared tags (heaviest — same discipline  =  2×)
 *   - shared skills members list to use on the project
 *   - shared contributors (people who already know the project's work)
 * The current project and private projects are always excluded, and only the
 * top 6 score above zero. Runs a small JS pipeline over a bounded candidate
 * fetch — no new tables, computed per page view.
 */
export function useRelatedProjects({
  projectId,
  tags,
  skillIds,
  contributorIds,
}: RelatedProjectsInput) {
  const hasSignals = tags.length > 0 || skillIds.length > 0 || contributorIds.length > 0;

  return useQuery({
    queryKey: ["related-projects", projectId],
    queryFn: async (): Promise<RelatedProject[]> => {
      if (!hasSignals) return [];

      const { data: candidates, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, profile_id, tags, profiles!projects_profile_id_fkey(handle, display_name)",
        )
        .eq("visibility", "public")
        .neq("id", projectId)
        .limit(200);

      if (error) throw error;
      if (!candidates || candidates.length === 0) return [];

      const candidateIds = candidates.map((c) => c.id);

      const [skillRows, contributorRows] = await Promise.all([
        skillIds.length > 0
          ? supabase.from("project_skills").select("project_id").in("skill_id", skillIds)
          : Promise.resolve({ data: null as null, error: null }),
        supabase
          .from("project_contributors")
          .select("project_id, profile_id")
          .in("project_id", candidateIds),
      ]);

      const skillCounts = new Map<string, number>();
      for (const row of skillRows.data ?? []) {
        skillCounts.set(row.project_id, (skillCounts.get(row.project_id) ?? 0) + 1);
      }

      const coContributorSet = new Set(contributorIds);
      const hasCoContributor = new Set<string>();
      for (const row of contributorRows.data ?? []) {
        if (coContributorSet.has(row.profile_id)) hasCoContributor.add(row.project_id);
      }

      return candidates
        .map((c) => {
          const matchTags = tags.filter((t) => (c.tags ?? []).includes(t));
          const sharedSkills = skillCounts.get(c.id) ?? 0;
          const coContributors = hasCoContributor.has(c.id);
          const score = matchTags.length * 2 + sharedSkills + (coContributors ? 1 : 0);
          return { c, matchTags, sharedSkills, coContributors, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title))
        .slice(0, 6)
        .map(({ c, matchTags, sharedSkills, coContributors }) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          profile_id: c.profile_id,
          tags: c.tags ?? [],
          creator: c.profiles as RelatedProject["creator"],
          matchTags,
          sharedSkills,
          coContributors,
        }));
    },
    enabled: hasSignals,
  });
}
