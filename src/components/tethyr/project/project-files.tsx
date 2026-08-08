import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  ExternalLink,
  Download,
  FileText,
  Image,
  Film,
  Music,
  Box,
  Archive,
  Palette,
  FileCode,
  File as FileIcon,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { validateLibraryFile } from "@/lib/validators";
import { useQueryClient } from "@tanstack/react-query";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

const sb = supabase as any;

type ProjectFile = {
  name: string;
  path: string;
  size: number;
  type: "image" | "video" | "audio" | "model" | "archive" | "document" | "other";
  uploaded_at: string;
  /** Optional relative directory (e.g. "src/components") for repo-style trees. */
  dir?: string;
};

function getFileIconType(name: string): typeof FileIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return Image;
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return Film;
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext)) return Music;
  if (["blend", "fbx", "obj", "stl", "glb", "gltf"].includes(ext)) return Box;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  if (["psd", "ai", "fig", "sketch"].includes(ext)) return Palette;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  if (["js", "ts", "py", "html", "css", "json"].includes(ext)) return FileCode;
  return FileIcon;
}

function getFileType(name: string): ProjectFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["blend", "fbx", "obj", "stl", "glb", "gltf", "usd"].includes(ext)) return "model";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["pdf", "doc", "docx", "ppt", "xls"].includes(ext)) return "document";
  return "other";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesSection({
  projectId,
  isOwner,
  existingFiles,
  onFilesChanged,
}: {
  projectId: string;
  isOwner: boolean;
  existingFiles: ProjectFile[];
  onFilesChanged: () => void;
}) {
  const { data: me } = useCurrentUser();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!me?.userId) return;
      setUploading(true);
      let success = 0;

      for (const file of Array.from(files)) {
        const check = validateLibraryFile(file);
        if (!check.ok) {
          toast.error(`${file.name}: ${check.error}`);
          continue;
        }
        try {
          const path = `${projectId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await sb.storage.from("project-media").upload(path, file);
          if (upErr) throw upErr;

          // Update project's uploaded_files array via the projects table
          const newFile: ProjectFile = {
            name: file.name,
            path,
            size: file.size,
            type: getFileType(file.name),
            uploaded_at: new Date().toISOString(),
          };

          // Append to existing files
          const updatedFiles = [...existingFiles, newFile];
          const { error: updateErr } = await sb
            .from("projects")
            .update({ uploaded_files: updatedFiles })
            .eq("id", projectId);
          if (updateErr) throw updateErr;

          existingFiles.push(newFile); // update local ref
          success++;
        } catch (err: any) {
          toast.error(`${file.name}: ${err.message || "Upload failed"}`);
        }
      }

      setUploading(false);
      if (success > 0) {
        toast.success(`${success} file${success > 1 ? "s" : ""} uploaded`);
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
        onFilesChanged();
      }
    },
    [me?.userId, projectId, existingFiles, queryClient, onFilesChanged],
  );

  const handleRemove = async (index: number) => {
    const file = existingFiles[index];
    try {
      await sb.storage.from("project-media").remove([file.path]);
      const updated = existingFiles.filter((_, i) => i !== index);
      await sb.from("projects").update({ uploaded_files: updated }).eq("id", projectId);
      existingFiles.splice(index, 1);
      toast.success("File removed");
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      onFilesChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  };

  if (!isOwner && existingFiles.length === 0) return null;

  return (
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Files
          {existingFiles.length > 0 && (
            <span className="text-xs text-muted-foreground">({existingFiles.length})</span>
          )}
        </h3>
        {isOwner && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" /> Upload files
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      {/* Drop zone (always visible for owners when no files yet or when empty) */}
      {isOwner && existingFiles.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            isDragOver
              ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent-subtle,var(--trust-subtle))]"
              : "border-border/40 bg-surface/20 hover:border-border/60"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">
            {isDragOver ? "Drop files here" : "Drag & drop or click to upload"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Images, video, audio, 3D models, design files, documents, code, archives — up to 200 MB
          </p>
        </div>
      )}

      {/* File list */}
      {existingFiles.length > 0 && (
        <div className="space-y-1.5">
          {existingFiles.map((file, i) => (
            <FileRow key={i} file={file} isOwner={isOwner} onRemove={() => handleRemove(i)} />
          ))}
        </div>
      )}

      {/* Compact drop zone when files exist */}
      {isOwner && existingFiles.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-2 cursor-pointer rounded-lg border border-dashed px-3 py-2 text-center text-xs transition ${
            isDragOver
              ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent-subtle,var(--trust-subtle))]"
              : "border-border/30 bg-surface/10 hover:border-border/50"
          }`}
        >
          {isDragOver ? "Drop to add more files" : "Drop more files here"}
        </div>
      )}
    </div>
  );
}

function FileRow({
  file,
  isOwner,
  onRemove,
}: {
  file: ProjectFile;
  isOwner: boolean;
  onRemove: () => void;
}) {
  // project-media is a private bucket, so downloads need a signed URL.
  const { data: url } = useSignedStorageUrl("project-media", file.path);
  const Icon = getFileIconType(file.name);
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2.5 transition hover:border-border/60">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatFileSize(file.size)} · {file.type} ·{" "}
          {new Date(file.uploaded_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={file.name}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        {isOwner && (
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Also expose simpler file icon helper for reuse
export { getFileIconType, getFileType, formatFileSize };
export type { ProjectFile };
