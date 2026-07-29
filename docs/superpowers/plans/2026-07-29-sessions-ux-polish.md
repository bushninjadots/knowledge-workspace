# Sessions UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four UX gaps in the sessions feature: editable availability, real profile stats, list filtering, and request flow polish.

**Architecture:** Each improvement lives in its own task. Task 1 adds new hooks; Tasks 2-5 consume them. The mutations follow the same patterns as the existing session hooks (React Query, Supabase direct queries, query key invalidation). UI changes stay within the sessions component tree.

**Tech Stack:** React, TypeScript, TanStack Query, Supabase JS client, shadcn/ui (Dialog, Button, Select, Input, Toast), sonner, Tailwind CSS

## Global Constraints

- Follow existing code style: existing import patterns, no comments in production code
- All new components follow shadcn/ui patterns (existing codebase convention)
- Mutations follow the existing pattern: `useMutation` with `queryClient.invalidateQueries` on success
- Toast via `sonner` (`toast.success`, `toast.error`, `toast.info`)
- npm run typecheck must pass after every task
- No over-engineering — YAGNI for anything not in the spec

---

### Task 1: Add new session mutations

**Files:**
- Modify: `src/hooks/use-sessions.ts` — add three new mutations

**Interfaces:**
- Produces: `useSetSessionAvailability()`, `useCancelSessionRequest(id)`, `useSendSessionRequest(fromUserId, toUserId, data)`

- [ ] **Step 1: Add `useSetSessionAvailability` mutation**

```ts
export function useSetSessionAvailability() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async (slots: { day_of_week: number; start_time: string; end_time: string; status: string }[]) => {
      const { error: delError } = await sb
        .from("session_availability")
        .delete()
        .eq("profile_id", userId);

      if (delError) throw delError;

      if (slots.length > 0) {
        const { error: insError } = await sb
          .from("session_availability")
          .insert(slots.map((s) => ({ ...s, profile_id: userId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })));

        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: sessionKeys.availability(userId) });
    },
  });
}
```

- [ ] **Step 2: Add `useCancelSessionRequest` mutation**

```ts
export function useCancelSessionRequest() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await sb
        .from("session_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("from_user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: sessionKeys.requests(userId) });
    },
  });
}
```

- [ ] **Step 3: Add `useSendSessionRequest` mutation**

```ts
export function useSendSessionRequest() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useMutation({
    mutationFn: async ({
      toUserId,
      sessionType,
      message,
      suggestedTime,
    }: {
      toUserId: string;
      sessionType?: string;
      message?: string;
      suggestedTime?: string;
    }) => {
      const { error } = await sb.from("session_requests").insert({
        from_user_id: userId,
        to_user_id: toUserId,
        session_type: sessionType || null,
        message: message || null,
        suggested_time: suggestedTime || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: sessionKeys.requests(userId) });
    },
  });
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-sessions.ts
git commit -m "feat: add set-availability, cancel-request, send-request session mutations"
```

---

### Task 2: Availability Editor Dialog

**Files:**
- Modify: `src/components/tethyr/sessions/availability-settings.tsx`

**Interfaces:**
- Consumes: `useSetSessionAvailability()` from Task 1
- Uses: `useSessionAvailability()` (already exists)

- [ ] **Step 1: Add dialog imports and state**

Add to `availability-settings.tsx`:

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSetSessionAvailability } from "@/hooks/use-sessions";
```

- [ ] **Step 2: Add the AvailabilityEditorDialog component**

```tsx
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: "available" | "unavailable" | "tentative";
}

function AvailabilityEditorDialog({ availability, onSaved }: { availability: Availability[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SlotInput[]>(() =>
    availability.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time.slice(0, 5),
      end_time: a.end_time.slice(0, 5),
      status: a.status as SlotInput["status"],
    }))
  );
  const setAvailability = useSetSessionAvailability();

  const addSlot = (day: number) => {
    setSlots((prev) => [...prev, { day_of_week: day, start_time: "09:00", end_time: "10:00", status: "available" }]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof SlotInput, value: string | number) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const overlaps = (a: SlotInput, b: SlotInput) =>
    a.day_of_week === b.day_of_week && a.start_time < b.end_time && b.start_time < a.end_time;

  const hasOverlaps = slots.some((a, i) => slots.some((b, j) => i !== j && overlaps(a, b)));

  const handleSave = async () => {
    if (hasOverlaps) {
      toast.error("Fix overlapping slots before saving");
      return;
    }
    setAvailability.mutate(slots, {
      onSuccess: () => {
        toast.success("Availability saved");
        setOpen(false);
        onSaved();
      },
      onError: () => toast.error("Failed to save availability"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit Availability</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Weekly Availability</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, dayIdx) => (
            <div key={dayIdx} className="space-y-1">
              <div className="text-xs font-medium text-center text-muted-foreground">{label}</div>
              {slots
                .filter((s) => s.day_of_week === dayIdx)
                .map((slot, i) => {
                  const globalIdx = slots.indexOf(slot);
                  return (
                    <div key={i} className="flex items-center gap-1 rounded border p-1 text-xs">
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(globalIdx, "start_time", e.target.value)}
                        className="w-14 bg-transparent"
                        step="900"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(globalIdx, "end_time", e.target.value)}
                        className="w-14 bg-transparent"
                        step="900"
                      />
                      <select
                        value={slot.status}
                        onChange={(e) => updateSlot(globalIdx, "status", e.target.value)}
                        className="w-16 bg-transparent text-xs"
                      >
                        <option value="available">Free</option>
                        <option value="tentative">Maybe</option>
                        <option value="unavailable">Busy</option>
                      </select>
                      <button onClick={() => removeSlot(globalIdx)} className="text-muted-foreground hover:text-destructive">&times;</button>
                    </div>
                  );
                })}
              <button
                onClick={() => addSlot(dayIdx)}
                className="w-full rounded border border-dashed py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                + Add
              </button>
            </div>
          ))}
        </div>
        {hasOverlaps && <p className="text-xs text-destructive">Some slots overlap — fix before saving</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={setAvailability.isPending}>
            {setAvailability.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Integrate into AvailabilitySettings**

Find the "Set Availability" placeholder button (currently a `<Button>` with no `onClick`) and replace it with `<AvailabilityEditorDialog>`.

Also remove the hardcoded placeholder values in the "Preferences" section (timezone, buffer time, max sessions/day, preferred length) since they show fake data — replace with a simple "Coming soon" label or remove.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tethyr/sessions/availability-settings.tsx
git commit -m "feat: add availability editor dialog"
```

---

### Task 3: Profile Sessions Tab + Request Button

**Files:**
- Modify: `src/hooks/use-sessions.ts` — make `useSessionStats` accept optional `userId`
- Modify: `src/components/tethyr/profile/profile-sessions-tab.tsx`
- Create: `src/components/tethyr/sessions/request-session-dialog.tsx`
- Modify: `src/components/tethyr/profile/profile-layout.tsx`

**Interfaces:**
- Consumes: `useSessionStats(userId)`, `useSendSessionRequest()` from Task 1

- [ ] **Step 1: Modify `useSessionStats` to accept optional userId**

Change the hook signature to accept an optional `userId` param. Default to current user for backwards compat:

```ts
export function useSessionStats(viewUserId?: string) {
  const { data: me } = useCurrentUser();
  const userId = viewUserId ?? me?.userId;
  return useQuery({
    queryKey: sessionKeys.stats(userId ?? ""),
    queryFn: () => fetchSessionStats(userId!),
    enabled: !!userId,
  });
}
```

- [ ] **Step 2: Wire profile-sessions-tab.tsx to real stats**

Replace the hardcoded `0` values with `useSessionStats(userId)`:

- [ ] **Step 3: Create request-session-dialog.tsx**

```tsx
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
```

- [ ] **Step 4: Add request button to profile layout**

In `profile-layout.tsx`, find the FollowButton and add the Request Session dialog next to it (only for other users' profiles, not own profile). Check for existing pending request via `useSessionRequests()`, passing the `to_user_id` filter to detect duplicates client-side.

```tsx
// Near the FollowButton in profile-layout.tsx
import { RequestSessionDialog } from "@/components/tethyr/sessions/request-session-dialog";
import { useSessionRequests } from "@/hooks/use-sessions";

// Inside the profile actions area (only when viewing another user):
const { data: requests } = useSessionRequests();
const hasPendingRequest = requests?.some(
  (r) => r.to_user_id === userId && r.status === "pending"
);

// Don't render on own profile
{!isOwnProfile && (
  <RequestSessionDialog
    toUserId={userId}
    toUserName={displayName}
    hasPendingRequest={hasPendingRequest}
  />
)}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-sessions.ts src/components/tethyr/sessions/request-session-dialog.tsx src/components/tethyr/profile/profile-sessions-tab.tsx src/components/tethyr/profile/profile-layout.tsx
git commit -m "feat: wire profile sessions stats, add request session dialog"
```

---

### Task 4: Session List Filtering

**Files:**
- Create: `src/components/tethyr/sessions/session-filters.tsx`
- Modify: `src/components/tethyr/sessions/sessions-layout.tsx` — own filter state, pass to children
- Modify: `src/components/tethyr/sessions/upcoming-sessions.tsx` — accept filtered sessions
- Modify: `src/components/tethyr/sessions/session-history.tsx` — accept filtered sessions

**Interfaces:**
- Produces: `<SessionFilters filters={filters} onChange={setFilters} />` shared component

- [ ] **Step 1: Create session-filters.tsx**

```tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface SessionFiltersState {
  search: string;
  type: string;
}

interface SessionFiltersProps {
  filters: SessionFiltersState;
  onChange: (filters: SessionFiltersState) => void;
}

export function SessionFilters({ filters, onChange }: SessionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Input
        placeholder="Search sessions..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-48 h-8 text-sm"
      />
      <Select value={filters.type} onValueChange={(v) => onChange({ ...filters, type: v })}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="skill_exchange">Skill Exchange</SelectItem>
          <SelectItem value="mentoring">Mentoring</SelectItem>
          <SelectItem value="project_meeting">Project Meeting</SelectItem>
          <SelectItem value="study_session">Study Session</SelectItem>
          <SelectItem value="workshop">Workshop</SelectItem>
          <SelectItem value="general">General</SelectItem>
        </SelectContent>
      </Select>
      {(filters.search || filters.type) && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange({ search: "", type: "" })}>
          Clear
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update sessions-layout.tsx**

Add filter state and filtering logic:

```tsx
// In SessionsLayout
const [filters, setFilters] = useState<SessionFiltersState>({ search: "", type: "" });

const filterSessions = useCallback((sessions: SessionWithParticipants[] | undefined) => {
  if (!sessions) return sessions;
  return sessions.filter((s) => {
    if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.type && filters.type !== "all" && s.session_type !== filters.type) return false;
    return true;
  });
}, [filters]);

// In the Upcoming tab section, pass filterSessions(upcomingSessions) instead of upcomingSessions
// In the History tab section, pass filterSessions(historySessions) instead of historySessions
// Render <SessionFilters filters={filters} onChange={setFilters} /> above the active tab content
```

Only show filters on the Upcoming and History tabs (not Calendar or Requests).

- [ ] **Step 3: Update upcoming-sessions.tsx**

Ensure the component accepts the pre-filtered list — no changes needed if it already accepts `sessions: SessionWithParticipants[]`.

- [ ] **Step 4: Update session-history.tsx**

Same as Step 3 — verify the component accepts the filtered list via props.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/tethyr/sessions/session-filters.tsx src/components/tethyr/sessions/sessions-layout.tsx src/components/tethyr/sessions/upcoming-sessions.tsx src/components/tethyr/sessions/session-history.tsx
git commit -m "feat: add session list filtering by title and type"
```

---

### Task 5: Request Flow Polish

**Files:**
- Modify: `src/components/tethyr/sessions/session-requests.tsx`
- Hook `useCancelSessionRequest`, `useRespondToRequest` (already exists, needs toast wiring)

**Interfaces:**
- Consumes: `useCancelSessionRequest()` from Task 1
- Modifies: `useRespondToRequest` — add toast onSuccess/onError (this is in the existing component, not the hook)

- [ ] **Step 1: Add cancel button to outgoing pending requests**

In `session-requests.tsx`, find the section that renders outgoing pending requests with "Waiting for response". Add a Cancel button:

```tsx
import { useCancelSessionRequest } from "@/hooks/use-sessions";
import { toast } from "sonner";

// Inside the outgoing request card, after "Waiting for response":
const cancelRequest = useCancelSessionRequest();

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
```

- [ ] **Step 2: Add toast feedback to accept/decline**

Find the existing Accept/Decline buttons and wrap their `onClick` handlers with toast feedback:

```tsx
// Accept
respondToRequest.mutate(
  { requestId: request.id, status: "accepted" },
  {
    onSuccess: () => toast.success("Request accepted"),
    onError: () => toast.error("Failed to accept request"),
  }
);

// Decline
respondToRequest.mutate(
  { requestId: request.id, status: "declined" },
  {
    onSuccess: () => toast.success("Request declined"),
    onError: () => toast.error("Failed to decline request"),
  }
);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/sessions/session-requests.tsx
git commit -m "feat: add cancel request button and toast feedback"
```
