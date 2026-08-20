import { useState } from "react";
import { LibrarySidebar, type LibraryView } from "./library-sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/**
 * Library layout shell: sidebar + content area.
 * The parent route passes its children which receive the current view.
 */
export function LibraryLayout({
  onNewNote,
  children,
}: {
  onNewNote: () => void;
  children: (view: LibraryView) => React.ReactNode;
}) {
  const [view, setView] = useState<LibraryView>({ type: "all" });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-room-enter">
      {/* Library sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-border/60 bg-surface/30 bg-noise lg:block">
        <LibrarySidebar view={view} onViewChange={setView} onNewNote={onNewNote} />
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="border-b border-border/60 bg-surface/30 px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="min-h-10 rounded-md border border-border/60 px-3 text-sm font-medium text-foreground"
          >
            Browse library
          </button>
        </div>
        {children(view)}
      </ScrollArea>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Browse library</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LibrarySidebar
              view={view}
              onViewChange={(next) => {
                setView(next);
                setMobileOpen(false);
              }}
              onNewNote={onNewNote}
            />
          </div>
        </DrawerContent>
      </Drawer>
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
