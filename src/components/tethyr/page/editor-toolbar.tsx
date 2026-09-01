// ── Editor Toolbar ────────────────────────────────────────────────────────────
// The floating toolbar that appears at the top of a page when in edit mode.
// Shows the page status (draft/published), edit/done toggle, publish/save-draft,
// block picker, and template save/apply actions.

import { useState, useMemo } from "react";
import { Edit3, Palette, Plus, Send, X, Bookmark, GalleryHorizontalEnd, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import { usePublishPage, useUnpublishPage, useUpdatePageLayout } from "@/hooks/use-page-editor";
import { useSaveAsTemplate, useApplyTemplate, usePublicTemplates } from "@/hooks/use-templates";
import { ThemePicker } from "@/components/tethyr/page/theme-picker";

import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type { PageData, LayoutSection, LayoutBlockInstance, PageOwnerType } from "@/lib/page-blocks";
import { createBlockInstance, getAllBlocks } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";

// ── Helpers ──────────────────────────────────────────────────────────────────

let _sectionCounter = 0;
function nextSectionId(): string { _sectionCounter++; return `sect_${Date.now()}_${_sectionCounter}`; }

let _blockCounter = 0;
function nextBlockId(): string { _blockCounter++; return `blk_${Date.now()}_${_blockCounter}`; }

function cloneSections(layout: { sections: LayoutSection[] }): LayoutSection[] {
  return layout.sections.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b })) }));
}

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content", media: "Media", project: "Project",
  people: "People", community: "Community", utility: "Utility",
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
  const saveAsTemplate = useSaveAsTemplate();
  const applyTemplate = useApplyTemplate();
  const { data: myTemplates = [] } = usePublicTemplates();

  const [showPicker, setShowPicker] = useState(false);
  const [showTemplateName, setShowTemplateName] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showApplyPanel, setShowApplyPanel] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const isPublished = page?.status === "published";

  // ── Add block ──────────────────────────────────────────────────────────
  function handleAddBlock(type: string) {
    if (!page) return;
    const inst = createBlockInstance(type);
    if (!inst) return;
    const newBlock: LayoutBlockInstance = {
      id: nextBlockId(), type: inst.type, position: 0,
      config: inst.config as Record<string, unknown>, visible: true,
    };
    const sections = cloneSections(page.layout ?? { sections: [] });
    let last = sections[sections.length - 1];
    if (!last) { last = { id: nextSectionId(), position: 0, layout: "full", blocks: [] }; sections.push(last); }
    const reindexed = last.blocks.map((b, i) => ({ ...b, position: i + 1 }));
    newBlock.position = reindexed.length;
    sections[sections.length - 1] = { ...last, blocks: [...reindexed, newBlock] };
    updateLayout.mutate(
      { pageId: page.id, layoutId: page.layoutId, layout: { sections } },
      { onSuccess: () => onRefresh() },
    );
  }

  // ── Publish / Unpublish ────────────────────────────────────────────────
  async function handlePublish() {
    try { await publishPage.mutateAsync({ pageId: page!.id }); toast.success("Page published"); stopEditing(); onRefresh(); }
    catch (err) { toast.error(friendlyError(err, "Failed to publish")); }
  }
  async function handleUnpublish() {
    try { await unpublishPage.mutateAsync({ pageId: page!.id }); toast.success("Reverted to draft"); onRefresh(); }
    catch (err) { toast.error(friendlyError(err, "Failed to unpublish")); }
  }

  // ── Save as template ───────────────────────────────────────────────────
  function handleSaveAsTemplate() {
    if (!page || !templateName.trim()) return;
    saveAsTemplate.mutate({ layoutId: page.layoutId, name: templateName.trim() }, {
      onSuccess: () => { setShowTemplateName(false); setTemplateName(""); },
    });
  }

  // ── Apply template ─────────────────────────────────────────────────────
  function handleApply(templateId: string) {
    if (!page) return;
    applyTemplate.mutate(
      { templateId, pageId: page.id, layoutId: page.layoutId, ownerId, ownerType },
      { onSuccess: () => { setShowApplyPanel(false); onRefresh(); } },
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
            <h2 className="mt-1 font-display text-lg font-semibold">Create a space that feels like yours</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Customize the story, arrange the work, and publish when it is ready to share.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Create → Customize → Personalize → Arrange → Preview → Publish</span>
            {page.status === "draft" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Draft</span>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="mr-2 flex items-center gap-2">
            <span className="text-[11px] font-medium text-foreground">Customizing</span>
            <span className="text-[11px] text-muted-foreground" aria-live="polite">{isPublished ? "Published" : "Draft"}</span>
          </div>
          <span className="text-muted-foreground/30 mx-1">·</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setShowPicker(!showPicker)}><Plus className="h-3.5 w-3.5" /> Add section</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setShowThemePicker(!showThemePicker)}><Palette className="h-3.5 w-3.5" /> Personalize</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setShowApplyPanel(!showApplyPanel)}><GalleryHorizontalEnd className="h-3.5 w-3.5" /> Layouts</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setShowTemplateName(true)}><Bookmark className="h-3.5 w-3.5" /> Save layout</Button>
          <span className="text-muted-foreground/30 mx-1">·</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={stopEditing}><Eye className="h-3.5 w-3.5" /> Preview</Button>
          {isPublished ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={handleUnpublish}><X className="h-3.5 w-3.5" /> Unpublish</Button>
          ) : (
            <Button variant="default" size="sm" className="h-7 gap-1 text-[11px]" onClick={handlePublish} disabled={publishPage.isPending}><Send className="h-3.5 w-3.5" /> {publishPage.isPending ? "Publishing..." : "Publish"}</Button>
          )}
        </div>
      </div>

      {showPicker && <BlockPickerPanel onAdd={handleAddBlock} onClose={() => setShowPicker(false)} />}

      {/* Save as template dialog */}
      {showTemplateName && (
        <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6" onClick={() => setShowTemplateName(false)} aria-label="Cancel"><X className="h-3.5 w-3.5" /></Button>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save as template</h3>
          <p className="mb-3 text-xs text-muted-foreground">This publishes your layout structure (not your content) so others can discover and fork it.</p>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Template name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveAsTemplate} disabled={!templateName.trim() || saveAsTemplate.isPending}>
              {saveAsTemplate.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Apply template panel */}
      {showApplyPanel && (
        <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6" onClick={() => setShowApplyPanel(false)} aria-label="Close"><X className="h-3.5 w-3.5" /></Button>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your templates</h3>
          <p className="mb-3 text-xs text-muted-foreground">Applying a template replaces your layout structure. Content in blocks stays with the page.</p>
          {myTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No templates yet. Customize your layout and save it as a template.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">                  {myTemplates.map((t: { id: string; name: string; type: string }) => (
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

interface BlockPickerPanelProps { onAdd: (type: string) => void; onClose: () => void; }

function BlockPickerPanel({ onAdd, onClose }: BlockPickerPanelProps) {
  const blocks: BlockDefinition[] = getAllBlocks();
  const categories = useMemo(() => {
    const map = new Map<string, BlockDefinition[]>();
    for (const b of blocks) { const list = map.get(b.category) ?? []; list.push(b); map.set(b.category, list); }
    return map;
  }, [blocks]);

  return (
    <div className="relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4">
      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6" onClick={onClose} aria-label="Close block picker"><X className="h-3.5 w-3.5" /></Button>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Build your Studio</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">Choose a content block, then arrange it into the story you want visitors to follow.</p>
      {[...categories.entries()].map(([category, items]) => (
        <div key={category} className="mb-3 last:mb-0">
          <h4 className="mb-1.5 text-[11px] font-medium text-muted-foreground">{CATEGORY_LABELS[category] ?? category}</h4>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {items.map((block) => (
              <button key={block.type} type="button" className="flex items-center gap-2 rounded-lg border border-transparent bg-surface/50 px-3 py-2 text-left text-xs transition-colors hover:border-card-border hover:bg-surface"
                onClick={() => { onAdd(block.type); onClose(); }}>
                <span className="text-[11px] font-medium">{block.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}