// "Import from GitHub" / "Sync from GitHub" for a member's profile README —
// on the README block and on the About block in a Studio. Opens the shared
// preview dialog; confirming saves the README and remembers its repo so the
// next click is a sync.

import { useState } from "react";
import { extractGithubUsername } from "@/components/tethyr/blocks/readme-markdown";
import {
  useSaveProfileReadme,
  useStopReadmeSync,
  type ProfileReadme,
} from "@/hooks/use-profile-readme";
import { GitHubImportDialog } from "./github-import-dialog";
import { GitHubSyncButton, syncedAgo } from "./github-sync-button";

export function ProfileReadmeGitHub({
  profileId,
  data,
  className,
}: {
  profileId: string | null;
  data: ProfileReadme | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveProfileReadme(profileId);
  const stopSyncing = useStopReadmeSync(profileId);
  const source = data?.readme_source ?? null;
  const hasReadme = !!data?.readme?.trim();

  return (
    <>
      <GitHubSyncButton
        synced={!!source}
        syncedAt={source?.synced_at}
        onClick={() => setOpen(true)}
        className={className}
      />
      {open && (
        <GitHubImportDialog
          open
          onOpenChange={setOpen}
          sources="profile"
          fallbackUsername={extractGithubUsername(data?.social_links?.github)}
          initialRepo={source?.repo}
          syncedAt={source?.synced_at}
          currentText={data?.readme}
          confirmLabel={hasReadme ? "Replace my README" : "Use this README"}
          onConfirm={(text, repo) =>
            save(text, {
              source: repo,
              message: source ? `README synced from ${repo}` : `README imported from ${repo}`,
            })
          }
          onStopSyncing={stopSyncing}
        />
      )}
    </>
  );
}

/** "From owner/repo · synced 2 days ago" for the owner, or null. */
export function readmeSourceCaption(data: ProfileReadme | null | undefined): string | null {
  const source = data?.readme_source;
  if (!source) return null;
  const ago = syncedAgo(source.synced_at);
  return `From ${source.repo}${ago ? ` · ${ago}` : ""}`;
}
