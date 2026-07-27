# Project-Post Linking Design Spec

## Goal

Make Projects a first-class part of Community posts. Users can attach a Tethyr project or external project (GitHub, Figma, etc.) to any community post, creating bidirectional navigation between projects and discussions.

## Key Decisions

- **project_discussions stays as-is** — internal team threads (contributor-only). Community post attachments are a separate, public-facing linked list.
- **Both FK and snapshot** — `project_id` for live Tethyr project data, `project_snapshot` jsonb for external projects and offline rendering.
- **Live metadata fetch** — GitHub repos get real-time metadata (name, description, stars, language) via Supabase Edge Function. Other platforms via Open Graph fallback.
- **Feedback tags are optional metadata** — stored as `text[]`, filterable later.

## Architecture

### Data Model

**New migration on `posts` table:**

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS feedback_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS posts_project_idx ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS posts_feedback_tags_idx ON public.posts USING GIN(feedback_tags);
```

**`project_snapshot` jsonb schema:**

```json
{
  "name": "Tethyr",
  "description": "Collaborative network for builders",
  "platform": "tethyr",
  "url": "/projects/abc-123",
  "logo": null,
  "status": "active",
  "stage": "building"
}
```

For external projects:

```json
{
  "name": "tethyr-main",
  "description": "Collaborative network for builders",
  "platform": "github",
  "url": "https://github.com/bushninjadots/tethyr-main",
  "logo": "https://avatars.githubusercontent.com/u/...",
  "stars": 42,
  "language": "TypeScript"
}
```

**`PostRow` type additions:**

```typescript
interface PostRow {
  // ... existing fields ...
  project_id: string | null;
  project_snapshot: ProjectSnapshot | null;
  feedback_tags: string[];
}

interface ProjectSnapshot {
  name: string;
  description: string | null;
  platform: "tethyr" | "github" | "gitlab" | "codeberg" | "figma" | "behance" | "dribbble" | "notion" | "website" | "other";
  url: string;
  logo: string | null;
  // Platform-specific optional fields
  status?: string;
  stage?: string;
  stars?: number;
  language?: string;
  owner?: string;
}
```

### Edge Function: `fetch-project-preview`

**Location:** `supabase/functions/fetch-project-preview/index.ts`

**Input:** `{ url: string }`

**Platform detection:**
- `github.com` → GitHub API (`https://api.github.com/repos/{owner}/{repo}`)
- `gitlab.com` → GitLab API v4 (`https://gitlab.com/api/v4/projects/{encoded_path}`)
- `codeberg.org` → Gitea API (`https://codeberg.org/api/v1/repos/{owner}/{repo}`)
- Everything else → Open Graph scrape (fetch HTML, parse `og:title`, `og:description`, `og:image`)

**Output:**

```json
{
  "name": "tethyr-main",
  "description": "Collaborative network for builders",
  "platform": "github",
  "url": "https://github.com/bushninjadots/tethyr-main",
  "logo": "https://avatars.githubusercontent.com/...",
  "stars": 42,
  "language": "TypeScript",
  "owner": "bushninjadots"
}
```

**RLS:** Authenticated only (`auth.role() = 'authenticated'`).

### Composer Changes

**New component:** `src/components/tethyr/community/attach-project-panel.tsx`

Renders inside ComposerBar when "Attach Project" is clicked. Three tabs:

1. **My Projects** — queries user's projects, shows scrollable list, click to attach
2. **External URL** — URL input, calls Edge Function, shows preview card, confirm to attach
3. **Create New** — inline form (name, description, visibility), creates project + attaches

**ComposerBar modifications:**
- Add "Attach Project" button (Paperclip icon) in the toolbar
- Add `attachedProject` state: `{ projectId?: string; snapshot: ProjectSnapshot } | null`
- Pass `project_id` and `project_snapshot` to `createPost.mutateAsync()`
- Show attachment chip below textarea when project is attached
- Read `?attach_project=$id` URL param on mount to pre-fill attachment

### PostCard Changes

**New component:** `src/components/tethyr/community/project-card-inline.tsx`

Renders above the post body when `project_id` or `project_snapshot` is set.

**Layout:**

```
┌─────────────────────────────────────────────┐
│ [Logo]  Project Name              [Stage]   │
│         Description text (2 lines max)      │
│         12 contributors · Updated 2d ago    │
│                          [Open Project →]   │
└─────────────────────────────────────────────┘
```

**Data resolution:**
- If `project_id` is set: fetch live from `projects` table (always current)
- If only `project_snapshot`: render from snapshot (external projects)

**Styling:** `rounded-2xl border border-border/60 bg-background/40 p-3`, compact, non-dominant.

### Project Page Changes

**New component:** `src/components/tethyr/project/project-community-posts.tsx`

Added to `src/routes/projects.$id.tsx` below existing `ProjectDiscussions`.

Queries `posts` where `project_id = current project`, ordered by `created_at DESC`. Renders as a list of linked community posts. Each item links back to the community feed.

**"Post to Community" button** added to project page header. Navigates to `/community?attach_project=$projectId`.

### Feedback Tags

When a project is attached in the composer, a row of toggle chips appears:

```
Feedback: [UI Design] [Code Review] [Performance] [Architecture] [General]
```

Stored in `posts.feedback_tags`. Optional, not shown if no project attached.

## Files to Create

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260727110000_project_post_linking.sql` | Add columns + indexes to posts |
| `supabase/functions/fetch-project-preview/index.ts` | Edge Function for external URL metadata |
| `src/components/tethyr/community/attach-project-panel.tsx` | 3-tab project attachment panel |
| `src/components/tethyr/community/project-card-inline.tsx` | Inline project card for PostCard |
| `src/components/tethyr/project/project-community-posts.tsx` | Community posts list on project page |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-community.ts` | Add `project_id`, `project_snapshot`, `feedback_tags` to PostRow + CreatePostInput |
| `src/components/tethyr/community/composer-bar.tsx` | Add attach project button, state, chip, URL param reading |
| `src/components/tethyr/community/post-card.tsx` | Import + render ProjectCardInline above post body |
| `src/routes/projects.$id.tsx` | Add ProjectCommunityPosts section + Post to Community button |
| `src/hooks/use-projects.ts` | Add `useMyProjects()` hook |

## Future Architecture

Designed to support without rewriting:
- Version update posts (new `project_snapshot.version` field)
- Development logs (new post type)
- Changelogs (aggregated from posts + milestones)
- Community voting (add to `post_actions`)
- Bug reports / feature requests (new post types)
- Automatic GitHub syncing (background job updating `project_snapshot`)
