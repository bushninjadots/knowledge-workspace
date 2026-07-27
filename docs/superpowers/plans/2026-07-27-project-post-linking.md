# Project-Post Linking Implementation Plan

## Context

Make Projects a first-class part of Community posts. Users attach a Tethyr project or external project (GitHub, Figma, etc.) to any community post, creating bidirectional navigation. Spec: `docs/superpowers/specs/2026-07-27-project-post-linking-design.md`

**Codebase conventions:** Supabase access via `const sb = supabase as any`, query keys pattern, `staleTime: 30_000ms`, profile joining client-side, mutations invalidate via `qc.invalidateQueries()`, toasts via `sonner`, graceful missing-table handling.

---

## Task 1: Migration — Add columns to posts table

Create `supabase/migrations/20260727110000_project_post_linking.sql`

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS feedback_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS posts_project_idx ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS posts_feedback_tags_idx ON public.posts USING GIN(feedback_tags);
```

**Verify:** `supabase db push` or `supabase migration up`

---

## Task 2: Edge Function — fetch-project-preview

Create `supabase/functions/fetch-project-preview/index.ts`

**Input:** `{ url: string }`

**Platform detection:**
- `github.com` → GitHub API `https://api.github.com/repos/{owner}/{repo}`
- `gitlab.com` → GitLab API v4 `https://gitlab.com/api/v4/projects/{encoded_path}`
- `codeberg.org` → Gitea API `https://codeberg.org/api/v1/repos/{owner}/{repo}`
- Everything else → Open Graph scrape (fetch HTML, parse `og:title`, `og:description`, `og:image`)

**Output:** `{ name, description, platform, url, logo, stars?, language?, owner? }`

RLS: Authenticated only. Use Deno.serve pattern (check existing Edge Functions for convention).

**Verify:** Deploy with `supabase functions deploy fetch-project-preview`, test with curl

---

## Task 3: Update types and add useMyProjects hook

**File: `src/hooks/use-community.ts`**

Add to `PostRow` type:
```typescript
project_id: string | null;
project_snapshot: ProjectSnapshot | null;
feedback_tags: string[];
```

Add new type:
```typescript
export type ProjectSnapshot = {
  name: string;
  description: string | null;
  platform: "tethyr" | "github" | "gitlab" | "codeberg" | "figma" | "behance" | "dribbble" | "notion" | "website" | "other";
  url: string;
  logo: string | null;
  status?: string;
  stage?: string;
  stars?: number;
  language?: string;
  owner?: string;
};
```

Add to `CreatePostInput`:
```typescript
project_id?: string | null;
project_snapshot?: ProjectSnapshot | null;
feedback_tags?: string[];
```

Update `useCreatePost` mutation to include `project_id`, `project_snapshot`, `feedback_tags` in the insert.

**File: `src/hooks/use-projects.ts`**

Add new hook:
```typescript
export function useMyProjects() {
  return useQuery({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb
        .from("projects")
        .select("id, title, description, status, stage, cover_url")
        .eq("profile_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as { id: string; title: string; description: string | null; status: string; stage: string; cover_url: string | null }[];
    },
    staleTime: 30_000,
  });
}
```

**Verify:** Typecheck passes

---

## Task 4: Create AttachProjectPanel component

Create `src/components/tethyr/community/attach-project-panel.tsx`

Three tabs:
1. **My Projects** — calls `useMyProjects()`, scrollable list, click to attach
2. **External URL** — URL input, calls Edge Function via `supabase.functions.invoke("fetch-project-preview", ...)`, shows preview card, confirm
3. **Create New** — inline form (name, description), creates project + attaches

Props:
```typescript
type Props = {
  onAttach: (project_id: string | null, snapshot: ProjectSnapshot) => void;
  onRemove: () => void;
  currentAttachment: { project_id?: string; snapshot: ProjectSnapshot } | null;
};
```

Style: `rounded-2xl border border-border/60 bg-background/40 p-3`, compact.

**Verify:** Typecheck, renders in isolation

---

## Task 5: Wire AttachProjectPanel into ComposerBar

**File: `src/components/tethyr/community/composer-bar.tsx`**

Changes:
- Import `Paperclip` icon + `AttachProjectPanel` + `ProjectSnapshot` type
- Add state: `attachedProject: { projectId?: string; snapshot: ProjectSnapshot } | null`
- Read `?attach_project=$id` URL param on mount → fetch project from `projects` table → set as attachment with snapshot
- Add "Attach Project" button (Paperclip icon) in the toolbar row (before the divider + QUICK_ACTIONS)
- Render `AttachProjectPanel` below textarea when panel is open
- Show attachment chip below textarea when attached (project name + X to remove)
- In `submit()`, pass `project_id` and `project_snapshot` to `createPost.mutateAsync()`
- Add `feedback_tags` state: `string[]`, rendered as toggle chips when project is attached
- Include `feedback_tags` in the submit call

**Verify:** Typecheck, manual test: attach Tethyr project, attach external URL, post appears with project card

---

## Task 6: Create ProjectCardInline component

Create `src/components/tethyr/community/project-card-inline.tsx`

Props:
```typescript
type Props = {
  project_id?: string | null;
  project_snapshot?: ProjectSnapshot | null;
};
```

Behavior:
- If `project_id` is set: fetch live from `projects` table via `useQuery`
- If only `snapshot`: render from snapshot data
- Layout: logo (32px rounded-xl) | name + description (2 lines max) | stage badge | "Open Project →" link
- Style: `rounded-2xl border border-border/60 bg-background/40 p-3`
- For `project_id`, link to `/projects/$id`. For external, open in new tab.

**Verify:** Typecheck, renders with mock data

---

## Task 7: Wire ProjectCardInline into PostCard

**File: `src/components/tethyr/community/post-card.tsx`**

Changes:
- Import `ProjectCardInline`
- Render `<ProjectCardInline project_id={post.project_id} project_snapshot={post.project_snapshot} />` between the header and the body (before `<h3>` title)
- Only render when `post.project_id || post.project_snapshot`

**Verify:** Typecheck, posts with attached projects show inline card

---

## Task 8: Create ProjectCommunityPosts component

Create `src/components/tethyr/project/project-community-posts.tsx`

Props: `{ projectId: string }`

Behavior:
- Query `posts` where `project_id = projectId`, ordered by `created_at DESC`, limit 10
- Render as a list of linked community posts (title, author, time, type badge)
- Each item links to `/community` (with anchor or scroll-into-view if possible)
- If no posts, show "No community discussions yet"

Style: `card-border rounded-3xl border bg-surface p-6`

**Verify:** Typecheck, renders on project page

---

## Task 9: Wire ProjectCommunityPosts + Post to Community button into project page

**File: `src/routes/projects.$id.tsx`**

Changes:
- Import `ProjectCommunityPosts` + `useCreatePost` (or just `Link`)
- Add `ProjectCommunityPosts` section below the tab content (always visible, not tab-gated)
- Add "Post to Community" button in the header area (next to status badge), visible to owner/contributors
- Button navigates to `/community?attach_project=${id}` via `<Link>`

**Verify:** Typecheck, project page shows community posts + button

---

## Task 10: Final verification

- Run typecheck: `npx tsc --noEmit` (or project equivalent)
- Run linter if available
- Verify all files compile
- Check that existing post creation still works (no regression)
- Check that `project_discussions` table is untouched

**Verify:** Clean typecheck, no regressions
