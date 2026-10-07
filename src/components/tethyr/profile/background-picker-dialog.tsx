import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  appearanceStyle,
  backgroundImageSignedUrl,
  backgroundStyle,
  clampStrength,
  emptyBackground,
  gradientBackgroundImage,
  imageOpacityFor,
  type ProfileBackground,
} from "@/lib/background-themes";
import { useDominantColor } from "@/lib/dominant-color";
import { cn } from "@/lib/utils";

const EMPTY_BACKGROUND = emptyBackground();

/** The backdrop fields this dialog owns. The same document also carries the
 *  header look and card-border choices, which are edited elsewhere and must
 *  survive a background change or reset untouched. */
const BACKDROP_KEYS = [
  "mode",
  "color",
  "colorSource",
  "pattern",
  "gradient",
  "image_url",
  "strength",
] as const;

function backdropOf(background: ProfileBackground): Partial<ProfileBackground> {
  return Object.fromEntries(BACKDROP_KEYS.map((key) => [key, background[key] ?? null]));
}

/** Back to Tethyr's plain background, keeping everything that isn't the backdrop. */
function clearBackdrop(background: ProfileBackground): ProfileBackground {
  return { ...background, mode: null, colorSource: null, strength: BACKGROUND_DEFAULT_STRENGTH };
}

export type BackgroundScope = "app" | "page";

const COPY: Record<BackgroundScope, { title: string; description: string }> = {
  app: {
    title: "App background",
    description:
      "A colour, pattern or image behind Tethyr while you use it. Your public page uses it too, unless you give the page its own in Studio → Style.",
  },
  page: {
    title: "Page background",
    description: "A colour, pattern or image behind your public page, for everyone who visits.",
  },
};

/**
 * Picker for one backdrop. "app" is the member's own Tethyr (profiles.background);
 * "page" is their public page (profiles.public_background), which can simply use
 * the app background. Photo shape, ring and banner overlay live in the header
 * block's settings; Tethyr's accent and density live in Site appearance.
 */
export function BackgroundPickerDialog({
  open,
  onOpenChange,
  scope,
  background,
  publicBackground,
  userId,
  onSaved,
  bannerUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: BackgroundScope;
  background: ProfileBackground | null;
  publicBackground: ProfileBackground | null;
  userId: string;
  onSaved: () => void;
  /** Signed banner image URL. Lets the "From your banner" swatch show the exact tint. */
  bannerUrl?: string | null;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileBackground>(EMPTY_BACKGROUND);
  // Page scope only: whether the page has its own backdrop.
  const [separate, setSeparate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed each time the dialog opens so external changes are reflected.
  useEffect(() => {
    if (!open) return;
    const pageOwn = publicBackground?.mode != null;
    setSeparate(pageOwn);
    setDraft(scope === "page" && pageOwn ? publicBackground : (background ?? EMPTY_BACKGROUND));
  }, [open, scope, background, publicBackground]);

  const editing = scope === "app" || separate;

  const { data: draftImageUrl = null } = useQuery({
    queryKey: ["signed-background", draft.image_url],
    queryFn: () => backgroundImageSignedUrl(draft.image_url),
    enabled: !!draft.image_url,
    staleTime: 60 * 60 * 1000,
  });

  const bannerColor = useDominantColor(bannerUrl ?? null);

  const previewStyle = useMemo(() => {
    const style = {
      ...appearanceStyle(draft),
      ...backgroundStyle(draft, draftImageUrl, bannerColor),
    };
    // Mirror the real layer's dimming so the preview shows exactly what ships.
    return draft.mode === "image"
      ? { ...style, opacity: imageOpacityFor(draft.strength), filter: "saturate(0.9)" }
      : style;
  }, [draft, draftImageUrl, bannerColor]);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    // Use a unique path so the browser doesn't serve a stale cached copy
    // when the user re-uploads with the same file extension.
    const previousPath = draft.image_url;
    const path = `${userId}/background-${Date.now()}.${check.ext}`;
    const { error: upErr } = await supabase.storage
      .from("backgrounds")
      .upload(path, file, { contentType: check.contentType });
    setUploading(false);
    if (upErr) return toast.error(friendlyError(upErr));
    // Clean up the previous file — best-effort, don't block the UI.
    if (previousPath) {
      supabase.storage.from("backgrounds").remove([previousPath]);
    }
    setDraft((d) => ({ ...d, mode: "image", image_url: path }));
  }

  function removeImage() {
    setDraft((d) => ({
      ...d,
      mode: d.color ? "color" : d.pattern ? "pattern" : d.gradient ? "gradient" : null,
      image_url: null,
    }));
  }

  async function save() {
    setSaving(true);
    const base = background ?? EMPTY_BACKGROUND;
    const update =
      scope === "app"
        ? { background: { ...base, ...backdropOf(draft) } }
        : {
            // The page's own document starts as a copy of the app one, so the
            // header look and card borders carry over; null = use the app's.
            public_background: separate
              ? { ...(publicBackground ?? base), ...backdropOf(draft) }
              : null,
          };
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(scope === "app" ? "App background saved" : "Page background saved");
    void queryClient.invalidateQueries({ queryKey: ["profile-header-block"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,44rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{COPY[scope].title}</DialogTitle>
          <DialogDescription>{COPY[scope].description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {scope === "page" && !separate && (
            <Card className="bg-surface/40 p-4">
              <p className="text-sm font-medium text-foreground">Same as your app background</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your page shows the backdrop you use in Tethyr. Give it its own to show visitors
                something different.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setDraft(background ?? EMPTY_BACKGROUND);
                  setSeparate(true);
                }}
              >
                Give my page its own
              </Button>
            </Card>
          )}

          {scope === "page" && separate && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Only your public page uses this.</p>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => setSeparate(false)}
              >
                Use my app background
              </Button>
            </div>
          )}

          {editing && (
            <>
              {/* LIVE PREVIEW */}
              <div
                className="relative h-28 overflow-hidden rounded-xl border card-border"
                style={previewStyle}
              >
                <div className="absolute inset-3 flex min-w-0 items-center">
                  <div className="content-safe min-w-0 flex-1 rounded-lg border card-border bg-card/90 p-2">
                    <p className="truncate text-[10px] font-semibold">Your project</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      How cards sit on this background
                    </p>
                  </div>
                </div>
              </div>

              {/* STRENGTH — how bold the backdrop is. Applies to colours,
              patterns, and images alike. */}
              {draft.mode && (
                <section aria-labelledby="bg-strength-heading">
                  <div className="flex items-center justify-between">
                    <h3
                      id="bg-strength-heading"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Strength
                    </h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {clampStrength(draft.strength)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={BACKGROUND_MIN_STRENGTH}
                    max={BACKGROUND_MAX_STRENGTH}
                    step={2}
                    value={clampStrength(draft.strength)}
                    onChange={(e) =>
                      setDraft((d) => ({
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
                    const selected = draft.mode === "gradient" && draft.gradient === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        title={g.label}
                        aria-pressed={selected}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            mode: "gradient",
                            gradient: g.id,
                          }))
                        }
                        className={cn(
                          "h-10 w-14 rounded-md border transition-lift",
                          selected
                            ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
                            : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
                        )}
                        style={{
                          backgroundColor: "var(--background)",
                          backgroundImage:
                            gradientBackgroundImage(g, clampStrength(draft.strength)) ?? undefined,
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a tint, or follow the colour in your banner image so the backdrop keeps in
                  step with it.
                </p>
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Background colours"
                >
                  <SwatchButton
                    title="Tethyr default"
                    selected={!draft.mode}
                    onClick={() => setDraft(clearBackdrop)}
                  >
                    <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                  </SwatchButton>
                  <SwatchButton
                    title={
                      bannerColor
                        ? "From your banner — follows the banner image"
                        : "From your banner — add a banner image to see the tint"
                    }
                    selected={draft.mode === "color" && draft.colorSource === "banner"}
                    style={
                      bannerColor
                        ? {
                            backgroundColor: `color-mix(in oklab, ${bannerColor} ${clampStrength(draft.strength)}%, var(--background))`,
                          }
                        : undefined
                    }
                    onClick={() =>
                      setDraft((d) => ({ ...d, mode: "color", colorSource: "banner" }))
                    }
                  >
                    {draft.mode === "color" && draft.colorSource === "banner" ? (
                      <Check className="h-3.5 w-3.5 text-foreground/70" />
                    ) : (
                      <Sparkles
                        className={cn(
                          "h-3.5 w-3.5",
                          bannerColor ? "text-foreground/70" : "text-muted-foreground",
                        )}
                      />
                    )}
                  </SwatchButton>
                  {BACKGROUND_COLORS.map((c) => {
                    const selected =
                      draft.colorSource !== "banner" &&
                      draft.mode === "color" &&
                      draft.color === c.color;
                    return (
                      <SwatchButton
                        key={c.id}
                        title={c.label}
                        selected={selected}
                        style={{
                          backgroundColor: `color-mix(in oklab, ${c.color} ${clampStrength(draft.strength)}%, var(--background))`,
                        }}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            mode: "color",
                            color: c.color,
                            colorSource: null,
                          }))
                        }
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-foreground/70" />}
                      </SwatchButton>
                    );
                  })}
                </div>
                <p className="mt-2 flex items-center gap-1 text-2xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                  {bannerColor
                    ? "Takes its tint from your banner, and changes when your banner does."
                    : "Takes its tint from your banner. Add a banner image to use it."}
                </p>
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
                          "h-10 w-14 rounded-md border transition-lift",
                          selected
                            ? "border-[var(--user-accent,var(--primary))] ring-2 ring-[var(--user-accent,var(--primary))]/40"
                            : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
                        )}
                        style={{
                          ...backgroundStyle(
                            { ...draft, mode: "pattern", pattern: p.id },
                            null,
                            bannerColor,
                          ),
                          backgroundColor:
                            backgroundStyle(
                              { ...draft, mode: "pattern", pattern: p.id },
                              null,
                              bannerColor,
                            ).backgroundColor ?? "var(--background)",
                        }}
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
                    <Card className="flex items-center gap-3 bg-surface/40 p-3">
                      <img
                        src={draftImageUrl}
                        alt=""
                        width="96"
                        height="64"
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
                    </Card>
                  ) : (
                    <DragDropFileInput accept="image/*" onFiles={handleFiles} disabled={uploading}>
                      <div className="flex h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-surface/30 text-xs text-muted-foreground transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground">
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
            onClick={() => setDraft(clearBackdrop)}
            disabled={!editing || !draft.mode}
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
        "flex h-9 w-9 items-center justify-center rounded-md border transition-lift",
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
