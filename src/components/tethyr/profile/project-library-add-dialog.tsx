import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { useCreateItem, useUploadLibraryFile } from "@/hooks/use-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "./section-card";
import type { ProjectRow } from "./types";

function ProjectLibraryAddDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: ProjectRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"note" | "file">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createItem = useCreateItem();
  const uploadFile = useUploadLibraryFile();
  const busy = createItem.isPending || uploadFile.isPending;

  function saveNote() {
    if (!title.trim() && !content.trim()) return toast.error("Add a title or some notes first");
    createItem.mutate(
      { title: title.trim() || "Untitled note", content, type: "note", project_id: project.id },
      {
        onSuccess: () => {
          toast.success("Note added");
          onSaved();
          onOpenChange(false);
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't save note")),
      },
    );
  }

  function saveFile() {
    if (!file) return toast.error("Choose a file first");
    uploadFile.mutate(
      { file, title: title.trim() || undefined, project_id: project.id },
      {
        onSuccess: () => {
          toast.success("File added");
          onSaved();
          onOpenChange(false);
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't upload file")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to {project.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Attach a note or file to this project — it appears in the project's Library.
          </p>
        </DialogHeader>

        <div className="flex rounded-xl border border-border/60 bg-background/40 p-1">
          <button
            type="button"
            onClick={() => setMode("note")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "note"
                ? "bg-surface-elevated text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Note
          </button>
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "file"
                ? "bg-surface-elevated text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upload file
          </button>
        </div>

        {mode === "note" ? (
          <div className="space-y-3">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kickoff notes"
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write notes specific to this project…"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="File">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-3 py-4 text-sm text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
              >
                <UploadCloud className="h-4 w-4" />
                <span className="min-w-0 truncate">
                  {file ? file.name : "Choose a file to upload"}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Title (optional)">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={file?.name ?? "Optional title"}
              />
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={mode === "note" ? saveNote : saveFile} disabled={busy}>
            {busy ? "Saving…" : mode === "note" ? "Add note" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ProjectLibraryAddDialog };
