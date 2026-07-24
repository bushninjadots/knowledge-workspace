import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable drag-and-drop file input wrapper.
 * Renders children (typically a button or upload area) and handles all
 * drag/drop + click-to-browse logic. Pass accepted MIME types and a max
 * file count. Calls `onFiles` with the validated File array.
 */
export function DragDropFileInput({
  accept,
  multiple = false,
  maxFiles = 1,
  onFiles,
  children,
  className,
  disabled = false,
}: {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const accepted = files.slice(0, maxFiles);
      if (accepted.length > 0) onFiles(accepted);
    },
    [maxFiles, onFiles],
  );

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
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "relative cursor-pointer transition-all",
        isDragOver && "ring-2 ring-brand-green/40",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      {children}
    </div>
  );
}

/**
 * Compact drag & drop area with visual feedback — good for inline image
 * uploads in the composer or avatar/banner changes on the profile.
 */
export function InlineDropZone({
  accept = "image/*",
  onFile,
  className,
}: {
  accept?: string;
  onFile: (file: File) => void;
  className?: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-all",
        isDragOver
          ? "border-brand-green bg-brand-green/5"
          : "border-border/40 hover:border-border/60",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <Upload
          className={cn(
            "h-4 w-4 transition-colors",
            isDragOver ? "text-brand-green" : "text-muted-foreground/60",
          )}
        />
        <span className="text-[11px] text-muted-foreground/60">
          {isDragOver ? "Drop here" : "Drag & drop or click"}
        </span>
      </div>
    </div>
  );
}
