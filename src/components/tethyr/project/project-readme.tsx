import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Pencil,
  Download,
  X,
  Plus,
  Loader2,
  FileText,
  FolderTree,
  Wrench,
  Check,
  Sparkles,
  Eye,
  Diff,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectDetail, GalleryItem, ResourceItem } from "@/hooks/use-projects";
import { useUpdateProjectReadme, useUpdateProjectContent } from "@/hooks/use-projects";
import { useProjectRepos } from "@/hooks/use-project-repos";
import { fetchRepoReadmeServer } from "@/lib/github-server";
import { getRepoFullName } from "@/lib/github";
import { buildTree, treeToAscii } from "@/lib/file-tree";
import { diffLines, diffStats } from "@/lib/line-diff";
import { cn } from "@/lib/utils";
import { GallerySection, ProjectLibrarySection, ResourcesSection } from "./project-resources";
import type { ProjectFile } from "./project-files";

// The Tiptap README editor drags in the editor core, syntax-highlighting, and
// table/link extensions (~1 MB before gzip) that a read-only visitor never
// needs. Code-split it so the project page's initial JS stays lean; it loads
// only when an owner opens "Edit README". The editor sets
// `immediatelyRender: false` so it is created in an effect rather than during
// render — that avoids a mount-timing race with Suspense that otherwise leaves
// a null editor behind.
const ReadmeEditor = lazy(() =>
  import("./readme-editor").then((m) => ({ default: m.ReadmeEditor })),
);

type EditorView = "write" | "preview" | "changes";

type SkillLite = { id: string; slug: string; name: string; category: string };

export function ProjectReadmeTab({
  project,
  skills,
  projectFiles,
  isOwner,
}: {
  project: ProjectDetail;
  skills: SkillLite[];
  projectFiles: ProjectFile[];
  isOwner: boolean;
}) {
  const updateReadme = useUpdateProjectReadme();
  const updateContent = useUpdateProjectContent();
  const { data: repos = [] } = useProjectRepos(project.id);

  const [editing, setEditing] = useState(false);
  const [editorView, setEditorView] = useState<EditorView>("write");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ text: string; fullName: string } | null>(null);
  const [toolDraft, setToolDraft] = useState("");
  const [addingTool, setAddingTool] = useState(false);

  const tools = project.tools ?? [];

  const startEdit = () => {
    setDraft(project.readme ?? "");
    setEditorView("write");
    setEditing(true);
  };

  const saveReadme = async () => {
    setSaving(true);
    try {
      await updateReadme.mutateAsync({ projectId: project.id, readme: draft });
      setEditing(false);
      toast.success("README saved");
    } catch {
      toast.error("Couldn't save README — try again");
    } finally {
      setSaving(false);
    }
  };

  // Shared loader: fetch the linked repo's README and surface failures as toasts.
  // Returns the text, or null when nothing usable came back.
  const loadRepoReadme = async (): Promise<string | null> => {
    const repo = repos[0];
    if (!repo) {
      toast.error("Link a repository first — the README is imported from there");
      return null;
    }
    const { text, rateLimited, unauthorized } = await fetchRepoReadmeServer({
      data: { fullName: getRepoFullName(repo) },
    });
    if (unauthorized) {
      toast.error("GitHub rejected the saved token — check it and try again");
      return null;
    }
    if (rateLimited) {
      toast.error("GitHub is rate-limited right now — try again in a minute");
      return null;
    }
    if (text === null) {
      toast.error("No README found in the linked repository");
      return null;
    }
    return text;
  };

  const pullFromGitHub = async () => {
    setPulling(true);
    try {
      const text = await loadRepoReadme();
      if (text === null) return;
      setDraft(text);
      setEditing(true);
      toast.success("README imported — review it, then save");
    } catch {
      toast.error("Couldn't reach GitHub — try again");
    } finally {
      setPulling(false);
    }
  };

  const previewFromGitHub = async () => {
    setPreviewing(true);
    try {
      const text = await loadRepoReadme();
      if (text === null) return;
      const fullName = repos[0] ? getRepoFullName(repos[0]) : "";
      setPreview({ text, fullName });
    } catch {
      toast.error("Couldn't reach GitHub — try again");
    } finally {
      setPreviewing(false);
    }
  };

  const usePreviewReadme = () => {
    if (!preview) return;
    setDraft(preview.text);
    setPreview(null);
    setEditing(true);
  };

  const saveContent = async (patch: { gallery?: GalleryItem[]; resources?: ResourceItem[] }) => {
    try {
      await updateContent.mutateAsync({ projectId: project.id, ...patch });
    } catch {
      toast.error("Couldn't save — try again");
      throw new Error("save failed");
    }
  };

  const toggleTool = async (tool: string) => {
    const next = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool];
    try {
      await updateReadme.mutateAsync({ projectId: project.id, tools: next });
      setToolDraft("");
      setAddingTool(false);
    } catch {
      toast.error("Couldn't update tools");
    }
  };

  const repoLanguages = useMemo(
    () =>
      [...new Set(repos.map((r) => r.metadata?.language).filter((l): l is string => !!l))].slice(
        0,
        8,
      ),
    [repos],
  );

  const structureText = useMemo(() => {
    if (projectFiles.length === 0) return "";
    return treeToAscii(buildTree(projectFiles));
  }, [projectFiles]);

  const fallbackDoc = useMemo(() => {
    const parts: string[] = [];
    if (project.vision) parts.push(project.vision);
    if (project.description) parts.push(project.description);
    return parts.join("\n\n");
  }, [project.vision, project.description]);

  // Heading ids for jump-to-section; deduped so renderer and search agree.
  const readmeSections = useMemo(() => {
    const doc = project.readme ?? fallbackDoc;
    return doc ? parseReadmeSections(doc) : [];
  }, [project.readme, fallbackDoc]);
  const headingComponents = useMemo(() => makeHeadingComponents(readmeSections), [readmeSections]);

  // Live word/char stats for the editor footer; warn past 400 words (roughly
  // a long README) so authors notice before publishing a wall of text.
  const stats = useMemo(() => {
    const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
    const chars = draft.length;
    return { words, chars, warning: words > 400 };
  }, [draft]);

  return (
    <div className="space-y-8">
      {/* README document */}
      <section className="rounded-xl border card-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <FileText className="h-4 w-4 text-muted-foreground" />
            README
          </h2>
          {isOwner && !editing && (
            <div className="flex items-center gap-2">
              {repos.length > 0 && (
                <>
                  <button
                    onClick={previewFromGitHub}
                    disabled={previewing}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                  >
                    {previewing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    Preview from GitHub
                  </button>
                  <button
                    onClick={pullFromGitHub}
                    disabled={pulling}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                  >
                    {pulling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Pull from GitHub
                  </button>
                </>
              )}
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit README
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="p-4">
            {/* Editor toolbar: Write / Preview / Changes */}
            <div className="mb-3 flex items-center gap-1 rounded-xl border border-border/40 bg-background/40 p-1">
              {(
                [
                  { id: "write", label: "Write", icon: Pencil },
                  { id: "preview", label: "Preview", icon: Eye },
                  { id: "changes", label: "Changes", icon: Diff },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEditorView(id)}
                  aria-pressed={editorView === id}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    editorView === id
                      ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {editorView === "write" && (
              <Suspense fallback={<EditorSkeleton />}>
                <ReadmeEditor content={draft} onChange={setDraft} />
              </Suspense>
            )}

            {editorView === "preview" && (
              <div className="prose-custom min-h-[24rem] overflow-auto rounded-xl border border-border/40 bg-background/40 px-5 py-5">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={makeHeadingComponents(parseReadmeSections(draft))}
                >
                  {draft}
                </Markdown>
              </div>
            )}

            {editorView === "changes" && (
              <ChangesView before={project.readme ?? ""} after={draft} />
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-xs",
                    stats.warning ? "text-amber-500" : "text-muted-foreground",
                  )}
                >
                  {stats.words} words · {stats.chars.toLocaleString()} chars
                  {stats.warning && " · README is getting long — consider trimming"}
                </p>
                {stats.warning && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                    Long
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Markdown is supported — images, code blocks, tables, quotes, and links.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-xl px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReadme}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save README
                </button>
              </div>
            </div>
          </div>
        ) : project.readme ? (
          <div className="prose-custom px-5 py-5 sm:px-6">
            <Markdown remarkPlugins={[remarkGfm]} components={headingComponents}>
              {project.readme}
            </Markdown>
          </div>
        ) : fallbackDoc ? (
          <div className="prose-custom px-5 py-5 sm:px-6">
            <Markdown remarkPlugins={[remarkGfm]} components={headingComponents}>
              {fallbackDoc}
            </Markdown>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No README yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {isOwner
                ? "This is your project's home. Write a README to tell people what you're building, why, and how it works."
                : "The builder hasn't written a README yet. Check back soon."}
            </p>
            {isOwner && (
              <button
                onClick={startEdit}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-background transition hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Write a README
              </button>
            )}
          </div>
        )}
      </section>

      {/* Live repo README preview — import-on-demand, never auto-saves */}
      {preview && !editing && (
        <section className="rounded-xl border border-[var(--user-accent-border,var(--border-strong))]/60 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Live preview — {preview.fullName}
              <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                not saved
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={usePreviewReadme}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
              >
                <Download className="h-3 w-3" />
                Use this README
              </button>
              <button
                onClick={() => setPreview(null)}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Dismiss
              </button>
            </div>
          </div>
          <div className="prose-custom max-h-[32rem] overflow-auto px-5 py-5 sm:px-6">
            <Markdown remarkPlugins={[remarkGfm]}>{preview.text}</Markdown>
          </div>
        </section>
      )}

      {/* Built with + Tools — integrated into README flow */}
      {(skills.length > 0 || repoLanguages.length > 0 || isOwner || tools.length > 0) && (
        <section className="pt-6">
          <div className="mb-4 h-px bg-border/40" />
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Built with
          </h2>
          {(skills.length > 0 || repoLanguages.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((s) => (
                <Link
                  key={s.id}
                  to="/skills/$slug"
                  params={{ slug: s.slug }}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:opacity-80"
                >
                  {s.name}
                </Link>
              ))}
              {repoLanguages.map((l) => (
                <span
                  key={l}
                  className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          <h2 className="mt-6 flex items-center gap-2 text-sm font-medium text-foreground/80">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Tools
            {isOwner && !addingTool && tools.length < 12 && (
              <button
                onClick={() => setAddingTool(true)}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tools.map((t) => (
              <span
                key={t}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
              >
                {t}
                {isOwner && (
                  <button
                    onClick={() => toggleTool(t)}
                    aria-label={`Remove ${t}`}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {addingTool && (
              <span className="inline-flex items-center gap-1.5">
                <input
                  value={toolDraft}
                  onChange={(e) => setToolDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && toolDraft.trim()) toggleTool(toolDraft.trim());
                    if (e.key === "Escape") setAddingTool(false);
                  }}
                  autoFocus
                  placeholder="e.g. Figma, VS Code, Docker"
                  className="w-44 rounded-full border border-border/60 bg-background px-3 py-1 text-xs outline-none focus:border-primary/50"
                  aria-label="Add a tool"
                />
                <button
                  onClick={() => toolDraft.trim() && toggleTool(toolDraft.trim())}
                  className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-background"
                >
                  Add
                </button>
              </span>
            )}
            {tools.length === 0 && !addingTool && (
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? "Add the tools used to build and manage this project."
                  : "No tools listed."}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Project structure — integrated into README flow */}
      {structureText && (
        <section className="pt-6">
          <div className="mb-4 h-px bg-border/40" />
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            Project structure
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-background/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {structureText}
          </pre>
        </section>
      )}

      {/* Media + resources */}
      <div className="space-y-8">
        <GallerySection
          gallery={(project.gallery ?? []) as GalleryItem[]}
          onUpdate={async (items) => saveContent({ gallery: items })}
          isOwner={isOwner}
          projectId={project.id}
        />
        <ResourcesSection
          resources={(project.resources ?? []) as ResourceItem[]}
          onUpdate={async (items) => saveContent({ resources: items })}
          isOwner={isOwner}
        />
        <ProjectLibrarySection projectId={project.id} isOwner={isOwner} />
      </div>
    </div>
  );
}

// Give every markdown heading a stable, slugified id so the project search
// can jump straight to a section. Duplicate heading text (e.g. two
// "## Overview" sections) gets a numeric suffix so ids stay unique and the
// renderer and search agree on the exact id.
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

export function parseReadmeSections(readme: string): { id: string; text: string; level: number }[] {
  const seen = new Map<string, number>();
  return readme
    .split("\n")
    .map((line) => {
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (!m) return null;
      const text = m[2].trim();
      const base = slugify(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { id: count === 0 ? base : `${base}-${count + 1}`, text, level: m[1].length };
    })
    .filter((s): s is { id: string; text: string; level: number } => !!s);
}

function HeadingWithId({
  level,
  sections,
  children,
}: {
  level: number;
  sections: { id: string; text: string; level: number }[];
  children?: React.ReactNode;
}) {
  const text = Array.isArray(children)
    ? children.map((c) => (typeof c === "string" ? c : "")).join("")
    : typeof children === "string"
      ? children
      : "";
  const match = sections.find((s) => s.text === text);
  const id = match?.id ?? slugify(text);
  const Tag = `h${Math.min(level, 6)}` as keyof React.JSX.IntrinsicElements;
  return <Tag id={id}>{children}</Tag>;
}

function makeHeadingComponents(sections: { id: string; text: string; level: number }[]) {
  return {
    h1: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={1} sections={sections} {...props} />
    ),
    h2: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={2} sections={sections} {...props} />
    ),
    h3: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={3} sections={sections} {...props} />
    ),
    h4: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={4} sections={sections} {...props} />
    ),
    h5: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={5} sections={sections} {...props} />
    ),
    h6: (props: { children?: React.ReactNode }) => (
      <HeadingWithId level={6} sections={sections} {...props} />
    ),
  };
}

function EditorSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[24rem] flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-background/60"
    >
      <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-7 animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
      <div className="space-y-3 px-6 py-5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-elevated" />
      </div>
    </div>
  );
}

function ChangesView({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const { added, removed } = useMemo(() => diffStats(lines), [lines]);

  if (lines.every((l) => l.type === "same")) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-background/40 px-6 text-center">
        <Diff className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No changes yet — edit the README above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-background/40">
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2 font-mono text-[11px]">
        <span className="text-brand-green">+{added}</span>
        <span className="text-destructive">-{removed}</span>
        <span className="ml-auto text-muted-foreground">README.md</span>
      </div>
      <div className="max-h-[26rem] overflow-auto font-mono text-[12.5px] leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 whitespace-pre-wrap break-words px-4 py-[1px]",
              l.type === "add" && "bg-brand-green/10 text-brand-green",
              l.type === "del" && "bg-destructive/10 text-destructive",
              l.type === "same" && "text-foreground/70",
            )}
          >
            <span className="w-4 shrink-0 select-none text-muted-foreground/50">
              {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
            </span>
            <span className="min-w-0">{l.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
