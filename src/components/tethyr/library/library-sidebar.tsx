import { useState } from "react";
import {
  FileText,
  Heart,
  Clock,
  Star,
  FolderPlus,
  Upload,
  ChevronRight,
  ChevronDown,
  Plus,
  Hash,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLibraryCollections, useLibraryTags, useCreateTag } from "@/hooks/use-library";
import { CollectionDialog } from "./collection-dialog";
import { cn } from "@/lib/utils";

type View =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "recent" }
  | { type: "pinned" }
  | { type: "collection"; collectionId: string }
  | { type: "tag"; tagId: string }
  | { type: "uploads" };

export type { View as LibraryView };

const filterItems = [
  { type: "all" as const, label: "All Items", icon: Layers },
  { type: "favorites" as const, label: "Favorites", icon: Heart },
  { type: "recent" as const, label: "Recent", icon: Clock },
  { type: "pinned" as const, label: "Pinned", icon: Star },
  { type: "uploads" as const, label: "Uploads", icon: Upload },
];

export function LibrarySidebar({
  view,
  onViewChange,
  onNewNote,
}: {
  view: View;
  onViewChange: (view: View) => void;
  onNewNote: () => void;
}) {
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const { data: collections = [] } = useLibraryCollections();
  const { data: tags = [] } = useLibraryTags();
  const createTag = useCreateTag();

  function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    createTag.mutate(
      { name },
      {
        onSuccess: (tag) => {
          setNewTagName("");
          setShowNewTag(false);
          onViewChange({ type: "tag", tagId: tag.id });
        },
        onError: (err) => {
          toast.error(`Failed to create tag: ${err.message}`);
        },
      },
    );
  }

  function isActive(type: string, id?: string) {
    if (view.type === type && !id) return true;
    if (view.type === "collection" && type === "collection" && "collectionId" in view)
      return view.collectionId === id;
    if (view.type === "tag" && type === "tag" && "tagId" in view) return view.tagId === id;
    return false;
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 border-border/60 bg-surface/60 text-xs"
            onClick={onNewNote}
          >
            <FileText className="h-3.5 w-3.5" />
            New Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border/60 bg-surface/60 text-xs"
            onClick={() => setShowCollectionDialog(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Filters */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Browse
          </p>
          <nav className="flex flex-col gap-0.5">
            {filterItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.type);
              return (
                <button
                  key={item.type}
                  onClick={() => onViewChange({ type: item.type })}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200",
                    active
                      ? "bg-surface-elevated text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active ? "text-brand-green" : "",
                    )}
                  />
                  <span className="flex-1 text-left text-[13px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <Separator className="bg-border/40" />

        {/* Collections */}
        <div>
          <div className="mb-2 flex w-full items-center gap-1.5 px-2">
            <button
              onClick={() => setCollectionsOpen(!collectionsOpen)}
              className="flex flex-1 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-muted-foreground"
            >
              {collectionsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Collections
            </button>
            <button
              onClick={() => setShowCollectionDialog(true)}
              aria-label="New collection"
              className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-surface hover:text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {collectionsOpen && (
            <nav className="flex flex-col gap-0.5">
              {collections.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">No collections yet</p>
              )}
              {collections.map((col) => {
                const active = isActive("collection", col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => onViewChange({ type: "collection", collectionId: col.id })}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200",
                      active
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="flex-1 truncate text-left text-[13px]">{col.name}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <Separator className="bg-border/40" />

        {/* Tags */}
        <div>
          <div className="mb-2 flex w-full items-center gap-1.5 px-2">
            <button
              onClick={() => setTagsOpen(!tagsOpen)}
              className="flex flex-1 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-muted-foreground"
            >
              {tagsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Tags
            </button>
            <button
              onClick={() => setShowNewTag(true)}
              aria-label="New tag"
              className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-surface hover:text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {tagsOpen && (
            <nav className="flex flex-col gap-0.5">
              {tags.length === 0 && !showNewTag && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">No tags yet</p>
              )}
              {tags.map((tag) => {
                const active = isActive("tag", tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => onViewChange({ type: "tag", tagId: tag.id })}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200",
                      active
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: tag.color }} />
                    <span className="flex-1 truncate text-left text-[13px]">{tag.name}</span>
                  </button>
                );
              })}

              {showNewTag && (
                <div className="flex items-center gap-1 px-2.5">
                  <input
                    autoFocus
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateTag();
                      if (e.key === "Escape") {
                        setShowNewTag(false);
                        setNewTagName("");
                      }
                    }}
                    placeholder="Tag name…"
                    className="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs outline-none focus:border-brand-green/50"
                  />
                </div>
              )}
            </nav>
          )}
        </div>
      </div>

      <CollectionDialog
        open={showCollectionDialog}
        onOpenChange={setShowCollectionDialog}
        onCreated={(col) => onViewChange({ type: "collection", collectionId: col.id })}
      />
    </ScrollArea>
  );
}
