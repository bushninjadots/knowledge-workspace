import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  Github,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLibraryItem,
  useUpdateItem,
  useDeleteItem,
  useToggleFavorite,
  useTogglePin,
  libraryKeys,
} from "@/hooks/use-library";
import { syncLibraryItemFromGithub, unlinkLibraryItemGithub } from "@/lib/github-server";
import { GithubLinkDialog } from "@/components/tethyr/library/github-link-dialog";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import { lazy, Suspense } from "react";
const NoteEditor = lazy(() =>
  import("@/components/tethyr/library/note-editor").then((m) => ({ default: m.NoteEditor })),
);
import { LibraryContentLayout } from "@/components/tethyr/library/library-layout";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";

// Radix Select reserves the empty string, so "not linked" needs its own value.
const NO_PROJECT = "none";

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
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"docs" | "code">("docs");
  const [ghDialogOpen, setGhDialogOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  // Sync local state when the item loads or changes server-side (e.g. after a
  // GitHub pull). Keyed on updated_at so external updates reach the editor.
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content);
      setProjectId(item.project_id ?? null);
      setWorkspaceMode(item.content_format === "markdown" ? "code" : "docs");
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.updated_at]);

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

  function handleModeSwitch(target: "docs" | "code") {
    if (target === workspaceMode) return;
    const currentFormat = workspaceMode === "code" ? "markdown" : "html";
    const targetFormat = target === "code" ? "markdown" : "html";
    if (currentFormat !== targetFormat && content.trim()) {
      const confirmed = window.confirm(
        target === "code"
          ? "Convert this doc to Markdown? Rich-text formatting is translated as faithfully as possible."
          : "Convert this Markdown into rich text?",
      );
      if (!confirmed) return;
      void import("@/lib/content-format").then(({ htmlToMarkdown, markdownToHtml }) => {
        setContent(target === "code" ? htmlToMarkdown(content) : markdownToHtml(content));
      });
    }
    setWorkspaceMode(target);
    setHasChanges(true);
  }

  const isOwner = !!me?.userId && item?.user_id === me.userId;

  const syncGithub = useMutation({
    mutationFn: (itemId: string) => syncLibraryItemFromGithub({ data: { itemId } }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: libraryKeys.item(id) });
        toast.success(result.updated ? "Synced from GitHub" : "Already up to date");
        setHasChanges(false);
      } else {
        const messages: Record<string, string> = {
          not_found: "File not found in that repo — check the path/branch.",
          rate_limited: "GitHub rate limit hit — try again in a few minutes.",
          unauthorized: "GitHub rejected the saved token — reconnect it in your profile.",
          binary: "That file looks binary — link a text/Markdown file instead.",
          not_linked: "This item has no GitHub file linked.",
          forbidden: "Only the owner can sync this item.",
          network: "Couldn't reach GitHub — try again.",
        };
        toast.error(messages[result.reason] ?? "Sync failed");
      }
    },
  });

  const unlinkGithub = useMutation({
    mutationFn: (itemId: string) => unlinkLibraryItemGithub({ data: { itemId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.item(id) });
      toast.success("GitHub link removed");
    },
  });

  function handleSave() {
    if (!item) return;
    updateItem.mutate(
      {
        id: item.id,
        title,
        content,
        project_id: projectId,
        content_format: workspaceMode === "code" ? "markdown" : "html",
      },
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

  // Edits are client-only until Save — block accidental navigation/tab close.
  useUnsavedChangesGuard(hasChanges, "You have unsaved changes to this item. Leave anyway?");

  if (isLoading) {
    return (
      <LibraryContentLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3 rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 rounded-xl" />
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
            <Pin className={`h-4 w-4 ${item.is_pinned ? "text-ai" : "text-muted-foreground"}`} />
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
            <div className="mb-4 rounded-xl border border-trust/20 bg-trust/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {workspaceMode === "code" ? (
                      <FileCode2 className="h-4 w-4 text-trust" />
                    ) : (
                      <Code2 className="h-4 w-4 text-ai" />
                    )}
                    {workspaceMode === "code" ? "Code workspace" : "Docs workspace"}
                  </div>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    {workspaceMode === "code"
                      ? "Write a snippet, implementation note, or README. Use Code block for syntax-highlighted code."
                      : "Explain the idea, decisions, and next steps. Add code blocks whenever a reader needs the implementation."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={workspaceMode}
                    onChange={handleModeSwitch}
                    ariaLabel="Workspace mode"
                    size="sm"
                    className="w-fit"
                    options={[
                      { value: "docs", label: "Docs", icon: Code2 },
                      { value: "code", label: "Code", icon: FileCode2 },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setPreview((value) => !value)}
                    className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {preview ? "Edit" : "Preview"}
                  </button>
                </div>
              </div>
            </div>
            {preview ? (
              workspaceMode === "code" ? (
                <Card asChild>
                  <article className="prose-custom min-h-[60vh] bg-surface/40 px-4 py-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </article>
                </Card>
              ) : (
                <Card asChild>
                  <article
                    className="prose-custom min-h-[60vh] bg-surface/40 px-4 py-6"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
                  />
                </Card>
              )
            ) : (
              <Suspense
                fallback={
                  <div
                    className="min-h-[60vh] animate-gentle-pulse bg-surface/30"
                    aria-label="Loading editor"
                  />
                }
              >
                <NoteEditor
                  content={content}
                  onChange={handleContentChange}
                  format={workspaceMode === "code" ? "markdown" : "html"}
                />
              </Suspense>
            )}
          </>
        )}
        {item.type === "link" && item.url ? (
          <Card className="bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-5 w-5 text-teaching" />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-trust underline hover:opacity-80"
              >
                {item.url}
              </a>
            </div>
          </Card>
        ) : item.type === "upload" && fileUrl ? (
          <Card className="bg-surface/40 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="h-5 w-5 text-ai" />
              <a
                href={fileUrl}
                download={item.title || undefined}
                className="text-sm text-trust underline hover:opacity-80"
              >
                {item.file_type ?? "File"}
              </a>
              {item.file_size && (
                <span className="text-xs text-muted-foreground">
                  ({(item.file_size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </Card>
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
            <Select
              value={projectId ?? NO_PROJECT}
              onValueChange={(value) => {
                setProjectId(value === NO_PROJECT ? null : value);
                setHasChanges(true);
              }}
            >
              {" "}
              <SelectTrigger
                id="library-project"
                className="h-7 min-w-0 flex-1 px-2 text-xs sm:max-w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(item.type === "note" || item.type === "document") && isOwner && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-surface/30 px-3 py-2 text-xs">
            <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {item.github_source ? (
              <>
                <span className="font-medium text-foreground">
                  {item.github_source.repo}/{item.github_source.path}
                </span>
                {item.github_source.branch && (
                  <span className="text-muted-foreground">· {item.github_source.branch}</span>
                )}
                <span className="text-muted-foreground">
                  ·{" "}
                  {item.github_source.synced_at
                    ? `Synced ${new Date(item.github_source.synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : "Not synced yet"}
                </span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={syncGithub.isPending}
                  onClick={() => {
                    if (
                      hasChanges &&
                      !window.confirm(
                        "Syncing replaces your unsaved edits with the GitHub version. Continue?",
                      )
                    )
                      return;
                    syncGithub.mutate(item.id);
                  }}
                >
                  {syncGithub.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Sync from GitHub
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                  disabled={unlinkGithub.isPending}
                  onClick={() => unlinkGithub.mutate(item.id)}
                >
                  <Unlink className="h-3 w-3" />
                  Unlink
                </Button>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">
                  Pull updates from a file in your GitHub repository — always on your terms.
                </span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setGhDialogOpen(true)}
                >
                  <Github className="h-3 w-3" />
                  Link GitHub file
                </Button>
              </>
            )}
          </div>
        )}
        {(item.type === "note" || item.type === "document") && isOwner && (
          <GithubLinkDialog
            open={ghDialogOpen}
            onOpenChange={setGhDialogOpen}
            itemId={item.id}
            initial={
              item.github_source
                ? {
                    repo: item.github_source.repo,
                    path: item.github_source.path,
                    branch: item.github_source.branch,
                  }
                : undefined
            }
            onLinked={() => {
              queryClient.invalidateQueries({ queryKey: libraryKeys.item(item.id) });
              toast.success("GitHub file linked");
            }}
          />
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
