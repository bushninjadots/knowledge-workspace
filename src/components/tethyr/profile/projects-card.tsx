import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Rocket,
  Trophy,
  Target,
  MessageCircle,
  UserPlus,
  ImageIcon,
  Pencil,
  MoreHorizontal,
  Copy,
  FileText,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "./section-card";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
} from "./types";
import type { ProjectRow, ProjectSkill } from "./types";
import { ProjectDialog } from "./project-dialog";
import { ProjectLibraryAddDialog } from "./project-library-add-dialog";

export function ProjectsCard({
  projects,
  coverUrls,
  userId,
  allSkills,
  projectSkillIds,
  onChange,
}: {
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  userId: string;
  allSkills: ProjectSkill[];
  projectSkillIds: Record<string, string[]>;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<ProjectRow | null>(null);
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isOwn = me?.userId === userId;

  async function duplicateProject(project: ProjectRow) {
    const { data: copy, error } = await supabase
      .from("projects")
      .insert({
        profile_id: userId,
        title: `${project.title} copy`,
        description: project.description,
        goal: project.goal,
        vision: project.vision,
        status: "planning",
        visibility: project.visibility,
        progress_percent: 0,
        cover_url: null,
        gallery: [],
        resources: project.resources,
        links: project.links,
        tags: project.tags,
        looking_for_feedback: project.looking_for_feedback,
        looking_for_collaborators: project.looking_for_collaborators,
        is_featured: false,
        presentation_preset: project.presentation_preset ?? "story-first",
      })
      .select("id")
      .single();
    if (error || !copy) {
      toast.error(friendlyError(error, "Couldn't duplicate project"));
      return;
    }
    const skillIds = projectSkillIds[project.id] ?? [];
    if (skillIds.length > 0) {
      await supabase
        .from("project_skills")
        .insert(skillIds.map((skill_id) => ({ project_id: copy.id, skill_id })));
    }
    toast.success("Project structure duplicated");
    onChange();
    navigate({ to: "/projects/$id", params: { id: copy.id } });
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          Projects
        </span>
      }
      action={
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          New
        </Button>
      }
    >
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-4">
          <p className="text-sm font-medium">Give your next idea a place to grow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with a goal, then add a demonstration when there is something real to show.
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Start a project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="content-safe card-border group relative min-w-0 max-w-full overflow-hidden rounded-xl border bg-background/40 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
            >
              <Link to="/projects/$id" params={{ id: p.id }} className="block text-left">
                <div className="aspect-video overflow-hidden bg-background">
                  {p.cover_url && coverUrls[p.cover_url] ? (
                    <img
                      src={coverUrls[p.cover_url]}
                      alt=""
                      width="640"
                      height="360"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display font-semibold" title={p.title}>
                      {p.title}
                    </h3>
                    {p.is_featured && <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                  {p.goal && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <Target className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-1" title={p.goal}>
                        {p.goal}
                      </span>
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Progress
                      value={p.progress_percent}
                      className="h-1.5"
                      aria-label={`Progress: ${p.progress_percent}%`}
                    />
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {p.progress_percent}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${PROJECT_STATUS_STYLE[p.status]}`}
                    >
                      {PROJECT_STATUS_LABEL[p.status]}
                    </span>
                    {p.looking_for_feedback && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        <MessageCircle className="mr-1 inline h-3 w-3" />
                        Feedback
                      </span>
                    )}
                    {p.looking_for_collaborators && (
                      <span className="rounded-full border border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 px-2 py-0.5 text-[11px] text-[var(--brand-purple)]">
                        <UserPlus className="mr-1 inline h-3 w-3" />
                        Collab
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Project options"
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setEditing(p)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void duplicateProject(p)}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Duplicate structure
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLibraryTarget(p)}>
                      <FileText className="mr-2 h-3.5 w-3.5" />
                      Add note / file
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({
                          to: "/projects/$id",
                          params: { id: p.id },
                          search: { focus: "demonstrations" },
                        })
                      }
                    >
                      <ImageIcon className="mr-2 h-3.5 w-3.5" />
                      Add demonstration
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({ to: "/community", search: { attach_project: p.id } })
                      }
                    >
                      <Megaphone className="mr-2 h-3.5 w-3.5" />
                      Post to Community
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProjectDialog
          project={editing}
          userId={userId}
          allSkills={allSkills}
          initialSkillIds={editing ? (projectSkillIds[editing.id] ?? []) : []}
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={onChange}
        />
      )}

      {libraryTarget && (
        <ProjectLibraryAddDialog
          project={libraryTarget}
          open={!!libraryTarget}
          onOpenChange={(o) => !o && setLibraryTarget(null)}
          onSaved={onChange}
        />
      )}
    </SectionCard>
  );
}
