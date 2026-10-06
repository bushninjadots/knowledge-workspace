import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { filterCommands, type StudioCommand } from "@/lib/studio-commands";
import { cn } from "@/lib/utils";

/** Ctrl/⌘+J in the Studio: type what you want to do and press Enter. */
export function StudioCommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: StudioCommand[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId();
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (command: StudioCommand | undefined) => {
    if (!command) return;
    onOpenChange(false);
    // After the dialog hands focus back, so a command that focuses or
    // scrolls to something on the canvas isn't undone by the close.
    window.setTimeout(command.run, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-editor-chrome gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Studio commands</DialogTitle>
        <div className="flex items-center border-b border-border pl-4 pr-10">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((index) =>
                  results.length ? (index + step + results.length) % results.length : 0,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[active]);
              }
            }}
            placeholder="Add a block, go to one, or run an action…"
            role="combobox"
            aria-expanded
            aria-controls={`${baseId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${baseId}-${active}` : undefined}
            aria-label="Studio commands"
            className="h-12 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          aria-label="Commands"
          className="max-h-[60vh] overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            results.map((command, index) => (
              <Fragment key={command.id}>
                {command.group !== results[index - 1]?.group && (
                  <p className="t-label px-3 pb-1 pt-2" aria-hidden>
                    {command.group}
                  </p>
                )}
                <div
                  id={`${baseId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-1.5 text-sm",
                    index === active
                      ? "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]"
                      : "text-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">{command.label}</span>
                  {command.shortcut && (
                    <kbd className="shrink-0 font-sans text-2xs text-muted-foreground">
                      {command.shortcut}
                    </kbd>
                  )}
                </div>
              </Fragment>
            ))
          )}
          {!query && (
            <p className="px-3 pb-1 pt-2 text-2xs text-muted-foreground">
              Type a block&rsquo;s name to add it or jump to it.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
