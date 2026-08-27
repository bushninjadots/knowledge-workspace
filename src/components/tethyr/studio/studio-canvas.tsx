// ── Studio Canvas ────────────────────────────────────────────────────────────
// Center panel: renders the real page with selection outlines, a contextual
// floating toolbar for the selected block, drag-to-reorder, section
// grid layouts with column boundaries, per-column add buttons, and
// empty section states. Width control is handled by the inspector.

import { useState, useCallback, useRef, useEffect } from "react";
import {
  GripVertical,
  Trash2,
  EyeOff,
  Eye,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Columns2,
  Search,
  X,
} from "lucide-react";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { getBlock, getAllBlocks } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { StudioPage, SelectionType } from "./studio";
import type { SectionPreset } from "./section-presets";
import type { BlockContext, PageData, PageLayout, LayoutBlockInstance } from "@/lib/page-blocks";

const CATEGORY_LABELS: Record<string, string> = {
  content: "Text & Media",
  media: "Media",
  project: "Project",
  people: "People & Profile",
  community: "Community",
  utility: "Layout & Utility",
};

interface StudioCanvasProps {
  page: StudioPage;
  pageData: PageData | undefined | null;
  layout: PageLayout;
  pageLoading: boolean;
  pageError: boolean;
  selectionType: SelectionType;
  selectedBlockId: string | null;
  selectedSectionId: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onSelectPage: () => void;
  onRemoveBlock: (blockId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onToggleVisibility: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onAddBlock: (blockType: string) => void;
  onAddSection: (preset: SectionPreset) => void;
  onUpdateBlockConfig: (blockId: string, config: Record<string, unknown>) => void;
  onDuplicateBlock: (blockId: string) => void;
  onReorderBlocks: (sectionId: string, blockId: string, targetIndex: number) => void;
  onLayoutChange: (layout: PageLayout) => void;
  onRefetch: () => void;
  devicePreview?: "desktop" | "tablet" | "mobile";
}

/** Tailwind grid classes for section layouts in the Studio canvas. */
const CANVAS_GRID: Record<string, string> = {
  full: "",
  two_column: "grid grid-cols-2 gap-3",
  three_column: "grid grid-cols-3 gap-3",
  sidebar_left: "grid grid-cols-[220px_1fr] gap-3",
  sidebar_right: "grid grid-cols-[1fr_220px] gap-3",
  feature: "grid grid-cols-2 gap-3",
};

const COLUMN_COUNT: Record<string, number> = {
  full: 1,
  two_column: 2,
  three_column: 3,
  sidebar_left: 2,
  sidebar_right: 2,
  feature: 2,
};

export function StudioCanvas({
  page,
  pageData,
  layout,
  pageLoading,
  pageError,
  selectionType: _selectionType,
  selectedBlockId,
  selectedSectionId,
  onSelectBlock,
  onSelectSection,
  onSelectPage,
  onRemoveBlock: _onRemoveBlock,
  onRemoveSection,
  onToggleVisibility,
  onMoveBlock,
  onAddBlock,
  onAddSection,
  onUpdateBlockConfig,
  onDuplicateBlock,
  onReorderBlocks,
  onLayoutChange,
  onRefetch,
  devicePreview,
}: StudioCanvasProps) {
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"block" | "section" | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  // ── Block drag handlers ───────────────────────────────────────────────
  const handleBlockDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData("text/plain", `block:${blockId}`);
    e.dataTransfer.effectAllowed = "move";
    setDragType("block");
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragOverBlockId(null);
    setDragOverSectionId(null);
    setDragType(null);
  }, []);

  const handleBlockDragOver = useCallback((e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverBlockId(blockId);
  }, []);

  // ── Section drag handlers ─────────────────────────────────────────────
  const handleSectionDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    e.dataTransfer.setData("text/plain", `section:${sectionId}`);
    e.dataTransfer.effectAllowed = "move";
    setDragType("section");
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleSectionDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverSectionId(sectionId);
  }, []);

  const handleSectionDrop = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer.getData("text/plain");
      if (!data.startsWith("section:")) return;
      const sourceId = data.replace("section:", "");
      if (sourceId === targetSectionId) return;
      const sections = layout.sections.map((s) => ({
        ...s,
        blocks: [...s.blocks],
      }));
      const srcIdx = sections.findIndex((s) => s.id === sourceId);
      const tgtIdx = sections.findIndex((s) => s.id === targetSectionId);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const [moved] = sections.splice(srcIdx, 1);
      sections.splice(tgtIdx, 0, moved);
      onLayoutChange({ sections });
      setDragOverSectionId(null);
      setDragType(null);
    },
    [layout, onLayoutChange],
  );

  const handleBlockDrop = useCallback(
    (e: React.DragEvent, sectionId: string, targetBlockId: string, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer.getData("text/plain");
      if (data.startsWith("block:")) {
        const blockId = data.replace("block:", "");
        if (blockId && blockId !== targetBlockId) {
          onReorderBlocks(sectionId, blockId, targetIndex);
        }
      }
      setDragOverBlockId(null);
    },
    [onReorderBlocks],
  );

  // ── Inline block config change (typing in heading/text blocks) ─────────
  const handleInlineConfigChange = useCallback(
    (blockId: string, newConfig: Record<string, unknown>) => {
      onUpdateBlockConfig(blockId, newConfig);
    },
    [onUpdateBlockConfig],
  );

  if (pageLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (pageError && !pageData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">This page couldn't be loaded.</p>
          <button
            type="button"
            onClick={() => onRefetch()}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Keep the private working canvas useful while a new page is being created.
  // The parent owns the local draft, so it can render before the server page
  // record is visible and then adopt the real page id once it arrives.
  const blockContext: BlockContext = {
    ownerId: pageData?.ownerId ?? page.id,
    ownerType: pageData?.ownerType ?? (page.type === "profile" ? "profile" : "project"),
    pageId: pageData?.id ?? `draft:${page.type}:${page.id}`,
    isEditing: true,
  };

  if (layout.sections.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" onClick={onSelectPage}>
        <div className="max-w-xs text-center">
          <p className="text-sm text-foreground font-medium">Your page is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a section to start building your {page.type === "profile" ? "studio" : "project"}{" "}
            page.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBlockPicker(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first block
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      onClick={onSelectPage}
      data-studio-canvas="private-draft"
      aria-label={`${page.type === "profile" ? "Private Studio" : "Private project"} draft canvas`}
    >
      {layout.sections.map((section, sectionIdx) => {
        const isSectionSelected = selectedSectionId === section.id;
        const isSectionDragOver = dragOverSectionId === section.id && dragType === "section";
        const gridClass = CANVAS_GRID[section.layout] ?? "";
        const isMultiColumn = gridClass !== "";
        const forceSingle =
          devicePreview === "mobile" ||
          (devicePreview === "tablet" && section.layout === "three_column");
        const colCount = forceSingle ? 1 : (COLUMN_COUNT[section.layout] ?? 1);
        const useGrid = isMultiColumn && !forceSingle;

        return (
          <div
            key={section.id}
            className={`group/section relative rounded-lg transition-all ${
              isSectionSelected
                ? "ring-2 ring-primary/25 bg-primary/[0.02]"
                : isSectionDragOver
                  ? "ring-2 ring-primary/20 bg-primary/[0.05]"
                  : "ring-1 ring-transparent hover:ring-border/20"
            }`}
            draggable
            onDragStart={(e) => handleSectionDragStart(e, section.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleSectionDragOver(e, section.id)}
            onDragLeave={() => setDragOverSectionId(null)}
            onDrop={(e) => handleSectionDrop(e, section.id)}
            onClick={(e) => {
              // Only select section if clicking the section container itself,
              // not any child element (block, button, toolbar, etc.)
              if (e.target === e.currentTarget) {
                onSelectSection(section.id);
              }
            }}
          >
            {/* Section drag handle */}
            <div className="pointer-events-none absolute -left-1 top-2 z-20 opacity-0 group-hover/section:opacity-100 transition-opacity">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing pointer-events-auto" />
            </div>

            {/* Section label — always visible */}
            <div className="pointer-events-none absolute -top-2 left-3 z-20 rounded bg-surface-elevated px-2 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/20">
              {isSectionSelected && <span className="text-primary mr-1">●</span>}
              Section {sectionIdx + 1}
              {colCount > 1 && (
                <span className="ml-1 text-muted-foreground/50">· {colCount} col</span>
              )}
            </div>

            {/* Section quick-actions toolbar — shown when selected */}
            {isSectionSelected && (
              <div
                className="absolute -top-2 right-3 z-20 flex items-center gap-0.5 rounded-md border border-border/40 bg-surface-elevated px-1 py-0.5 shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const LAYOUT_CYCLE = [
                      "full",
                      "two_column",
                      "three_column",
                      "sidebar_left",
                      "sidebar_right",
                      "feature",
                    ] as const;
                    const currentIdx = LAYOUT_CYCLE.indexOf(
                      section.layout as (typeof LAYOUT_CYCLE)[number],
                    );
                    // If current layout isn't in cycle (shouldn't happen), start from full
                    const nextLayout =
                      LAYOUT_CYCLE[
                        ((currentIdx === -1 ? 0 : currentIdx) + 1) % LAYOUT_CYCLE.length
                      ];
                    onLayoutChange({
                      ...layout,
                      sections: layout.sections.map((s) =>
                        s.id === section.id ? { ...s, layout: nextLayout } : s,
                      ),
                    });
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  title={`Layout: ${section.layout.replace(/_/g, " ")} (click to cycle)`}
                >
                  <Columns2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSection(section.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                  title="Delete section"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Blocks container */}
            {useGrid ? (
              <div className={`${gridClass} p-2 pt-4`}>
                {renderGridBlocks(
                  section,
                  sectionIdx,
                  colCount,
                  blockContext,
                  selectedBlockId,
                  dragOverBlockId,
                  dragType,
                  handleBlockDragStart,
                  handleDragEnd,
                  handleBlockDragOver,
                  handleBlockDrop,
                  onSelectBlock,
                  () => setShowBlockPicker(true),
                  onMoveBlock,
                  onDuplicateBlock,
                  onToggleVisibility,
                  handleInlineConfigChange,
                  devicePreview,
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-2 pt-4">
                {section.blocks.length === 0 ? (
                  <EmptySection onAdd={() => setShowBlockPicker(true)} />
                ) : (
                  section.blocks.map((block, idx) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      idx={idx}
                      sectionId={section.id}
                      sectionBlockCount={section.blocks.length}
                      blockContext={blockContext}
                      isSelected={selectedBlockId === block.id}
                      isDragOver={dragOverBlockId === block.id}
                      devicePreview={devicePreview}
                      onDragStart={handleBlockDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleBlockDragOver}
                      onDrop={handleBlockDrop}
                      onSelect={onSelectBlock}
                      onMoveBlock={onMoveBlock}
                      onDuplicateBlock={onDuplicateBlock}
                      onToggleVisibility={onToggleVisibility}
                      onConfigChange={handleInlineConfigChange}
                    />
                  ))
                )}
                {section.blocks.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBlockPicker(true);
                    }}
                    className="flex basis-full items-center justify-center gap-1 rounded border border-dashed border-border/30 py-2 text-[10px] text-muted-foreground/50 transition-colors hover:border-border/50 hover:text-muted-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add block
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add section button at bottom */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddSection({
            id: "blank",
            label: "Blank",
            description: "Empty section",
            icon: "Square",
            layout: "full",
          });
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/30 py-6 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Add section
      </button>

      {/* Block picker modal */}
      {showBlockPicker && (
        <BlockPickerModal onSelect={onAddBlock} onClose={() => setShowBlockPicker(false)} />
      )}
    </div>
  );
}

// ── Grid blocks renderer ─────────────────────────────────────────────────────

function renderGridBlocks(
  section: {
    id: string;
    blocks: LayoutBlockInstance[];
    layout: string;
  },
  sectionIdx: number,
  colCount: number,
  blockContext: BlockContext,
  selectedBlockId: string | null,
  dragOverBlockId: string | null,
  dragType: string | null,
  onDragStart: (e: React.DragEvent, blockId: string) => void,
  onDragEnd: (e: React.DragEvent) => void,
  onDragOver: (e: React.DragEvent, blockId: string) => void,
  onDrop: (
    e: React.DragEvent,
    sectionId: string,
    targetBlockId: string,
    targetIndex: number,
  ) => void,
  onSelect: (blockId: string) => void,
  onShowPicker: () => void,
  onMoveBlock: (blockId: string, direction: "up" | "down") => void,
  onDuplicateBlock: (blockId: string) => void,
  onToggleVisibility: (blockId: string) => void,
  onConfigChange: (blockId: string, config: Record<string, unknown>) => void,
  devicePreview?: "desktop" | "tablet" | "mobile",
) {
  // Group blocks by column
  const columns: LayoutBlockInstance[][] = Array.from({ length: colCount }, () => []);
  const unassigned: LayoutBlockInstance[] = [];

  for (const block of section.blocks) {
    const col = block.column;
    if (col != null && col >= 0 && col < colCount) {
      columns[col].push(block);
    } else {
      unassigned.push(block);
    }
  }

  // Distribute unassigned blocks round-robin into columns
  for (let i = 0; i < unassigned.length; i++) {
    columns[i % colCount].push(unassigned[i]);
  }

  return (
    <>
      {columns.map((colBlocks, colIdx) => (
        <div key={colIdx} className="relative">
          {/* Column boundary indicator */}
          {colIdx > 0 && (
            <div className="absolute -left-1.5 top-0 bottom-0 w-px border-l border-dashed border-border/30" />
          )}

          {/* Column label */}
          <div className="mb-1 text-center text-[8px] text-muted-foreground/30 font-medium">
            Col {colIdx + 1}
          </div>

          {/* Blocks in this column */}
          <div className="space-y-2">
            {colBlocks.length === 0 ? (
              <EmptyColumn colIdx={colIdx} onAdd={onShowPicker} />
            ) : (
              colBlocks.map((block, idx) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  idx={idx}
                  sectionId={section.id}
                  sectionBlockCount={colBlocks.length}
                  blockContext={blockContext}
                  isSelected={selectedBlockId === block.id}
                  isDragOver={dragOverBlockId === block.id}
                  devicePreview={devicePreview}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onSelect={onSelect}
                  onMoveBlock={onMoveBlock}
                  onDuplicateBlock={onDuplicateBlock}
                  onToggleVisibility={onToggleVisibility}
                  onConfigChange={onConfigChange}
                />
              ))
            )}

            {/* Per-column add button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowPicker();
              }}
              className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border/20 py-1.5 text-[9px] text-muted-foreground/40 transition-colors hover:border-border/40 hover:text-muted-foreground"
            >
              <Plus className="h-2.5 w-2.5" />
              Add
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Block Card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  idx,
  sectionId,
  sectionBlockCount: _sectionBlockCount,
  blockContext,
  isSelected,
  isDragOver,
  devicePreview,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSelect,
  onMoveBlock,
  onDuplicateBlock,
  onToggleVisibility,
  onConfigChange,
}: {
  block: LayoutBlockInstance;
  idx: number;
  sectionId: string;
  sectionBlockCount: number;
  blockContext: BlockContext;
  isSelected: boolean;
  isDragOver: boolean;
  devicePreview?: "desktop" | "tablet" | "mobile";
  onDragStart: (e: React.DragEvent, blockId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, blockId: string) => void;
  onDrop: (
    e: React.DragEvent,
    sectionId: string,
    targetBlockId: string,
    targetIndex: number,
  ) => void;
  onSelect: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onDuplicateBlock: (blockId: string) => void;
  onToggleVisibility: (blockId: string) => void;
  onConfigChange: (blockId: string, config: Record<string, unknown>) => void;
}) {
  const isHidden = block.visible === false;
  const blockWidth = (block.config?.width as string) ?? "full";
  const mobileOverride = devicePreview === "mobile" || devicePreview === "tablet";
  const widthClass = mobileOverride
    ? "w-full"
    : blockWidth === "2/3"
      ? "w-2/3"
      : blockWidth === "1/2"
        ? "w-1/2"
        : blockWidth === "1/3"
          ? "w-1/3"
          : blockWidth === "auto"
            ? "w-auto"
            : "w-full";

  const blockDef = getBlock(block.type);

  return (
    <div
      className={`group/block relative rounded-md transition-all ${widthClass} ${
        isSelected
          ? "ring-2 ring-primary/30 bg-primary/[0.03]"
          : isDragOver
            ? "ring-2 ring-primary/20 bg-primary/[0.05]"
            : "ring-1 ring-transparent hover:ring-border/20"
      } ${isDragOver ? "scale-[1.01]" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, block.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, block.id)}
      onDragLeave={() => {}}
      onDrop={(e) => onDrop(e, sectionId, block.id, idx)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
    >
      {/* Block type badge + width indicator */}
      <div className="absolute -top-1.5 left-2 z-10 flex items-center gap-1">
        <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground border border-border/20 opacity-0 group-hover/block:opacity-100 transition-opacity">
          {blockDef?.label ?? block.type}
        </span>
        {blockWidth !== "full" && (
          <span className="rounded bg-primary/10 px-1 py-0.5 text-[7px] font-medium text-primary/70 border border-primary/15">
            {blockWidth}
          </span>
        )}
      </div>

      {/* Block content — with inline config change wired */}
      <div className={isHidden ? "opacity-30" : ""}>
        <SingleBlockRenderer
          block={block}
          context={blockContext}
          devicePreview={devicePreview}
          onConfigChange={(config) => onConfigChange(block.id, config)}
        />
      </div>

      {/* Floating toolbar — shown only when this block is selected */}
      {isSelected && (
        <div className="absolute -top-8 left-1/2 z-30 -translate-x-1/2 flex items-center gap-0.5 rounded-md border border-border/40 bg-surface-elevated px-1.5 py-1 shadow-md">
          <span className="px-1.5 text-[10px] font-medium text-foreground select-none">
            {blockDef?.label ?? block.type}
          </span>
          <span className="h-3.5 w-px bg-border/40" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveBlock(block.id, "up");
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveBlock(block.id, "down");
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Move down"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateBlock(block.id);
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(block.id);
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={isHidden ? "Show block" : "Hide block"}
          >
            {isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 h-full w-0.5 rounded-l-md bg-primary/40" />
      )}
    </div>
  );
}

// ── Empty States ─────────────────────────────────────────────────────────────

function EmptySection({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 py-6 text-center">
      <p className="text-[10px] text-muted-foreground/50 mb-2">Empty section</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="flex items-center gap-1 rounded-md bg-surface/40 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add first block
      </button>
    </div>
  );
}

function EmptyColumn({ colIdx: _colIdx, onAdd }: { colIdx: number; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/20 py-4 text-center min-h-[60px]">
      <p className="text-[9px] text-muted-foreground/30 mb-1">Empty</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        <Plus className="h-2.5 w-2.5" />
        Add
      </button>
    </div>
  );
}

// ── Block Picker Modal ────────────────────────────────────────────────────────

function BlockPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (type: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const blocks = getAllBlocks();
  const filtered = search
    ? blocks.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.type.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase()),
      )
    : blocks;

  const grouped = new Map<string, BlockDefinition[]>();
  for (const b of filtered) {
    const list = grouped.get(b.category) ?? [];
    list.push(b);
    grouped.set(b.category, list);
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border/30 bg-surface-elevated shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/20 px-4 py-3">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Add block</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border/20 px-4 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks..."
              className="w-full rounded-md border border-border/30 bg-surface/40 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Block list */}
        <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((block) => (
                  <button
                    key={block.type}
                    type="button"
                    onClick={() => {
                      onSelect(block.type);
                      onClose();
                    }}
                    className="flex items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface/60"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface/60 text-muted-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{block.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {block.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No blocks found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single block renderer ────────────────────────────────────────────────────

function SingleBlockRenderer({
  block,
  context,
  devicePreview,
  onConfigChange,
}: {
  block: LayoutBlockInstance;
  context: BlockContext;
  devicePreview?: "desktop" | "tablet" | "mobile";
  onConfigChange?: (config: Record<string, unknown>) => void;
}) {
  const layout: PageLayout = {
    sections: [{ id: "single", position: 0, layout: "full", blocks: [block] }],
  };
  return (
    <PageLayoutRenderer
      layout={layout}
      context={context}
      devicePreview={devicePreview}
      onBlockConfigChange={onConfigChange ? (_bid, config) => onConfigChange(config) : undefined}
    />
  );
}
