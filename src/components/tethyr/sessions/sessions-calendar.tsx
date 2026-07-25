import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Video, MapPin, Plus } from "lucide-react";
import type { SessionWithParticipants } from "@/hooks/use-sessions";
import { STATUS_CONFIG, TYPE_LABELS } from "./sessions-sidebar";

type CalendarView = "day" | "week" | "month" | "agenda";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthDays(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const padStart = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < padStart; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(hour: number) {
  if (hour === 0 || hour === 12) return `${hour === 0 ? 12 : 12} ${hour < 12 ? "AM" : "PM"}`;
  return `${hour > 12 ? hour - 12 : hour} ${hour < 12 ? "AM" : "PM"}`;
}

function CalendarEventCard({
  session,
  onClick,
  compact,
}: {
  session: SessionWithParticipants;
  onClick?: () => void;
  compact?: boolean;
}) {
  const status = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.scheduled;
  const type = TYPE_LABELS[session.session_type] ?? session.session_type;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`group flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-all hover:shadow-soft ${status.bg} border ${status.bg.includes("blue") ? "border-blue-200 dark:border-blue-800" : status.bg.includes("green") ? "border-green-200 dark:border-green-800" : status.bg.includes("amber") ? "border-amber-200 dark:border-amber-800" : status.bg.includes("purple") ? "border-purple-200 dark:border-purple-800" : "border-border/40"}`}
      >
        <span className="truncate text-[11px] font-medium text-foreground">{session.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-soft ${status.bg.includes("blue") ? "border-blue-200 dark:border-blue-800" : status.bg.includes("green") ? "border-green-200 dark:border-green-800" : status.bg.includes("amber") ? "border-amber-200 dark:border-amber-800" : status.bg.includes("purple") ? "border-purple-200 dark:border-purple-800" : "border-border/40"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h4 className="truncate text-sm font-semibold text-foreground">{session.title}</h4>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.bg} ${status.color}`}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{type}</p>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {new Date(session.starts_at!).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
            –
            {new Date(session.ends_at!).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          {session.meeting_url && (
            <span className="inline-flex items-center gap-1 text-brand-green">
              <Video className="h-2.5 w-2.5" /> Online
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" /> {session.location}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ───── Day View ───── */

function DayView({
  date,
  sessions,
  onSessionClick,
}: {
  date: Date;
  sessions: SessionWithParticipants[];
  onSessionClick: (s: SessionWithParticipants) => void;
}) {
  const daySessions = sessions.filter((s) => s.starts_at && isSameDay(new Date(s.starts_at), date));

  return (
    <div className="relative">
      {HOURS.map((hour) => (
        <div key={hour} className="flex border-b border-border/30">
          <div className="w-16 shrink-0 py-2 pr-3 text-right text-[10px] font-medium text-muted-foreground/60">
            {formatHour(hour)}
          </div>
          <div className="relative min-h-[3rem] flex-1 border-l border-border/20">
            {daySessions
              .filter((s) => {
                const h = new Date(s.starts_at!).getHours();
                return h === hour;
              })
              .map((s) => (
                <CalendarEventCard key={s.id} session={s} onClick={() => onSessionClick(s)} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───── Week View ───── */

function WeekView({
  date,
  sessions,
  onSessionClick,
}: {
  date: Date;
  sessions: SessionWithParticipants[];
  onSessionClick: (s: SessionWithParticipants) => void;
}) {
  const weekDates = useMemo(() => getWeekDates(date), [date]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/40">
        <div />
        {weekDates.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className={`py-2 text-center ${isToday ? "bg-brand-green/5" : ""}`}>
              <p className="text-[10px] font-medium uppercase text-muted-foreground/60">
                {dayNames[i]}
              </p>
              <p
                className={`mt-0.5 text-lg font-bold ${
                  isToday ? "text-brand-green" : "text-foreground"
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[4rem_repeat(7,1fr)]">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-border/30 py-2 pr-3 text-right text-[10px] font-medium text-muted-foreground/60">
              {formatHour(hour)}
            </div>
            {weekDates.map((d, di) => {
              const cellSessions = sessions.filter(
                (s) =>
                  s.starts_at &&
                  isSameDay(new Date(s.starts_at), d) &&
                  new Date(s.starts_at).getHours() === hour,
              );
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={di}
                  className={`min-h-[2.5rem] border-b border-l border-border/30 ${
                    isToday ? "bg-brand-green/[0.02]" : ""
                  }`}
                >
                  {cellSessions.map((s) => (
                    <CalendarEventCard
                      key={s.id}
                      session={s}
                      compact
                      onClick={() => onSessionClick(s)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Month View ───── */

function MonthView({
  date,
  sessions,
  onSessionClick,
}: {
  date: Date;
  sessions: SessionWithParticipants[];
  onSessionClick: (s: SessionWithParticipants) => void;
}) {
  const days = useMemo(() => getMonthDays(date), [date]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithParticipants[]>();
    for (const s of sessions) {
      if (!s.starts_at) continue;
      const key = new Date(s.starts_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/40">
        {dayNames.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground/60"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          if (!d)
            return (
              <div key={`empty-${i}`} className="min-h-[6rem] border-b border-r border-border/20" />
            );
          const isToday = isSameDay(d, today);
          const daySessions = sessionsByDate.get(d.toDateString()) ?? [];
          return (
            <div
              key={i}
              className={`min-h-[6rem] border-b border-r border-border/20 p-1 ${
                isToday ? "bg-brand-green/[0.03]" : ""
              }`}
            >
              <p
                className={`mb-1 text-right text-xs font-medium ${
                  isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-[10px] font-bold text-background ml-auto"
                    : "text-muted-foreground"
                }`}
              >
                {d.getDate()}
              </p>
              <div className="space-y-0.5">
                {daySessions.slice(0, 3).map((s) => (
                  <CalendarEventCard
                    key={s.id}
                    session={s}
                    compact
                    onClick={() => onSessionClick(s)}
                  />
                ))}
                {daySessions.length > 3 && (
                  <p className="text-[9px] text-muted-foreground text-right">
                    +{daySessions.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Agenda View ───── */

function AgendaView({
  sessions,
  onSessionClick,
}: {
  sessions: SessionWithParticipants[];
  onSessionClick: (s: SessionWithParticipants) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SessionWithParticipants[]>();
    for (const s of sessions) {
      if (!s.starts_at) continue;
      const key = new Date(s.starts_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [sessions]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-surface/20 p-12 text-center">
        <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No upcoming sessions</p>
        <p className="mt-1 text-xs text-muted-foreground">Schedule a session to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([dateStr, daySessions]) => {
        const d = new Date(dateStr);
        const isToday = isSameDay(d, new Date());
        return (
          <div key={dateStr}>
            <div className="mb-3 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl ${
                  isToday ? "bg-brand-green text-background" : "bg-surface-elevated"
                }`}
              >
                <span className="text-[8px] font-semibold uppercase leading-none">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="text-sm font-bold leading-tight">{d.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {d.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {daySessions.length} session{daySessions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-[3.25rem]">
              {daySessions.map((s) => (
                <CalendarEventCard key={s.id} session={s} onClick={() => onSessionClick(s)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───── Main Calendar Component ───── */

export function SessionsCalendar({
  sessions,
  onSessionClick,
  onScheduleClick,
}: {
  sessions: SessionWithParticipants[];
  onSessionClick: (s: SessionWithParticipants) => void;
  onScheduleClick?: () => void;
}) {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigate = useCallback(
    (direction: number) => {
      const d = new Date(currentDate);
      if (view === "day") d.setDate(d.getDate() + direction);
      else if (view === "week") d.setDate(d.getDate() + direction * 7);
      else d.setMonth(d.getMonth() + direction);
      setCurrentDate(d);
    },
    [currentDate, view],
  );

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const titleText = useMemo(() => {
    if (view === "day") {
      return currentDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "week") {
      const weekDates = getWeekDates(currentDate);
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${start.toLocaleDateString(undefined, { month: "short" })} ${start.getDate()} – ${end.toLocaleDateString(undefined, { month: "short" })} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [currentDate, view]);

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">{titleText}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Today
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-xl border border-border/40 bg-surface/30 p-0.5">
            {(["day", "week", "month", "agenda"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                  view === v
                    ? "bg-surface-elevated text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {onScheduleClick && (
            <button
              onClick={onScheduleClick}
              className="rounded-xl bg-brand-green px-3 py-1.5 text-xs font-semibold text-background transition-all hover:bg-brand-green/90 hover:shadow-soft active:scale-[0.98]"
            >
              <Plus className="mr-1 inline-block h-3 w-3" />
              Schedule
            </button>
          )}
        </div>
      </div>

      {/* Calendar body */}
      <div className="rounded-2xl border border-border/40 bg-surface/20 p-4">
        {view === "day" && (
          <DayView date={currentDate} sessions={sessions} onSessionClick={onSessionClick} />
        )}
        {view === "week" && (
          <WeekView date={currentDate} sessions={sessions} onSessionClick={onSessionClick} />
        )}
        {view === "month" && (
          <MonthView date={currentDate} sessions={sessions} onSessionClick={onSessionClick} />
        )}
        {view === "agenda" && <AgendaView sessions={sessions} onSessionClick={onSessionClick} />}
      </div>
    </div>
  );
}
