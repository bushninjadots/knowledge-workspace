import { AnimatePresence, motion } from "framer-motion";
import { Search, Folder, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "All", "Projects", "Design", "Development", "Video",
  "Photography", "Music", "Writing", "Marketing",
] as const;

interface ProjectShelfHeaderProps {
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  count: number;
}

export function ProjectShelfHeader({ q, setQ, category, setCategory, count }: ProjectShelfHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <p className="text-xs uppercase tracking-wider text-primary/70">Explore</p>
        <h1 className="font-display text-2xl font-semibold">What's being built right now</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Browse active projects, find people to collaborate with, and discover what the community is working on.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
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
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              category === c
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Result count with animation */}
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
    </div>
  );
}
