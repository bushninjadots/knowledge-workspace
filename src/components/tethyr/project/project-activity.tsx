import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  PenSquare,
  CheckCircle2,
  MessagesSquare,
  FilePlus2,
  GitBranch,
  GitCommit,
  UserPlus,
  Briefcase,
  Rocket,
  Plus,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MilestoneRow, ProjectUpdateRow, DiscussionRow } from "@/hooks/use-projects";
import {
  useCreateProjectUpdate,
  useProjectActivity,
  type ProjectActivityRow,
} from "@/hooks/use-projects";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  RECOGNITION_LABELS,
  useCreateProjectContribution,
  useRecognizeProjectActivity,
} from "@/hooks/use-project-loop";
import { syncGithubProjectActivity } from "@/lib/github-server";
import type { ProjectRepo } from "@/hooks/use-project-repos";
import { timeAgo } from "@/lib/time";
import type { ProjectFile } from "./project-files";

type ActivityItem = {
  id: string;
  kind:
    | "update"
    | "milestone"
    | "discussion"
    | "file"
    | "repo"
    | "github"
    | "contribution"
    | "contributor"
    | "role"
    | "founded";
  title: string;
  body?: string;
  metadata?: Record<string, unknown> | null;
  authorId?: string | null;
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
  github: GitCommit,
  contribution: Sparkles,
  contributor: UserPlus,
  role: Briefcase,
  founded: Rocket,
};

const KIND_TINT: Record<ActivityItem["kind"], string> = {
  update: "bg-primary/10 text-primary",
  milestone: "bg-brand-green/10 text-brand-green",
  discussion: "bg-brand-purple/10 text-brand-purple",
  file: "bg-learning/10 text-learning",
  repo: "bg-surface-elevated text-muted-foreground",
  github: "bg-surface-elevated text-foreground",
  contribution: "bg-primary/10 text-primary",
  contributor: "bg-teaching/10 text-teaching",
  role: "bg-brand-purple/10 text-brand-purple",
  founded: "bg-brand-green/10 text-brand-green",
};

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  update: "Update",
  milestone: "Milestone",
  discussion: "Discussion",
  file: "File",
  repo: "Repository",
  github: "GitHub commit",
  contribution: "Contribution",
  contributor: "Contributor",
  role: "Role",
  founded: "Founded",
};

// Map trigger-recorded kinds (project_activity) onto the display kinds.
const ACTIVITY_KIND_MAP: Record<string, ActivityItem["kind"]> = {
  update: "update",
  milestone_done: "milestone",
  discussion: "discussion",
  file_added: "file",
  repo_linked: "repo",
  github_commit: "github",
  contribution: "contribution",
  weekly_prompt: "contribution",
  contributor_joined: "contributor",
  role_filled: "role",
};

function fromActivityRow(row: ProjectActivityRow): ActivityItem {
  const kind = ACTIVITY_KIND_MAP[row.kind] ?? "update";
  const metadata = (row.metadata as Record<string, unknown> | null) ?? null;
  const githubAuthor =
    kind === "github" && typeof metadata?.author_login === "string"
      ? `@${metadata.author_login}`
      : kind === "github" && typeof metadata?.author_name === "string"
        ? metadata.author_name
        : undefined;
  return {
    id: `a-${row.id}`,
    kind,
    title: row.title,
    body: row.body ?? undefined,
    metadata,
    // GitHub authors are external identities until they explicitly connect
    // their Tethyr account, so never turn a repository login into a Tethyr
    // profile link or attribute the commit to the project owner.
    authorId: kind === "github" ? null : row.actor_id,
    authorName: githubAuthor ?? (row.actor?.display_name || row.actor?.handle || undefined),
    authorHandle: kind === "github" ? null : (row.actor?.handle ?? null),
    at: row.created_at,
  };
}

/** Fallback client-side aggregation used when project_activity is empty. */
function buildFallbackItems(
  updates: ProjectUpdateRow[],
  milestones: MilestoneRow[],
  discussions: DiscussionRow[],
  projectFiles: ProjectFile[],
  repos: ProjectRepo[],
): ActivityItem[] {
  const all: ActivityItem[] = [];
  for (const u of updates) {
    all.push({
      id: `u-${u.id}`,
      kind: "update",
      title: u.title,
      body: u.body,
      authorId: u.author_id,
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
}

export function ProjectActivityTab({
  projectId,
  milestones,
  updates,
  discussions,
  projectFiles,
  repos,
  isContributor,
  isOwner,
  openWeeklyPrompt = false,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  updates: ProjectUpdateRow[];
  discussions: DiscussionRow[];
  projectFiles: ProjectFile[];
  repos: ProjectRepo[];
  isContributor: boolean;
  isOwner: boolean;
  openWeeklyPrompt?: boolean;
}) {
  const createUpdate = useCreateProjectUpdate();
  const createContribution = useCreateProjectContribution();
  const recognize = useRecognizeProjectActivity();
  const { data: me } = useCurrentUser();
  const { data: activityRows } = useProjectActivity(projectId);
  const { data: recognitions = [] } = useQuery({
    queryKey: ["project-recognitions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_recognitions")
        .select("project_activity_id, kind, giver_id")
        .eq("project_id", projectId);
      if (error) return [];
      return (data ?? []) as { project_activity_id: string; kind: string; giver_id: string }[];
    },
    enabled: !!projectId && !!me?.userId,
  });

  // The project's founding moment lives in contribution_log (project_published),
  // which project_activity doesn't record. Surface it so the feed shows the
  // actual contribution history, not just the trigger-recorded delta.
  const { data: founding } = useQuery({
    queryKey: ["project-founding", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contribution_log")
        .select("id, created_at")
        .eq("action", "project_published")
        .filter("metadata->>project_id", "eq", projectId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as { id: string; created_at: string } | null) ?? null;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  const [showPost, setShowPost] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [weeklyPrompt, setWeeklyPrompt] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubSyncLabel, setGithubSyncLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!openWeeklyPrompt) return;
    setWeeklyPrompt(true);
    setShowContribution(true);
    setTitle("What moved this project forward?");
  }, [openWeeklyPrompt]);

  // Primary source: the trigger-recorded project_activity table. If it's
  // empty (e.g. DB hasn't run the triggers migration yet), fall back to the
  // client-side aggregation across the source tables.
  const items = useMemo<ActivityItem[]>(() => {
    const foundingItem: ActivityItem | null = founding
      ? {
          id: `f-${founding.id}`,
          kind: "founded",
          title: "Project published",
          at: founding.created_at,
        }
      : null;

    const sourceItems: ActivityItem[] =
      activityRows && activityRows.length > 0
        ? activityRows.map(fromActivityRow)
        : buildFallbackItems(updates, milestones, discussions, projectFiles, repos);

    return [...(foundingItem ? [foundingItem] : []), ...sourceItems].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [activityRows, updates, milestones, discussions, projectFiles, repos, founding]);

  useEffect(() => {
    if (!isOwner || !repos.some((repo) => repo.provider === "github")) return;
    setSyncingGithub(true);
    void syncGithubProjectActivity({ data: { projectId } })
      .then((result) =>
        setGithubSyncLabel(
          result.added > 0
            ? `${result.added} new commit${result.added === 1 ? "" : "s"}`
            : "Up to date",
        ),
      )
      .catch(() => setGithubSyncLabel("GitHub sync unavailable"))
      .finally(() => setSyncingGithub(false));
  }, [isOwner, projectId, repos]);

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

  const handleContribution = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await createContribution.mutateAsync({
        projectId,
        title,
        body,
        evidenceUrl: evidenceUrl.trim() || null,
        evidenceKind: evidenceUrl.trim() ? "link" : null,
        entryKind: weeklyPrompt ? "weekly_prompt" : "contribution",
        promptId: weeklyPrompt ? "weekly-show-your-work" : null,
      });
      setTitle("");
      setBody("");
      setEvidenceUrl("");
      setShowContribution(false);
      setWeeklyPrompt(false);
      toast.success(weeklyPrompt ? "Weekly evidence added" : "Contribution recorded");
    } catch {
      toast.error("Couldn't record the contribution");
    } finally {
      setPosting(false);
    }
  };

  const handleGithubSync = () => {
    setSyncingGithub(true);
    void syncGithubProjectActivity({ data: { projectId } })
      .then((result) => {
        setGithubSyncLabel(
          result.added > 0
            ? `${result.added} new commit${result.added === 1 ? "" : "s"}`
            : "Up to date",
        );
        toast.success(
          result.added > 0
            ? `${result.added} GitHub commit${result.added === 1 ? "" : "s"} added`
            : "GitHub is up to date",
        );
      })
      .catch(() => {
        setGithubSyncLabel("GitHub sync unavailable");
        toast.error("Couldn't sync GitHub activity");
      })
      .finally(() => setSyncingGithub(false));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            Activity
            <span className="text-xs text-muted-foreground">({items.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {isContributor && !showPost && !showContribution && (
              <>
                <button
                  onClick={() => {
                    setWeeklyPrompt(true);
                    setShowContribution(true);
                    setTitle("What moved this project forward?");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent-border,var(--border-strong))] px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  Weekly prompt
                </button>
                <button
                  onClick={() => setShowContribution(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Add contribution
                </button>
              </>
            )}
            {isContributor && !showPost && !showContribution && (
              <button
                onClick={() => setShowPost(true)}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Post update
              </button>
            )}
            {isOwner && repos.some((repo) => repo.provider === "github") && (
              <button
                type="button"
                onClick={handleGithubSync}
                disabled={syncingGithub}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                <GitCommit className="h-3 w-3" />
                {syncingGithub ? "Syncing GitHub…" : "Sync GitHub"}
              </button>
            )}
          </div>
        </div>
        {githubSyncLabel && (
          <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">GitHub: {githubSyncLabel}</p>
        )}

        {showContribution && (
          <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
            <p className="text-xs font-medium text-foreground">
              {weeklyPrompt ? "Show your work this week" : "Record a contribution"}
            </p>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What changed?"
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label="Contribution title"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What did you make, test, improve, or clarify?"
              rows={3}
              className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label="Contribution details"
            />
            <input
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="Evidence link (optional)"
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label="Evidence link"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleContribution()}
                disabled={!title.trim() || !body.trim() || posting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
              >
                {posting && <Loader2 className="h-3 w-3 animate-spin" />}Save evidence
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowContribution(false);
                  setWeeklyPrompt(false);
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

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
              const activityId = item.id.startsWith("a-") ? item.id.slice(2) : null;
              const recognizedKinds = new Set(
                recognitions
                  .filter((recognition) => recognition.project_activity_id === activityId)
                  .filter((recognition) => recognition.giver_id === me?.userId)
                  .map((recognition) => recognition.kind),
              );
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
                    {item.kind === "github" && typeof item.metadata?.url === "string" && (
                      <a
                        href={item.metadata.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex text-[11px] text-primary underline-offset-2 hover:underline"
                      >
                        View commit on GitHub →
                      </a>
                    )}
                    {item.kind !== "github" &&
                      me?.userId &&
                      item.authorId &&
                      item.authorId !== me.userId &&
                      activityId && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Recognize:</span>
                          {(["helpful_feedback", "strong_iteration", "made_clearer"] as const).map(
                            (kind) => {
                              const already = recognizedKinds.has(kind);
                              return (
                                <button
                                  key={kind}
                                  type="button"
                                  disabled={already || recognize.isPending}
                                  onClick={() =>
                                    recognize.mutate({
                                      projectActivityId: activityId,
                                      projectId,
                                      recipientId: item.authorId!,
                                      kind,
                                    })
                                  }
                                  className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground disabled:cursor-default disabled:opacity-60"
                                >
                                  {already
                                    ? `✓ ${RECOGNITION_LABELS[kind]}`
                                    : RECOGNITION_LABELS[kind]}
                                </button>
                              );
                            },
                          )}
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
