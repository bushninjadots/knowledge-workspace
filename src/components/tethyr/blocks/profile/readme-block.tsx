// ── Profile README Block ─────────────────────────────────────────────────────
// The member's long-form home document — the profile analogue of the project
// README. Content lives on `profiles.readme` (markdown) so it follows the
// member across devices and renders on their public Studio.
//
// Reading: the shared ReadmeMarkdown renderer (react-markdown, fenced code
// blocks promoted to the copyable CodeBlock).
// Writing: the shared ReadmeEditorDialog (rich Tiptap editor, code-split so
// visitors never download it). Owners can import it from GitHub — their
// profile README (`<you>/<you>`) or any repo — and sync it again later
// (ProfileReadmeGitHub; the source is kept in `profiles.readme_source`).

import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { useCallback, useEffect, useState } from "react";
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
import type { BlockProps } from "@/lib/page-blocks";

function ProfileReadmeBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, quickEdit, isOwner, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const canEdit = isOwner === true && (isEditing || quickEdit === true);
  const { data, isLoading } = useProfileReadme(profileId);
  const saveReadme = useSaveProfileReadme(profileId);

  const readme = data?.readme?.trim() ?? "";
  const showHeading = config.showHeading !== false;
  const hasReadme = !!readme;

  const [editing, setEditing] = useState(false);

  // Report emptiness so the public Studio collapses the band until it's written.
  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasReadme);
  }, [blockId, hasReadme, isEditing, isLoading, onBlockEmptyChange]);

  const startEdit = useCallback(() => setEditing(true), []);
  const save = useCallback(
    (content: string, source?: string) => saveReadme(content, source ? { source } : {}),
    [saveReadme],
  );

  const editor = editing ? (
    <ReadmeEditorDialog
      open
      onOpenChange={setEditing}
      initialContent={data?.readme ?? ""}
      title="Profile README"
      description="Your home document — what you make, how you work, and how people can build with you."
      githubLink={data?.social_links?.github}
      source={data?.readme_source}
      saveLabel="Save README"
      onSave={save}
    />
  ) : null;

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data) return null;

  if (!hasReadme) {
    // Empty states belong to the full block editor (same as bio/skills) so the
    // public Studio and quick-edit view collapse the section instead of
    // leaving a prompt where the reader expects content.
    if (!isEditing) return null;
    return (
      <>
        <BlockEmptyState
          label="README"
          detail="the long-form story of what you make — write it here, or bring in the README you already keep on GitHub"
          actionLabel="Write your README"
          onAction={startEdit}
          alternative={<ProfileReadmeGitHub profileId={profileId} data={data} />}
        />
        {editor}
      </>
    );
  }

  const caption = canEdit ? readmeSourceCaption(data) : null;
  return (
    <div className="space-y-3">
      <BlockTitle
        // The older "Show heading" toggle still hides it for existing Studios.
        config={showHeading ? config : { ...config, hideTitle: true }}
        action={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <ProfileReadmeGitHub profileId={profileId} data={data} />
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Edit README
              </Button>
            </div>
          ) : undefined
        }
      >
        README
      </BlockTitle>
      {caption && <p className="text-2xs text-muted-foreground">{caption}</p>}
      <ReadmeMarkdown>{readme}</ReadmeMarkdown>
      {editor}
    </div>
  );
}

registerBlock({
  type: "profile-readme",
  category: "identity",
  label: "README",
  title: "README",
  description:
    "The long-form introduction to you. Markdown — write it here or import and sync it from GitHub.",
  icon: "FileText",
  defaults: { showHeading: true },
  fields: [{ key: "showHeading", label: "Show README heading", type: "toggle" }],
  component: ProfileReadmeBlock,
});

export { ProfileReadmeBlock };
