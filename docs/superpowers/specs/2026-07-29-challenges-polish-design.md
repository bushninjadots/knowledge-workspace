# Challenges Polish

## Summary

Four improvements to the challenges feature: create dialog UI, notifications for challenge events, reputation points on completion, and enhanced progress tracking on the detail page.

---

## 1. Create Challenge Dialog

### Problem

The `useCreateChallenge()` mutation hook exists but there is no UI to create a challenge. Users must insert directly into the database.

### Design

New component `CreateChallengeDialog` that opens from a button on the community page's challenges tab.

**Trigger:** "Create Challenge" button in the challenges tab header area.

**Dialog fields:**
- Title (required, text input)
- Description (required, textarea)
- Type (required, select: Skill / Project / Learning)
- Skills (optional, text input — comma-separated, stored as `TEXT[]`)
- Difficulty (required, select: Beginner / Intermediate / Advanced, default Intermediate)
- Start Date (optional, date picker)
- End Date (optional, date picker)
- Max Participants (optional, number input)

**Interaction:**
- Validation: title and description required
- On save: calls `useCreateChallenge()`, shows toast on success/error, closes dialog, refreshes challenge list
- Loading: save button shows spinner during mutation

**Error handling:**
- Supabase errors toast to user
- Dialog stays open on failure

---

## 2. Notifications for Challenge Events

### Problem

The notification system has no triggers for challenge events. Challenge join/complete actions are silent.

### Design

New migration adding two notification triggers.

**New notification types** (added to existing `notification_type` enum):
- `challenge_join` — user joined a challenge
- `challenge_complete` — user completed a challenge

**Trigger: `notify_challenge_join`** (AFTER INSERT on `challenge_participants`)
- Recipient: challenge creator (`challenges.created_by`)
- Actor: the user who joined
- Message: "{actor_name} joined your challenge {challenge_title}"
- Metadata: `{ challenge_id, challenge_title }`

**Trigger: `notify_challenge_complete`** (AFTER UPDATE on `challenge_participants`, when status changes to 'completed')
- Recipient: challenge creator
- Actor: the user who completed
- Message: "{actor_name} completed your challenge {challenge_title}"
- Metadata: `{ challenge_id, challenge_title }`

**Notification navigator update:** The `useNotificationNavigator` in `notifications.tsx` gets cases for `challenge_join`/`challenge_complete` → navigate to `/challenges/$id`.

---

## 3. Reputation Points on Challenge Completion

### Problem

The challenge detail page says "earn reputation points" but no points are actually awarded. The `reputation_score` system exists with triggers for projects, endorsements, community posts, etc. but has no challenge trigger.

### Design

New migration adding a trigger function `trg_reputation_challenge_completed`.

**Pattern:** Follows the existing `trg_reputation_*` pattern in `20260722130000_phase4_reputation.sql` — uses `public.log_contribution()` helper.

**Points:**
- Challenge completion: **+15 points** per challenge (comparable to project published's +10)
- Category: `"challenges"`, action: `"challenge_completed"`
- Metadata: `{ challenge_id, challenge_title }`

**Trigger:** AFTER UPDATE on `challenge_participants`, when `NEW.status = 'completed'` AND `OLD.status IS DISTINCT FROM 'completed'` (prevent double-award).

---

## 4. Progress UX Enhancement

### Problem

The challenge detail page shows a basic progress indicator (33% / 100%) and a "Mark Completed" button. It lacks intermediate progress steps and completion flow feedback.

### Design

Enhance the existing progress section in `challenges.$id.tsx`:

- **Progress bar:** Replace the text "33%" with a visual progress bar component (using shadcn Progress)
- **Steps:** Add a simple 3-step checklist that the user works through:
  1. "Start working" (auto-marked when joining) → status `joined`
  2. "In progress" (user clicks to mark) → status `in_progress`  
  3. "Completed" (user clicks to mark with optional notes) → status `completed`
- Each step shows a check icon when completed, radio/button to mark the next step
- **Completion flow:** Keep the existing congratulations message, add a small reputation badge showing "+15 reputation" when completed
- **Notes field:** Keep the existing optional notes textarea on completion

This replaces the current "Mark Completed" button with a stepped flow that gives the user a sense of progression.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/tethyr/community/create-challenge-dialog.tsx` | **New** — create challenge dialog |
| `src/routes/_authenticated/community.tsx` | Add "Create Challenge" button + dialog trigger in challenges tab |
| `src/routes/_authenticated/notifications.tsx` | Add `challenge_join`, `challenge_complete` cases to `useNotificationNavigator` |
| `src/routes/_authenticated/challenges.$id.tsx` | Enhanced progress section with 3-step flow, progress bar, reputation badge |
| `supabase/migrations/20260729000000_challenge_notifications.sql` | **New** — notification types + triggers for challenge events |
| `supabase/migrations/20260729000001_challenge_reputation.sql` | **New** — reputation trigger for challenge completion |

## New/Modified DB Objects

| Object | Type | Description |
|--------|------|-------------|
| `challenge_join` | notification_type enum value | Join event notification |
| `challenge_complete` | notification_type enum value | Complete event notification |
| `notify_challenge_event()` | trigger function | Inserts notification for challenge join/complete |
| `trg_reputation_challenge_completed()` | trigger function | Awards +15 reputation on challenge completion |

## New Hooks / Exports

None. All hooks exist already (`useCreateChallenge`, `useUpdateChallengeProgress`, `useJoinChallenge`). The notification navigator logic is a switch-case addition.
