// ── Shared README / About editor dialog ──────────────────────────────────────
// The one editing surface for markdown body content on the profile README and
// About blocks: a dialog with Write/Preview tabs (rich Tiptap editor, lazily
// loaded) and a one-click pull of the owner's GitHub profile README
// (`<username>/<username>`).

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Download, Eye, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchRepoReadmeServer, getConnectedGithubUsername } from "@/lib/github-server";
import { absolutizeRelativeLinks } from "@/lib/github";
import { cn } from "@/lib/utils";
import {
  extractGithubUsername,
  MARKDOWN_COMPONENTS as SHARED_MARKDOWN_COMPONENTS,
} from "@/components/tethyr/blocks/readme-markdown";

// Tiptap + extensions are ~1 MB before gzip; a visitor reading an About should
// never pay for them. Loaded only when the owner opens the editor.
const ReadmeEditor = lazy(() =>
  import("@/components/tethyr/project/readme-editor").then((m) => ({ default: m.ReadmeEditor })),
);

type ReadmeEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Content to seed the editor each time the dialog opens. */
  initialContent: string;
  title: string;
  description: string;
  /** GitHub profile link used to resolve the username for import fallback. */
  githubLink?: string | null;
  importLabel?: string;
  saveLabel?: string;
  /** Persist the content. Return true when saved so the dialog can close. */
  onSave: (content: string) => Promise<boolean>;
};

export function ReadmeEditorDialog({
  open,
  onOpenChange,
  initialContent,
  title,
  description,
  githubLink,
  importLabel = "Import from GitHub",
  saveLabel = "Save README",
  onSave,
}: ReadmeEditorDialogProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (open) {
      setDraft(initialContent);
      setView("write");
    }
  }, [open, initialContent]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const ok = await onSave(draft.trim());
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, onOpenChange]);

  const importFromGithub = useCallback(async () => {
    setImporting(true);
    try {
      let username: string | null = null;
      try {
        username = await getConnectedGithubUsername();
      } catch {
        username = null;
      }
      if (!username) username = extractGithubUsername(githubLink);
      if (!username) {
        toast.error(
          "Add your GitHub link to your profile (or connect GitHub in Settings) to import",
        );
        return;
      }
      const fullName = `${username}/${username}`;
      const { text, rateLimited, unauthorized } = await fetchRepoReadmeServer({
        data: { fullName },
      });
      if (unauthorized) {
        toast.error("GitHub rejected the saved token — check it and try again");
        return;
      }
      if (rateLimited) {
        toast.error("GitHub is rate-limited right now — try again in a minute");
        return;
      }
      if (!text) {
        toast.error(`No README found at ${fullName} — create that repo on GitHub first`);
        return;
      }
      setDraft(absolutizeRelativeLinks(text, fullName, "HEAD"));
      setView("write");
      toast.success("README imported — review it, then save");
    } catch {
      toast.error("Couldn't reach GitHub — try again");
    } finally {
      setImporting(false);
    }
  }, [githubLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,46rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-background/40 p-1">
          {(
            [
              { id: "write", label: "Write", icon: Pencil },
              { id: "preview", label: "Preview", icon: Eye },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                view === id
                  ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {view === "write" ? (
          <Suspense
            fallback={
              <div className="min-h-[24rem] animate-gentle-pulse rounded-xl border border-border/60 bg-background/60" />
            }
          >
            <ReadmeEditor content={draft} onChange={setDraft} />
          </Suspense>
        ) : (
          <div className="prose-custom min-h-[24rem] overflow-auto rounded-xl border border-border/40 bg-background/40 px-5 py-5">
            <Markdown remarkPlugins={[remarkGfm]} components={SHARED_MARKDOWN_COMPONENTS}>
              {draft || "_Nothing to preview yet._"}
            </Markdown>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={importFromGithub}
            disabled={importing}
            title="Import your GitHub profile README (username/username)"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {importLabel}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
