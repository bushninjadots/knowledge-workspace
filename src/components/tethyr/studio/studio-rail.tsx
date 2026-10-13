// Studio editor side rail: Style, Add (block palette) and Block (inspector).
// Split out of g-studio-surface.tsx.
import { ChevronDown, ChevronUp, Copy, Settings2, Trash2, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { findSection, sectionLabel } from "@/lib/studio-grid";
import { ProfileMediaControls } from "./profile-media-controls";
import { HeaderLookControls } from "@/components/tethyr/profile/header-look-controls";
import { BlockFields } from "./block-fields";
import { AreaInspector } from "./area-inspector";
import { BlockIcon } from "./block-icon";
import { IconButton, WidthStepper } from "./studio-controls";
import { GCustomizePanel } from "./g-customize-panel";
import type { GStudioSurfaceProps } from "./g-studio-surface";
import { BlockFrameSection } from "./rail-block-style";
import { GBlockPalette } from "./rail-block-palette";
import { MultiBlockInspector } from "./rail-multi-inspector";

export type RailTab = "style" | "add" | "block" | "area";

const RAIL_TABS: Array<[RailTab, string]> = [
  ["style", "Style"],
  ["add", "Add"],
  ["block", "Block"],
  ["area", "Area"],
];

export function GStudioRail(
  props: GStudioSurfaceProps & {
    tab: RailTab;
    onTabChange: (tab: RailTab | null) => void;
    /** Blocks with nothing to show; visitors never see them. */
    emptyBlockIds?: ReadonlySet<string>;
  },
) {
  const { tab, onTabChange } = props;
  const editingArea = props.layout.sections.find((s) => s.id === props.editingAreaId);
  const block = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((item) => item.id === props.selectedBlockId);
  return (
    <aside
      aria-label="Studio panels"
      className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-[var(--surface-elevated)] lg:flex"
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <div role="tablist" aria-label="Studio panels" className="flex flex-1 gap-0.5">
          {RAIL_TABS.filter(([value]) => value !== "area" || !!editingArea).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`studio-rail-tab-${value}`}
                aria-selected={tab === value}
                aria-controls="studio-rail-panel"
                onClick={() => onTabChange(value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
                  tab === value
                    ? "bg-[var(--user-accent-subtle)] font-medium text-[var(--user-accent-text)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <IconButton label="Close panel" onClick={() => onTabChange(null)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <div
        role="tabpanel"
        id="studio-rail-panel"
        aria-labelledby={`studio-rail-tab-${tab}`}
        className={cn("min-h-0 flex-1", tab === "style" ? "flex flex-col" : "overflow-y-auto")}
      >
        {tab === "style" ? (
          <GCustomizePanel
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
            emptyBlockIds={props.emptyBlockIds}
            onEditArea={props.onEditArea}
            onCompleteProfile={props.onCompleteProfile}
            onOpenAppearance={props.onOpenAppearance}
            onOpenLayouts={props.onOpenTemplates}
          />
        ) : tab === "add" ? (
          <GBlockPalette {...props} />
        ) : tab === "area" && editingArea ? (
          <AreaInspector
            section={editingArea}
            onChange={(patch) => props.onSectionAppearanceChange(editingArea.id, patch)}
          />
        ) : props.selectedBlockIds.length > 1 ? (
          <MultiBlockInspector {...props} />
        ) : (
          <GBlockInspector {...props} block={block} onClose={() => props.onSelect(null)} />
        )}
      </div>
    </aside>
  );
}

export function GBlockInspector({
  block,
  onClose,
  ...props
}: GStudioSurfaceProps & { block?: LayoutBlockInstance; onClose: () => void }) {
  const def = block ? getBlock(block.type) : undefined;
  const { data: me, refresh: refreshMe } = useCurrentUser();
  if (!block || !def)
    return (
      <div className="p-4">
        <p className="t-label">Block inspector</p>
        <div className="mt-10 text-center">
          <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-3 text-xs text-muted-foreground">
            Select a block on the canvas to inspect it.
          </p>
        </div>
      </div>
    );
  return (
    <div className="p-3">
      <header className="flex items-start gap-2.5 border-b border-border pb-3">
        <BlockIcon name={def.icon} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{def.label}</h2>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">{def.description}</p>
        </div>
        <IconButton label="Deselect block (Esc)" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      {/* The header's photo and banner upload here, the same controls the
          project editor's inspector has, instead of only a URL box. */}
      {block.type === "profile-header" && me && (
        <div className="border-b border-border py-3">
          <ProfileMediaControls
            ownerId={props.userId}
            avatarUrl={me.avatarSigned}
            bannerUrl={me.bannerSigned}
            onSaved={() => void refreshMe()}
          />
        </div>
      )}
      {block.type === "profile-header" && me && <HeaderLookControls userId={props.userId} />}
      <BlockFields
        definition={def}
        config={block.config}
        onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
      />
      <BlockFrameSection block={block} {...props} />
      <div className="border-t border-border pt-3">
        <p className="t-label mb-2">Actions</p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, -1)}
          >
            <ChevronUp className="h-3 w-3" /> Move up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, 1)}
          >
            <ChevronDown className="h-3 w-3" /> Move down
          </Button>
          <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="mt-2 flex">
          <WidthStepper
            block={block}
            section={
              findSection(props.layout, block.id) ?? {
                id: "",
                position: 0,
                layout: "full",
                blocks: [],
              }
            }
            onResize={props.onResizeBlock}
          />
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="t-label mb-2">Area</p>
        {props.layout.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            disabled={section.id === findSection(props.layout, block.id)?.id}
            onClick={() => props.onMoveToSection(block.id, section.id)}
            className="flex w-full items-center justify-between px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-[var(--surface-sunken)] disabled:text-[var(--user-accent-text)]"
          >
            <span>{sectionLabel(section)}</span>
            {section.id === findSection(props.layout, block.id)?.id && (
              <span className="t-label">current</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
