# Availability & Calendar Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix availability UI bugs, add timezone support, improve calendar to show upcoming events with duration visualization.

**Architecture:** Targeted fixes to existing components — no new routes, no DB migrations.

**Tech Stack:** React 19, TanStack Router, Supabase, Tailwind CSS 4, TypeScript strict

## Global Constraints

- TypeScript strict mode, no `as any`, no `@ts-ignore`
- Tailwind CSS 4 — use existing design tokens
- Follow existing code patterns and naming conventions
- No new card containers — use surfaces/sections/compositions

---

## Task 1: Fix availability stale callback bug

**Files:**
- Modify: `src/components/tethyr/sessions/availability-settings.tsx`

**Interfaces:**
- Consumes: `useSessionAvailability()` hook (returns availability data + refetch)
- Produces: availability data refreshes after save

- [ ] **Step 1: Read the file and understand the callback chain**

Read `src/components/tethyr/sessions/availability-settings.tsx` to understand:
- How `AvailabilityEditorDialog` is rendered (lines ~170-215)
- The `onSaved` prop being passed as `() => {}`
- How `useSessionAvailability()` works and what refetch it provides

- [ ] **Step 2: Wire the onSaved callback to refetch**

Replace `onSaved={() => {}}` with `onSaved={() => refetch()}` (or `onSaved={refetch}` if the types align). The `refetch` function comes from the `useSessionAvailability()` hook.

If the component doesn't have direct access to `refetch`, check the parent component and thread it through.

- [ ] **Step 3: Verify the fix**

After saving availability, the weekly grid should update immediately without a page refresh.

- [ ] **Step 4: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/components/tethyr/sessions/availability-settings.tsx
git commit -m "fix: availability settings refresh after save"
```

---

## Task 2: Add timezone selector to availability editor

**Files:**
- Modify: `src/components/tethyr/sessions/availability-settings.tsx`
- Modify: `src/components/tethyr/sessions/sessions-calendar.tsx` (for display)

**Interfaces:**
- Consumes: `useSessionAvailability()` (returns timezone from DB)
- Produces: timezone dropdown in the availability editor, timezone display in calendar

- [ ] **Step 1: Create a timezone utility**

Check if a timezone list or utility already exists in the codebase:
```bash
grep -rn "timezone\|TimeZone\|tz" src/lib/ --include="*.ts" | head -20
```

If not, create `src/lib/timezones.ts` with a curated list of common timezones:

```typescript
export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export type TimeZone = (typeof TIMEZONES)[number];

export function getUserTimezone(): TimeZone {
  return Intl.DateTimeFormat().resolvedOptions().timeZone as TimeZone;
}
```

- [ ] **Step 2: Add timezone dropdown to availability editor**

In `availability-settings.tsx`, add a timezone selector above the weekly grid:

```tsx
import { TIMEZONES, getUserTimezone } from "@/lib/timezones";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Inside the component, add state for timezone:
const [timezone, setTimezone] = useState(getUserTimezone());

// Add above the grid:
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Timezone:</span>
  <Select value={timezone} onValueChange={setTimezone}>
    <SelectTrigger className="w-48">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {TIMEZONES.map((tz) => (
        <SelectItem key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 3: Save timezone to DB**

Update the `useSetSessionAvailability()` mutation (or the save handler) to include the timezone:

```typescript
// In the save handler, include timezone:
await supabase.from("session_availability").upsert({
  profile_id: userId,
  day_of_week: day,
  start_time: start,
  end_time: end,
  status: status,
  timezone: timezone, // <-- add this
});
```

Check the `session_availability` table schema to confirm it has a `timezone` column. If not, this step is skipped and timezone is stored locally only.

- [ ] **Step 4: Display timezone in calendar header**

In `sessions-calendar.tsx`, add a small timezone badge in the day/week view header:

```tsx
<span className="text-xs text-muted-foreground">
  {timezone.replace(/_/g, " ")}
</span>
```

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/lib/timezones.ts src/components/tethyr/sessions/availability-settings.tsx src/components/tethyr/sessions/sessions-calendar.tsx
git commit -m "feat: add timezone selector to availability editor"
```

---

## Task 3: Calendar — add duration visualization

**Files:**
- Modify: `src/components/tethyr/sessions/sessions-calendar.tsx`

**Interfaces:**
- Consumes: `SessionWithParticipants[]` (has `starts_at`, `ends_at` or `duration_minutes`)
- Produces: session cards that span multiple hour slots

- [ ] **Step 1: Read the calendar component**

Read `src/components/tethyr/sessions/sessions-calendar.tsx` to understand:
- How sessions are currently rendered in day view (lines ~118-151)
- How `CalendarEventCard` is structured
- The hour grid layout

- [ ] **Step 2: Calculate session duration and position**

In the day view, for each session:
1. Parse `starts_at` to get the start hour and minute
2. If `ends_at` exists, parse it to get end hour/minute. Otherwise, use `duration_minutes` from the session (default 60).
3. Calculate: `topOffset = (startHour - 6) * 60 + startMinute` (grid starts at 6 AM)
4. Calculate: `height = durationMinutes` (in pixels, scaled to the hour grid)

- [ ] **Step 3: Apply positioning to session cards**

Replace the simple hour-slot placement with absolute positioning:

```tsx
// In the day view grid, wrap sessions in a relative container
<div className="relative">
  {sessions.map((session) => {
    const startsAt = new Date(session.starts_at);
    const duration = session.duration_minutes ?? 60;
    const startHour = startsAt.getHours();
    const startMinute = startsAt.getMinutes();
    const top = ((startHour - 6) * 60 + startMinute) * (ROW_HEIGHT / 60);
    const height = duration * (ROW_HEIGHT / 60);

    return (
      <div
        key={session.id}
        className="absolute left-0 right-0"
        style={{ top: `${top}px`, height: `${height}px` }}
      >
        <CalendarEventCard session={session} />
      </div>
    );
  })}
</div>
```

Where `ROW_HEIGHT` is the pixel height of one hour row (check the existing grid).

- [ ] **Step 4: Update week view similarly**

Apply the same duration-based positioning to the week view cells.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/components/tethyr/sessions/sessions-calendar.tsx
git commit -m "feat: calendar session cards show duration"
```

---

## Task 4: Calendar — show availability slots

**Files:**
- Modify: `src/components/tethyr/sessions/sessions-calendar.tsx`
- Modify: `src/components/tethyr/sessions/sessions-layout.tsx`

**Interfaces:**
- Consumes: `useSessionAvailability()` (weekly time slots)
- Produces: gray availability blocks in the calendar grid

- [ ] **Step 1: Fetch availability in sessions-layout**

In `sessions-layout.tsx`, import `useSessionAvailability` and pass availability data to `SessionsCalendar`:

```typescript
import { useSessionAvailability } from "@/hooks/use-sessions";

// Inside the component:
const { data: availability } = useSessionAvailability();
```

Pass `availability` as a prop to `SessionsCalendar`.

- [ ] **Step 2: Add availability prop to SessionsCalendar**

Update the `SessionsCalendar` component's props type to accept `availability`:

```typescript
interface SessionsCalendarProps {
  sessions: SessionWithParticipants[];
  availability?: SessionAvailability[];
}
```

- [ ] **Step 3: Render availability blocks in day view**

In the day view, for each day of the week, find matching availability slots and render them as semi-transparent gray blocks behind the session cards:

```tsx
// Filter availability for this day
const daySlots = availability?.filter((slot) => {
  const slotDay = new Date().getDay(); // or calculate for each day in week view
  return slot.day_of_week === slotDay && slot.status === "available";
});

// Render as background blocks
{daySlots?.map((slot, i) => {
  const [startH, startM] = slot.start_time.split(":").map(Number);
  const [endH, endM] = slot.end_time.split(":").map(Number);
  const top = ((startH - 6) * 60 + startM) * (ROW_HEIGHT / 60);
  const height = ((endH - startH) * 60 + (endM - startM)) * (ROW_HEIGHT / 60);

  return (
    <div
      key={i}
      className="absolute left-0 right-0 bg-muted/30 rounded"
      style={{ top: `${top}px`, height: `${height}px` }}
    />
  );
})}
```

- [ ] **Step 4: Render in week view**

Apply the same logic to each day column in the week view.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add src/components/tethyr/sessions/sessions-calendar.tsx src/components/tethyr/sessions/sessions-layout.tsx
git commit -m "feat: calendar shows availability slots"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full verification**

```bash
npx tsc --noEmit
npx vitest run
npx eslint src/
```

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "feat: availability fixes + calendar improvements"
git push origin main
```
