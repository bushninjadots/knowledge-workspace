import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Star,
  Pin,
  Trash2,
  Save,
  Loader2,
  Globe,
  Upload,
  FolderOpen,
  Code2,
  FileCode2,
} from "lucide-react";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/library/$id")({
  head: () => ({
    meta: [
      { title: "Library item — Tethyr" },
      { name: "description", content: "A note or resource in your Tethyr library." },
    ],
  }),
  component: LibraryItemPage,
});

function LibraryItemPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: item, isLoading } = useLibraryItem(id);
  const { data: me } = useCurrentUser();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const toggleFav = useToggleFavorite();
  const togglePin = useTogglePin();

  const projects = me?.projects ?? [];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"docs" | "code">("docs");
  const [preview, setPreview] = useState(false);

  // Sync local state when item loads
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content);
      setProjectId(item.project_id ?? null);
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    if (item?.title) document.title = `${item.title} — Tethyr`;
  }, [item?.title]);

  useEffect(() => {
    let active = true;
    if (!item?.file_url) {
      setFileUrl(null);
      return undefined;
    }
    supabase.storage
      .from("library-files")
      // download:true forces Content-Disposition: attachment so uploaded files
      // (HTML, SVG, etc.) are downloaded rather than rendered in-browser.
      .createSignedUrl(item.file_url, 60 * 10, { download: true })
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
      { id: item.id, title, content, project_id: projectId },
      {
        onSuccess: () => {
          setHasChanges(false);
          toast.success("Saved");
        },
        onError: (err) => {
          toast.error(friendlyError(err, "Save failed"));
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Top bar */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate({ to: "/library" })}
            aria-label="Back to Library"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {/* Last saved */}
          <span className="text-xs text-muted-foreground">
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
            aria-label={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={`h-4 w-4 ${
                item.is_favorite ? "fill-teaching text-teaching" : "text-muted-foreground"
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => togglePin.mutate({ id: item.id, is_pinned: !item.is_pinned })}
            aria-label={item.is_pinned ? "Unpin" : "Pin to top"}
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
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-[var(--user-accent,var(--trust))] text-[var(--user-accent-foreground,var(--background))] hover:opacity-90"
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
          aria-label="Title"
          className="mb-6 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40 font-display"
        />

        {/* Editor / code-doc workspace */}
        {(item.type === "note" || item.type === "document") && (
          <>
            <div className="mb-4 rounded-xl border border-brand-green/20 bg-brand-green/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {workspaceMode === "code" ? (
                      <FileCode2 className="h-4 w-4 text-brand-green" />
                    ) : (
                      <Code2 className="h-4 w-4 text-brand-purple" />
                    )}
                    {workspaceMode === "code" ? "Code workspace" : "Docs workspace"}
                  </div>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    {workspaceMode === "code"
                      ? "Write a snippet, implementation note, or README. Use Code block for syntax-highlighted code."
                      : "Explain the idea, decisions, and next steps. Add code blocks whenever a reader needs the implementation."}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/50 p-1">
                  <button
                    type="button"
                    onClick={() => setWorkspaceMode("docs")}
                    className={`rounded-md px-2.5 py-1 text-xs ${workspaceMode === "docs" ? "bg-surface-elevated text-foreground" : "text-muted-foreground"}`}
                  >
                    Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceMode("code")}
                    className={`rounded-md px-2.5 py-1 text-xs ${workspaceMode === "code" ? "bg-surface-elevated text-foreground" : "text-muted-foreground"}`}
                  >
                    Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview((value) => !value)}
                    className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {preview ? "Edit" : "Preview"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                To publish this into a project, use <strong>Link to project</strong> below. GitHub
                sync can be enabled after a repository is linked and your GitHub account is
                connected.
              </p>
            </div>
            {preview ? (
              <article
                className="prose-custom min-h-[60vh] rounded-xl border card-border bg-surface/40 px-4 py-6"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <NoteEditor content={content} onChange={handleContentChange} />
            )}
          </>
        )}
        {item.type === "link" && item.url ? (
          <div className="rounded-xl border card-border bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-5 w-5 text-teaching" />
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
          <div className="rounded-xl border card-border bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="h-5 w-5 text-ai" />
              <a
                href={fileUrl}
                download={item.title || undefined}
                className="text-sm text-brand-green underline hover:opacity-80"
              >
                {item.file_type ?? "File"}
              </a>
              {item.file_size && (
                <span className="text-xs text-muted-foreground">
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

        {/* Link to project */}
        {projects.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <label htmlFor="library-project" className="shrink-0 text-muted-foreground">
              Link to project
            </label>
            <select
              id="library-project"
              value={projectId ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value || null);
                setHasChanges(true);
              }}
              className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {(item.type === "note" || item.type === "document") && projectId && (
          <div className="mt-4 rounded-lg border border-border/50 bg-surface/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">GitHub sync</span>
            <span className="mx-1.5">·</span>
            Link this doc to a project with a connected GitHub repository to enable repository sync
            when the project owner turns it on.
            <button
              type="button"
              onClick={() => navigate({ to: "/profile" })}
              className="ml-1 font-medium text-brand-green hover:underline"
            >
              Connect GitHub
            </button>
          </div>
        )}

        {/* Collection */}
        {item.collection && (
          <div className="mt-4 text-xs text-muted-foreground">
            In collection: {item.collection.name}
          </div>
        )}
      </div>
    </LibraryContentLayout>
  );
}
