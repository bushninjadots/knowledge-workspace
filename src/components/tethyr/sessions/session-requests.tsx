import { Check, X, Clock, MessageSquare } from "lucide-react";
import type { SessionRequest } from "@/hooks/use-sessions";
import { useRespondToRequest, useCancelSessionRequest } from "@/hooks/use-sessions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function RequestCard({ request }: { request: SessionRequest }) {
  const respondToRequest = useRespondToRequest();
  const cancelRequest = useCancelSessionRequest();
  const isIncoming = !!request.to_user_id;
  const otherUser = isIncoming ? request.from_user : request.to_user;
  const isPending = request.status === "pending";

  async function handleRespond(status: "accepted" | "declined") {
    try {
      await respondToRequest.mutateAsync({ requestId: request.id, status });
      toast.success(status === "accepted" ? "Session accepted!" : "Session declined.");
    } catch {
      toast.error("Failed to respond to request.");
    }
  }

  return (
    <div className="group flex items-start gap-4 rounded-xl border card-border bg-surface/30 p-4 transition-lift hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface/50">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-background">
        {otherUser?.display_name?.charAt(0) ?? otherUser?.handle?.charAt(0) ?? "?"}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {otherUser?.display_name || otherUser?.handle || "Unknown"}
          </h3>
          <span className="shrink-0 rounded-full bg-teaching-subtle px-2 py-0.5 text-[11px] font-medium text-teaching">
            📨 {isIncoming ? "Invitation" : "Request"}
          </span>
        </div>
        {request.sessions && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {request.sessions.title}
            {request.sessions.starts_at && (
              <>
                {" "}
                —{" "}
                {new Date(request.sessions.starts_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            )}
          </p>
        )}
        {request.message && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface p-2 text-xs text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
            {request.message}
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {new Date(request.created_at).toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      {isPending && isIncoming && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => handleRespond("accepted")}
            disabled={respondToRequest.isPending}
            className="rounded-lg bg-brand-green/10 p-2 text-brand-green transition-colors hover:bg-brand-green/20 disabled:opacity-50"
            title="Accept"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleRespond("declined")}
            disabled={respondToRequest.isPending}
            className="rounded-lg bg-warning p-2 text-warning transition-colors hover:bg-warning disabled:opacity-50"
            title="Decline"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {isPending && !isIncoming && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> Waiting for response
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelRequest.mutate(request.id, {
                onSuccess: () => toast.success("Request cancelled"),
                onError: () => toast.error("Failed to cancel request"),
              });
            }}
            disabled={cancelRequest.isPending}
            className="text-destructive hover:text-destructive"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function SessionRequests({ requests }: { requests: SessionRequest[] }) {
  const pending = requests.filter((r) => r.status === "pending");
  const responded = requests.filter((r) => r.status !== "pending");

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border card-border bg-surface/20 p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No session requests</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Requests and invitations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Pending ({pending.length})</h3>
          {pending.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
      {responded.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Resolved</h3>
          {responded.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
