# Notifications Page — Design Spec

**Date:** 2026-07-25
**Phase:** MVP (Phase 1)
**Status:** Approved

---

## Overview

Build a full notification system for Tethyr — a central communication hub where users manage everything happening across their learning journey, projects, communities, sessions, reputation, and collaborations.

**Inspiration:** GitHub notifications, Slack activity feed, Discord mentions, Reddit inbox, Linear issue feed.

**Key decisions:**
- Supabase `notifications` table + Realtime for persistence and delivery
- PostgreSQL triggers for notification generation (follows existing `log_activity()` pattern)
- Full page route (`/notifications`) + dropdown panel from top bar
- Total unread count badge in sidebar (same pattern as Messages)
- All 12 notification types in MVP

---

## Database Schema

### `notifications` Table

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  archived_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
```

### RLS Policies

```sql
-- Users can read their own notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark read, archive)
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Insert is handled by SECURITY DEFINER functions only (no direct insert policy)
```

### Trigger Functions

Each function is `SECURITY DEFINER` to bypass RLS when inserting:

| Function | Trigger | Event Type | Fires On |
|---|---|---|---|
| `notify_new_message()` | AFTER INSERT on `messages` | `message` | New message received |
| `notify_connection_event()` | AFTER INSERT/UPDATE on `connections` | `connection_request` / `connection_accepted` | Connection request sent / accepted |
| `notify_post_comment()` | AFTER INSERT on `comments` | `comment` | Comment on a post |
| `notify_mention()` | AFTER INSERT on `comments` | `mention` | Comment body contains @handle |
| `notify_session_event()` | AFTER INSERT/UPDATE on `session_participants` | `session_invite` / `session_update` | Session invite / status change |
| `notify_achievement()` | AFTER INSERT on `user_achievements` | `achievement` | Achievement unlocked |
| `notify_endorsement()` | AFTER INSERT on `skill_endorsements` | `endorsement` | Skill endorsed |
| `notify_project_event()` | AFTER INSERT on `project_contributors` | `project_invite` / `project_join` | Project invite / someone joins |
| `notify_follow()` | AFTER INSERT on `connections` (status=accepted) | `follow` | Connection accepted (mutual follow) |

### Realtime

```sql
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## Hooks & Data Layer

### File: `src/hooks/use-notifications.ts`

**Types:**

```typescript
type NotificationType =
  | 'message'
  | 'connection_request'
  | 'connection_accepted'
  | 'session_invite'
  | 'session_update'
  | 'comment'
  | 'mention'
  | 'endorsement'
  | 'achievement'
  | 'project_invite'
  | 'project_join'
  | 'follow';

interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  archived_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface NotificationFilters {
  type?: NotificationType;
  unreadOnly?: boolean;
  archived?: boolean;
}
```

**Query hooks:**

| Hook | Purpose | Query |
|---|---|---|
| `useNotifications(filters?, limit?)` | Paginated feed | SELECT from notifications WHERE user_id = me, optional type/read/archived filters, ORDER BY created_at DESC, limit (default 50) |
| `useUnreadNotificationCount()` | Sidebar badge | SELECT count FROM notifications WHERE user_id = me AND read_at IS NULL |
| `useNotificationsByCategory()` | Sidebar category counts | SELECT type, count FROM notifications WHERE user_id = me AND read_at IS NULL GROUP BY type |

**Mutation hooks:**

| Hook | Purpose |
|---|---|
| `useMarkAsRead()` | Sets `read_at = now()` for notification IDs, invalidates queries |
| `useMarkAllAsRead()` | Sets `read_at = now()` for all unread of current user, invalidates queries |
| `useArchiveNotification()` | Sets `archived_at = now()`, invalidates queries |
| `useDeleteNotification()` | Hard delete, invalidates queries |

**Realtime subscription:**

```typescript
// Subscribe to new notifications for current user
const channel = supabase.channel(`notifications:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    qc.invalidateQueries({ queryKey: ['notificationsByCategory'] });
  })
  .subscribe();
```

Follows existing pattern from `use-messages.ts`: `useRef` for channel cleanup, no query key arrays in useEffect deps.

**Dropdown panel data:** Uses same `useNotifications({ limit: 10, unreadOnly: true })` — no separate data layer.

---

## UI Components

### File Structure

```
src/components/tethyr/notifications/
  notification-feed.tsx       — Scrollable feed list with time grouping
  notification-card.tsx       — Single notification row
  notification-sidebar.tsx    — Left sidebar categories
  notification-dropdown.tsx   — Top-bar dropdown panel
  notification-header.tsx     — Page header with title + actions
  notification-empty.tsx      — Empty state
```

### `notification-card.tsx`

Layout:
```
┌──────────────────────────────────────────────────┐
│ [Avatar]  Title text here                        │
│           Description/preview text               │
│           2 minutes ago    [Action] [⋯ More]     │
└──────────────────────────────────────────────────┘
```

States:
- **Unread:** `border-l-2 border-primary` (green accent), bg slightly elevated
- **Read:** normal surface, muted text
- **Hover:** `transition-lift` (card elevates slightly)

Action button varies by type:
- Messages → "Reply"
- Invites → "Accept" / "Decline"
- Most others → "View"
- Follow → "Follow Back"

More menu: Mark Read, Archive, Delete

### `notification-sidebar.tsx`

Categories with unread counts:
```
All (12)
Messages (4)
Sessions (2)
Community (3)
Projects (1)
Reputation (0)
Achievements (2)
```

Active category: green left bar + elevated background (same pattern as DashboardSidebar nav items).

### `notification-header.tsx`

```
Notifications                    [34 unread]

[Mark All as Read]  [Search...]
```

### `notification-feed.tsx`

Groups notifications by time:
```
── Today ──
[Card] Alex sent you a message
[Card] Session starts in 30min

── Yesterday ──
[Card] Maria accepted exchange

── Earlier This Week ──
[Card] Achievement unlocked

── Earlier ──
[Card] John started following
```

**Grouping logic:** When 3+ notifications share the same type + entity, collapse into one card: "3 new comments · View Thread". Computed client-side.

**Empty state:** "You're all caught up" with illustration + Explore/Browse CTAs.

### `notification-dropdown.tsx`

```
┌──────────────────────────────────┐
│ 🔔 Notifications        View All │
├──────────────────────────────────┤
│ [Card] Alex sent message      2m │
│ [Card] Session in 30min       5m │
│ [Card] 3 new comments        1h  │
│                                  │
│        Mark All as Read          │
└──────────────────────────────────┘
```

Opens from bell icon in top bar. Shows 10 most recent unread. "View All" links to `/notifications`.

---

## Notification Types & Card Variants

| Type | Icon | Color | Title Example | Action |
|---|---|---|---|---|
| `message` | MessageCircle | Blue | "Alex sent you a message" | Reply |
| `connection_request` | UserPlus | Green | "Maria wants to connect" | Accept / Decline |
| `connection_accepted` | CheckCircle | Green | "Maria accepted your connection" | View Profile |
| `session_invite` | CalendarPlus | Purple | "You're invited to: Spanish Practice" | Accept / Decline |
| `session_update` | CalendarClock | Purple | "Session starts in 30 minutes" | Join Session |
| `comment` | MessageSquare | Blue | "Alex commented on your post" | View Thread |
| `mention` | AtSign | Orange | "You were mentioned by Alex" | Reply |
| `endorsement` | Star | Yellow | "Maria endorsed your Spanish skill" | View |
| `achievement` | Trophy | Gold | "Achievement Unlocked: 10 Exchanges" | Celebrate |
| `project_invite` | FolderPlus | Green | "Join: Open Source AI Assistant" | Accept / Decline |
| `project_join` | Users | Green | "Sarah joined your project" | View Profile |
| `follow` | Heart | Pink | "John started following you" | Follow Back |

Achievement cards get a subtle gold gradient border (no confetti in MVP).

---

## Page Layout

### Route: `/notifications`

```
┌─────────────────────────────────────────────────┐
│ Notification Header (title + count + actions)   │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Notification Feed                    │
│ All (12) │                                      │
│ Messages │  ── Today ──                         │
│ Sessions │  [Card] Alex sent you a message      │
│ Community│  [Card] Session starts in 30min      │
│ Projects │  [Card] 3 new comments               │
│ Repu-    │                                      │
│  tation  │  ── Yesterday ──                     │
│ Achieve- │  [Card] Maria accepted exchange      │
│  ments   │  [Card] John started following       │
│          │                                      │
│          │  ── Earlier ──                       │
│          │  [Card] Achievement unlocked         │
├──────────┴──────────────────────────────────────┤
│              [Load More]                         │
└─────────────────────────────────────────────────┘
```

### Sidebar Integration

Add to `DashboardSidebar` nav items:
```
🔔 Notifications (3)    ← green badge with unread count
```

Position: Below Messages, above the divider before Communities section. Uses same badge pattern as Messages (`useUnreadNotificationCount()` → green pill).

### Top Bar Dropdown

Bell icon in mobile header bar opens `NotificationDropdown`. Shows 10 most recent unread with quick mark-read. "View All" navigates to `/notifications`.

---

## Routing

### `src/routes/_authenticated/notifications.tsx`

```typescript
// Route definition
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/notifications')({
  component: NotificationsPage,
});
```

**Page component:**
- Uses `useNotifications()` for feed data
- Uses `useUnreadNotificationCount()` for header badge
- Uses `useMarkAllAsRead()` for bulk action
- Renders: NotificationHeader + NotificationSidebar + NotificationFeed
- Sidebar filters feed by category (local state, no re-query)
- Pagination via "Load More" button (cursor-based)

---

## Animations (MVP)

- **Unread badge:** Subtle `animate-gentle-pulse` when count > 0
- **New notification arrives:** Slides in at top of feed with `animate-room-enter`
- **Mark as read:** Smooth opacity transition to muted state
- **Hover:** Cards elevate with `transition-lift`
- **Dropdown open:** Slides down with fade

No confetti, no swipe gestures, no sound effects in MVP.

---

## Mobile

- Full page route works on mobile (sidebar collapses to horizontal scrollable chips)
- Dropdown panel works in mobile header bar
- Cards stack vertically, full width
- Action buttons become icon-only on small screens

---

## Out of Scope (Phase 2+)

- Notification settings panel (enable/disable types, quiet hours, email/push/browser)
- Rich preview cards (project screenshots, message previews)
- Search notifications
- Bulk select mode (checkbox multi-select)
- Notification grouping in DB (currently client-side)
- Smart priority ranking
- Achievement confetti animation
- Notification sounds
- Mobile swipe gestures

---

## Migration File

Single migration: `supabase/migrations/20260725120000_notifications.sql`

Contains:
1. `notifications` table creation
2. Indexes
3. RLS policies
4. All trigger functions (SECURITY DEFINER)
5. Trigger attachments
6. Realtime configuration

---

## Files to Create/Modify

### New Files
1. `supabase/migrations/20260725120000_notifications.sql` — DB schema + triggers
2. `src/hooks/use-notifications.ts` — All hooks
3. `src/components/tethyr/notifications/notification-card.tsx`
4. `src/components/tethyr/notifications/notification-feed.tsx`
5. `src/components/tethyr/notifications/notification-sidebar.tsx`
6. `src/components/tethyr/notifications/notification-dropdown.tsx`
7. `src/components/tethyr/notifications/notification-header.tsx`
8. `src/components/tethyr/notifications/notification-empty.tsx`
9. `src/routes/_authenticated/notifications.tsx` — Page route

### Modified Files
1. `src/components/tethyr/dashboard-sidebar.tsx` — Add Notifications nav item with badge
2. `src/components/tethyr/authenticated-shell.tsx` — Add bell icon + dropdown to mobile header

---

## Verification

After implementation:
1. `npx tsc --noEmit` — zero errors
2. `npx eslint src/hooks/use-notifications.ts src/components/tethyr/notifications/ src/routes/_authenticated/notifications.tsx` — zero errors
3. Manual test: create a message → notification appears in real-time
4. Manual test: mark as read → badge count decrements
5. Manual test: mark all as read → all badges clear
6. Manual test: category filter shows correct subset
7. Manual test: dropdown shows recent unread, "View All" navigates to page
