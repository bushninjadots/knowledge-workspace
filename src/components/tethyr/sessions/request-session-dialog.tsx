import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSendSessionRequest } from "@/hooks/use-sessions";

interface RequestSessionDialogProps {
  toUserId: string;
  toUserName: string;
  hasPendingRequest: boolean;
}

export function RequestSessionDialog({ toUserId, toUserName, hasPendingRequest }: RequestSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionType, setSessionType] = useState("");
  const [message, setMessage] = useState("");
  const sendRequest = useSendSessionRequest();

  const handleSubmit = () => {
    sendRequest.mutate(
      { toUserId, sessionType: sessionType || undefined, message: message || undefined },
      {
        onSuccess: () => {
          toast.success(`Session request sent to ${toUserName}`);
          setOpen(false);
          setMessage("");
          setSessionType("");
        },
        onError: () => toast.error("Failed to send request"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={hasPendingRequest}>
          {hasPendingRequest ? "Request sent" : "Request Session"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a session with {toUserName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Session type (optional)</label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skill_exchange">Skill Exchange</SelectItem>
                <SelectItem value="mentoring">Mentoring</SelectItem>
                <SelectItem value="project_meeting">Project Meeting</SelectItem>
                <SelectItem value="study_session">Study Session</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Message (optional)</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them what you'd like to work on..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={sendRequest.isPending}>
              {sendRequest.isPending ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
