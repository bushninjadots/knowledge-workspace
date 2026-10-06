// ── Block fields ───────────────────────────────────────────────────────────────
// The inspector's controls for a block's registered fields, grouped the same
// way for every block: Title (rename / show), Content (what it says), Show
// (what it displays). One renderer so every block's settings look and behave
// alike. Split out of the rail's inspector.

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { BlockConfig, BlockDefinition, BlockField } from "@/lib/page-blocks";
import { isBlockTitleHidden } from "@/components/tethyr/blocks/block-title";
import { cn } from "@/lib/utils";
import { IconButton } from "./studio-controls";

const INPUT =
  "w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground-subtle focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]";

/** An on/off switch that reads as one (the native checkbox read as a box). */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      // A 24px-tall target around the 20px track.
      className="group/switch inline-flex h-6 w-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
          checked
            ? "border-transparent bg-[var(--user-accent,var(--primary))]"
            : "border-border bg-[var(--surface-sunken)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-[var(--surface-elevated)] shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          )}
        />
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-3 first:border-t-0">
      <h3 className="t-label mb-2.5">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldLabel({ id, field }: { id: string; field: BlockField }) {
  return (
    <span className="mb-1 block">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {field.label}
      </label>
      {field.help && (
        <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
          {field.help}
        </span>
      )}
    </span>
  );
}

function ValueControl({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = useId();
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (field.type === "textarea") {
    return (
      <div>
        <FieldLabel id={id} field={field} />
        <textarea
          id={id}
          className={cn(INPUT, "min-h-20 resize-y leading-relaxed")}
          placeholder={field.placeholder}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (field.type === "select") {
    const options = field.options ?? [];
    // Three or fewer choices read better as a segmented control.
    if (options.length <= 3) {
      return (
        <div>
          <span className="mb-1 block text-xs font-medium text-foreground">{field.label}</span>
          <div
            role="radiogroup"
            aria-label={field.label}
            className="grid gap-0.5 rounded-sm border border-border bg-[var(--surface-sunken)] p-0.5"
            style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={text === option.value}
                onClick={() => onChange(option.value)}
                className={cn(
                  "rounded-sm px-1 py-1.5 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
                  text === option.value
                    ? "bg-[var(--surface-elevated)] font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div>
        <FieldLabel id={id} field={field} />
        {/* eslint-disable-next-line no-restricted-syntax -- compact Studio chrome control */}
        <select id={id} className={INPUT} value={text} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "range") {
    const num = Number.isFinite(Number(value)) ? Number(value) : (field.min ?? 0);
    return (
      <div>
        <span className="mb-1 flex items-center justify-between text-xs font-medium text-foreground">
          <label htmlFor={id}>{field.label}</label>
          <span className="font-mono text-2xs text-muted-foreground">{num}</span>
        </span>
        <input
          id={id}
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          value={num}
          onChange={(e) => onChange(Number(e.target.value))}
          className="studio-slider w-full"
        />
      </div>
    );
  }
  if (field.type === "color") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{field.label}</span>
        <span className="flex items-center gap-1.5">
          {text ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Reset
            </button>
          ) : (
            <span className="text-2xs text-muted-foreground">Theme</span>
          )}
          <input
            type="color"
            aria-label={field.label}
            value={text || "#808080"}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
          />
        </span>
      </div>
    );
  }
  // text, url, image
  return (
    <div>
      <FieldLabel id={id} field={field} />
      {field.type === "image" && /^https?:\/\//.test(text) && (
        <img
          src={text}
          alt=""
          className="mb-1.5 h-16 w-full rounded-sm border border-border/60 object-cover"
        />
      )}
      <input
        id={id}
        type={field.type === "url" || field.type === "image" ? "url" : "text"}
        inputMode={field.type === "url" || field.type === "image" ? "url" : undefined}
        className={INPUT}
        placeholder={field.placeholder ?? (field.type === "text" ? "" : "https://")}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type ListItem = Record<string, unknown>;

/** A repeatable group of fields (stats, questions, milestones…). */
function ListControl({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (value: ListItem[]) => void;
}) {
  const items: ListItem[] = Array.isArray(value)
    ? value.filter((v): v is ListItem => !!v && typeof v === "object")
    : [];
  const noun = field.itemLabel ?? "item";
  const max = field.maxItems ?? 12;
  const setItem = (index: number, patch: ListItem) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-foreground">{field.label}</span>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-sm border border-border bg-[var(--surface)] p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-2xs text-muted-foreground">
                {noun[0].toUpperCase() + noun.slice(1)} {index + 1}
              </span>
              <span className="flex">
                <IconButton
                  label={`Move ${noun} ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </IconButton>
                <IconButton
                  label={`Move ${noun} ${index + 1} down`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </IconButton>
                <IconButton
                  label={`Remove ${noun} ${index + 1}`}
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-3 w-3" />
                </IconButton>
              </span>
            </div>
            <div className="space-y-2">
              {(field.itemFields ?? []).map((sub) => (
                <ValueControl
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  onChange={(v) => setItem(index, { [sub.key]: v })}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={items.length >= max}
        onClick={() => onChange([...items, {}])}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border py-1.5 text-2xs text-muted-foreground outline-none hover:border-[var(--user-accent-border)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] disabled:opacity-50"
      >
        <Plus className="h-3 w-3" aria-hidden />
        {items.length >= max ? `Up to ${max} ${noun}s` : `Add ${noun}`}
      </button>
    </div>
  );
}

export function BlockFields({
  definition,
  config,
  onChange,
}: {
  definition: BlockDefinition;
  config: BlockConfig;
  onChange: (config: BlockConfig) => void;
}) {
  const fields = definition.fields ?? [];
  const valueOf = (field: BlockField) => config[field.key] ?? definition.defaults[field.key];
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  const content = fields.filter((f) => f.type !== "toggle");
  const toggles = fields.filter((f) => f.type === "toggle");
  const titleId = useId();
  const titleShown = !isBlockTitleHidden(config, definition.titleHiddenByDefault);
  return (
    <div>
      {definition.title && (
        <Section title="Title">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">Show the title</span>
            <Switch
              label="Show the title"
              checked={titleShown}
              onChange={(checked) => set("hideTitle", !checked)}
            />
          </div>
          {titleShown && (
            <div>
              <label htmlFor={titleId} className="mb-1 block text-xs font-medium text-foreground">
                Title text
              </label>
              <input
                id={titleId}
                className={INPUT}
                maxLength={60}
                placeholder={definition.title}
                value={typeof config.title === "string" ? config.title : ""}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
          )}
        </Section>
      )}
      {content.length > 0 && (
        <Section title="Content">
          {content.map((field) =>
            field.type === "list" ? (
              <ListControl
                key={field.key}
                field={field}
                value={valueOf(field)}
                onChange={(v) => set(field.key, v)}
              />
            ) : (
              <ValueControl
                key={field.key}
                field={field}
                value={valueOf(field)}
                onChange={(v) => set(field.key, v)}
              />
            ),
          )}
        </Section>
      )}
      {toggles.length > 0 && (
        <Section title="Show">
          {toggles.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground">{field.label}</span>
              <Switch
                label={field.label}
                checked={Boolean(valueOf(field))}
                onChange={(checked) => set(field.key, checked)}
              />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
