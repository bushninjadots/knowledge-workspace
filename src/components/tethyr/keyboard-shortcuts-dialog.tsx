import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: "⌘/Ctrl + K", label: "Open quick search anywhere" },
  { keys: "/", label: "Focus search from the top bar" },
  { keys: "?", label: "Show this shortcut list" },
  { keys: "⌘/Ctrl + Z", label: "Studio — undo" },
  { keys: "⌘/Ctrl + ⇧ + Z", label: "Studio — redo" },
  { keys: "Esc", label: "Close dialogs, or clear the studio selection" },
  { keys: "← →", label: "Step through galleries and project shelves" },
  { keys: "Arrow keys", label: "Move a selected block in the studio editor" },
];

function KeyCombo({ keys }: { keys: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.split(" + ").map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">+</span>}
          <kbd className="rounded-md border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] leading-none text-foreground">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

/**
 * "?" cheat sheet — a compact list of Tethyr's keyboard shortcuts. Mounted once
 * in the authenticated shell, lazily loaded, and opened with the ? key from
 * anywhere (except while typing). Mirrors the GlobalSearch keydown guard.
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable);
      if (typing) return;

      const isShortcutList = e.key === "?";
      if (!isShortcutList) return;

      e.preventDefault();
      onOpenChange(!open);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold tracking-tight">
          Keyboard shortcuts
        </DialogTitle>
        <DialogDescription className="sr-only">
          A list of keyboard shortcuts available across Tethyr.
        </DialogDescription>
        <ul className="mt-1 divide-y divide-border">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm text-muted-foreground">{shortcut.label}</span>
              <KeyCombo keys={shortcut.keys} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
