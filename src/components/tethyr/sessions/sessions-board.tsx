import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarCheck2,
  CalendarClock,
  Flag,
  FolderKanban,
  PlayCircle,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useBoardSessions,
  useUpdateSessionStatus,
  type SessionStatus,
  type SessionWithParticipants,
} from "@/hooks/use-sessions";
import { TYPE_LABELS } from "./sessions-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The sessions pipeline. A session moves left to right as it progresses;
 * dragging a card between columns updates its status. Sessions a user only
 * participates in (didn't organize) render read-only — RLS keeps writes
 * organizer-only, so the board reflects that and doesn't offer a drag that
 * would silently fail.
 */
export const BOARD_COLUMNS: {
  status: Exclude<SessionStatus, "draft" | "cancelled">;
  label: string;
  icon: typeof Send;
  color: string;
}[] = [
  { status: "scheduled", label: "Scheduled", icon: CalendarClock, color: "text-learning" },
  { status: "invitation_sent", label: "Invitations", icon: Send, color: "text-teaching" },
  { status: "confirmed", label: "Confirmed", icon: CalendarCheck2, color: "text-trust" },
  { status: "in_progress", label: "In progress", icon: PlayCircle, color: "text-ai" },
  { status: "completed", label: "Complete", icon: Flag, color: "text-trust" },
];

/** Group sessions into their board columns; unlisted statuses are dropped. */
export function groupSessionsByColumn<T extends { id: string; status: SessionStatus }>(
  sessions: T[],
  columns: readonly { status: string }[] = BOARD_COLUMNS,
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const column of columns) grouped[column.status] = [];
  for (const session of sessions) {
    if (session.status in grouped) grouped[session.status].push(session);
  }
  return grouped;
}

type Scope = { kind: "all" } | { kind: "crew"; id: string } | { kind: "project"; id: string };

export function SessionsBoard({ onSchedule }: { onSchedule: () => void }) {
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const { data: sessions = [], isLoading } = useBoardSessions();
  const updateStatus = useUpdateSessionStatus();

  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [activeId, setActiveId] = useState<string | null>(null);
  // Optimistic status overrides applied the moment a card is dropped; cleared
  // on mutation error so the board reverts exactly where it was.
  const [pendingStatus, setPendingStatus] = useState<Record<string, SessionStatus>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const crews = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions)
      if (session.teams) map.set(session.teams.id, session.teams.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions)
      if (session.projects) map.set(session.projects.id, session.projects.title);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const scopedSessions = useMemo(() => {
    if (scope.kind === "all") return sessions;
    if (scope.kind === "crew") return sessions.filter((s) => s.teams?.id === scope.id);
    return sessions.filter((s) => s.projects?.id === scope.id);
  }, [sessions, scope]);

  const grouped = useMemo(() => groupSessionsByColumn(scopedSessions), [scopedSessions]);
  const activeSession = activeId ? sessions.find((s) => s.id === activeId) : null;

  const effectiveStatus = (session: SessionWithParticipants): SessionStatus =>
    pendingStatus[session.id] ?? session.status;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const session = sessions.find((s) => s.id === active.id);
    if (!session) return;
    // The drop target is either a column or another card — both carry their
    // current status in data, so one resolution path covers both.
    const targetStatus = over.data.current?.status as SessionStatus | undefined;
    if (!targetStatus || !BOARD_COLUMNS.some((column) => column.status === targetStatus)) return;

    const from = effectiveStatus(session);
    if (from === targetStatus) return;

    setPendingStatus((prev) => ({ ...prev, [session.id]: targetStatus }));
    updateStatus.mutate(
      { sessionId: session.id, status: targetStatus },
      {
        onError: () => {
          setPendingStatus((prev) => {
            const next = { ...prev };
            delete next[session.id];
            return next;
          });
          toast.error("Couldn't update the session");
        },
      },
    );
  }

  function goToSession(session: SessionWithParticipants) {
    navigate({ to: "/sessions/$id", params: { id: session.id } });
  }

  return (
    <section aria-labelledby="sessions-board-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="sessions-board-heading" className="text-base font-semibold tracking-tight">
            Board
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag sessions between columns to move them forward.
          </p>
        </div>
      </div>

      {(crews.length > 0 || projects.length > 0) && (
        <div
          role="group"
          aria-label="Scope the board"
          className="mt-3 flex flex-wrap items-center gap-1.5"
        >
          <ScopeChip active={scope.kind === "all"} onClick={() => setScope({ kind: "all" })}>
            All
          </ScopeChip>
          {crews.map((crew) => (
            <ScopeChip
              key={crew.id}
              active={scope.kind === "crew" && scope.id === crew.id}
              onClick={() => setScope({ kind: "crew", id: crew.id })}
            >
              Crew · {crew.name}
            </ScopeChip>
          ))}
          {projects.map((project) => (
            <ScopeChip
              key={project.id}
              active={scope.kind === "project" && scope.id === project.id}
              onClick={() => setScope({ kind: "project", id: project.id })}
            >
              Project · {project.name}
            </ScopeChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 grid min-w-[68rem] grid-cols-5 gap-3">
          {BOARD_COLUMNS.map((column) => (
            <div key={column.status} className="flex flex-col gap-2">
              <Skeleton className="h-14 rounded-lg bg-surface-elevated/60" />
              <Skeleton className="h-24 rounded-lg bg-surface-elevated/40" />
              <Skeleton className="h-24 rounded-lg bg-surface-elevated/40" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">No sessions on the board yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Schedule your first session and it will land here.
          </p>
          <button
            type="button"
            onClick={onSchedule}
            className="mt-4 rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-[var(--user-accent-foreground,var(--background))] transition-spatial hover:opacity-90 active:scale-[0.98]"
          >
            + Schedule Session
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-3" aria-label="Sessions board">
            <div className="grid min-w-[68rem] grid-cols-5 gap-3">
              {BOARD_COLUMNS.map((column) => (
                <BoardColumn
                  key={column.status}
                  column={column}
                  sessions={grouped[column.status] ?? []}
                  effectiveStatus={effectiveStatus}
                  canDrag={(session) => !!me && session.organizer_id === me.userId}
                  onClick={goToSession}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeSession ? (
              <div className="w-64 -rotate-1 rounded-lg border border-border/80 bg-surface-elevated/95 p-3 shadow-lg shadow-black/10">
                <SessionCardBody session={activeSession} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-surface-elevated/50 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BoardColumn({
  column,
  sessions,
  effectiveStatus,
  canDrag,
  onClick,
}: {
  column: (typeof BOARD_COLUMNS)[number];
  sessions: SessionWithParticipants[];
  effectiveStatus: (session: SessionWithParticipants) => SessionStatus;
  canDrag: (session: SessionWithParticipants) => boolean;
  onClick: (session: SessionWithParticipants) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { status: column.status },
  });
  const Icon = column.icon;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`board-${column.status}`}
      className={`flex min-h-72 flex-col rounded-lg p-3 transition-colors ${
        isOver
          ? "bg-surface-elevated/70 ring-1 ring-inset ring-[var(--user-accent-border,var(--border-strong))]"
          : "bg-background/45"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${column.color}`} aria-hidden="true" />
          <h4 id={`board-${column.status}`} className="text-sm font-medium text-foreground">
            {column.label}
          </h4>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{sessions.length}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>
        ) : (
          sessions.map((session) => (
            <BoardCard
              key={session.id}
              session={session}
              status={effectiveStatus(session)}
              draggable={canDrag(session)}
              onClick={() => onClick(session)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCard({
  session,
  status,
  draggable,
  onClick,
}: {
  session: SessionWithParticipants;
  status: SessionStatus;
  draggable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { status },
    disabled: !draggable,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  // The card is always reachable as a button (open the session); when it is
  // draggable, dnd-kit's own attributes (role/tabIndex/aria) apply on top.
  const interactiveAttributes = {
    role: "button" as const,
    tabIndex: 0,
    ...(draggable ? attributes : {}),
  };

  return (
    <div
      ref={setNodeRef}
      aria-label={`Open ${session.title}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      {...interactiveAttributes}
      {...listeners}
      style={style}
      className={`rounded-lg border border-border/60 bg-surface-elevated/35 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDragging ? "opacity-40" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing hover:border-border hover:bg-surface-elevated/60" : "hover:border-border hover:bg-surface-elevated/60"}`}
    >
      <SessionCardBody session={session} />
    </div>
  );
}

function SessionCardBody({ session }: { session: SessionWithParticipants }) {
  const startsAt = session.starts_at ? new Date(session.starts_at) : null;
  const timeLabel = startsAt
    ? `${startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : "Time to be set";

  return (
    <div className="min-w-0">
      <h5 className="text-sm font-medium leading-snug text-foreground">{session.title}</h5>
      <p className="mt-1 text-xs text-muted-foreground">{timeLabel}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {TYPE_LABELS[session.session_type] ?? "Session"}
        </span>
        {session.teams && (
          <span className="flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" />
            {session.teams.name}
          </span>
        )}
        {session.projects?.id && (
          <span className="flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <FolderKanban className="h-3 w-3" aria-hidden="true" />
            {session.projects.title}
          </span>
        )}
      </div>
    </div>
  );
}
