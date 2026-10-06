// Confirmation dialogs for destructive or public Studio actions.
//
// Split out of creation-studio.tsx; state stays with the caller.

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function StudioResetDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-editor-chrome sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Studio to default?</DialogTitle>
          <DialogDescription>
            Your current arrangement, blocks, and appearance are replaced by the default layout.
            This is one undo away, but any draft you haven't saved as a template is gone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Reset Studio
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudioPublishDialog({
  open,
  onOpenChange,
  changes,
  note,
  onNoteChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One line per change the publish makes live. */
  changes: string[];
  note: string;
  onNoteChange: (note: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-editor-chrome sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Publish your Studio?</DialogTitle>
          <DialogDescription>
            Your current draft becomes live — visitors on your public page will see the latest
            arrangement, blocks, and appearance.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2.5">
          <p className="t-label mb-1.5">What changes</p>
          <ul className="space-y-1">
            {changes.map((line) => (
              <li key={line} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--user-accent,var(--primary))]" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <label className="block">
          <span className="t-label mb-1.5 block">Note for this publish (optional)</span>
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="e.g. Reworked the projects area and added a gallery"
            className="text-xs"
          />
          <span className="mt-1 block text-2xs text-muted-foreground-subtle">
            Saved with the version — visible in your publish history.
          </span>
        </label>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Publish
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Restoring replaces the draft only — what visitors see changes on publish. */
export function StudioRestoreDialog({
  version,
  live,
  onOpenChange,
  onConfirm,
}: {
  /** The version to restore; null keeps the dialog closed. */
  version: number | null;
  /** The version is the one visitors see now (restoring discards the draft). */
  live: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={version !== null} onOpenChange={onOpenChange}>
      <DialogContent className="studio-editor-chrome sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {live ? "Discard your draft changes?" : `Replace your draft with v${version}?`}
          </DialogTitle>
          <DialogDescription>
            {live
              ? "Your draft goes back to exactly what visitors see now: layout, theme and appearance."
              : `Your draft becomes v${version}'s layout, theme and appearance. Visitors keep seeing the live version until you publish.`}{" "}
            You can undo this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {live ? "Discard draft changes" : "Replace draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The draft changed in another tab or on another device since this editor
 *  loaded it. Saving is paused until the member picks a version. */
export function StudioConflictDialog({
  open,
  onLoadLatest,
  onKeepMine,
}: {
  open: boolean;
  onLoadLatest: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="studio-editor-chrome sm:max-w-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Your Studio changed somewhere else</DialogTitle>
          <DialogDescription>
            It was edited in another tab or on another device after you opened it here. Saving is
            paused so neither version is lost by accident. Which one do you want to keep?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="default" size="sm" onClick={onLoadLatest}>
            Load the latest version
          </Button>
          <Button variant="outline" size="sm" onClick={onKeepMine}>
            Keep mine and overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
