import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile } from "@/lib/validators";
import { useCropConfirm } from "@/components/tethyr/profile/crop-confirm-dialog";
import { useDominantColor } from "@/lib/dominant-color";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { BannerOverlay } from "@/components/tethyr/profile/banner-overlay";

const QUICK_EMOJI = ["✨", "🚀", "🌿", "💜", "🎨", "🔥", "🌊", "☕️", "🎧", "🌸"];

const BANNER_CAPTION_MAX = 60;

/* -------- Banner strip (used inside HeaderCard) -------- */
export function BannerStrip({
  bannerSigned,
  bannerCaption,
  userId,
  onChange,
  overlay = "soft",
  captionPosition = "right",
  readonly = false,
  showCaption = true,
  bannerPath,
}: {
  bannerSigned: string | null;
  bannerCaption?: string | null;
  userId: string;
  onChange: () => void;
  overlay?: string | null;
  captionPosition?: "left" | "center" | "right" | null;
  readonly?: boolean;
  /** Show a non-interactive caption when readonly (viewer-facing banners). */
  showCaption?: boolean;
  /** Current storage path, so re-uploads can remove the previous file. */
  bannerPath?: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const accentColor = useDominantColor(bannerSigned);
  const queryClient = useQueryClient();

  // After a write, resync every surface that renders this profile — the studio
  // header block keeps its own query, so invalidating only `current-user`
  // leaves the dashboard and studio showing different captions/banners.
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["profile-header-block"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    onChange();
  }

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(bannerCaption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const { requestCrop, dialog: cropDialog } = useCropConfirm();

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    // Confirm the crop (3:1 band preview) before anything is stored.
    requestCrop(file, "banner", (payload, meta) => void doUpload(payload, meta));
    e.target.value = "";
  }

  async function doUpload(payload: File | Blob, meta: { ext: string; contentType: string }) {
    setUploading(true);
    // Use a unique path so the signed URL changes and the browser never serves
    // a stale cached copy when the banner is replaced.
    const previousPath = bannerPath;
    const path = `${userId}/banner-${Date.now()}.${meta.ext}`;
    const { error: upErr } = await supabase.storage
      .from("banners")
      .upload(path, payload, { upsert: true, contentType: meta.contentType });
    if (upErr) {
      setUploading(false);
      return toast.error(friendlyError(upErr));
    }
    const { error } = await supabase.from("profiles").update({ banner_url: path }).eq("id", userId);
    setUploading(false);
    if (error) return toast.error(friendlyError(error));
    // Clean up the previous file — best-effort, don't block the UI.
    if (previousPath && previousPath !== path) {
      supabase.storage.from("banners").remove([previousPath]);
    }
    toast.success("Banner updated");
    refresh();
  }

  function openCaptionEditor() {
    setCaptionDraft(bannerCaption ?? "");
    setEditingCaption(true);
    setTimeout(() => captionInputRef.current?.focus(), 0);
  }

  function insertEmoji(emoji: string) {
    setCaptionDraft((prev) => (prev + emoji).slice(0, BANNER_CAPTION_MAX));
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim();
    setSavingCaption(true);
    const { error } = await supabase
      .from("profiles")
      .update({ banner_caption: trimmed.length > 0 ? trimmed : null })
      .eq("id", userId);
    setSavingCaption(false);
    if (error) return toast.error(friendlyError(error));
    setEditingCaption(false);
    toast.success(trimmed ? "Caption updated" : "Caption cleared");
    refresh();
  }

  const banner = (
    <div
      className="group relative -m-6 mb-6 h-48 overflow-hidden rounded-t-xl border border-b-0 bg-surface-sunken transition-colors duration-150 sm:-m-8 sm:mb-8 sm:h-72"
      style={{ borderColor: accentColor ?? "transparent" }}
    >
      {bannerSigned ? (
        <img
          key={bannerSigned}
          src={bannerSigned}
          alt=""
          width="1200"
          height="400"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div className="h-full w-full bg-[linear-gradient(120deg,var(--ai)_0%,var(--trust)_100%)] opacity-40" />
      )}
      <BannerOverlay overlay={overlay} />

      {!readonly && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openCaptionEditor();
            }}
            disabled={uploading}
            aria-label={bannerCaption ? "Edit banner caption" : "Add a banner caption"}
            className="flex items-center gap-1.5 rounded-md border border-white/20 bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {bannerCaption ? "Edit caption" : "Add caption"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              ref.current?.click();
            }}
            disabled={uploading}
            aria-label={bannerSigned ? "Change profile banner" : "Add profile banner"}
            className="flex items-center gap-1.5 rounded-md border border-white/20 bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : bannerSigned ? "Change banner" : "Add banner"}
          </button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />

      {readonly && showCaption && bannerCaption && (
        <span
          className={`absolute bottom-4 z-20 w-[calc(100%-2rem)] truncate rounded-full bg-background/70 px-3 py-1.5 text-sm text-foreground backdrop-blur-sm ring-1 ring-border/40 ${captionPosition === "left" ? "left-4 text-left" : captionPosition === "center" ? "left-1/2 -translate-x-1/2 text-center" : "right-4 text-right"}`}
        >
          {bannerCaption}
        </span>
      )}

      {!readonly &&
        (editingCaption ? (
          <div
            className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2 rounded-lg border border-white/20 bg-background/90 p-3 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-32 sm:right-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              ref={captionInputRef}
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value.slice(0, BANNER_CAPTION_MAX))}
              placeholder="Say something fun about this banner…"
              maxLength={BANNER_CAPTION_MAX}
              className="h-9 bg-surface text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCaption();
                if (e.key === "Escape") setEditingCaption(false);
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-lg px-1.5 py-0.5 text-base leading-none hover:bg-surface"
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {captionDraft.length}/{BANNER_CAPTION_MAX}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setEditingCaption(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={saveCaption}
                  disabled={savingCaption}
                >
                  {savingCaption ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          bannerCaption && (
            <button
              onClick={openCaptionEditor}
              aria-label="Edit banner caption"
              className={`absolute bottom-4 z-20 w-[calc(100%-2rem)] truncate rounded-md border border-white/20 bg-background/80 px-3 py-1.5 text-sm text-foreground shadow-sm backdrop-blur-sm transition-lift hover:bg-background/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${captionPosition === "left" ? "left-4 text-left" : captionPosition === "center" ? "left-1/2 -translate-x-1/2 text-center" : "right-4 text-right"}`}
              title="Edit banner caption"
            >
              {bannerCaption}
            </button>
          )
        ))}
    </div>
  );

  // Readonly (viewer-facing) banners are purely presentational — skip the
  // drag-and-drop wrapper entirely so they never get a not-allowed cursor or
  // a disabled opacity wash.
  if (readonly) return banner;

  return (
    <DragDropFileInput
      accept="image/*"
      onFiles={(files) => {
        const file = files[0];
        if (file) {
          // Simulate the change event for the existing handler
          const dt = new DataTransfer();
          dt.items.add(file);
          const fakeEvent = { target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>;
          handle(fakeEvent);
        }
      }}
      disabled={uploading}
    >
      {banner}
      {cropDialog}
    </DragDropFileInput>
  );
}
