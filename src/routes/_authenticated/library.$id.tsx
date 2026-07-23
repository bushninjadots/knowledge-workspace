import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Star, Pin, Trash2, Save, Loader2, Globe, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useLibraryItem,
  useUpdateItem,
  useDeleteItem,
  useToggleFavorite,
  useTogglePin,
} from "@/hooks/use-library";
import { NoteEditor } from "@/components/tethyr/library/note-editor";
import { LibraryContentLayout } from "@/components/tethyr/library/library-layout";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/library/$id")({
  component: LibraryItemPage,
});

function LibraryItemPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: item, isLoading } = useLibraryItem(id);
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const toggleFav = useToggleFavorite();
  const togglePin = useTogglePin();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Sync local state when item loads
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content);
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    let active = true;
    if (!item?.file_url) {
      setFileUrl(null);
      return undefined;
    }
    supabase.storage
      .from("library-files")
      .createSignedUrl(item.file_url, 60 * 10)
      .then(({ data, error }) => {
        if (active) setFileUrl(error ? null : (data?.signedUrl ?? null));
      });
    return () => {
      active = false;
    };
  }, [item?.file_url]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    setHasChanges(true);
  }

  function handleContentChange(newContent: string) {
    setContent(newContent);
    setHasChanges(true);
  }

  function handleSave() {
    if (!item) return;
    updateItem.mutate(
      { id: item.id, title, content },
      {
        onSuccess: () => {
          setHasChanges(false);
          toast.success("Saved");
        },
      },
    );
  }

  function handleDelete() {
    if (!item) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        toast.success("Deleted");
        navigate({ to: "/library" });
      },
    });
  }

  if (isLoading) {
    return (
      <LibraryContentLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </LibraryContentLayout>
    );
  }

  if (!item) {
    return (
      <LibraryContentLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Item not found</p>
          <Button variant="outline" onClick={() => navigate({ to: "/library" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
        </div>
      </LibraryContentLayout>
    );
  }

  return (
    <LibraryContentLayout>
      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate({ to: "/library" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {/* Last saved */}
          <span className="text-xs text-muted-foreground/60">
            {item.updated_at &&
              new Date(item.updated_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
          </span>

          <Separator orientation="vertical" className="h-5" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleFav.mutate({ id: item.id, is_favorite: !item.is_favorite })}
          >
            <Star
              className={`h-4 w-4 ${
                item.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => togglePin.mutate({ id: item.id, is_pinned: !item.is_pinned })}
          >
            <Pin
              className={`h-4 w-4 ${
                item.is_pinned ? "text-brand-purple" : "text-muted-foreground"
              }`}
            />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-brand-green text-background hover:bg-brand-green/90"
            disabled={!hasChanges || updateItem.isPending}
            onClick={handleSave}
          >
            {updateItem.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="mb-6 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40 font-display"
        />

        {/* Editor */}
        {item.type === "note" || item.type === "document" ? (
          <NoteEditor content={content} onChange={handleContentChange} />
        ) : item.type === "link" && item.url ? (
          <div className="rounded-xl border border-border/40 bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-5 w-5 text-amber-400" />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-green underline hover:opacity-80"
              >
                {item.url}
              </a>
            </div>
          </div>
        ) : item.type === "upload" && fileUrl ? (
          <div className="rounded-xl border border-border/40 bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="h-5 w-5 text-purple-400" />
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-green underline hover:opacity-80"
              >
                {item.file_type ?? "File"}
              </a>
              {item.file_size && (
                <span className="text-xs text-muted-foreground/60">
                  ({(item.file_size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-surface/60 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Collection */}
        {item.collection && (
          <div className="mt-4 text-xs text-muted-foreground/60">
            In collection: {item.collection.name}
          </div>
        )}
      </div>
    </LibraryContentLayout>
  );
}
