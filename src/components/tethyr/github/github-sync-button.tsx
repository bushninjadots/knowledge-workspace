// ── GitHub sync button ────────────────────────────────────────────────────────
// One button, one vocabulary, everywhere Tethyr brings something in from
// GitHub: "Import from GitHub" the first time, "Sync from GitHub" once there
// is a source to refresh from — with when it last happened. Used by the
// profile README and About blocks, the project README and code panel, and
// library notes linked to a file.

import { formatDistanceToNowStrict } from "date-fns";
import { Github, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "synced 3 days ago", or null without a valid time. */
export function syncedAgo(at: string | null | undefined): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return `synced ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

export function GitHubSyncButton({
  synced,
  syncedAt,
  busy = false,
  onClick,
  className,
  size = "sm",
  variant = "outline",
  disabled,
}: {
  /** There is already a source to refresh from (otherwise: import). */
  synced: boolean;
  syncedAt?: string | null;
  busy?: boolean;
  onClick: () => void;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  disabled?: boolean;
}) {
  const label = synced ? "Sync from GitHub" : "Import from GitHub";
  const ago = syncedAgo(syncedAt);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={busy || disabled}
      title={ago ? `${label} — ${ago}` : label}
      className={cn("gap-1.5", className)}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : synced ? (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Github className="h-3.5 w-3.5" aria-hidden />
      )}
      {busy ? (synced ? "Syncing…" : "Importing…") : label}
    </Button>
  );
}
