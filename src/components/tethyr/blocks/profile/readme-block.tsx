// ── Profile README Block ─────────────────────────────────────────────────────
// The member's long-form home document — the profile analogue of the project
// README. Content lives on `profiles.readme` (markdown) so it follows the
// member across devices and renders on their public Studio.
//
// Reading: the shared ReadmeMarkdown renderer (react-markdown, fenced code
// blocks promoted to the copyable CodeBlock).
// Writing: the shared ReadmeEditorDialog (rich Tiptap editor, code-split so
// visitors never download it). Owners can also import their GitHub profile
// README (`<username>/<username>`) in one click.

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { ReadmeMarkdown } from "@/components/tethyr/blocks/readme-markdown";
import { ReadmeEditorDialog } from "@/components/tethyr/blocks/readme-editor-dialog";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ProfileReadmeData = {
  readme: string | null;
  social_links: Record<string, string> | null;
};

function ProfileReadmeBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, quickEdit, isOwner, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const canEdit = isOwner === true && (isEditing || quickEdit === true);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profile-readme", profileId],
    queryFn: async (): Promise<ProfileReadmeData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("readme, social_links")
        .eq("id", profileId)
        .maybeSingle();
      return (data as unknown as ProfileReadmeData | null) ?? null;
    },
    enabled: !!profileId,
  });

  const readme = data?.readme?.trim() ?? "";
  const showHeading = config.showHeading !== false;
  const hasReadme = !!readme;

  const [editing, setEditing] = useState(false);

  // Report emptiness so the public Studio collapses the band until it's written.
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasReadme);
  }, [blockId, hasReadme, isEditing, isLoading, onBlockEmptyChange]);

  const startEdit = useCallback(() => setEditing(true), []);

  const save = useCallback(
    async (content: string): Promise<boolean> => {
      if (!profileId) return false;
      const { error } = await supabase
        .from("profiles")
        .update({ readme: content.trim() || null })
        .eq("id", profileId);
      if (error) {
        toast.error(friendlyError(error));
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile-readme", profileId] });
      toast.success("README saved");
      return true;
    },
    [profileId, queryClient],
  );

  const editor = editing ? (
    <ReadmeEditorDialog
      open
      onOpenChange={setEditing}
      initialContent={data?.readme ?? ""}
      title="Profile README"
      description="Your home document — what you make, how you work, and how people can build with you."
      githubLink={data?.social_links?.github}
      importLabel="Import from GitHub"
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
          detail="the long-form story of what you make — what you're building, how you work, and how to collaborate"
          actionLabel="Write your README"
          onAction={startEdit}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {(showHeading || canEdit) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showHeading ? (
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              README
            </h4>
          ) : (
            <span />
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit README
            </Button>
          )}
        </div>
      )}
      <ReadmeMarkdown>{readme}</ReadmeMarkdown>
      {editor}
    </div>
  );
}

registerBlock({
  type: "profile-readme",
  category: "people",
  label: "README",
  description: "The long-form introduction to you. Markdown, with GitHub profile README import.",
  icon: "FileText",
  defaults: { showHeading: true },
  fields: [{ key: "showHeading", label: "Show README heading", type: "toggle" }],
  component: ProfileReadmeBlock,
});

export { ProfileReadmeBlock };
