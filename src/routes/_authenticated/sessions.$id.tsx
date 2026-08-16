import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  MapPin,
  Video,
  Users,
  FileText,
  Send,
  Loader2,
  Repeat,
  Trash2,
  CheckCircle2,
  PlayCircle,
  StopCircle,
  XCircle,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useSessionDetail,
  useSessionNotes,
  useSessionResources,
  useAddSessionNote,
  useDeleteSessionNote,
  useDeleteSession,
  useUpdateSessionStatus,
  useUpdateParticipantStatus,
  type SessionWithParticipants,
  type SessionStatus,
} from "@/hooks/use-sessions";
import { STATUS_CONFIG } from "@/components/tethyr/sessions/sessions-sidebar";
import { SessionResources } from "@/components/tethyr/sessions/session-resources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  head: () => ({
    meta: [
      { title: "Session — Tethyr" },
      { name: "description", content: "View session details." },
    ],
  }),
  component: SessionDetailPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Session not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load this session. Please try again.
        </p>
        <Link to="/sessions" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to sessions
        </Link>
      </div>
    </div>
  ),
});

function SessionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const { data: session, isLoading } = useSessionDetail(id);
  const { data: notes = [] } = useSessionNotes(id);
  const { data: resources = [] } = useSessionResources(id);
  const addNote = useAddSessionNote();
  const deleteNote = useDeleteSessionNote();
  const deleteSession = useDeleteSession();
  const updateStatus = useUpdateSessionStatus();
  const updateParticipantStatus = useUpdateParticipantStatus();

  const [noteText, setNoteText] = useState("");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">Session not found</h1>
          <Link to="/sessions" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to sessions
          </Link>
        </div>
      </div>
    );
  }

  const isOrganizer = session.organizer_id === me?.userId;
  const myParticipant = session.participants?.find((p) => p.profile_id === me?.userId);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => navigate({ to: "/sessions" })}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to sessions"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground truncate">Sessions</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <HeroSection session={session} />

        {/* Info + Status — 2-column on desktop */}
        <div className="grid gap-6 lg:grid-cols-2">
          <InfoPanel session={session} />
          <div className="space-y-4">
            {isOrganizer && (
              <StatusActions
                session={session}
                onStatusChange={async (status: SessionStatus) => {
                  try {
                    await updateStatus.mutateAsync({ sessionId: id, status });
                    toast.success(`Session ${status.replace("_", "")}`);
                  } catch {
                    toast.error("Failed to update status");
                  }
                }}
                isUpdating={updateStatus.isPending}
              />
            )}
            {myParticipant && myParticipant.status === "invited" && (
              <ParticipantActions
                participantId={myParticipant.id}
                sessionId={id}
                onUpdateParticipantStatus={updateParticipantStatus}
              />
            )}
          </div>
        </div>

        {/* Notes — moved above participants */}
        <NotesSection
          notes={notes}
          noteText={noteText}
          onNoteTextChange={setNoteText}
          onAddNote={async () => {
            if (!noteText.trim()) return;
            try {
              await addNote.mutateAsync({ sessionId: id, content: noteText.trim() });
              setNoteText("");
              toast.success("Note added");
            } catch {
              toast.error("Failed to add note");
            }
          }}
          onDeleteNote={async (noteId: string) => {
            try {
              await deleteNote.mutateAsync({ noteId, sessionId: id });
              toast.success("Note deleted");
            } catch {
              toast.error("Failed to delete note");
            }
          }}
          isAdding={addNote.isPending}
          currentUserId={me?.userId}
        />

        {/* Participants — grid on desktop */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Participants ({(session.participants ?? []).length})
            </h2>
          </div>
          <ParticipantGrid session={session} />
        </div>

        <SessionResources sessionId={id} resources={resources} isOrganizer={isOrganizer} />

        <FollowUpActions
          session={session}
          userId={me?.userId}
          onDelete={async () => {
            try {
              await deleteSession.mutateAsync(id);
              toast.success("Session deleted");
              navigate({ to: "/sessions" });
            } catch {
              toast.error("Failed to delete session");
            }
          }}
          isDeleting={deleteSession.isPending}
        />
      </div>
    </div>
  );
}

/* ───────── Hero Section ───────── */

function HeroSection({ session }: { session: SessionWithParticipants }) {
  const statusCfg = STATUS_CONFIG[session.status];

  const startsAt = session.starts_at ? new Date(session.starts_at) : null;
  const dateStr = startsAt
    ? startsAt.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not scheduled";
  const timeStr = startsAt
    ? startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{session.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={`${statusCfg.bg} ${statusCfg.color} border-0 font-medium`}>
              {statusCfg.icon} {statusCfg.label}
            </Badge>
            {session.skills?.name && (
              <Badge variant="outline" className="text-xs">
                {session.skills.name}
              </Badge>
            )}
            {session.is_recurring && (
              <Badge variant="outline" className="text-xs">
                <Repeat className="mr-1 h-3 w-3" /> Recurring
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Date + time bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface/50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{dateStr}</span>
        </div>
        {timeStr && (
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{timeStr}</span>
            <span className="text-muted-foreground">({session.duration_minutes} min)</span>
          </div>
        )}
        {session.organizer && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Organized by</span>
            <span className="font-medium text-foreground">
              {session.organizer.display_name ?? session.organizer.handle ?? "Unknown"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Info Panel ───────── */

function InfoPanel({ session }: { session: SessionWithParticipants }) {
  const items: { icon: typeof Globe; label: string; value: string; href?: string }[] = [];

  if (session.meeting_url) {
    items.push({
      icon: Video,
      label: "Meeting",
      value: session.meeting_url,
      href: session.meeting_url,
    });
  }
  if (session.location) {
    items.push({ icon: MapPin, label: "Location", value: session.location });
  }
  items.push({ icon: Clock, label: "Duration", value: `${session.duration_minutes} min` });
  items.push({ icon: Globe, label: "Timezone", value: session.timezone });

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border card-border bg-surface/30 px-4 py-3"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground">{item.label}</div>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium text-primary hover:underline"
                >
                  {item.value}
                </a>
              ) : (
                <div className="truncate text-sm font-medium text-foreground">{item.value}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Status Actions ───────── */

const STATUS_TRANSITIONS: Record<
  SessionStatus,
  { label: string; icon: typeof CheckCircle2; next: SessionStatus }[]
> = {
  draft: [{ label: "Publish", icon: CheckCircle2, next: "scheduled" }],
  scheduled: [
    { label: "Confirm", icon: CheckCircle2, next: "confirmed" },
    { label: "Start", icon: PlayCircle, next: "in_progress" },
    { label: "Cancel", icon: XCircle, next: "cancelled" },
  ],
  invitation_sent: [
    { label: "Confirm", icon: CheckCircle2, next: "confirmed" },
    { label: "Cancel", icon: XCircle, next: "cancelled" },
  ],
  confirmed: [
    { label: "Start", icon: PlayCircle, next: "in_progress" },
    { label: "Cancel", icon: XCircle, next: "cancelled" },
  ],
  in_progress: [
    { label: "Complete", icon: StopCircle, next: "completed" },
    { label: "Cancel", icon: XCircle, next: "cancelled" },
  ],
  completed: [],
  cancelled: [],
};

function StatusActions({
  session,
  onStatusChange,
  isUpdating,
}: {
  session: SessionWithParticipants;
  onStatusChange: (status: SessionStatus) => void;
  isUpdating: boolean;
}) {
  const transitions = STATUS_TRANSITIONS[session.status] ?? [];

  if (transitions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Status</h2>
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => {
          const Icon = t.icon;
          const isCancel = t.next === "cancelled";
          return (
            <Button
              key={t.next}
              variant={isCancel ? "destructive" : "default"}
              size="sm"
              onClick={() => onStatusChange(t.next)}
              disabled={isUpdating}
              className={
                isCancel
                  ? ""
                  : "bg-[var(--user-accent,var(--trust))] text-background hover:opacity-90"
              }
            >
              {isUpdating ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="mr-1 h-3.5 w-3.5" />
              )}
              {t.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Participant Actions ───────── */

function ParticipantActions({
  participantId,
  sessionId,
  onUpdateParticipantStatus,
}: {
  participantId: string;
  sessionId: string;
  onUpdateParticipantStatus: ReturnType<typeof useUpdateParticipantStatus>;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Your Invitation</h2>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onUpdateParticipantStatus.mutate(
              {
                participantId,
                status: "accepted",
                sessionId,
              },
              {
                onSuccess: () => toast.success("Invitation accepted"),
                onError: () => toast.error("Failed to accept invitation"),
              },
            )
          }
          disabled={onUpdateParticipantStatus.isPending}
          className="bg-brand-green text-background hover:bg-brand-green/90"
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            onUpdateParticipantStatus.mutate(
              {
                participantId,
                status: "declined",
                sessionId,
              },
              {
                onSuccess: () => toast.success("Invitation declined"),
                onError: () => toast.error("Failed to decline invitation"),
              },
            )
          }
          disabled={onUpdateParticipantStatus.isPending}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Decline
        </Button>
      </div>
    </div>
  );
}

/* ───────── Participant List ───────── */

function ParticipantGrid({ session }: { session: SessionWithParticipants }) {
  const participants = session.participants ?? [];

  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">No participants yet.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {participants.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 rounded-xl border card-border bg-surface/30 px-4 py-2.5"
        >
          <SessionParticipantAvatar p={p} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {p.profiles?.display_name ?? "Unknown"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              @{p.profiles?.handle ?? "—"}
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[11px] ${
              p.status === "accepted"
                ? "border-trust/40 text-trust"
                : p.status === "declined"
                  ? "border-warning/40 text-warning"
                  : p.status === "invited"
                    ? "border-teaching/40 text-teaching"
                    : ""
            }`}
          >
            {p.status}
          </Badge>
          {p.role === "organizer" && (
            <Badge variant="secondary" className="text-[11px]">
              Organizer
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

/* ───────── Notes Section ───────── */

function NotesSection({
  notes,
  noteText,
  onNoteTextChange,
  onAddNote,
  onDeleteNote,
  isAdding,
  currentUserId,
}: {
  notes: { id: string; content: string; created_at: string; created_by?: string }[];
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onAddNote: () => void;
  onDeleteNote: (noteId: string) => void;
  isAdding: boolean;
  currentUserId?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Notes</h2>
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note about this session..."
          rows={2}
          value={noteText}
          onChange={(e) => onNoteTextChange(e.target.value)}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={onAddNote}
          disabled={!noteText.trim() || isAdding}
          className="shrink-0 bg-[var(--user-accent,var(--trust))] text-background hover:opacity-90"
          aria-label="Add note"
        >
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Note list */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border card-border bg-surface/30 px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleString()}
                </div>
                {note.created_by === currentUserId && (
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="text-[11px] text-muted-foreground transition-colors hover:text-warning"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Follow-Up Actions ───────── */

function FollowUpActions({
  session,
  userId,
  onDelete,
  isDeleting,
}: {
  session: SessionWithParticipants;
  userId?: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const isOrganizer = session.organizer_id === userId;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Actions</h2>
      <div className="flex flex-wrap gap-2">
        {isOrganizer && (
          <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3.5 w-3.5" />
            )}
            Delete Session
          </Button>
        )}
      </div>
    </div>
  );
}

function SessionParticipantAvatar({
  p,
}: {
  p: { profiles?: { avatar_url?: string | null; display_name?: string | null } | null };
}) {
  const { data: avatarUrl } = useSignedStorageUrl("avatars", p.profiles?.avatar_url);
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className="text-xs">
        {(p.profiles?.display_name ?? "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
