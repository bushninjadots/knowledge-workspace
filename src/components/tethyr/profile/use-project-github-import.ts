// GitHub import for a new project: pick a repo, choose what to pull, and
// pre-fill the project form (title, description, skills/tags, README) from it.
// Nothing is saved here; ProjectDialog (project-dialog.tsx) owns the form.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchRepoCommitActivityServer,
  fetchRepoMetaServer,
  fetchRepoReadmeServer,
  listGithubRepos,
} from "@/lib/github-server";
import {
  absolutizeRelativeLinks,
  repoFullNameToTitle,
  type GithubRepoLite,
  type RepoMeta,
} from "@/lib/github";

export const DEFAULT_IMPORT_CHOICES = {
  readme: true,
  description: true,
  language: true,
  topics: true,
};

export function useProjectGithubImport({
  open,
  project,
  allSkills,
  tags,
  setTitle,
  setDescription,
  setSkillIds,
  setTags,
}: {
  open: boolean;
  project: unknown;
  allSkills: { id: string; name: string }[];
  tags: string[];
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setSkillIds: Dispatch<SetStateAction<Set<string>>>;
  setTags: Dispatch<SetStateAction<string[]>>;
}) {
  // ── GitHub import (new projects only) ────────────────────────────────────
  // The import pre-fills the same fields the manual form edits — nothing is
  // published without passing through this dialog, and everything stays
  // editable after import (product rule 6: user agency).
  const [sourceChoice, setSourceChoice] = useState<"scratch" | "github">("scratch");
  const [importedRepo, setImportedRepo] = useState<{
    fullName: string;
    url: string;
  } | null>(null);
  const [importedReadme, setImportedReadme] = useState<string | null>(null);
  const [importedMeta, setImportedMeta] = useState<RepoMeta | null>(null);
  const [importingReadme, setImportingReadme] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const queryClient = useQueryClient();

  // What to pull from the picked repo — everything stays editable afterwards;
  // these just decide what the import pre-fills in the first place.
  const [importChoices, setImportChoices] = useState({ ...DEFAULT_IMPORT_CHOICES });

  const reposQuery = useQuery({
    queryKey: ["github-repos-for-import"],
    queryFn: () => listGithubRepos(),
    enabled: open && !project && sourceChoice === "github",
    staleTime: 60_000,
  });

  const filteredRepos = useMemo(() => {
    const repos = reposQuery.data ?? [];
    if (!repoSearch.trim()) return repos;
    const q = repoSearch.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q),
    );
  }, [reposQuery.data, repoSearch]);

  // The picker's empty state doubles as the GitHub connect prompt: as soon as
  // an account (or a token for the already-connected username) gets connected
  // from inside the dialog, the repo list refetches and the picker takes over.
  const pickerNeedsConnect =
    open &&
    !project &&
    sourceChoice === "github" &&
    !reposQuery.isLoading &&
    !reposQuery.isError &&
    (reposQuery.data ?? []).length === 0;
  const refetchRepos = reposQuery.refetch;
  useEffect(() => {
    if (!pickerNeedsConnect) return;
    return queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey[0];
      if (
        (key === "connected-accounts" || key === "github-token-status") &&
        event.type === "updated" &&
        event.action?.type === "success"
      ) {
        void refetchRepos();
      }
    });
  }, [pickerNeedsConnect, queryClient, refetchRepos]);

  async function pickRepo(repo: GithubRepoLite) {
    const fullName = repo.full_name;
    setImportedRepo({ fullName, url: repo.html_url });
    setImportedReadme(null);
    setImportedMeta(null);
    setTitle(repoFullNameToTitle(fullName));
    if (importChoices.description && repo.description) setDescription(repo.description);
    const language = repo.language;
    if (importChoices.language && language) {
      // Prefer a catalog skill match; otherwise keep the language as a tag so
      // the information survives without inventing a skill that isn't there.
      const match = allSkills.find((s) => s.name.toLowerCase() === language.toLowerCase());
      if (match) setSkillIds((prev) => new Set(prev).add(match.id));
      else setTags((prev) => (prev.includes(language) ? prev : [...prev, language]));
    }
    setImportingReadme(true);
    try {
      // Snapshot the full repo metadata (stars, forks, topics, default branch,
      // visibility) plus the 52-week commit history, alongside the README —
      // the linked repo row starts with a real cached state instead of a
      // stub, and the project page renders stats and the contribution graph
      // without per-view GitHub calls.
      const [owner, repoName] = fullName.split("/");
      const [meta, activity, readme] = await Promise.all([
        owner && repoName
          ? fetchRepoMetaServer({ data: { owner, repo: repoName } }).catch(() => null)
          : Promise.resolve(null),
        owner && repoName
          ? fetchRepoCommitActivityServer({ data: { fullName } }).catch(() => null)
          : Promise.resolve(null),
        fetchRepoReadmeServer({ data: { fullName } }),
      ]);
      // Keep what the picker already proved even when the meta call came back
      // empty (rate limit, network) — never regress to less than we know.
      const snapshot: RepoMeta = meta
        ? { ...meta, full_name: meta.full_name || fullName }
        : {
            full_name: fullName,
            description: repo.description,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            private: repo.private,
          };
      if (activity?.weeks && activity.weeks.length > 0) snapshot.commit_activity = activity.weeks;
      setImportedMeta(snapshot);

      if (importChoices.topics) {
        const topics = (meta?.topics ?? []).filter((t) => t && !tags.includes(t));
        if (topics.length) setTags((prev) => [...prev, ...topics.filter((t) => !prev.includes(t))]);
      }

      const { text, rateLimited, unauthorized } = readme;
      if (unauthorized) {
        toast.error(
          "GitHub rejected the saved token — reconnect it in Settings to import the README",
        );
        return;
      }
      if (rateLimited) {
        toast.info("GitHub is rate-limited — the README can be pulled later from the project page");
        return;
      }
      if (text === null) {
        toast.info("No README in that repo — everything else is filled in");
        return;
      }
      // Relative image/link paths get absolutized against the source repo, so
      // GitHub-hosted screenshots and GIFs render inside the project page. The
      // real default branch beats "HEAD" when GitHub told us what it is.
      if (importChoices.readme) {
        setImportedReadme(
          absolutizeRelativeLinks(text, fullName, snapshot.default_branch || "HEAD"),
        );
      }
      toast.success("Imported — review everything below before publishing");
    } finally {
      setImportingReadme(false);
    }
  }

  /** Back to "start from scratch" with nothing imported (on each open). */
  const resetImport = useCallback(() => {
    setSourceChoice("scratch");
    setImportedRepo(null);
    setImportedReadme(null);
    setImportedMeta(null);
    setRepoSearch("");
    setImportChoices({ ...DEFAULT_IMPORT_CHOICES });
  }, []);

  return {
    sourceChoice,
    setSourceChoice,
    importedRepo,
    setImportedRepo,
    importedReadme,
    setImportedReadme,
    importedMeta,
    setImportedMeta,
    importingReadme,
    repoSearch,
    setRepoSearch,
    importChoices,
    setImportChoices,
    reposQuery,
    filteredRepos,
    pickRepo,
    resetImport,
  };
}
