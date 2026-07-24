import { useState } from "react";
import {
  Folder,
  FolderOpen,
  BookOpen,
  Bookmark,
  Archive,
  Briefcase,
  Code,
  Lightbulb,
  Palette,
  Rocket,
  Star,
  Tag,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCollection, type LibraryCollection } from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const ICONS = [
  { name: "folder", icon: Folder },
  { name: "folder-open", icon: FolderOpen },
  { name: "book-open", icon: BookOpen },
  { name: "bookmark", icon: Bookmark },
  { name: "archive", icon: Archive },
  { name: "briefcase", icon: Briefcase },
  { name: "code", icon: Code },
  { name: "lightbulb", icon: Lightbulb },
  { name: "palette", icon: Palette },
  { name: "rocket", icon: Rocket },
  { name: "star", icon: Star },
  { name: "tag", icon: Tag },
  { name: "zap", icon: Zap },
];

const COLORS = [
  "oklch(0.65 0.15 260)",
  "oklch(0.72 0.19 142)",
  "oklch(0.65 0.22 30)",
  "oklch(0.65 0.26 305)",
  "oklch(0.70 0.18 55)",
  "oklch(0.60 0.20 200)",
  "oklch(0.55 0.22 25)",
  "oklch(0.75 0.15 175)",
  "oklch(0.60 0.18 330)",
  "oklch(0.68 0.16 80)",
];

export function CollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (collection: LibraryCollection) => void;
}) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("folder");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const createCollection = useCreateCollection();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Collection name is required");
      return;
    }

    createCollection.mutate(
      { name: trimmed, icon: selectedIcon, color: selectedColor },
      {
        onSuccess: (col) => {
          toast.success(`"${col.name}" created`);
          setName("");
          setSelectedIcon("folder");
          setSelectedColor(COLORS[0]);
          onOpenChange(false);
          onCreated?.(col);
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to create collection");
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCreate();
  }

  const IconComponent = ICONS.find((i) => i.name === selectedIcon)?.icon ?? Folder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Design Resources"
              className="h-9"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((item) => {
                const Icon = item.icon;
                const active = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedIcon(item.name)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
                      active
                        ? "border-brand-green/50 bg-brand-green/10 text-brand-green"
                        : "border-border/40 bg-surface/40 text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    )}
                    title={item.name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all",
                    selectedColor === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-110",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface/40 px-4 py-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${selectedColor}20` }}
            >
              <IconComponent className="h-4 w-4" style={{ color: selectedColor }} />
            </div>
            <span className="text-sm font-medium">{name || "Collection name"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="gap-2 bg-brand-green text-background hover:bg-brand-green/90"
            onClick={handleCreate}
            disabled={createCollection.isPending}
          >
            {createCollection.isPending ? "Creating…" : "Create Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
