// The Notes dock: a "Notes" launcher beside Messages in the bottom-right
// corner of every signed-in page. It opens a small panel to jot a note, drop
// in files, pictures and videos, find something you saved, and edit a note
// without leaving the page. Everything lives in the Library (library_items +
// the private library-files bucket); /library is the full-size view.
// Phones open it from the More menu as a sheet.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Music,
  Paperclip,
  Pin,
  Search,
  StickyNote,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreateItem,
  useDeleteItem,
  useLibraryItem,
  useLibraryItems,
  useLibrarySearch,
  useTogglePin,
  useUpdateItem,
  useUploadLibraryFile,
  type LibraryItem,
} from "@/hooks/use-library";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { friendlyError } from "@/lib/error-message";
import { getItemExcerpt } from "@/lib/library-excerpt";
import { notesDock, useNotesDock } from "@/lib/notes-dock-store";
import {
  formatFileSize,
  itemKind,
  linkFallbackTitle,
  noteToHtml,
  parseQuickLink,
  quickNoteFromText,
  type ItemKind,
} from "@/lib/quick-notes";
import { SEARCH_MIN_LENGTH } from "@/lib/search";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

// Tiptap is heavy; it loads the first time a note is opened in the dock.
const NoteEditor = lazy(() =>
  import("@/components/tethyr/library/note-editor").then((m) => ({ default: m.NoteEditor })),
);

const KIND_ICON: Record<ItemKind, LucideIcon> = {
  note: StickyNote,
  image: ImageIcon,
  video: Film,
  audio: Music,
  link: Globe,
  file: FileText,
};

type Filter = "all" | "notes" | "links" | "files";

const iconButton =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground";

export function NotesDock() {
  const location = useLocation();
  const { open, itemId } = useNotesDock();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      notesDock.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The Library is the full-size version of the same thing.
  const onLibrary = location.pathname.startsWith("/library");
  useEffect(() => {
    if (onLibrary) notesDock.close();
  }, [onLibrary]);
  if (onLibrary) return null;

  return (
    <div className="flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="Notes"
          className={cn(
            "pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-panel motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3",
            // Phones: a sheet between the top bar and the tab bar.
            "fixed inset-x-3 top-16 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50",
            // Tablet and up: a panel above the launcher, like Messages.
            "md:static md:inset-auto md:z-auto md:h-[min(36rem,calc(100vh-7rem))] md:w-[24rem]",
          )}
        >
          {itemId ? <DockItem id={itemId} /> : <DockList />}
        </section>
      )}

      <button
        type="button"
        onClick={() => notesDock.toggle()}
        aria-expanded={open}
        aria-label="Notes"
        className={cn(
          "pointer-events-auto hidden h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-lg transition-colors md:inline-flex",
          open
            ? "border-border/70 bg-surface text-foreground hover:bg-surface-elevated"
            : "border-border/70 bg-card text-foreground hover:bg-surface-elevated",
        )}
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <StickyNote className="h-4 w-4" aria-hidden />
        )}
        Notes
      </button>
    </div>
  );
}

function DockHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-surface-elevated/40 px-3">
      {children}
      <Link
        to="/library"
        onClick={() => notesDock.close()}
        aria-label="Open the full Library"
        title="Open the full Library"
        className={cn("ml-auto", iconButton)}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={() => notesDock.close()}
        aria-label="Close notes"
        className={iconButton}
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

/* ── List: jot, upload, find ─────────────────────────────────────────────── */

function DockList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [savingLink, setSavingLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const createItem = useCreateItem();
  const upload = useUploadLibraryFile();
  const { data: recent, isLoading } = useLibraryItems();
  const searching = query.trim().length >= SEARCH_MIN_LENGTH;
  const { data: found, isFetching: searchingNow } = useLibrarySearch(query);

  const items = useMemo(() => {
    const source = (searching ? found : recent) ?? [];
    return source
      .filter((item) =>
        filter === "all"
          ? true
          : filter === "notes"
            ? item.type === "note"
            : filter === "links"
              ? item.type === "link"
              : item.type === "upload" || item.type === "document",
      )
      .slice(0, 40);
  }, [searching, found, recent, filter]);

  const link = parseQuickLink(draft);

  async function saveLink(url: string, note: string) {
    setSavingLink(true);
    try {
      // Best effort: the page's own title and description, else host + path.
      let title = linkFallbackTitle(url);
      let description: string | null = null;
      try {
        const { data } = await supabase.functions.invoke("fetch-project-preview", {
          body: { url },
        });
        const preview = data as { name?: string; description?: string | null } | null;
        if (preview?.name && preview.name !== new URL(url).hostname.replace(/^www\./, ""))
          title = preview.name.slice(0, 120);
        description = preview?.description ?? null;
      } catch {
        /* keep the fallback title */
      }
      const content = note ? noteToHtml(note) : description ? noteToHtml(description) : "";
      await createItem.mutateAsync({ type: "link", url, title, content });
      toast.success("Link saved");
      return true;
    } catch (error) {
      toast.error(friendlyError(error, "Couldn't save the link"));
      return false;
    } finally {
      setSavingLink(false);
    }
  }

  async function saveNote() {
    const text = draft.trim();
    if (!text) return;
    if (link) {
      if (await saveLink(link.url, link.note)) setDraft("");
      return;
    }
    try {
      const note = quickNoteFromText(text);
      await createItem.mutateAsync({ ...note, type: "note" });
      setDraft("");
      toast.success("Note saved");
    } catch (error) {
      toast.error(friendlyError(error, "Couldn't save the note"));
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 10);
    if (list.length === 0) return;
    setUploading((n) => n + list.length);
    let saved = 0;
    for (const file of list) {
      try {
        await upload.mutateAsync({ file });
        saved += 1;
      } catch (error) {
        toast.error(`${file.name}: ${friendlyError(error, "upload failed")}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (saved) toast.success(saved === 1 ? "File saved" : `${saved} files saved`);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      void uploadFiles(event.dataTransfer.files);
      return;
    }
    // A link dragged from the address bar or a page.
    const dropped = (
      event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain")
    )
      .split("\n")
      .find((line) => line.trim() && !line.startsWith("#"));
    const parsed = dropped ? parseQuickLink(dropped) : null;
    if (parsed) void saveLink(parsed.url, "");
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types);
        if (types.includes("Files") || types.includes("text/uri-list")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <DockHeader>
        <StickyNote className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-display text-base font-semibold">Notes</h2>
      </DockHeader>

      {/* Jot */}
      <form
        className="shrink-0 space-y-2 border-b border-border/50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveNote();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void saveNote();
            }
          }}
          rows={3}
          placeholder="Jot something down, or paste a link… (first line is the title)"
          aria-label="New note"
          className="w-full resize-none rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {uploading > 0 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
            )}
            {uploading > 0 ? `Uploading ${uploading}…` : "Add files"}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            or drop them here
          </span>
          <button
            type="submit"
            disabled={!draft.trim() || createItem.isPending || savingLink}
            className="ml-auto inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {savingLink ? "Saving…" : link ? "Save link" : "Save note"}
          </button>
        </div>
      </form>

      {/* Find */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes and files"
            aria-label="Search notes and files"
            className="h-8 w-full rounded-lg border border-border/60 bg-background/60 pl-8 pr-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="flex shrink-0 rounded-lg border border-border/60 p-0.5 text-[11px]">
          {(["all", "notes", "links", "files"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-md px-2 py-1 capitalize transition-colors",
                filter === value
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Your notes and files">
        {isLoading || (searching && searchingNow && !found) ? (
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="px-2 py-2">
              <Skeleton className="h-9 w-full rounded-lg" />
            </li>
          ))
        ) : items.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {searching
              ? "Nothing matches that."
              : filter === "files"
                ? "No files yet. Add pictures, videos, PDFs or docs — or drop them here."
                : filter === "links"
                  ? "No links yet. Paste one above, or drag it in from your browser."
                  : "Nothing saved yet. Jot an idea above, or drop in a file."}
          </li>
        ) : (
          items.map((item) => <DockRow key={item.id} item={item} />)
        )}
      </ul>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ring bg-card/90 text-sm font-medium">
          <Upload className="h-5 w-5" aria-hidden />
          Drop to save to your notes
        </div>
      )}
    </div>
  );
}

function Thumb({ item }: { item: LibraryItem }) {
  const kind = itemKind(item);
  const { data: src } = useSignedStorageUrl(
    "library-files",
    kind === "image" ? item.file_url : null,
  );
  const Icon = KIND_ICON[kind];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-elevated text-muted-foreground">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
    </span>
  );
}

function DockRow({ item }: { item: LibraryItem }) {
  const kind = itemKind(item);
  const excerpt =
    kind === "note"
      ? getItemExcerpt(item.content, item.content_format)
      : kind === "link" && item.url
        ? linkFallbackTitle(item.url).split("/")[0]
        : formatFileSize(item.file_size);
  return (
    <li>
      <button
        type="button"
        onClick={() => notesDock.open(item.id)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-elevated"
      >
        <Thumb item={item} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{item.title || "Untitled"}</span>
            {item.is_pinned && (
              <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {excerpt || timeAgo(item.updated_at)}
          </span>
        </span>
        {excerpt && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(item.updated_at)}
          </span>
        )}
      </button>
    </li>
  );
}

/* ── One item: edit a note, preview a file ───────────────────────────────── */

function DockItem({ id }: { id: string }) {
  const { data: item, isLoading } = useLibraryItem(id);
  const update = useUpdateItem();
  const remove = useDeleteItem();
  const pin = useTogglePin();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"saved" | "pending" | "saving">("saved");
  const pending = useRef<{ title: string; content: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  // Latest values, so a late editor callback never saves a stale title.
  const latest = useRef({ title: "", content: "" });

  useEffect(() => {
    if (item && loadedId.current !== item.id) {
      loadedId.current = item.id;
      setTitle(item.title);
      setContent(item.content);
      latest.current = { title: item.title, content: item.content };
      setStatus("saved");
    }
  }, [item]);

  const flush = useRef(() => {});
  flush.current = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    if (!next || !item) return;
    pending.current = null;
    setStatus("saving");
    update.mutate(
      { id: item.id, title: next.title.trim() || "Untitled", content: next.content },
      {
        onSuccess: () => setStatus(pending.current ? "pending" : "saved"),
        onError: (error) => {
          setStatus("pending");
          toast.error(friendlyError(error, "Couldn't save the note"));
        },
      },
    );
  };

  // Save shortly after typing stops, and on the way out.
  useEffect(() => () => flush.current(), []);
  function queue(patch: Partial<{ title: string; content: string }>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    pending.current = next;
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 800);
  }

  async function download() {
    if (!item?.file_url) return;
    const { data, error } = await supabase.storage
      .from("library-files")
      .createSignedUrl(item.file_url, 60 * 10, { download: true });
    if (error || !data?.signedUrl) {
      toast.error("Couldn't prepare the download. Try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const kind = item ? itemKind(item) : "note";

  return (
    <>
      <DockHeader>
        <button
          type="button"
          onClick={() => {
            flush.current();
            notesDock.showList();
          }}
          aria-label="Back to notes"
          className={iconButton}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {(kind === "note" || kind === "link") &&
            (status === "saving" ? "Saving…" : status === "pending" ? "Editing" : "Saved")}
        </span>
        {item && (
          <>
            <button
              type="button"
              onClick={() => pin.mutate({ id: item.id, is_pinned: !item.is_pinned })}
              aria-pressed={item.is_pinned}
              aria-label={item.is_pinned ? "Unpin" : "Pin to the top"}
              title={item.is_pinned ? "Unpin" : "Pin to the top"}
              className={cn("ml-auto", iconButton, item.is_pinned && "text-foreground")}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Delete “${item.title || "Untitled"}”?`)) return;
                pending.current = null;
                remove.mutate(item.id, {
                  onSuccess: () => {
                    notesDock.showList();
                    toast.success("Deleted");
                  },
                  onError: (error) => toast.error(friendlyError(error, "Couldn't delete it")),
                });
              }}
              aria-label="Delete"
              title="Delete"
              className={iconButton}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </DockHeader>

      {isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !item ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          This note isn't there any more.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              queue({ title: e.target.value });
            }}
            aria-label="Title"
            placeholder="Untitled"
            readOnly={kind !== "note" && kind !== "link"}
            className="w-full bg-transparent px-3 pt-3 pb-1 font-display text-lg font-semibold outline-none placeholder:text-muted-foreground"
          />
          {kind === "note" ? (
            <Suspense fallback={<Skeleton className="m-3 h-48" aria-label="Loading editor" />}>
              <NoteEditor
                compact
                content={content}
                format={item.content_format}
                onChange={(value) => {
                  setContent(value);
                  queue({ content: value });
                }}
              />
            </Suspense>
          ) : (
            <FilePreview item={item} onDownload={download} />
          )}
        </div>
      )}
    </>
  );
}

function FilePreview({ item, onDownload }: { item: LibraryItem; onDownload: () => void }) {
  const kind = itemKind(item);
  const media = kind === "image" || kind === "video" || kind === "audio";
  const { data: src, isLoading } = useSignedStorageUrl(
    "library-files",
    media ? item.file_url : null,
  );
  const Icon = KIND_ICON[kind];

  return (
    <div className="space-y-3 p-3">
      {kind === "link" && item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-lg bg-surface-elevated/60 p-3 text-sm transition-colors hover:bg-surface-elevated"
        >
          <Globe className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium">{linkFallbackTitle(item.url)}</span>
            <span className="text-xs text-muted-foreground">Open link ↗</span>
          </span>
        </a>
      ) : media && isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : kind === "image" && src ? (
        <img src={src} alt={item.title} className="max-h-80 w-full rounded-lg object-contain" />
      ) : kind === "video" && src ? (
        <video src={src} controls className="max-h-80 w-full rounded-lg bg-black" />
      ) : kind === "audio" && src ? (
        <audio src={src} controls className="w-full" />
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-surface-elevated/60 p-4">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {[item.file_type, formatFileSize(item.file_size)].filter(Boolean).join(" · ")}
            </span>
          </span>
        </div>
      )}
      {item.content && (
        <p className="text-sm text-muted-foreground">
          {getItemExcerpt(item.content, item.content_format)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.file_url && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Download
          </button>
        )}
        <Link
          to="/library/$id"
          params={{ id: item.id }}
          onClick={() => notesDock.close()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Open in Library
        </Link>
      </div>
    </div>
  );
}
