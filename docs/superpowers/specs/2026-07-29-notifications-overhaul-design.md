# Notifications Overhaul — Design Spec

## Problem

Notifications exist in the database and UI but are "decorative" — clicking them does nothing. Action buttons like "Celebrate" are dead clicks with no handler. The notification page lacks category filtering tabs. Users can't navigate from a notification to the related content.

## Solution

Make every notification card clickable with contextual navigation. Add tab-based category filtering to the notifications page. Remove dead action buttons except where inline actions are genuinely distinct from navigation (Accept/Decline on connection requests).

## Navigation Map

| Type | Route | Notes |
|---|---|---|
| `message` | `/messages` | Opens messages; thread partner derived from `actor_id` |
| `comment` / `mention` | Entity route | Navigates to the post/entity; entity_id + entity_type used |
| `session_invite` / `session_update` | `/sessions/$id` | Session detail page |
| `achievement` | `/profile` | User's own profile page |
| `endorsement` | `/u/$handle` | Endorser's profile |
| `project_join` / `project_post` | Project route | Project detail page |
| `connection_request` | `/u/$handle` | Requester's profile |
| `connection_accepted` / `follow` | `/u/$handle` | Actor's profile |

Cards missing a valid `entity_id` show a muted "This item is no longer available" state and don't navigate.

## Category Tabs

The `/notifications` page adds horizontal tabs above the feed:

| Tab | Types Included | Badge |
|---|---|---|
| All | Everything | Total unread |
| Messages | `message` | Unread message count |
| Sessions | `session_invite`, `session_update` | Unread session notifications |
| Community | `comment`, `mention`, `follow` | Unread community |
| Projects | `project_join`, `project_post` | Unread project |
| Reputation | `endorsement`, `connection_request`, `connection_accepted` | Unread reputation |
| Achievements | `achievement` | Unread achievement |

On mobile, tabs scroll horizontally. The existing sidebar (`notification-sidebar.tsx`) stays as secondary navigation on desktop.

## Action Buttons

All action buttons removed except:

| Type | Action | Behavior |
|---|---|---|
| `connection_request` | Accept / Decline | Calls `useRespondConnection()` mutation inline, then navigates |

"Celebrate" button on achievements is removed — clicking the card navigates to `/profile`.

## Component Changes

### `notification-card.tsx`
- Wrap entire card in a clickable element (button or `Link`)
- Accept `onNavigate: (notification: Notification) => void` prop
- Remove `onAction` prop and action button rendering
- Remove action label from `NOTIFICATION_CONFIG`
- Keep connection request Accept/Decline buttons (separate from card click)
- Add disabled/muted state for notifications with missing entities
- Add cursor pointer hover state

### `notification-feed.tsx`
- Accept `onNavigate` prop, pass to each card
- No structural changes

### `routes/_authenticated/notifications.tsx`
- Add tab state (default: "all")
- Import tab UI component from shadcn/ui (Tabs)
- Filter notifications client-side per tab category
- Build route from notification type + entity data
- Handle `onNavigate` for each card
- Handle missing-entity edge case gracefully
- Keep existing error boundary

### `notification-sidebar.tsx`
- No functional changes (still shows unread counts per category)

## Performance

- Tab filtering is client-side (all notifications already fetched)
- Navigation uses TanStack Router's `navigate()` — no full page reload
- Realtime updates continue working through existing `useNotificationRealtime()` hook
- Entity lookup is instant (no extra query needed — just route construction)

## Edge Cases

- **Notification with null `entity_id` or deleted entity**: Card renders muted state, clicking shows brief "no longer available" message instead of navigating to 404
- **Achievement notification with no `actor_id`**: Navigates to `/profile` (self)
- **Multiple tabs showing same notification**: Each notification appears only in its primary category tab; "All" shows everything
