// ── Studio Inspector ─────────────────────────────────────────────────────────
// Right panel: properties/design inspector for the selected block.
// Tabs: Content, Design, Layout.

import { useState } from "react";
import {
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
} from "lucide-react";
import { usePage } from "@/hooks/use-page";
import { useUpdatePageLayout } from "@/hooks/use-page-editor";
import { getBlock } from "@/lib/block-registry";
import type { StudioPage } from "./studio";

type InspectorTab = "content" | "design" | "layout";

interface StudioInspectorProps {
  activePage: StudioPage | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
}

export function StudioInspector({ activePage, selectedBlockId, onSelectBlock }: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("content");

  const { data: pageData, refetch } = usePage({
    ownerId: activePage?.id ?? "",
    ownerType: activePage?.type ?? "project",
  });
  const updateLayout = useUpdatePageLayout();

  if (!activePage || !pageData) return null;

  const layout = pageData.layout ?? { sections: [] };
  const blocks = layout.sections.flatMap((s) => s.blocks);
  const selectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId)
    : null;
  const registeredBlock = selectedBlock
    ? getBlock(selectedBlock.type)
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* ── Inspector tabs ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/20 px-3 pt-3">
        <div className="flex gap-1">
          {(["content", "design", "layout"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!selectedBlock ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">
              Select a block on the canvas to edit its properties.
            </p>
          </div>
        ) : activeTab === "content" ? (
          <ContentTab block={selectedBlock} registeredBlock={registeredBlock} />
        ) : activeTab === "design" ? (
          <DesignTab block={selectedBlock} />
        ) : (
          <LayoutTab
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            pageData={pageData}
            updateLayout={updateLayout}
            onSelectBlock={onSelectBlock}
            refetch={refetch}
          />
        )}
      </div>
    </div>
  );
}

// ── Content tab ─────────────────────────────────────────────────────────────

function ContentTab({
  block,
  registeredBlock,
}: {
  block: { id: string; type: string; config: Record<string, unknown>; visible?: boolean };
  registeredBlock: { label: string; type: string; category: string } | undefined | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Block
        </p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {registeredBlock?.label ?? block.type}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Type: {block.type}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Content
        </p>

        {Object.entries(block.config).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            This block has no configurable content properties.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(block.config).map(([key, value]) => (
              <ConfigField key={key} label={key} value={value} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Visibility
        </p>
        <span className="text-[11px] text-muted-foreground">
          {block.visible === false ? "Hidden" : "Visible"}
        </span>
      </div>
    </div>
  );
}

// ── Design tab ──────────────────────────────────────────────────────────────

function DesignTab({ block }: { block: { id: string; type: string; config: Record<string, unknown> } }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Typography
        </p>
        <p className="text-[11px] text-muted-foreground">
          Block inherits page theme typography.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Colors
        </p>
        <div className="space-y-1.5">
          <ColorRow label="Background" value="var(--background)" />
          <ColorRow label="Text" value="var(--foreground)" />
          <ColorRow label="Surface" value="var(--surface)" />
          <ColorRow label="Accent" value="var(--primary)" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Borders & Radius
        </p>
        <p className="text-[11px] text-muted-foreground">
          Inherited from page theme.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Spacing
        </p>
        <p className="text-[11px] text-muted-foreground">
          Default block spacing applied.
        </p>
      </div>
    </div>
  );
}

// ── Layout tab ──────────────────────────────────────────────────────────────

function LayoutTab({
  blocks,
  selectedBlockId,
  pageData,
  updateLayout,
  onSelectBlock,
  refetch,
}: {
  blocks: { id: string; type: string; config: Record<string, unknown>; visible?: boolean }[];
  selectedBlockId: string | null;
  pageData: { id: string; layoutId: string; layout?: { sections: { id: string; blocks: { id: string; type: string; config: Record<string, unknown>; visible?: boolean }[] }[] } };
  updateLayout: any;
  onSelectBlock: (id: string | null) => void;
  refetch: () => void;
}) {
  const handleMoveBlock = (blockId: string, direction: "up" | "down") => {
    if (!pageData.layout) return;
    const sections = pageData.layout.sections.map((s) => ({
      ...s,
      blocks: [...s.blocks],
    }));

    for (const section of sections) {
      const idx = section.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) continue;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= section.blocks.length) return;
      const [moved] = section.blocks.splice(idx, 1);
      section.blocks.splice(newIdx, 0, moved);
      break;
    }

    updateLayout.mutate(
      { pageId: pageData.id, layoutId: pageData.layoutId, layout: { sections } },
      { onSuccess: () => refetch() },
    );
  };

  const handleRemoveBlock = (blockId: string) => {
    if (!pageData.layout) return;
    const sections = pageData.layout.sections
      .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))
      .filter((s) => s.blocks.length > 0);
    updateLayout.mutate(
      { pageId: pageData.id, layoutId: pageData.layoutId, layout: { sections } },
      { onSuccess: () => { refetch(); onSelectBlock(null); } },
    );
  };

  return (
    <div className="space-y-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Section order
      </p>
      {blocks.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No blocks on this page.</p>
      )}
      {blocks.map((block) => {
        const registered = getBlock(block.type);
        const isSelected = selectedBlockId === block.id;
        const isHidden = block.visible === false;
        return (
          <div
            key={block.id}
            className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
              isSelected
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-surface-elevated/50"
            }`}
          >
            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            <button
              type="button"
              onClick={() => onSelectBlock(block.id)}
              className={`flex-1 truncate text-left text-[11px] ${isHidden ? "line-through opacity-50" : ""}`}
            >
              {registered?.label ?? block.type}
            </button>
            <div className="hidden gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={() => handleMoveBlock(block.id, "up")}
                className="rounded p-0.5 hover:text-foreground"
                aria-label="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveBlock(block.id, "down")}
                className="rounded p-0.5 hover:text-foreground"
                aria-label="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveBlock(block.id)}
                className="rounded p-0.5 hover:text-destructive"
                aria-label="Remove block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ConfigField({ label, value }: { label: string; value: unknown }) {
  const displayValue =
    typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  const truncated = displayValue.length > 60 ? displayValue.slice(0, 60) + "…" : displayValue;

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] text-foreground break-words">{truncated}</p>
    </div>
  );
}

function ColorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3.5 w-3.5 rounded border border-border/40"
        style={{ backgroundColor: value }}
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}