// ── Inline Inspector ──────────────────────────────────────────────────────────
// Floating settings panel for a single block, opened from its Configure (gear)
// control in edit mode. Renders a control for every registered BlockField and
// writes changes immediately (persist-on-change — there is no save button).

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlockConfig, BlockDefinition, LayoutBlockInstance } from "@/lib/page-blocks";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { validateImageFile } from "@/lib/validators";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProfileMediaControls } from "@/components/tethyr/studio/profile-media-controls";

interface InlineInspectorProps {
  block: LayoutBlockInstance;
  definition: BlockDefinition;
  onChange: (config: BlockConfig) => void;
  onRemove: () => void;
  onClose: () => void;
  onBlockLayoutChange?: (layout: Pick<LayoutBlockInstance, "column" | "span">) => void;
  ownerId?: string;
  profileMedia?: { avatarUrl: string | null; bannerUrl: string | null };
  onProfileMediaSaved?: () => void;
}

function stringValue(config: BlockConfig, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value.trim());
}

export function InlineInspector({
  block,
  definition,
  onChange,
  onRemove,
  onClose,
  onBlockLayoutChange,
  ownerId,
  profileMedia,
  onProfileMediaSaved,
}: InlineInspectorProps) {
  const fields = definition.fields;
  const [uploading, setUploading] = useState(false);
  // Local draft edits so text inputs stay responsive while their writes are
  // debounced (avoiding a full config save on every keystroke).
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  function set<Key extends string>(key: Key, value: unknown) {
    const pendingTimer = debounceTimersRef.current[key];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      delete debounceTimersRef.current[key];
    }
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    onChange({ ...block.config, [key]: value });
  }

  // Like set(), but defers the parent write until the user pauses. Dragged color
  // pickers and rapid typing collapse into a single save.
  function debouncedSet(key: string, value: unknown) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    if (debounceTimersRef.current[key]) clearTimeout(debounceTimersRef.current[key]);
    debounceTimersRef.current[key] = setTimeout(() => {
      setDrafts((prev) => {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });
      delete debounceTimersRef.current[key];
      onChange({ ...block.config, [key]: value });
    }, 350);
  }

  // Prefer an in-flight draft so the field never lags behind the debounce.
  function fieldValue(key: string): unknown {
    return key in drafts ? drafts[key] : block.config[key];
  }

  function stringFieldValue(key: string): string {
    const value = fieldValue(key);
    return typeof value === "string" ? value : "";
  }

  return (
    <div
      role="dialog"
      aria-label={`${definition.label} settings`}
      className="fixed inset-x-3 bottom-3 z-50 max-h-[75vh] overflow-y-auto rounded-xl border border-card-border bg-surface-elevated px-4 py-3 shadow-xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-24 sm:w-72 sm:max-h-[70vh]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {definition.label}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{definition.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 h-6 w-6 shrink-0"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {profileMedia && ownerId && onProfileMediaSaved && (
        <ProfileMediaControls
          ownerId={ownerId}
          avatarUrl={profileMedia.avatarUrl}
          bannerUrl={profileMedia.bannerUrl}
          onSaved={onProfileMediaSaved}
        />
      )}

      {onBlockLayoutChange && (
        <div className="mb-4 space-y-2 border-b border-border/30 pb-4">
          <p className="text-xs font-semibold text-foreground">Arrange this block</p>
          <p className="text-[10px] text-muted-foreground">Choose where it starts and how wide it is in a multi-column section.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">
              Start column
              <Input
                type="number"
                min={0}
                max={11}
                className="mt-1 h-8 text-xs"
                value={typeof block.column === "number" ? block.column + 1 : 1}
                onChange={(e) =>
                  onBlockLayoutChange({
                    column: Math.min(11, Math.max(0, (Number(e.target.value) || 1) - 1)),
                  })
                }
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Width (columns)
              <Input
                type="number"
                min={1}
                max={12}
                className="mt-1 h-8 text-xs"
                value={typeof block.span === "number" ? block.span : 1}
                onChange={(e) =>
                  onBlockLayoutChange({
                    span: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">Changes save automatically. This only affects sections with columns.</p>
        </div>
      )}

      {!fields || fields.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No editable settings for this block.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((field) => {
            const { key, label } = field;
            const value = fieldValue(key);

            if (field.type === "toggle") {
              const on = value === true;
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`${block.id}-${key}`} className="text-[11px] font-medium">
                    {label}
                  </Label>
                  <button
                    id={`${block.id}-${key}`}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    onClick={() => set(key, !on)}
                    className={[
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      on ? "bg-[var(--user-accent,var(--trust))]" : "bg-border",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "block h-4 w-4 rounded-full bg-background shadow transition-transform",
                        on ? "translate-x-4" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                </div>
              );
            }

            if (field.type === "select") {
              const options = field.options ?? [];
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                      const active = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => set(key, option.value)}
                          className={[
                            "h-7 rounded-lg border px-2.5 text-xs transition-colors",
                            active
                              ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent,var(--trust))]/5 font-medium text-foreground"
                              : "border-transparent bg-surface/50 text-muted-foreground hover:border-card-border hover:bg-surface hover:text-foreground",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (field.type === "textarea") {
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`${block.id}-${key}`} className="text-[11px] font-medium">
                    {label}
                  </Label>
                  <Textarea
                    id={`${block.id}-${key}`}
                    className="min-h-[5rem] text-xs"
                    placeholder={field.placeholder}
                    value={stringFieldValue(key)}
                    onChange={(e) => debouncedSet(key, e.target.value)}
                  />
                </div>
              );
            }

            if (field.type === "color") {
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${block.id}-${key}`} className="text-[11px] font-medium">
                    {label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {stringFieldValue(key) || "none"}
                    </span>
                    <input
                      id={`${block.id}-${key}`}
                      type="color"
                      value={stringFieldValue(key) || "#333333"}
                      onChange={(e) => debouncedSet(key, e.target.value)}
                      className="h-7 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                    />
                  </div>
                </div>
              );
            }

            if (field.type === "image") {
              const url = stringFieldValue(key);
              const upload = async (file: File) => {
                if (!ownerId) return toast.error("You must own this page to upload images.");
                const check = validateImageFile(file);
                if (!check.ok) return toast.error(check.error);
                setUploading(true);
                try {
                  const path = `${ownerId}/block-${block.id}.${check.ext}`;
                  const { error: uploadError } = await supabase.storage
                    .from("project-media")
                    .upload(path, file, { upsert: true, contentType: check.contentType });
                  if (uploadError) throw uploadError;
                  const { data } = supabase.storage.from("project-media").getPublicUrl(path);
                  set(key, data.publicUrl);
                  toast.success("Image uploaded");
                } catch (error) {
                  toast.error(friendlyError(error as Error, "Image upload failed"));
                } finally {
                  setUploading(false);
                }
              };
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`${block.id}-${key}`} className="text-[11px] font-medium">
                    {label}
                  </Label>
                  {looksLikeUrl(url) && (
                    <div className="relative overflow-hidden rounded-lg border border-border/50">
                      <img src={url} alt="" className="h-20 w-full object-cover" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 rounded-md bg-surface/80"
                        aria-label="Clear image"
                        onClick={() => set(key, "")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <DragDropFileInput
                    accept="image/*"
                    disabled={uploading}
                    onFiles={(files) => files[0] && upload(files[0])}
                    className="rounded-md"
                  >
                    <div className="mb-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
                      <ImagePlus className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload image"}
                    </div>
                  </DragDropFileInput>
                  <Input
                    id={`${block.id}-${key}`}
                    className="h-8 text-xs"
                    placeholder={field.placeholder ?? "https://…"}
                    value={stringFieldValue(key)}
                    onChange={(e) => debouncedSet(key, e.target.value)}
                  />
                </div>
              );
            }

            return (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`${block.id}-${key}`} className="text-[11px] font-medium">
                  {label}
                </Label>
                <Input
                  id={`${block.id}-${key}`}
                  className="h-8 text-xs"
                  placeholder={field.placeholder}
                  value={stringFieldValue(key)}
                  onChange={(e) => debouncedSet(key, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange({ ...definition.defaults })}
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          Remove block
        </Button>
      </div>
    </div>
  );
}
