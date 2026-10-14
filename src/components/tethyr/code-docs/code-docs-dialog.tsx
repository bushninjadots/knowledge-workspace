// Code → docs. Paste code, pick a file from a project's repo, or read a whole
// project — Tethyr writes a readable doc from the code itself (free, nothing
// leaves the site). With the member's own AI key, "Explain with AI" turns it
// into plain language. Save it to the Library, or put it on the project page.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpenText, FileCode2, FolderGit2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ReadmeMarkdown } from "@/components/tethyr/blocks/readme-markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreateItem } from "@/hooks/use-library";
import { outlineCode, outlineToMarkdown } from "@/lib/code-outline";
import { explainWithAi, getProjectRepoFile, getProjectRepoOverview } from "@/lib/code-docs-server";
import { friendlyError } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAiKeyStatus } from "./ai-key-settings";

type Source = "paste" | "file" | "project";

type ProjectContext = { readme: string; paths: string[]; packageJson: string | null };

export function CodeDocsDialog({
  open,
  onOpenChange,
  initialSource = "paste",
  projectId: initialProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSource?: Source;
  projectId?: string;
}) {
  const { data: me } = useCurrentUser();
  const { data: ai } = useAiKeyStatus();
  const qc = useQueryClient();
  const createItem = useCreateItem();
  const myProjects = me?.projects ?? [];

  const [source, setSource] = useState<Source>(initialSource);
  const [projectId, setProjectId] = useState(initialProject ?? myProjects[0]?.id ?? "");
  const [filename, setFilename] = useState("snippet.ts");
  const [code, setCode] = useState("");
  const [path, setPath] = useState("");
  const [doc, setDoc] = useState("");
  const [title, setTitle] = useState("");
  const [projectCtx, setProjectCtx] = useState<ProjectContext | null>(null);
  const [view, setView] = useState<"preview" | "edit">("preview");
  const [busy, setBusy] = useState<null | "load" | "ai" | "save">(null);
  const [byAi, setByAi] = useState(false);

  useEffect(() => {
    if (open) {
      setSource(initialSource);
      if (initialProject) setProjectId(initialProject);
    }
  }, [open, initialSource, initialProject]);

  const ownsProject = myProjects.some((p) => p.id === projectId);
  const projectTitle =
    myProjects.find((p) => p.id === projectId)?.title ?? (initialProject ? "this project" : "");

  function reset(next: Source) {
    setSource(next);
    setDoc("");
    setProjectCtx(null);
    setByAi(false);
  }

  function outlineFrom(text: string, name: string) {
    setDoc(outlineToMarkdown(outlineCode(text, name), name));
    setTitle(`${name} — explained`);
    setByAi(false);
    setView("preview");
  }

  async function loadFile() {
    if (!projectId || !path.trim()) return;
    setBusy("load");
    try {
      const r = await getProjectRepoFile({ data: { projectId, path } });
      if (!r.ok) return void toast.error(r.error);
      setCode(r.text);
      setFilename(r.path);
      outlineFrom(r.text, r.path);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't load that file"));
    } finally {
      setBusy(null);
    }
  }

  async function readProject() {
    if (!projectId) return;
    setBusy("load");
    try {
      const r = await getProjectRepoOverview({ data: { projectId } });
      if (!r.ok) return void toast.error(r.error);
      setDoc(r.markdown);
      setProjectCtx(r.context);
      setTitle(`How ${projectTitle || r.repo} works`);
      setByAi(false);
      setView("preview");
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't read the repo"));
    } finally {
      setBusy(null);
    }
  }

  async function explain() {
    setBusy("ai");
    try {
      const r =
        source === "project"
          ? await explainWithAi({
              data: { mode: "project", overview: doc, context: projectCtx ?? undefined },
            })
          : await explainWithAi({ data: { mode: "file", filename, source: code, outline: doc } });
      if (!r.ok) return void toast.error(r.error);
      setDoc(r.markdown);
      setByAi(true);
      setView("preview");
      if (r.truncated) toast.message("The explanation was long and got cut off at the end.");
    } catch (e) {
      toast.error(friendlyError(e, "The AI step failed"));
    } finally {
      setBusy(null);
    }
  }

  async function saveToLibrary() {
    setBusy("save");
    try {
      await createItem.mutateAsync({
        title: title.trim() || "Code docs",
        content: doc,
        type: "document",
        content_format: "markdown",
        project_id: projectId && source !== "paste" ? projectId : null,
      });
      toast.success("Saved to your Library");
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't save it"));
    } finally {
      setBusy(null);
    }
  }

  async function addToReadme() {
    if (!ownsProject) return;
    setBusy("save");
    try {
      const { data: row, error } = await supabase
        .from("projects")
        .select("readme")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      // The generated doc's own "# Title" becomes a section of the README.
      const section = doc.replace(/^# (.+)$/m, "## $1");
      const readme = row.readme?.trim() ? `${row.readme.trim()}\n\n${section}` : section;
      const { error: upErr } = await supabase
        .from("projects")
        .update({ readme })
        .eq("id", projectId);
      if (upErr) throw upErr;
      void qc.invalidateQueries({ queryKey: ["project-detail"] });
      toast.success("Added to the project README");
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't update the README"));
    } finally {
      setBusy(null);
    }
  }

  const canExplain = source === "project" ? !!projectCtx : !!code.trim();
  const sources = useMemo(
    () =>
      [
        { id: "paste" as const, label: "Paste code", icon: FileCode2 },
        { id: "file" as const, label: "File from a project", icon: FolderGit2 },
        { id: "project" as const, label: "Whole project", icon: BookOpenText },
      ] satisfies { id: Source; label: string; icon: typeof FileCode2 }[],
    [],
  );

  const projectPicker = (
    <Select value={projectId} onValueChange={setProjectId}>
      <SelectTrigger aria-label="Project">
        <SelectValue placeholder="Pick a project" />
      </SelectTrigger>
      <SelectContent>
        {initialProject && !ownsProject && (
          <SelectItem value={initialProject}>This project</SelectItem>
        )}
        {myProjects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Code → docs</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Tethyr reads the code and writes a doc anyone can follow — free, and nothing leaves the
            site. {ai?.hasKey ? "Your AI key can rewrite it in plain language." : ""}
          </p>
        </DialogHeader>

        <div role="tablist" aria-label="Source" className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={source === s.id}
              onClick={() => reset(s.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                source === s.id
                  ? "border-border-strong bg-surface-elevated font-medium"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className="h-3.5 w-3.5" aria-hidden />
              {s.label}
            </button>
          ))}
        </div>

        {source === "paste" && (
          <div className="space-y-2">
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value.slice(0, 120))}
              placeholder="File name, e.g. money.ts (sets the language)"
              aria-label="File name"
            />
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={10}
              placeholder="Paste a file or a function…"
              aria-label="Code"
              className="font-mono text-xs"
            />
            <Button size="sm" disabled={!code.trim()} onClick={() => outlineFrom(code, filename)}>
              Write the docs
            </Button>
          </div>
        )}

        {source === "file" && (
          <div className="space-y-2">
            {projectPicker}
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadFile()}
                placeholder="Path in the repo, e.g. src/lib/money.ts"
                aria-label="File path"
              />
              <Button
                size="sm"
                busy={busy === "load"}
                disabled={!projectId || !path.trim()}
                onClick={loadFile}
              >
                Read file
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uses the GitHub repo in the project's “Where it lives”.
            </p>
          </div>
        )}

        {source === "project" && (
          <div className="space-y-2">
            {projectPicker}
            <Button size="sm" busy={busy === "load"} disabled={!projectId} onClick={readProject}>
              Read the whole project
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Reads the README, setup files and folder layout to write a “How this project works”
              page for new contributors.
            </p>
          </div>
        )}

        {doc && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="View" className="flex gap-1 text-xs">
                {(["preview", "edit"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "rounded-md px-2.5 py-1 capitalize",
                      view === v ? "bg-surface-elevated font-medium" : "text-muted-foreground",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {byAi
                  ? "Written with your AI key — check it before sharing"
                  : "Written from the code"}
              </span>
              <div className="ml-auto">
                {ai?.hasKey ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    busy={busy === "ai"}
                    disabled={!canExplain}
                    onClick={explain}
                  >
                    <Sparkles /> {byAi ? "Explain again" : "Explain with AI"}
                  </Button>
                ) : (
                  <Link
                    to="/settings"
                    hash="ai-key"
                    onClick={() => onOpenChange(false)}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Add your own AI key for a plain-language version
                  </Link>
                )}
              </div>
            </div>
            {view === "preview" ? (
              <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border/60 p-4">
                <ReadmeMarkdown>{doc}</ReadmeMarkdown>
              </div>
            ) : (
              <Textarea
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                rows={16}
                aria-label="Doc (Markdown)"
                className="font-mono text-xs"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 140))}
                placeholder="Title"
                aria-label="Title"
                className="min-w-0 flex-1 basis-56"
              />
              <Button size="sm" busy={busy === "save"} onClick={saveToLibrary}>
                Save to Library
              </Button>
              {source === "project" && ownsProject && (
                <Button size="sm" variant="outline" busy={busy === "save"} onClick={addToReadme}>
                  Add to the project README
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
