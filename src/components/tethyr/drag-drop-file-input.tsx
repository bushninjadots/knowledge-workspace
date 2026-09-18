import { useState, useRef, useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * Reusable drag-and-drop file input wrapper.
 * Renders children (typically a button or upload area) and handles all
 * drag/drop + click-to-browse logic. Pass accepted MIME types and a max
 * file count. Calls`onFiles`with the validated File array.
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
        "relative cursor-pointer transition-colors",
        isDragOver && "ring-2 ring-[var(--user-accent,var(--trust))]/40",
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
