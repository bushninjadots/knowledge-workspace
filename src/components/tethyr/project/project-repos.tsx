import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  Github,
  GitBranch,
  Star,
  Trash2,
  Plus,
  Code2,
  RefreshCw,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { hasGithubToken, listGithubRepos } from "@/lib/github-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useProjectRepos,
  useAddProjectRepo,
  useRemoveProjectRepo,
  useRefreshRepoMetadata,
  type ProjectRepo,
} from "@/hooks/use-project-repos";
import { timeAgo } from "@/lib/time";
import { safeHref } from "@/lib/validators";

function RepoCard({
  repo,
  isOwner,
  onRemove,
}: {
  repo: ProjectRepo;
  isOwner: boolean;
  onRemove: () => void;
}) {
  const refreshMeta = useRefreshRepoMetadata();

  const meta = repo.metadata;
  const langColor =
    LANGUAGE_COLORS[meta.language?.toLowerCase() ?? ""] ?? "var(--muted-foreground)";

  return (
    <div className="group flex items-start gap-3 rounded-xl border card-border bg-surface p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))]">
      <div className="mt-0.5 shrink-0">
        <Github className="h-5 w-5 text-foreground/70" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={safeHref(repo.url)}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-semibold hover:text-primary hover:underline"
          >
            {meta.full_name ?? repo.url.replace("https://github.com/", "").replace(/\/$/, "")}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        </div>
        {meta.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {meta.language && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
              {meta.language}
            </span>
          )}
          {meta.stargazers_count != null && meta.stargazers_count > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {meta.stargazers_count.toLocaleString()}
            </span>
          )}
          {meta.forks_count != null && meta.forks_count > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {meta.forks_count.toLocaleString()}
            </span>
          )}
          {meta.updated_at && <span>Updated {timeAgo(meta.updated_at)}</span>}
          <button
            onClick={() =>
              refreshMeta.mutate({
                id: repo.id,
                project_id: repo.project_id,
                url: repo.url,
                provider: repo.provider,
              })
            }
            disabled={refreshMeta.isPending}
            className="ml-auto rounded-md p-1 text-muted-foreground/50 transition hover:text-muted-foreground disabled:opacity-30"
            title="Refresh metadata"
          >
            <RefreshCw className={`h-3 w-3 ${refreshMeta.isPending ? "animate-spin" : ""}`} />
          </button>
          {isOwner && (
            <button
              onClick={onRemove}
              className="rounded-md p-1 text-muted-foreground/50 transition hover:text-destructive"
              title="Remove repository"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// GitHub language colours (subset)
const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f1e05a",
  typescript: "#3178c6",
  python: "#3572A5",
  rust: "#dea584",
  go: "#00ADD8",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  ruby: "#701516",
  c: "#555555",
  "c++": "#f34b7d",
  "c#": "#178600",
  php: "#4F5D95",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  shell: "#89e051",
  lua: "#000080",
  r: "#198CE7",
  dart: "#00B4AB",
  elixir: "#6e4a7e",
  haskell: "#5e5086",
  clojure: "#db5855",
  scala: "#c22d40",
  vue: "#41b883",
  svelte: "#ff3e00",
  solidity: "#AA6746",
};

export function ProjectReposSection({
  projectId,
  isOwner,
}: {
  projectId: string;
  isOwner: boolean;
}) {
  const { data: repos = [], isLoading } = useProjectRepos(projectId);
  const addRepo = useAddProjectRepo();
  const removeRepo = useRemoveProjectRepo();
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: hasToken = false } = useQuery({
    queryKey: ["github-token-status"],
    queryFn: () => hasGithubToken(),
    staleTime: 60_000,
  });

  const { data: githubRepos = [], isLoading: loadingRepos } = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: showPicker,
    staleTime: 60_000,
  });

  const handleAdd = () => {
    if (!url.trim()) return;
    addRepo.mutate(
      { project_id: projectId, url: url.trim() },
      {
        onSuccess: () => {
          setUrl("");
          setShowAdd(false);
        },
      },
    );
  };

  if (!isOwner && (!repos || repos.length === 0)) return null;

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          Connected repositories
        </h3>
        {isOwner && (
          <div className="flex items-center gap-1">
            <Link
              to="/profile"
              search={{ github: "token" }}
              title="GitHub token — for private repos and to avoid rate limits. Managed once in your profile."
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                hasToken
                  ? "border-[var(--user-accent,var(--trust))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--trust))]"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="h-3 w-3" />
              {hasToken ? "Token set" : "Add token"}
            </Link>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Link repo
            </button>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Github className="h-3 w-3" />
              From GitHub
              <ChevronDown className={`h-3 w-3 transition ${showPicker ? "rotate-180" : ""}`} />
            </button>
          </div>
        )}
      </div>
      {showPicker && (
        <div className="mb-4 rounded-xl border border-border/60 bg-background/40 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Your GitHub repositories
          </p>
          {loadingRepos ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-surface/60" />
              ))}
            </div>
          ) : githubRepos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Connect GitHub in your profile to see your repos here — or paste a URL above. Public
              repos work without a token; a token adds private repos.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {githubRepos.map((r) => (
                <li key={r.full_name}>
                  <button
                    onClick={() =>
                      addRepo.mutate(
                        { project_id: projectId, url: r.html_url },
                        { onSuccess: () => setShowPicker(false) },
                      )
                    }
                    disabled={addRepo.isPending}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                  >
                    <span className="min-w-0 flex-1 truncate">{r.full_name}</span>
                    {r.language && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {r.language}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showAdd && (
        <div className="mb-4 flex gap-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 border-border/60"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} busy={addRepo.isPending} disabled={!url.trim()}>
            {addRepo.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Link a GitHub repository to show where this project's code lives."
            : "No repositories linked yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              isOwner={isOwner}
              onRemove={() => removeRepo.mutate({ id: repo.id, project_id: projectId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
