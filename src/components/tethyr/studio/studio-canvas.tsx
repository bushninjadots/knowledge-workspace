// ── Studio Canvas ────────────────────────────────────────────────────────────
// Center panel: renders the real published page with contextual editing controls.
// When hovering a block: subtle boundary + Edit/Move/Duplicate/Delete actions.

import { useState, useCallback } from "react";
import { GripVertical, Pencil, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { usePage } from "@/hooks/use-page";
import { useUpdatePageLayout } from "@/hooks/use-page-editor";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudioPage } from "./studio";
import type { BlockContext, PageLayout, LayoutSection, LayoutBlockInstance } from "@/lib/page-blocks";

interface StudioCanvasProps {
  page: StudioPage;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
}

export function StudioCanvas({ page, selectedBlockId, onSelectBlock }: StudioCanvasProps) {
  const { data: pageData, isLoading, isError, refetch } = usePage({
    ownerId: page.id,
    ownerType: page.type,
  });
  const updateLayout = useUpdatePageLayout();
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const handleLayoutChange = useCallback(
    (newLayout: PageLayout) => {
      if (!pageData) return;
      updateLayout.mutate({
        pageId: pageData.id,
        layoutId: pageData.layoutId,
        layout: newLayout,
      }, { onSuccess: () => refetch() });
    },
    [pageData, updateLayout, refetch],
  );

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      if (!pageData?.layout) return;
      const sections = pageData.layout.sections
        .map((s) => ({
          ...s,
          blocks: s.blocks.filter((b) => b.id !== blockId),
        }))
        .filter((s) => s.blocks.length > 0);
      handleLayoutChange({ sections });
      onSelectBlock(null);
    },
    [pageData, handleLayoutChange, onSelectBlock],
  );

  const handleToggleVisibility = useCallback(
    (blockId: string) => {
      if (!pageData?.layout) return;
      const sections = pageData.layout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, visible: !b.visible } : b,
        ),
      }));
      handleLayoutChange({ sections });
    },
    [pageData, handleLayoutChange],
  );

  const blockContext: BlockContext = {
    ownerId: page.id,
    ownerType: page.type,
    pageId: pageData?.id ?? "",
    isEditing: true,
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !pageData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">This page couldn't be loaded.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const layout: PageLayout = pageData.layout ?? { sections: [] };

  if (layout.sections.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="max-w-xs text-center">
          <p className="text-sm text-muted-foreground">Your page is empty.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add blocks from the left sidebar to start building.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {layout.sections.map((section) => (
        <SectionWrapper
          key={section.id}
          section={section}
          hoveredBlockId={hoveredBlockId}
          selectedBlockId={selectedBlockId}
          onHoverBlock={setHoveredBlockId}
          onSelectBlock={onSelectBlock}
          onToggleVisibility={handleToggleVisibility}
          onRemoveBlock={handleRemoveBlock}
          context={blockContext}
          onLayoutChange={handleLayoutChange}
        />
      ))}
    </div>
  );
}

// ── Section wrapper with add-section button ──────────────────────────────────

function SectionWrapper({
  section,
  hoveredBlockId,
  selectedBlockId,
  onHoverBlock,
  onSelectBlock,
  onToggleVisibility,
  onRemoveBlock,
  context,
  onLayoutChange,
}: {
  section: LayoutSection;
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  onHoverBlock: (id: string | null) => void;
  onSelectBlock: (id: string | null) => void;
  onToggleVisibility: (blockId: string) => void;
  onRemoveBlock: (blockId: string) => void;
  context: BlockContext;
  onLayoutChange: (layout: PageLayout) => void;
}) {
  return (
    <div className="relative rounded-lg transition-colors">
      {section.blocks.map((block) => {
        const isHovered = hoveredBlockId === block.id;
        const isSelected = selectedBlockId === block.id;
        const isHidden = block.visible === false;

        return (
          <div
            key={block.id}
            className={`group/block relative rounded-md transition-colors ${
              isSelected
                ? "ring-1 ring-primary/40 bg-primary/5"
                : isHovered
                  ? "ring-1 ring-border/30 bg-surface/30"
                  : "ring-1 ring-transparent"
            }`}
            onMouseEnter={() => onHoverBlock(block.id)}
            onMouseLeave={() => onHoverBlock(null)}
            onClick={() => onSelectBlock(block.id)}
          >
            {/* Block content */}
            <div className={isHidden ? "opacity-30" : ""}>
              <BlockRendererWrapper block={block} context={context} />
            </div>

            {/* Hover controls */}
            {isHovered && (
              <div className="pointer-events-none absolute -top-0 right-0 z-10 flex -translate-y-full items-center gap-0.5 rounded-md border border-border/30 bg-surface-elevated p-0.5 shadow-sm">
                <button
                  type="button"
                  className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Edit block"
                  onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={block.visible === false ? "Show block" : "Hide block"}
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(block.id); }}
                >
                  {block.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove block"
                  onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Single block renderer without layout management ──────────────────────────

function BlockRendererWrapper({
  block,
  context,
}: {
  block: LayoutBlockInstance;
  context: BlockContext;
}) {
  // Simply render the block through the page layout system.
  // Each block component handles its own data fetching.
  const layout: PageLayout = {
    sections: [{ id: "temp", position: 0, layout: "full", blocks: [block] }],
  };
  return <PageLayoutRenderer layout={layout} context={context} />;
}