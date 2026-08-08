import { useState, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Wrench,
  Video,
  BookOpen,
  Link2,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { safeHref, validateLibraryFile } from "@/lib/validators";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import type { ResourceItem, GalleryItem } from "@/hooks/use-projects";

const sb = supabase as any;

const RESOURCE_ICON: Record<string, typeof FileText> = {
  article: FileText,
  tool: Wrench,
  video: Video,
  doc: BookOpen,
  other: Link2,
};

const RESOURCE_LABEL: Record<string, string> = {
  article: "Article",
  tool: "Tool",
  video: "Video",
  doc: "Document",
  other: "Link",
};

export function ResourcesSection({
  resources,
  onUpdate,
  isOwner,
}: {
  resources: ResourceItem[];
  onUpdate: (items: ResourceItem[]) => void | Promise<void>;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ResourceItem["type"]>("article");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onUpdate([...resources, { title: title.trim(), url: url.trim(), type }]);
      setTitle("");
      setUrl("");
      setType("article");
      setShowAdd(false);
      toast.success("Resource added");
    } catch {
      // Error toast already shown by the caller.
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (idx: number) => {
    setSaving(true);
    try {
      await onUpdate(resources.filter((_, i) => i !== idx));
      toast.success("Resource removed");
    } catch {
      // Error toast already shown by the caller.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Resources</h3>
        {isOwner && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resource title"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ResourceItem["type"])}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="article">Article</option>
            <option value="tool">Tool</option>
            <option value="video">Video</option>
            <option value="doc">Document</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim() || !url.trim() || saving}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resources yet.</p>
      ) : (
        <div className="space-y-2">
          {resources.map((r, idx) => {
            const Icon = RESOURCE_ICON[r.type] ?? Link2;
            return (
              <div key={idx} className="flex items-center gap-3 rounded-xl bg-background/40 p-3">
                <Icon className="h-4 w-4 shrink-0 text-brand-purple" />
                <div className="min-w-0 flex-1">
                  <a
                    href={safeHref(r.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {r.title}
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    {RESOURCE_LABEL[r.type] ?? r.type}
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRemove(idx)}
                    disabled={saving}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a gallery image. Storage paths (project-media is a private bucket)
 * are signed on demand; full http(s) URLs pass through untouched.
 */
export function GalleryThumb({
  url,
  alt,
  className,
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  // safeHref returns "#" for anything that isn't a safe http(s) URL — so
  // storage paths (project-media is a private bucket) get signed, external
  // URLs pass through validated, and anything sketchy falls back to a blank.
  const isExternal = safeHref(url) !== "#";
  const { data: signedUrl } = useSignedStorageUrl("project-media", isExternal ? null : url);
  const src = isExternal ? safeHref(url) : (signedUrl ?? "");
  if (!src) {
    return <div className={className ?? ""} aria-hidden />;
  }
  return <img src={src} alt={alt ?? ""} className={className} />;
}

export function GallerySection({
  gallery,
  onUpdate,
  isOwner,
  projectId,
}: {
  gallery: GalleryItem[];
  onUpdate: (items: GalleryItem[]) => void | Promise<void>;
  isOwner: boolean;
  projectId?: string;
}) {
  const { data: me } = useCurrentUser();
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!me?.userId || !projectId) return;
      const check = validateLibraryFile(file);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      setUploading(true);
      try {
        // project-media is a private bucket, so the gallery stores the storage
        // *path* — GalleryThumb signs it at render time.
        const path = `${projectId}/gallery-${Date.now()}.${check.ext}`;
        const { error: upErr } = await sb.storage.from("project-media").upload(path, file);
        if (upErr) throw upErr;
        await onUpdate([
          ...gallery,
          { url: path, caption: caption.trim() || undefined, type: "image" },
        ]);
        setCaption("");
        setShowAdd(false);
        toast.success("Image uploaded");
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [me?.userId, projectId, gallery, caption, onUpdate],
  );

  const handleAdd = async () => {
    if (!url.trim()) return;
    setSaving(true);
    try {
      await onUpdate([
        ...gallery,
        { url: url.trim(), caption: caption.trim() || undefined, type: "image" },
      ]);
      setUrl("");
      setCaption("");
      setShowAdd(false);
      toast.success("Image added");
    } catch {
      // Error toast already shown by the caller.
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (idx: number) => {
    setSaving(true);
    try {
      await onUpdate(gallery.filter((_, i) => i !== idx));
      toast.success("Image removed");
    } catch {
      // Error toast already shown by the caller.
    } finally {
      setSaving(false);
    }
  };

  if (gallery.length === 0 && !isOwner) return null;

  return (
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Gallery</h3>
        {isOwner && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            {projectId && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            )}
            <span className="py-2 text-xs text-muted-foreground">or</span>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://... paste image URL"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!url.trim() || saving}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {gallery.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gallery.map((g, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-2xl border border-border/60"
            >
              <GalleryThumb
                url={g.url}
                alt={g.caption ?? ""}
                className="aspect-square w-full object-cover"
              />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[11px] backdrop-blur">
                  {g.caption}
                </div>
              )}
              {isOwner && (
                <button
                  onClick={() => handleRemove(idx)}
                  disabled={saving}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
