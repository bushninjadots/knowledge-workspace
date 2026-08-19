import { useEffect, useMemo, useState } from "react";
import { Ban, Check, ImagePlus, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { validateImageFile } from "@/lib/validators";
import {
  BACKGROUND_COLORS,
  BACKGROUND_PATTERNS,
  backgroundImagePublicUrl,
  backgroundStyle,
  type ProfileBackground,
} from "@/lib/background-themes";
import { cn } from "@/lib/utils";

const EMPTY_BACKGROUND: ProfileBackground = {
  mode: null,
  color: null,
  pattern: null,
  image_url: null,
};

/**
 * Editor for the member's app-wide backdrop. Colour and pattern choices are
 * curated so they tint rather than overwhelm; uploaded images are dimmed to
 * a readable wallpaper level. Persisted to profiles.background.
 */
export function BackgroundPickerDialog({
  open,
  onOpenChange,
  background,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  background: ProfileBackground | null;
  userId: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProfileBackground>(EMPTY_BACKGROUND);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed the draft each time the dialog opens so external changes (or a
  // just-saved background) are reflected.
  useEffect(() => {
    if (open) setDraft(background ?? EMPTY_BACKGROUND);
  }, [open, background]);

  const draftImageUrl = useMemo(
    () => (draft.image_url ? backgroundImagePublicUrl(draft.image_url) : null),
    [draft.image_url],
  );

  const previewStyle = useMemo(() => {
    const style = backgroundStyle(draft, draftImageUrl);
    // Mirror the real layer's dimming so the preview shows exactly what ships.
    return draft.mode === "image" ? { ...style, opacity: 0.25, filter: "saturate(0.9)" } : style;
  }, [draft, draftImageUrl]);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    const path = `${userId}/background.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("backgrounds")
      .upload(path, file, { upsert: true, contentType: check.contentType });
    setUploading(false);
    if (upErr) return toast.error(friendlyError(upErr));
    setDraft((d) => ({ ...d, mode: "image", image_url: path }));
  }

  function removeImage() {
    setDraft((d) => ({
      ...d,
      mode: d.color ? "color" : d.pattern ? "pattern" : null,
      image_url: null,
    }));
  }

  async function save() {
    setSaving(true);
    const payload = draft.mode ? draft : null;
    const { error } = await supabase
      .from("profiles")
      .update({ background: payload })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Background updated");
    onOpenChange(false);
    onSaved();
  }

  const hasCustom = draft.mode != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,44rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Background</DialogTitle>
          <DialogDescription>
            Set the backdrop for your whole Tethyr space — a colour, a pattern, or an image of your
            own. It sits quietly behind every page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* LIVE PREVIEW */}
          <div
            className="relative h-28 overflow-hidden rounded-xl border card-border"
            style={previewStyle}
          >
            {!hasCustom && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Tethyr default
              </div>
            )}
          </div>

          {/* COLOURS */}
          <section aria-labelledby="bg-colors-heading">
            <h3
              id="bg-colors-heading"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Colour
            </h3>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Background colours">
              <SwatchButton
                title="Tethyr default"
                selected={!hasCustom}
                onClick={() => setDraft(EMPTY_BACKGROUND)}
              >
                <Ban className="h-3.5 w-3.5 text-muted-foreground" />
              </SwatchButton>
              {BACKGROUND_COLORS.map((c) => {
                const selected = draft.mode === "color" && draft.color === c.color;
                return (
                  <SwatchButton
                    key={c.id}
                    title={c.label}
                    selected={selected}
                    style={{
                      backgroundColor: `color-mix(in oklab, ${c.color} 14%, var(--background))`,
                    }}
                    onClick={() => setDraft((d) => ({ ...d, mode: "color", color: c.color }))}
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-foreground/70" />}
                  </SwatchButton>
                );
              })}
            </div>
          </section>

          {/* PATTERNS */}
          <section aria-labelledby="bg-patterns-heading">
            <h3
              id="bg-patterns-heading"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Pattern
            </h3>
            <div
              className="mt-2 flex flex-wrap gap-2"
              role="group"
              aria-label="Background patterns"
            >
              {BACKGROUND_PATTERNS.map((p) => {
                const selected = draft.mode === "pattern" && draft.pattern === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    aria-pressed={selected}
                    onClick={() => setDraft((d) => ({ ...d, mode: "pattern", pattern: p.id }))}
                    className={cn(
                      "h-10 w-14 rounded-md border transition",
                      selected
                        ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
                        : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
                    )}
                    style={backgroundStyle({ ...draft, mode: "pattern", pattern: p.id })}
                  />
                );
              })}
            </div>
          </section>

          {/* IMAGE */}
          <section aria-labelledby="bg-image-heading">
            <h3
              id="bg-image-heading"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Your image
            </h3>
            <div className="mt-2">
              {draft.mode === "image" && draftImageUrl ? (
                <div className="flex items-center gap-3 rounded-xl border card-border bg-surface/40 p-3">
                  <img
                    src={draftImageUrl}
                    alt=""
                    className="h-16 w-24 rounded-lg border border-border/60 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">Custom image</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Shown as a subtle backdrop so text stays readable.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={removeImage}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              ) : (
                <DragDropFileInput accept="image/*" onFiles={handleFiles} disabled={uploading}>
                  <div className="flex h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-surface/30 text-xs text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground">
                    {uploading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploading
                      ? "Uploading…"
                      : "Upload an image (JPG, PNG, WEBP, GIF — up to 8 MB)"}
                  </div>
                </DragDropFileInput>
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setDraft(EMPTY_BACKGROUND)}
            disabled={!hasCustom}
            className="mr-auto text-muted-foreground"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset to default
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save background"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwatchButton({
  selected,
  title,
  onClick,
  style,
  children,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md border transition",
        selected
          ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
          : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
      )}
      style={style}
    >
      {children}
    </button>
  );
}
