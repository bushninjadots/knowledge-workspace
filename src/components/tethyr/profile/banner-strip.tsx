import { useRef, useState } from "react";
import { Camera, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile } from "@/lib/validators";
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
  showCaption = false,
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
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const accentColor = useDominantColor(bannerSigned);

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(bannerCaption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/banner.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("banners")
      .upload(path, file, { upsert: true, contentType: check.contentType });
    if (upErr) {
      setUploading(false);
      return toast.error(friendlyError(upErr));
    }
    const { error } = await supabase.from("profiles").update({ banner_url: path }).eq("id", userId);
    setUploading(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Banner updated");
    onChange();
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
    onChange();
  }

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
      disabled={uploading || readonly}
    >
      <div
        className="relative -m-6 mb-6 h-48 overflow-hidden rounded-t-xl border border-b-0 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-72"
        style={{ borderColor: accentColor ?? "transparent" }}
      >
        {bannerSigned ? (
          <img
            src={bannerSigned}
            alt=""
            width="1200"
            height="400"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
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
              className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs text-foreground hover:bg-background disabled:opacity-50"
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
              className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs text-foreground hover:bg-background disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : bannerSigned ? "Change banner" : "Add banner"}
            </button>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />

        {readonly && showCaption && bannerCaption && (
          <span
            className={`absolute bottom-4 z-20 max-w-44 truncate rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground sm:max-w-xs ${captionPosition === "left" ? "left-4" : captionPosition === "center" ? "left-1/2 -translate-x-1/2" : "right-4"}`}
          >
            {bannerCaption}
          </span>
        )}

        {!readonly &&
          (editingCaption ? (
            <div
              className="absolute bottom-4 left-32 right-4 z-20 flex flex-col gap-2 rounded-xl bg-background/85 p-3"
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
                className={`absolute bottom-4 z-20 max-w-44 truncate rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground transition hover:bg-background/80 sm:max-w-xs ${captionPosition === "left" ? "left-4" : captionPosition === "center" ? "left-1/2 -translate-x-1/2" : "right-4"}`}
                title="Click to edit caption"
              >
                {bannerCaption}
              </button>
            )
          ))}
      </div>
    </DragDropFileInput>
  );
}
