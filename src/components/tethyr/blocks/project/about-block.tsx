// ── Project About Block ──────────────────────────────────────────────────────
// Dual-context block:
//  - Project pages: renders the project README / description / vision.
//  - Profile pages (the Studio): becomes the owner's personal About/README,
//    editable in a dialog and importable / syncable from GitHub, sharing
//    `profiles.readme` (and its cache) with the profile README block.
//
// Reading: the shared ReadmeMarkdown renderer (react-markdown, fenced code
// blocks promoted to the copyable CodeBlock).
// Writing: the shared ReadmeEditorDialog (rich Tiptap editor, code-split so
// visitors never download it).
// Project-mode rendering keeps the shared safe block renderer (escapes quotes
// and rejects javascript: URLs).

import { useCallback, useEffect, useState } from "react";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { ReadmeMarkdown } from "@/components/tethyr/blocks/readme-markdown";
import { ReadmeEditorDialog } from "@/components/tethyr/blocks/readme-editor-dialog";
import {
  ProfileReadmeGitHub,
  readmeSourceCaption,
} from "@/components/tethyr/github/profile-readme-github";
import { useProfileReadme, useSaveProfileReadme } from "@/hooks/use-profile-readme";
import { registerBlock } from "@/lib/block-registry";
import { blockMarkdownToHtml } from "@/lib/block-markdown";
import type { BlockProps } from "@/lib/page-blocks";

type ProjectAboutData = {
  description: string | null;
  vision: string | null;
  readme: string | null;
};

function ProjectAboutBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, quickEdit, isOwner, onBlockEmptyChange } = context;
  const isProject = context.ownerType === "project";
  const ownerId = context.ownerId;

  const projectQuery = useQuery({
    queryKey: ["project-about", ownerId],
    queryFn: async (): Promise<ProjectAboutData | null> => {
      const { data } = await supabasePending
        .from("projects")
        .select("description, vision, readme")
        .eq("id", ownerId)
        .maybeSingle();
      return (data as unknown as ProjectAboutData | null) ?? null;
    },
    enabled: isProject,
  });

  const profileQuery = useProfileReadme(isProject ? null : ownerId);
  const saveReadme = useSaveProfileReadme(isProject ? null : ownerId);

  const profileData = profileQuery.data;
  const readme = profileData?.readme?.trim() ?? "";
  const hasReadme = !!readme;
  const canEdit = isOwner === true && (isEditing || quickEdit === true);

  const [editing, setEditing] = useState(false);

  // Report emptiness so the public Studio collapses the band until it's written.
  useEffect(() => {
    if (isProject || profileQuery.isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasReadme);
  }, [blockId, hasReadme, isEditing, isProject, onBlockEmptyChange, profileQuery.isLoading]);

  const startEdit = useCallback(() => setEditing(true), []);

  const save = useCallback(
    (content: string, source?: string) =>
      saveReadme(content, { ...(source ? { source } : {}), message: "About saved" }),
    [saveReadme],
  );

  const editor = editing ? (
    <ReadmeEditorDialog
      open
      onOpenChange={setEditing}
      initialContent={profileData?.readme ?? ""}
      title="About / README"
      description="Your long-form story for this space — what you make, how you work, and how people can build with you."
      githubLink={profileData?.social_links?.github}
      source={profileData?.readme_source}
      saveLabel="Save"
      onSave={save}
    />
  ) : null;

  if (isProject) {
    const projectData = projectQuery.data;
    if (projectQuery.isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
    if (!projectData) return null;

    const showReadme = config.showReadme !== false;
    const showVision = config.showVision !== false;
    const parts: string[] = [];
    if (showReadme && projectData.readme) parts.push(projectData.readme);
    if (showVision && projectData.vision) parts.push(projectData.vision);
    if (projectData.description) parts.push(projectData.description);
    const content = parts.join("\n\n");
    if (!content) return null;

    const html = blockMarkdownToHtml(content);

    return (
      <div className="prose-custom">
        <div
          className="text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  if (profileQuery.isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!profileData) return null;

  if (!hasReadme) {
    if (!isEditing) return null;
    return (
      <>
        <BlockEmptyState
          label="About / README"
          detail="the long-form story of what you make — what you're building, how you work, and how to collaborate"
          actionLabel="Write your About"
          onAction={startEdit}
          alternative={<ProfileReadmeGitHub profileId={ownerId} data={profileData} />}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {readmeSourceCaption(profileData) && (
            <span className="mr-auto text-2xs text-muted-foreground">
              {readmeSourceCaption(profileData)}
            </span>
          )}
          <ProfileReadmeGitHub profileId={ownerId} data={profileData} />
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit About
          </Button>
        </div>
      )}
      <ReadmeMarkdown>{readme}</ReadmeMarkdown>
      {editor}
    </div>
  );
}

registerBlock({
  type: "project-about",
  category: "project",
  label: "About / README",
  description:
    "Your long-form About on studio pages — markdown, written here or imported and synced from GitHub. On project pages it shows the project README.",
  icon: "FileText",
  defaults: { showReadme: true, showVision: true },
  fields: [
    { key: "showReadme", label: "Show README", type: "toggle" },
    { key: "showVision", label: "Show vision", type: "toggle" },
  ],
  ownerContext: "both",
  component: ProjectAboutBlock,
});

export { ProjectAboutBlock };
