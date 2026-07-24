import { useState, useMemo } from "react";
import {
  Users,
  Calendar,
  Link2,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Video,
  BookOpen,
  FolderKanban,
  GraduationCap,
  Wrench,
  MessageSquare,
  Globe,
  MapPin,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreateSession,
  type SessionType,
} from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

const STEPS = [
  { label: "Participants", icon: Users },
  { label: "Type", icon: Calendar },
  { label: "Link", icon: Link2 },
  { label: "Schedule", icon: Clock },
  { label: "Confirm", icon: CheckCircle2 },
] as const;

const SESSION_TYPES: { value: SessionType; label: string; icon: typeof Video; desc: string }[] = [
  { value: "skill_exchange", label: "Skill Exchange", icon: Wrench, desc: "Trade skills with a peer" },
  { value: "mentoring", label: "Mentoring", icon: GraduationCap, desc: "One-on-one guidance session" },
  { value: "project_meeting", label: "Project Meeting", icon: FolderKanban, desc: "Collaborate on a project" },
  { value: "study_session", label: "Study Session", icon: BookOpen, desc: "Learn together" },
  { value: "workshop", label: "Workshop", icon: Users, desc: "Group teaching session" },
  { value: "general", label: "General", icon: MessageSquare, desc: "Open discussion" },
];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

type Participant = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

type WizardState = {
  participants: Participant[];
  sessionType: SessionType;
  title: string;
  description: string;
  skillId: string | null;
  projectId: string | null;
  meetingUrl: string;
  location: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  isRecurring: boolean;
};

const INITIAL: WizardState = {
  participants: [],
  sessionType: "general",
  title: "",
  description: "",
  skillId: null,
  projectId: null,
  meetingUrl: "",
  location: "",
  date: "",
  time: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  durationMinutes: 60,
  isRecurring: false,
};

export function ScheduleSessionWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const { data: me } = useCurrentUser();
  const createSession = useCreateSession();

  const userId = me?.userId;

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0);
      setState(INITIAL);
    }, 200);
  }

  async function handleSubmit() {
    if (!state.title.trim()) {
      toast.error("Please enter a session title");
      setStep(1);
      return;
    }
    if (!state.date || !state.time) {
      toast.error("Please select a date and time");
      setStep(3);
      return;
    }

    const startsAt = new Date(`${state.date}T${state.time}`).toISOString();
    const participantIds = state.participants.map((p) => p.id);

    try {
      await createSession.mutateAsync({
        title: state.title.trim(),
        description: state.description.trim() || undefined,
        session_type: state.sessionType,
        starts_at: startsAt,
        duration_minutes: state.durationMinutes,
        timezone: state.timezone,
        meeting_url: state.meetingUrl.trim() || undefined,
        location: state.location.trim() || undefined,
        skill_id: state.skillId ?? undefined,
        project_id: state.projectId ?? undefined,
        participant_ids: participantIds.length > 0 ? participantIds : undefined,
      });
      toast.success("Session created!");
      handleClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create session");
    }
  }

  const canNext = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return true;
    if (step === 2) return !!state.title.trim();
    if (step === 3) return !!state.date && !!state.time;
    return true;
  }, [step, state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-lg font-semibold">Schedule a Session</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 border-b border-border/60 bg-surface/50 px-6 py-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-brand-green text-background"
                        : done
                          ? "bg-brand-green/20 text-brand-green"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
                  </div>
                  <span
                    className={`hidden text-xs font-medium sm:inline ${
                      active ? "text-foreground" : done ? "text-brand-green" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="mx-1.5 h-3 w-3 text-muted-foreground/40" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[340px] px-6 py-5">
          {step === 0 && (
            <StepParticipants
              participants={state.participants}
              onChange={(p) => update("participants", p)}
            />
          )}
          {step === 1 && (
            <StepType value={state.sessionType} onChange={(v) => update("sessionType", v)} />
          )}
          {step === 2 && (
            <StepLink
              title={state.title}
              description={state.description}
              meetingUrl={state.meetingUrl}
              location={state.location}
              onTitleChange={(v) => update("title", v)}
              onDescChange={(v) => update("description", v)}
              onMeetingUrlChange={(v) => update("meetingUrl", v)}
              onLocationChange={(v) => update("location", v)}
            />
          )}
          {step === 3 && (
            <StepSchedule
              date={state.date}
              time={state.time}
              timezone={state.timezone}
              durationMinutes={state.durationMinutes}
              isRecurring={state.isRecurring}
              onDateChange={(v) => update("date", v)}
              onTimeChange={(v) => update("time", v)}
              onTimezoneChange={(v) => update("timezone", v)}
              onDurationChange={(v) => update("durationMinutes", v)}
              onRecurringChange={(v) => update("isRecurring", v)}
            />
          )}
          {step === 4 && (
            <StepConfirm
              state={state}
              organizerName={me?.profile?.display_name ?? "You"}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-surface/30 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={next}
                disabled={!canNext}
                className="bg-brand-green text-background hover:bg-brand-green/90"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createSession.isPending}
                className="bg-brand-green text-background hover:bg-brand-green/90"
              >
                {createSession.isPending ? "Creating..." : "Create Session"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Step 1: Participants ───────── */

function StepParticipants({
  participants,
  onChange,
}: {
  participants: Participant[];
  onChange: (p: Participant[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  async function doSearch(q: string) {
    setSearch(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await sb
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .or(`display_name.ilike.%${q}%,handle.ilike.%${q}%`)
      .limit(10);
    setResults((data ?? []).filter((p: Participant) => !participants.find((x) => x.id === p.id)));
    setLoading(false);
  }

  function add(p: Participant) {
    onChange([...participants, p]);
    setSearch("");
    setResults([]);
  }

  function remove(id: string) {
    onChange(participants.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Invite Participants</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Search for users to invite. You can skip this and add participants later.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or handle..."
          value={search}
          onChange={(e) => doSearch(e.target.value)}
          className="pl-9"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Searching...
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface/50 divide-y divide-border/40">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(p.display_name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {p.display_name ?? "Unnamed"}
                </div>
                <div className="truncate text-xs text-muted-foreground">@{p.handle ?? "—"}</div>
              </div>
              <span className="text-xs text-brand-green">+ Invite</span>
            </button>
          ))}
        </div>
      )}

      {participants.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Invited ({participants.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Badge
                key={p.id}
                variant="secondary"
                className="flex items-center gap-1.5 pr-1.5"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {(p.display_name ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {p.display_name ?? p.handle ?? "User"}
                <button
                  onClick={() => remove(p.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Step 2: Session Type ───────── */

function StepType({
  value,
  onChange,
}: {
  value: SessionType;
  onChange: (v: SessionType) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Session Type</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          What kind of session is this?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SESSION_TYPES.map((t) => {
          const Icon = t.icon;
          const selected = value === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                selected
                  ? "border-brand-green bg-brand-green/5 shadow-sm"
                  : "border-border/60 bg-surface/50 hover:border-border hover:bg-muted/30"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  selected
                    ? "bg-brand-green/20 text-brand-green"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Step 3: Link Content ───────── */

function StepLink({
  title,
  description,
  meetingUrl,
  location,
  onTitleChange,
  onDescChange,
  onMeetingUrlChange,
  onLocationChange,
}: {
  title: string;
  description: string;
  meetingUrl: string;
  location: string;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onMeetingUrlChange: (v: string) => void;
  onLocationChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Session Details</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Give your session a title and add a meeting link or location.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="session-title" className="text-xs">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="session-title"
            placeholder="e.g. React Hooks Deep Dive"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-desc" className="text-xs">
            Description
          </Label>
          <Textarea
            id="session-desc"
            placeholder="What will you cover?"
            rows={3}
            value={description}
            onChange={(e) => onDescChange(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="session-url" className="flex items-center gap-1.5 text-xs">
              <Video className="h-3 w-3" /> Meeting URL
            </Label>
            <Input
              id="session-url"
              placeholder="https://meet.google.com/..."
              value={meetingUrl}
              onChange={(e) => onMeetingUrlChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-location" className="flex items-center gap-1.5 text-xs">
              <MapPin className="h-3 w-3" /> Location
            </Label>
            <Input
              id="session-location"
              placeholder="Room 101, Online, etc."
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Step 4: Schedule ───────── */

function StepSchedule({
  date,
  time,
  timezone,
  durationMinutes,
  isRecurring,
  onDateChange,
  onTimeChange,
  onTimezoneChange,
  onDurationChange,
  onRecurringChange,
}: {
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  isRecurring: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onTimezoneChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onRecurringChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          When will this session take place?
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-date" className="text-xs">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session-date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-time" className="text-xs">
              Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session-time"
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Timezone</Label>
            <Select value={timezone} onValueChange={onTimezoneChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duration</Label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(v) => onDurationChange(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d < 60 ? `${d} min` : d === 60 ? "1 hour" : `${d / 60} hours`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/50 px-4 py-3">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Recurring session</div>
            <div className="text-xs text-muted-foreground">Repeat weekly</div>
          </div>
          <button
            onClick={() => onRecurringChange(!isRecurring)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              isRecurring ? "bg-brand-green" : "bg-muted"
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                isRecurring ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Step 5: Confirm ───────── */

function StepConfirm({
  state,
  organizerName,
}: {
  state: WizardState;
  organizerName: string;
}) {
  const typeInfo = SESSION_TYPES.find((t) => t.value === state.sessionType);
  const TypeIcon = typeInfo?.icon ?? MessageSquare;

  const dt = state.date && state.time
    ? new Date(`${state.date}T${state.time}`)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Review & Create</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Check the details before creating your session.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface/50 p-4 space-y-3">
        {/* Title + type */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-green/20 text-brand-green">
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground">{state.title || "Untitled Session"}</div>
            <div className="text-xs text-muted-foreground">{typeInfo?.label ?? "General"}</div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <div className="text-muted-foreground">When</div>
            <div className="font-medium text-foreground">
              {dt ? dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—"}
              {" "}
              {dt ? dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <div className="text-muted-foreground">Duration</div>
            <div className="font-medium text-foreground">
              {state.durationMinutes < 60
                ? `${state.durationMinutes} min`
                : state.durationMinutes === 60
                  ? "1 hour"
                  : `${state.durationMinutes / 60} hours`}
            </div>
          </div>
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <div className="text-muted-foreground">Timezone</div>
            <div className="font-medium text-foreground">{state.timezone}</div>
          </div>
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <div className="text-muted-foreground">Organizer</div>
            <div className="font-medium text-foreground">{organizerName}</div>
          </div>
        </div>

        {state.meetingUrl && (
          <div className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{state.meetingUrl}</span>
          </div>
        )}

        {state.participants.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">
              Participants ({state.participants.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.participants.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.display_name ?? p.handle ?? "User"}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {state.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{state.description}</p>
        )}
      </div>
    </div>
  );
}
