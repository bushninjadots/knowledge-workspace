// ── Studio Sidebar ───────────────────────────────────────────────────────────
// Left panel tabs: Pages (block library), Templates (browse/apply/fork),
// Themes (catalog/apply), Settings.

import { useState } from "react";
import {
  Search,
  Plus,
  LayoutTemplate,
  Palette,
  FileText,
  TrendingUp,
  GitFork,
  Download,
  Square,
  RectangleHorizontal,
  Columns2,
  Columns3,
  Layout,
  Rows2,
} from "lucide-react";
import { getBlocksForPageType, blockPageScope } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { StudioPage } from "./studio";
import type { ThemeCatalogEntry } from "@/hooks/use-theme-catalog";
import type { LayoutSection, TemplateData } from "@/lib/page-blocks";
import { SECTION_PRESETS, type SectionPreset } from "./section-presets";

type SidebarTab = "pages" | "templates" | "themes";

const TABS: { key: SidebarTab; icon: React.FC<{ className?: string }>; label: string }[] = [
  { key: "pages", icon: FileText, label: "Build" },
  { key: "templates", icon: LayoutTemplate, label: "Templates" },
  { key: "themes", icon: Palette, label: "Themes" },
];

const PRESET_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Square,
  RectangleHorizontal,
  Columns2,
  Columns3,
  Layout,
  Rows2,
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  media: "Media",
  project: "Project",
  people: "People",
  community: "Community",
  utility: "Utility",
};

const TEMPLATE_CATEGORIES = [
  "Featured",
  "Popular",
  "Newest",
  "Developer",
  "Portfolio",
  "Documentation",
  "Startup",
  "Creative",
  "Minimal",
];

interface StudioSidebarProps {
  activePage: StudioPage | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddBlock: (blockType: string) => void;
  onAddSection: (preset: SectionPreset) => void;
  onApplyTemplate: (templateId: string) => void;
  onForkTemplate: (templateId: string) => void;
  onApplyTheme: (themeId: string) => void;
  onSaveAsTemplate: (name: string, opts?: { description?: string; category?: string }) => void;
  themeNames: Map<string, string>;
  onReseed: () => void;
  templates: TemplateData[];
  templatesLoading?: boolean;
  templatesError?: boolean;
  themes: ThemeCatalogEntry[];
  currentThemeId: string | null;
}

export function StudioSidebar({
  activePage,
  activeTab,
  onTabChange,
  onAddBlock,
  onAddSection,
  onApplyTemplate,
  onForkTemplate,
  onApplyTheme,
  themeNames,
  onSaveAsTemplate,
  onReseed,
  templates,
  templatesLoading,
  templatesError,
  themes,
  currentThemeId,
}: StudioSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <nav className="shrink-0 border-b border-border px-3 pt-3" aria-label="Studio navigation">
        <div className="flex flex-col gap-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "pages" && (
          <BuildPanel
            pageType={activePage?.type ?? "project"}
            onAddBlock={onAddBlock}
            onAddSection={onAddSection}
          />
        )}
        {activeTab === "templates" && (
          <TemplatesPanel
            templates={templates}
            templatesLoading={templatesLoading}
            templatesError={templatesError}
            onApply={onApplyTemplate}
            onFork={onForkTemplate}
            onSaveAsTemplate={onSaveAsTemplate}
            onReseed={onReseed}
            themeNames={themeNames}
          />
        )}
        {activeTab === "themes" && (
          <ThemesPanel themes={themes} currentThemeId={currentThemeId} onApply={onApplyTheme} />
        )}
        {activeTab === "settings" && <SettingsPanel activePage={activePage} />}
      </div>

      {/* ── Page info ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <p className="text-[10px] text-muted-foreground/60">
          {activePage
            ? `Editing: ${activePage.type === "profile" ? "Profile" : "Project"}`
            : "No page selected"}
        </p>
      </div>
    </div>
  );
}

// ── Build Panel ──────────────────────────────────────────────────────────────
// Section presets at the top, then the block library grouped by category.

function BuildPanel({
  pageType,
  onAddBlock,
  onAddSection,
}: {
  pageType: "profile" | "project";
  onAddBlock: (type: string) => void;
  onAddSection: (preset: SectionPreset) => void;
}) {
  const [search, setSearch] = useState("");
  const blocks = getBlocksForPageType(pageType);
  const sectionPresets = SECTION_PRESETS.filter((preset) =>
    (preset.starterBlocks ?? []).every(
      (starter) =>
        blockPageScope(starter.type) === "both" || blockPageScope(starter.type) === pageType,
    ),
  );

  const filtered = search
    ? blocks.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.type.toLowerCase().includes(search.toLowerCase()),
      )
    : blocks;

  const grouped = new Map<string, BlockDefinition[]>();
  for (const b of filtered) {
    const list = grouped.get(b.category) ?? [];
    list.push(b);
    grouped.set(b.category, list);
  }

  return (
    <div className="px-3 py-4">
      {/* ── Section presets ──────────────────────────────────────────────── */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Add Section
      </p>
      <div className="mb-5 grid grid-cols-2 gap-1.5">
        {sectionPresets.map((preset) => {
          const Icon = PRESET_ICONS[preset.icon] ?? Square;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onAddSection(preset)}
              className="group flex flex-col items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-2.5 text-center transition-colors hover:border-border hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Block library ────────────────────────────────────────────────── */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Add Block
      </p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full rounded-md border border-border bg-muted py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {[...grouped.entries()].map(([category, items]) => (
        <div key={category} className="mb-4 last:mb-0">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.map((block) => (
              <button
                key={block.type}
                type="button"
                onClick={() => onAddBlock(block.type)}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-current">
                    {block.label}
                  </span>
                  {block.description && (
                    <span className="block truncate text-[10px] text-muted-foreground/60">
                      {block.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="py-4 text-center text-[11px] text-muted-foreground">No blocks found.</p>
      )}
    </div>
  );
}

// ── Templates Panel ──────────────────────────────────────────────────────────

function TemplatesPanel({
  templates,
  onApply,
  onFork,
  onSaveAsTemplate,
  onReseed,
  themeNames,
  templatesLoading,
  templatesError,
}: {
  templates: TemplateData[];
  templatesLoading?: boolean;
  templatesError?: boolean;
  onApply: (id: string) => void;
  onFork: (id: string) => void;
  onSaveAsTemplate: (name: string, opts?: { description?: string; category?: string }) => void;
  themeNames: Map<string, string>;
  onReseed: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Popular");
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Community Layouts
        </p>
        <button
          type="button"
          onClick={() => setShowSave(!showSave)}
          className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10"
        >
          + Save
        </button>
        {templates.length === 0 && (
          <button
            type="button"
            onClick={onReseed}
            className="rounded px-1.5 py-0.5 text-[10px] text-amber-500 hover:text-amber-400"
          >
            Re-seed
          </button>
        )}
      </div>

      {showSave && (
        <div className="mb-3 space-y-2 rounded-md border border-border bg-muted/50 p-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name..."
            className="w-full rounded border border-border bg-muted px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => {
              onSaveAsTemplate(saveName);
              setSaveName("");
              setShowSave(false);
            }}
            disabled={!saveName.trim()}
            className="w-full rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            Save current layout as template
          </button>
        </div>
      )}

      {/* Loading / Error states */}
      {templatesLoading && (
        <div className="mb-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/40 p-2.5 animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-muted mb-1.5" />
              <div className="h-2 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}
      {templatesError && (
        <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-[11px] text-red-400">Could not load templates.</p>
          <button
            type="button"
            onClick={onReseed}
            className="mt-1 text-[10px] text-primary hover:underline"
          >
            Try re-seeding
          </button>
        </div>
      )}

      {/* Category chips */}
      <div className="mb-3 flex flex-wrap gap-1">
        {TEMPLATE_CATEGORIES.slice(0, 6).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
              category === cat
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search layouts..."
          className="w-full rounded-md border border-border bg-muted py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="space-y-2">
        {filtered.slice(0, 15).map((t) => (
          <div
            key={t.id}
            className="group rounded-lg border border-border bg-muted/40 p-2.5 transition-colors hover:border-border"
          >
            {/* Mini block preview — visual thumbnail of template structure */}
            <TemplatePreviewCard template={t} themeNames={themeNames} />
            <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {t.creatorHandle ? `by @${t.creatorHandle}` : "Community template"}
              {t.themeId && themeNames.get(t.themeId) && (
                <span className="ml-1 text-[9px] text-muted-foreground/40">
                  · {themeNames.get(t.themeId)}
                </span>
              )}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" /> {t.usageCount}
              </span>
              <span className="flex items-center gap-0.5">
                <GitFork className="h-2.5 w-2.5" /> {t.forkCount}
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => onApply(t.id)}
                className="flex-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
              >
                <Download className="mr-1 inline h-2.5 w-2.5" />
                Use
              </button>
              <button
                type="button"
                onClick={() => onFork(t.id)}
                className="flex-1 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <GitFork className="mr-1 inline h-2.5 w-2.5" />
                Fork
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="py-4 text-center text-[11px] text-muted-foreground">No templates found.</p>
        )}
      </div>
    </div>
  );
}

// ── Themes Panel ─────────────────────────────────────────────────────────────

function ThemesPanel({
  themes,
  currentThemeId,
  onApply,
}: {
  themes: ThemeCatalogEntry[];
  currentThemeId: string | null;
  onApply: (themeId: string) => void;
}) {
  return (
    <div className="px-3 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Themes
      </p>

      <div className="space-y-1.5">
        {/* Default / Reset */}
        <button
          type="button"
          onClick={() => onApply("00000000-0000-0000-0000-000000000001")}
          className={`w-full rounded-md px-2 py-2 text-left text-xs transition-colors ${
            currentThemeId === "00000000-0000-0000-0000-000000000001" || !currentThemeId
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded border border-border"
              style={{ background: "var(--background)" }}
            />
            Tethyr Default
          </span>
        </button>

        {themes
          .filter((t) => t.id !== "00000000-0000-0000-0000-000000000001")
          .map((theme) => {
            const isActive = currentThemeId === theme.id;
            const colors = theme.previewVars;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onApply(theme.id)}
                className={`w-full rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Mini preview swatch */}
                  <div className="flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded border border-border">
                    <div
                      className="w-1/2"
                      style={{ background: colors["--foreground"] ?? "#fff" }}
                    />
                    <div
                      className="w-1/2"
                      style={{ background: colors["--primary"] ?? "#6366f1" }}
                    />
                  </div>
                  <span className="truncate">{theme.name}</span>
                  {isActive && <span className="ml-auto text-[10px] text-primary">Active</span>}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────────────────────

// ── Template Preview Card ──────────────────────────────────────────────────
// Shows a compact visual preview of a template using miniature block indicators.

const BLOCK_PREVIEW_COLORS: Record<string, string> = {
  "text-block": "#94a3b8",
  "heading-block": "#f8fafc",
  "markdown-block": "#94a3b8",
  "divider-block": "#475569",
  "project-hero": "#6366f1",
  "project-about": "#94a3b8",
  "project-status": "#10b981",
  "project-team": "#f59e0b",
  "project-milestones": "#8b5cf6",
  "project-needs": "#ef4444",
  "project-roles": "#ec4899",
  "project-discussions": "#06b6d4",
  "project-activity": "#84cc16",
  "project-files": "#64748b",
  "project-repos": "#0ea5e9",
  "project-sessions": "#14b8a6",
  "project-evidence": "#a855f7",
  "project-credits": "#f97316",
  "project-timeline": "#eab308",
  "profile-header": "#6366f1",
  "profile-direction": "#10b981",
  "profile-bio": "#94a3b8",
  "profile-skills": "#8b5cf6",
  "profile-experience": "#f59e0b",
  "profile-tools": "#64748b",
  "profile-projects": "#ec4899",
  "profile-links": "#06b6d4",
  "profile-achievements": "#f97316",
  "profile-gallery": "#84cc16",
};

function TemplatePreviewCard({
  template,
  themeNames,
}: {
  template: TemplateData;
  themeNames: Map<string, string>;
}) {
  const sections = template.sections ?? [];
  const allBlocks = sections.flatMap((s: LayoutSection) => s.blocks ?? []).slice(0, 10);
  const sectionCount = sections.length;
  const totalBlocks = sections.reduce(
    (sum: number, s: LayoutSection) => sum + (s.blocks?.length ?? 0),
    0,
  );
  const themeName = template.themeId ? themeNames.get(template.themeId) : null;

  return (
    <div className="mb-2 overflow-hidden rounded-md border border-border bg-muted">
      {/* Mini blocks visualization */}
      <div className="p-1.5 space-y-1">
        {allBlocks.slice(0, 5).map((block, i: number) => {
          const color = BLOCK_PREVIEW_COLORS[block.type] ?? "#64748b";
          const isLong = block.type.includes("hero") || block.type.includes("header");
          return (
            <div
              key={i}
              className="rounded-sm transition-all"
              style={{
                height: isLong ? "6px" : "4px",
                width: isLong ? "100%" : `${60 + ((i * 7 + 3) % 40)}%`,
                backgroundColor: color,
                opacity: 0.6,
              }}
            />
          );
        })}
        {allBlocks.length > 5 && (
          <div className="flex gap-1">
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Bottom info strip */}
      <div className="flex items-center justify-between bg-surface-elevated/30 px-1.5 py-1">
        <span className="text-[8px] text-muted-foreground/50">
          {sectionCount}s · {totalBlocks}b
        </span>
        {themeName && (
          <span className="rounded-sm bg-primary/10 px-1 text-[7px] text-primary/60">
            {themeName}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ activePage }: { activePage: StudioPage | null }) {
  return (
    <div className="px-3 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Page Settings
      </p>
      {activePage ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">Type</p>
            <p className="text-xs text-foreground capitalize">{activePage.type}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">Title</p>
            <p className="text-xs text-foreground">{activePage.title}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">ID</p>
            <p className="text-[10px] text-muted-foreground break-all font-mono">{activePage.id}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No page selected.</p>
      )}
    </div>
  );
}
