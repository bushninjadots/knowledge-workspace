// ── GitHub, in one place ──────────────────────────────────────────────────────
// Settings → GitHub is the home for the connection: connect (with GitHub's
// own sign-in, or by username), the optional token for private repos, and
// everything GitHub powers across Tethyr with a way to each. Elsewhere a
// small status chip links here instead of repeating the form.
//
// GithubIdentitySync connects GitHub on its own when someone signs in with
// GitHub (or links it), unless they disconnected it before.

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderGit2,
  Github,
  LayoutGrid,
  Link2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GitHubConnect } from "@/components/tethyr/profile/github-connect";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-current-user";
import {
  GITHUB_SETTINGS,
  githubIdentityHandle,
  useConnectGitHub,
  useConnectedAccounts,
  useGithubConnection,
} from "@/hooks/use-github";
import { useProfileReadme } from "@/hooks/use-profile-readme";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { cn } from "@/lib/utils";
import { syncedAgo } from "./github-sync-button";

/** Connect with GitHub's own sign-in (links the identity to this account). */
async function connectWithGithub() {
  const { error } = await supabase.auth.linkIdentity({
    provider: "github",
    options: { redirectTo: `${window.location.origin}/settings#github` },
  });
  if (error) {
    toast.error(
      /manual linking|not enabled|unsupported provider/i.test(error.message)
        ? "Connecting through GitHub isn't switched on here yet — enter your username instead"
        : "Couldn't open GitHub — try again, or enter your username instead",
    );
    return false;
  }
  return true;
}

export function GitHubSettingsSection() {
  const { connected, isLoading } = useGithubConnection();
  const [manual, setManual] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  return (
    <section id="github" className="scroll-mt-20 rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Github className="h-4 w-4 text-muted-foreground" />
        GitHub
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect once and bring your work in wherever it helps — your README, your projects&rsquo;
        repositories and stats, and notes kept in a repo. Nothing changes on Tethyr until you import
        or sync it.
      </p>

      <div className="mt-4">
        {isLoading ? (
          <div className="h-16 animate-gentle-pulse rounded-lg bg-surface/60" />
        ) : connected || manual ? (
          <GitHubConnect startEditing={manual} onCancel={() => setManual(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border/60 bg-surface/30 p-4">
            <Button
              onClick={async () => {
                setRedirecting(true);
                if (!(await connectWithGithub())) {
                  setRedirecting(false);
                  setManual(true);
                }
              }}
              disabled={redirecting}
            >
              {redirecting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Github className="h-4 w-4" aria-hidden />
              )}
              Connect with GitHub
            </Button>
            <button
              type="button"
              onClick={() => setManual(true)}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              or enter your username
            </button>
          </div>
        )}
      </div>

      <GitHubUses />
    </section>
  );
}

/** Everything GitHub powers, with how it stands and a way to each. */
function GitHubUses() {
  const { data: user } = useAuthUser();
  const userId = user?.id ?? null;
  const { connected, username } = useGithubConnection();
  const { data: readme } = useProfileReadme(userId);

  const { data: linked } = useQuery({
    queryKey: ["github-uses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: projects } = await supabasePending
        .from("projects")
        .select("id, title")
        .eq("profile_id", userId as string);
      const ids = ((projects ?? []) as Array<{ id: string; title: string }>).map((p) => p.id);
      const { data: repos } = ids.length
        ? await supabasePending
            .from("project_repositories_safe")
            .select("project_id")
            .in("project_id", ids)
            .eq("provider", "github")
        : { data: [] };
      const withRepo = new Set(
        ((repos ?? []) as Array<{ project_id: string }>).map((r) => r.project_id),
      );
      const { count: notes } = await supabasePending
        .from("library_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId as string)
        .not("github_source", "is", null);
      return {
        projects: ((projects ?? []) as Array<{ id: string; title: string }>).filter((p) =>
          withRepo.has(p.id),
        ),
        notes: notes ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const source = readme?.readme_source;
  const rows: Array<{
    icon: typeof FileText;
    title: string;
    status: string;
    done: boolean;
    action: React.ReactNode;
  }> = [
    {
      icon: FileText,
      title: "README",
      status: source
        ? `From ${source.repo}${syncedAgo(source.synced_at) ? ` · ${syncedAgo(source.synced_at)}` : ""}`
        : "Import your GitHub profile README, or any repo's, from the README block.",
      done: !!source,
      action: (
        <Link to="/studio" className={USE_LINK}>
          Open Studio{arrow}
        </Link>
      ),
    },
    {
      icon: LayoutGrid,
      title: "GitHub on your Studio",
      status: "Your activity, languages and top repositories as a block — from Add → GitHub.",
      done: false,
      action: (
        <Link to="/studio" className={USE_LINK}>
          Add it{arrow}
        </Link>
      ),
    },
    {
      icon: FolderGit2,
      title: "Projects",
      status: linked?.projects.length
        ? `${linked.projects.length} linked to a repository: ${linked.projects
            .slice(0, 3)
            .map((p) => p.title)
            .join(", ")}${linked.projects.length > 3 ? "…" : ""}`
        : "Start a project from a repo, or link one from a project's Code panel.",
      done: !!linked?.projects.length,
      action: linked?.projects[0] ? (
        <Link to="/projects/$id" params={{ id: linked.projects[0].id }} className={USE_LINK}>
          Open{arrow}
        </Link>
      ) : (
        <Link to="/dashboard" className={USE_LINK}>
          Dashboard{arrow}
        </Link>
      ),
    },
    {
      icon: BookOpen,
      title: "Library",
      status: linked?.notes
        ? `${linked.notes} note${linked.notes === 1 ? "" : "s"} kept in sync with a file on GitHub.`
        : "Link a note or document to a file in a repo, then sync it on demand.",
      done: !!linked?.notes,
      action: (
        <Link to="/library" className={USE_LINK}>
          Library{arrow}
        </Link>
      ),
    },
    {
      icon: Link2,
      title: "Profile link",
      status: connected
        ? `github.com/${username} shows in your profile links.`
        : "Added to your profile links when you connect.",
      done: connected,
      action: null,
    },
  ];

  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <h3 className="text-xs font-semibold text-muted-foreground">Where GitHub shows up</h3>
      <ul className="mt-2 divide-y divide-border/50">
        {rows.map(({ icon: Icon, title, status, done, action }) => (
          <li key={title} className="flex items-center gap-3 py-2.5">
            <Icon
              className={cn("h-4 w-4 shrink-0", done ? "text-foreground" : "text-muted-foreground")}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

const USE_LINK =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground";
const arrow = <ArrowRight className="h-3 w-3" aria-hidden />;

/** A one-line GitHub status that links to Settings → GitHub. */
export function GitHubStatusChip({ className }: { className?: string }) {
  const { connected, username, tokenSet, isLoading } = useGithubConnection();
  if (isLoading) return null;
  return (
    <Link
      {...GITHUB_SETTINGS}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-surface-elevated/30 px-3 py-2.5 transition-colors hover:bg-surface-elevated/60",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          connected ? "bg-foreground text-background" : "bg-surface-elevated text-muted-foreground",
        )}
      >
        <Github className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {connected ? `GitHub · @${username}` : "Connect GitHub"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {connected
            ? tokenSet
              ? "Connected with a token — private repos included"
              : "Connected — public repositories"
            : "Bring in your README, repos and activity"}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {connected ? "Manage" : "Set up"}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  );
}

/**
 * Connects GitHub automatically for someone who signed in with GitHub (or
 * linked it from Settings): their GitHub username is already known, so
 * there's nothing to type. Skipped for anyone who disconnected GitHub.
 */
export function GithubIdentitySync() {
  const { data: user } = useAuthUser();
  const { data: accounts, isSuccess } = useConnectedAccounts();
  const connect = useConnectGitHub({ silent: true });
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !isSuccess || tried.current === user.id) return;
    const handle = githubIdentityHandle(user);
    if (!handle || user.user_metadata?.github_autoconnect === false) return;
    if ((accounts ?? []).some((a) => a.provider === "github")) return;
    tried.current = user.id;
    connect.mutate(handle);
  }, [user, accounts, isSuccess, connect]);

  return null;
}
