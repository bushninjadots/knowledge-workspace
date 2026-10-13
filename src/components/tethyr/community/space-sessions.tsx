// "Coming up" in a space: sessions its owner or moderators schedule — a
// critique hour, a co-working block — that members can say they're going to.
// A recurring reason to come back, run through Sessions.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CalendarPlus, Check, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CommunitySpace } from "@/hooks/use-community-spaces";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useScheduleSpaceSession,
  useSpaceSessions,
  useToggleGoing,
  type SpaceSession,
} from "@/hooks/use-space-rituals";
import { friendlyError } from "@/lib/error-message";
import { safeHref } from "@/lib/validators";

const DURATIONS = [30, 45, 60, 90];

/** "Thu 16 Oct, 18:00" in the viewer's own time zone. */
export function formatSessionTime(iso: string | null, locale?: string) {
  if (!iso) return "Time to be set";
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The default start for a new session: tomorrow at 18:00 local, as datetime-local. */
function defaultStart() {
  const d = new Date(Date.now() + 24 * 60 * 60_000);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

function SessionRow({ session, spaceId }: { session: SpaceSession; spaceId: string }) {
  const { data: me } = useCurrentUser();
  const toggle = useToggleGoing();
  const going = !!me?.userId && session.going.includes(me.userId);
  const isOrganizer = me?.userId === session.organizer_id;
  const meetingHref = session.meeting_url ? safeHref(session.meeting_url) : null;

  return (
    <li className="space-y-1.5">
      <Link
        to="/sessions/$id"
        params={{ id: session.id }}
        className="block text-sm font-medium hover:underline"
      >
        {session.title}
      </Link>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{formatSessionTime(session.starts_at)}</span>
        <span aria-hidden>·</span>
        <span>{session.duration_minutes} min</span>
        {session.going.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{session.going.length} going</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {!isOrganizer && (
          <Button
            size="sm"
            variant={going ? "outline" : "default"}
            className="h-7 rounded-full px-3 text-xs"
            busy={toggle.isPending}
            aria-pressed={going}
            onClick={() =>
              toggle.mutate(
                { sessionId: session.id, spaceId, going },
                {
                  onSuccess: () => toast.success(going ? "Taken back" : "You're going"),
                  onError: (err) => toast.error(friendlyError(err, "Couldn't update")),
                },
              )
            }
          >
            {going && <Check className="h-3 w-3" aria-hidden />}
            {going ? "Going" : "I'll be there"}
          </Button>
        )}
        {meetingHref && (going || isOrganizer) && (
          <a
            href={meetingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 px-3 text-xs hover:text-foreground"
          >
            <Video className="h-3 w-3" aria-hidden />
            Join link
          </a>
        )}
      </div>
    </li>
  );
}

function ScheduleDialog({
  space,
  open,
  onOpenChange,
}: {
  space: CommunitySpace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const schedule = useScheduleSpaceSession();
  const [title, setTitle] = useState("Critique hour");
  const [description, setDescription] = useState(
    "Bring something you're working on — we'll go round and give each piece ten minutes.",
  );
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [duration, setDuration] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState("");

  function submit() {
    if (!title.trim()) return toast.error("Give the session a name");
    if (!startsAt || new Date(startsAt).getTime() < Date.now()) {
      return toast.error("Pick a time in the future");
    }
    const url = meetingUrl.trim();
    if (url && !safeHref(url)) return toast.error("That meeting link isn't a web address");
    schedule.mutate(
      {
        spaceId: space.id,
        title: title.trim(),
        description: description.trim(),
        startsAt,
        durationMinutes: duration,
        meetingUrl: url,
      },
      {
        onSuccess: () => {
          toast.success(`Scheduled in ${space.name}`);
          onOpenChange(false);
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't schedule the session")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a session</DialogTitle>
          <DialogDescription>
            Members of {space.name} see it under Coming up and can say they&apos;re going.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="space-session-title">Name</Label>
            <Input
              id="space-session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-session-about">What happens</Label>
            <Textarea
              id="space-session-about"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="space-session-start">Starts</Label>
              <Input
                id="space-session-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="space-session-length">Length</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger id="space-session-length" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-session-link">Meeting link (optional)</Label>
            <Input
              id="space-session-link"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} busy={schedule.isPending}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The About column's "Coming up" card. Members only (sessions are theirs). */
export function SpaceSessionsCard({ space }: { space: CommunitySpace }) {
  const [scheduling, setScheduling] = useState(false);
  const canSchedule = space.my_role === "owner" || space.my_role === "moderator";
  const { data: sessions = [] } = useSpaceSessions(space.id, !!space.is_member);
  if (!space.is_member || (sessions.length === 0 && !canSchedule)) return null;

  return (
    <section className="community-card p-4">
      <h2 className="section-label mb-3 flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
        Coming up
      </h2>
      {sessions.length > 0 ? (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} spaceId={space.id} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled. A regular critique hour or co-working block gives people a reason to
          come back.
        </p>
      )}
      {canSchedule && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => setScheduling(true)}
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          Schedule a session
        </Button>
      )}
      {canSchedule && (
        <ScheduleDialog space={space} open={scheduling} onOpenChange={setScheduling} />
      )}
    </section>
  );
}
