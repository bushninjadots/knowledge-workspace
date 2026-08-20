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
  ImagePlus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { safeHref, validateLibraryFile } from "@/lib/validators";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { useProjectLibraryItems } from "@/hooks/use-library";
import type { ResourceItem, GalleryItem } from "@/hooks/use-projects";

const sb = supabase;

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
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
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
        <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
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
 * Library resources explicitly linked to this project. Visible to the project
 * team (the library items are readable by the owner + project members via RLS),
 * and each item opens in the authenticated library.
 */
export function ProjectLibrarySection({
  projectId,
  isOwner,
}: {
  projectId: string;
  isOwner: boolean;
}) {
  const { data: items } = useProjectLibraryItems(projectId);

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Library</h3>
        {isOwner && (
          <Link to="/library" className="text-xs font-medium text-primary hover:underline">
            Open library →
          </Link>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/library/$id"
            params={{ id: item.id }}
            className="flex items-center gap-3 rounded-xl bg-background/40 p-3 transition hover:bg-surface-elevated/50"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-brand-green" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={item.title}>
                {item.title}
              </p>
              <p className="text-[11px] capitalize text-muted-foreground">{item.type}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a gallery image. Storage paths (project-media is a private bucket)
 * are signed on demand; full http(s) URLs pass through untouched.
 */
export function GalleryMedia({
  url,
  type,
  alt,
  className,
}: {
  url: string;
  type: GalleryItem["type"];
  alt?: string;
  className?: string;
}) {
  // Storage paths are private and need a signed URL; external URLs are only
  // accepted when they are safe http(s) links.
  const isExternal = safeHref(url) !== "#";
  const { data: signedUrl } = useSignedStorageUrl("project-media", isExternal ? null : url);
  const src = isExternal ? safeHref(url) : (signedUrl ?? "");
  if (!src) return <div className={className ?? "bg-surface-sunken"} aria-hidden />;

  if (type === "video") {
    return (
      <video
        src={src}
        className={className}
        controls
        playsInline
        preload="metadata"
        aria-label={alt || "Project demonstration video"}
      />
    );
  }
  return <img src={src} alt={alt ?? ""} className={className} loading="lazy" decoding="async" />;
}

/** Backwards-compatible image renderer for project cards and older callers. */
export function GalleryThumb({
  url,
  alt,
  className,
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  return <GalleryMedia url={url} type="image" alt={alt} className={className} />;
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
  const [mediaType, setMediaType] = useState<GalleryItem["type"]>("image");
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
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const isVideo = file.type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext);
      const isImage =
        file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
      if (!isVideo && !isImage) {
        toast.error("Demonstrations must be an image, GIF, or video.");
        return;
      }
      setUploading(true);
      try {
        // project-media is a private bucket, so the gallery stores the storage
        // path — GalleryMedia signs it at render time.
        const uploadedType: GalleryItem["type"] = isVideo ? "video" : "image";
        const path = `${projectId}/gallery-${Date.now()}.${check.ext}`;
        const { error: upErr } = await sb.storage
          .from("project-media")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        await onUpdate([
          ...gallery,
          { url: path, caption: caption.trim() || undefined, type: uploadedType },
        ]);
        setCaption("");
        setShowAdd(false);
        toast.success(uploadedType === "video" ? "Video uploaded" : "Image uploaded");
      } catch (err: unknown) {
        toast.error(friendlyError(err, "Upload failed"));
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
        { url: url.trim(), caption: caption.trim() || undefined, type: mediaType },
      ]);
      setUrl("");
      setCaption("");
      setMediaType("image");
      setShowAdd(false);
      toast.success(mediaType === "video" ? "Video added" : "Image added");
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
      toast.success("Demonstration removed");
    } catch {
      // Error toast already shown by the caller.
    } finally {
      setSaving(false);
    }
  };

  if (gallery.length === 0 && !isOwner) return null;

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground/80">Demonstrations</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Show the work in motion with images, GIFs, or video.
          </p>
        </div>
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
        <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/*"
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as GalleryItem["type"])}
              className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-36"
              aria-label="Demonstration type"
            >
              <option value="image">Image or GIF</option>
              <option value="video">Video</option>
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                mediaType === "video"
                  ? "https://… paste video URL"
                  : "https://… paste image or GIF URL"
              }
              className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
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

      {gallery.length === 0 && isOwner && !showAdd && (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center">
          <ImagePlus className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">Show the work, not just the description</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Add a screenshot, looping GIF, or short video so collaborators can understand the
            project faster.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Add a demonstration
          </button>
        </div>
      )}

      {gallery.length > 0 && (
        <div className="content-safe grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((g, idx) => (
            <div
              key={idx}
              className="content-safe group relative min-w-0 overflow-hidden rounded-xl border card-border bg-background/30"
            >
              <GalleryMedia
                url={g.url}
                type={g.type}
                alt={g.caption ?? ""}
                className="aspect-video w-full max-w-full object-cover"
              />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[11px]">
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
