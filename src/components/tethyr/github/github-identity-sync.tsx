// ── GitHub identity sync ──────────────────────────────────────────────────────
// Mounted once in the root route, so it lives apart from the Settings panel:
// importing it from github-settings.tsx pulled that whole panel (and its
// README/markdown preview) into every page's initial bundle.

import { useEffect, useRef } from "react";
import { useAuthUser } from "@/hooks/use-current-user";
import { githubIdentityHandle, useConnectGitHub, useConnectedAccounts } from "@/hooks/use-github";

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
