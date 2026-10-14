// Edit a set of app links ({ appId: url }) — where a project lives, or where
// a member can be found. Add from the catalog, or paste any link and the app
// is recognised. Public links only (https); validation is the caller's.
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { detectApp, getApp, type AppDef } from "@/lib/app-catalog";
import { AppIcon } from "./app-icon";
import { AppPicker } from "./app-picker";

export function AppLinksEditor({
  value,
  onChange,
  apps,
  suggested = [],
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  apps: AppDef[];
  /** One-click chips shown before anything is added. */
  suggested?: string[];
}) {
  const [picking, setPicking] = useState(false);
  const [paste, setPaste] = useState("");
  const keys = Object.keys(value);

  function add(app: AppDef, url = "") {
    onChange({ ...value, [app.id]: value[app.id] || url });
    setPicking(false);
  }

  function addPasted() {
    const url = paste.trim();
    if (!url) return;
    const app = detectApp(url, apps);
    // Unknown hosts go in as a website (or the next free "link-n" slot).
    let key = app?.id ?? "website";
    if (value[key]) {
      let n = 2;
      while (value[`link-${n}`]) n += 1;
      key = app ? key : `link-${n}`;
    }
    onChange({ ...value, [key]: url });
    setPaste("");
  }

  return (
    <div className="space-y-2">
      {keys.map((key) => {
        const app = getApp(key) ?? (key.startsWith("link-") ? getApp("website") : undefined);
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="flex w-32 min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <AppIcon app={app} size="xs" />
              <span className="truncate">{app?.name ?? key}</span>
            </div>
            <Input
              placeholder={app?.placeholder ?? "https://…"}
              value={value[key] ?? ""}
              aria-label={`${app?.name ?? key} link`}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
            <button
              type="button"
              onClick={() => {
                const next = { ...value };
                delete next[key];
                onChange(next);
              }}
              aria-label={`Remove ${app?.name ?? key}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {keys.length === 0 && suggested.length > 0 && !picking && (
        <div className="flex flex-wrap gap-1.5">
          {suggested
            .map((id) => getApp(id))
            .filter((a): a is AppDef => !!a)
            .map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => add(app)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 py-1 pr-3 pl-1 text-xs transition-colors hover:bg-surface-elevated"
              >
                <AppIcon app={app} size="xs" />
                {app.name}
              </button>
            ))}
        </div>
      )}

      {picking ? (
        <div className="rounded-lg border border-border bg-surface-sunken/40 p-3">
          <AppPicker apps={apps} taken={keys} onPick={(app) => add(app)} />
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs font-medium transition-colors hover:bg-surface-elevated"
          >
            <Plus className="h-3.5 w-3.5" /> Add an app
          </button>
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-1.5">
            <Input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPasted();
                }
              }}
              placeholder="…or paste any link"
              aria-label="Paste a link"
              className="h-8 text-xs"
            />
            {paste.trim() && (
              <button
                type="button"
                onClick={addPasted}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium hover:bg-surface-elevated"
              >
                Add
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
