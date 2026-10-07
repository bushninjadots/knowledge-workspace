// ── Shared README / About editor dialog ──────────────────────────────────────
// The one editing surface for markdown body content on the profile README and
// About blocks: a dialog with Write/Preview tabs (rich Tiptap editor, lazily
// loaded) and "Import from GitHub" / "Sync from GitHub" through the shared
// preview dialog (the GitHub profile README `<you>/<you>`, or any repo).

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Eye, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GitHubImportDialog } from "@/components/tethyr/github/github-import-dialog";
import { GitHubSyncButton } from "@/components/tethyr/github/github-sync-button";
import type { ReadmeSource } from "@/hooks/use-profile-readme";
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
  /** GitHub profile link used to suggest `<you>/<you>` when not connected. */
  githubLink?: string | null;
  /** Where the content was imported from, if anywhere ("Sync from GitHub"). */
  source?: ReadmeSource | null;
  saveLabel?: string;
  /** Persist the content — with the GitHub repo it was just brought in from,
   *  if it was. Return true when saved so the dialog can close. */
  onSave: (content: string, source?: string) => Promise<boolean>;
};

export function ReadmeEditorDialog({
  open,
  onOpenChange,
  initialContent,
  title,
  description,
  githubLink,
  source,
  saveLabel = "Save README",
  onSave,
}: ReadmeEditorDialogProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  // The repo the draft was just brought in from, saved with it.
  const [imported, setImported] = useState<string | undefined>(undefined);
  const [view, setView] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (open) {
      setDraft(initialContent);
      setImported(undefined);
      setView("write");
    }
  }, [open, initialContent]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const ok = await onSave(draft.trim(), imported);
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [draft, imported, onSave, onOpenChange]);

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
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-lift",
                view === id
                  ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground"
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
          <GitHubSyncButton
            synced={!!source}
            syncedAt={source?.synced_at}
            onClick={() => setImporting(true)}
          />
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
        {importing && (
          <GitHubImportDialog
            open
            onOpenChange={setImporting}
            sources="profile"
            fallbackUsername={extractGithubUsername(githubLink)}
            initialRepo={source?.repo}
            syncedAt={source?.synced_at}
            currentText={draft}
            confirmLabel="Put it in the editor"
            onConfirm={(text, repo) => {
              setDraft(text);
              setImported(repo);
              setView("write");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
