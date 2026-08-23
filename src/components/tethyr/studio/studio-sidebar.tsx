// ── Studio Sidebar ───────────────────────────────────────────────────────────
// Left panel: Studio navigation (Pages/Templates/Themes/Settings) + Block library.

import { useState } from "react";
import { Search, Plus, LayoutTemplate, Palette, Settings, FileText } from "lucide-react";
import { getAllBlocks } from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";
import type { StudioPage } from "./studio";

type SidebarTab = "pages" | "templates" | "themes" | "settings";

const TABS: { key: SidebarTab; icon: React.FC<{ className?: string }>; label: string }[] = [
  { key: "pages", icon: FileText, label: "Pages" },
  { key: "templates", icon: LayoutTemplate, label: "Templates" },
  { key: "themes", icon: Palette, label: "Themes" },
  { key: "settings", icon: Settings, label: "Settings" },
];

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  media: "Media",
  project: "Project",
  people: "People",
  community: "Community",
  utility: "Utility",
};

interface StudioSidebarProps {
  activePage: StudioPage | null;
  onSelectBlock?: (blockId: string) => void;
}

export function StudioSidebar({ activePage, onSelectBlock }: StudioSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("pages");
  const [search, setSearch] = useState("");
  const blocks = getAllBlocks();

  const filteredBlocks = search
    ? blocks.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.type.toLowerCase().includes(search.toLowerCase()),
      )
    : blocks;

  // Group blocks by category.
  const blocksByCategory = new Map<string, BlockDefinition[]>();
  for (const b of filteredBlocks) {
    const list = blocksByCategory.get(b.category) ?? [];
    list.push(b);
    blocksByCategory.set(b.category, list);
  }

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
                onClick={() => setActiveTab(tab.key)}
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

      {/* ── Block library ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Add Blocks
          </p>

          {/* Search */}
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
        </div>

        {[...blocksByCategory.entries()].map(([category, items]) => (
          <div key={category} className="mb-4 last:mb-0">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map((block) => (
                <button
                  key={block.type}
                  type="button"
                  onClick={() => onSelectBlock?.(block.type)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-elevated/50 hover:text-foreground"
                >
                  <Plus className="h-3 w-3 shrink-0" />
                  <span className="truncate">{block.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredBlocks.length === 0 && (
          <p className="py-4 text-center text-[11px] text-muted-foreground">No blocks found.</p>
        )}
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