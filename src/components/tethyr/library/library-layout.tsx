import { useState } from "react";
import { LibrarySidebar, type LibraryView } from "./library-sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Library layout shell: sidebar + content area.
 * The parent route passes its children which receive the current view.
 */
export function LibraryLayout({ children }: { children: (view: LibraryView) => React.ReactNode }) {
  const [view, setView] = useState<LibraryView>({ type: "all" });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-room-enter">
      {/* Library sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-border/60 bg-surface/30 bg-noise lg:block">
        <LibrarySidebar view={view} onViewChange={setView} />
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">{children(view)}</ScrollArea>
    </div>
  );
}

/**
 * Simple content-only layout for Library sub-routes (document viewer etc.)
 * No sidebar — just wraps children in a scroll area with room-enter animation.
 */
export function LibraryContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100vh-3.5rem)] animate-room-enter">
      <ScrollArea className="h-full">{children}</ScrollArea>
    </div>
  );
}
