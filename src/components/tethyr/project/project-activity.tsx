import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity as ActivityIcon,
  PenSquare,
  CheckCircle2,
  MessagesSquare,
  FilePlus2,
  GitBranch,
  UserPlus,
  Briefcase,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { MilestoneRow, ProjectUpdateRow, DiscussionRow } from "@/hooks/use-projects";
import {
  useCreateProjectUpdate,
  useProjectActivity,
  type ProjectActivityRow,
} from "@/hooks/use-projects";
import type { ProjectRepo } from "@/hooks/use-project-repos";
import { timeAgo } from "@/lib/time";
import type { ProjectFile } from "./project-files";

type ActivityItem = {
  id: string;
  kind: "update" | "milestone" | "discussion" | "file" | "repo" | "contributor" | "role";
  title: string;
  body?: string;
  authorName?: string;
  authorHandle?: string | null;
  at: string;
};

const KIND_ICON: Record<ActivityItem["kind"], typeof PenSquare> = {
  update: PenSquare,
  milestone: CheckCircle2,
  discussion: MessagesSquare,
  file: FilePlus2,
  repo: GitBranch,
  contributor: UserPlus,
  role: Briefcase,
};

const KIND_TINT: Record<ActivityItem["kind"], string> = {
  update: "bg-primary/10 text-primary",
  milestone: "bg-brand-green/10 text-brand-green",
  discussion: "bg-brand-purple/10 text-brand-purple",
  file: "bg-learning/10 text-learning",
  repo: "bg-surface-elevated text-muted-foreground",
  contributor: "bg-teaching/10 text-teaching",
  role: "bg-brand-purple/10 text-brand-purple",
};

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  update: "Update",
  milestone: "Milestone",
  discussion: "Discussion",
  file: "File",
  repo: "Repository",
  contributor: "Contributor",
  role: "Role",
};

// Map trigger-recorded kinds (project_activity) onto the display kinds.
const ACTIVITY_KIND_MAP: Record<string, ActivityItem["kind"]> = {
  update: "update",
  milestone_done: "milestone",
  discussion: "discussion",
  file_added: "file",
  repo_linked: "repo",
  contributor_joined: "contributor",
  role_filled: "role",
};

function fromActivityRow(row: ProjectActivityRow): ActivityItem {
  const kind = ACTIVITY_KIND_MAP[row.kind] ?? "update";
  return {
    id: `a-${row.id}`,
    kind,
    title: row.title,
    body: row.body ?? undefined,
    authorName: row.actor?.display_name || row.actor?.handle || undefined,
    authorHandle: row.actor?.handle ?? null,
    at: row.created_at,
  };
}

export function ProjectActivityTab({
  projectId,
  milestones,
  updates,
  discussions,
  projectFiles,
  repos,
  isContributor,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  updates: ProjectUpdateRow[];
  discussions: DiscussionRow[];
  projectFiles: ProjectFile[];
  repos: ProjectRepo[];
  isContributor: boolean;
}) {
  const createUpdate = useCreateProjectUpdate();
  const { data: activityRows } = useProjectActivity(projectId);
  const [showPost, setShowPost] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Primary source: the trigger-recorded project_activity table. If it's
  // empty (e.g. DB hasn't run the triggers migration yet), fall back to the
  // client-side aggregation across the source tables.
  const items = useMemo<ActivityItem[]>(() => {
    if (activityRows && activityRows.length > 0) {
      return activityRows
        .map(fromActivityRow)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }

    const all: ActivityItem[] = [];
    for (const u of updates) {
      all.push({
        id: `u-${u.id}`,
        kind: "update",
        title: u.title,
        body: u.body,
        authorName: u.author?.display_name || u.author?.handle || "Unknown",
        authorHandle: u.author?.handle ?? null,
        at: u.created_at,
      });
    }
    for (const m of milestones) {
      if (m.status !== "done") continue;
      all.push({
        id: `m-${m.id}`,
        kind: "milestone",
        title: `Completed milestone: ${m.title}`,
        at: m.updated_at ?? m.created_at,
      });
    }
    for (const d of discussions) {
      all.push({
        id: `d-${d.id}`,
        kind: "discussion",
        title: `Started discussion: ${d.title}`,
        authorName: d.author?.display_name || d.author?.handle || "Unknown",
        authorHandle: d.author?.handle ?? null,
        at: d.created_at,
      });
    }
    for (const f of projectFiles) {
      all.push({
        id: `f-${f.path ?? f.name}`,
        kind: "file",
        title: `Added ${f.dir ? `${f.dir}/` : ""}${f.name}`,
        at: f.uploaded_at,
      });
    }
    for (const r of repos) {
      all.push({
        id: `r-${r.id}`,
        kind: "repo",
        title: `Linked repository ${r.metadata?.full_name ?? r.url}`,
        at: r.created_at,
      });
    }
    return all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [activityRows, updates, milestones, discussions, projectFiles, repos]);

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await createUpdate.mutateAsync({
        projectId,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle("");
      setBody("");
      setShowPost(false);
      toast.success("Update posted");
    } catch {
      toast.error("Failed to post update");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            Activity
            <span className="text-xs text-muted-foreground">({items.length})</span>
          </h2>
          {isContributor && !showPost && (
            <button
              onClick={() => setShowPost(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Post update
            </button>
          )}
        </div>

        {showPost && (
          <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you get done?"
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details, notes, links… (Markdown supported)"
              rows={4}
              className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePost}
                disabled={!title.trim() || !body.trim() || posting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              >
                {posting && <Loader2 className="h-3 w-3 animate-spin" />}
                Post update
              </button>
              <button
                onClick={() => setShowPost(false)}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet — milestones, updates, discussions, files, and repositories will show up
            here.
          </p>
        ) : (
          <ol className="relative ml-2 space-y-5 border-l border-border/60 pl-5">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="relative">
                  <span
                    className={`absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full ${KIND_TINT[item.kind]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <span className="rounded-full border border-border/60 px-1.5 py-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {KIND_LABEL[item.kind]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {item.authorName && (
                        <>
                          {item.authorHandle ? (
                            <Link
                              to="/u/$handle"
                              params={{ handle: item.authorHandle }}
                              className="font-medium hover:underline"
                            >
                              {item.authorName}
                            </Link>
                          ) : (
                            <span className="font-medium">{item.authorName}</span>
                          )}
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span>{timeAgo(item.at)}</span>
                    </div>
                    {item.body && (
                      <div className="prose-custom mt-1.5 text-sm text-foreground/90">
                        <Markdown remarkPlugins={[remarkGfm]}>{item.body}</Markdown>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
