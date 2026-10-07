// ── Import / Sync a README from GitHub ────────────────────────────────────────
// The one dialog behind every README "Import from GitHub" / "Sync from
// GitHub": pick the repository, see its README exactly as it will render,
// then choose to use it. Nothing is written until the member confirms, so a
// sync can never silently overwrite edits made on Tethyr.
//
// Sources:
//   • "profile" — the member's GitHub profile README (`<you>/<you>`) first,
//     then their repositories (connected account), or any `owner/name`;
//   • a fixed list — a project's linked repositories.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReadmeMarkdown } from "@/components/tethyr/blocks/readme-markdown";
import { GITHUB_SETTINGS, useGithubConnection } from "@/hooks/use-github";
import { listGithubRepos } from "@/lib/github-server";
import {
  fetchReadmeFrom,
  parseRepoFullName,
  readmeSourceMessage,
} from "@/lib/project-readme-source";
import { syncedAgo } from "./github-sync-button";

export type ReadmeRepoOption = { fullName: string; branch?: string; note?: string };

const OTHER = "__other";

export function GitHubImportDialog({
  open,
  onOpenChange,
  sources,
  fallbackUsername,
  initialRepo,
  syncedAt,
  currentText,
  confirmLabel = "Use this README",
  onConfirm,
  onStopSyncing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "profile" for a member's own README, or a project's linked repos. */
  sources: "profile" | ReadmeRepoOption[];
  /** A username to suggest `<you>/<you>` from when GitHub isn't connected
   *  (e.g. the GitHub link on their profile). */
  fallbackUsername?: string | null;
  /** The repo it was imported from before — opens on it ("Sync"). */
  initialRepo?: string | null;
  syncedAt?: string | null;
  /** What's there now, to say "already up to date". */
  currentText?: string | null;
  confirmLabel?: string;
  /** Use the README. Resolve true (or nothing) to close. */
  onConfirm: (text: string, fullName: string) => Promise<boolean | void> | boolean | void;
  /** Forget the source (shown when syncing). */
  onStopSyncing?: () => void;
}) {
  const { username: connected, connected: isConnected } = useGithubConnection();
  const username = connected ?? fallbackUsername ?? null;
  const isProfile = sources === "profile";

  const { data: ownRepos = [], isLoading: loadingRepos } = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: open && isProfile && isConnected,
    staleTime: 60_000,
  });

  const options = useMemo<ReadmeRepoOption[]>(() => {
    if (!isProfile) return sources;
    const list: ReadmeRepoOption[] = [];
    if (username) list.push({ fullName: `${username}/${username}`, note: "Your profile README" });
    for (const repo of ownRepos) {
      if (!list.some((o) => o.fullName.toLowerCase() === repo.full_name.toLowerCase())) {
        list.push({ fullName: repo.full_name, note: repo.private ? "private" : undefined });
      }
    }
    return list;
  }, [isProfile, sources, username, ownRepos]);

  const [choice, setChoice] = useState<string>("");
  const [other, setOther] = useState("");
  const [otherRepo, setOtherRepo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each time it opens: the previous source, else the first suggestion.
  useEffect(() => {
    if (!open) return;
    const start = initialRepo ?? options[0]?.fullName ?? null;
    const known = start && options.some((o) => o.fullName === start);
    setChoice(start ? (known || !isProfile ? start : OTHER) : isProfile ? OTHER : "");
    setOther(start && !known ? start : "");
    setOtherRepo(start && !known && isProfile ? start : null);
    // Suggestions arriving later must not reset a choice the member made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRepo]);
  // Suggestions that arrive later fill an empty choice, never replace one
  // (functional, so it can't race the reset above in the same commit).
  useEffect(() => {
    if (open && options[0]) setChoice((current) => current || options[0].fullName);
  }, [open, options]);

  const repo = choice === OTHER ? otherRepo : choice || null;
  const branch = options.find((o) => o.fullName === repo)?.branch;
  const readme = useQuery({
    queryKey: ["github-readme-preview", repo, branch],
    queryFn: () => fetchReadmeFrom(repo as string, branch),
    enabled: open && !!repo,
    staleTime: 30_000,
  });
  const result = readme.data;
  const text = result?.ok ? result.text : null;
  const upToDate = !!text && !!currentText && text.trim() === currentText.trim();
  const ago = syncedAgo(syncedAt);

  const confirm = async () => {
    if (!text || !repo) return;
    setSaving(true);
    try {
      const done = await onConfirm(text, repo);
      if (done !== false) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,48rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-4 w-4" aria-hidden />
            {initialRepo ? "Sync from GitHub" : "Import from GitHub"}
          </DialogTitle>
          <DialogDescription>
            {initialRepo
              ? `Brings in the latest README from ${initialRepo}${ago ? ` (last ${ago})` : ""}. Check it below — nothing changes until you choose to use it.`
              : "Pick a repository and check its README below — nothing changes until you choose to use it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="github-readme-repo">
            Repository
          </label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="github-readme-repo" aria-label="Repository">
              <SelectValue placeholder={loadingRepos ? "Loading your repositories…" : "Choose…"} />
            </SelectTrigger>
            <SelectContent>
              {options.length > 0 && (
                <SelectGroup>
                  <SelectLabel>{isProfile ? "Your GitHub" : "Linked repositories"}</SelectLabel>
                  {options.map((option) => (
                    <SelectItem key={option.fullName} value={option.fullName}>
                      {option.fullName}
                      {option.note ? ` — ${option.note}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {isProfile && <SelectItem value={OTHER}>Another repository…</SelectItem>}
            </SelectContent>
          </Select>
          {choice === OTHER && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setOtherRepo(parseRepoFullName(other));
              }}
            >
              <Input
                value={other}
                onChange={(event) => setOther(event.target.value)}
                placeholder="owner/repository"
                aria-label="Repository as owner/name"
                autoComplete="off"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!parseRepoFullName(other)}
              >
                Load
              </Button>
            </form>
          )}
          {isProfile && !isConnected && (
            <p className="text-xs text-muted-foreground">
              <Link
                {...GITHUB_SETTINGS}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Connect GitHub
              </Link>{" "}
              to pick from your repositories (and private ones, with a token).
            </p>
          )}
        </div>

        <div
          className="prose-custom min-h-[14rem] max-h-[50vh] overflow-auto rounded-xl border border-border/50 bg-background/40 px-5 py-4"
          aria-live="polite"
          aria-busy={readme.isFetching}
        >
          {!repo ? (
            <p className="text-sm text-muted-foreground">Choose a repository to see its README.</p>
          ) : readme.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Fetching the README from {repo}…
            </p>
          ) : result && !result.ok ? (
            <p className="text-sm text-muted-foreground">
              {result.reason === "not_found"
                ? `${repo} has no README yet.`
                : readmeSourceMessage(result.reason)}
            </p>
          ) : text ? (
            <ReadmeMarkdown>{text}</ReadmeMarkdown>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {upToDate && (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Already up to date
              </span>
            )}
            {initialRepo && onStopSyncing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  onStopSyncing();
                  onOpenChange(false);
                }}
              >
                Stop syncing
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={confirm} disabled={!text || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
