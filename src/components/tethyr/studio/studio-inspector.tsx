// ── Studio Inspector ─────────────────────────────────────────────────────────
// Right panel: Content/Design/Layout/Theme tabs. Content tab shows block
// config with width controls. Design shows token display. Layout shows block
// order. Theme tab edits colors, radius, typography.

import { useState, useCallback } from "react";
import {
  Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Send, Globe,
} from "lucide-react";
import type { LayoutBlockInstance, PageData, ThemeTokens } from "@/lib/page-blocks";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { ThemeCatalogEntry } from "@/hooks/use-theme-catalog";

type InspectorTab = "content" | "design" | "layout" | "theme";

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
  onUpdateBlockConfig?: (blockId: string, config: Record<string, unknown>) => void;
  onUpdateTheme?: (themeId: string, tokens: ThemeTokens) => void;
  themes?: ThemeCatalogEntry[];
  currentThemeId?: string | null;
  onRefetch: () => void;
}

export function StudioInspector({
  selectedBlock, selectedBlockDef, pageData, isPublished,
  onPublish, onUnpublish,
  onSelectBlock, onMoveBlock, onRemoveBlock,
  onUpdateBlockConfig, onUpdateTheme,
  themes = [], currentThemeId,
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("content");

  const blocks = pageData?.layout?.sections.flatMap((s) => s.blocks) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* ── Inspector tabs ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/20 px-3 pt-3">
        <div className="flex gap-0.5 flex-wrap">
          {(["content", "design", "layout", "theme"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium capitalize transition-colors ${
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
        {!selectedBlock && activeTab !== "theme" ? (
          <EmptyState blocks={blocks} onSelectBlock={onSelectBlock} />
        ) : activeTab === "content" ? (
          <ContentTab
            block={selectedBlock!}
            def={selectedBlockDef}
            onUpdateConfig={onUpdateBlockConfig}
          />
        ) : activeTab === "design" ? (
          <DesignTab block={selectedBlock!} def={selectedBlockDef} />
        ) : activeTab === "layout" ? (
          <LayoutTab
            blocks={blocks}
            selectedBlockId={selectedBlock?.id ?? null}
            onSelectBlock={onSelectBlock}
            onMoveBlock={onMoveBlock}
            onRemoveBlock={onRemoveBlock}
          />
        ) : activeTab === "theme" ? (
          <ThemeEditorTab
            pageData={pageData}
            themes={themes}
            currentThemeId={currentThemeId}
            onUpdateTheme={onUpdateTheme}
          />
        ) : null}
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
        <p className="text-xs text-muted-foreground">No blocks on this page yet.</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">Add blocks from the left sidebar.</p>
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
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${b.visible === false ? "bg-muted-foreground/40" : "bg-primary/60"}`} />
          <span className="truncate">{b.type}</span>
        </button>
      ))}
    </div>
  );
}

// ── Content tab ─────────────────────────────────────────────────────────────

const WIDTH_PRESETS = [
  { label: "Full", value: "full", className: "w-full" },
  { label: "2/3", value: "2/3", className: "w-2/3" },
  { label: "1/2", value: "1/2", className: "w-1/2" },
  { label: "1/3", value: "1/3", className: "w-1/3" },
  { label: "Auto", value: "auto", className: "w-auto" },
];

function ContentTab({
  block, def, onUpdateConfig,
}: {
  block: LayoutBlockInstance;
  def: BlockDefinition | undefined;
  onUpdateConfig?: (blockId: string, config: Record<string, unknown>) => void;
}) {
  const currentWidth = (block.config?.width as string) ?? "full";

  const setWidth = useCallback((w: string) => {
    if (!onUpdateConfig) return;
    onUpdateConfig(block.id, { ...block.config, width: w });
  }, [block.id, block.config, onUpdateConfig]);

  const setConfigValue = useCallback((key: string, value: unknown) => {
    if (!onUpdateConfig) return;
    onUpdateConfig(block.id, { ...block.config, [key]: value });
  }, [block.id, block.config, onUpdateConfig]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Block</p>
        <p className="mt-1 text-xs font-medium text-foreground">{def?.label ?? block.type}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">{block.type}</p>
      </div>

      {/* Width control */}
      {onUpdateConfig && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Width</p>
          <div className="flex flex-wrap gap-1">
            {WIDTH_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setWidth(preset.value)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  currentWidth === preset.value
                    ? "bg-primary/15 text-primary font-medium"
                    : "bg-surface/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editable config */}
      {block.config && Object.keys(block.config).length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Config</p>
          <div className="space-y-2">
            {Object.entries(block.config)
              .filter(([k]) => k !== "width") // width is handled above
              .map(([key, value]) => (
              <div key={key}>
                <p className="text-[9px] text-muted-foreground/60 mb-0.5">{key}</p>
                {onUpdateConfig && typeof value === "string" ? (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setConfigValue(key, e.target.value)}
                    className="w-full rounded border border-border/30 bg-surface/40 px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : typeof value === "boolean" ? (
                  <button
                    type="button"
                    onClick={() => setConfigValue(key, !value)}
                    className={`rounded px-2 py-0.5 text-[10px] ${
                      value ? "bg-primary/15 text-primary" : "bg-surface/40 text-muted-foreground"
                    }`}
                  >
                    {value ? "Yes" : "No"}
                  </button>
                ) : (
                  <span className="text-[10px] text-foreground font-mono break-words">{
                    typeof value === "string" ? value : JSON.stringify(value)
                  }</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Visibility</p>
        <span className="inline-flex items-center gap-1 text-[11px]">
          {block.visible === false ? (
            <><EyeOff className="h-3 w-3 text-amber-500" /><span className="text-muted-foreground">Hidden</span></>
          ) : (
            <><Eye className="h-3 w-3 text-green-500" /><span className="text-muted-foreground">Visible</span></>
          )}
        </span>
      </div>
    </div>
  );
}

// ── Design tab ──────────────────────────────────────────────────────────────

function DesignTab({ block, def }: { block: LayoutBlockInstance; def: BlockDefinition | undefined }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Typography</p>
        <TokenDisplay label="Font family" value="var(--font-sans)" />
        <TokenDisplay label="Heading" value="var(--font-display)" />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Colors</p>
        <ColorSwatch label="Background" cssVar="--background" />
        <ColorSwatch label="Foreground" cssVar="--foreground" />
        <ColorSwatch label="Surface" cssVar="--surface" />
        <ColorSwatch label="Primary" cssVar="--primary" />
        <ColorSwatch label="Border" cssVar="--border" />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Borders</p>
        <RadiusDisplay label="lg" cssVar="--radius-lg" />
        <RadiusDisplay label="md" cssVar="--radius-md" />
        <RadiusDisplay label="sm" cssVar="--radius-sm" />
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
  if (blocks.length === 0) return <div className="py-4 text-center"><p className="text-xs text-muted-foreground">No blocks to arrange.</p></div>;
  return (
    <div className="space-y-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Block order</p>
      {blocks.map((block, idx) => {
        const isSelected = selectedBlockId === block.id;
        const isFirst = idx === 0;
        const isLast = idx === blocks.length - 1;
        const widthLabel = WIDTH_PRESETS.find((p) => p.value === (block.config?.width ?? "full"))?.label;
        const shape = block.config?.shape as string | undefined;
        return (
          <div
            key={block.id}
            className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
              isSelected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-surface-elevated/50"
            }`}
          >
            <span className="shrink-0 text-[10px] text-muted-foreground/40 w-4 text-center">{idx + 1}</span>
            <button type="button" onClick={() => onSelectBlock(block.id)} className="flex-1 truncate text-left text-[11px]">
              {block.type}
              {widthLabel && widthLabel !== "Full" && (
                <span className="ml-1 text-[9px] text-muted-foreground/50">({widthLabel})</span>
              )}
            </button>
            <div className="hidden gap-0.5 group-hover:flex">
              {!isFirst && <button type="button" onClick={() => onMoveBlock(block.id, "up")} className="rounded p-0.5 hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>}
              {!isLast && <button type="button" onClick={() => onMoveBlock(block.id, "down")} className="rounded p-0.5 hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>}
              <button type="button" onClick={() => onRemoveBlock(block.id)} className="rounded p-0.5 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Theme Editor Tab ────────────────────────────────────────────────────────

function ThemeEditorTab({
  pageData, themes, currentThemeId, onUpdateTheme,
}: {
  pageData: PageData | undefined | null;
  themes: ThemeCatalogEntry[];
  currentThemeId?: string | null;
  onUpdateTheme?: (themeId: string, tokens: ThemeTokens) => void;
}) {
  const activeTheme = themes.find((t) => t.id === currentThemeId) ?? themes[0];
  const tokens = pageData?.theme ?? activeTheme?.previewVars ?? {};

  // Extract current radius from tokens or use defaults
  const getRadiusValue = (cssVar: string, fallback: string) => {
    const key = cssVar.replace("--", "");
    return (tokens as Record<string, string>)[key] ?? fallback;
  };

  const currentRadiusLg = parseInt(getRadiusValue("--radius-lg", "12px")) || 12;

  const setRadius = useCallback((size: number) => {
    if (!onUpdateTheme || !currentThemeId) return;
    const newTokens = {
      ...(pageData?.theme ?? {}),
      borders: {
        ...(pageData?.theme?.borders ?? {}),
        radius: {
          ...(pageData?.theme?.borders?.radius ?? {}),
          lg: `${size}px`,
          xl: `${Math.round(size * 1.33)}px`,
          "2xl": `${Math.round(size * 1.67)}px`,
        },
      },
    };
    onUpdateTheme(currentThemeId, newTokens);
  }, [currentThemeId, pageData?.theme, onUpdateTheme]);

  const setShapePreset = useCallback((preset: "rounded" | "angular" | "sharp") => {
    const sizes = { rounded: 12, angular: 4, sharp: 0 };
    setRadius(sizes[preset]);
  }, [setRadius]);

  return (
    <div className="space-y-4">
      {/* Active theme name */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Active theme</p>
        <p className="mt-1 text-xs font-medium text-foreground">{activeTheme?.name ?? "Default"}</p>
      </div>

      {/* Shape presets */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Shape</p>
        <div className="flex gap-1">
          {[
            { label: "Rounded", value: "rounded" as const },
            { label: "Angular", value: "angular" as const },
            { label: "Sharp", value: "sharp" as const },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setShapePreset(preset.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] transition-colors ${
                (preset.value === "rounded" && currentRadiusLg >= 10) ||
                (preset.value === "angular" && currentRadiusLg > 2 && currentRadiusLg < 10) ||
                (preset.value === "sharp" && currentRadiusLg <= 2)
                  ? "bg-primary/15 text-primary font-medium"
                  : "bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`mx-auto mb-1 h-4 w-6 border border-current ${
                  preset.value === "rounded" ? "rounded-md" : preset.value === "angular" ? "rounded-sm" : ""
                }`}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Radius slider */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Corner radius: <span className="text-foreground">{currentRadiusLg}px</span>
        </p>
        <input
          type="range"
          min="0"
          max="24"
          value={currentRadiusLg}
          onChange={(e) => setRadius(parseInt(e.target.value))}
          className="w-full h-1 accent-primary cursor-pointer"
        />
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRadius(0)}
            className="rounded border border-border/30 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            0px
          </button>
          <button
            type="button"
            onClick={() => setRadius(8)}
            className="rounded border border-border/30 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            8px
          </button>
          <button
            type="button"
            onClick={() => setRadius(16)}
            className="rounded border border-border/30 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            16px
          </button>
          <button
            type="button"
            onClick={() => setRadius(24)}
            className="rounded border border-border/30 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            24px
          </button>
        </div>
      </div>

      {/* Preview box */}
      <div
        className="rounded-lg border border-border/40 p-3"
        style={{
          borderRadius: `var(--radius-lg)`,
          background: "var(--surface)",
          color: "var(--foreground)",
          borderColor: "var(--border)",
        }}
      >
        <div className="text-[10px] text-muted-foreground mb-1">Preview</div>
        <div className="h-1.5 w-12 rounded-full mb-2" style={{ background: "var(--primary)" }} />
        <div className="h-1.5 w-8 rounded-full" style={{ background: "var(--muted-foreground)", opacity: 0.3 }} />
      </div>

      {/* Color tokens */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Colors</p>
        <div className="space-y-1.5">
          {[
            ["Background", "--background"],
            ["Surface", "--surface"],
            ["Foreground", "--foreground"],
            ["Primary", "--primary"],
            ["Border", "--border"],
            ["Muted", "--muted-foreground"],
          ].map(([label, cssVar]) => (
            <div key={cssVar} className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 shrink-0 rounded border border-border/40" style={{ backgroundColor: `var(${cssVar})` }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono truncate max-w-[80px]">
                {(() => {
                  const key = cssVar.replace("--", "");
                  return (tokens as Record<string, string>)?.[key] ?? "auto";
                })()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Typography</p>
        <TokenDisplay label="Body" value={((tokens as Record<string, string>)?.["font-sans"]) ?? "var(--font-sans)"} />
        <TokenDisplay label="Display" value={((tokens as Record<string, string>)?.["font-display"]) ?? "var(--font-display)"} />
        <TokenDisplay label="Mono" value={((tokens as Record<string, string>)?.["font-mono"]) ?? "var(--font-mono)"} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ColorSwatch({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="h-3.5 w-3.5 shrink-0 rounded border border-border/40" style={{ backgroundColor: `var(${cssVar})` }} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">{cssVar}</span>
    </div>
  );
}

function RadiusDisplay({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="h-3.5 w-5 shrink-0 border border-border/40" style={{ borderRadius: `var(${cssVar})` }} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">{cssVar}</span>
    </div>
  );
}

function TokenDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground/40 font-mono max-w-[120px] truncate">{value}</span>
    </div>
  );
}