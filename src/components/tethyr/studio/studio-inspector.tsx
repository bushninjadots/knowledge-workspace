// ── Studio Inspector ─────────────────────────────────────────────────────────
// Right panel that adapts to what's selected:
//   • Nothing / Page → Theme, Colors, Typography, Shape
//   • Section → Layout, Gap, Background, Actions
//   • Block → Block name, Appearance (width), Actions
//
// Never exposes raw config keys, CSS variables, or JSON to the user.

import { useCallback } from "react";
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Send,
  Globe,
  Copy,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type {
  LayoutBlockInstance,
  PageData,
  LayoutSection,
  SectionLayoutType,
  ThemeTokens,
} from "@/lib/page-blocks";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { ThemeCatalogEntry } from "@/hooks/use-theme-catalog";
import type { SelectionType } from "./studio";
import { getBlock } from "@/lib/block-registry";

// ── Props ────────────────────────────────────────────────────────────────────

interface StudioInspectorProps {
  selectionType: SelectionType;
  selectedBlock: LayoutBlockInstance | null;
  selectedBlockDef: BlockDefinition | undefined;
  selectedSection: LayoutSection | null;
  pageData: PageData | undefined | null;
  isPublished: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onRemoveBlock: (blockId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onUpdateBlockConfig?: (blockId: string, config: Record<string, unknown>) => void;
  onUpdateSectionLayout?: (sectionId: string, layout: SectionLayoutType) => void;
  onUpdateThemeOverrides?: (overrides: ThemeTokens | null) => void;
  currentOverrides?: ThemeTokens | null;
  themes?: ThemeCatalogEntry[];
  currentThemeId?: string | null;
  onRefetch: () => void;
}

// ── Main Inspector ───────────────────────────────────────────────────────────

export function StudioInspector({
  selectionType,
  selectedBlock,
  selectedBlockDef,
  selectedSection,
  pageData,
  isPublished,
  onPublish,
  onUnpublish,
  onMoveBlock,
  onRemoveBlock,
  onRemoveSection,
  onMoveSection,
  onUpdateBlockConfig,
  onUpdateSectionLayout,
  onUpdateThemeOverrides,
  currentOverrides,
  themes = [],
  currentThemeId,
}: StudioInspectorProps) {
  return (
    <div className="flex h-full flex-col">
      {/* ── Context panel ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {selectionType === "block" && selectedBlock ? (
          <BlockInspector
            block={selectedBlock}
            def={selectedBlockDef}
            onUpdateConfig={onUpdateBlockConfig}
            onRemove={onRemoveBlock}
            onMove={onMoveBlock}
          />
        ) : selectionType === "section" && selectedSection ? (
          <SectionInspector
            section={selectedSection}
            onUpdateLayout={onUpdateSectionLayout}
            onRemove={onRemoveSection}
            onMove={onMoveSection}
          />
        ) : (
          <PageInspector
            pageData={pageData}
            themes={themes}
            currentThemeId={currentThemeId}
            currentOverrides={currentOverrides}
            onUpdateThemeOverrides={onUpdateThemeOverrides}
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

// ── Block Inspector ──────────────────────────────────────────────────────────

function BlockInspector({
  block,
  def,
  onUpdateConfig,
  onRemove,
  onMove,
}: {
  block: LayoutBlockInstance;
  def: BlockDefinition | undefined;
  onUpdateConfig?: (blockId: string, config: Record<string, unknown>) => void;
  onRemove: (blockId: string) => void;
  onMove: (blockId: string, direction: "up" | "down") => void;
}) {
  const currentWidth = (block.config?.width as string) ?? "full";

  const setWidth = useCallback(
    (w: string) => {
      if (!onUpdateConfig) return;
      onUpdateConfig(block.id, { ...block.config, width: w });
    },
    [block.id, block.config, onUpdateConfig],
  );

  return (
    <div className="space-y-5">
      {/* Block identity */}
      <div>
        <SectionLabel>Block</SectionLabel>
        <p className="mt-1 text-sm font-medium text-foreground">{def?.label ?? block.type}</p>
        {def?.description && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">{def.description}</p>
        )}
      </div>

      {/* Width */}
      <div>
        <SectionLabel>Width</SectionLabel>
        <div className="mt-1.5 flex gap-1">
          {["Full", "⅔", "½", "⅓", "Auto"].map((label) => {
            const value =
              label === "Full"
                ? "full"
                : label === "⅔"
                  ? "2/3"
                  : label === "½"
                    ? "1/2"
                    : label === "⅓"
                      ? "1/3"
                      : "auto";
            return (
              <button
                key={value}
                type="button"
                onClick={() => setWidth(value)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  currentWidth === value
                    ? "bg-primary/15 text-primary"
                    : "bg-surface/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div>
        <SectionLabel>Actions</SectionLabel>
        <div className="mt-1.5 flex gap-1">
          <ActionButton
            onClick={() => onMove(block.id, "up")}
            icon={<ArrowUp className="h-3 w-3" />}
            label="Move up"
          />
          <ActionButton
            onClick={() => onMove(block.id, "down")}
            icon={<ArrowDown className="h-3 w-3" />}
            label="Move down"
          />
          <ActionButton
            onClick={() => onRemove(block.id)}
            icon={<Trash2 className="h-3 w-3" />}
            label="Delete"
            destructive
          />
        </div>
      </div>
    </div>
  );
}

// ── Section Inspector ────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: Array<{ label: string; value: SectionLayoutType }> = [
  { label: "Full width", value: "full" },
  { label: "Two columns", value: "two_column" },
  { label: "Three columns", value: "three_column" },
  { label: "Sidebar left", value: "sidebar_left" },
  { label: "Sidebar right", value: "sidebar_right" },
  { label: "Feature", value: "feature" },
];

function SectionInspector({
  section,
  onUpdateLayout,
  onRemove,
  onMove,
}: {
  section: LayoutSection;
  onUpdateLayout?: (sectionId: string, layout: SectionLayoutType) => void;
  onRemove: (sectionId: string) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
}) {
  return (
    <div className="space-y-5">
      {/* Section identity */}
      <div>
        <SectionLabel>Section</SectionLabel>
        <p className="mt-1 text-sm font-medium text-foreground">
          {section.blocks.length} block{section.blocks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Layout */}
      <div>
        <SectionLabel>Layout</SectionLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdateLayout?.(section.id, opt.value)}
              className={`rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                section.layout === opt.value
                  ? "bg-primary/15 text-primary"
                  : "bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Block list */}
      <div>
        <SectionLabel>Blocks in section</SectionLabel>
        <div className="mt-1.5 space-y-0.5">
          {section.blocks.map((block) => {
            const blockDef = getBlock(block.type);
            return (
              <div
                key={block.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                  block.visible === false ? "opacity-40 text-muted-foreground" : "text-foreground"
                }`}
              >
                <span className="truncate">{blockDef?.label ?? block.type}</span>
                {block.visible === false && <EyeOff className="h-2.5 w-2.5 shrink-0" />}
              </div>
            );
          })}
          {section.blocks.length === 0 && (
            <p className="text-[10px] text-muted-foreground/50 py-2">No blocks yet</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div>
        <SectionLabel>Actions</SectionLabel>
        <div className="mt-1.5 flex gap-1">
          <ActionButton
            onClick={() => onMove(section.id, "up")}
            icon={<ArrowUp className="h-3 w-3" />}
            label="Move up"
          />
          <ActionButton
            onClick={() => onMove(section.id, "down")}
            icon={<ArrowDown className="h-3 w-3" />}
            label="Move down"
          />
          <ActionButton
            onClick={() => onRemove(section.id)}
            icon={<Trash2 className="h-3 w-3" />}
            label="Delete"
            destructive
          />
        </div>
      </div>
    </div>
  );
}

// ── Page Inspector ───────────────────────────────────────────────────────────

function PageInspector({
  pageData,
  themes,
  currentThemeId,
  currentOverrides,
  onUpdateThemeOverrides,
}: {
  pageData: PageData | undefined | null;
  themes: ThemeCatalogEntry[];
  currentThemeId?: string | null;
  currentOverrides?: ThemeTokens | null;
  onUpdateThemeOverrides?: (overrides: ThemeTokens | null) => void;
}) {
  const activeTheme = themes.find((t) => t.id === currentThemeId) ?? themes[0];
  const baseTokens = pageData?.theme ?? activeTheme?.previewVars ?? {};
  const tokens = currentOverrides
    ? ({ ...baseTokens, ...currentOverrides } as Record<string, string>)
    : (baseTokens as Record<string, string>);

  const getRadiusValue = (cssVar: string, fallback: string) => {
    const key = cssVar.replace("--", "");
    return tokens[key] ?? fallback;
  };

  const currentRadiusLg = parseInt(getRadiusValue("--radius-lg", "12px")) || 12;

  const setRadius = useCallback(
    (size: number) => {
      if (!onUpdateThemeOverrides) return;
      const existing = currentOverrides ?? {};
      const newOverrides: ThemeTokens = {
        ...existing,
        borders: {
          ...(existing.borders ?? {}),
          radius: {
            ...(existing.borders?.radius ?? {}),
            lg: `${size}px`,
            xl: `${Math.round(size * 1.33)}px`,
            "2xl": `${Math.round(size * 1.67)}px`,
          },
        },
      };
      onUpdateThemeOverrides(newOverrides);
    },
    [currentOverrides, onUpdateThemeOverrides],
  );

  return (
    <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
      {/* Theme */}
      <div>
        <SectionLabel>Theme</SectionLabel>
        <p className="mt-1 text-sm font-medium text-foreground">{activeTheme?.name ?? "Default"}</p>
      </div>

      {/* Shape presets */}
      <div>
        <SectionLabel>Shape</SectionLabel>
        <div className="mt-1.5 flex gap-1">
          {[
            { label: "Rounded", value: "rounded" as const },
            { label: "Angular", value: "angular" as const },
            { label: "Sharp", value: "sharp" as const },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                const sizes = { rounded: 12, angular: 4, sharp: 0 };
                setRadius(sizes[preset.value]);
              }}
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                (preset.value === "rounded" && currentRadiusLg >= 10) ||
                (preset.value === "angular" && currentRadiusLg > 2 && currentRadiusLg < 10) ||
                (preset.value === "sharp" && currentRadiusLg <= 2)
                  ? "bg-primary/15 text-primary"
                  : "bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Radius slider */}
      <div>
        <SectionLabel>
          Corner radius: <span className="text-foreground">{currentRadiusLg}px</span>
        </SectionLabel>
        <input
          type="range"
          min="0"
          max="24"
          value={currentRadiusLg}
          onChange={(e) => setRadius(parseInt(e.target.value))}
          className="mt-1.5 w-full h-1 accent-primary cursor-pointer"
        />
        <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground/50">
          <span>0px</span>
          <span>24px</span>
        </div>
      </div>

      {/* Colors */}
      <div>
        <SectionLabel>Colors</SectionLabel>
        <div className="mt-1.5 space-y-1.5">
          {[
            ["Background", "--background"],
            ["Surface", "--surface"],
            ["Foreground", "--foreground"],
            ["Primary", "--primary"],
            ["Border", "--border"],
          ].map(([label, cssVar]) => (
            <div key={cssVar} className="flex items-center gap-2">
              <div
                className="h-3.5 w-3.5 shrink-0 rounded border border-border/40"
                style={{ backgroundColor: `var(${cssVar})` }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <SectionLabel>Typography</SectionLabel>
        <div className="mt-1.5 space-y-1">
          {[
            ["Display", tokens["font-display"] ?? "var(--font-display)"],
            ["Body", tokens["font-sans"] ?? "var(--font-sans)"],
            ["Mono", tokens["font-mono"] ?? "var(--font-mono)"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="text-[9px] text-muted-foreground/40 font-mono truncate max-w-[120px]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI primitives ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
      {children}
    </p>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  destructive,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border border-border/30 bg-surface/30 px-2 py-1.5 text-[10px] font-medium transition-colors ${
        destructive
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-400"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
