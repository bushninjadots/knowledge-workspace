// ── Hero header owner controls ───────────────────────────────────────────────
// Restores the in-place editing affordances that used to live on the profile
// hero: change banner, write a banner caption, edit identity fields, and jump
// to the header block's settings in Studio (photo shape, ring, banner overlay,
// caption position). Rendered as an overlay inside the header block's
// `relative` frame, owner-only.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Palette, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { validateImageFile } from "@/lib/validators";
import { useCropConfirm } from "@/components/tethyr/profile/crop-confirm-dialog";
import type { ProfileBackground } from "@/lib/background-themes";

const CAPTION_MAX = 60;
const QUICK_EMOJI = ["✨", "🚀", "🌿", "💜", "🎨", "🔥", "🌊", "☕️", "🎧", "🌸"];

type HeroIdentity = {
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  bio?: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  banner_caption?: string | null;
  banner_url?: string | null;
  background?: ProfileBackground | null;
  public_background?: ProfileBackground | null;
};

export function HeroEditControls({
  userId,
  identity,
  hasBanner,
  blockId,
  onChanged,
  onCompleteProfile,
}: {
  userId: string;
  identity: HeroIdentity;
  hasBanner: boolean;
  /** The header block, so "Header look" opens its settings in Studio. */
  blockId?: string;
  onChanged?: () => void;
  /** Opens the full identity-completion form (route-level "Edit details" dialog). */
  onCompleteProfile?: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(identity.banner_caption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const { requestCrop, dialog: cropDialog } = useCropConfirm();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["profile-header-block"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    onChanged?.();
  }

  async function uploadBanner(file: File) {
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    // Confirm the crop (3:1 band preview) before anything is stored.
    requestCrop(file, "banner", (payload, meta) => void doUpload(payload, meta));
  }

  async function doUpload(payload: File | Blob, meta: { ext: string; contentType: string }) {
    setUploading(true);
    // Use a unique path so the signed URL changes and the browser never serves
    // a stale cached copy when the banner is replaced.
    const previousPath = identity.banner_url;
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

  // The chip row floats over the banner when there is one. Without a banner
  // it would sit on the display name (40px name vs 30px chips = ~18px of
  // overlap), so in banner-less headers it becomes a normal right-aligned row
  // above the identity block instead.
  return (
    <>
      <div
        className={`z-20 flex flex-wrap items-center justify-end gap-2 ${
          hasBanner ? "absolute right-3 top-3" : "relative mb-3 w-full"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setCaptionDraft(identity.banner_caption ?? "");
            setEditingCaption(true);
            setTimeout(() => captionRef.current?.focus(), 0);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border on-media-control px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-lift hover:bg-background"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {identity.banner_caption ? "Edit caption" : "Add caption"}
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-lift hover:bg-background disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : hasBanner ? "Change banner" : "Add banner"}
        </button>

        <button
          type="button"
          onClick={() => onCompleteProfile?.()}
          className="inline-flex items-center gap-1.5 rounded-md border on-media-control px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-lift hover:bg-background"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit details
        </button>

        <Link
          to="/studio"
          search={blockId ? { block: blockId } : {}}
          title="Photo shape, ring, banner overlay and caption position"
          className="inline-flex items-center gap-1.5 rounded-md border on-media-control px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-lift hover:bg-background"
        >
          <Palette className="h-3.5 w-3.5" />
          Header look
        </Link>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadBanner(file);
          e.target.value = "";
        }}
      />

      {editingCaption && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-lg border on-media-control bg-background/95 p-3 backdrop-blur-sm">
          <Input
            ref={captionRef}
            value={captionDraft}
            maxLength={CAPTION_MAX}
            placeholder="Say something about this banner…"
            onChange={(e) => setCaptionDraft(e.target.value.slice(0, CAPTION_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveCaption();
              if (e.key === "Escape") setEditingCaption(false);
            }}
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Insert ${emoji}`}
                  onClick={() => setCaptionDraft((p) => (p + emoji).slice(0, CAPTION_MAX))}
                  className="rounded-md px-1.5 py-0.5 text-base leading-none hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {captionDraft.length}/{CAPTION_MAX}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingCaption(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void saveCaption()} disabled={savingCaption}>
                {savingCaption ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {cropDialog}
    </>
  );
}
