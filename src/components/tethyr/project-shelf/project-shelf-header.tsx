import { AnimatePresence, motion } from "framer-motion";
import { Search, GalleryHorizontal, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PROJECT_CATEGORIES } from "@/data/mocks/catalog";

export type ProjectView = "shelf" | "grid" | "list";

interface ProjectShelfHeaderProps {
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  count: number;
  view: ProjectView;
  onViewChange: (v: ProjectView) => void;
}

const VIEW_OPTIONS: { value: ProjectView; label: string; icon: typeof LayoutGrid }[] = [
  { value: "shelf", label: "Shelf view", icon: GalleryHorizontal },
  { value: "grid", label: "Grid view", icon: LayoutGrid },
  { value: "list", label: "List view", icon: List },
];

export function ProjectShelfHeader({
  q,
  setQ,
  category,
  setCategory,
  count,
  view,
  onViewChange,
}: ProjectShelfHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <p className="text-xs uppercase tracking-wider text-primary/70">Explore</p>
        <h1 className="font-display text-2xl font-semibold">What's being built right now</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Browse active projects, find people to collaborate with, and discover what the community
          is working on.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects, tags, or people…"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {PROJECT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              category === c
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Result count + view switcher */}
      <div className="flex items-center justify-between gap-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={count}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="text-xs text-muted-foreground"
          >
            {count} {count === 1 ? "project" : "projects"}
          </motion.p>
        </AnimatePresence>

        <div
          className="flex items-center gap-0.5 rounded-xl border card-border bg-surface p-0.5"
          role="group"
          aria-label="Project view"
        >
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              aria-label={label}
              title={label}
              onClick={() => onViewChange(value)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                view === value
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
