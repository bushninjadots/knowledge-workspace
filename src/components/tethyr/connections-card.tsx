// Dashboard card: incoming requests + accepted tethrs (connections).
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Link2, Check, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections, useRespondConnection, useDeleteConnection } from "@/hooks/use-connections";

export function ConnectionsCard() {
  const { data: me } = useCurrentUser();
  const { data: connections, isLoading } = useConnections();
  const respond = useRespondConnection();
  const remove = useDeleteConnection();

  const meId = me?.userId ?? null;
  const incoming =
    connections?.filter((c) => c.status === "pending" && c.addressee_id === meId) ?? [];
  const outgoing =
    connections?.filter((c) => c.status === "pending" && c.requester_id === meId) ?? [];
  const accepted = connections?.filter((c) => c.status === "accepted") ?? [];

  if (isLoading) {
    return (
      <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
        <div className="h-6 w-32 animate-pulse rounded-full bg-surface-elevated" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Tethrs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            People you're connected with and pending requests.
          </p>
        </div>
        {accepted.length > 0 && (
          <span className="text-xs text-muted-foreground">{accepted.length} tethryd</span>
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
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
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
                    {c.other?.display_name || "Member"}
                  </p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {c.other?.creator_title || c.other?.category || "wants to tethyr"}
                </p>
                {c.intro_message && (
                  <p className="mt-1.5 rounded-xl bg-background/60 p-2 text-xs italic text-foreground/90">
                    "{c.intro_message}"
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    respond.mutate(
                      { id: c.id, status: "accepted" },
                      {
                        onSuccess: () => toast.success("You're now tethryd 🎉"),
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
                        onSuccess: () => toast.success("Request declined"),
                        onError: (e: Error) => toast.error(e.message),
                      },
                    )
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Sent ({outgoing.length})
          </p>
          {outgoing.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated text-xs font-semibold">
                {(c.other?.display_name ?? c.other?.handle ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {c.other?.handle ? (
                  <Link
                    to="/u/$handle"
                    params={{ handle: c.other.handle }}
                    className="truncate text-sm hover:text-primary"
                  >
                    {c.other?.display_name || c.other?.handle}
                  </Link>
                ) : (
                  <p className="truncate text-sm">{c.other?.display_name || "Member"}</p>
                )}
                <p className="truncate text-[11px] text-muted-foreground">Waiting for response</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!confirm("Withdraw request?")) return;
                  remove.mutate(c.id, {
                    onSuccess: () => toast.success("Request withdrawn"),
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
      )}

      <div className="mt-5">
        {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="No tethrs yet"
            description="Search for people and send your first connection request."
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
                      {c.other?.display_name || "Member"}
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {c.other?.creator_title || c.other?.category || "—"}
                  </p>
                </div>
                <Button size="icon" variant="ghost" asChild aria-label="Message">
                  <Link to="/messages" search={{ c: c.id }}>
                    <MessageSquare className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
