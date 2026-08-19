// Connections — your accepted friends and pending requests, in one place.
// Accepted connections link straight to a profile and a message thread.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link2, MessageSquare, Check, X, UserPlus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useConnections,
  useRespondConnection,
  useDeleteConnection,
  type ConnectionWithProfile,
} from "@/hooks/use-connections";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Tethyr" },
      { name: "description", content: "People you're connected with on Tethyr." },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { data: me } = useCurrentUser();
  const { data: connections, isLoading } = useConnections();
  const respond = useRespondConnection();
  const remove = useDeleteConnection();

  const meId = me?.userId ?? null;
  const accepted = (connections ?? []).filter((c) => c.status === "accepted");
  const incoming = (connections ?? []).filter(
    (c) => c.status === "pending" && c.addressee_id === meId,
  );
  const outgoing = (connections ?? []).filter(
    (c) => c.status === "pending" && c.requester_id === meId,
  );

  return (
    <div className="animate-room-enter mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Connections</h1>
          {accepted.length > 0 && (
            <span className="text-sm text-muted-foreground">{accepted.length} connected</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The people you build with. Open a profile to see their work, or start a conversation.
        </p>
      </header>

      {/* Incoming requests — most important pending action */}
      {incoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Requests waiting for you
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {incoming.length}
            </span>
          </h2>
          <div className="space-y-2">
            {incoming.map((c) => (
              <RequestRow
                key={c.id}
                conn={c}
                onAccept={() =>
                  respond.mutate(
                    { id: c.id, status: "accepted" },
                    {
                      onSuccess: () => toast.success("You're now connected 🎉"),
                      onError: (e: Error) => toast.error(e.message),
                    },
                  )
                }
                onDecline={() =>
                  respond.mutate(
                    { id: c.id, status: "declined" },
                    {
                      onSuccess: () => toast.success("Request declined"),
                      onError: (e: Error) => toast.error(e.message),
                    },
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Connected friends */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Your people</h2>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-elevated/40" />
            ))}
          </div>
        ) : accepted.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="No connections yet"
            description="Find collaborators on Explore and send your first connection request."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accepted.map((c) => (
              <FriendRow key={c.id} conn={c} />
            ))}
          </div>
        )}
      </section>

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Sent requests ({outgoing.length})
          </h2>
          <div className="space-y-2">
            {outgoing.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
              >
                <Avatar conn={c} />
                <div className="min-w-0 flex-1">
                  <Name conn={c} />
                  <p className="truncate text-xs text-muted-foreground">Waiting for response</p>
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
        </section>
      )}
    </div>
  );
}

function FriendRow({ conn }: { conn: ConnectionWithProfile }) {
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Member";
  const title = conn.other?.creator_title || conn.other?.category || "—";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-elevated/30 px-4 py-3 transition hover:border-[var(--user-accent-border,var(--border-strong))]">
      <Avatar conn={conn} size="lg" />
      <div className="min-w-0 flex-1">
        <Name conn={conn} />
        <p className="truncate text-xs text-muted-foreground" title={title}>
          {title}
        </p>
      </div>
      {conn.other?.handle ? (
        <Link
          to="/u/$handle"
          params={{ handle: conn.other.handle }}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Profile
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
      <Button size="icon" variant="ghost" asChild aria-label={`Message ${name}`}>
        <Link to="/messages" search={{ c: conn.id }}>
          <MessageSquare className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function RequestRow({
  conn,
  onAccept,
  onDecline,
}: {
  conn: ConnectionWithProfile;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Member";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Avatar conn={conn} />
      <div className="min-w-0 flex-1">
        <Name conn={conn} />
        <p className="truncate text-xs text-muted-foreground">
          {conn.other?.creator_title || conn.other?.category || "wants to connect"}
        </p>
        {conn.intro_message && (
          <p className="mt-1 rounded-lg bg-background/60 px-2.5 py-1.5 text-xs italic text-foreground/90">
            “{conn.intro_message}”
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onAccept} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
        <Button size="sm" variant="outline" onClick={onDecline} aria-label={`Decline ${name}`}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Avatar({ conn, size = "md" }: { conn: ConnectionWithProfile; size?: "md" | "lg" }) {
  const path = conn.other?.avatar_url ?? null;
  const name = conn.other?.display_name ?? conn.other?.handle ?? "?";
  const dims = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";

  const { data: signedUrl } = useQuery({
    queryKey: ["avatar-signed", path],
    enabled: !!path,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path as string, 60 * 60);
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-purple font-semibold text-background ${dims}`}
    >
      {signedUrl ? (
        <img src={signedUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function Name({ conn }: { conn: ConnectionWithProfile }) {
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Member";
  if (conn.other?.handle) {
    return (
      <Link
        to="/u/$handle"
        params={{ handle: conn.other.handle }}
        className="block truncate text-sm font-medium hover:text-primary"
        title={conn.other?.display_name || conn.other?.handle || undefined}
      >
        {name}
      </Link>
    );
  }
  return (
    <p className="truncate text-sm font-medium" title={name}>
      {name}
    </p>
  );
}
