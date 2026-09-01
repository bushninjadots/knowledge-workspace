// ── Studio Inspector ─────────────────────────────────────────────────────────
// Right panel that adapts to what's selected:
//   • Nothing / Page → Theme, Colors, Typography, Shape
//   • Section → Layout, Gap, Background, Actions
//   • Block → Block name, Appearance (width), Actions
//
// Never exposes raw config keys, CSS variables, or JSON to the user.

import { useCallback, useState } from "react";
import { EyeOff, ArrowUp, ArrowDown, Trash2, Copy } from "lucide-react";
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
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onRemoveBlock: (blockId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onDuplicateSection: (sectionId: string) => void;
  onUpdateBlockConfig?: (blockId: string, config: Record<string, unknown>) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<LayoutBlockInstance>) => void;
  onUpdateSectionLayout?: (sectionId: string, layout: SectionLayoutType) => void;
  onUpdateThemeOverrides?: (overrides: ThemeTokens | null) => void;
  currentOverrides?: ThemeTokens | null;
  themes?: ThemeCatalogEntry[];
  currentThemeId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onRefetch: () => void;
}

// ── Main Inspector ───────────────────────────────────────────────────────────

export function StudioInspector({
  selectionType,
  selectedBlock,
  selectedBlockDef,
  selectedSection,
  pageData,
  onMoveBlock,
  onRemoveBlock,
  onRemoveSection,
  onMoveSection,
  onDuplicateSection,
  onUpdateBlockConfig,
  onUpdateBlock,
  onUpdateSectionLayout,
  onUpdateThemeOverrides,
  currentOverrides,
  themes = [],
  currentThemeId,
  onSelectBlock,
}: StudioInspectorProps) {
  return (
    <div className="flex h-full flex-col">
      {/* ── Context panel ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {selectionType === "block" && selectedBlock ? (
          <BlockInspector
            block={selectedBlock}
            def={selectedBlockDef}
            sectionLayout={selectedSection?.layout}
            onUpdateConfig={onUpdateBlockConfig}
            onUpdateBlock={onUpdateBlock}
            onRemove={onRemoveBlock}
            onMove={onMoveBlock}
          />
        ) : selectionType === "section" && selectedSection ? (
          <SectionInspector
            section={selectedSection}
            onUpdateLayout={onUpdateSectionLayout}
            onRemove={onRemoveSection}
            onMove={onMoveSection}
            onDuplicate={onDuplicateSection}
            onSelectBlock={onSelectBlock}
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
    </div>
  );
}

// ── Block Inspector ──────────────────────────────────────────────────────────

function BlockInspector({
  block,
  def,
  sectionLayout,
  onUpdateConfig,
  onUpdateBlock,
  onRemove,
  onMove,
}: {
  block: LayoutBlockInstance;
  def: BlockDefinition | undefined;
  sectionLayout?: SectionLayoutType;
  onUpdateConfig?: (blockId: string, config: Record<string, unknown>) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<LayoutBlockInstance>) => void;
  onRemove: (blockId: string) => void;
  onMove: (blockId: string, direction: "up" | "down") => void;
}) {
  const currentWidth = (block.config?.width as string) ?? "full";

  const updateField = useCallback(
    (key: string, value: unknown) => {
      if (!onUpdateConfig) return;
      onUpdateConfig(block.id, { ...block.config, [key]: value });
    },
    [block.id, block.config, onUpdateConfig],
  );

  const setWidth = useCallback(
    (w: string) => {
      updateField("width", w);
    },
    [updateField],
  );

  const fields = def?.fields ?? [];

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

      {/* Content fields from block schema */}
      {fields.length > 0 && (
        <div>
          <SectionLabel>Content</SectionLabel>
          <div className="mt-1.5 space-y-3">
            {fields.map((field) => {
              const value = block.config?.[field.key];
              switch (field.type) {
                case "text":
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-[10px] text-muted-foreground">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={typeof value === "string" ? value : ""}
                        placeholder={field.placeholder}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  );
                case "textarea":
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-[10px] text-muted-foreground">
                        {field.label}
                      </label>
                      <textarea
                        value={typeof value === "string" ? value : ""}
                        placeholder={field.placeholder}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                  );
                case "toggle":
                  return (
                    <div key={field.key} className="flex items-center justify-between">
                      <label className="text-[10px] text-muted-foreground">{field.label}</label>
                      <button
                        type="button"
                        onClick={() => updateField(field.key, !value)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          value ? "bg-primary" : "bg-border"
                        }`}
                        role="switch"
                        aria-checked={!!value}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            value ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                case "select":
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-[10px] text-muted-foreground">
                        {field.label}
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {field.options?.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateField(field.key, opt.value)}
                            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                              String(value) === opt.value
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                case "image":
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-[10px] text-muted-foreground">
                        {field.label}
                      </label>
                      <input
                        type="url"
                        value={typeof value === "string" ? value : ""}
                        placeholder={field.placeholder ?? "https://..."}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {typeof value === "string" && value && (
                        <img
                          src={value}
                          alt=""
                          className="mt-2 h-16 w-full rounded-md object-cover border border-border"
                        />
                      )}
                    </div>
                  );
                case "color":
                  return (
                    <div key={field.key} className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">{field.label}</label>
                      <input
                        type="color"
                        value={typeof value === "string" ? value : "#000000"}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="h-6 w-6 cursor-pointer rounded border border-border/30"
                      />
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
      )}

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
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column placement — only shown in multi-column sections */}
      {sectionLayout && sectionLayout !== "full" && (
        <div>
          <SectionLabel>Placement</SectionLabel>
          <div className="mt-1.5 space-y-2">
            {/* Column */}
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">Column</label>
              <div className="flex gap-1">
                {["Auto", "1", "2", "3"]
                  .slice(0, sectionLayout === "three_column" ? 4 : 3)
                  .map((label) => {
                    const value = label === "Auto" ? -1 : parseInt(label) - 1;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          onUpdateBlock?.(block.id, { column: value === -1 ? undefined : value })
                        }
                        className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                          (block.column == null && value === -1) || block.column === value
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
              </div>
            </div>
            {/* Span */}
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">Span</label>
              <div className="flex gap-1">
                {["1", "2", "3"].slice(0, sectionLayout === "three_column" ? 3 : 2).map((label) => {
                  const value = parseInt(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        onUpdateBlock?.(block.id, { span: value === 1 ? undefined : value })
                      }
                      className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                        (block.span == null && value === 1) || block.span === value
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {value === 1 ? "1 col" : `${value} cols`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
  onDuplicate,
  onSelectBlock,
}: {
  section: LayoutSection;
  onUpdateLayout?: (sectionId: string, layout: SectionLayoutType) => void;
  onRemove: (sectionId: string) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onDuplicate: (sectionId: string) => void;
  onSelectBlock?: (blockId: string) => void;
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
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
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
              <button
                key={block.id}
                type="button"
                onClick={() => onSelectBlock?.(block.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-left transition-colors hover:bg-accent ${
                  block.visible === false ? "opacity-40 text-muted-foreground" : "text-foreground"
                }`}
              >
                <span className="truncate">{blockDef?.label ?? block.type}</span>
                {block.visible === false && <EyeOff className="h-2.5 w-2.5 shrink-0" />}
              </button>
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
            onClick={() => onDuplicate(section.id)}
            icon={<Copy className="h-3 w-3" />}
            label="Duplicate"
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

const FONT_OPTIONS = [
  { label: "Theme default", value: "" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "System", value: "system-ui, sans-serif" },
];

const COLOR_FIELDS: Array<{ label: string; key: string }> = [
  { label: "Page background", key: "background" },
  { label: "Card / surface", key: "card" },
  { label: "Text", key: "foreground" },
  { label: "Accent", key: "primary" },
  { label: "Border", key: "border" },
];

/** Resolve any CSS color (oklch, var(), hsl) to a #rrggbb value the native
 * color input can display. Returns null until the browser has painted. */
function resolveHex(value: string | undefined, fallbackVar: string): string {
  if (!value && typeof window === "undefined") return "#000000";
  const probe = document.createElement("span");
  probe.style.color = value && value.length > 0 ? value : `var(${fallbackVar})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = rgb.match(/-?[\d.]+/g);
  if (!m) return "#000000";
  const hex = m
    .slice(0, 3)
    .map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeTheme = themes.find((t) => t.id === currentThemeId) ?? themes[0];
  const baseTokens = (pageData?.theme ?? {}) as ThemeTokens;
  const tokens = { ...baseTokens, ...(currentOverrides ?? {}) } as ThemeTokens;

  const currentRadiusLg = parseInt(tokens.borders?.radius?.lg ?? "12px", 10) || 0;
  const currentSection = parseInt(tokens.spacing?.section ?? "48px", 10) || 48;

  /** Merge a partial token patch into the current overrides. */
  const patch = useCallback(
    (fn: (draft: ThemeTokens) => ThemeTokens) => {
      if (!onUpdateThemeOverrides) return;
      onUpdateThemeOverrides(fn({ ...(currentOverrides ?? {}) }));
    },
    [currentOverrides, onUpdateThemeOverrides],
  );

  const setRadius = useCallback(
    (size: number) => {
      patch((draft) => ({
        ...draft,
        borders: {
          ...(draft.borders ?? {}),
          radius: {
            ...(draft.borders?.radius ?? {}),
            sm: `${Math.max(0, Math.round(size * 0.33))}px`,
            md: `${Math.max(0, Math.round(size * 0.66))}px`,
            lg: `${size}px`,
            xl: `${Math.round(size * 1.33)}px`,
            "2xl": `${Math.round(size * 1.67)}px`,
          },
        },
      }));
    },
    [patch],
  );

  const setSpacing = useCallback(
    (size: number) => {
      patch((draft) => ({
        ...draft,
        spacing: {
          ...(draft.spacing ?? {}),
          section: `${size}px`,
          block: `${Math.round(size / 3)}px`,
        },
      }));
    },
    [patch],
  );

  const setColor = useCallback(
    (key: string, value: string | null) => {
      patch((draft) => {
        const colors = { ...(draft.colors ?? {}) };
        if (value === null) delete colors[key];
        else colors[key] = value;
        return { ...draft, colors };
      });
    },
    [patch],
  );

  const setFont = useCallback(
    (key: "headingFont" | "bodyFont" | "monoFont", value: string) => {
      patch((draft) => {
        const typography = { ...(draft.typography ?? {}) };
        if (!value) delete typography[key];
        else typography[key] = value;
        return { ...draft, typography };
      });
    },
    [patch],
  );

  const hasOverrides = !!currentOverrides && Object.keys(currentOverrides).length > 0;

  return (
    <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
      {/* Theme */}
      <div>
        <SectionLabel>Theme</SectionLabel>
        <p className="mt-1 text-sm font-medium text-foreground">{activeTheme?.name ?? "Default"}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Pick a theme in the left panel, then fine-tune it here.
        </p>
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
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <div className="flex items-center justify-between">
        <SectionLabel>Advanced</SectionLabel>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            showAdvanced ? "bg-primary" : "bg-border"
          }`}
          role="switch"
          aria-checked={showAdvanced}
          aria-label="Show advanced appearance options"
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
              showAdvanced ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {showAdvanced && (
        <>
          {/* Radius slider */}
          <div>
            <SectionLabel>
              Corner radius <span className="text-foreground">{currentRadiusLg}px</span>
            </SectionLabel>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={currentRadiusLg}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              aria-label="Corner radius"
              className="mt-2 w-full accent-primary cursor-pointer"
            />
            <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Sharp</span>
              <span>Rounded</span>
            </div>
          </div>

          {/* Section spacing */}
          <div>
            <SectionLabel>
              Section spacing <span className="text-foreground">{currentSection}px</span>
            </SectionLabel>
            <input
              type="range"
              min="16"
              max="120"
              step="4"
              value={currentSection}
              onChange={(e) => setSpacing(parseInt(e.target.value, 10))}
              aria-label="Section spacing"
              className="mt-2 w-full accent-primary cursor-pointer"
            />
            <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Compact</span>
              <span>Airy</span>
            </div>
          </div>

          {/* Colors */}
          <div>
            <SectionLabel>Colors</SectionLabel>
            <div className="mt-1.5 space-y-1">
              {COLOR_FIELDS.map(({ label, key }) => {
                const raw = tokens.colors?.[key];
                const overridden = !!currentOverrides?.colors?.[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                  >
                    <input
                      type="color"
                      value={resolveHex(raw, `--${key}`)}
                      onChange={(e) => setColor(key, e.target.value)}
                      aria-label={label}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                    />
                    <span className="flex-1 truncate text-[10px] text-foreground">{label}</span>
                    {overridden && (
                      <button
                        type="button"
                        onClick={() => setColor(key, null)}
                        className="text-[9px] text-muted-foreground hover:text-foreground"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Typography */}
          <div>
            <SectionLabel>Typography</SectionLabel>
            <div className="mt-1.5 space-y-2">
              {(
                [
                  ["Headings", "headingFont"],
                  ["Body", "bodyFont"],
                  ["Mono", "monoFont"],
                ] as Array<[string, "headingFont" | "bodyFont" | "monoFont"]>
              ).map(([label, key]) => (
                <div key={key}>
                  <label className="mb-1 block text-[10px] text-muted-foreground" htmlFor={key}>
                    {label}
                  </label>
                  <select
                    id={key}
                    value={tokens.typography?.[key] ?? ""}
                    onChange={(e) => setFont(key, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {hasOverrides && (
            <button
              type="button"
              onClick={() => onUpdateThemeOverrides?.(null)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset all customizations
            </button>
          )}
        </>
      )}
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
      className={`flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
