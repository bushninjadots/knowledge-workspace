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

  // No connection, or a declined one I initiated — both let me send/request again.
  if (!existing || (existing.status === "declined" && existing.requester_id === meId)) {
    const isResend = !!existing;
    return (
      <>
        <Button
          size="sm"
          variant={isResend ? "outline" : "default"}
          onClick={() => setInviteOpen(true)}
          className="gap-1.5"
        >
          <Link2 className="h-4 w-4" />
          {isResend ? "Request again" : "Tethyr"}
        </Button>
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          targetName={targetName}
          intro={intro}
          setIntro={setIntro}
          submit={submitTethyr}
          sending={send.isPending}
        />
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
          <Link2Off className="h-4 w-4" /> Connected
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
                onSuccess: () => toast.success("You're now connected 🎉"),
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

  // I declined this person's request — surface it as a status, not a dead button.
  // They can re-request from their side.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
      <X className="h-3.5 w-3.5" />
      Declined
    </span>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  targetName,
  intro,
  setIntro,
  submit,
  sending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetName?: string | null;
  intro: string;
  setIntro: (v: string) => void;
  submit: () => void;
  sending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
