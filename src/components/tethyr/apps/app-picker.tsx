// Pick an app from the catalog: search + category groups of tiles.
import { useState } from "react";
import { Search } from "lucide-react";
import { CATEGORY_LABELS, groupApps, type AppDef } from "@/lib/app-catalog";
import { cn } from "@/lib/utils";
import { AppIcon } from "./app-icon";

export function AppPicker({
  apps,
  onPick,
  taken = [],
  className,
}: {
  apps: AppDef[];
  onPick: (app: AppDef) => void;
  /** Already added — shown as added. */
  taken?: string[];
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const groups = groupApps(apps, query);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps — GitLab, Notion, Figma, Linear…"
          aria-label="Search apps"
          className="h-9 w-full rounded-lg border border-input bg-background/60 pl-8 pr-3 text-sm outline-none focus:border-ring"
        />
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Not listed? Paste its link instead — it works with any https link.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.category}>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[group.category]}
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {group.apps.map((app) => {
                const added = taken.includes(app.id);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onPick(app)}
                    disabled={added}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-left text-xs transition-colors hover:border-border-strong hover:bg-surface-elevated disabled:opacity-50"
                  >
                    <AppIcon app={app} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{app.name}</span>
                    {added && <span className="text-[10px] text-muted-foreground">added</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
