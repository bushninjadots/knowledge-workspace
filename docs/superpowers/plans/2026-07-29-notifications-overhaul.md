# Notifications Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make notifications clickable with contextual navigation, add category tabs, remove dead action buttons.

**Architecture:** Notification cards become clickable and navigate via a route builder. Action buttons removed except connection_request Accept/Decline. Tabs replace sidebar as primary filter.

**Tech Stack:** React 19, TypeScript, TanStack Router, shadcn/ui Tabs, Supabase

## Global Constraints

- Follow existing code style (existing import patterns, no comments)
- `onNavigate` replaces `onAction` in card/feed props
- Connection request cards keep inline Accept/Decline buttons
- Missing entity notifications show disabled state, don't navigate

---

### Task 1: Make NotificationCard clickable, remove dead actions

**Files:**
- Modify: `src/components/tethyr/notifications/notification-card.tsx`

**Interfaces:**
- Exports: `NotificationCard(props: { notification: Notification; onNavigate?: (notification: Notification) => void })`
- Consumes: `Notification` type from `@/hooks/use-notifications`
- Consumes: `useMarkAsRead`, `useArchiveNotification`, `useDeleteNotification` hooks

- [x] **Step 1: Rewrite NotificationCard with clickable card + connection request actions**

Replace the entire file:

```tsx
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
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMarkAsRead,
  useArchiveNotification,
  useDeleteNotification,
} from "@/hooks/use-notifications";
import { useRespondConnection } from "@/hooks/use-connections";
import type { Notification, NotificationType } from "@/hooks/use-notifications";

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: typeof MessageCircle; color: string }
> = {
  message: { icon: MessageCircle, color: "text-blue-400" },
  connection_request: { icon: UserPlus, color: "text-green-400" },
  connection_accepted: { icon: CheckCircle, color: "text-green-400" },
  session_invite: { icon: CalendarPlus, color: "text-purple-400" },
  session_update: { icon: CalendarClock, color: "text-purple-400" },
  comment: { icon: MessageSquare, color: "text-blue-400" },
  mention: { icon: AtSign, color: "text-orange-400" },
  endorsement: { icon: Star, color: "text-yellow-400" },
  achievement: { icon: Trophy, color: "text-amber-400" },
  project_invite: { icon: FolderPlus, color: "text-green-400" },
  project_join: { icon: Users, color: "text-green-400" },
  project_post: { icon: MessageSquare, color: "text-blue-400" },
  follow: { icon: Heart, color: "text-pink-400" },
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
  onNavigate?: (notification: Notification) => void;
}

export function NotificationCard({ notification, onNavigate }: NotificationCardProps) {
  const markAsRead = useMarkAsRead();
  const archive = useArchiveNotification();
  const deleteNotif = useDeleteNotification();
  const respondConnection = useRespondConnection();

  const config = NOTIFICATION_CONFIG[notification.type];
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const hasEntity = !!notification.entity_id;
  const isConnectionRequest = notification.type === "connection_request";

  function handleMarkRead() {
    markAsRead.mutate([notification.id]);
  }

  function handleArchive() {
    archive.mutate(notification.id);
  }

  function handleDelete() {
    deleteNotif.mutate(notification.id);
  }

  function handleAccept() {
    respondConnection.mutate({ id: notification.entity_id!, status: "accepted" });
    onNavigate?.(notification);
  }

  function handleDecline() {
    respondConnection.mutate({ id: notification.entity_id!, status: "declined" });
  }

  function handleClick() {
    if (!hasEntity && !isConnectionRequest) return;
    if (isUnread) markAsRead.mutate([notification.id]);
    onNavigate?.(notification);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      role={isConnectionRequest ? "article" : "button"}
      tabIndex={isConnectionRequest ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${
        isUnread
          ? "border-l-2 border-l-primary border-border/40 bg-surface-elevated/50"
          : "border-border/40 bg-surface/40 opacity-75 hover:opacity-100"
      } ${!isConnectionRequest ? "cursor-pointer hover:shadow-lifted hover:-translate-y-0.5" : ""} ${!hasEntity && !isConnectionRequest ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface ${config.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium text-foreground">{notification.title}</span>
        </p>
        {notification.body && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">
            {timeAgo(notification.created_at)}
          </span>
          {!hasEntity && !isConnectionRequest && (
            <span className="text-[11px] text-muted-foreground/40 italic">
              No longer available
            </span>
          )}
          {isConnectionRequest && notification.entity_id && (
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-green-500 hover:text-green-400 hover:bg-green-500/10"
                onClick={(e) => { e.stopPropagation(); handleAccept(); }}
              >
                <UserCheck className="mr-1 h-3 w-3" />
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); handleDecline(); }}
              >
                <UserX className="mr-1 h-3 w-3" />
                Decline
              </Button>
            </div>
          )}
        </div>
      </div>

      {isUnread && (
        <div className="absolute right-12 top-4 h-2 w-2 rounded-full bg-primary animate-gentle-pulse" />
      )}

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

- [x] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors (note: `useRespondConnection` needs to exist — check `src/hooks/use-connections.ts`)

- [x] **Step 3: Commit**

```bash
git add src/components/tethyr/notifications/notification-card.tsx
git commit -m "feat: make NotificationCard clickable, remove dead action buttons"
```

---

### Task 2: Update NotificationFeed to pass onNavigate

**Files:**
- Modify: `src/components/tethyr/notifications/notification-feed.tsx`

- [x] **Step 1: Rename `onAction` to `onNavigate` in feed props and usage**

Replace the interface and component:

```tsx
interface NotificationFeedProps {
  notifications: Notification[];
  isLoading: boolean;
  onNavigate?: (n: Notification) => void;
}

export function NotificationFeed({ notifications, isLoading, onNavigate }: NotificationFeedProps) {
  // ... (rest stays the same, just change onAction → onNavigate)
```

Replace the card rendering line:
```tsx
<NotificationCard key={n.id} notification={n} onNavigate={onNavigate} />
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/notifications/notification-feed.tsx
git commit -m "feat: rename onAction to onNavigate in NotificationFeed"
```

---

### Task 3: Add tabs and navigation handler to notifications page

**Files:**
- Modify: `src/routes/_authenticated/notifications.tsx`

- [x] **Step 1: Rewrite the notifications page with tabs + navigation handler**

```tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationSidebar } from "@/components/tethyr/notifications/notification-sidebar";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationType, Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Tethyr" }],
  }),
  component: NotificationsPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Notifications unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ||
            "Unable to load notifications. The notifications service may be temporarily unavailable."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Link to="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  ),
});

const CATEGORY_TYPE_MAP: Record<string, NotificationType[] | null> = {
  all: null,
  message: ["message"],
  session: ["session_invite", "session_update"],
  community: ["comment", "mention", "follow"],
  project: ["project_invite", "project_join", "project_post"],
  reputation: ["endorsement", "connection_request", "connection_accepted"],
  achievement: ["achievement"],
};

const TABS = [
  { key: "all", label: "All" },
  { key: "message", label: "Messages" },
  { key: "session", label: "Sessions" },
  { key: "community", label: "Community" },
  { key: "project", label: "Projects" },
  { key: "reputation", label: "Reputation" },
  { key: "achievement", label: "Achievements" },
] as const;

function useNotificationNavigator() {
  const navigate = useNavigate();

  return function navigateToNotification(n: Notification) {
    switch (n.type) {
      case "message":
        navigate({ to: "/messages" });
        break;
      case "comment":
      case "mention":
        navigate({ to: "/community" });
        break;
      case "session_invite":
      case "session_update":
        if (n.entity_id) {
          navigate({ to: "/sessions/$id", params: { id: n.entity_id } });
        } else {
          navigate({ to: "/sessions" });
        }
        break;
      case "achievement":
        navigate({ to: "/profile" });
        break;
      case "endorsement":
        navigate({ to: "/profile" });
        break;
      case "project_join":
      case "project_post":
        if (n.entity_id) {
          navigate({ to: "/explore" });
        } else {
          navigate({ to: "/explore" });
        }
        break;
      case "connection_request":
      case "connection_accepted":
      case "follow":
        navigate({ to: "/profile" });
        break;
      default:
        toast.info("This notification doesn't have a linked page yet.");
    }
  };
}

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState("all");
  const navigateToNotification = useNotificationNavigator();

  const types = CATEGORY_TYPE_MAP[activeCategory];
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  const notifications =
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <NotificationHeader />
      <div className="mt-6 flex gap-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <NotificationSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <Tabs
            value={activeCategory}
            onValueChange={setActiveCategory}
            className="mb-6"
          >
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="whitespace-nowrap text-xs"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <NotificationFeed
            notifications={notifications}
            isLoading={isLoading}
            onNavigate={navigateToNotification}
          />
        </main>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Verify Tabs component exists**

Check that `src/components/ui/tabs.tsx` exists. If not, create it using shadcn Tabs.

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [x] **Step 4: Run build**

Run: `npm run build`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src/routes/_authenticated/notifications.tsx
git commit -m "feat: add tab navigation and click-to-navigate to notifications page"
```
