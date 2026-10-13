// Library boards: the card editor (due date, notes, checklist, linked item) and
// the picker for wrapping an existing library item in a card.

import { useMemo, useState } from "react";
import { FileText, Globe, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLibraryItems, type LibraryBoardCard } from "@/hooks/use-library";
import { cn } from "@/lib/utils";

/** Card editor: title + the common field shapes (due date, notes, checklist). */
export function CardDialog({
  card,
  open,
  onOpenChange,
  onUpdate,
}: {
  card: LibraryBoardCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (patch: Partial<LibraryBoardCard>) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [due, setDue] = useState((card.fields.due as string | undefined) ?? "");
  const [notes, setNotes] = useState((card.fields.notes as string | undefined) ?? "");
  const [checklist, setChecklist] = useState(
    (card.fields.checklist as { text: string; checked: boolean }[] | undefined) ?? [],
  );
  const [newItem, setNewItem] = useState("");

  function save() {
    onUpdate({
      title: title.trim() || card.title,
      fields: {
        ...card.fields,
        due: due || null,
        notes: notes || null,
        checklist: checklist.length > 0 ? checklist : null,
      } as LibraryBoardCard["fields"],
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Due date</span>
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Checklist
            </span>
            <ul className="space-y-1">
              {checklist.map((entry, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={() =>
                      setChecklist((prev) =>
                        prev.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c)),
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className={cn("flex-1", entry.checked && "text-muted-foreground line-through")}
                  >
                    {entry.text}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${entry.text}`}
                    onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-1.5">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItem.trim()) {
                    setChecklist((prev) => [...prev, { text: newItem.trim(), checked: false }]);
                    setNewItem("");
                  }
                }}
                placeholder="Add checklist item"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-2xs"
                disabled={!newItem.trim()}
                onClick={() => {
                  setChecklist((prev) => [...prev, { text: newItem.trim(), checked: false }]);
                  setNewItem("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pick an existing library item to wrap as a card. */
export function ItemPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: { id: string; title: string }) => void;
}) {
  const { data: items = [] } = useLibraryItems();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((item) => !q || item.title.toLowerCase().includes(q));
    return list.slice(0, 30);
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link a library item</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          className="h-9"
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: item.id, title: item.title });
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
              >
                <ItemGlyphStatic type={item.type} />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">No items match.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function ItemGlyphStatic({ type }: { type: string }) {
  if (type === "link") return <Globe className="h-3.5 w-3.5 text-teaching" />;
  if (type === "upload") return <Upload className="h-3.5 w-3.5 text-ai" />;
  return <FileText className="h-3.5 w-3.5 text-trust" />;
}
