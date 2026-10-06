// Studio editor sheet for screens below lg: arrange, add, style, block.
// Split out of g-studio-surface.tsx.
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  LayoutTemplate,
  Settings2,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import { cn } from "@/lib/utils";
import { sectionLabel } from "@/lib/studio-grid";
import { IconButton, WidthStepper } from "./studio-controls";
import { GStyleSections } from "./g-customize-panel";
import { BlockIcon } from "./block-icon";
import type { GStudioSurfaceProps } from "./g-studio-surface";
import {
  BLOCK_CATEGORY_ORDER,
  BLOCK_CATEGORY_LABELS,
  GBlockInspector,
  dedupeSharedReadmeBlocks,
} from "./studio-rail";

const MOBILE_SHEET_TABS: Array<["arrange" | "add" | "feel" | "block", string]> = [
  ["arrange", "Arrange"],
  ["add", "Add"],
  ["feel", "Style"],
  ["block", "Block"],
];

export function GMobileEditSheet(props: GStudioSurfaceProps) {
  const [tab, setTab] = useState<"arrange" | "add" | "feel" | "block">("arrange");
  const [open, setOpen] = useState(false);
  const selectedBlock = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.id === props.selectedBlockId);
  // Below lg there is no side rail, so a tapped block opens its settings
  // here and scrolls up into the half of the screen the sheet leaves free.
  useEffect(() => {
    if (!props.selectedBlockId) return;
    setOpen(true);
    setTab("block");
    const id = props.selectedBlockId;
    window.requestAnimationFrame(() =>
      document
        .querySelector(`[data-block-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [props.selectedBlockId]);
  const [targetArea, setTargetArea] = useState<string | undefined>(props.layout.sections[0]?.id);
  const usedBlockTypes = new Set(props.layout.sections.flatMap((s) => s.blocks.map((b) => b.type)));
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Inside the builder, not the viewport, so on tablets it doesn't spread
        // over the app sidebar; phones keep clear of the bottom nav.
        className="absolute inset-x-3 bottom-20 z-40 flex h-11 md:bottom-4 items-center justify-center gap-1.5 rounded-md border border-border bg-[var(--surface-elevated)] text-sm font-medium text-foreground shadow-panel"
      >
        <Settings2 className="h-4 w-4" aria-hidden /> Edit Studio
      </button>
    );
  return (
    <section
      className="absolute inset-x-0 bottom-0 z-50 flex max-h-[52vh] flex-col border-t border-border bg-[var(--surface-elevated)] shadow-panel"
      aria-label="Mobile Studio editor"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            role="status"
            className={cn(
              "text-xs leading-tight",
              props.saving || props.dirty || props.hasUnpublishedChanges
                ? "text-foreground"
                : "text-trust",
            )}
          >
            {props.saving
              ? "Saving…"
              : props.dirty
                ? "Unsaved changes"
                : props.hasUnpublishedChanges
                  ? "Ready to publish"
                  : props.published
                    ? `Live · v${props.publishedVersion ?? 1}`
                    : "Draft"}
          </span>
        </div>
        <Button
          variant={props.dirty ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-2xs pointer-coarse:h-10 pointer-coarse:px-3"
          busy={props.saving}
          disabled={!props.dirty || props.saving}
          onClick={props.onSave}
        >
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button
          variant={props.hasUnpublishedChanges ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-2xs pointer-coarse:h-10 pointer-coarse:px-3"
          busy={props.saving}
          disabled={!props.hasUnpublishedChanges || props.saving}
          onClick={props.onPublish}
        >
          <Upload className="h-3 w-3" /> Publish
        </Button>
        <IconButton label="Close mobile editor" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div
        role="tablist"
        aria-label="Studio editor"
        className="flex items-center gap-1 border-b border-border px-3 py-1.5"
      >
        {MOBILE_SHEET_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-10 rounded-sm px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
              tab === value && "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {tab === "arrange" && (
          <>
            <p className="mb-2 text-2xs leading-snug text-muted-foreground">
              Move, hide and remove blocks here. Widths apply to the wide layout — on a phone the
              public Studio always stacks in this order.
            </p>
            {props.layout.sections.map((section, sectionIndex) => (
              <div key={section.id} className="mb-3">
                <div className="flex items-center gap-1">
                  <span className="t-label flex-1 truncate">{sectionLabel(section)}</span>
                  <IconButton
                    label="Move area up"
                    disabled={sectionIndex === 0}
                    onClick={() => props.onMoveSection(section.id, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Move area down"
                    disabled={sectionIndex === props.layout.sections.length - 1}
                    onClick={() => props.onMoveSection(section.id, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={section.visible === false ? "Show area" : "Hide area"}
                    onClick={() => props.onToggleSection(section.id)}
                  >
                    {section.visible === false ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </IconButton>
                </div>
                {section.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-1 border-y border-border py-2"
                  >
                    <button
                      type="button"
                      onClick={() => props.onSelect(block.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate rounded-sm px-1 py-1.5 text-left text-xs",
                        props.selectedBlockId === block.id
                          ? "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]"
                          : "text-foreground",
                      )}
                    >
                      {getBlock(block.type)?.label ?? block.type}
                    </button>
                    <WidthStepper block={block} section={section} onResize={props.onResizeBlock} />
                    <IconButton label="Move block up" onClick={() => props.onMove(block.id, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Move block down" onClick={() => props.onMove(block.id, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={block.visible === false ? "Show block" : "Hide block"}
                      onClick={() =>
                        props.onBlockAction(block.id, { visible: block.visible === false })
                      }
                    >
                      {block.visible === false ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                    <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        {tab === "add" && (
          <div className="space-y-3">
            <label className="block">
              <span className="t-label">Add to</span>
              {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                aria-label="Target area"
                value={targetArea}
                onChange={(event) => setTargetArea(event.target.value || undefined)}
                className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1.5 text-xs outline-none"
              >
                {props.layout.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {sectionLabel(section)}
                  </option>
                ))}
              </select>
            </label>
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const defs = getAllBlocks().filter(
                (def) =>
                  def.category === category &&
                  def.ownerContext !== "project" &&
                  dedupeSharedReadmeBlocks(def.type, usedBlockTypes),
              );
              if (defs.length === 0) return null;
              return (
                <div key={category}>
                  <p className="t-label mb-1">{BLOCK_CATEGORY_LABELS[category]}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        type="button"
                        onClick={() => props.onAdd(def.type, targetArea)}
                        className="flex min-h-11 items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-left text-xs hover:border-[var(--user-accent-border)]"
                      >
                        <BlockIcon name={def.icon} size="sm" />
                        <span className="min-w-0 leading-tight">{def.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "block" && (
          <GBlockInspector
            {...props}
            block={selectedBlock}
            onClose={() => {
              props.onSelect(null);
              setTab("arrange");
            }}
          />
        )}
        {tab === "feel" && (
          <div>
            {props.onOpenTemplates && (
              <button
                type="button"
                onClick={props.onOpenTemplates}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-2xs text-foreground outline-none hover:border-[var(--user-accent-border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
              >
                <LayoutTemplate className="h-3 w-3" aria-hidden />
                Browse templates
              </button>
            )}
            {/* The same grouped settings as the desktop rail's Style tab. */}
            <GStyleSections
              config={props.config}
              layout={props.layout}
              onChange={props.onCustomizeChange}
              themeId={props.themeId}
              onThemeChange={props.onThemeChange}
              cardBorders={props.cardBorders}
              cardBorderColor={props.cardBorderColor}
              onCardBordersChange={props.onCardBordersChange}
              onCardBorderColorChange={props.onCardBorderColorChange}
              onToggleSection={props.onToggleSection}
              onBlockAction={props.onBlockAction}
              onSelect={props.onSelect}
              selectedBlockId={props.selectedBlockId}
              onOpenAppearance={props.onOpenAppearance}
            />
          </div>
        )}
      </div>
    </section>
  );
}
