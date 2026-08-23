// ── Studio Sidebar ───────────────────────────────────────────────────────────
// Left panel tabs: Pages (block library), Templates (browse/apply/fork),
// Themes (catalog/apply), Settings.

import { useState } from "react";
import {
  Search, Plus, LayoutTemplate, Palette, Settings,
  FileText, TrendingUp, Clock, GitFork, Download,
} from "lucide-react";
import { getAllBlocks } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { StudioPage } from "./studio";
import type { ThemeCatalogEntry } from "@/hooks/use-theme-catalog";
import type { TemplateData } from "@/lib/page-blocks";

type SidebarTab = "pages" | "templates" | "themes" | "settings";

const TABS: { key: SidebarTab; icon: React.FC<{ className?: string }>; label: string }[] = [
  { key: "pages", icon: FileText, label: "Pages" },
  { key: "templates", icon: LayoutTemplate, label: "Templates" },
  { key: "themes", icon: Palette, label: "Themes" },
  { key: "settings", icon: Settings, label: "Settings" },
];

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content", media: "Media", project: "Project",
  people: "People", community: "Community", utility: "Utility",
};

const TEMPLATE_CATEGORIES = [
  "Featured", "Popular", "Newest", "Developer",
  "Portfolio", "Documentation", "Startup", "Creative", "Minimal",
];

interface StudioSidebarProps {
  activePage: StudioPage | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddBlock: (blockType: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onForkTemplate: (templateId: string) => void;
  onApplyTheme: (themeId: string) => void;
  onSaveAsTemplate: (name: string, opts?: { description?: string; category?: string }) => void;
  templates: TemplateData[];
  themes: ThemeCatalogEntry[];
  currentThemeId: string | null;
}

export function StudioSidebar({
  activePage, activeTab, onTabChange,
  onAddBlock, onApplyTemplate, onForkTemplate, onApplyTheme,
  onSaveAsTemplate, templates, themes, currentThemeId,
}: StudioSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <nav className="shrink-0 border-b border-border/20 px-3 pt-3" aria-label="Studio navigation">
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
                    : "text-muted-foreground hover:bg-surface-elevated/50 hover:text-foreground"
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
          <BlockLibrary onAddBlock={onAddBlock} />
        )}
        {activeTab === "templates" && (
          <TemplatesPanel
            templates={templates}
            onApply={onApplyTemplate}
            onFork={onForkTemplate}
            onSaveAsTemplate={onSaveAsTemplate}
          />
        )}
        {activeTab === "themes" && (
          <ThemesPanel
            themes={themes}
            currentThemeId={currentThemeId}
            onApply={onApplyTheme}
          />
        )}
        {activeTab === "settings" && <SettingsPanel activePage={activePage} />}
      </div>

      {/* ── Page info ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/20 px-3 py-3">
        <p className="text-[10px] text-muted-foreground/60">
          {activePage
            ? `Editing: ${activePage.type === "profile" ? "Profile" : "Project"}`
            : "No page selected"}
        </p>
      </div>
    </div>
  );
}

// ── Block Library ────────────────────────────────────────────────────────────

function BlockLibrary({ onAddBlock }: { onAddBlock: (type: string) => void }) {
  const [search, setSearch] = useState("");
  const blocks = getAllBlocks();

  const filtered = search
    ? blocks.filter((b) =>
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Add Blocks
      </p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full rounded-md border border-border/30 bg-surface/40 py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-elevated/50 hover:text-foreground"
              >
                <Plus className="h-3 w-3 shrink-0" />
                <span className="truncate">{block.label}</span>
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
  templates, onApply, onFork, onSaveAsTemplate,
}: {
  templates: TemplateData[];
  onApply: (id: string) => void;
  onFork: (id: string) => void;
  onSaveAsTemplate: (name: string, opts?: { description?: string; category?: string }) => void;
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
      </div>

      {showSave && (
        <div className="mb-3 space-y-2 rounded-md border border-border/20 bg-surface/30 p-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name..."
            className="w-full rounded border border-border/30 bg-surface/40 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => { onSaveAsTemplate(saveName); setSaveName(""); setShowSave(false); }}
            disabled={!saveName.trim()}
            className="w-full rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            Save current layout as template
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
                : "bg-surface/40 text-muted-foreground hover:text-foreground"
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
          className="w-full rounded-md border border-border/30 bg-surface/40 py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="space-y-2">
        {filtered.slice(0, 15).map((t) => (
          <div
            key={t.id}
            className="group rounded-lg border border-border/20 bg-surface/20 p-2.5 transition-colors hover:border-border/40"
          >
            <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
            {t.creatorHandle && (
              <p className="text-[10px] text-muted-foreground">by @{t.creatorHandle}</p>
            )}
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
                className="flex-1 rounded bg-surface/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
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
  themes, currentThemeId, onApply,
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
              : "text-muted-foreground hover:bg-surface-elevated/50 hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded border border-border/40" style={{ background: "var(--background)" }} />
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
                    : "text-muted-foreground hover:bg-surface-elevated/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Mini preview swatch */}
                  <div className="flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded border border-border/40">
                    <div className="w-1/2" style={{ background: colors["--foreground"] ?? "#fff" }} />
                    <div className="w-1/2" style={{ background: colors["--primary"] ?? "#6366f1" }} />
                  </div>
                  <span className="truncate">{theme.name}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-primary">Active</span>
                  )}
                </div>
              </button>
            );
          })}
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