# Community-Projects Improvements Design Spec

## Goal

Enhance the existing Community-Projects integration with five improvements: deep-linking to posts, post count badges, project owner notifications, cross-linking discussions, and sharing posts across community spaces.

## Key Decisions

- **Junction table for sharing** — `post_space_shares` links posts to multiple spaces without duplicating data. Unified comment thread preserved.
- **Deep-link via URL params** — `?post=<id>&space=<slug>` on `/community` route, with auto-scroll and highlight.
- **Notification on post creation** — insert notification when `project_id` is set, skip self-notifications.
- **Lightweight cross-linking** — optional `community_post_id` on `project_discussions` table.

---

## Feature 1: Deep-Linking to Specific Posts

### Problem
`ProjectCommunityPosts` links to `/community` but not to the specific post. Users lose context.

### Design
- Add `post` and optional `space` search params to `/community` route
- When `post` param is present:
  1. If `space` param is set, load that space first
  2. Auto-scroll to the target post (ref-based, `scrollIntoView`)
  3. Apply a highlight ring animation (CSS `@keyframes`, fades after 2s)
  4. Clear params via `replaceState` after scrolling
- `ProjectCommunityPosts` links update to `/community?post=<id>&space=<spaceSlug>`

### Files
- `src/components/tethyr/project/project-community-posts.tsx` — update links
- `src/routes/_authenticated/community.tsx` — scroll + highlight logic on mount
- `src/components/tethyr/community/post-card.tsx` — accept `highlighted` prop, render ring

---

## Feature 2: Post Count Badge in Project Hero

### Problem
Project hero shows discussion count but not community post count.

### Design
- Count community posts where `project_id = current project`
- Display badge in project hero: icon + "X community posts"
- Links to `/community` with a project filter (or just the main feed)
- Reuses existing query from `ProjectCommunityPosts`

### Files
- `src/routes/projects.$id.tsx` — add badge in hero section
- `src/components/tethyr/project/project-community-posts.tsx` — export count via a new hook or prop

---

## Feature 3: Project Owner Notifications

### Problem
Project owners don't know when someone posts about their project.

### Design
- After community post creation with `project_id` set:
  1. Fetch project owner's `profile_id` from `projects` table
  2. If owner !== author (no self-notification), insert into `notifications` table
  3. Notification type: `community_post_about_project`
  4. Content: "Someone posted about your project: {post title}"
  5. Link: `/community?post=<post-id>`
- Uses existing notification infrastructure

### Files
- `src/hooks/use-community.ts` — notification insert in `useCreatePost` onSuccess
- Check existing notification types/hook for pattern

---

## Feature 4: Cross-Linking In-Project Discussions ↔ Community Posts

### Problem
`project_discussions` and community `posts` are separate. No way to connect them.

### Design
- Add `community_post_id uuid REFERENCES posts(id) ON DELETE SET NULL` to `project_discussions`
- On `ProjectDiscussions` component: if `community_post_id` is set, show "Also on Community" badge linking to the post
- On `PostCard`: if post has a linked discussion (via reverse lookup or new field), show "Project Discussion" badge
- Manual linking: "Link to Community Post" action in discussion menu (paste URL or search)

### Files
- New migration: add `community_post_id` column
- `src/components/tethyr/project/project-discussions.tsx` — badge + link action
- `src/components/tethyr/community/post-card.tsx` — badge display

---

## Feature 5: Share Existing Discussion to Another Space

### Problem
Conversations start in one community space but are relevant to others. Currently requires reposting.

### Design

#### Data Model — Junction Table

```sql
CREATE TABLE public.post_space_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, space_id)
);

CREATE INDEX post_space_shares_post_idx ON public.post_space_shares(post_id);
CREATE INDEX post_space_shares_space_idx ON public.post_space_shares(space_id);
```

**RLS:** Members of a space can see shared posts in that space. Anyone can share a post to a space they belong to.

#### UI Flow

1. **Share button** on `PostCard` (Share2 icon, next to existing actions)
2. Click opens `ShareSpaceDialog` — lists spaces user is a member of
3. User selects target space → inserts into `post_space_shares`
4. Success toast: "Shared to [Space Name]"

#### Feed Integration

- `useCommunitySpacePosts` query joins `post_space_shares` to include shared posts
- Shared posts render with a "Shared from [Space Name]" badge
- Original author shown, original space linked
- Comments always on original post (unified thread)

#### Home Feed

- Main home feed also includes shared posts from spaces the user belongs to

### Files
- New migration: `post_space_shares` table
- `src/hooks/use-community-spaces.ts` — update space posts query
- `src/components/tethyr/community/post-card.tsx` — share button + shared badge
- New: `src/components/tethyr/community/share-space-dialog.tsx`
- `src/routes/_authenticated/community.tsx` — home feed integration

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260728000000_community_improvements.sql` | post_space_shares table + discussion cross-link column |
| `src/components/tethyr/community/share-space-dialog.tsx` | Space picker for sharing posts |

## Files to Modify

| File | Changes |
|------|---------|
| `src/routes/_authenticated/community.tsx` | Deep-link scroll/highlight, shared posts in home feed |
| `src/components/tethyr/community/post-card.tsx` | Highlight prop, share button, shared badge, discussion link badge |
| `src/components/tethyr/project/project-community-posts.tsx` | Deep-linked URLs, count export |
| `src/routes/projects.$id.tsx` | Post count badge in hero |
| `src/components/tethyr/project/project-discussions.tsx` | Cross-link badge, link action |
| `src/hooks/use-community.ts` | Notification on project post creation |
| `src/hooks/use-community-spaces.ts` | Join on post_space_shares for space feeds |
