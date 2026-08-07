# Challenges Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add create dialog, notifications, reputation points, and progress UX to the challenges feature.

**Architecture:** 4 tasks — 2 DB migrations (notifications + reputation) and 2 UI tasks (create dialog, progress UX). Task 4 depends on Task 1's notification type enum values existing. Tasks 2, 3 are independent.

**Tech Stack:** React, TypeScript, Supabase (PL/pgSQL triggers), shadcn/ui (Dialog, Input, Select, Textarea, Progress), sonner, TanStack Query

## Global Constraints

- Follow existing code style: existing import patterns, no comments in production code
- DB migrations use the existing helper `public._create_trigger_if_table_exists()` for trigger creation
- The notification trigger follows the pattern in `20260725120000_notifications.sql`
- The reputation trigger follows the pattern in `20260722130000_phase4_reputation.sql` (uses `public.log_contribution()`)
- npm run typecheck must pass after every UI task
- No over-engineering — YAGNI for anything not in the spec

---

### Task 1: Notification + Reputation DB Migrations

**Files:**
- Create: `supabase/migrations/20260729000000_challenge_notifications.sql`
- Create: `supabase/migrations/20260729000001_challenge_reputation.sql`

**Interfaces:**
- Produces: `notification_type` enum values `challenge_join`, `challenge_complete`; `notify_challenge_event()` trigger function; `trg_reputation_challenge_completed()` trigger function

- [x] **Step 1: Create challenge notifications migration**

File: `supabase/migrations/20260729000000_challenge_notifications.sql`

```sql
-- Challenge Notifications
-- Adds notification types and triggers for challenge join/complete events.

-- 1. Add new notification types to the enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'challenge_join';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'challenge_complete';

-- 2. Trigger: challenge join → notify creator
CREATE OR REPLACE FUNCTION public.notify_challenge_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id uuid;
  _challenge_title text;
  _actor_name text;
BEGIN
  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    'challenge_join',
    COALESCE(_actor_name, 'Someone') || ' joined your challenge "' || _challenge_title || '"',
    NULL,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_join', 'challenge_participants',
  'notify_challenge_join', 'AFTER', 'INSERT'
);

-- 3. Trigger: challenge complete → notify creator
CREATE OR REPLACE FUNCTION public.notify_challenge_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id uuid;
  _challenge_title text;
  _actor_name text;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    'challenge_complete',
    COALESCE(_actor_name, 'Someone') || ' completed your challenge "' || _challenge_title || '"',
    NULL,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_complete', 'challenge_participants',
  'notify_challenge_complete', 'AFTER', 'UPDATE'
);
```

- [x] **Step 2: Create challenge reputation migration**

File: `supabase/migrations/20260729000001_challenge_reputation.sql`

```sql
-- Challenge Reputation
-- Awards reputation points when a challenge is completed.

CREATE OR REPLACE FUNCTION public.trg_reputation_challenge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  PERFORM public.log_contribution(
    NEW.user_id,
    'challenges',
    'challenge_completed',
    15,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_challenge_completed', 'challenge_participants',
  'trg_reputation_challenge_completed', 'AFTER', 'UPDATE'
);
```

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260729000000_challenge_notifications.sql supabase/migrations/20260729000001_challenge_reputation.sql
git commit -m "feat: add challenge notification and reputation triggers"
```

---

### Task 2: Create Challenge Dialog

**Files:**
- Create: `src/components/tethyr/community/create-challenge-dialog.tsx`
- Modify: `src/routes/_authenticated/community.tsx`

**Interfaces:**
- Consumes: `useCreateChallenge()` from `@/hooks/use-challenges`

- [x] **Step 1: Create the dialog component**

`src/components/tethyr/community/create-challenge-dialog.tsx`:

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateChallenge } from "@/hooks/use-challenges";

export function CreateChallengeDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("skill");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<string>("intermediate");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const create = useCreateChallenge();

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!description.trim()) { toast.error("Description is required"); return; }

    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        type: type as any,
        skills: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        difficulty: difficulty as any,
        start_date: startDate || null,
        end_date: endDate || null,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      },
      {
        onSuccess: () => {
          toast.success("Challenge created");
          setOpen(false);
          setTitle("");
          setDescription("");
          setSkills("");
          setStartDate("");
          setEndDate("");
          setMaxParticipants("");
        },
        onError: (err) => toast.error(err.message || "Failed to create challenge"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Challenge</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a Challenge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="learning">Learning</SelectItem>
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Skills (comma-separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Start date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Input placeholder="Max participants (optional)" type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 2: Add create button to community.tsx challenges tab**

Find the challenges tab section in `community.tsx`. Add the `<CreateChallengeDialog />` button in the header area of the challenges tab, near where the challenge cards are listed.

```tsx
// In the challenges tab section (when nav === "challenges")
import { CreateChallengeDialog } from "@/components/tethyr/community/create-challenge-dialog";

// Add in the header/layout:
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Challenges</h2>
  <CreateChallengeDialog />
</div>
```

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [x] **Step 4: Commit**

```bash
git add src/components/tethyr/community/create-challenge-dialog.tsx src/routes/_authenticated/community.tsx
git commit -m "feat: add create challenge dialog"
```

---

### Task 3: Progress UX Enhancement

**Files:**
- Modify: `src/routes/_authenticated/challenges.$id.tsx`

**Interfaces:**
- Consumes: `useUpdateChallengeProgress()` from `@/hooks/use-challenges`

- [x] **Step 1: Read the existing challenge detail page**

Read `challenges.$id.tsx` to understand the current progress section structure before editing.

- [x] **Step 2: Enhance the progress section**

Replace the existing basic progress indicator with:

1. A `Progress` bar from `@/components/ui/progress` showing percentage (0/33/66/100 based on status)
2. A 3-step checklist with the current step highlighted:
   - Joined (auto, step 1) — check icon
   - In Progress (clickable, step 2) — radio button, calls `useUpdateChallengeProgress` with status `in_progress`
   - Completed (clickable, step 3) — radio button, calls `useUpdateChallengeProgress` with status `completed`
3. When completed: show "+15 reputation" badge below the checklist

```tsx
import { Progress } from "@/components/ui/progress";

// In the progress section (when isJoined):
const STATUS_STEPS = ["joined", "in_progress", "completed"] as const;
const currentStepIndex = STATUS_STEPS.indexOf(myParticipation.status as typeof STATUS_STEPS[number]);
const progressPercent = currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0;

<Progress value={progressPercent} className="mb-4" />

<div className="space-y-2">
  {STATUS_STEPS.map((step, i) => {
    const isCurrent = i === currentStepIndex;
    const isDone = i < currentStepIndex;
    const isAvailable = i === currentStepIndex + 1; // next uncompleted step
    return (
      <div key={step} className="flex items-center gap-3">
        {isDone ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </div>
        ) : isCurrent ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>
        ) : isAvailable ? (
          <button
            onClick={() => updateProgress.mutate({ challengeId: challenge.id, status: step as any })}
            disabled={updateProgress.isPending}
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground hover:border-primary"
          />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted" />
        )}
        <span className={`text-sm capitalize ${isDone ? "text-muted-foreground line-through" : isCurrent ? "font-medium" : "text-muted-foreground"}`}>
          {step.replace("_", " ")}
        </span>
      </div>
    );
  })}
</div>

{myParticipation.status === "completed" && (
  <div className="mt-2 flex items-center gap-1 text-sm text-amber-600">
    <Award className="h-4 w-4" />
    <span>+15 reputation</span>
  </div>
)}
```

Use the existing `useUpdateChallengeProgress` mutation hook. Keep the existing notes textarea for the completion step.

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [x] **Step 4: Commit**

```bash
git add src/routes/_authenticated/challenges.$id.tsx
git commit -m "feat: enhance challenge progress UX with step flow and reputation badge"
```

---

### Task 4: Update Notification Navigator

**Files:**
- Modify: `src/routes/_authenticated/notifications.tsx`

**Interfaces:**
- Consumes: Task 1's new notification type enum values (must run after Task 1 or notifications page will crash on unknown type)

- [x] **Step 1: Add challenge cases to useNotificationNavigator**

In `notifications.tsx`, add to the `switch` statement:

```tsx
case "challenge_join":
case "challenge_complete":
  if (n.entity_id) {
    navigate({ to: "/challenges/$id", params: { id: n.entity_id } });
  } else {
    navigate({ to: "/community" });
  }
  break;
```

Also add `challenge_join` and `challenge_complete` to a relevant category in the `CATEGORY_TYPE_MAP` — add them to the `community` category key since challenges live in the community section:

```tsx
community: ["comment", "mention", "follow", "challenge_join", "challenge_complete"],
```

- [x] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [x] **Step 3: Commit**

```bash
git add src/routes/_authenticated/notifications.tsx
git commit -m "feat: add challenge notification navigation and category mapping"
```
