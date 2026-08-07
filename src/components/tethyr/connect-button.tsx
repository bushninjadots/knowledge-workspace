// Renders the correct connection action for viewing another creator's profile.
//"Tethyr"= the verb for connecting on the platform.
import { useState } from "react";
import { toast } from "sonner";
import { Link2, Clock, Check, X, Link2Off, MessageSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useConnections,
  useSendConnection,
  useRespondConnection,
  useDeleteConnection,
} from "@/hooks/use-connections";

const INTRO_MAX = 500;

export function ConnectButton({
  targetId,
  targetName,
}: {
  targetId: string;
  targetName?: string | null;
}) {
  const { data: me } = useCurrentUser();
  const { data: connections } = useConnections();
  const send = useSendConnection();
  const respond = useRespondConnection();
  const remove = useDeleteConnection();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [intro, setIntro] = useState("");

  const meId = me?.userId ?? null;
  if (!meId || meId === targetId) return null;

  const existing = connections?.find(
    (c) =>
      (c.requester_id === meId && c.addressee_id === targetId) ||
      (c.addressee_id === meId && c.requester_id === targetId),
  );

  function submitTethyr() {
    send.mutate(
      { addresseeId: targetId, meId: meId as string, introMessage: intro },
      {
        onSuccess: () => {
          toast.success(`Tethyr request sent${targetName ? `to ${targetName}` : ""}`);
          setInviteOpen(false);
          setIntro("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (!existing) {
    return (
      <>
        <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
          <Link2 className="h-4 w-4" /> Tethyr
        </Button>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tethyr with {targetName ?? "this person"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Add an optional note so they know why you're connecting.
              </p>
              <Textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value.slice(0, INTRO_MAX))}
                placeholder="Hey! Loved your work on…"
                rows={4}
                maxLength={INTRO_MAX}
              />
              <div className="text-right text-[11px] text-muted-foreground">
                {intro.length}/{INTRO_MAX}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitTethyr} disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (existing.status === "accepted") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild className="gap-1.5">
          <Link to="/messages" search={{ c: existing.id }}>
            <MessageSquare className="h-4 w-4" /> Message
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!confirm("Untethyr this person?")) return;
            remove.mutate(existing.id, {
              onSuccess: () => toast.success("Connection removed"),
              onError: (e: Error) => toast.error(e.message),
            });
          }}
          className="gap-1.5"
        >
          <Link2Off className="h-4 w-4" /> Tethryd
        </Button>
      </div>
    );
  }

  if (existing.status === "pending" && existing.addressee_id === meId) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            respond.mutate(
              { id: existing.id, status: "accepted" },
              {
                onSuccess: () => toast.success("You're now tethryd 🎉"),
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
                onSuccess: () => toast.success("Request declined"),
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
          if (!confirm("Withdraw your tethyr request?")) return;
          remove.mutate(existing.id, {
            onSuccess: () => toast.success("Request withdrawn"),
            onError: (e: Error) => toast.error(e.message),
          });
        }}
        className="gap-1.5"
      >
        <Clock className="h-4 w-4" /> Requested
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled className="gap-1.5">
      Declined
    </Button>
  );
}
