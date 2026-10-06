import { useEffect, useRef, useState } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Image, Camera, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { MediaLightbox } from "@/components/tethyr/media-lightbox";
import { registerBlock } from "@/lib/block-registry";
import { validateImageFile } from "@/lib/validators";
import { friendlyError } from "@/lib/error-message";
import type { BlockProps } from "@/lib/page-blocks";

/** One entry of profiles.evidence_shelf — the owner-curated shelf this block reads. */
type ShelfItem = {
  project_id?: string;
  activity_id?: string;
  title?: string;
  note?: string | null;
  url?: string | null;
  kind?: string;
};

type GalleryItem = {
  /** Index within the raw shelf, so a removal writes the exact array back. */
  shelfIndex: number;
  title: string;
  kind: string;
  url: string | null;
};

/** The shelf is deliberately small; the DB comment caps it at 6 items. */
const MAX_SHELF_ITEMS = 6;
const GALLERY_BUCKET = "project-media";

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

function ProfileGalleryBlock({ config, context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { onBlockEmptyChange, isEditing, blockId } = context;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: shelf, isLoading } = useQuery({
    queryKey: ["profile-gallery-shelf", profileId],
    queryFn: async (): Promise<ShelfItem[]> => {
      if (!profileId) return [];
      // The profile's evidence shelf is a jsonb array on profiles — the same
      // data the "Evidence shelf" section on the public Studio renders.
      const { data: profile } = await supabase
        .from("profiles")
        .select("evidence_shelf")
        .eq("id", profileId)
        .maybeSingle();
      return (profile?.evidence_shelf ?? []) as unknown as ShelfItem[];
    },
    enabled: !!profileId,
  });

  const entries = (shelf ?? [])
    .map((entry, shelfIndex) => ({ entry, shelfIndex }))
    .filter(({ entry }) => entry.kind === "image" || entry.kind === "video");

  // Uploads land in a private bucket, so the shelf stores the storage path and
  // this block signs it for display. Fully-qualified http(s) links pass through.
  const storagePaths = entries
    .map(({ entry }) => entry.url)
    .filter((url): url is string => !!url && !isHttpUrl(url));

  const { data: signedUrls } = useQuery({
    queryKey: ["profile-gallery-signed", profileId, storagePaths.join("|")],
    queryFn: async (): Promise<Record<string, string>> => {
      if (storagePaths.length === 0) return {};
      const { data } = await supabase.storage
        .from(GALLERY_BUCKET)
        .createSignedUrls(storagePaths, 60 * 60 * 24);
      return Object.fromEntries(
        (data ?? [])
          .filter((entry) => entry.signedUrl)
          .map((entry) => [entry.path, entry.signedUrl as string]),
      );
    },
    enabled: storagePaths.length > 0,
  });

  const resolveUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    return isHttpUrl(url) ? url : (signedUrls?.[url] ?? null);
  };

  const items: GalleryItem[] = entries.map(({ entry, shelfIndex }) => ({
    shelfIndex,
    title: entry.title || "Untitled",
    kind: entry.kind ?? "image",
    url: resolveUrl(entry.url),
  }));
  const hasContent = items.length > 0;

  // Report emptiness so the page renderer can collapse this section in view
  // mode. Never report while loading — a premature "empty" gets the block
  // unmounted by the renderer before the query resolves.
  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [isLoading, isEditing, blockId, onBlockEmptyChange, hasContent]);

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  // Lightbox list follows the grid's rendered order (url-bearing items only).
  const lightboxImages = items
    .filter((item) => item.url)
    .map((item) => ({ src: item.url as string, alt: item.title, caption: item.title }));

  async function writeShelf(next: ShelfItem[]) {
    if (!profileId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ evidence_shelf: next as never })
      .eq("id", profileId);
    if (error) throw error;
    void queryClient.invalidateQueries({ queryKey: ["profile-gallery-shelf"] });
  }

  async function addImages(files: File[]) {
    if (!profileId || files.length === 0) return;
    const current = shelf ?? [];
    const room = MAX_SHELF_ITEMS - current.length;
    if (room <= 0) {
      toast.error(`Your gallery holds up to ${MAX_SHELF_ITEMS} items.`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more image${room === 1 ? "" : "s"} fit in the gallery.`);
    }
    const accepted = files.slice(0, room);
    setUploading(true);
    try {
      const added: ShelfItem[] = [];
      for (const file of accepted) {
        const check = validateImageFile(file);
        if (!check.ok) {
          toast.error(check.error);
          continue;
        }
        // project-media is private; store the path and sign it at render time.
        const path = `${profileId}/gallery-${Date.now()}-${added.length}.${check.ext}`;
        const { error: uploadError } = await supabase.storage
          .from(GALLERY_BUCKET)
          .upload(path, file, { contentType: check.contentType });
        if (uploadError) throw uploadError;
        added.push({
          project_id: "",
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Image",
          url: path,
          kind: "image",
        });
      }
      if (added.length === 0) return;
      await writeShelf([...current, ...added]);
      toast.success(added.length === 1 ? "Image added" : `${added.length} images added`);
    } catch (error) {
      toast.error(friendlyError(error as Error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(shelfIndex: number) {
    const current = shelf ?? [];
    const removed = current[shelfIndex];
    setBusy(true);
    try {
      await writeShelf(current.filter((_, index) => index !== shelfIndex));
      // Best-effort cleanup of our own uploads; pasted links are left alone.
      if (removed?.url && !isHttpUrl(removed.url)) {
        supabase.storage.from(GALLERY_BUCKET).remove([removed.url]);
      }
      toast.success("Removed from gallery");
    } catch (error) {
      toast.error(friendlyError(error as Error, "Could not remove image"));
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length) void addImages(files);
        event.target.value = "";
      }}
    />
  );

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  if (items.length === 0) {
    // Editing shows the uploader; view mode collapses so the section drops out.
    if (isEditing)
      return (
        <>
          <BlockEmptyState
            label="Gallery"
            detail="Show the work, references, and moments behind what you create."
            actionLabel={uploading ? "Uploading…" : "Add images"}
            onAction={() => fileRef.current?.click()}
          />
          {fileInput}
        </>
      );
    return null;
  }
  return (
    <div>
      <BlockTitle
        config={config}
        count={items.length}
        action={
          isEditing ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {uploading ? "Uploading…" : "Add images"}
            </button>
          ) : undefined
        }
      >
        Gallery
      </BlockTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.shelfIndex}
            className="group relative aspect-square overflow-hidden rounded-lg bg-surface-sunken"
          >
            {item.url ? (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex(lightboxImages.findIndex((im) => im.src === item.url))
                }
                aria-label={`View ${item.title} fullscreen`}
                className="block h-full w-full cursor-zoom-in"
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="flex h-full items-center justify-center">
                {item.kind === "video" ? (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Image className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
            {config.showCaptions !== false && (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 on-media-scrim" />
                <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="text-[10px] text-white truncate">{item.title}</p>
                </div>
              </>
            )}
            {isEditing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeImage(item.shelfIndex)}
                aria-label={`Remove ${item.title} from gallery`}
                className="absolute right-1.5 top-1.5 z-10 rounded-md border on-media-control bg-background/80 p-1 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {fileInput}

      <MediaLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
registerBlock({
  type: "profile-gallery",
  category: "work",
  label: "Gallery",
  title: "Gallery",
  description: "Images and videos shared as evidence.",
  icon: "Image",
  defaults: { showCaptions: true },
  fields: [{ key: "showCaptions", label: "Show captions on hover", type: "toggle" }],
  component: ProfileGalleryBlock,
});
export { ProfileGalleryBlock };
