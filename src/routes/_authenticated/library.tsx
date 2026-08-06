import { useState } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, LayoutGrid, List, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LibraryLayout } from "@/components/tethyr/library/library-layout";
import { ItemCard } from "@/components/tethyr/library/item-card";
import { CollectionCard } from "@/components/tethyr/library/collection-card";
import { FileUploadZone } from "@/components/tethyr/library/file-upload-zone";
import { LibrarySearchBar } from "@/components/tethyr/library/library-search-bar";
import { EmptyState } from "@/components/tethyr/empty-state";
import {
  useLibraryItems,
  useLibraryCollections,
  useCreateItem,
  type LibraryCollection,
} from "@/hooks/use-library";
import type { LibraryView } from "@/components/tethyr/library/library-sidebar";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Tethyr" },
      { name: "description", content: "Your personal library of notes, files, and links." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const navigate = useNavigate();
  const createItem = useCreateItem();
  const { location } = useRouterState();
  const isChildRoute = location.pathname.startsWith("/library/");

  function handleNewNote() {
    createItem.mutate(
      { title: "Untitled Note", type: "note" },
      {
        onSuccess: (item) => {
          navigate({ to: "/library/$id", params: { id: item.id } });
        },
        onError: (err) => {
          toast.error(`Failed to create note: ${err.message}`);
        },
      },
    );
  }

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <LibraryLayout onNewNote={handleNewNote}>
      {(view: LibraryView) => <LibraryContent view={view} onNewNote={handleNewNote} />}
    </LibraryLayout>
  );
}

function LibraryContent({ view, onNewNote }: { view: LibraryView; onNewNote: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [showUpload, setShowUpload] = useState(false);

  const { data: collections = [], error: collectionsError } = useLibraryCollections();

  const filters: Record<string, unknown> = {};
  if (search.trim()) filters.search = search.trim();
  if (view.type === "favorites") filters.is_favorite = true;
  if (view.type === "pinned") filters.is_pinned = true;
  if (view.type === "collection") filters.collection_id = view.collectionId;
  if (view.type === "uploads") filters.type = "upload";

  const {
    data: items = [],
    isLoading,
    error: itemsError,
  } = useLibraryItems(filters as Parameters<typeof useLibraryItems>[0]);

  const title = getTitle(view, collections);

  // ── Error banner ──
  const dbError = itemsError || collectionsError;
  if (dbError) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-display text-lg font-semibold text-destructive">
                Database tables not found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The library tables haven't been created in your Supabase project yet. Run the
                migration SQL in your Supabase Dashboard → SQL Editor.
              </p>
              <div className="mt-3 rounded-lg bg-background/60 p-3 font-mono text-xs text-destructive/80">
                {dbError.message}
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>
                  1. Go to{" "}
                  <a
                    href="https://supabase.com/dashboard/project/_/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Supabase SQL Editor
                  </a>
                </p>
                <p>2. Paste and run the contents of these migration files in order:</p>
                <ul className="ml-4 list-disc space-y-0.5">
                  <li className="font-mono text-[11px]">
                    supabase/migrations/20260723100000_library_foundation.sql
                  </li>
                  <li className="font-mono text-[11px]">
                    supabase/migrations/20260723120000_security_and_library_hardening.sql
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LibrarySearchBar value={search} onChange={setSearch} className="w-56" />

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
            variant="outline"
            className="gap-2 border-border/60 bg-surface/60 text-xs"
            onClick={() => setShowUpload(!showUpload)}
          >
            Upload
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-[var(--user-accent,var(--trust))] text-background hover:opacity-90"
            onClick={onNewNote}
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </Button>
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <div className="mb-6">
          <FileUploadZone
            collectionId={view.type === "collection" ? view.collectionId : undefined}
            onUploaded={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Collections row (when viewing All) */}
      {view.type === "all" && collections.length > 0 && !search.trim() && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          {view.type === "uploads" ? (
            <div className="w-full max-w-md">
              <FileUploadZone />
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="mt-3 gap-2 bg-brand-green text-background hover:bg-brand-green/90"
                onClick={onNewNote}
              >
                <Plus className="h-3.5 w-3.5" />
                Create note
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-2 border-border/60"
                onClick={() => setShowUpload(true)}
              >
                Upload file
              </Button>
            </div>
          )}
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
