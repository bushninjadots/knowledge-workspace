import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ProjectsCard, ProjectDialog } from "@/components/tethyr/profile-sections";
import type { ProjectRow } from "@/components/tethyr/profile-sections";
import type { Skill } from "./profile-layout";

export function ProfileProjectsTab({
  projects,
  coverUrls,
  userId,
  skills,
  projectSkillIds,
  onChange,
  isOwnProfile,
}: {
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  userId: string;
  skills: Skill[];
  projectSkillIds: Record<string, string[]>;
  onChange: () => void;
  isOwnProfile: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="rounded-2xl border card-border bg-surface p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Projects</h3>
          <span className="text-xs text-muted-foreground">{projects.length} projects</span>
        </div>
        {isOwnProfile && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            New
          </Button>
        )}
      </div>
      {projects.length === 0 ? (
        <div className="py-8 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          {isOwnProfile && (
            <p className="mt-1 text-xs text-muted-foreground">
              Start creating to showcase your work.
            </p>
          )}
        </div>
      ) : (
        <ProjectsCard
          projects={projects}
          coverUrls={coverUrls}
          userId={userId}
          allSkills={skills}
          projectSkillIds={projectSkillIds}
          onChange={onChange}
        />
      )}
      {isOwnProfile && (
        <ProjectDialog
          project={null}
          userId={userId}
          allSkills={skills}
          initialSkillIds={[]}
          open={creating}
          onOpenChange={setCreating}
          onSaved={onChange}
        />
      )}
    </div>
  );
}
