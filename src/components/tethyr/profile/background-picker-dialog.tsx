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
  BACKGROUND_DEFAULT_STRENGTH,
  BACKGROUND_GRADIENTS,
  BACKGROUND_MAX_STRENGTH,
  BACKGROUND_MIN_STRENGTH,
  BACKGROUND_PATTERNS,
  backgroundImagePublicUrl,
  backgroundStyle,
  clampStrength,
  emptyBackground,
  gradientBackgroundImage,
  imageOpacityFor,
  type ProfileBackground,
} from "@/lib/background-themes";
import { cn } from "@/lib/utils";

const EMPTY_BACKGROUND = emptyBackground();

type BgTab = "app" | "public";

/**
 * Editor for the member's backdrops. Colour and pattern choices are curated so
 * they tint rather than overwhelm; uploaded images are dimmed to a readable
 * wallpaper level. Two surfaces: the member's own app (everything behind their
 * authenticated pages) and their public Studio, which can fall back to the app
 * background or use its own. Persisted to profiles.background / .public_background.
 */
export function BackgroundPickerDialog({
  open,
  onOpenChange,
  background,
  publicBackground,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  background: ProfileBackground | null;
  publicBackground: ProfileBackground | null;
  userId: string;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<BgTab>("app");
  const [appDraft, setAppDraft] = useState<ProfileBackground>(EMPTY_BACKGROUND);
  const [publicDraft, setPublicDraft] = useState<ProfileBackground>(EMPTY_BACKGROUND);
  const [publicSeparate, setPublicSeparate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed the drafts each time the dialog opens so external changes (or a
  // just-saved background) are reflected.
  useEffect(() => {
    if (!open) return;
    setTab("app");
    setAppDraft(background ?? EMPTY_BACKGROUND);
    setPublicDraft(publicBackground ?? EMPTY_BACKGROUND);
    setPublicSeparate(publicBackground?.mode != null);
  }, [open, background, publicBackground]);

  const activeDraft = tab === "app" ? appDraft : publicDraft;
  const setActiveDraft = (updater: (d: ProfileBackground) => ProfileBackground) => {
    if (tab === "app") setAppDraft(updater);
    else setPublicDraft(updater);
  };

  const draftImageUrl = useMemo(
    () => (activeDraft.image_url ? backgroundImagePublicUrl(activeDraft.image_url) : null),
    [activeDraft.image_url],
  );

  const previewStyle = useMemo(() => {
    const style = backgroundStyle(activeDraft, draftImageUrl);
    // Mirror the real layer's dimming so the preview shows exactly what ships.
    return activeDraft.mode === "image"
      ? { ...style, opacity: imageOpacityFor(activeDraft.strength), filter: "saturate(0.9)" }
      : style;
  }, [activeDraft, draftImageUrl]);

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
    setActiveDraft((d) => ({ ...d, mode: "image", image_url: path }));
  }

  function removeImage() {
    setActiveDraft((d) => ({
      ...d,
      mode: d.color ? "color" : d.pattern ? "pattern" : d.gradient ? "gradient" : null,
      image_url: null,
    }));
  }

  function startSeparatePublic() {
    // Start the public draft from the app draft so switching isn't jarring.
    setPublicDraft(appDraft);
    setPublicSeparate(true);
  }

  async function save() {
    setSaving(true);
    const appPayload = appDraft.mode ? appDraft : null;
    const publicPayload = publicSeparate && publicDraft.mode ? publicDraft : null;
    const { error } = await supabase
      .from("profiles")
      .update({ background: appPayload, public_background: publicPayload })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Background updated");
    onOpenChange(false);
    onSaved();
  }

  const hasCustom = appDraft.mode != null || (publicSeparate && publicDraft.mode != null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,44rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Background</DialogTitle>
          <DialogDescription>
            Set the backdrop for your Tethyr space — a colour, a pattern, or an image of your own.
            It sits quietly behind every page.
          </DialogDescription>
        </DialogHeader>

        {/* SURFACE TABS */}
        <div
          className="flex items-center gap-1 rounded-xl border border-border/40 bg-background/40 p-1"
          role="tablist"
          aria-label="Where the background applies"
        >
          {(
            [
              { id: "app", label: "My app" },
              { id: "public", label: "Public Studio" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === id
                  ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-5 py-2">
          {/* PUBLIC STUDIO: same-as-app state */}
          {tab === "public" && !publicSeparate && (
            <div className="rounded-xl border card-border bg-surface/40 p-4">
              <p className="text-sm font-medium text-foreground">Same as your app</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your public Studio currently uses the background from your app. You can give it its
                own backdrop here.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={startSeparatePublic}>
                Set a different one
              </Button>
            </div>
          )}

          {tab === "public" && publicSeparate && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                A separate backdrop for visitors of your public Studio.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => setPublicSeparate(false)}
              >
                Use same as app
              </Button>
            </div>
          )}

          {(tab === "app" || (tab === "public" && publicSeparate)) && (
            <>
              {/* LIVE PREVIEW */}
              <div
                className="relative h-28 overflow-hidden rounded-xl border card-border"
                style={previewStyle}
              >
                {!activeDraft.mode && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    Tethyr default
                  </div>
                )}
              </div>

              {/* STRENGTH — how bold the backdrop is. Applies to colours,
                  patterns, and images alike. */}
              {activeDraft.mode && (
                <section aria-labelledby="bg-strength-heading">
                  <div className="flex items-center justify-between">
                    <h3
                      id="bg-strength-heading"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Strength
                    </h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {clampStrength(activeDraft.strength)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={BACKGROUND_MIN_STRENGTH}
                    max={BACKGROUND_MAX_STRENGTH}
                    step={2}
                    value={clampStrength(activeDraft.strength)}
                    onChange={(e) =>
                      setActiveDraft((d) => ({
                        ...d,
                        strength: Number(e.target.value),
                      }))
                    }
                    aria-label="Background strength"
                    className="mt-2 w-full accent-[var(--user-accent,var(--primary))]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Subtle</span>
                    <span>Default ({BACKGROUND_DEFAULT_STRENGTH}%)</span>
                    <span>Bold</span>
                  </div>
                </section>
              )}

              {/* GRADIENTS */}
              <section aria-labelledby="bg-gradients-heading">
                <h3
                  id="bg-gradients-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Gradient
                </h3>
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Background gradients"
                >
                  {BACKGROUND_GRADIENTS.map((g) => {
                    const selected =
                      activeDraft.mode === "gradient" && activeDraft.gradient === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        title={g.label}
                        aria-pressed={selected}
                        onClick={() =>
                          setActiveDraft((d) => ({
                            ...d,
                            mode: "gradient",
                            gradient: g.id,
                          }))
                        }
                        className={cn(
                          "h-10 w-14 rounded-md border transition",
                          selected
                            ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
                            : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
                        )}
                        style={{
                          backgroundColor: "var(--background)",
                          backgroundImage:
                            gradientBackgroundImage(g, clampStrength(activeDraft.strength)) ??
                            undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </section>

              {/* COLOURS */}
              <section aria-labelledby="bg-colors-heading">
                <h3
                  id="bg-colors-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Colour
                </h3>
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Background colours"
                >
                  <SwatchButton
                    title="Tethyr default"
                    selected={!activeDraft.mode}
                    onClick={() => setActiveDraft(() => EMPTY_BACKGROUND)}
                  >
                    <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                  </SwatchButton>
                  {BACKGROUND_COLORS.map((c) => {
                    const selected = activeDraft.mode === "color" && activeDraft.color === c.color;
                    return (
                      <SwatchButton
                        key={c.id}
                        title={c.label}
                        selected={selected}
                        style={{
                          backgroundColor: `color-mix(in oklab, ${c.color} ${clampStrength(activeDraft.strength)}%, var(--background))`,
                        }}
                        onClick={() =>
                          setActiveDraft((d) => ({ ...d, mode: "color", color: c.color }))
                        }
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
                    const selected = activeDraft.mode === "pattern" && activeDraft.pattern === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.label}
                        aria-pressed={selected}
                        onClick={() =>
                          setActiveDraft((d) => ({ ...d, mode: "pattern", pattern: p.id }))
                        }
                        className={cn(
                          "h-10 w-14 rounded-md border transition",
                          selected
                            ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
                            : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
                        )}
                        style={backgroundStyle({ ...activeDraft, mode: "pattern", pattern: p.id })}
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
                  {activeDraft.mode === "image" && draftImageUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border card-border bg-surface/40 p-3">
                      <img
                        src={draftImageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              if (tab === "app") setAppDraft(EMPTY_BACKGROUND);
              else {
                setPublicDraft(EMPTY_BACKGROUND);
                setPublicSeparate(false);
              }
            }}
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
