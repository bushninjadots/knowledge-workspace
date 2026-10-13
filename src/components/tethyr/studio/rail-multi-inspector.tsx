// ── Studio rail: several blocks selected ─────────────────────────────────────────
// What the Block tab shows when more than one block is selected: arrange
// (match sizes, align, put side by side), shared style, hide/show and remove,
// each as one undo step.

import { useState } from "react";
import { Eye, EyeOff, FolderInput, Lock, LockOpen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance } from "@/lib/page-blocks";
import { sectionLabel, type GridArrangement } from "@/lib/studio-grid";
import { IconButton } from "./studio-controls";
import type { GStudioSurfaceProps } from "./g-studio-surface";
import { STYLE_KEYS, readStyleClipboard } from "./rail-block-style";

const ARRANGEMENTS: Array<{ how: GridArrangement; label: string; oneArea?: boolean }> = [
  { how: "match-width", label: "Match widths" },
  { how: "match-height", label: "Match heights" },
  { how: "align-left", label: "Align left edges" },
  { how: "align-top", label: "Align tops", oneArea: true },
  { how: "row", label: "Side by side", oneArea: true },
];

/** The Block tab while several blocks are selected: changes that apply to
 *  all of them at once, each a single undo step. "First" means the block
 *  picked first, which the layout tools line the others up against. */
export function MultiBlockInspector(props: GStudioSurfaceProps) {
  const [copied] = useState<Partial<LayoutBlockInstance> | null>(readStyleClipboard);
  const ids = props.selectedBlockIds;
  const all = props.layout.sections.flatMap((section) =>
    section.blocks.map((block) => ({ block, section })),
  );
  const picked = ids
    .map((id) => all.find((entry) => entry.block.id === id))
    .filter((entry): entry is (typeof all)[number] => !!entry);
  const blocks = picked.map((entry) => entry.block);
  const first = blocks[0];
  const oneArea = new Set(picked.map((entry) => entry.section.id)).size === 1;
  const allHidden = blocks.every((block) => block.visible === false);
  const allLocked = blocks.every((block) => block.locked === true);
  const count = `${blocks.length} blocks`;
  const button =
    "rounded-sm border border-border px-2 py-1 text-2xs text-foreground outline-none hover:border-[var(--user-accent-border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent";
  if (!first) return null;
  const firstStyle = Object.fromEntries(
    STYLE_KEYS.map((key) => [key, first[key]]),
  ) as Partial<LayoutBlockInstance>;
  return (
    <div className="p-3">
      <header className="flex items-start gap-2.5 border-b border-border pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{count} selected</h2>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
            Shift-click a block to add or drop it. Changes apply to all of them.
          </p>
        </div>
        <IconButton label="Clear selection (Esc)" onClick={() => props.onSelect(null)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <ol className="space-y-0.5 border-b border-border py-2" aria-label="Selected blocks">
        {picked.map(({ block, section }, index) => (
          <li key={block.id} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-right text-2xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {getBlock(block.type)?.label ?? block.type}
              <span className="text-muted-foreground"> · {sectionLabel(section)}</span>
            </span>
            <IconButton
              label={`Drop ${getBlock(block.type)?.label ?? block.type} from the selection`}
              onClick={() => props.onSelect(block.id, { toggle: true })}
            >
              <X className="h-3 w-3" />
            </IconButton>
          </li>
        ))}
      </ol>
      <section className="border-b border-border py-3">
        <p className="t-label mb-2">Show and lock</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={button}
            onClick={() =>
              props.onApplyBlockStyle(
                ids,
                { visible: allHidden },
                `${allHidden ? "Showing" : "Hid"} ${count}`,
              )
            }
          >
            {allHidden ? (
              <Eye className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <EyeOff className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {allHidden ? "Show all" : "Hide all"}
          </button>
          <button
            type="button"
            className={button}
            onClick={() =>
              props.onApplyBlockStyle(
                ids,
                { locked: !allLocked },
                `${allLocked ? "Unlocked" : "Locked"} ${count}`,
              )
            }
          >
            {allLocked ? (
              <LockOpen className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <Lock className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {allLocked ? "Unlock all" : "Lock all"}
          </button>
        </div>
      </section>
      <section className="border-b border-border py-3">
        <p className="t-label mb-2">Look</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={button}
            onClick={() => props.onApplyBlockStyle(ids, firstStyle)}
          >
            Match the first block&rsquo;s style
          </button>
          <button
            type="button"
            className={button}
            disabled={!copied}
            title={copied ? undefined : "Copy a block's style first"}
            onClick={() => copied && props.onApplyBlockStyle(ids, copied)}
          >
            Paste copied style
          </button>
        </div>
      </section>
      <section className="border-b border-border py-3">
        <p className="t-label mb-1">Layout</p>
        <p className="mb-2 text-2xs leading-snug text-muted-foreground">
          Lines the others up against block 1. Blocks in the way move down.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ARRANGEMENTS.map(({ how, label, oneArea: needsOneArea }) => (
            <button
              key={how}
              type="button"
              className={button}
              disabled={needsOneArea && !oneArea}
              title={needsOneArea && !oneArea ? "Pick blocks from one area" : undefined}
              onClick={() => props.onArrangeBlocks(ids, how)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-1.5 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="justify-center"
          onClick={() => props.onGroupIntoArea(ids)}
        >
          <FolderInput className="h-3 w-3" /> Group into a new area
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-center text-destructive hover:text-destructive"
          onClick={() => props.onRemoveBlocks(ids)}
        >
          <Trash2 className="h-3 w-3" /> Remove {count}
        </Button>
      </div>
    </div>
  );
}
