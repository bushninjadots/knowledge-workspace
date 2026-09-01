// ── Inline Inspector ──────────────────────────────────────────────────────────
// Floating settings panel for a single block, opened from its Configure (gear)
// control in edit mode. Renders a control for every registered BlockField and
// writes changes immediately (persist-on-change — there is no save button).

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlockConfig, BlockDefinition, LayoutBlockInstance } from "@/lib/page-blocks";

interface InlineInspectorProps {
  block: LayoutBlockInstance;
  definition: BlockDefinition;
  onChange: (config: BlockConfig) => void;
  onRemove: () => void;
  onClose: () => void;
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
}: InlineInspectorProps) {
  const fields = definition.fields;

  function set<Key extends string>(key: Key, value: unknown) {
    onChange({ ...block.config, [key]: value });
  }

  return (
    <div
      role="dialog"
      aria-label={`${definition.label} settings`}
      className="fixed right-3 top-24 z-50 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-card-border bg-surface-elevated px-4 py-3 shadow-xl"
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

      {!fields || fields.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No editable settings for this block.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((field) => {
            const { key, label } = field;
            const value = block.config[key];

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
                    value={stringValue(block.config, key)}
                    onChange={(e) => set(key, e.target.value)}
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
                      {stringValue(block.config, key) || "none"}
                    </span>
                    <input
                      id={`${block.id}-${key}`}
                      type="color"
                      value={stringValue(block.config, key) || "#333333"}
                      onChange={(e) => set(key, e.target.value)}
                      className="h-7 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                    />
                  </div>
                </div>
              );
            }

            if (field.type === "image") {
              const url = stringValue(block.config, key);
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
                  <Input
                    id={`${block.id}-${key}`}
                    className="h-8 text-xs"
                    placeholder={field.placeholder ?? "https://…"}
                    value={url}
                    onChange={(e) => set(key, e.target.value)}
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
                  value={stringValue(block.config, key)}
                  onChange={(e) => set(key, e.target.value)}
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
