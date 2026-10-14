// "Your apps": the member's own launcher on the dashboard. One click opens the
// place they work — Linear, Figma, Vercel in a tab, or a desktop app straight
// to the right vault or folder (Obsidian, VS Code, Cursor, Zed). Private.
import { useState } from "react";
import { Monitor, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useAddMemberApps,
  useMemberApps,
  useRemoveMemberApp,
  type MemberApp,
} from "@/hooks/use-member-apps";
import {
  APPS,
  detectApp,
  getApp,
  isDeepLink,
  isLaunchableUrl,
  webFallbackFor,
  type AppDef,
} from "@/lib/app-catalog";
import { friendlyError } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { AppIcon } from "./app-icon";
import { AppPicker } from "./app-picker";

/**
 * Open a tile. Web apps open in a new tab. Desktop apps open through their own
 * scheme; if nothing takes over the page within a moment (the app isn't
 * installed on this device — a phone, someone else's laptop), the web version
 * opens in a new tab instead.
 */
function launch(item: MemberApp, name: string) {
  if (!isDeepLink(item.url)) {
    window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }
  const fallback = webFallbackFor(item.app_id, item.web_url);
  let left = false;
  const onLeave = () => {
    left = true;
  };
  window.addEventListener("blur", onLeave, { once: true });
  document.addEventListener("visibilitychange", onLeave, { once: true });
  window.location.href = item.url;
  window.setTimeout(() => {
    window.removeEventListener("blur", onLeave);
    document.removeEventListener("visibilitychange", onLeave);
    if (left || !fallback) return;
    const tab = window.open(fallback, "_blank", "noopener,noreferrer");
    // Popup blocked: offer it instead.
    if (!tab)
      toast(`${name} didn't open on this device`, {
        action: { label: "Open on the web", onClick: () => window.open(fallback, "_blank") },
      });
  }, 1200);
}

function AddAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const add = useAddMemberApps();
  const [app, setApp] = useState<AppDef | null>(null);
  const [mode, setMode] = useState<"desktop" | "web">("desktop");
  const [input, setInput] = useState("");
  const [label, setLabel] = useState("");
  const [webUrl, setWebUrl] = useState("");

  function reset() {
    setApp(null);
    setInput("");
    setLabel("");
    setWebUrl("");
    setMode("desktop");
  }

  const desktop = !!app?.deepLink && mode === "desktop";
  const url = !app || !input.trim() ? "" : desktop ? app.deepLink!.build(input) : input.trim();
  const valid = !!url && isLaunchableUrl(url, app);
  // A desktop tile is named after its vault / folder unless the member names it.
  const suggestedLabel = desktop ? input.split(/[\\/]/).filter(Boolean).pop()?.trim() || "" : "";

  async function save() {
    if (!app || !valid) return;
    try {
      await add.mutateAsync([
        {
          app_id: app.id,
          url,
          label: label.trim() || suggestedLabel.slice(0, 40) || null,
          web_url: desktop && /^https:\/\//.test(webUrl.trim()) ? webUrl.trim() : null,
        },
      ]);
      toast.success(`${app.name} added`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(friendlyError(error, "Couldn't add that app"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{app ? `Add ${app.name}` : "Add an app"}</DialogTitle>
        </DialogHeader>
        {!app ? (
          <AppPicker
            apps={APPS}
            onPick={(picked) => {
              setApp(picked);
              setMode(picked.deepLink ? "desktop" : "web");
            }}
          />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center gap-3">
              <AppIcon app={app} size="lg" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">{app.name}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Pick a different app
                </button>
              </div>
            </div>
            {app.deepLink && (
              <div role="radiogroup" aria-label="Opens" className="flex gap-1.5 text-xs">
                {(
                  [
                    ["desktop", "Open the desktop app"],
                    ["web", "Open a web link"],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => {
                      setMode(value);
                      setInput("");
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 transition-colors",
                      mode === value
                        ? "border-border-strong bg-surface-elevated font-medium"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
            <label className="block space-y-1 text-xs font-medium">
              {desktop ? app.deepLink!.inputLabel : "Link"}
              <Input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={desktop ? app.deepLink!.placeholder : app.placeholder}
              />
            </label>
            {desktop && input.trim() && (
              <p className="truncate text-[11px] text-muted-foreground">
                Opens <code className="font-mono">{url}</code>
              </p>
            )}
            {!desktop && input.trim() && !valid && (
              <p className="text-[11px] text-destructive">Use a full https:// link.</p>
            )}
            {desktop && (
              <label className="block space-y-1 text-xs font-medium">
                If {app.name} isn't installed, open (optional)
                <Input
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder={app.deepLink!.webFallbackHint}
                />
                <span className="block font-normal text-muted-foreground">
                  On a phone or another computer the tile opens this instead
                  {webUrl.trim()
                    ? ""
                    : ` — or ${app.deepLink!.webFallback.replace("https://", "")}`}
                  .
                </span>
              </label>
            )}
            <label className="block space-y-1 text-xs font-medium">
              Name on the tile (optional)
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 40))}
                placeholder={suggestedLabel || app.name}
              />
            </label>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                className="rounded-full"
                disabled={!valid}
                busy={add.isPending}
              >
                Add to my apps
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({
  item,
  editing,
  onRemove,
}: {
  item: MemberApp;
  editing: boolean;
  onRemove: () => void;
}) {
  const app = getApp(item.app_id) ?? detectApp(item.url);
  const name = item.label || app?.name || "App";
  const desktop = isDeepLink(item.url);
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => !editing && launch(item, name)}
        title={desktop ? `Open ${name} on this computer` : `Open ${name}`}
        className="group flex w-20 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative">
          <AppIcon
            app={app}
            size="lg"
            className="transition-transform group-hover:-translate-y-0.5"
          />
          {desktop && (
            <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Monitor className="h-2.5 w-2.5" aria-hidden />
            </span>
          )}
        </span>
        <span className="line-clamp-1 w-full text-[11px]">{name}</span>
      </button>
      {editing && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="absolute top-0.5 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

export function AppLauncher() {
  const { data: me } = useCurrentUser();
  const { data: apps, isLoading } = useMemberApps();
  const add = useAddMemberApps();
  const remove = useRemoveMemberApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  // One click to start from the links already on their profile.
  const fromProfile = Object.entries(me?.profile?.social_links ?? {})
    .filter(([, url]) => typeof url === "string" && /^https:\/\//.test(url))
    .map(([key, url]) => ({ app_id: (getApp(key) ?? detectApp(url))?.id ?? "website", url }));

  if (isLoading) return null;
  const list = apps ?? [];

  return (
    <section aria-labelledby="your-apps" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="your-apps" className="text-sm font-semibold">
          Your apps{" "}
          <span className="font-normal text-muted-foreground">· one click to where you work</span>
        </h2>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 surface-panel px-4 py-3">
          <p className="min-w-0 flex-1 basis-64 text-xs text-muted-foreground">
            Pin the tools you use every day — your Obsidian vault, a project folder in VS Code or
            Cursor, your Linear board, Figma file or Vercel dashboard — and open them from here.
          </p>
          {fromProfile.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              busy={add.isPending}
              onClick={() =>
                add.mutate(fromProfile.slice(0, 12), {
                  onError: (e) => toast.error(friendlyError(e, "Couldn't add them")),
                })
              }
            >
              Add my profile links
            </Button>
          )}
          <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus /> Add an app
          </Button>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {list.map((item) => (
            <Tile
              key={item.id}
              item={item}
              editing={editing}
              onRemove={() => remove.mutate(item.id)}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-20 flex-col items-center gap-1.5 rounded-xl p-2 text-center text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border-strong">
                <Plus className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[11px]">Add</span>
            </button>
          </li>
        </ul>
      )}
      <AddAppDialog open={adding} onOpenChange={setAdding} />
    </section>
  );
}
