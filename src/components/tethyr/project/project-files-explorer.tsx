import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  X,
  Loader2,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateLibraryFile } from "@/lib/validators";
import { useQueryClient } from "@tanstack/react-query";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { buildTree, type TreeNode, type TreeFile } from "@/lib/file-tree";
import { getFileIconType, getFileType, formatFileSize, type ProjectFile } from "./project-files";
import { ProjectReposSection } from "./project-repos";

const sb = supabase as any;

function FolderRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (file: TreeFile) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {open ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-[var(--user-accent,var(--primary))]" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {open && (
        <div>
          {[...node.children.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <FolderRow
                key={child.dir}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          {[...node.files]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => {
              const Icon = getFileIconType(f.name);
              const isSelected = selected === `${f.dir || ""}/${f.name}`;
              return (
                <button
                  key={`${f.dir || ""}/${f.name}`}
                  onClick={() => onSelect(f)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition ${
                    isSelected
                      ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground"
                      : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  }`}
                  style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
                >
                  <span className="w-3.5 shrink-0" />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function FileViewer({ file }: { file: TreeFile | null }) {
  // project-media is a private bucket, so previews/downloads need a signed URL.
  const { data: url } = useSignedStorageUrl("project-media", file?.path ?? null);
  const signedUrl = url ?? "";

  if (!file) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 bg-background/30 px-6 text-center">
        <Upload className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Select a file to preview it</p>
      </div>
    );
  }

  const Icon = getFileIconType(file.name);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background/40">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
          {file.dir ? `${file.dir}/` : ""}
          {file.name}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatFileSize(file.size ?? 0)}
        </span>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            download={file.name}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {file.type === "image" && signedUrl ? (
          <img
            src={signedUrl}
            alt={file.name}
            className="w-full rounded-lg border border-border/40"
          />
        ) : file.type === "video" && signedUrl ? (
          <video src={signedUrl} controls className="w-full rounded-lg border border-border/40" />
        ) : file.type === "audio" && signedUrl ? (
          <audio src={signedUrl} controls className="w-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Icon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size ?? 0)} · {file.type}
            </p>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                download={file.name}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectFilesExplorer({
  projectId,
  projectFiles,
  isOwner,
  preselectPath,
  preselectNonce,
}: {
  projectId: string;
  projectFiles: ProjectFile[];
  isOwner: boolean;
  /** Jump-to-file support: when preselectNonce changes, select this file. */
  preselectPath?: string | null;
  preselectNonce?: number;
}) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<TreeFile[]>(projectFiles);
  const filesRef = useRef<TreeFile[]>(projectFiles);
  const [selected, setSelected] = useState<TreeFile | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folderMode, setFolderMode] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Jump-to-file from the project search: select the requested file and
  // clear any active filter so the file is actually visible in the tree.
  useEffect(() => {
    if (!preselectNonce || preselectNonce < 1 || !preselectPath) return;
    const match = filesRef.current.find((f) => f.path === preselectPath);
    if (match) {
      setQuery("");
      setSelected(match);
      setShowAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectNonce]);

  useEffect(() => {
    filesRef.current = projectFiles;
    setFiles(projectFiles);
    setSelected(null);
  }, [projectFiles]);

  const persist = useCallback(
    (updated: TreeFile[]) => {
      filesRef.current = updated;
      setFiles(updated);
      sb.from("projects")
        .update({ uploaded_files: updated })
        .eq("id", projectId)
        .then(({ error }: { error: { message?: string } | null }) => {
          if (error) toast.error("Failed to save file list");
          else {
            queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
          }
        });
    },
    [projectId, queryClient],
  );

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      let success = 0;
      const added: TreeFile[] = [];

      for (const file of Array.from(fileList)) {
        const check = validateLibraryFile(file);
        if (!check.ok) {
          toast.error(`${file.name}: ${check.error}`);
          continue;
        }
        try {
          // Preserve folder structure when the browser reports it (webkitdirectory).
          const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
          const dir = rel ? rel.split("/").slice(0, -1).join("/") : "";
          const path = `${projectId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await sb.storage.from("project-media").upload(path, file);
          if (upErr) throw upErr;
          added.push({
            name: file.name,
            dir,
            size: file.size,
            type: getFileType(file.name),
            uploaded_at: new Date().toISOString(),
            path,
          });
          success++;
        } catch (err: any) {
          toast.error(`${file.name}: ${err.message || "Upload failed"}`);
        }
      }

      if (added.length > 0) {
        persist([...filesRef.current, ...added]);
        toast.success(`${success} file${success !== 1 ? "s" : ""} uploaded`);
      }
      setUploading(false);
    },
    [persist, projectId],
  );

  const handleRemove = useCallback(
    (file: TreeFile) => {
      sb.storage
        .from("project-media")
        .remove([file.path ?? ""])
        .then(() => {
          persist(filesRef.current.filter((f) => f.path !== file.path));
          if (selected?.path === file.path) setSelected(null);
          toast.success("File removed");
        });
    },
    [persist, selected],
  );

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.dir ?? "").toLowerCase().includes(q),
    );
  }, [files, query]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  };

  const fileCount = files.length;
  const showingCount = filteredFiles.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border card-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            Files
            <span className="text-xs text-muted-foreground">
              ({query ? `${showingCount}/${fileCount}` : fileCount})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <label className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…  /"
                aria-label="Search files (press / to focus)"
                className="w-40 rounded-full border border-border/60 bg-background/50 py-1.5 pl-8 pr-7 text-xs text-foreground outline-none transition focus:border-primary/50 focus:bg-background sm:w-48"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear file search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground/60 transition hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              {showAll ? <List className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
              {showAll ? "Tree view" : "Show all files"}
            </button>
            {isOwner && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Upload
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={folderMode}
                    onChange={(e) => setFolderMode(e.target.checked)}
                    className="accent-[var(--user-accent,var(--primary))]"
                  />
                  Upload folders
                </label>
              </>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          {...(folderMode ? { webkitdirectory: "", directory: "" } : {})}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
          className={`p-3 ${isDragOver ? "bg-[var(--user-accent-subtle,var(--surface-elevated))]" : ""}`}
        >
          {files.length === 0 && query ? (
            <div className="px-4 py-10 text-center">
              <SearchIcon className="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No files match “{query}”.</p>
            </div>
          ) : files.length === 0 ? (
            <div
              onClick={() => isOwner && fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                isOwner ? "cursor-pointer" : ""
              } ${isDragOver ? "border-[var(--user-accent,var(--primary))]" : "border-border/40"}`}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">
                {isOwner ? "Drop files here or click to upload" : "No files uploaded yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Images, video, audio, models, documents, code, archives — up to 200 MB. Enable{" "}
                <span className="font-medium">Upload folders</span> to keep a directory structure.
              </p>
            </div>
          ) : showAll ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {filteredFiles
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((f) => {
                  const Icon = getFileIconType(f.name);
                  return (
                    <div
                      key={`${f.dir || ""}/${f.name}`}
                      className="group flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{f.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {f.dir ? `${f.dir}/` : ""}
                          {formatFileSize(f.size ?? 0)} · {f.type}
                        </p>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleRemove(f)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              <div className="max-h-[36rem] overflow-y-auto rounded-lg border border-border/40 bg-background/30 p-1.5 lg:mr-3">
                {[...tree.children.values()]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((child) => (
                    <FolderRow
                      key={child.dir}
                      node={child}
                      depth={0}
                      selected={selected ? `${selected.dir || ""}/${selected.name}` : null}
                      onSelect={(f) => setSelected(f)}
                    />
                  ))}
                {[...tree.files]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((f) => {
                    const Icon = getFileIconType(f.name);
                    const isSelected = selected?.path === f.path;
                    return (
                      <button
                        key={`${f.dir || ""}/${f.name}`}
                        onClick={() => setSelected(f)}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition ${
                          isSelected
                            ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground"
                            : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                        }`}
                        style={{ paddingLeft: "22px" }}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })}
                {tree.children.size === 0 && tree.files.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {query ? "No files match your search" : "No files yet"}
                  </p>
                )}
              </div>
              <FileViewer file={selected} />
            </div>
          )}
        </div>
      </section>

      {/* Linked repositories live with the code */}
      <ProjectReposSection projectId={projectId} isOwner={isOwner} />
    </div>
  );
}
