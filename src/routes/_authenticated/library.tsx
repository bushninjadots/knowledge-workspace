import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, LayoutGrid, List, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LibraryLayout } from "@/components/tethyr/library/library-layout";
import { ItemCard } from "@/components/tethyr/library/item-card";
import { CollectionCard } from "@/components/tethyr/library/collection-card";
import { EmptyState } from "@/components/tethyr/empty-state";
import {
  useLibraryItems,
  useLibraryCollections,
  useCreateItem,
  type LibraryCollection,
} from "@/hooks/use-library";
import type { LibraryView } from "@/components/tethyr/library/library-sidebar";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

function LibraryPage() {
  return <LibraryLayout>{(view: LibraryView) => <LibraryContent view={view} />}</LibraryLayout>;
}

function LibraryContent({ view }: { view: LibraryView }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const createItem = useCreateItem();
  const { data: collections = [] } = useLibraryCollections();

  const filters: Record<string, unknown> = {};
  if (search.trim()) filters.search = search.trim();
  if (view.type === "favorites") filters.is_favorite = true;
  if (view.type === "pinned") filters.is_pinned = true;
  if (view.type === "collection") filters.collection_id = view.collectionId;
  if (view.type === "uploads") filters.type = "upload";

  const { data: items = [], isLoading } = useLibraryItems(
    filters as Parameters<typeof useLibraryItems>[0],
  );

  const title = getTitle(view, collections);

  function handleNewNote() {
    createItem.mutate(
      { title: "Untitled Note", type: "note" },
      {
        onSuccess: (item) => {
          navigate({ to: "/library/$id", params: { id: item.id } });
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-48 rounded-full border-border/60 bg-surface/60 pl-9 text-xs"
            />
          </div>

          <div className="flex rounded-lg border border-border/40 bg-surface/40 p-0.5">
            <button
              onClick={() => setLayout("grid")}
              className={`rounded-md p-1.5 transition-colors ${
                layout === "grid"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setLayout("list")}
              className={`rounded-md p-1.5 transition-colors ${
                layout === "list"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            className="gap-2 bg-brand-green text-background hover:bg-brand-green/90"
            onClick={handleNewNote}
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </Button>
        </div>
      </div>

      {/* Collections row (when viewing All) */}
      {view.type === "all" && collections.length > 0 && !search.trim() && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Collections
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <CollectionCard
                key={col.id}
                collection={col}
                onClick={() => onViewChangeNavigate(col)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState title={getEmptyTitle(view)} description={getEmptyDescription(view)} />
          <Button
            size="sm"
            className="mt-3 gap-2 bg-brand-green text-background hover:bg-brand-green/90"
            onClick={handleNewNote}
          >
            <Plus className="h-3.5 w-3.5" />
            Create note
          </Button>
        </div>
      ) : layout === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} layout="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} layout="list" />
          ))}
        </div>
      )}
    </div>
  );

  function onViewChangeNavigate(col: LibraryCollection) {
    navigate({ to: "/library", search: { collection: col.id } });
  }
}

function getTitle(view: LibraryView, collections: LibraryCollection[]): string {
  switch (view.type) {
    case "all":
      return "All Items";
    case "favorites":
      return "Favorites";
    case "recent":
      return "Recent";
    case "pinned":
      return "Pinned";
    case "uploads":
      return "Uploads";
    case "collection": {
      const col = collections.find((c) => c.id === view.collectionId);
      return col?.name ?? "Collection";
    }
    case "tag":
      return "Tag";
    default:
      return "Library";
  }
}

function getEmptyTitle(view: LibraryView): string {
  switch (view.type) {
    case "favorites":
      return "No favorites yet";
    case "pinned":
      return "Nothing pinned";
    case "uploads":
      return "No uploads";
    case "collection":
      return "Collection is empty";
    default:
      return "Your library is empty";
  }
}

function getEmptyDescription(view: LibraryView): string {
  switch (view.type) {
    case "favorites":
      return "Star items to find them quickly later.";
    case "pinned":
      return "Pin important items to keep them at the top.";
    case "uploads":
      return "Upload files to keep them in your library.";
    case "collection":
      return "Move items into this collection to organize them.";
    default:
      return "Create notes, save links, and upload files to build your personal knowledge base.";
  }
}
