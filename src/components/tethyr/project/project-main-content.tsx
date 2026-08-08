import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Target } from "lucide-react";
import { toast } from "sonner";
import type {
  ProjectDetail,
  MilestoneRow,
  ProjectUpdateRow,
  DiscussionRow,
  OpenRoleRow,
  GalleryItem,
  ResourceItem,
} from "@/hooks/use-projects";
import { useUpdateProjectContent } from "@/hooks/use-projects";
import { safeHref } from "@/lib/validators";
import { PROJECT_LINK_KEYS } from "@/components/tethyr/profile-sections";
import { MilestonesTimeline } from "./project-milestones";
import { ProjectUpdatesJournal } from "./project-updates";
import { ProjectDiscussions } from "./project-discussions";
import { OpenRolesSection } from "./project-open-roles";
import { GallerySection, ResourcesSection } from "./project-resources";
import { ProjectCommunityPosts } from "./project-community-posts";
import { ProjectReposSection } from "./project-repos";
import { ProjectFilesSection, type ProjectFile } from "./project-files";

type SkillLite = { id: string; slug: string; name: string; category: string };
type LinkEntry = [string, string];

export type Contributor = {
  profile_id: string;
  role: "creator" | "contributor" | "mentor";
  contribution_score: number;
  skills_used: string[];
  profile: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
  } | null;
};

export type ProjectSection = { id: string; label: string };

const ROLE_LABEL: Record<Contributor["role"], string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

interface ProjectMainContentProps {
  project: ProjectDetail;
  contributors: Contributor[];
  skills: SkillLite[];
  links: LinkEntry[];
  milestones: MilestoneRow[];
  updates: ProjectUpdateRow[];
  discussions: DiscussionRow[];
  openRoles: OpenRoleRow[];
  avatarSigned: Record<string, string>;
  projectFiles?: ProjectFile[];
  isOwner: boolean;
  isContributor: boolean;
  sections: ProjectSection[];
}

export function ProjectMainContent({
  project,
  contributors,
  skills,
  links,
  milestones,
  updates,
  discussions,
  openRoles,
  avatarSigned,
  projectFiles,
  isOwner,
  isContributor,
  sections,
}: ProjectMainContentProps) {
  const updateContent = useUpdateProjectContent();

  const saveContent = async (patch: { gallery?: GalleryItem[]; resources?: ResourceItem[] }) => {
    try {
      await updateContent.mutateAsync({ projectId: project.id, ...patch });
    } catch (err) {
      toast.error("Couldn't save — try again");
      // Rethrow so callers skip their success path (e.g. "Resource added").
      throw err;
    }
  };

  return (
    <div className="min-w-0 space-y-10">
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} tabIndex={-1} className="scroll-mt-24 outline-none">
          <SectionHeading index={i + 1} label={s.label} />
          {renderSection(s.id)}
        </section>
      ))}
    </div>
  );

  function renderSection(id: string) {
    switch (id) {
      case "vision":
        return (
          <div className="border-l-2 border-primary pl-5">
            <div className="prose-custom text-sm leading-relaxed text-foreground/90">
              <Markdown remarkPlugins={[remarkGfm]}>{project.vision ?? ""}</Markdown>
            </div>
          </div>
        );
      case "about":
        return (
          <div className="prose-custom text-sm leading-relaxed text-foreground/90">
            <Markdown remarkPlugins={[remarkGfm]}>{project.description ?? ""}</Markdown>
          </div>
        );
      case "goals":
        return (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground/90">{project.goal}</p>
          </div>
        );
      case "skills":
        return (
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <Link
                key={s.id}
                to="/skills/$slug"
                params={{ slug: s.slug }}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:opacity-80"
              >
                {s.name}
              </Link>
            ))}
            {project.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {links.length > 0 && (
              <div className="mt-4 flex w-full flex-wrap gap-2 border-t border-border/40 pt-4">
                {links.map(([key, url]) => {
                  const meta = PROJECT_LINK_KEYS.find((l) => l.key === key);
                  const Icon = meta?.icon;
                  return (
                    <a
                      key={key}
                      href={safeHref(url)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {meta?.label ?? key}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "roles":
        return <OpenRolesSection roles={openRoles} projectId={project.id} isOwner={isOwner} />;
      case "milestones":
        return (
          <MilestonesTimeline milestones={milestones} projectId={project.id} isOwner={isOwner} />
        );
      case "journal":
        return (
          <ProjectUpdatesJournal
            updates={updates}
            projectId={project.id}
            isContributor={isContributor}
          />
        );
      case "discussion":
        return (
          <ProjectDiscussions
            discussions={discussions}
            projectId={project.id}
            isContributor={isContributor}
            isOwner={isOwner}
          />
        );
      case "contributors":
        return (
          <div className="space-y-3">
            {contributors.map((c) => (
              <div key={c.profile_id} className="rounded-xl bg-background/40 p-3">
                <Link
                  to="/u/$handle"
                  params={{ handle: c.profile?.handle ?? "" }}
                  className="flex items-center gap-3 transition hover:opacity-80"
                >
                  <Avatar
                    name={c.profile?.display_name ?? c.profile?.handle}
                    src={avatarSigned[c.profile_id]}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.profile?.display_name || c.profile?.handle || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role]}</p>
                  </div>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.contribution_score > 0 && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                      Score: {c.contribution_score}
                    </span>
                  )}
                  {c.skills_used.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      case "gallery":
        return (
          <GallerySection
            gallery={(project.gallery ?? []) as GalleryItem[]}
            onUpdate={async (items) => saveContent({ gallery: items })}
            isOwner={isOwner}
            projectId={project.id}
          />
        );
      case "resources":
        return (
          <ResourcesSection
            resources={(project.resources ?? []) as ResourceItem[]}
            onUpdate={async (items) => saveContent({ resources: items })}
            isOwner={isOwner}
          />
        );
      case "files":
        return (
          <ProjectFilesSection
            projectId={project.id}
            isOwner={isOwner}
            existingFiles={projectFiles ?? []}
            onFilesChanged={() => {}}
          />
        );
      case "repos":
        return <ProjectReposSection projectId={project.id} isOwner={isOwner} />;
      case "community":
        return <ProjectCommunityPosts projectId={project.id} />;
      default:
        return null;
    }
  }
}

function SectionHeading({ index, label }: { index: number; label: string }) {
  return (
    <p className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
      <span className="text-[var(--user-accent,var(--primary))]">
        {String(index).padStart(2, "0")}
      </span>
      <span>{label}</span>
      <span className="h-px flex-1 bg-border/60" />
    </p>
  );
}

function Avatar({ name, src }: { name?: string | null; src?: string }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
          {initial}
        </div>
      )}
    </div>
  );
}
