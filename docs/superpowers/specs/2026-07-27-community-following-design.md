# Community Following & Spaces — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Author:** Tethyr Dev

---

## Overview

Implement two features that are currently stubbed in the community page:

1. **Following System** — one-way follow relationships so users can curate a personalized feed of posts from people they follow. Coexists with the existing bidirectional connections system.
2. **Community Spaces** — named, moderated spaces where users can create, join, and post within focused groups. Replaces the free-text `community` field on posts with structured entities.

**Build order:** Following first (smaller scope), then Communities. Sequential with a review checkpoint between them.

---

## Phase 1: Following System

### Database

**New table: `follows`**

```sql
CREATE TABLE public.follows (
  follower_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
```

**RLS policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users see their own follows | SELECT | `auth.uid() = follower_id OR auth.uid() = following_id` |
| Users can follow | INSERT | `auth.uid() = follower_id` |
| Users can unfollow | DELETE | `auth.uid() = follower_id` |

No UPDATE policy needed — follows are binary (exists or doesn't).

### Hooks (`src/hooks/use-follow.ts`)

| Hook | Type | Purpose |
|------|------|---------|
| `useFollowStatus(targetUserId)` | Query | Returns `{ isFollowing: boolean }` for the current user → target |
| `useFollowers(userId)` | Query | Returns list of followers for a user (for profile follower count) |
| `useFollowing(userId)` | Query | Returns list of users someone follows (for profile following count) |
| `useFollowUser()` | Mutation | Inserts a follow row. Optimistic update. Invalidates follow status + feed. |
| `useUnfollowUser()` | Mutation | Deletes a follow row. Optimistic update. Invalidates follow status + feed. |
| `useFollowingFeed()` | Query | Fetches posts where `author_id` is in the user's following list. Joins profiles + action stats (reuses `usePosts` join pattern). |

Query keys: `["follow-status", targetUserId]`, `["followers", userId]`, `["following", userId]`, `["following-feed"]`.

### Components

**`FollowButton` (`src/components/tethyr/follow-button.tsx`):**

- Props: `targetUserId: string`, `size?: "sm" | "default"`
- Shows "Follow" (outline variant) or "Following" (default variant) based on `useFollowStatus`
- Hover on "Following" shows "Unfollow" with red styling
- Clicking toggles follow/unfollow with optimistic updates
- Disabled state while mutation is in-flight

### UI Integration

1. **`PostCard`** — Add a small follow button next to the author name/avatar when viewing posts from non-followed users. When already following, show a subtle "Following" badge instead.
2. **`profile.$userId.tsx`** — Add FollowButton next to the connect button in the profile header.
3. **`u.$handle.tsx`** — Same as above for the public profile page.
4. **Community "Following" tab** — Replace the hardcoded `list = []` with `useFollowingFeed()`. Update the empty state to: "You're not following anyone yet. Follow collaborators to see their posts here."

### Migration

Single migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_follows_table.sql`

---

## Phase 2: Community Spaces

### Database

**New enum: `space_member_role`**

```sql
CREATE TYPE public.space_member_role AS ENUM ('owner', 'moderator', 'member');
```

**New table: `community_spaces`**

```sql
CREATE TABLE public.community_spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  avatar_url  text,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spaces_slug ON public.community_spaces(slug);
CREATE INDEX idx_spaces_created_by ON public.community_spaces(created_by);
```

**New table: `community_space_members`**

```sql
CREATE TABLE public.community_space_members (
  space_id  uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      public.space_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX idx_space_members_user ON public.community_space_members(user_id);
```

**RLS policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Spaces are public | SELECT | `true` |
| Authenticated users can create spaces | INSERT | `auth.uid() = created_by` |
| Only creator can update/delete | UPDATE/DELETE | `auth.uid() = created_by` |
| Members can see member list | SELECT on members | User is a member of the space |
| Users can join/leave | INSERT/DELETE on members | `auth.uid() = user_id` |
| Owners/mods can manage members | UPDATE/DELETE on members | User has role `owner` or `moderator` in the space |

### Post Integration

**Migration adds nullable `space_id`:**

```sql
ALTER TABLE public.posts ADD COLUMN space_id uuid REFERENCES public.community_spaces(id) ON DELETE SET NULL;
CREATE INDEX idx_posts_space ON public.posts(space_id);
```

**Backwards compatibility:** The existing `community` text column is kept. A migration creates a "General" space and maps posts with `community != 'General'` to new spaces (orphaned text values are left as-is; only 'General' is migrated).

**RLS update:** Posts remain publicly viewable (existing policy `true`). No space-membership restriction on reading posts — spaces organize content, not gate it.

### Hooks (`src/hooks/use-community-spaces.ts`)

| Hook | Type | Purpose |
|------|------|---------|
| `useCommunitySpaces()` | Query | List all spaces with member counts |
| `useCommunitySpace(slug)` | Query | Single space with current user's membership/role |
| `useCreateSpace()` | Mutation | Creates a space, auto-adds creator as owner |
| `useUpdateSpace()` | Mutation | Updates name/description (owner only) |
| `useDeleteSpace()` | Mutation | Deletes space (owner only) |
| `useJoinSpace()` | Mutation | Adds current user as member |
| `useLeaveSpace()` | Mutation | Removes current user from members |
| `useSpaceMembers(spaceId)` | Query | Member list with roles and profiles |
| `useUpdateMemberRole()` | Mutation | Promotes/demotes members (owner only) |
| `useRemoveMember()` | Mutation | Removes a member (owner/mod only) |
| `usePinPost()` | Mutation | Pins a post to a space (sets `is_pinned` boolean on the post or a separate join table) |
| `useCommunitySpacePosts(spaceId)` | Query | Posts filtered by space_id, with pinned posts first |

### Components

**`CommunityCard` (`src/components/tethyr/community/community-card.tsx`):**

- Shows space name, description (truncated), member count, avatar/icon
- Join/Leave button
- Click navigates to space detail view

**`SpaceHeader` (in the community page feed area):**

- When viewing a space's feed, shows the space name, description, member count
- Settings gear icon for owner/mods → opens edit dialog
- Member list drawer

**`CreateSpaceDialog`:**

- Form: name (generates slug automatically), description
- Submit creates the space and navigates to it

**`SpaceSettingsDialog`:**

- Edit name/description (owner)
- Member management: list members with role badges, promote/demote/remove actions
- Delete space (owner, with confirmation)

**`SpaceMemberBadge`:**

- Small badge showing "Owner" / "Mod" / "Member" on member list entries

### UI Integration

1. **Communities tab** — Shows grid of `CommunityCard` components. "Create Community" button at top. Search/filter bar.
2. **Community detail** — Clicking a card filters the post feed to that space. Shows `SpaceHeader` above the feed. ComposerBar gets a "Post to community" dropdown showing joined spaces.
3. **ComposerBar** — Optional space selector when creating/editing a post.
4. **PostCard** — Shows space name as a chip when the post belongs to a space.

### Migration

Single migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_community_spaces.sql`

---

## Coexistence with Existing Systems

- **Connections** remain untouched. The `connections` table and connection buttons continue to work as they do now. Connections = close collaborators. Follows = casual feed curation.
- **Existing `community` text column** is kept for backwards compatibility. New posts use `space_id`. The "General" space is auto-created as the default.
- **All existing post types, actions, and comments** work unchanged within spaces.

## Error Handling

- Optimistic updates for follow/unfollow (instant UI feedback, rollback on error via React Query)
- Toast notifications on success/failure for all mutations
- Graceful empty states for all new views
- Loading skeletons matching existing patterns

## Testing

- Follow/unfollow toggle works correctly
- Following feed shows only posts from followed users
- Space CRUD works (create, edit, delete)
- Join/leave space works
- Role management (owner/mod/member) enforces permissions correctly
- Posts can be created within spaces
- Space feed filtering works
- Existing functionality (posts, comments, actions, connections) unaffected
