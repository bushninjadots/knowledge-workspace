// ── Editor Toolbar ────────────────────────────────────────────────────────────
// The Studio editor chrome and entry point. The editor groups existing page
// mutations into task-oriented tabs while the canvas stays responsible for
// contextual block and section editing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Redo2,
  Undo2,
  Edit3,
  Eye,
  EyeOff,
  GalleryHorizontalEnd,
  Layers,
  Monitor,
  Palette,
  Plus,
  Send,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import { EditorChromeBoundary } from "@/components/tethyr/page/editor-chrome-boundary";
import {
  usePublishPage,
  useUnpublishPage,
  useUpdatePageLayout,
  useUpdatePageConfig,
} from "@/hooks/use-page-editor";
import {
  useSaveAsTemplate,
  useApplyTemplate,
  usePublicTemplates,
  useUnpublishTemplate,
} from "@/hooks/use-templates";
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
import type { StudioSnapshot } from "@/lib/studio-history";

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
  content: "Tell your story",
  media: "Show your process",
  project: "Your work",
  people: "People and identity",
  community: "Community",
  utility: "Helpful details",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  content: "Explain what you make and what you want to build next.",
  media: "Bring the references, images, and moments behind the work.",
  project: "Give visitors more context about a project or collaboration.",
  people: "Introduce yourself and the people you build with.",
  community: "Show the conversations and communities around your work.",
  utility: "Add supporting information without crowding the Studio.",
};

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  page: PageData | null;
  onRefresh: () => void;
  ownerId: string;
  ownerType: PageOwnerType;
}

export function EditorToolbar({ page, onRefresh, ownerId, ownerType }: EditorToolbarProps) {
  const {
    isEditing,
    isPreviewing,
    previewDevice,
    startEditing,
    stopEditing,
    startPreview,
    stopPreview,
    setPreviewDevice,
    recordSnapshot,
    undo,
    redo,
    restoreSnapshot,
    canUndo,
    canRedo,
  } = useEditMode();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const updateLayout = useUpdatePageLayout();
  const updateConfig = useUpdatePageConfig();
  const saveAsTemplate = useSaveAsTemplate();
  const applyTemplate = useApplyTemplate();
  const unpublishTemplate = useUnpublishTemplate();
  const { data: myTemplates = [] } = usePublicTemplates();
  const blockDefinitions = useMemo(() => getAllBlocks(), []);

  // One panel at a time. A single `activePanel` value replaces the previous
  // tabs-plus-buttons double hop: each tool chip toggles its own panel.
  type StudioPanelId =
    | "content"
    | "layout"
    | "vibe"
    | "appearance"
    | "theme"
    | "templates"
    | "saveTemplate";
  const [activePanel, setActivePanel] = useState<StudioPanelId | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [showOutline, setShowOutline] = useState(true);
  // Template awaiting destructive-apply confirmation. Templates replace the
  // current sections + blocks, so we confirm before calling useApplyTemplate.
  const [confirmingTemplate, setConfirmingTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [lastAction, setLastAction] = useState<"saving" | "saved" | "error" | null>(null);

  const showPicker = activePanel === "content";
  const showComposition = activePanel === "layout";
  const showPersonality = activePanel === "vibe";
  const showAppearance = activePanel === "appearance";
  const showApplyPanel = activePanel === "templates";
  const showThemePicker = activePanel === "theme";
  const showTemplateName = activePanel === "saveTemplate";

  function togglePanel(panel: StudioPanelId) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function closePanels() {
    setActivePanel(null);
  }


  // Debounce refs for appearance config writes — coalesces rapid changes into one save.
  const pendingAppearanceRef = useRef<Partial<StudioConfig> | null>(null);
  const appearanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (appearanceTimerRef.current) clearTimeout(appearanceTimerRef.current);
    };
  }, []);

  const currentSnapshot = useCallback(
    (): StudioSnapshot | null =>
      page
        ? {
            layout: page.layout,
            config: page.config,
            themeId: page.themeId,
            theme: page.theme,
          }
        : null,
    [page],
  );

  const handleUndo = useCallback(() => {
    const current = currentSnapshot();
    if (!current) return;
    const snapshot = undo(current);
    if (snapshot) restoreSnapshot(snapshot);
  }, [currentSnapshot, undo, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const current = currentSnapshot();
    if (!current) return;
    const snapshot = redo(current);
    if (snapshot) restoreSnapshot(snapshot);
  }, [currentSnapshot, redo, restoreSnapshot]);

  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTextEntry || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      event.preventDefault();
      if (event.shiftKey) handleRedo();
      else handleUndo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, handleRedo, handleUndo]);

  function handleSaved(onSuccess?: () => void) {
    setLastAction("saved");
    onSuccess?.();
    onRefresh();
  }

  function saveLayout(layout: { sections: LayoutSection[] }, onSuccess?: () => void) {
    if (!page) return;
    recordSnapshot({
      layout: page.layout,
      config: page.config,
      themeId: page.themeId,
      theme: page.theme,
    });
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

  function handleToggleBlockVisibility(blockId: string) {
    if (!page) return;
    const sections = cloneSections(page.layout ?? { sections: [] });
    const block = sections.flatMap((section) => section.blocks).find((item) => item.id === blockId);
    if (!block) return;
    block.visible = block.visible === false;
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
  function handleApply(templateId: string, name: string) {
    // Ask first — applying a template replaces the current sections and blocks.
    setConfirmingTemplate({ id: templateId, name });
  }

  function confirmApplyTemplate() {
    if (!page || !confirmingTemplate) return;
    recordSnapshot({
      layout: page.layout,
      config: page.config,
      themeId: page.themeId,
      theme: page.theme,
    });
    applyTemplate.mutate(
      {
        templateId: confirmingTemplate.id,
        pageId: page.id,
        layoutId: page.layoutId,
        ownerId,
        ownerType,
      },
      {
        onSuccess: () => {
          setConfirmingTemplate(null);
          setShowApplyPanel(false);
          onRefresh();
        },
      },
    );
  }

  // ── No page ──────────────────────────────────────────────────────────
  if (!page) return null;

  // ── Preview mode ───────────────────────────────────────────────────
  if (isPreviewing) {
    return (
      <EditorChromeBoundary className="mx-auto w-full max-w-5xl">
        <PreviewToolbar
          device={previewDevice}
          onDeviceChange={setPreviewDevice}
          onBackToEditor={stopPreview}
        />
      </EditorChromeBoundary>
    );
  }

  // ── Entry point (not editing) ──────────────────────────────────────
  if (!isEditing) {
    return (
      <EditorChromeBoundary className="mx-auto mb-5 w-full max-w-5xl border-b border-border/40 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--user-accent,var(--trust))]"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">Studio controls</span>
            {page.status === "draft" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={startEditing}
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Studio
          </Button>
        </div>
      </EditorChromeBoundary>
    );
  }

  // ── Editing toolbar ────────────────────────────────────────────────
  return (
    <EditorChromeBoundary className="mx-auto w-full max-w-5xl">
      <div className="mb-5 border-b border-border/50 bg-background px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={stopEditing}
              aria-label="Exit Studio editor"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Your Studio</span>
              <span className="sm:hidden">Exit</span>
            </Button>
            <span className="h-4 w-px bg-border/60" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Studio editor</p>
              <p className="text-[11px] text-muted-foreground">
                {isPublished ? "Published" : "Draft"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1" aria-label="Edit history">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo last change"
                title="Undo (Ctrl/Cmd+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo last change"
                title="Redo (Ctrl/Cmd+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {lastAction === "saving"
                ? "Saving…"
                : lastAction === "saved"
                  ? "Saved"
                  : lastAction === "error"
                    ? "Save failed"
                    : "Auto-save on"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => startPreview("desktop")}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            {isPublished ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleUnpublish}
              >
                <X className="h-3.5 w-3.5" /> Unpublish
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handlePublish}
                disabled={publishPage.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                {publishPage.isPending ? "Publishing…" : "Publish Studio"}
              </Button>
            )}
          </div>
        </div>

        {/* One flat row of tools. Each chip toggles its own panel, so every
            control is one click away instead of tab → button. */}
        <div
          className="mt-3 -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5"
          role="group"
          aria-label="Studio tools"
        >
          {(
            [
              ["content", "Add", Plus, "Add a block to your Studio"],
              ["layout", "Layout", Layers, "Change the whole-page arrangement"],
              ["vibe", "Vibe", Sparkles, "Apply a visual tone preset"],
              ["appearance", "Appearance", SlidersHorizontal, "Radius, type, density, accent"],
              ["theme", "Theme", Palette, "Pick a color theme"],
              ["templates", "Templates", GalleryHorizontalEnd, "Use or save a layout template"],
            ] as const
          ).map(([id, label, Icon, hint]) => {
            const active = activePanel === id || (id === "templates" && showTemplateName);
            return (
              <button
                key={id}
                type="button"
                onClick={() => togglePanel(id)}
                aria-pressed={active}
                title={hint}
                className={[
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-surface font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
          <span className="ml-auto hidden shrink-0 pl-2 sm:inline" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            aria-expanded={showOutline}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {showOutline ? "Hide contents" : "Contents"}
          </button>
        </div>

        {showOutline && (
          <ContentOutline
            page={page}
            blockDefinitions={blockDefinitions}
            onToggleVisibility={handleToggleBlockVisibility}
          />
        )}
      </div>


      {showPicker && (
        <BlockPickerPanel onAdd={handleAddBlock} onClose={() => setShowPicker(false)} />
      )}

      {showComposition && (
        <CompositionPicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowComposition(false)}
          onBeforeApply={() => {
            const snapshot = currentSnapshot();
            if (snapshot) recordSnapshot(snapshot);
          }}
          onApplied={onRefresh}
        />
      )}

      {showPersonality && (
        <PersonalityPicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowPersonality(false)}
          onBeforeApply={() => {
            const snapshot = currentSnapshot();
            if (snapshot) recordSnapshot(snapshot);
          }}
          onApplied={onRefresh}
        />
      )}

      {showAppearance && (
        <AppearancePanel
          config={page.config}
          onChange={(partial) => {
            recordSnapshot({
              layout: page.layout,
              config: page.config,
              themeId: page.themeId,
              theme: page.theme,
            });
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
        <div className="studio-tool-panel relative mb-5 px-4 py-4 sm:px-5">
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
        <div className="studio-tool-panel relative mb-5 px-4 py-4 sm:px-5">
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
            Applying a template replaces your current sections and blocks. You can undo from the
            toolbar.
          </p>
          {myTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No templates yet. Customize your layout and save it as a template.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {myTemplates.map((t: { id: string; name: string; type: string }) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1 rounded-lg border border-transparent bg-surface/50 p-1 transition-colors hover:border-card-border hover:bg-surface"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2 py-1 text-left text-xs"
                    onClick={() => handleApply(t.id, t.name)}
                  >
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{t.type}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete template ${t.name}`}
                    onClick={() => {
                      if (window.confirm(`Remove template “${t.name}” from your templates?`)) {
                        unpublishTemplate.mutate({ layoutId: t.id });
                      }
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply template confirmation */}
      {confirmingTemplate && (
        <Dialog
          open={!!confirmingTemplate}
          onOpenChange={(open) => !open && setConfirmingTemplate(null)}
        >
          <DialogContent className="studio-editor-chrome sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Apply “{confirmingTemplate.name}”?</DialogTitle>
              <DialogDescription>
                Applying a template replaces your current Studio structure — section order, section
                layouts, and the blocks inside them.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 text-sm text-foreground">
              <li>✓ Section order and layouts</li>
              <li>✓ Blocks in each section</li>
              <li>✓ Spacing and visual structure</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              You can undo this change (Ctrl/Cmd+Z) if you change your mind.
            </p>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={confirmApplyTemplate} disabled={applyTemplate.isPending}>
                {applyTemplate.isPending ? "Applying…" : "Apply template"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmingTemplate(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Theme picker */}
      {showThemePicker && (
        <ThemePicker
          page={page}
          ownerId={ownerId}
          ownerType={ownerType}
          onClose={() => setShowThemePicker(false)}
          onBeforeApply={() => {
            recordSnapshot({
              layout: page.layout,
              config: page.config,
              themeId: page.themeId,
              theme: page.theme,
            });
          }}
          onApplied={() => {
            setShowThemePicker(false);
            onRefresh();
          }}
        />
      )}
    </EditorChromeBoundary>
  );
}

function PreviewToolbar({
  device,
  onDeviceChange,
  onBackToEditor,
}: {
  device: "desktop" | "tablet" | "mobile";
  onDeviceChange: (device: "desktop" | "tablet" | "mobile") => void;
  onBackToEditor: () => void;
}) {
  const devices = [
    ["desktop", "Desktop", "Monitor"],
    ["tablet", "Tablet", "Tablet"],
    ["mobile", "Mobile", "Smartphone"],
  ] as const;

  return (
    <div className="mb-5 border-b border-border/50 bg-background px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={onBackToEditor}
            aria-label="Back to Studio editor"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to editor</span>
            <span className="sm:hidden">Edit</span>
          </Button>
          <span className="h-4 w-px bg-border/60" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Studio preview</p>
            <p className="text-[11px] text-muted-foreground">Review the space before sharing it.</p>
          </div>
        </div>

        <div
          className="flex items-center gap-1 rounded-md border border-border/60 bg-surface px-1 py-1"
          role="group"
          aria-label="Preview device"
        >
          {devices.map(([value, label, icon]) => {
            const Icon = icon === "Monitor" ? Monitor : icon === "Tablet" ? Tablet : Smartphone;
            const active = device === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onDeviceChange(value)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-background font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContentOutline({
  page,
  blockDefinitions,
  onToggleVisibility,
}: {
  page: PageData;
  blockDefinitions: BlockDefinition[];
  onToggleVisibility: (blockId: string) => void;
}) {
  const labels = new Map(blockDefinitions.map((block) => [block.type, block.label]));
  const sections = [...page.layout.sections].sort((a, b) => a.position - b.position);

  return (
    <div className="mt-4 border-y border-border/40" aria-label="Studio contents">
      {sections.map((section, sectionIndex) => (
        <div key={section.id} className="border-b border-border/30 last:border-b-0">
          <div className="flex items-center justify-between gap-3 px-1 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Section {sectionIndex + 1}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {section.layout.replace(/_/g, " ")}
            </span>
          </div>
          <div className="divide-y divide-border/20">
            {section.blocks
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((block) => {
                const isVisible = block.visible !== false;
                return (
                  <div key={block.id} className="flex items-center gap-3 px-1 py-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isVisible ? "bg-[var(--user-accent,var(--trust))]" : "bg-muted-foreground/35"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${isVisible ? "text-foreground" : "text-muted-foreground line-through"}`}
                    >
                      {labels.get(block.type) ?? block.type}
                    </span>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onToggleVisibility(block.id)}
                      aria-label={`${isVisible ? "Hide" : "Show"} ${labels.get(block.type) ?? "block"}`}
                      title={isVisible ? "Hide from Studio" : "Show in Studio"}
                    >
                      {isVisible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
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
    <div className="studio-tool-panel relative mb-5 px-4 py-4 sm:px-5">
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
        Add to your Studio
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Start with the part of your story you want people to discover.
      </p>
      {[...categories.entries()].map(([category, items]) => (
        <div key={category} className="mb-4 last:mb-0">
          <h4 className="mb-0.5 text-[11px] font-medium text-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h4>
          <p className="mb-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {CATEGORY_DESCRIPTIONS[category] ?? "Choose what belongs in your Studio."}
          </p>
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
