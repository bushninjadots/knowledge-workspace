// ── Studio Inspector ─────────────────────────────────────────────────────────
// Right panel: Content/Design/Layout tabs for selected block + publish state info.

import { useState } from "react";
import {
  Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Send, Globe,
} from "lucide-react";
import type { LayoutBlockInstance, PageData } from "@/lib/page-blocks";
import type { BlockDefinition } from "@/lib/page-blocks";

type InspectorTab = "content" | "design" | "layout";

interface StudioInspectorProps {
  selectedBlock: LayoutBlockInstance | null;
  selectedBlockDef: BlockDefinition | undefined;
  pageData: PageData | undefined | null;
  isPublished: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onSelectBlock: (blockId: string | null) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onRemoveBlock: (blockId: string) => void;
  onRefetch: () => void;
}

export function StudioInspector({
  selectedBlock, selectedBlockDef, pageData, isPublished,
  onPublish, onUnpublish,
  onSelectBlock, onMoveBlock, onRemoveBlock,
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("content");

  const blocks = pageData?.layout?.sections.flatMap((s) => s.blocks) ?? [];

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
          <EmptyState blocks={blocks} onSelectBlock={onSelectBlock} />
        ) : activeTab === "content" ? (
          <ContentTab block={selectedBlock} def={selectedBlockDef} />
        ) : activeTab === "design" ? (
          <DesignTab block={selectedBlock} def={selectedBlockDef} />
        ) : (
          <LayoutTab
            blocks={blocks}
            selectedBlockId={selectedBlock.id}
            onSelectBlock={onSelectBlock}
            onMoveBlock={onMoveBlock}
            onRemoveBlock={onRemoveBlock}
          />
        )}
      </div>

      {/* ── Publish status ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/20 px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${isPublished ? "bg-green-500" : "bg-amber-500"}`}
          />
          <span className="text-[11px] font-medium text-foreground">
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>
        {isPublished ? (
          <button
            type="button"
            onClick={onUnpublish}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border/30 bg-surface/30 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <EyeOff className="h-3 w-3" /> Unpublish
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
          >
            <Send className="h-3 w-3" /> Publish now
          </button>
        )}
        {isPublished && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
            <Globe className="mr-0.5 inline h-2.5 w-2.5" />
            Visible to everyone
          </p>
        )}
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  blocks, onSelectBlock,
}: {
  blocks: LayoutBlockInstance[];
  onSelectBlock: (id: string | null) => void;
}) {
  if (blocks.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground">
          No blocks on this page yet.
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Add blocks from the left sidebar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Select a block
      </p>
      {blocks.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelectBlock(b.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
            b.visible === false ? "opacity-50 line-through" : ""
          } text-muted-foreground hover:bg-surface-elevated/50 hover:text-foreground`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              b.visible === false ? "bg-muted-foreground/40" : "bg-primary/60"
            }`}
          />
          <span className="truncate">{b.type}</span>
        </button>
      ))}
    </div>
  );
}

// ── Content tab ─────────────────────────────────────────────────────────────

function ContentTab({
  block, def,
}: {
  block: LayoutBlockInstance;
  def: BlockDefinition | undefined;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Block
        </p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {def?.label ?? block.type}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">
          {block.type}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Config
        </p>
        {!block.config || Object.keys(block.config).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No configurable properties.</p>
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
        <span className="inline-flex items-center gap-1 text-[11px]">
          {block.visible === false ? (
            <>
              <EyeOff className="h-3 w-3 text-amber-500" />
              <span className="text-muted-foreground">Hidden</span>
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Visible</span>
            </>
          )}
        </span>
      </div>

      {def?.defaults && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Defaults
          </p>
          <div className="space-y-1.5">
            {Object.entries(def.defaults).map(([key, value]) => (
              <ConfigField key={key} label={key} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Design tab ──────────────────────────────────────────────────────────────

function DesignTab({
  block, def,
}: {
  block: LayoutBlockInstance;
  def: BlockDefinition | undefined;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Typography
        </p>
        <div className="space-y-1.5">
          <TokenDisplay label="Font family" value="var(--font-sans)" />
          <TokenDisplay label="Heading" value="var(--font-display)" />
          <TokenDisplay label="Base size" value="var(--text-base)" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Colors
        </p>
        <div className="space-y-1.5">
          <ColorSwatch label="Background" cssVar="--background" />
          <ColorSwatch label="Foreground" cssVar="--foreground" />
          <ColorSwatch label="Surface" cssVar="--surface" />
          <ColorSwatch label="Primary" cssVar="--primary" />
          <ColorSwatch label="Muted" cssVar="--muted-foreground" />
          <ColorSwatch label="Border" cssVar="--border" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Borders & Radius
        </p>
        <div className="space-y-1.5">
          <TokenDisplay label="Card radius" value="var(--radius-lg)" />
          <TokenDisplay label="Input radius" value="var(--radius-md)" />
          <TokenDisplay label="Button radius" value="var(--radius-md)" />
          <TokenDisplay label="Card border" value="var(--card-border)" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Category
        </p>
        <span className="rounded-full border border-border/30 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
          {def?.category ?? "unknown"}
        </span>
      </div>
    </div>
  );
}

// ── Layout tab ──────────────────────────────────────────────────────────────

function LayoutTab({
  blocks, selectedBlockId, onSelectBlock, onMoveBlock, onRemoveBlock,
}: {
  blocks: LayoutBlockInstance[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onRemoveBlock: (blockId: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">No blocks to arrange.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Block order
      </p>
      <p className="mb-2 text-[10px] text-muted-foreground">Drag to reorder or use arrows:</p>

      {blocks.map((block, idx) => {
        const isSelected = selectedBlockId === block.id;
        const isFirst = idx === 0;
        const isLast = idx === blocks.length - 1;

        return (
          <div
            key={block.id}
            className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
              isSelected
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-surface-elevated/50"
            }`}
          >
            <span className="shrink-0 text-[10px] text-muted-foreground/40 w-4 text-center">
              {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => onSelectBlock(block.id)}
              className={`flex-1 truncate text-left text-[11px] ${
                block.visible === false ? "line-through opacity-50" : ""
              }`}
            >
              {block.type}
            </button>
            <div className="hidden gap-0.5 group-hover:flex">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => onMoveBlock(block.id, "up")}
                  className="rounded p-0.5 hover:text-foreground"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  onClick={() => onMoveBlock(block.id, "down")}
                  className="rounded p-0.5 hover:text-foreground"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveBlock(block.id)}
                className="rounded p-0.5 hover:text-red-400"
                aria-label="Remove"
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
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : value === null
          ? "null"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
  const truncated = displayValue.length > 50 ? displayValue.slice(0, 50) + "…" : displayValue;

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-[11px] text-foreground break-words font-mono">{truncated}</p>
    </div>
  );
}

function ColorSwatch({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3.5 w-3.5 shrink-0 rounded border border-border/40"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">{cssVar}</span>
    </div>
  );
}

function TokenDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground/40 font-mono">{value}</span>
    </div>
  );
}