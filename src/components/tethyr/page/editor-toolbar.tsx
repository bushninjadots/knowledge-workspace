// ── Editor Toolbar ────────────────────────────────────────────────────────────
// The floating toolbar that appears at the top of a page when in edit mode.
// Shows the page status (draft/published), edit/done toggle, publish/save-draft,
// block picker, and template save/apply actions.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Edit3,
  Palette,
  Plus,
  Send,
  X,
  Bookmark,
  GalleryHorizontalEnd,
  Eye,
  Layers,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import {
  usePublishPage,
  useUnpublishPage,
  useUpdatePageLayout,
  useUpdatePageConfig,
} from "@/hooks/use-page-editor";
import { useSaveAsTemplate, useApplyTemplate, usePublicTemplates } from "@/hooks/use-templates";
import { ThemePicker } from "@/components/tethyr/page/theme-picker";
import { CompositionPicker } from "@/components/tethyr/studio/composition-picker";
import { PersonalityPicker } from "@/components/tethyr/studio/personality-picker";
import { AppearancePanel } from "@/components/tethyr/studio/appearance-panel";

import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type {
  PageData,
  LayoutSection,
  LayoutBlockInstance,
  PageOwnerType,
} from "@/lib/page-blocks";
import { createBlockInstance, getAllBlocks } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";

// ── Helpers ──────────────────────────────────────────────────────────────────

let _sectionCounter = 0;
function nextSectionId(): string {
  _sectionCounter++;
  return `sect_${Date.now()}_${_sectionCounter}`;
}

let _blockCounter = 0;
function nextBlockId(): string {
  _blockCounter++;
  return `blk_${Date.now()}_${_blockCounter}`;
}

function cloneSections(layout: { sections: LayoutSection[] }): LayoutSection[] {
  return layout.sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => ({ ...b, config: { ...b.config } })),
  }));
}

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  media: "Media",
  project: "Project",
  people: "People",
  community: "Community",
  utility: "Utility",
};

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  page: PageData | null;
  onRefresh: () => void;
  ownerId: string;
  ownerType: PageOwnerType;
}

export function EditorToolbar({ page, onRefresh, ownerId, ownerType }: EditorToolbarProps) {
  const { isEditing, startEditing, stopEditing } = useEditMode();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const updateLayout = useUpdatePageLayout();
  const updateConfig = useUpdatePageConfig();
  const saveAsTemplate = useSaveAsTemplate();
  const applyTemplate = useApplyTemplate();
  const { data: myTemplates = [] } = usePublicTemplates();

  const [showPicker, setShowPicker] = useState(false);
  const [showComposition, setShowComposition] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showTemplateName, setShowTemplateName] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showApplyPanel, setShowApplyPanel] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [lastAction, setLastAction] = useState<"saving" | "saved" | "error" | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);

  // Debounce refs for appearance config writes — coalesces rapid changes into one save.
  const pendingAppearanceRef = useRef<Partial<StudioConfig> | null>(null);
  const appearanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (appearanceTimerRef.current) clearTimeout(appearanceTimerRef.current);
    };
  }, []);

  function handleSaved(onSuccess?: () => void) {
    setLastAction("saved");
    onSuccess?.();
    onRefresh();
  }

  function saveLayout(layout: { sections: LayoutSection[] }, onSuccess?: () => void) {
    setLastAction("saving");
    updateLayout.mutate(
      { ownerId, ownerType, layoutId: page!.layoutId, layout },
      {
        onSuccess: () => {
          setLastAction("saved");
          onSuccess?.();
          onRefresh();
        },
        onError: () => setLastAction("error"),
      },
    );
  }

  const isPublished = page?.status === "published";

  // ── Add block ──────────────────────────────────────────────────────────
  function handleAddBlock(type: string) {
    if (!page) return;
    const inst = createBlockInstance(type);
    if (!inst) return;
    const newBlock: LayoutBlockInstance = {
      id: nextBlockId(),
      type: inst.type,
      position: 0,
      config: inst.config as Record<string, unknown>,
      visible: true,
    };
    const sections = cloneSections(page.layout ?? { sections: [] });
    let last = sections[sections.length - 1];
    if (!last) {
      last = { id: nextSectionId(), position: 0, layout: "full", blocks: [] };
      sections.push(last);
    }
    const reindexed = last.blocks.map((b, i) => ({ ...b, position: i + 1 }));
    newBlock.position = reindexed.length;
    sections[sections.length - 1] = { ...last, blocks: [...reindexed, newBlock] };
    saveLayout({ sections });
  }

  // ── Publish / Unpublish ────────────────────────────────────────────────
  async function handlePublish() {
    if (!page) return;
    try {
      await publishPage.mutateAsync({ pageId: page!.id, ownerId, ownerType });
      toast.success("Page published");
      stopEditing();
      onRefresh();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to publish"));
    }
  }
  async function handleUnpublish() {
    if (!page) return;
    try {
      await unpublishPage.mutateAsync({ pageId: page!.id, ownerId, ownerType });
      toast.success("Reverted to draft");
      onRefresh();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to unpublish"));
    }
  }

  // ── Save as template ───────────────────────────────────────────────────
  function handleSaveAsTemplate() {
    if (!page || !templateName.trim()) return;
    saveAsTemplate.mutate(
      { layoutId: page.layoutId, name: templateName.trim() },
      {
        onSuccess: () => {
          setShowTemplateName(false);
          setTemplateName("");
        },
      },
    );
  }

  // ── Apply template ─────────────────────────────────────────────────────
  function handleApply(templateId: string) {
    if (!page) return;
    applyTemplate.mutate(
      { templateId, pageId: page.id, layoutId: page.layoutId, ownerId, ownerType },
      {
        onSuccess: () => {
          setShowApplyPanel(false);
          onRefresh();
        },
      },
    );
  }

  // ── No page ──────────────────────────────────────────────────────────
  if (!page) return null;

  // ── Entry point (not editing) ──────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="mb-6 border-b border-border/30 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">Your Studio</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              Create a space that feels like yours
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Customize the story, arrange the work, and publish when it is ready to share.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {page.status === "draft" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Draft
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
              <Edit3 className="h-3.5 w-3.5" /> Customize
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Editing toolbar ────────────────────────────────────────────────
  return (
    <>
      <div className="mb-6 border-b border-border/30 pb-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Customize your Studio</p>
            <p className="text-xs text-muted-foreground">Build the content, arrange the layout, style the look, then preview or publish.</p>
          </div>
          <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {lastAction === "saving" ? "Saving changes…" : lastAction === "saved" ? "Changes saved" : lastAction === "error" ? "Save failed — try again" : "Changes save automatically"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="mr-2 flex items-center gap-2">
            <span className="text-[11px] font-medium text-foreground">Customizing</span>
            <span className="text-[10px] text-muted-foreground" role="status" aria-live="polite">
              {lastAction === "saving"
                ? "Saving…"
                : lastAction === "saved"
                  ? "Saved"
                  : lastAction === "error"
                    ? "Save failed"
                    : ""}
            </span>
            <span className="text-[11px] text-muted-foreground" aria-live="polite">
              {isPublished ? "Published" : "Draft"}
            </span>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              Select a block's Edit button to change its content, identity, and media.
            </span>
          </div>
          <span className="mr-1 rounded-full bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Build</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowPicker(!showPicker)}
          >
            <Plus className="h-3.5 w-3.5" /> Add content block
          </Button>
          <span className="ml-2 mr-1 rounded-full bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arrange</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowComposition(!showComposition)}
          >
            <Layers className="h-3.5 w-3.5" /> Choose composition
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowPersonality(!showPersonality)}
          >
            <Sparkles className="h-3.5 w-3.5" /> Choose vibe
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowAppearance(!showAppearance)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust appearance
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowThemePicker(!showThemePicker)}
          >
            <Palette className="h-3.5 w-3.5" /> Choose theme
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowApplyPanel(!showApplyPanel)}
          >
            <GalleryHorizontalEnd className="h-3.5 w-3.5" /> Use template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowTemplateName(true)}
          >
            <Bookmark className="h-3.5 w-3.5" /> Save as template
          </Button>
          <span className="ml-2 mr-1 rounded-full bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Review</span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={stopEditing}>
            <Eye className="h-3.5 w-3.5" /> Preview studio
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border/50 p-0.5" aria-label="Preview size">
            {(["desktop", "mobile"] as const).map((device) => (
              <button key={device} type="button" className={`rounded px-2 py-1 text-[10px] capitalize ${previewDevice === device ? "bg-surface font-medium text-foreground" : "text-muted-foreground"}`} onClick={() => setPreviewDevice(device)}>
                {device}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">Preview size: {previewDevice}</span>
          {isPublished ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={handleUnpublish}
            >
              <X className="h-3.5 w-3.5" /> Unpublish
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={handlePublish}
              disabled={publishPage.isPending}
            >
              <Send className="h-3.5 w-3.5" /> {publishPage.isPending ? "Publishing..." : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {showChecklist && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/20 pb-3 text-xs">
          <span className="font-medium text-foreground">Studio checklist</span>
          <span className="text-muted-foreground">Edit the header</span>
          <span className="text-muted-foreground">Add your work</span>
          <span className="text-muted-foreground">Arrange sections</span>
          <span className="text-muted-foreground">Preview, then publish</span>
          <button type="button" className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setShowChecklist(false)}>Hide</button>
        </div>
      )}

      {showPicker && (
        <BlockPickerPanel onAdd={handleAddBlock} onClose={() => setShowPicker(false)} />
      )}

      {showComposition && (
        <CompositionPicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowComposition(false)}
          onApplied={onRefresh}
        />
      )}

      {showPersonality && (
        <PersonalityPicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowPersonality(false)}
          onApplied={onRefresh}
        />
      )}

      {showAppearance && (
        <AppearancePanel
          config={page.config}
          onChange={(partial) => {
            setLastAction("saving");
            // Merge into pending partial and debounce the actual write so rapid
            // clicks (radius → typography → density) coalesce into one save.
            pendingAppearanceRef.current = {
              ...pendingAppearanceRef.current,
              ...partial,
            };
            if (appearanceTimerRef.current) clearTimeout(appearanceTimerRef.current);
            appearanceTimerRef.current = setTimeout(() => {
              const merged = pendingAppearanceRef.current;
              pendingAppearanceRef.current = null;
              updateConfig.mutate(
                {
                  pageId: page.id,
                  ownerId,
                  ownerType,
                  config: { ...page.config, ...merged },
                },
                {
                  onSuccess: () => handleSaved(),
                  onError: () => setLastAction("error"),
                },
              );
            }, 300);
          }}
          onClose={() => setShowAppearance(false)}
        />
      )}

      {/* Save as template dialog */}
      {showTemplateName && (
        <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={() => setShowTemplateName(false)}
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Save as template
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            This publishes your layout structure (not your content) so others can discover and fork
            it.
          </p>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Template name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSaveAsTemplate}
              disabled={!templateName.trim() || saveAsTemplate.isPending}
            >
              {saveAsTemplate.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Apply template panel */}
      {showApplyPanel && (
        <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={() => setShowApplyPanel(false)}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your templates
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Applying a template replaces your layout structure. Content in blocks stays with the
            page.
          </p>
          {myTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No templates yet. Customize your layout and save it as a template.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {" "}
              {myTemplates.map((t: { id: string; name: string; type: string }) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex items-center justify-between rounded-lg border border-transparent bg-surface/50 px-3 py-2 text-left text-xs transition-colors hover:border-card-border hover:bg-surface"
                  onClick={() => handleApply(t.id)}
                >
                  <span className="text-xs font-medium">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Theme picker */}
      {showThemePicker && (
        <ThemePicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowThemePicker(false)}
          onApplied={() => {
            setShowThemePicker(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// ── Block Picker Panel ───────────────────────────────────────────────────────

interface BlockPickerPanelProps {
  onAdd: (type: string) => void;
  onClose: () => void;
}

function BlockPickerPanel({ onAdd, onClose }: BlockPickerPanelProps) {
  const blocks: BlockDefinition[] = getAllBlocks();
  const categories = useMemo(() => {
    const map = new Map<string, BlockDefinition[]>();
    for (const b of blocks) {
      const list = map.get(b.category) ?? [];
      list.push(b);
      map.set(b.category, list);
    }
    return map;
  }, [blocks]);

  return (
    <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={onClose}
        aria-label="Close block picker"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Build your Studio
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Choose a content block, then arrange it into the story you want visitors to follow.
      </p>
      {[...categories.entries()].map(([category, items]) => (
        <div key={category} className="mb-3 last:mb-0">
          <h4 className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h4>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {items.map((block) => (
              <button
                key={block.type}
                type="button"
                className="flex items-center gap-2 rounded-lg border border-transparent bg-surface/50 px-3 py-2 text-left text-xs transition-colors hover:border-card-border hover:bg-surface"
                onClick={() => {
                  onAdd(block.type);
                  onClose();
                }}
              >
                <span className="text-[11px] font-medium">{block.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
