import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Film,
  FileCode,
  Type,
  Music,
  Box,
  Archive,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUploadLibraryFile, type LibraryItem } from "@/hooks/use-library";
import { validateLibraryFile } from "@/lib/validators";
import { cn } from "@/lib/utils";

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "tiff",
      "tif",
      "ico",
      "heic",
      "heif",
    ].includes(ext)
  )
    return Image;
  if (["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv", "m4v"].includes(ext)) return Film;
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a", "wma", "aiff"].includes(ext)) return Music;
  if (
    [
      "blend",
      "fbx",
      "obj",
      "stl",
      "glb",
      "gltf",
      "usd",
      "usdz",
      "dae",
      "3ds",
      "max",
      "ma",
      "mb",
      "c4d",
    ].includes(ext)
  )
    return Box;
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return Archive;
  if (["psd", "ai", "eps", "sketch", "fig", "xd", "indd", "afdesign", "afphoto"].includes(ext))
    return Palette;
  if (["pdf", "doc", "docx", "odt", "pages"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv", "ods", "numbers"].includes(ext)) return FileSpreadsheet;
  if (["txt", "md", "rtf", "tex", "log"].includes(ext)) return Type;
  if (
    [
      "json",
      "xml",
      "yaml",
      "yml",
      "toml",
      "html",
      "css",
      "scss",
      "less",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "kt",
      "swift",
      "c",
      "cpp",
      "h",
      "sh",
      "bash",
      "zsh",
      "sql",
      "r",
      "lua",
      "php",
    ].includes(ext)
  )
    return FileCode;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PendingFile {
  file: File;
  id: string;
  title: string;
  description: string;
}

function isVideoFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "mov", "avi"].includes(ext);
}

export function FileUploadZone({
  collectionId,
  onUploaded,
  compact = false,
}: {
  collectionId?: string;
  onUploaded?: (item: LibraryItem) => void;
  compact?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadLibraryFile();

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const valid: PendingFile[] = [];

    for (const file of files) {
      const result = validateLibraryFile(file);
      if (!result.ok) {
        toast.error(`${file.name}: ${result.error}`);
        continue;
      }
      valid.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        description: "",
      });
    }

    if (valid.length > 0) {
      setPendingFiles((prev) => [...prev, ...valid]);
    }
  }, []);

  function removePending(id: string) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updatePendingTitle(id: string, title: string) {
    setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, title } : f)));
  }

  function updatePendingDescription(id: string, description: string) {
    setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, description } : f)));
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;

    let successCount = 0;
    for (const pf of pendingFiles) {
      try {
        const item = await uploadFile.mutateAsync({
          file: pf.file,
          collection_id: collectionId,
          title: pf.title || undefined,
          description: pf.description || undefined,
        });
        onUploaded?.(item);
        successCount++;
      } catch (err: unknown) {
        toast.error(`${pf.file.name}: ${friendlyError(err, "Upload failed")}`);
      }
    }

    if (successCount > 0) {
      toast.success(successCount === 1 ? "File uploaded" : `${successCount} files uploaded`);
    }
    setPendingFiles([]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  const pendingList = pendingFiles.length > 0 && (
    <div className={cn("space-y-2", compact ? "mb-3" : "mt-4")}>
      {pendingFiles.map((pf) => {
        const Icon = getFileIcon(pf.file.name);
        const isVideo = isVideoFile(pf.file);
        return (
          <div key={pf.id} className="rounded-lg border border-border/40 bg-surface/40 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={pf.title}
                  onChange={(e) => updatePendingTitle(pf.id, e.target.value)}
                  placeholder="Title"
                  className="h-7 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                />
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(pf.file.size)}
                  {isVideo && "· Video"}
                </p>
              </div>
              <button
                onClick={() => removePending(pf.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Textarea
              value={pf.description}
              onChange={(e) => updatePendingDescription(pf.id, e.target.value)}
              placeholder="Add a description (optional)"
              rows={2}
              className="mt-2 resize-none border-0 bg-transparent px-0 text-xs shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            />
          </div>
        );
      })}

      <Button
        className={cn(
          "w-full gap-2 bg-[var(--user-accent,var(--trust))] text-[var(--user-accent-foreground,var(--background))] hover:opacity-90",
          compact && "h-8 text-xs",
        )}
        onClick={handleUpload}
        disabled={uploadFile.isPending}
      >
        <Upload className={cn("text-background", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        {uploadFile.isPending
          ? "Uploading…"
          : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
      </Button>
    </div>
  );

  const dropzone = (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed text-center transition-all duration-200",
        compact ? "px-4 py-5" : "px-6 py-10",
        isDragOver
          ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent-subtle,var(--trust-subtle))]"
          : "border-border/40 bg-surface/20 hover:border-border/60 hover:bg-surface/40",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl transition-colors",
          compact ? "h-8 w-8" : "h-12 w-12",
          isDragOver ? "bg-[var(--user-accent-subtle,var(--trust-subtle))]" : "bg-surface-elevated",
        )}
      >
        <Upload
          className={cn(
            "transition-colors",
            compact ? "h-4 w-4" : "h-5 w-5",
            isDragOver ? "text-[var(--user-accent,var(--trust))]" : "text-muted-foreground",
          )}
        />
      </div>
      <div>
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {isDragOver ? "Drop files here" : "Drag & drop or click to browse"}
        </p>
        {!compact && (
          <p className="mt-1 text-xs text-muted-foreground">
            Images, documents, text files, and short video clips up to 100 MB
          </p>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        {dropzone}
        {pendingList}
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
      {dropzone}
      {pendingList}
    </>
  );
}
