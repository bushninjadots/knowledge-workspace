// ── Studio community templates ────────────────────────────────────────────────
// Application is client-side through `edit` — same non-destructive, one-undo
// path as the built-in starters. The fork is what persists a copy to the
// member's account; it never touches the live Studio by itself. Sharing submits
// this Studio's layout row for review. Extracted from creation-studio.tsx.

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { GStudioConfig } from "@/components/tethyr/studio/g-studio-surface";
import {
  fetchTemplateSections,
  useForkTemplate,
  usePublicTemplates,
  usePublishTemplate,
  type CommunityTemplate,
} from "@/hooks/use-templates";
import type { PageLayout } from "@/lib/page-blocks";
import { applyTemplateSections, sanitizeTemplateSections } from "@/lib/template-apply";

export function useStudioTemplates({
  layout,
  config,
  layoutId,
  dirty,
  edit,
  persistTheme,
  save,
  setShareTemplateOpen,
}: {
  layout: PageLayout | null;
  config: GStudioConfig | null;
  /** The page's layout row — what a shared template is made from. */
  layoutId: string | null | undefined;
  dirty: boolean;
  edit: (change: { layout?: PageLayout; config?: GStudioConfig; themeId?: string | null }) => void;
  persistTheme: (themeId: string | null) => void;
  save: (options?: { announce?: boolean }) => Promise<void>;
  setShareTemplateOpen: (open: boolean) => void;
}) {
  const forkTemplate = useForkTemplate();
  const publishTemplate = usePublishTemplate();
  const { data: communityTemplates } = usePublicTemplates();

  const applyTemplate = useCallback(
    (sections: ReturnType<typeof sanitizeTemplateSections>, themeId: string | null) => {
      if (!layout || !config) return;
      if (sections.length === 0) {
        toast.error("That template has no renderable sections.");
        return;
      }
      // One undo step for the sections and the theme together.
      edit({
        layout: applyTemplateSections(layout, sections),
        config: { ...config, starterId: null },
        ...(themeId ? { themeId } : {}),
      });
      if (themeId) persistTheme(themeId);
    },
    [config, edit, layout, persistTheme],
  );

  const applyCommunityTemplate = useCallback(
    (template: CommunityTemplate) => {
      void (async () => {
        try {
          const fetched = await fetchTemplateSections(template.id);
          applyTemplate(fetched.sections, fetched.themeId);
          toast.success(`“${template.name}” applied — one undo puts it back.`);
        } catch (err) {
          console.error("[applyTemplate]", err);
          toast.error("That template could not be applied.");
        }
      })();
    },
    [applyTemplate],
  );

  const saveCommunityTemplate = useCallback(
    (template: CommunityTemplate) => {
      forkTemplate.mutate(
        { templateId: template.id, templateName: template.name },
        {
          onSuccess: () => toast.success(`“${template.name}” saved to My templates.`),
          onError: () => toast.error("Could not save that template."),
        },
      );
    },
    [forkTemplate],
  );

  const useMyTemplateRow = useCallback(
    (template: CommunityTemplate) => {
      applyCommunityTemplate(template);
    },
    [applyCommunityTemplate],
  );

  const shareTemplate = useCallback(
    (name: string, description: string) => {
      if (!layoutId) {
        toast.error("Open your Studio once before submitting it as a template.");
        return;
      }
      const templateLayoutId = layoutId;
      // The template is this layout row, so save pending edits first.
      void (async () => {
        if (dirty) await save({ announce: false });
        publishTemplate.mutate(
          {
            layoutId: templateLayoutId,
            name,
            description: description || "A Studio direction shared with the community.",
          },
          {
            onSuccess: () => {
              setShareTemplateOpen(false);
              toast.success(
                "Template submitted for review. It appears in the community once approved.",
              );
            },
            onError: () => toast.error("Could not submit the template."),
          },
        );
      })();
    },
    [dirty, layoutId, publishTemplate, save, setShareTemplateOpen],
  );

  const savedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const template of communityTemplates ?? []) {
      if (template.isMine) ids.add(template.id);
    }
    return ids;
  }, [communityTemplates]);
  const savingTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    if (forkTemplate.isPending && forkTemplate.variables) {
      ids.add(forkTemplate.variables.templateId);
    }
    return ids;
  }, [forkTemplate.isPending, forkTemplate.variables]);

  return {
    applyCommunityTemplate,
    saveCommunityTemplate,
    useMyTemplateRow,
    shareTemplate,
    sharingTemplate: publishTemplate.isPending,
    savedTemplateIds,
    savingTemplateIds,
  };
}
