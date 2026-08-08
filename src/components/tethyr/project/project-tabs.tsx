import { memo } from "react";
import { BookOpen, FolderOpen, Activity, Users, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectTab = "readme" | "files" | "activity" | "people" | "discussions";

export const PROJECT_TABS: {
  id: ProjectTab;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { id: "readme", label: "README", icon: BookOpen },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "people", label: "People", icon: Users },
  { id: "discussions", label: "Discussions", icon: MessagesSquare },
];

export const ProjectTabs = memo(function ProjectTabs({
  active,
  onSelect,
  counts,
}: {
  active: ProjectTab;
  onSelect: (tab: ProjectTab) => void;
  counts?: Partial<Record<ProjectTab, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project workspace"
      className="sticky top-16 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl sm:-mx-8 sm:px-8"
    >
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {PROJECT_TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              title={`${tab.label} (${index + 1})`}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count != null && count > 0 && (
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {count}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--user-accent,var(--primary))]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
