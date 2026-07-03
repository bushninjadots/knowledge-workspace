// Renders the correct connection action for viewing another creator's profile.
import { toast } from "sonner";
import { UserPlus, Clock, Check, X, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useConnections,
  useSendConnection,
  useRespondConnection,
  useDeleteConnection,
} from "@/hooks/use-connections";

export function ConnectButton({ targetId }: { targetId: string }) {
  const { data: me } = useCurrentUser();
  const { data: connections } = useConnections();
  const send = useSendConnection();
  const respond = useRespondConnection();
  const remove = useDeleteConnection();

  const meId = me?.userId ?? null;
  if (!meId || meId === targetId) return null;

  const existing = connections?.find(
    (c) =>
      (c.requester_id === meId && c.addressee_id === targetId) ||
      (c.addressee_id === meId && c.requester_id === targetId),
  );

  if (!existing) {
    return (
      <Button
        size="sm"
        onClick={() =>
          send.mutate(
            { addresseeId: targetId, meId },
            {
              onSuccess: () => toast.success("Request sent"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        disabled={send.isPending}
        className="gap-1.5"
      >
        <UserPlus className="h-4 w-4" /> Connect
      </Button>
    );
  }

  if (existing.status === "accepted") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (!confirm("Remove this connection?")) return;
          remove.mutate(existing.id, {
            onSuccess: () => toast.success("Connection removed"),
            onError: (e: Error) => toast.error(e.message),
          });
        }}
        className="gap-1.5"
      >
        <UserMinus className="h-4 w-4" /> Connected
      </Button>
    );
  }

  // Pending → different UI depending on which side we're on
  if (existing.status === "pending" && existing.addressee_id === meId) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            respond.mutate(
              { id: existing.id, status: "accepted" },
              {
                onSuccess: () => toast.success("Connected"),
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
          className="gap-1.5"
        >
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            respond.mutate(
              { id: existing.id, status: "declined" },
              {
                onSuccess: () => toast.success("Declined"),
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
          className="gap-1.5"
        >
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    );
  }

  if (existing.status === "pending") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (!confirm("Withdraw request?")) return;
          remove.mutate(existing.id, {
            onSuccess: () => toast.success("Withdrawn"),
            onError: (e: Error) => toast.error(e.message),
          });
        }}
        className="gap-1.5"
      >
        <Clock className="h-4 w-4" /> Requested
      </Button>
    );
  }

  // declined
  return (
    <Button size="sm" variant="outline" disabled className="gap-1.5">
      Declined
    </Button>
  );
}
