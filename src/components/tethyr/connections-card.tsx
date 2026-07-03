// Dashboard card: incoming requests + accepted connections.
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useConnections,
  useRespondConnection,
  useDeleteConnection,
} from "@/hooks/use-connections";

export function ConnectionsCard() {
  const { data: me } = useCurrentUser();
  const { data: connections, isLoading } = useConnections();
  const respond = useRespondConnection();
  const remove = useDeleteConnection();

  const meId = me?.userId ?? null;
  const incoming =
    connections?.filter((c) => c.status === "pending" && c.addressee_id === meId) ?? [];
  const accepted = connections?.filter((c) => c.status === "accepted") ?? [];

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-surface p-6">
        <div className="h-6 w-32 animate-pulse rounded-full bg-surface-elevated" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Connections</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Creators you've connected with and pending requests.
          </p>
        </div>
        {accepted.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {accepted.length} connected
          </span>
        )}
      </div>

      {incoming.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Incoming ({incoming.length})
          </p>
          {incoming.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-background">
                {(c.other?.display_name ?? c.other?.handle ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {c.other?.handle ? (
                  <Link
                    to="/u/$handle"
                    params={{ handle: c.other.handle }}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {c.other?.display_name || c.other?.handle}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium">
                    {c.other?.display_name || "Creator"}
                  </p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {c.other?.creator_title || c.other?.category || "wants to connect"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  respond.mutate(
                    { id: c.id, status: "accepted" },
                    {
                      onSuccess: () => toast.success("Connected"),
                      onError: (e: Error) => toast.error(e.message),
                    },
                  )
                }
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  respond.mutate(
                    { id: c.id, status: "declined" },
                    {
                      onSuccess: () => toast.success("Declined"),
                      onError: (e: Error) => toast.error(e.message),
                    },
                  )
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        {accepted.length === 0 && incoming.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="No connections yet"
            description="Search for creators and send your first connection request."
          />
        ) : accepted.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {accepted.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-purple text-sm font-semibold text-background">
                  {(c.other?.display_name ?? c.other?.handle ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  {c.other?.handle ? (
                    <Link
                      to="/u/$handle"
                      params={{ handle: c.other.handle }}
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {c.other?.display_name || c.other?.handle}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">
                      {c.other?.display_name || "Creator"}
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {c.other?.creator_title || c.other?.category || "—"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm("Remove this connection?")) return;
                    remove.mutate(c.id, {
                      onSuccess: () => toast.success("Removed"),
                      onError: (e: Error) => toast.error(e.message),
                    });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
