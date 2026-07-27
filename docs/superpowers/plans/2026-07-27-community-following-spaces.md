# Community Following & Spaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a one-way Following system and Community Spaces with moderation, replacing the two stubbed tabs in the community page.

**Architecture:** Two sequential phases. Phase 1 adds a `follows` table and `FollowButton` component, wires it into profiles and post cards, and activates the Following tab. Phase 2 adds `community_spaces` and `community_space_members` tables, community CRUD UI, and space-aware post filtering.

**Tech Stack:** Supabase (PostgreSQL + RLS), TanStack Router, TanStack React Query, Tailwind CSS v4, shadcn/ui components, lucide-react icons, sonner toasts.

## Global Constraints

- All Supabase access via `const sb = supabase as any` cast pattern (types not regenerated)
- Query stale time: `30_000ms`
- Graceful handling of missing tables: check `error.code === "42P01"` and return empty arrays
- All mutations invalidate relevant query keys on success via `useQueryClient().invalidateQueries()`
- Toast notifications on all mutation success/failure via `sonner`
- Optimistic updates for follow/unfollow only (not for community CRUD)
- Existing `community` text column on posts kept for backwards compatibility
- No comments in code unless asked

---

## Phase 1: Following System

### Task 1: Database migration — `follows` table

**Files:**
- Create: `supabase/migrations/20260727000000_add_follows_table.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Follows: one-way follow relationships between users.
-- Coexists with the bidirectional connections system.

CREATE TABLE public.follows (
  follower_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own follows"
  ON public.follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` (or `npx supabase migration up` if preferred)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727000000_add_follows_table.sql
git commit -m "feat(db): add follows table for one-way follow relationships"
```

---

### Task 2: Follow hooks

**Files:**
- Create: `src/hooks/use-follow.ts`

**Interfaces:**
- Consumes: `supabase` client from `@/integrations/supabase/client`
- Produces: `useFollowStatus`, `useFollowers`, `useFollowing`, `useFollowUser`, `useUnfollowUser`, `useFollowingFeed`

- [ ] **Step 1: Create the hooks file with types and query keys**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

const FOLLOW_STATUS_KEY = (userId: string) => ["follow-status", userId] as const;
const FOLLOWERS_KEY = (userId: string) => ["followers", userId] as const;
const FOLLOWING_KEY = (userId: string) => ["following", userId] as const;
const FOLLOWING_FEED_KEY = ["following-feed"] as const;
```

- [ ] **Step 2: Add `useFollowStatus` hook**

```typescript
export function useFollowStatus(targetUserId: string) {
  return useQuery({
    queryKey: FOLLOW_STATUS_KEY(targetUserId),
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return { isFollowing: false };

      const { data, error } = await sb
        .from("follows")
        .select("follower_id")
        .eq("follower_id", me.user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return { isFollowing: false };
        }
        throw error;
      }

      return { isFollowing: !!data };
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Add `useFollowers` and `useFollowing` hooks**

```typescript
export function useFollowers(userId: string) {
  return useQuery({
    queryKey: FOLLOWERS_KEY(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [];
        }
        throw error;
      }

      return data as { follower_id: string; created_at: string }[];
    },
    staleTime: 30_000,
  });
}

export function useFollowing(userId: string) {
  return useQuery({
    queryKey: FOLLOWING_KEY(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [];
        }
        throw error;
      }

      return data as { following_id: string; created_at: string }[];
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Add `useFollowUser` and `useUnfollowUser` mutations**

```typescript
export function useFollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("follows").insert({
        follower_id: me.user.id,
        following_id: targetUserId,
      });

      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      qc.invalidateQueries({ queryKey: FOLLOW_STATUS_KEY(targetUserId) });
      qc.invalidateQueries({ queryKey: FOLLOWING_FEED_KEY });
    },
  });
}

export function useUnfollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("follows")
        .delete()
        .eq("follower_id", me.user.id)
        .eq("following_id", targetUserId);

      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      qc.invalidateQueries({ queryKey: FOLLOW_STATUS_KEY(targetUserId) });
      qc.invalidateQueries({ queryKey: FOLLOWING_FEED_KEY });
    },
  });
}
```

- [ ] **Step 5: Add `useFollowingFeed` hook**

This hook fetches posts from followed users, joining profiles and aggregating action stats — same pattern as `usePosts` in `use-community.ts` but filtered to followed users.

```typescript
import type { PostRow, PostWithAuthor } from "@/hooks/use-community";

export function useFollowingFeed() {
  return useQuery({
    queryKey: FOLLOWING_FEED_KEY,
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [] as PostWithAuthor[];

      // Get list of followed user IDs
      const { data: followRows, error: followError } = await sb
        .from("follows")
        .select("following_id")
        .eq("follower_id", me.user.id);

      if (followError) {
        if (followError.message?.includes("Could not find the table") || followError.code === "42P01") {
          return [] as PostWithAuthor[];
        }
        throw followError;
      }

      const followedIds = (followRows ?? []).map((r: { following_id: string }) => r.following_id);
      if (followedIds.length === 0) return [] as PostWithAuthor[];

      // Fetch posts from followed users
      const { data: rawPosts, error: postsError } = await sb
        .from("posts")
        .select("*")
        .in("author_id", followedIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) {
        if (postsError.message?.includes("Could not find the table") || postsError.code === "42P01") {
          return [] as PostWithAuthor[];
        }
        throw postsError;
      }

      const posts = rawPosts as PostRow[];
      if (posts.length === 0) return [] as PostWithAuthor[];

      // Join profiles
      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, category, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      // Aggregate actions
      const postIds = posts.map((p) => p.id);
      const { data: rawActions } = await sb
        .from("post_actions")
        .select("post_id, action, user_id")
        .in("post_id", postIds);
      const actions = (rawActions ?? []) as { post_id: string; action: string; user_id: string }[];

      const myActions = actions.filter((a) => a.user_id === me.user.id);

      const statsMap = new Map<string, { likes: number; helpful: number; saves: number; offers: number }>();
      for (const a of actions) {
        if (!statsMap.has(a.post_id)) {
          statsMap.set(a.post_id, { likes: 0, helpful: 0, saves: 0, offers: 0 });
        }
        const s = statsMap.get(a.post_id)!;
        if (a.action === "like") s.likes++;
        if (a.action === "helpful") s.helpful++;
        if (a.action === "save") s.saves++;
        if (a.action === "offer") s.offers++;
      }

      return posts.map((p): PostWithAuthor => ({
        ...p,
        author: (profileMap.get(p.author_id) as unknown as NonNullable<PostRow["author"]>) ?? {
          display_name: "Unknown",
          handle: "unknown",
          creator_title: "Member",
          category: "General",
          avatar_url: null,
        },
        stats: statsMap.get(p.id) ?? { likes: 0, helpful: 0, saves: 0, offers: 0 },
        myActions: myActions.filter((a) => a.post_id === p.id).map((a) => a.action),
      }));
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-follow.ts
git commit -m "feat(hooks): add follow/unfollow hooks and following feed query"
```

---

### Task 3: FollowButton component

**Files:**
- Create: `src/components/tethyr/follow-button.tsx`

**Interfaces:**
- Consumes: `useFollowStatus`, `useFollowUser`, `useUnfollowUser` from `@/hooks/use-follow`
- Produces: `FollowButton` component (imported by PostCard, profile pages)

- [ ] **Step 1: Create FollowButton component**

```typescript
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFollowStatus, useFollowUser, useUnfollowUser } from "@/hooks/use-follow";
import { useCurrentUser } from "@/hooks/use-current-user";

export function FollowButton({
  targetUserId,
  size = "default",
}: {
  targetUserId: string;
  size?: "sm" | "default";
}) {
  const { data: me } = useCurrentUser();
  const { data: followData } = useFollowStatus(targetUserId);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const [hovered, setHovered] = useState(false);

  if (!me?.userId || me.userId === targetUserId) return null;

  const isFollowing = followData?.isFollowing ?? false;
  const isLoading = followUser.isPending || unfollowUser.isPending;

  function handleClick() {
    if (isFollowing) {
      unfollowUser.mutate(targetUserId, {
        onSuccess: () => toast.success("Unfollowed"),
        onError: () => toast.error("Failed to unfollow"),
      });
    } else {
      followUser.mutate(targetUserId, {
        onSuccess: () => toast.success("Following!"),
        onError: () => toast.error("Failed to follow"),
      });
    }
  }

  if (isFollowing) {
    return (
      <Button
        size={size}
        variant="default"
        className="rounded-full"
        disabled={isLoading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        {hovered ? "Unfollow" : "Following"}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      className="rounded-full"
      disabled={isLoading}
      onClick={handleClick}
    >
      Follow
    </Button>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/follow-button.tsx
git commit -m "feat(ui): add FollowButton component with hover-to-unfollow"
```

---

### Task 4: Wire FollowButton into PostCard

**Files:**
- Modify: `src/components/tethyr/community/post-card.tsx`

**Interfaces:**
- Consumes: `FollowButton` from `@/components/tethyr/follow-button`
- Produces: No new exports — modifies existing PostCard rendering

- [ ] **Step 1: Add FollowButton import to PostCard**

At the top of `post-card.tsx`, add after the existing imports:

```typescript
import { FollowButton } from "@/components/tethyr/follow-button";
```

- [ ] **Step 2: Add FollowButton to the author header**

In the `PostCard` component, find the `<div className="flex shrink-0 items-center gap-2">` block (around line 236). Add a FollowButton before the owner edit/delete buttons, only when the post author is not the current user:

```tsx
<div className="flex shrink-0 items-center gap-2">
  {!isOwner && <FollowButton targetUserId={post.author_id} size="sm" />}
  {isOwner && (
    <div className="flex items-center gap-1">
      {/* ...existing edit/delete buttons... */}
    </div>
  )}
</div>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/community/post-card.tsx
git commit -m "feat(ui): add FollowButton to community post cards"
```

---

### Task 5: Wire FollowButton into profile pages

**Files:**
- Modify: `src/routes/u.$handle.tsx` (public profile)
- Modify: `src/components/tethyr/profile/profile-layout.tsx` (authenticated profile)

**Interfaces:**
- Consumes: `FollowButton` from `@/components/tethyr/follow-button`

- [ ] **Step 1: Add FollowButton to public profile (`u.$handle.tsx`)**

Add import at the top:

```typescript
import { FollowButton } from "@/components/tethyr/follow-button";
```

Find the action buttons section (around line 291, the `<div className="flex items-center gap-2">` that contains `<ConnectButton>`). Add FollowButton next to ConnectButton:

```tsx
<div className="flex items-center gap-2">
  <FollowButton targetUserId={profile.id} />
  <ConnectButton
    targetId={profile.id}
    targetName={profile.display_name ?? profile.handle}
  />
</div>
```

- [ ] **Step 2: Add FollowButton to authenticated profile layout (`profile-layout.tsx`)**

Add import at the top:

```typescript
import { FollowButton } from "@/components/tethyr/follow-button";
```

Find the ACTION BUTTONS section for public profiles (around line 233, the `{!isOwnProfile && (` block). Add FollowButton alongside the existing Message/Connect/Collaborate buttons:

```tsx
{!isOwnProfile && (
  <div className="mt-4 flex flex-wrap gap-2">
    <FollowButton targetUserId={userId} />
    <Button size="sm" className="rounded-full">
      <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
      Message
    </Button>
    <Button size="sm" variant="outline" className="rounded-full">
      <Users className="mr-1.5 h-3.5 w-3.5" />
      Connect
    </Button>
    <Button size="sm" variant="outline" className="rounded-full">
      <BookOpen className="mr-1.5 h-3.5 w-3.5" />
      Collaborate
    </Button>
  </div>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/u.\$handle.tsx src/components/tethyr/profile/profile-layout.tsx
git commit -m "feat(ui): add FollowButton to profile pages"
```

---

### Task 6: Activate Following tab in community page

**Files:**
- Modify: `src/routes/_authenticated/community.tsx`

**Interfaces:**
- Consumes: `useFollowingFeed` from `@/hooks/use-follow`

- [ ] **Step 1: Add import**

At the top of `community.tsx`, add:

```typescript
import { useFollowingFeed } from "@/hooks/use-follow";
```

- [ ] **Step 2: Add followingFeed query call**

Inside the `CommunityPage` function, after the existing hooks (around line 93), add:

```typescript
const { data: followingFeed = [], isLoading: isLoadingFollowing } = useFollowingFeed();
```

- [ ] **Step 3: Replace the hardcoded `list = []` for following**

In the `feed` useMemo (around line 161-162), replace:

```typescript
} else if (nav === "following") {
  list = [];
```

With:

```typescript
} else if (nav === "following") {
  list = followingFeed;
```

Add `followingFeed` to the useMemo dependency array.

- [ ] **Step 4: Update the Following tab empty state**

In the render section, find the Following empty state (around line 359-364). Replace:

```tsx
) : nav === "following" ? (
  <EmptyState
    icon={<Heart className="h-5 w-5" />}
    title="Following is coming soon"
    description="Once you follow collaborators, their posts will surface here first."
  />
```

With:

```tsx
) : nav === "following" ? (
  isLoadingFollowing ? (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="card-border animate-pulse rounded-3xl border bg-surface p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-surface-elevated" />
              <div className="h-3 w-48 rounded bg-surface-elevated" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : followingFeed.length === 0 ? (
    <EmptyState
      icon={<Heart className="h-5 w-5" />}
      title="You're not following anyone yet"
      description="Follow collaborators to see their posts here. Visit a profile and click Follow to get started."
    />
  ) : (
    <div className="flex flex-col gap-4">
      {followingFeed.map((post, index) => (
        <PostCardWithComments
          key={post.id}
          post={post}
          saved={savedIds.has(post.id)}
          onToggleSave={() => toggleSave(post.id)}
          searchQuery={undefined}
          showComments={openComments.has(post.id)}
          onToggleComments={() => toggleComments(post.id)}
          onDelete={() => deletePostHandler(post.id)}
          onEdit={() => editPost(post)}
          onToggleAction={(action) => handleToggleAction(post.id, action)}
          className="transition-lift animate-stagger"
          style={{ animationDelay: `${index * 60}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  )
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/community.tsx
git commit -m "feat(community): activate Following tab with real feed"
```

---

### Phase 1 Review Checkpoint

Run the dev server (`npm run dev`), navigate to the community page, and verify:

- [ ] Follow button appears on post cards (next to author name)
- [ ] Follow/unfollow toggles correctly with toast notifications
- [ ] Hovering "Following" button shows "Unfollow" text
- [ ] Following tab shows posts from followed users (or empty state with correct message)
- [ ] Follow button appears on public profile pages (`/u/:handle`)
- [ ] Follow button appears on authenticated profile pages (`/profile/:userId`)
- [ ] Own profile does not show a Follow button
- [ ] Typecheck passes clean
- [ ] Build passes (`npm run build`)

**Commit checkpoint:**

```bash
git commit --allow-empty -m "checkpoint: Phase 1 — Following system complete"
```

---

## Phase 2: Community Spaces

### Task 7: Database migration — `community_spaces` + `community_space_members`

**Files:**
- Create: `supabase/migrations/20260727100000_add_community_spaces.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Community Spaces: named, moderated spaces for grouped posts.
-- Replaces the free-text community field on posts with structured entities.

CREATE TYPE public.space_member_role AS ENUM ('owner', 'moderator', 'member');

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

CREATE TABLE public.community_space_members (
  space_id  uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      public.space_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX idx_space_members_user ON public.community_space_members(user_id);

-- Add space_id and is_pinned to posts
ALTER TABLE public.posts ADD COLUMN space_id uuid REFERENCES public.community_spaces(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
CREATE INDEX idx_posts_space ON public.posts(space_id);
CREATE INDEX idx_posts_space_pinned ON public.posts(space_id, is_pinned) WHERE is_pinned = true;

-- RLS for community_spaces
ALTER TABLE public.community_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spaces are publicly readable"
  ON public.community_spaces FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create spaces"
  ON public.community_spaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only creator can update spaces"
  ON public.community_spaces FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Only creator can delete spaces"
  ON public.community_spaces FOR DELETE
  USING (auth.uid() = created_by);

-- RLS for community_space_members
ALTER TABLE public.community_space_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see member list"
  ON public.community_space_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join spaces"
  ON public.community_space_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave spaces"
  ON public.community_space_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners and moderators can manage members"
  ON public.community_space_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "Owners and moderators can remove members"
  ON public.community_space_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'moderator')
    )
  );

-- Create default "General" space and migrate existing posts
INSERT INTO public.community_spaces (name, slug, description, created_by)
VALUES ('General', 'general', 'The default community space for all topics.', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (slug) DO NOTHING;

-- Update posts that had community = 'General' to point to the General space
UPDATE public.posts
SET space_id = (SELECT id FROM public.community_spaces WHERE slug = 'general')
WHERE community = 'General' AND space_id IS NULL;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727100000_add_community_spaces.sql
git commit -m "feat(db): add community_spaces, space_members tables and post integration"
```

---

### Task 8: Community spaces hooks

**Files:**
- Create: `src/hooks/use-community-spaces.ts`

**Interfaces:**
- Consumes: `supabase` client from `@/integrations/supabase/client`
- Produces: All space-related hooks listed below

- [ ] **Step 1: Create types and query keys**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type SpaceMemberRole = "owner" | "moderator" | "member";

export type CommunitySpace = {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
  my_role?: SpaceMemberRole | null;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: SpaceMemberRole;
  joined_at: string;
  profile?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

const SPACES_KEY = ["community-spaces"] as const;
const SPACE_KEY = (slug: string) => ["community-space", slug] as const;
const SPACE_MEMBERS_KEY = (spaceId: string) => ["space-members", spaceId] as const;
const SPACE_POSTS_KEY = (spaceId: string) => ["space-posts", spaceId] as const;
```

- [ ] **Step 2: Add `useCommunitySpaces` hook**

```typescript
export function useCommunitySpaces() {
  return useQuery({
    queryKey: SPACES_KEY,
    queryFn: async () => {
      const { data: spaces, error } = await sb
        .from("community_spaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as CommunitySpace[];
        }
        throw error;
      }

      const { data: me } = await supabase.auth.getUser();

      // Get member counts
      const spaceIds = (spaces ?? []).map((s: CommunitySpace) => s.id);
      const { data: memberCounts } = await sb
        .from("community_space_members")
        .select("space_id")
        .in("space_id", spaceIds);

      const countMap = new Map<string, number>();
      const myMembershipMap = new Map<string, SpaceMemberRole>();
      for (const row of memberCounts ?? []) {
        countMap.set(row.space_id, (countMap.get(row.space_id) ?? 0) + 1);
        if (row.user_id === me.user?.id) {
          // We need role too, fetch separately or join
        }
      }

      // Get current user's memberships
      if (me.user) {
        const { data: myMemberships } = await sb
          .from("community_space_members")
          .select("space_id, role")
          .eq("user_id", me.user.id)
          .in("space_id", spaceIds);

        for (const row of myMemberships ?? []) {
          myMembershipMap.set(row.space_id, row.role as SpaceMemberRole);
        }
      }

      return (spaces ?? []).map((s: CommunitySpace): CommunitySpace => ({
        ...s,
        member_count: countMap.get(s.id) ?? 0,
        is_member: myMembershipMap.has(s.id),
        my_role: myMembershipMap.get(s.id) ?? null,
      }));
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Add `useCommunitySpace` hook (single space by slug)**

```typescript
export function useCommunitySpace(slug: string) {
  return useQuery({
    queryKey: SPACE_KEY(slug),
    queryFn: async () => {
      const { data: space, error } = await sb
        .from("community_spaces")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error || !space) return null as CommunitySpace | null;

      const { data: me } = await supabase.auth.getUser();

      const { count } = await sb
        .from("community_space_members")
        .select("space_id", { count: "exact", head: true })
        .eq("space_id", space.id);

      let myRole: SpaceMemberRole | null = null;
      if (me.user) {
        const { data: membership } = await sb
          .from("community_space_members")
          .select("role")
          .eq("space_id", space.id)
          .eq("user_id", me.user.id)
          .maybeSingle();
        myRole = membership?.role as SpaceMemberRole ?? null;
      }

      return {
        ...space,
        member_count: count ?? 0,
        is_member: !!myRole,
        my_role: myRole,
      } as CommunitySpace;
    },
    staleTime: 30_000,
    enabled: !!slug,
  });
}
```

- [ ] **Step 4: Add CRUD mutations (create, update, delete)**

```typescript
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const slug = slugify(input.name);

      // Check slug uniqueness
      const { data: existing } = await sb
        .from("community_spaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) throw new Error("A space with a similar name already exists");

      const { data: space, error } = await sb
        .from("community_spaces")
        .insert({
          name: input.name,
          slug,
          description: input.description,
          created_by: me.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-add creator as owner
      await sb.from("community_space_members").insert({
        space_id: space.id,
        user_id: me.user.id,
        role: "owner",
      });

      return space as CommunitySpace;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string }) => {
      const { id, ...updates } = input;
      const { error } = await sb
        .from("community_spaces")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { error } = await sb.from("community_spaces").delete().eq("id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}
```

- [ ] **Step 5: Add join/leave mutations**

```typescript
export function useJoinSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("community_space_members").insert({
        space_id: spaceId,
        user_id: me.user.id,
        role: "member",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useLeaveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("community_space_members")
        .delete()
        .eq("space_id", spaceId)
        .eq("user_id", me.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}
```

- [ ] **Step 6: Add member management hooks**

```typescript
export function useSpaceMembers(spaceId: string) {
  return useQuery({
    queryKey: SPACE_MEMBERS_KEY(spaceId),
    queryFn: async () => {
      const { data: members, error } = await sb
        .from("community_space_members")
        .select("space_id, user_id, role, joined_at")
        .eq("space_id", spaceId)
        .order("joined_at", { ascending: true });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as SpaceMember[];
        }
        throw error;
      }

      const userIds = (members ?? []).map((m: SpaceMember) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return (members ?? []).map((m: SpaceMember): SpaceMember => ({
        ...m,
        profile: profileMap.get(m.user_id) as SpaceMember["profile"] ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    staleTime: 30_000,
    enabled: !!spaceId,
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string; role: SpaceMemberRole }) => {
      const { error } = await sb
        .from("community_space_members")
        .update({ role: input.role })
        .eq("space_id", input.spaceId)
        .eq("user_id", input.userId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string }) => {
      const { error } = await sb
        .from("community_space_members")
        .delete()
        .eq("space_id", input.spaceId)
        .eq("user_id", input.userId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}
```

- [ ] **Step 7: Add pin/unpin post hook**

```typescript
export function usePinPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; spaceId: string; isPinned: boolean }) => {
      const { error } = await sb
        .from("posts")
        .update({ is_pinned: input.isPinned })
        .eq("id", input.postId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(variables.spaceId) });
    },
  });
}
```

- [ ] **Step 8: Add space posts hook**

```typescript
import type { PostRow, PostWithAuthor } from "@/hooks/use-community";

export function useCommunitySpacePosts(spaceId: string) {
  return useQuery({
    queryKey: SPACE_POSTS_KEY(spaceId),
    queryFn: async () => {
      const { data: rawPosts, error } = await sb
        .from("posts")
        .select("*")
        .eq("space_id", spaceId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostWithAuthor[];
        }
        throw error;
      }

      const posts = rawPosts as PostRow[];
      if (posts.length === 0) return [] as PostWithAuthor[];

      // Join profiles + actions (same pattern as usePosts)
      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, category, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      const postIds = posts.map((p) => p.id);
      const { data: rawActions } = await sb
        .from("post_actions")
        .select("post_id, action, user_id")
        .in("post_id", postIds);
      const actions = (rawActions ?? []) as { post_id: string; action: string; user_id: string }[];

      const { data: { user } } = await supabase.auth.getUser();
      const myActions = actions.filter((a) => a.user_id === user?.id);

      const statsMap = new Map<string, { likes: number; helpful: number; saves: number; offers: number }>();
      for (const a of actions) {
        if (!statsMap.has(a.post_id)) {
          statsMap.set(a.post_id, { likes: 0, helpful: 0, saves: 0, offers: 0 });
        }
        const s = statsMap.get(a.post_id)!;
        if (a.action === "like") s.likes++;
        if (a.action === "helpful") s.helpful++;
        if (a.action === "save") s.saves++;
        if (a.action === "offer") s.offers++;
      }

      return posts.map((p): PostWithAuthor => ({
        ...p,
        author: (profileMap.get(p.author_id) as unknown as NonNullable<PostRow["author"]>) ?? {
          display_name: "Unknown",
          handle: "unknown",
          creator_title: "Member",
          category: "General",
          avatar_url: null,
        },
        stats: statsMap.get(p.id) ?? { likes: 0, helpful: 0, saves: 0, offers: 0 },
        myActions: myActions.filter((a) => a.post_id === p.id).map((a) => a.action),
      }));
    },
    staleTime: 30_000,
    enabled: !!spaceId,
  });
}
```

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/hooks/use-community-spaces.ts
git commit -m "feat(hooks): add community spaces hooks (CRUD, members, posts)"
```

---

### Task 9: CommunityCard component

**Files:**
- Create: `src/components/tethyr/community/community-card.tsx`

**Interfaces:**
- Consumes: `useJoinSpace`, `useLeaveSpace` from `@/hooks/use-community-spaces`, `CommunitySpace` type
- Produces: `CommunityCard` component

- [ ] **Step 1: Create CommunityCard component**

```typescript
import { Link } from "@tanstack/react-router";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useJoinSpace, useLeaveSpace, type CommunitySpace } from "@/hooks/use-community-spaces";

export function CommunityCard({ space }: { space: CommunitySpace }) {
  const joinSpace = useJoinSpace();
  const leaveSpace = useLeaveSpace();

  function handleToggleMembership(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (space.is_member) {
      leaveSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Left ${space.name}`),
        onError: () => toast.error("Failed to leave"),
      });
    } else {
      joinSpace.mutate(space.id, {
        onSuccess: () => toast.success(`Joined ${space.name}!`),
        onError: () => toast.error("Failed to join"),
      });
    }
  }

  const initial = space.name.charAt(0).toUpperCase();

  return (
    <Link
      to="/community"
      onClick={(e) => {
        // We don't have a dedicated space route yet, so prevent navigation
        // and instead use a custom event or state to filter the feed
        e.preventDefault();
      }}
      className="card-border group flex flex-col rounded-3xl border bg-surface p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-lg font-semibold text-brand-purple">
          {space.avatar_url ? (
            <img src={space.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold group-hover:text-primary">
            {space.name}
          </h3>
          {space.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
        </div>
        <Button
          size="sm"
          variant={space.is_member ? "default" : "outline"}
          className="rounded-full text-xs"
          onClick={handleToggleMembership}
          disabled={joinSpace.isPending || leaveSpace.isPending}
        >
          {space.is_member ? "Joined" : "Join"}
        </Button>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/community-card.tsx
git commit -m "feat(ui): add CommunityCard component with join/leave"
```

---

### Task 10: CreateSpaceDialog component

**Files:**
- Create: `src/components/tethyr/community/create-space-dialog.tsx`

**Interfaces:**
- Consumes: `useCreateSpace` from `@/hooks/use-community-spaces`
- Produces: `CreateSpaceDialog` component

- [ ] **Step 1: Create the dialog component**

```typescript
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateSpace } from "@/hooks/use-community-spaces";

export function CreateSpaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createSpace = useCreateSpace();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createSpace.mutateAsync({ name: name.trim(), description: description.trim() });
      toast.success("Space created!");
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create space";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a community space</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Video Editing, Web Dev, Music Production"
              maxLength={50}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-desc">Description</Label>
            <Textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this space about?"
              rows={3}
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createSpace.isPending}>
              {createSpace.isPending ? "Creating..." : "Create space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/create-space-dialog.tsx
git commit -m "feat(ui): add CreateSpaceDialog for community creation"
```

---

### Task 11: Wire Communities tab in community page

**Files:**
- Modify: `src/routes/_authenticated/community.tsx`

**Interfaces:**
- Consumes: `useCommunitySpaces` from `@/hooks/use-community-spaces`, `CommunityCard`, `CreateSpaceDialog`

- [ ] **Step 1: Add imports**

At the top of `community.tsx`, add:

```typescript
import { Plus } from "lucide-react";
import { useCommunitySpaces } from "@/hooks/use-community-spaces";
import { CommunityCard } from "@/components/tethyr/community/community-card";
import { CreateSpaceDialog } from "@/components/tethyr/community/create-space-dialog";
```

- [ ] **Step 2: Add state and query**

Inside `CommunityPage`, add:

```typescript
const { data: spaces = [], isLoading: isLoadingSpaces } = useCommunitySpaces();
const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
const [spaceSearch, setSpaceSearch] = useState("");
```

- [ ] **Step 3: Replace the Communities tab render**

Find the `nav === "communities"` render block (around line 347-358). Replace with:

```tsx
) : nav === "communities" ? (
  <div>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={spaceSearch}
          onChange={(e) => setSpaceSearch(e.target.value)}
          placeholder="Search spaces..."
          className="h-9 rounded-xl border-border/60 bg-surface pl-9 pr-4 text-sm"
        />
      </div>
      <Button
        size="sm"
        className="rounded-full shrink-0"
        onClick={() => setCreateSpaceOpen(true)}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Create space
      </Button>
    </div>
    {isLoadingSpaces ? (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl border border-border/50 bg-card/60 p-5 h-32"
          />
        ))}
      </div>
    ) : spaces.length === 0 ? (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="No communities yet"
        description="Be the first to create a community space and bring people together."
      />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {spaces
          .filter((s) =>
            spaceSearch.trim()
              ? s.name.toLowerCase().includes(spaceSearch.toLowerCase()) ||
                s.description.toLowerCase().includes(spaceSearch.toLowerCase())
              : true,
          )
          .map((space) => (
            <CommunityCard key={space.id} space={space} />
          ))}
      </div>
    )}
    <CreateSpaceDialog
      open={createSpaceOpen}
      onOpenChange={setCreateSpaceOpen}
    />
  </div>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/community.tsx
git commit -m "feat(community): wire Communities tab with real spaces grid and create dialog"
```

---

### Task 12: SpaceHeader component for space detail view

**Files:**
- Create: `src/components/tethyr/community/space-header.tsx`

**Interfaces:**
- Consumes: `useCommunitySpace`, `useLeaveSpace`, `useSpaceMembers` from `@/hooks/use-community-spaces`
- Produces: `SpaceHeader` component

- [ ] **Step 1: Create SpaceHeader component**

```typescript
import { Users, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCommunitySpace, useLeaveSpace, useSpaceMembers } from "@/hooks/use-community-spaces";
import { useCurrentUser } from "@/hooks/use-current-user";

export function SpaceHeader({
  slug,
  onBack,
  onOpenSettings,
}: {
  slug: string;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const { data: space, isLoading } = useCommunitySpace(slug);
  const { data: me } = useCurrentUser();
  const leaveSpace = useLeaveSpace();
  const { data: members = [] } = useSpaceMembers(space?.id ?? "");

  if (isLoading) {
    return (
      <div className="mb-6 animate-pulse rounded-3xl border border-border/50 bg-surface p-5 h-28" />
    );
  }

  if (!space) return null;

  const isOwner = space.my_role === "owner";
  const isMod = space.my_role === "moderator";

  return (
    <div className="mb-6 card-border rounded-3xl border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-full"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold">{space.name}</h2>
            {(isOwner || isMod) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                onClick={onOpenSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          {space.description && (
            <p className="mt-1 text-sm text-muted-foreground">{space.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {members.length} member{members.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        {space.is_member && space.my_role !== "owner" && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full shrink-0"
            disabled={leaveSpace.isPending}
            onClick={() => {
              leaveSpace.mutate(space.id, {
                onSuccess: () => {
                  toast.success(`Left ${space.name}`);
                  onBack();
                },
                onError: () => toast.error("Failed to leave"),
              });
            }}
          >
            Leave
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/space-header.tsx
git commit -m "feat(ui): add SpaceHeader for community space detail view"
```

---

### Task 13: SpaceSettingsDialog component

**Files:**
- Create: `src/components/tethyr/community/space-settings-dialog.tsx`

**Interfaces:**
- Consumes: `useUpdateSpace`, `useDeleteSpace`, `useSpaceMembers`, `useUpdateMemberRole`, `useRemoveMember` from `@/hooks/use-community-spaces`
- Produces: `SpaceSettingsDialog` component

- [ ] **Step 1: Create SpaceSettingsDialog**

```typescript
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useUpdateSpace,
  useDeleteSpace,
  useSpaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  type CommunitySpace,
  type SpaceMember,
  type SpaceMemberRole,
} from "@/hooks/use-community-spaces";
import { useCurrentUser } from "@/hooks/use-current-user";

const ROLE_LABELS: Record<SpaceMemberRole, string> = {
  owner: "Owner",
  moderator: "Mod",
  member: "Member",
};

const ROLE_OPTIONS: SpaceMemberRole[] = ["moderator", "member"];

export function SpaceSettingsDialog({
  space,
  open,
  onOpenChange,
  onDeleted,
}: {
  space: CommunitySpace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const { data: members = [] } = useSpaceMembers(space.id);
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const { data: me } = useCurrentUser();

  const isOwner = space.my_role === "owner";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSpace.mutateAsync({ id: space.id, name: name.trim(), description: description.trim() });
      toast.success("Space updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update");
    }
  }

  function handleDelete() {
    deleteSpace.mutate(space.id, {
      onSuccess: () => {
        toast.success("Space deleted");
        onOpenChange(false);
        onDeleted?.();
      },
      onError: () => toast.error("Failed to delete"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Space settings</DialogTitle>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={handleSave} className="space-y-4 border-b border-border pb-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} />
            </div>
            <Button type="submit" size="sm" disabled={!name.trim() || updateSpace.isPending}>
              Save changes
            </Button>
          </form>
        )}

        <div className="space-y-3">
          <Label>Members ({members.length})</Label>
          <div className="space-y-2">
            {members.map((member) => (
              <MemberRow
                key={member.user_id}
                member={member}
                isOwner={isOwner}
                currentUserId={me?.userId}
                onRoleChange={(role) => {
                  updateRole.mutate({ spaceId: space.id, userId: member.user_id, role });
                }}
                onRemove={() => {
                  removeMember.mutate(
                    { spaceId: space.id, userId: member.user_id },
                    { onSuccess: () => toast.success("Member removed") },
                  );
                }}
              />
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="border-t border-border pt-4">
            {!confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete space
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive">Are you sure? This cannot be undone.</p>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteSpace.isPending}>
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  isOwner,
  currentUserId,
  onRoleChange,
  onRemove,
}: {
  member: SpaceMember;
  isOwner: boolean;
  currentUserId?: string;
  onRoleChange: (role: SpaceMemberRole) => void;
  onRemove: () => void;
}) {
  const name = member.profile?.display_name || member.profile?.handle || "Unknown";

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-elevated/50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
      </div>
      {isOwner && member.role !== "owner" && member.user_id !== currentUserId && (
        <div className="flex items-center gap-1">
          {ROLE_OPTIONS.filter((r) => r !== member.role).map((role) => (
            <Button
              key={role}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRoleChange(role)}
            >
              → {ROLE_LABELS[role]}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/space-settings-dialog.tsx
git commit -m "feat(ui): add SpaceSettingsDialog for space moderation"
```

---

### Task 14: Wire space filtering into community page

**Files:**
- Modify: `src/routes/_authenticated/community.tsx`
- Modify: `src/lib/community-data.ts`

**Interfaces:**
- Consumes: `useCommunitySpaces`, `useCommunitySpacePosts`, `SpaceHeader`, `SpaceSettingsDialog`

- [ ] **Step 1: Add state for active space**

Inside `CommunityPage`, add:

```typescript
const [activeSpaceSlug, setActiveSpaceSlug] = useState<string | null>(null);
const { data: activeSpace } = useCommunitySpace(activeSpaceSlug ?? "");
const { data: spacePosts = [], isLoading: isLoadingSpacePosts } = useCommunitySpacePosts(activeSpace?.id ?? "");
const [spaceSettingsOpen, setSpaceSettingsOpen] = useState(false);
```

Add imports for the new hooks and components at the top:

```typescript
import { useCommunitySpaces, useCommunitySpace, useCommunitySpacePosts } from "@/hooks/use-community-spaces";
import { SpaceHeader } from "@/components/tethyr/community/space-header";
import { SpaceSettingsDialog } from "@/components/tethyr/community/space-settings-dialog";
```

- [ ] **Step 2: Update CommunityCard to pass click handler**

Replace the `CommunityCard` usage in the Communities tab grid to include an onClick:

```tsx
<CommunityCard
  key={space.id}
  space={space}
  onClick={() => {
    setActiveSpaceSlug(space.slug);
    setNav("home");
  }}
/>
```

This requires adding an `onClick` prop to `CommunityCard`. Update `community-card.tsx` to accept it:

```typescript
export function CommunityCard({
  space,
  onClick,
}: {
  space: CommunitySpace;
  onClick?: () => void;
}) {
  // ... existing code ...
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      className="card-border group flex flex-col rounded-3xl border bg-surface p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
    >
      {/* ... rest unchanged ... */}
    </button>
  );
}
```

Remove the `<Link>` wrapper and replace with `<button>` since we're handling navigation via state.

- [ ] **Step 3: Add space-aware rendering in the feed area**

Before the main feed render block, add a check for active space:

```tsx
{activeSpace && (
  <SpaceHeader
    slug={activeSpaceSlug!}
    onBack={() => setActiveSpaceSlug(null)}
    onOpenSettings={() => setSpaceSettingsOpen(true)}
  />
)}

{activeSpace && spaceSettingsOpen && (
  <SpaceSettingsDialog
    space={activeSpace}
    open={spaceSettingsOpen}
    onOpenChange={setSpaceSettingsOpen}
    onDeleted={() => {
      setActiveSpaceSlug(null);
      setSpaceSettingsOpen(false);
    }}
  />
)}
```

- [ ] **Step 4: Override feed when viewing a space**

In the `feed` useMemo, add an early return for space view:

```typescript
const feed = useMemo(() => {
  // When viewing a specific space, use space posts
  if (activeSpace) return spacePosts;

  let list = posts;
  // ... existing filter logic ...
}, [posts, nav, effectiveTypeFilter, focusFilter, savedIds, searchQuery, sortMode, activeSpace, spacePosts]);
```

- [ ] **Step 5: Update ComposerBar to pass space_id**

Modify the `ComposerBar` to accept an optional `spaceId` prop. In `composer-bar.tsx`:

Add to the component props:

```typescript
spaceId?: string | null;
```

In the submit handler, pass it to the create mutation:

```typescript
community: me?.profile?.category || "General",
space_id: spaceId ?? null,
```

And update `CreatePostInput` in `use-community.ts` to include `space_id`:

```typescript
export type CreatePostInput = {
  // ... existing fields ...
  space_id?: string | null;
};
```

In `useCreatePost`, add `space_id` to the insert:

```typescript
space_id: input.space_id ?? null,
```

- [ ] **Step 6: Pass spaceId from community page to ComposerBar**

When rendering ComposerBar in `community.tsx`, pass the active space:

```tsx
<ComposerBar editingPost={editingPost} onCancelEdit={cancelEdit} spaceId={activeSpace?.id} />
```

- [ ] **Step 7: Update PostRow type to include new fields**

In `use-community.ts`, add to `PostRow`:

```typescript
space_id: string | null;
is_pinned: boolean;
```

- [ ] **Step 8: Remove the hardcoded COMMUNITIES constant**

In `src/lib/community-data.ts`, remove the `COMMUNITIES` export since it's now replaced by real data:

```typescript
// Remove this line:
// export const COMMUNITIES: Community[] = [];
```

Keep the `Community` type for any remaining usage, or remove it if nothing else uses it.

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/routes/_authenticated/community.tsx src/components/tethyr/community/community-card.tsx src/components/tethyr/community/composer-bar.tsx src/hooks/use-community.ts src/lib/community-data.ts
git commit -m "feat(community): wire space filtering, settings, and space-aware posting"
```

---

### Task 15: Add space chip to PostCard

**Files:**
- Modify: `src/components/tethyr/community/post-card.tsx`

**Interfaces:**
- Consumes: `space_id` from `PostRow` (new field)

- [ ] **Step 1: Add space chip to PostCard header**

In the author meta line (around line 223-234), replace the community text chip with a space-aware one:

```tsx
<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
  <span>{authorTitle}</span>
  <span aria-hidden>·</span>
  {post.space_id ? (
    <span className="rounded-full border border-brand-purple/40 bg-brand-purple/10 px-1.5 py-0 text-[10px] uppercase tracking-wider text-brand-purple">
      Space
    </span>
  ) : (
    <span className="rounded-full border border-border/60 px-1.5 py-0 text-[10px] uppercase tracking-wider">
      {post.community}
    </span>
  )}
  <span aria-hidden>·</span>
  <span className="flex items-center gap-1">
    <Clock className="h-3 w-3" />
    {timeAgo(post.created_at)}
  </span>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/post-card.tsx
git commit -m "feat(ui): show space chip on posts belonging to a community space"
```

---

### Phase 2 Review Checkpoint

Run the dev server (`npm run dev`), navigate to the community page, and verify:

- [ ] Communities tab shows a grid of spaces (initially just "General")
- [ ] "Create space" button opens the dialog and creates a space
- [ ] Clicking a space card filters the feed to that space's posts
- [ ] SpaceHeader shows space info, member count, and settings gear (for owner)
- [ ] SpaceSettingsDialog allows editing name/description and managing members
- [ ] Join/Leave buttons on community cards work correctly
- [ ] ComposerBar has a space selector when viewing a space
- [ ] Posts in spaces show the "Space" chip
- [ ] Deleting a space removes it from the grid
- [ ] Typecheck passes clean
- [ ] Build passes (`npm run build`)

**Commit checkpoint:**

```bash
git commit --allow-empty -m "checkpoint: Phase 2 — Community Spaces complete"
```

---

## Summary

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| Phase 1 | 6 tasks | `use-follow.ts`, `follow-button.tsx` | `post-card.tsx`, `u.$handle.tsx`, `profile-layout.tsx`, `community.tsx` |
| Phase 2 | 9 tasks | `use-community-spaces.ts`, `community-card.tsx`, `create-space-dialog.tsx`, `space-header.tsx`, `space-settings-dialog.tsx` | `community.tsx`, `community-card.tsx`, `composer-bar.tsx`, `use-community.ts`, `community-data.ts`, `post-card.tsx` |

**Total:** 15 tasks, 6 new files, 8 modified files, 2 database migrations.
