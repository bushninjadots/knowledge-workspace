import { ProjectsCard } from "@/components/tethyr/profile-sections";
import type { ProjectRow } from "@/components/tethyr/profile-sections";
import type { Skill } from "./profile-layout";

export function ProfileProjectsTab({
  projects,
  coverUrls,
  userId,
  skills,
  projectSkillIds,
  onChange,
}: {
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  userId: string;
  skills: Skill[];
  projectSkillIds: Record<string, string[]>;
  onChange: () => void;
}) {
  return (
    <ProjectsCard
      projects={projects}
      coverUrls={coverUrls}
      userId={userId}
      allSkills={skills}
      projectSkillIds={projectSkillIds}
      onChange={onChange}
    />
  );
}
