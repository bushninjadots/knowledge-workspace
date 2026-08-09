import { useState } from "react";
import { FolderOpen, Link2, Plus, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMyProjects } from "@/hooks/use-projects";
import type { ProjectSnapshot } from "@/hooks/use-community";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const FEEDBACK_TAG_OPTIONS = ["UI Design", "Code Review", "Performance", "Architecture", "General"];

type Props = {
  onAttach: (projectId: string | null, snapshot: ProjectSnapshot) => void;
  onRemove: () => void;
  onFeedbackTagsChange: (tags: string[]) => void;
  currentAttachment: { projectId?: string; snapshot: ProjectSnapshot } | null;
  feedbackTags: string[];
};

export function AttachProjectPanel({
  onAttach,
  onRemove,
  onFeedbackTagsChange,
  currentAttachment,
  feedbackTags,
}: Props) {
  const [tab, setTab] = useState<"my-projects" | "external" | "create">("my-projects");
  const [externalUrl, setExternalUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchedSnapshot, setFetchedSnapshot] = useState<ProjectSnapshot | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: myProjects = [], isLoading: loadingProjects } = useMyProjects();

  async function fetchExternalPreview() {
    if (!externalUrl.trim()) return;
    setFetching(true);
    setFetchedSnapshot(null);
    try {
      const { data, error } = await sb.functions.invoke("fetch-project-preview", {
        body: { url: externalUrl.trim() },
      });
      if (error) throw error;
      setFetchedSnapshot(data as ProjectSnapshot);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to fetch preview");
    } finally {
      setFetching(false);
    }
  }

  function confirmExternal() {
    if (!fetchedSnapshot) return;
    onAttach(null, fetchedSnapshot);
    setExternalUrl("");
    setFetchedSnapshot(null);
  }

  async function createAndAttach() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("projects")
        .insert({
          profile_id: user.id,
          title: newName.trim(),
          description: newDesc.trim() || null,
          status: "planning",
          stage: "planning",
        })
        .select("id, title, description, status, stage")
        .single();

      if (error) throw error;

      const snapshot: ProjectSnapshot = {
        name: data.title,
        description: data.description,
        platform: "tethyr",
        url: `/projects/${data.id}`,
        logo: null,
        status: data.status,
        stage: data.stage,
      };
      onAttach(data.id, snapshot);
      setNewName("");
      setNewDesc("");
      toast.success("Project created and attached");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  function toggleFeedbackTag(tag: string) {
    const next = feedbackTags.includes(tag)
      ? feedbackTags.filter((t) => t !== tag)
      : [...feedbackTags, tag];
    onFeedbackTagsChange(next);
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
      {currentAttachment ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentAttachment.snapshot.name}</p>
            <p className="text-xs text-muted-foreground">{currentAttachment.snapshot.platform}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove attached project"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="my-projects" className="flex items-center gap-1.5 text-xs">
              <FolderOpen className="h-3 w-3" /> My Projects
            </TabsTrigger>
            <TabsTrigger value="external" className="flex items-center gap-1.5 text-xs">
              <Link2 className="h-3 w-3" /> External URL
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1.5 text-xs">
              <Plus className="h-3 w-3" /> Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects" className="mt-2">
            {loadingProjects ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : myProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No projects yet. Create one or attach an external URL.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {myProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const snapshot: ProjectSnapshot = {
                        name: p.title,
                        description: p.description,
                        platform: "tethyr",
                        url: `/projects/${p.id}`,
                        logo: p.cover_url,
                        status: p.status,
                        stage: p.stage,
                      };
                      onAttach(p.id, snapshot);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-elevated"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-green/10 text-xs font-semibold text-brand-green">
                      {p.title.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.stage}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="external" className="mt-2 space-y-2">
            <div className="flex gap-2">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchExternalPreview();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={fetchExternalPreview}
                disabled={fetching || !externalUrl.trim()}
                className="shrink-0"
              >
                {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fetch"}
              </Button>
            </div>
            {fetchedSnapshot && (
              <div className="flex items-center gap-3 rounded-2xl border card-border p-2">
                {fetchedSnapshot.logo ? (
                  <img
                    src={fetchedSnapshot.logo}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-xs">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fetchedSnapshot.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fetchedSnapshot.platform}
                  </p>
                </div>
                <Button size="sm" onClick={confirmExternal} className="shrink-0">
                  Attach
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="mt-2 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="text-xs"
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="text-xs"
            />
            <Button
              size="sm"
              onClick={createAndAttach}
              disabled={creating || !newName.trim()}
              className="w-full"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create & Attach"}
            </Button>
          </TabsContent>
        </Tabs>
      )}

      {currentAttachment && FEEDBACK_TAG_OPTIONS.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FEEDBACK_TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleFeedbackTag(tag)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                feedbackTags.includes(tag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
