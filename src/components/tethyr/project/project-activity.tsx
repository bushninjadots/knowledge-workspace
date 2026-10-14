import { useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Award,
  Check,
  NotebookPen,
} from "lucide-react";
import { useProjectJournal } from "@/hooks/use-journal";
import { entryLine } from "@/lib/journal";
import { groupCommitRuns } from "@/lib/activity-rows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MilestoneRow, ProjectUpdateRow, DiscussionRow } from "@/hooks/use-projects";
import {
  useCreateProjectUpdate,
  useProjectActivity,
  type ProjectActivityRow,
} from "@/hooks/use-projects";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RECOGNITION_LABELS,
  useCreateProjectContribution,
  useRecognizeProjectActivity,
} from "@/hooks/use-project-loop";

const RECOGNITION_KINDS = ["helpful_feedback", "strong_iteration", "made_clearer"] as const;
import { syncGithubProjectActivity } from "@/lib/github-server";
import type { ProjectRepo } from "@/hooks/use-project-repos";
import { timeAgo } from "@/lib/time";
import { safeHref } from "@/lib/validators";
import { Button } from "@/components/ui/button";
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
    | "journal"
    | "founded";
  title: string;
  body?: string;
  metadata?: Record<string, unknown> | null;
  authorId?: string | null;
  authorName?: string;
  authorHandle?: string | null;
  at: string;
};

const PAGE = 15;

/** A same-day run of commits as one row; open it to see each commit. */
function CommitRun({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  const repos = [
    ...new Set(
      items
        .map((i) => (typeof i.metadata?.repository === "string" ? i.metadata.repository : null))
        .filter((r): r is string => !!r),
    ),
  ];
  return (
    <li className="relative">
      <span className="absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-foreground">
        <GitCommit className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-w-0 text-left"
      >
        <p className="text-sm font-medium text-foreground hover:underline">
          {items.length} commits
          {repos.length ? ` to ${repos.map((r) => r.split("/")[1] ?? r).join(", ")}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {timeAgo(items[0].at)} · {open ? "hide" : "show"} commits
        </p>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l border-border/50 pl-3">
          {items.map((c) => (
            <li key={c.id} className="text-xs">
              {typeof c.metadata?.url === "string" ? (
                <a
                  href={safeHref(c.metadata.url as string)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {c.title}
                </a>
              ) : (
                c.title
              )}
              <span className="text-muted-foreground">
                {" "}
                · {typeof c.metadata?.author_login === "string" ? c.metadata.author_login : ""}{" "}
                {timeAgo(c.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

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
  journal: NotebookPen,
  founded: Rocket,
};

const KIND_TINT: Record<ActivityItem["kind"], string> = {
  update: "bg-primary/10 text-primary",
  milestone: "bg-trust/10 text-trust",
  discussion: "bg-ai/10 text-ai",
  file: "bg-learning/10 text-learning",
  repo: "bg-surface-elevated text-muted-foreground",
  github: "bg-surface-elevated text-foreground",
  contribution: "bg-primary/10 text-primary",
  contributor: "bg-teaching/10 text-teaching",
  role: "bg-ai/10 text-ai",
  journal: "bg-teaching/10 text-teaching",
  founded: "bg-trust/10 text-trust",
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
  journal: "Journal",
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
  postRequest = 0,
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
  /** Bumped by the header's "Post update": open the update form here. */
  postRequest?: number;
}) {
  const createUpdate = useCreateProjectUpdate();
  const createContribution = useCreateProjectContribution();
  const recognize = useRecognizeProjectActivity();
  const { data: me } = useCurrentUser();
  const { data: journal } = useProjectJournal(projectId);
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
    const focusContribution = (event: Event) => {
      const focus = (event as CustomEvent<{ focus?: "contribution" | "weekly" }>).detail?.focus;
      setWeeklyPrompt(focus === "weekly");
      setShowPost(false);
      setShowContribution(true);
      setTitle(focus === "weekly" ? "What moved this project forward?" : "");
      window.setTimeout(
        () =>
          document.querySelector<HTMLInputElement>("[aria-label='Contribution title']")?.focus(),
        0,
      );
    };

    window.addEventListener("tethyr:project-activity-focus", focusContribution);
    return () => window.removeEventListener("tethyr:project-activity-focus", focusContribution);
  }, []);

  const postTitleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!postRequest) return;
    setShowContribution(false);
    setShowPost(true);
    // After the form renders and the page has scrolled to it.
    window.setTimeout(() => postTitleRef.current?.focus({ preventScroll: true }), 350);
  }, [postRequest]);

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

    // Journal lines people chose to share under this project.
    const journalItems: ActivityItem[] = (journal ?? []).map((entry) => ({
      id: `j-${entry.id}`,
      kind: "journal",
      title: entryLine(
        { kind: entry.kind, body: entry.body, occurred_at: entry.occurred_at },
        false,
      ),
      body: entry.detail ?? undefined,
      authorId: entry.author_id,
      authorName: entry.author?.display_name ?? entry.author?.handle ?? undefined,
      authorHandle: entry.author?.handle ?? null,
      at: entry.occurred_at,
    }));

    return [...(foundingItem ? [foundingItem] : []), ...sourceItems, ...journalItems].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [activityRows, updates, milestones, discussions, projectFiles, repos, founding, journal]);

  // Hundreds of commits shouldn't bury everything else: same-day commit runs
  // fold into one row, the list pages, and a filter splits updates/commits.
  const [filter, setFilter] = useState<"all" | "updates" | "commits">("all");
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(
    () =>
      groupCommitRuns(
        items.filter((i) =>
          filter === "all"
            ? true
            : filter === "commits"
              ? i.kind === "github"
              : i.kind !== "github",
        ),
      ),
    [items, filter],
  );
  const visibleRows = rows.slice(0, limit);

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
      <section className="surface-panel p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            Activity
            <span className="text-xs text-muted-foreground">({items.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {isContributor && !showPost && !showContribution && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWeeklyPrompt(true);
                    setShowContribution(true);
                    setTitle("What moved this project forward?");
                  }}
                  className="rounded-full"
                >
                  <Sparkles className="h-3 w-3" />
                  Weekly prompt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowContribution(true)}
                  className="rounded-full"
                >
                  <Plus className="h-3 w-3" />
                  Add contribution
                </Button>
              </>
            )}
            {isContributor && !showPost && !showContribution && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowPost(true)}
                className="rounded-full"
              >
                <Plus className="h-3 w-3" />
                Post update
              </Button>
            )}
            {isOwner && repos.some((repo) => repo.provider === "github") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGithubSync}
                busy={syncingGithub}
                className="rounded-full"
              >
                <GitCommit className="h-3 w-3" />
                {syncingGithub ? "Syncing GitHub…" : "Sync GitHub"}
              </Button>
            )}
          </div>
        </div>
        {githubSyncLabel && (
          <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">GitHub: {githubSyncLabel}</p>
        )}

        {showContribution && (
          <div className="mb-4 space-y-2 surface-inset p-3">
            <p className="text-xs font-medium text-foreground">
              {weeklyPrompt ? "Show your work this week" : "Record a contribution"}
            </p>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What changed?"
              aria-label="Contribution title"
              autoFocus
            />
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What did you make, test, improve, or clarify?"
              rows={3}
              className="min-h-0 resize-none"
              aria-label="Contribution details"
            />
            <Input
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="Evidence link (optional)"
              aria-label="Evidence link"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleContribution()}
                busy={posting}
                disabled={!title.trim() || !body.trim()}
              >
                Save evidence
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowContribution(false);
                  setWeeklyPrompt(false);
                }}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showPost && (
          <div className="mb-4 space-y-2 surface-inset p-3">
            <Input
              ref={postTitleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you get done?"
              aria-label="Update title"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details, notes, links… (Markdown supported)"
              rows={4}
              className="min-h-0 resize-none"
              aria-label="Update details"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handlePost}
                busy={posting}
                disabled={!title.trim() || !body.trim()}
              >
                Post update
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowPost(false)}>
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {items.some((i) => i.kind === "github") && (
          <div role="radiogroup" aria-label="Show" className="mb-4 flex flex-wrap gap-1 text-xs">
            {(
              [
                ["all", "Everything"],
                ["updates", "Updates & milestones"],
                ["commits", "Commits"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => {
                  setFilter(value);
                  setLimit(PAGE);
                }}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  filter === value
                    ? "border-border-strong bg-surface-elevated font-medium text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet — milestones, updates, discussions, files, and repositories will show up
            here.
          </p>
        ) : (
          <ol className="relative ml-2 space-y-5 border-l border-border/60 pl-5">
            {visibleRows.map((row) => {
              if (row.type === "commits")
                return <CommitRun key={`c-${row.items[0].id}`} items={row.items} />;
              const item = row.item;
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
                              className="inline-flex min-h-6 items-center font-medium hover:underline"
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
                      {item.kind !== "github" &&
                        me?.userId &&
                        item.authorId &&
                        item.authorId !== me.userId &&
                        activityId && (
                          // One quiet menu per item rather than a row of chips
                          // repeated down the whole feed.
                          <>
                            <span aria-hidden>·</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex min-h-6 items-center gap-1 rounded-md pointer-coarse:min-h-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Recognize ${item.authorName ?? "this contribution"}`}
                              >
                                <Award className="h-3 w-3" aria-hidden />
                                {recognizedKinds.size > 0 ? "Recognized" : "Recognize"}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {RECOGNITION_KINDS.map((kind) => {
                                  const already = recognizedKinds.has(kind);
                                  return (
                                    <DropdownMenuItem
                                      key={kind}
                                      disabled={already || recognize.isPending}
                                      onSelect={() =>
                                        recognize.mutate({
                                          projectActivityId: activityId,
                                          projectId,
                                          recipientId: item.authorId!,
                                          kind,
                                        })
                                      }
                                    >
                                      {already ? (
                                        <Check className="h-3.5 w-3.5" aria-hidden />
                                      ) : null}
                                      {RECOGNITION_LABELS[kind]}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                    </div>
                    {item.body && (
                      <div className="prose-custom mt-1.5 text-sm text-foreground/90">
                        <Markdown remarkPlugins={[remarkGfm]}>{item.body}</Markdown>
                      </div>
                    )}
                    {item.kind === "github" && typeof item.metadata?.url === "string" && (
                      <a
                        href={safeHref(item.metadata.url as string)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex text-[11px] text-primary underline-offset-2 hover:underline"
                      >
                        View commit on GitHub →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {rows.length > limit && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE * 2)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
            >
              Show more ({rows.length - limit} older)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
