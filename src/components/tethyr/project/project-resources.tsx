import { useState } from "react";
import { Plus, Trash2, FileText, Wrench, Video, BookOpen, Link2 } from "lucide-react";
import { toast } from "sonner";
import { safeHref } from "@/lib/validators";
import type { ResourceItem, GalleryItem } from "@/hooks/use-projects";

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
  onUpdate: (items: ResourceItem[]) => void;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ResourceItem["type"]>("article");

  const handleAdd = () => {
    if (!title.trim() || !url.trim()) return;
    onUpdate([...resources, { title: title.trim(), url: url.trim(), type }]);
    setTitle("");
    setUrl("");
    setType("article");
    setShowAdd(false);
    toast.success("Resource added");
  };

  const handleRemove = (idx: number) => {
    onUpdate(resources.filter((_, i) => i !== idx));
    toast.success("Resource removed");
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
              disabled={!title.trim() || !url.trim()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              Save
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
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
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

export function GallerySection({
  gallery,
  onUpdate,
  isOwner,
}: {
  gallery: GalleryItem[];
  onUpdate: (items: GalleryItem[]) => void;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const handleAdd = () => {
    if (!url.trim()) return;
    onUpdate([
      ...gallery,
      { url: url.trim(), caption: caption.trim() || undefined, type: "image" },
    ]);
    setUrl("");
    setCaption("");
    setShowAdd(false);
    toast.success("Image added");
  };

  const handleRemove = (idx: number) => {
    onUpdate(gallery.filter((_, i) => i !== idx));
    toast.success("Image removed");
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
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Image URL"
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
              disabled={!url.trim()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              Save
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
              <img
                src={safeHref(g.url)}
                alt={g.caption ?? ""}
                className="aspect-square w-full object-cover"
              />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[10px] backdrop-blur">
                  {g.caption}
                </div>
              )}
              {isOwner && (
                <button
                  onClick={() => handleRemove(idx)}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
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
