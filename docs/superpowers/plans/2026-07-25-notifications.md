# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full notification system with a notifications table, trigger-based generation, realtime delivery, a `/notifications` page with sidebar categories, a dropdown panel, and sidebar unread badge.

**Architecture:** PostgreSQL triggers on existing tables insert into a `notifications` table. Supabase Realtime pushes new rows to the client. React hooks manage query/mutation state. A new `/notifications` route renders the page with sidebar categories and a scrollable feed. A dropdown panel in the mobile header provides quick access.

**Tech Stack:** Supabase (PostgreSQL, Realtime, RLS), React Query, TanStack Router, Lucide icons, Tailwind CSS, shadcn/ui (Button, DropdownMenu, ScrollArea, Avatar, Tooltip, Separator).

## Global Constraints

- TypeScript strict mode, no `any` casts unless existing pattern requires it
- Follow existing `log_activity()` SECURITY DEFINER pattern for trigger functions
- Follow existing `use-messages.ts` realtime pattern (useRef channel cleanup, no query key arrays in useEffect deps)
- Follow existing DashboardSidebar badge pattern (green pill with `bg-primary px-2 py-0.5 text-[10px]`)
- Use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;` for idempotent policy/trigger creation
- Use `supabase as any` casting for tables not in generated types (existing pattern)
- Dark theme: brand-green `#7CFF6E`, brand-purple `#A64DFF`, bg `#0E1117`, surface `#151A1F`
- All new files: zero ESLint errors, zero TypeScript errors

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `supabase/migrations/20260725120000_notifications.sql` | Table, indexes, RLS, trigger functions, realtime |
| `src/hooks/use-notifications.ts` | Types, query hooks, mutation hooks, realtime subscription |
| `src/components/tethyr/notifications/notification-card.tsx` | Single notification row with avatar, title, body, actions |
| `src/components/tethyr/notifications/notification-feed.tsx` | Scrollable feed with time grouping and empty state |
| `src/components/tethyr/notifications/notification-sidebar.tsx` | Left sidebar category list with unread counts |
| `src/components/tethyr/notifications/notification-dropdown.tsx` | Top-bar dropdown panel (10 recent unread) |
| `src/components/tethyr/notifications/notification-header.tsx` | Page header with title, unread count, mark-all-read |
| `src/components/tethyr/notifications/notification-empty.tsx` | Empty state illustration |
| `src/routes/_authenticated/notifications.tsx` | Page route composing all components |

### Modified Files
| File | Change |
|---|---|
| `src/components/tethyr/dashboard-sidebar.tsx:26-30` | Add Notifications nav item after Messages |
| `src/components/tethyr/authenticated-shell.tsx:177-193` | Add bell icon + dropdown to mobile header |

---

### Task 1: Database Migration — Table + Indexes + RLS

**Files:**
- Create: `supabase/migrations/20260725120000_notifications.sql`

**Interfaces:**
- Produces: `notifications` table with all columns, 3 indexes, 3 RLS policies, GRANT statements

- [ ] **Step 1: Create the migration file with table, indexes, and RLS**

```sql
-- Notifications system
-- Creates the notifications table, indexes, RLS policies, and trigger functions
-- for generating notifications from existing platform events.

-- ============================================================
-- 1. Notifications table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  archived_at timestamptz,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications(user_id, type);

-- ============================================================
-- 3. Grants
-- ============================================================

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- ============================================================
-- 4. RLS policies
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
```

- [ ] **Step 2: Verify migration syntax**

Run: `grep -c "CREATE TABLE\|CREATE INDEX\|CREATE POLICY" supabase/migrations/20260725120000_notifications.sql`
Expected: `6` (1 table + 3 indexes + 3 policies minus the table = 6 lines with those keywords, but the count confirms all statements are present)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260725120000_notifications.sql
git commit -m "feat(notifications): add notifications table, indexes, and RLS policies"
```

---

### Task 2: Database Migration — Trigger Functions

**Files:**
- Modify: `supabase/migrations/20260725120000_notifications.sql` (append)

**Interfaces:**
- Produces: 9 SECURITY DEFINER trigger functions + trigger attachments + realtime config
- Consumes: existing tables (`messages`, `connections`, `comments`, `session_participants`, `user_achievements`, `skill_endorsements`, `project_contributors`, `profiles`)

- [ ] **Step 1: Append the insert_notification helper function**

Append to the migration file:

```sql
-- ============================================================
-- 5. Helper: insert notification (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id, actor_id, type, title, body, entity_type, entity_id, metadata
  ) VALUES (
    p_user_id, p_actor_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_metadata
  );
END;
$$;
```

- [ ] **Step 2: Append the message notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 6. Trigger: new message → notify recipient
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.insert_notification(
    -- Notify the recipient (not the sender)
    (SELECT connection_id FROM public.connections WHERE id = NEW.connection_id
      AND requester_id <> NEW.sender_id
      UNION
      SELECT connection_id FROM public.connections WHERE id = NEW.connection_id
      AND addressee_id <> NEW.sender_id
      LIMIT 1),
    NEW.sender_id,
    'message',
    COALESCE(_actor_name, 'Someone') || ' sent you a message',
    left(NEW.body, 200),
    'connection',
    NEW.connection_id,
    jsonb_build_object('connection_id', NEW.connection_id, 'message_preview', left(NEW.body, 200))
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_message', 'messages',
  'notify_new_message', 'AFTER', 'INSERT'
);
```

- [ ] **Step 3: Append the connection notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 7. Trigger: connection request/accept → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_connection_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _recipient_id uuid;
  _notif_type text;
  _title text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.requester_id;

  IF TG_OP = 'INSERT' THEN
    -- New connection request → notify addressee
    _recipient_id := NEW.addressee_id;
    _notif_type := 'connection_request';
    _title := COALESCE(_actor_name, 'Someone') || ' wants to connect';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Connection accepted → notify requester
    _recipient_id := NEW.requester_id;
    _notif_type := 'connection_accepted';
    _title := COALESCE(_actor_name, 'Someone') || ' accepted your connection';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_notification(
    _recipient_id,
    NEW.requester_id,
    _notif_type,
    _title,
    NULL,
    'connection',
    NEW.id,
    jsonb_build_object('status', NEW.status)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_connection', 'connections',
  'notify_connection_event', 'AFTER', 'INSERT OR UPDATE'
);
```

- [ ] **Step 4: Append the comment notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 8. Trigger: comment on post → notify post author
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _post_author uuid;
  _post_title text;
BEGIN
  -- Don't notify self
  SELECT author_id, title INTO _post_author, _post_title
  FROM public.posts WHERE id = NEW.post_id;

  IF _post_author = NEW.author_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.author_id;

  PERFORM public.insert_notification(
    _post_author,
    NEW.author_id,
    'comment',
    COALESCE(_actor_name, 'Someone') || ' commented on your post',
    left(NEW.body, 200),
    'post',
    NEW.post_id,
    jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body, 200))
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_comment', 'comments',
  'notify_post_comment', 'AFTER', 'INSERT'
);
```

- [ ] **Step 5: Append the mention notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 9. Trigger: @mention in comment → notify mentioned user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _handle text;
  _mentioned_id uuid;
  _actor_name text;
  _post_title text;
BEGIN
  -- Extract @handle from comment body
  FOR _handle IN SELECT regexp_matches(NEW.body, '@([a-zA-Z0-9_]+)', 'g') LOOP
    SELECT id INTO _mentioned_id FROM public.profiles WHERE handle = _handle[1];
    IF _mentioned_id IS NULL OR _mentioned_id = NEW.author_id THEN CONTINUE; END IF;

    SELECT COALESCE(display_name, handle) INTO _actor_name
    FROM public.profiles WHERE id = NEW.author_id;

    SELECT title INTO _post_title FROM public.posts WHERE id = NEW.post_id;

    PERFORM public.insert_notification(
      _mentioned_id,
      NEW.author_id,
      'mention',
      COALESCE(_actor_name, 'Someone') || ' mentioned you',
      left(NEW.body, 200),
      'post',
      NEW.post_id,
      jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body, 200))
    );
  END LOOP;
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_mention', 'comments',
  'notify_mention', 'AFTER', 'INSERT'
);
```

- [ ] **Step 6: Append the session notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 10. Trigger: session participant change → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_session_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _session_title text;
  _notif_type text;
  _title text;
BEGIN
  SELECT title INTO _session_title FROM public.sessions WHERE id = NEW.session_id;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.profile_id;

  IF TG_OP = 'INSERT' AND NEW.role = 'organizer' THEN
    RETURN NEW; -- Don't notify organizer for their own session
  ELSIF TG_OP = 'INSERT' THEN
    _notif_type := 'session_invite';
    _title := 'You''re invited to: ' || COALESCE(_session_title, 'a session');
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    _notif_type := 'session_update';
    _title := 'Session status updated: ' || COALESCE(_session_title, 'a session');
  ELSE
    RETURN NEW;
  END IF;

  -- Notify the participant (not the organizer)
  PERFORM public.insert_notification(
    NEW.profile_id,
    (SELECT organizer_id FROM public.sessions WHERE id = NEW.session_id),
    _notif_type,
    _title,
    NULL,
    'session',
    NEW.session_id,
    jsonb_build_object('session_title', _session_title, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_session_participant', 'session_participants',
  'notify_session_event', 'AFTER', 'INSERT OR UPDATE'
);
```

- [ ] **Step 7: Append the achievement notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 11. Trigger: achievement unlocked → notify user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.insert_notification(
    NEW.profile_id,
    NULL,
    'achievement',
    'Achievement Unlocked: ' || replace(replace(NEW.achievement::text, '_', ' '), 'E', ''),
    NULL,
    'achievement',
    NULL,
    jsonb_build_object('achievement', NEW.achievement::text)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_achievement', 'user_achievements',
  'notify_achievement', 'AFTER', 'INSERT'
);
```

- [ ] **Step 8: Append the endorsement notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 12. Trigger: endorsement received → notify endorsed user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_endorsement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _skill_name text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.endorsed_by;

  SELECT name INTO _skill_name FROM public.skills WHERE id = NEW.skill_id;

  PERFORM public.insert_notification(
    NEW.profile_id,
    NEW.endorsed_by,
    'endorsement',
    COALESCE(_actor_name, 'Someone') || ' endorsed your ' || COALESCE(_skill_name, 'skill'),
    NULL,
    'skill',
    NEW.skill_id,
    jsonb_build_object('skill_name', _skill_name, 'endorsed_by', NEW.endorsed_by)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_endorsement', 'skill_endorsements',
  'notify_endorsement', 'AFTER', 'INSERT'
);
```

- [ ] **Step 9: Append the project event notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 13. Trigger: project contributor change → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_project_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _project_title text;
  _project_owner uuid;
  _notif_type text;
  _title text;
BEGIN
  IF NEW.role = 'creator' THEN RETURN NEW; END IF;

  SELECT title, profile_id INTO _project_title, _project_owner
  FROM public.projects WHERE id = NEW.project_id;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.profile_id;

  _notif_type := 'project_join';
  _title := COALESCE(_actor_name, 'Someone') || ' joined your project';

  -- Notify project owner
  PERFORM public.insert_notification(
    _project_owner,
    NEW.profile_id,
    _notif_type,
    _title,
    NULL,
    'project',
    NEW.project_id,
    jsonb_build_object('project_title', _project_title)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_project_contributor', 'project_contributors',
  'notify_project_event', 'AFTER', 'INSERT'
);
```

- [ ] **Step 10: Append the follow notification trigger**

Append to the migration file:

```sql
-- ============================================================
-- 14. Trigger: connection accepted → notify as follow
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.requester_id;

  -- Notify addressee that requester is now following
  PERFORM public.insert_notification(
    NEW.addressee_id,
    NEW.requester_id,
    'follow',
    COALESCE(_actor_name, 'Someone') || ' started following you',
    NULL,
    'profile',
    NEW.requester_id,
    jsonb_build_object('requester_id', NEW.requester_id)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_follow', 'connections',
  'notify_follow', 'AFTER', 'UPDATE'
);
```

- [ ] **Step 11: Append Realtime configuration**

Append to the migration file:

```sql
-- ============================================================
-- 15. Enable Realtime on notifications table
-- ============================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/20260725120000_notifications.sql
git commit -m "feat(notifications): add trigger functions for all notification types"
```

---

### Task 3: Hooks — Types + Query Hooks

**Files:**
- Create: `src/hooks/use-notifications.ts`

**Interfaces:**
- Produces: `NotificationType`, `Notification`, `NotificationFilters`, `useNotifications()`, `useUnreadNotificationCount()`, `useNotificationsByCategory()`
- Consumes: `useCurrentUser()` from `src/hooks/use-current-user.ts`, `supabase` from `src/integrations/supabase/client.ts`

- [ ] **Step 1: Create the hooks file with types and query hooks**

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

// ---------- Types ----------

export type NotificationType =
  | "message"
  | "connection_request"
  | "connection_accepted"
  | "session_invite"
  | "session_update"
  | "comment"
  | "mention"
  | "endorsement"
  | "achievement"
  | "project_invite"
  | "project_join"
  | "follow";

export interface Notification {
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

export interface NotificationFilters {
  type?: NotificationType;
  unreadOnly?: boolean;
  archived?: boolean;
}

// ---------- Query keys ----------

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["unreadNotificationCount"] as const;
export const BY_CATEGORY_KEY = ["notificationsByCategory"] as const;

// ---------- Paginated feed ----------

export function useNotifications(
  filters?: NotificationFilters,
  limit = 50,
) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<Notification[]>({
    queryKey: [...NOTIFICATIONS_KEY, meId ?? "anon", filters ?? {}, limit],
    enabled: !!meId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", meId as string)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters?.type) {
        q = q.eq("type", filters.type);
      }
      if (filters?.unreadOnly) {
        q = q.is("read_at", null);
      }
      if (filters?.archived === false || filters?.archived === undefined) {
        q = q.is("archived_at", null);
      } else if (filters?.archived === true) {
        q = q.not("archived_at", "is", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    staleTime: 10_000,
  });
}

// ---------- Unread count ----------

export function useUnreadNotificationCount() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<number>({
    queryKey: [...UNREAD_COUNT_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", meId as string)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 15_000,
  });
}

// ---------- Category counts ----------

export function useNotificationsByCategory() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<Record<string, number>>({
    queryKey: [...BY_CATEGORY_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("type")
        .eq("user_id", meId as string)
        .is("read_at", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.type] = (counts[row.type] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 15_000,
  });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `use-notifications.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat(notifications): add notification query hooks"
```

---

### Task 4: Hooks — Mutation Hooks + Realtime

**Files:**
- Modify: `src/hooks/use-notifications.ts` (append)

**Interfaces:**
- Consumes: types and query keys from Task 3
- Produces: `useMarkAsRead()`, `useMarkAllAsRead()`, `useArchiveNotification()`, `useDeleteNotification()`, realtime subscription effect

- [ ] **Step 1: Append mutation hooks and realtime to the hooks file**

Append to `src/hooks/use-notifications.ts`:

```typescript
// ---------- Mark as read ----------

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Mark all as read ----------

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useMutation({
    mutationFn: async () => {
      if (!meId) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", meId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Archive ----------

export function useArchiveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Delete ----------

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Realtime subscription ----------

export function useNotificationRealtime() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!meId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`notifications:${meId}`);
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${meId}`,
      },
      () => {
        qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
        qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
      },
    );
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meId, qc]);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `use-notifications.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat(notifications): add mutation hooks and realtime subscription"
```

---

### Task 5: Notification Card Component

**Files:**
- Create: `src/components/tethyr/notifications/notification-card.tsx`

**Interfaces:**
- Consumes: `Notification`, `NotificationType` from `use-notifications.ts`
- Produces: `NotificationCard` component, `NOTIFICATION_CONFIG` map (icon, color, action label per type)
- Uses: `Avatar`, `AvatarFallback`, `AvatarImage` from `@/components/ui/avatar`, `Button` from `@/components/ui/button`, `DropdownMenu` + content/trigger/items from `@/components/ui/dropdown-menu`, `Tooltip` + content/trigger from `@/components/ui/tooltip`

- [ ] **Step 1: Create the notification card component**

```typescript
import {
  MessageCircle,
  UserPlus,
  CheckCircle,
  CalendarPlus,
  CalendarClock,
  MessageSquare,
  AtSign,
  Star,
  Trophy,
  FolderPlus,
  Users,
  Heart,
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMarkAsRead, useArchiveNotification, useDeleteNotification } from "@/hooks/use-notifications";
import type { Notification, NotificationType } from "@/hooks/use-notifications";

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: typeof MessageCircle; color: string; actionLabel: string; actionTo?: string }
> = {
  message: { icon: MessageCircle, color: "text-blue-400", actionLabel: "Reply" },
  connection_request: { icon: UserPlus, color: "text-green-400", actionLabel: "View" },
  connection_accepted: { icon: CheckCircle, color: "text-green-400", actionLabel: "View Profile" },
  session_invite: { icon: CalendarPlus, color: "text-purple-400", actionLabel: "View" },
  session_update: { icon: CalendarClock, color: "text-purple-400", actionLabel: "Join Session" },
  comment: { icon: MessageSquare, color: "text-blue-400", actionLabel: "View Thread" },
  mention: { icon: AtSign, color: "text-orange-400", actionLabel: "Reply" },
  endorsement: { icon: Star, color: "text-yellow-400", actionLabel: "View" },
  achievement: { icon: Trophy, color: "text-amber-400", actionLabel: "Celebrate" },
  project_invite: { icon: FolderPlus, color: "text-green-400", actionLabel: "View" },
  project_join: { icon: Users, color: "text-green-400", actionLabel: "View Profile" },
  follow: { icon: Heart, color: "text-pink-400", actionLabel: "Follow Back" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface NotificationCardProps {
  notification: Notification;
  actorName?: string;
  actorAvatar?: string;
  onAction?: (notification: Notification) => void;
}

export function NotificationCard({ notification, actorName, actorAvatar, onAction }: NotificationCardProps) {
  const markAsRead = useMarkAsRead();
  const archive = useArchiveNotification();
  const deleteNotif = useDeleteNotification();

  const config = NOTIFICATION_CONFIG[notification.type];
  const Icon = config.icon;
  const isUnread = !notification.read_at;

  function handleMarkRead() {
    markAsRead.mutate([notification.id]);
  }

  function handleArchive() {
    archive.mutate(notification.id);
  }

  function handleDelete() {
    deleteNotif.mutate(notification.id);
  }

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${
        isUnread
          ? "border-l-2 border-l-primary border-border/40 bg-surface-elevated/50"
          : "border-border/40 bg-surface/40 opacity-75 hover:opacity-100"
      } hover:shadow-lift hover:-translate-y-0.5`}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium text-foreground">{notification.title}</span>
        </p>
        {notification.body && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">{timeAgo(notification.created_at)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-primary hover:text-primary/80"
            onClick={() => onAction?.(notification)}
          >
            {config.actionLabel}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="absolute right-12 top-4 h-2 w-2 rounded-full bg-primary animate-gentle-pulse" />
      )}

      {/* More menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {isUnread && (
            <DropdownMenuItem onClick={handleMarkRead}>
              <Check className="mr-2 h-3.5 w-3.5" />
              Mark as read
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleArchive}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep notification-card`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/notifications/notification-card.tsx
git commit -m "feat(notifications): add notification card component"
```

---

### Task 6: Notification Empty State + Header

**Files:**
- Create: `src/components/tethyr/notifications/notification-empty.tsx`
- Create: `src/components/tethyr/notifications/notification-header.tsx`

**Interfaces:**
- Consumes: `useUnreadNotificationCount()`, `useMarkAllAsRead()` from `use-notifications.ts`
- Produces: `NotificationEmpty`, `NotificationHeader` components
- Uses: `Button` from `@/components/ui/button`, `Bell` + `CheckCheck` from lucide-react, `Link` from `@tanstack/react-router`

- [ ] **Step 1: Create the empty state component**

```typescript
import { Bell, Compass, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function NotificationEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
        <Bell className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-medium text-foreground">You're all caught up</h3>
      <p className="mt-1 text-sm text-muted-foreground">No new notifications right now.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/explore">
            <FolderOpen className="mr-2 h-3.5 w-3.5" />
            Browse Projects
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/community">
            <Compass className="mr-2 h-3.5 w-3.5" />
            Explore Community
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the header component**

```typescript
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadNotificationCount, useMarkAllAsRead } from "@/hooks/use-notifications";

export function NotificationHeader() {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markAllAsRead = useMarkAllAsRead();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {unreadCount} unread
          </span>
        )}
      </div>
      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllAsRead.mutate()}
          disabled={markAllAsRead.isPending}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -E "notification-empty|notification-header"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/notifications/notification-empty.tsx src/components/tethyr/notifications/notification-header.tsx
git commit -m "feat(notifications): add empty state and header components"
```

---

### Task 7: Notification Sidebar Component

**Files:**
- Create: `src/components/tethyr/notifications/notification-sidebar.tsx`

**Interfaces:**
- Consumes: `useNotificationsByCategory()` from `use-notifications.ts`, `NotificationType` type
- Produces: `NotificationSidebar` component, `NOTIFICATION_CATEGORIES` config array
- Props: `{ activeCategory: string; onCategoryChange: (cat: string) => void }`

- [ ] **Step 1: Create the sidebar component**

```typescript
import {
  Inbox,
  MessageCircle,
  Calendar,
  Users,
  FolderOpen,
  Star,
  Trophy,
} from "lucide-react";
import { useNotificationsByCategory } from "@/hooks/use-notifications";

const NOTIFICATION_CATEGORIES = [
  { id: "all", label: "All", icon: Inbox },
  { id: "message", label: "Messages", icon: MessageCircle },
  { id: "session", label: "Sessions", icon: Calendar, matchTypes: ["session_invite", "session_update"] },
  { id: "community", label: "Community", icon: Users, matchTypes: ["comment", "mention", "follow"] },
  { id: "project", label: "Projects", icon: FolderOpen, matchTypes: ["project_invite", "project_join"] },
  { id: "reputation", label: "Reputation", icon: Star, matchTypes: ["endorsement", "connection_request", "connection_accepted"] },
  { id: "achievement", label: "Achievements", icon: Trophy },
] as const;

interface NotificationSidebarProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}

export function NotificationSidebar({ activeCategory, onCategoryChange }: NotificationSidebarProps) {
  const { data: categoryCounts = {} } = useNotificationsByCategory();

  function getCount(cat: (typeof NOTIFICATION_CATEGORIES)[number]): number {
    if (cat.id === "all") {
      return Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    }
    const types = cat.matchTypes ?? [cat.id];
    return types.reduce((sum, t) => sum + (categoryCounts[t] ?? 0), 0);
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {NOTIFICATION_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = getCount(cat);
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              isActive
                ? "bg-surface-elevated text-foreground shadow-soft"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-green to-brand-purple" />
            )}
            <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-brand-green" : ""}`} />
            <span className="min-w-0 flex-1 text-left text-sm font-medium">{cat.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep notification-sidebar`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/notifications/notification-sidebar.tsx
git commit -m "feat(notifications): add notification sidebar with category counts"
```

---

### Task 8: Notification Feed Component

**Files:**
- Create: `src/components/tethyr/notifications/notification-feed.tsx`

**Interfaces:**
- Consumes: `Notification` from `use-notifications.ts`, `NotificationCard` from `notification-card.tsx`, `NotificationEmpty` from `notification-empty.tsx`
- Produces: `NotificationFeed` component
- Props: `{ notifications: Notification[]; isLoading: boolean; onAction?: (n: Notification) => void }`

- [ ] **Step 1: Create the feed component with time grouping**

```typescript
import { NotificationCard } from "./notification-card";
import { NotificationEmpty } from "./notification-empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/hooks/use-notifications";

function groupByTime(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    "Earlier This Week": [],
    Earlier: [],
  };

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (d >= today) {
      groups["Today"].push(n);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(n);
    } else if (d >= weekAgo) {
      groups["Earlier This Week"].push(n);
    } else {
      groups["Earlier"].push(n);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

interface NotificationFeedProps {
  notifications: Notification[];
  isLoading: boolean;
  onAction?: (n: Notification) => void;
}

export function NotificationFeed({ notifications, isLoading, onAction }: NotificationFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/40 p-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return <NotificationEmpty />;
  }

  const groups = groupByTime(notifications);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-3 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            {group.items.map((n) => (
              <NotificationCard key={n.id} notification={n} onAction={onAction} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep notification-feed`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/notifications/notification-feed.tsx
git commit -m "feat(notifications): add notification feed with time grouping"
```

---

### Task 9: Notification Dropdown Component

**Files:**
- Create: `src/components/tethyr/notifications/notification-dropdown.tsx`

**Interfaces:**
- Consumes: `useNotifications()`, `useMarkAllAsRead()`, `useNotificationRealtime()` from `use-notifications.ts`
- Produces: `NotificationDropdown` component
- Uses: `DropdownMenu` + content/trigger from `@/components/ui/dropdown-menu`, `Button` from `@/components/ui/button`, `Bell` from lucide-react, `Link` from `@tanstack/react-router`

- [ ] **Step 1: Create the dropdown component**

```typescript
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, useMarkAllAsRead, useUnreadNotificationCount, useNotificationRealtime } from "@/hooks/use-notifications";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationDropdown() {
  useNotificationRealtime();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications({ unreadOnly: true }, 10);
  const markAllAsRead = useMarkAllAsRead();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full p-2 hover:bg-surface transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground animate-gentle-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          <Link to="/notifications" className="text-xs text-primary hover:underline">
            View All
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">All caught up!</div>
          )}
          {notifications.map((n) => (
            <DropdownMenuItem key={n.id} className="flex items-start gap-3 px-4 py-3 cursor-default">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
        {unreadCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="mr-2 h-3.5 w-3.5" />
                Mark all as read
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep notification-dropdown`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/notifications/notification-dropdown.tsx
git commit -m "feat(notifications): add notification dropdown panel"
```

---

### Task 10: Notifications Page Route

**Files:**
- Create: `src/routes/_authenticated/notifications.tsx`

**Interfaces:**
- Consumes: `useNotifications()`, `useNotificationRealtime()` from `use-notifications.ts`, `NotificationHeader`, `NotificationSidebar`, `NotificationFeed` components
- Produces: `NotificationsPage` component, TanStack Router route definition

- [ ] **Step 1: Create the page route**

```typescript
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationSidebar } from "@/components/tethyr/notifications/notification-sidebar";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import type { NotificationType } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const CATEGORY_TYPE_MAP: Record<string, NotificationType[] | null> = {
  all: null,
  message: ["message"],
  session: ["session_invite", "session_update"],
  community: ["comment", "mention", "follow"],
  project: ["project_invite", "project_join"],
  reputation: ["endorsement", "connection_request", "connection_accepted"],
  achievement: ["achievement"],
};

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState("all");

  const types = CATEGORY_TYPE_MAP[activeCategory];
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  // For multi-type categories, filter client-side
  const notifications =
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <NotificationHeader />
      <div className="mt-6 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 md:block">
          <NotificationSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </aside>

        {/* Feed */}
        <main className="min-w-0 flex-1">
          <NotificationFeed
            notifications={notifications}
            isLoading={isLoading}
          />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep notifications`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/notifications.tsx
git commit -m "feat(notifications): add notifications page route"
```

---

### Task 11: Sidebar Integration — Add Notifications Nav Item

**Files:**
- Modify: `src/components/tethyr/dashboard-sidebar.tsx`

**Interfaces:**
- Consumes: `useUnreadNotificationCount()` from `use-notifications.ts`
- Modifies: `rooms` array (line 22-30) to add Notifications entry, badge logic (line 104-105)

- [ ] **Step 1: Add Bell import and useUnreadNotificationCount import**

In `dashboard-sidebar.tsx`, add `Bell` to the lucide-react import and add the notifications import:

```typescript
import {
  Home,
  FolderOpen,
  Compass,
  GraduationCap,
  Users,
  MessageSquare,
  Trophy,
  Settings,
  LogOut,
  Search,
  Bell,
} from "lucide-react";
```

Add after the `useUnreadCounts` import:

```typescript
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
```

- [ ] **Step 2: Add Notifications to the rooms array**

Insert after the Messages entry (line 26):

```typescript
{ to: "/notifications", label: "Notifications", sub: "Activity feed", icon: Bell, live: true },
```

- [ ] **Step 3: Add notification unread count hook and badge logic**

After `const { data: unread } = useUnreadCounts();` (line 35), add:

```typescript
const { data: notifUnread = 0 } = useUnreadNotificationCount();
```

Replace the badge logic (lines 104-105):

```typescript
const badge =
  room.label === "Messages" && unread && unread.total > 0
    ? unread.total
    : room.label === "Notifications" && notifUnread > 0
      ? notifUnread
      : null;
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep dashboard-sidebar`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tethyr/dashboard-sidebar.tsx
git commit -m "feat(notifications): add notifications nav item with unread badge to sidebar"
```

---

### Task 12: Mobile Header — Add Bell Icon + Dropdown

**Files:**
- Modify: `src/components/tethyr/authenticated-shell.tsx`

**Interfaces:**
- Consumes: `NotificationDropdown` from `notification-dropdown.tsx`
- Modifies: Mobile header bar (lines 177-193) to add bell icon between Search and end

- [ ] **Step 1: Add NotificationDropdown import**

```typescript
import { NotificationDropdown } from "./notifications/notification-dropdown";
```

- [ ] **Step 2: Add bell icon to mobile header**

After the Search button (line 192) and before the closing `</header>` tag, add:

```typescript
<NotificationDropdown />
```

The mobile header section becomes:

```typescript
<header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6 md:hidden">
  <button
    className="rounded-full p-2 hover:bg-surface"
    onClick={() => setOpen(true)}
    aria-label="Open menu"
  >
    <Menu className="h-5 w-5" />
  </button>
  <span className="font-display text-sm font-semibold">Tethyr</span>
  <div className="ml-auto flex items-center gap-1">
    <NotificationDropdown />
    <button
      className="rounded-full p-2 hover:bg-surface"
      onClick={() => setSearchOpen(true)}
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  </div>
</header>
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep authenticated-shell`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/authenticated-shell.tsx
git commit -m "feat(notifications): add bell icon and dropdown to mobile header"
```

---

### Task 13: Final Verification

**Files:**
- All files created/modified in Tasks 1-12

**Interfaces:**
- None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run ESLint on all notification files**

Run: `npx eslint src/hooks/use-notifications.ts src/components/tethyr/notifications/ src/routes/_authenticated/notifications.tsx src/components/tethyr/dashboard-sidebar.tsx src/components/tethyr/authenticated-shell.tsx`
Expected: Zero errors

- [ ] **Step 3: Run Prettier on all notification files**

Run: `npx prettier --write src/hooks/use-notifications.ts src/components/tethyr/notifications/ src/routes/_authenticated/notifications.tsx`
Expected: Files formatted

- [ ] **Step 4: Run TypeScript check again after formatting**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Commit formatting changes if any**

```bash
git add -A
git commit -m "chore(notifications): format and lint notification files"
```
