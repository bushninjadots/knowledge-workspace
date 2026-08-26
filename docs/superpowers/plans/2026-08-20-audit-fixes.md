# Tethyr Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 78 audit findings from the 2026-08-20 full site audit, prioritized by severity.

**Architecture:** Grouped into 10 parallel batches by domain and severity. Each batch is self-contained and can be dispatched to a subagent. Batches are ordered so security/UX P0s land first, then accessibility, then performance, then P1s, P2s, and P3s.

**Tech Stack:** React 19, TanStack Router, Supabase, Tailwind CSS 4, Radix UI, Deno edge functions, Vitest

## Global Constraints

- TypeScript strict mode — no `as any`, no `@ts-ignore`
- Tailwind CSS 4 — use existing design tokens (`bg-surface`, `bg-surface-elevated`, etc.)
- Border radius scale: `rounded-md` (inputs), `rounded-lg`/`rounded-xl` (cards), `rounded-full` (avatars/tags)
- Shadow scale: `shadow-sm` → `shadow-md` → `shadow-lg` (max for overlays)
- All queries must have `.limit()` — no unbounded fetches
- All interactive elements must have accessible names
- Each nav landmark must have a unique `aria-label`

---

## Batch 1 — P0 Security (2 tasks)

### Task 1: Fix edge function SSRF

**Files:**

- Modify: `supabase/functions/fetch-project-preview/index.ts`

- [ ] **Step 1: Add URL validation and SSRF protection**

Add a helper function before the `serve` call that blocks private IPs, localhost, and non-HTTPS URLs:

```typescript
function isSafeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    // Block localhost, private IPs, link-local, cloud metadata
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("169.254.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Apply validation to the OG fallback path**

Replace the OG fallback block (lines 112-143) with:

```typescript
// Open Graph fallback for everything else (only for safe URLs)
if (!result) {
  if (!isSafeUrl(url)) {
    const hostname = new URL(url).hostname.replace("www.", "");
    result = {
      name: hostname,
      description: null,
      platform: "other",
      url,
      logo: null,
    };
  } else {
    try {
      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Tethyr/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      const html = await pageRes.text();

      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
      const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
      const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);

      const hostname = new URL(url).hostname.replace("www.", "");

      result = {
        name: ogTitle?.[1] ?? hostname,
        description: ogDesc?.[1] ?? null,
        platform: "website",
        url,
        logo: ogImage?.[1] ?? null,
      };
    } catch {
      const hostname = new URL(url).hostname.replace("www.", "");
      result = {
        name: hostname,
        description: null,
        platform: "other",
        url,
        logo: null,
      };
    }
  }
}
```

- [ ] **Step 3: Also validate GitHub/GitLab/Codeberg URLs before fetching**

Add `isSafeUrl(url)` check before each platform API fetch. If the user-supplied URL doesn't match the expected platform pattern, skip the API call (it'll fall through to OG or default).

- [ ] **Step 4: Fix CORS (S3) and error leakage (S4)**

Replace:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

With:

```typescript
const ALLOWED_ORIGIN = Deno.env.get("SITE_URL") ?? "https://tethyr.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Replace the error catch (lines 149-153):

```typescript
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
```

With:

```typescript
  } catch (err) {
    console.error("fetch-project-preview error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch preview" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
```

- [ ] **Step 5: Verify**

No tests exist for edge functions. Manual: confirm the function still fetches GitHub/GitLab/Codeberg previews correctly and blocks `http://169.254.169.254/` URLs.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/fetch-project-preview/index.ts
git commit -m "fix(security): block SSRF, restrict CORS, hide error details in edge function"
```

---

### Task 2: Rotate keys and confirm .env cleanup

**Files:**

- None (manual verification)

- [ ] **Step 1: Check if the old Supabase project/key from commit 784841a is still active**

```bash
git show 784841a -- .env | head -5
```

If the keys are for a different/old project, confirm they're deactivated. If still active, rotate them in the Supabase dashboard.

- [ ] **Step 2: Add .env to .gitignore if not already present**

```bash
grep -q '\.env' .gitignore && echo "already ignored" || echo '.env' >> .gitignore
```

- [ ] **Step 3: Commit if .gitignore was modified**

```bash
git add .gitignore
git commit -m "fix(security): ensure .env is gitignored"
```

---

## Batch 2 — P0 Accessibility (5 tasks)

### Task 3: Add skip navigation link (A1)

**Files:**

- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add skip link as first element in RootShell**

In `RootShell`, add a skip link as the first child inside `<body>`:

```tsx
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
        >
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add `id="main-content"` to the `<main>` in authenticated-shell.tsx**

In `src/components/tethyr/authenticated-shell.tsx:108`, change:

```tsx
<main className="flex-1 pb-16 md:pb-0">
```

To:

```tsx
<main id="main-content" className="flex-1 pb-16 md:pb-0">
```

- [ ] **Step 3: Also add id to notifications.tsx main**

In `src/routes/_authenticated/notifications.tsx:113`, change:

```tsx
<main className="mt-6 min-w-0">
```

To:

```tsx
<main id="main-content" className="mt-6 min-w-0">
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/__root.tsx src/components/tethyr/authenticated-shell.tsx src/routes/_authenticated/notifications.tsx
git commit -m "fix(a11y): add skip navigation link as first focusable element"
```

---

### Task 4: Add aria-pressed to follow button (A2)

**Files:**

- Modify: `src/components/tethyr/follow-button.tsx`

- [ ] **Step 1: Add aria-pressed to both Button instances**

On line 42 (Following button), add `aria-pressed={true}`:

```tsx
<Button
  size={size}
  variant="default"
  className="rounded-full"
  disabled={isLoading}
  aria-pressed={true}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  onClick={handleClick}
>
```

On line 57 (Follow button), add `aria-pressed={false}`:

```tsx
<Button
  size={size}
  variant="outline"
  className="rounded-full"
  disabled={isLoading}
  aria-pressed={false}
  onClick={handleClick}
>
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/follow-button.tsx
git commit -m "fix(a11y): add aria-pressed to follow/unfollow toggle button"
```

---

### Task 5: Add aria-label to Progress component (A3)

**Files:**

- Modify: `src/components/ui/progress.tsx`

- [ ] **Step 1: Accept and forward aria-label**

The Progress component already spreads `...props` which includes any `aria-label` passed by callers. No change needed to the component itself — callers must pass `aria-label`.

Check all usages:

```bash
grep -rn "Progress" src/ --include="*.tsx" | grep -v "progress.tsx" | grep -v "node_modules"
```

Add `aria-label` to each usage that doesn't already have one. Example pattern:

```tsx
<Progress value={75} aria-label="Profile completion: 75%" />
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/progress.tsx
git commit -m "fix(a11y): add aria-label to Progress component"
```

---

### Task 6: Add aria-label to nav landmarks (A4, A16)

**Files:**

- Modify: `src/components/tethyr/community/left-sidebar.tsx`

- [ ] **Step 1: Add aria-label to the nav in left-sidebar.tsx**

On line 39, change:

```tsx
<nav className="flex flex-col gap-5 rounded-xl bg-surface-elevated/30 p-3">
```

To:

```tsx
<nav aria-label="Community navigation" className="flex flex-col gap-5 rounded-xl bg-surface-elevated/30 p-3">
```

- [ ] **Step 2: Verify all nav landmarks have unique aria-labels**

Run:

```bash
grep -rn "<nav" src/ --include="*.tsx" | grep -v "node_modules"
```

Ensure every `<nav>` has a unique `aria-label`. The navbar already has `aria-label="Main navigation"`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/community/left-sidebar.tsx
git commit -m "fix(a11y): add aria-label to community sidebar nav landmark"
```

---

### Task 7: Add labels to Create Challenge dialog (A5)

**Files:**

- Modify: `src/components/tethyr/community/create-challenge-dialog.tsx`

- [ ] **Step 1: Add aria-label to each input**

Replace the form inputs with labeled versions:

```tsx
<Input
  placeholder="Title"
  aria-label="Challenge title"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
/>
<Textarea
  placeholder="Description"
  aria-label="Challenge description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={3}
/>
```

For the Select components, add `aria-label` to each `SelectTrigger`:

```tsx
<SelectTrigger aria-label="Challenge type">
```

```tsx
<SelectTrigger aria-label="Difficulty level">
```

For the remaining inputs:

```tsx
<Input
  placeholder="Skills (comma-separated)"
  aria-label="Skills, comma-separated"
  value={skills}
  onChange={(e) => setSkills(e.target.value)}
/>
<Input
  placeholder="Max participants (optional)"
  aria-label="Maximum participants"
  type="number"
  min="1"
  value={maxParticipants}
  onChange={(e) => setMaxParticipants(e.target.value)}
/>
<Textarea
  placeholder="Pass criteria (optional) — what must a submission include to pass? e.g. working demo + 3 commits + short write-up"
  aria-label="Pass criteria"
  value={passCriteria}
  onChange={(e) => setPassCriteria(e.target.value)}
  rows={2}
/>
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/community/create-challenge-dialog.tsx
git commit -m "fix(a11y): add aria-labels to all Create Challenge dialog inputs"
```

---

## Batch 3 — P0 Performance (3 tasks)

### Task 8: Add .limit(50) to useCurrentUser projects query (P1)

**Files:**

- Modify: `src/hooks/use-current-user.ts`

- [ ] **Step 1: Add limit to the projects query**

On lines 152-158, change:

```typescript
      safeQuery(
        () =>
          supabase
            .from("projects")
            .select("*")
            .eq("profile_id", userId)
            .order("is_featured", { ascending: false })
            .order("created_at", { ascending: false }),
        { data: [], error: null },
      ),
```

To:

```typescript
      safeQuery(
        () =>
          supabase
            .from("projects")
            .select("id, title, description, status, stage, cover_url, is_featured, created_at, updated_at, repo_url, demo_url, profile_id")
            .eq("profile_id", userId)
            .order("is_featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(50),
        { data: [], error: null },
      ),
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-current-user.ts
git commit -m "perf: add .limit(50) and explicit columns to useCurrentUser projects query"
```

---

### Task 9: Add .limit(50) to useMyProjects (P2)

**Files:**

- Modify: `src/hooks/use-projects.ts`

- [ ] **Step 1: Add limit**

On lines 873-877, add `.limit(50)`:

```typescript
const { data, error } = await sb
  .from("projects")
  .select("id, title, description, status, stage, cover_url")
  .eq("profile_id", user.id)
  .order("updated_at", { ascending: false })
  .limit(50);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-projects.ts
git commit -m "perf: add .limit(50) to useMyProjects query"
```

---

### Task 10: Add .limit(100) to useCommunitySpaces (P3)

**Files:**

- Modify: `src/hooks/use-community-spaces.ts`

- [ ] **Step 1: Add limit**

On lines 70-73, add `.limit(100)`:

```typescript
const { data: spaces, error } = await sb
  .from("community_spaces")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(100);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-community-spaces.ts
git commit -m "perf: add .limit(100) to useCommunitySpaces query"
```

---

## Batch 4 — P1 Security (1 task)

### Task 11: Fix project_repositories RLS and access_token exposure (S5, S6)

**Files:**

- Check: `supabase/migrations/` for the latest migration

- [ ] **Step 1: Create a new migration to fix RLS**

```bash
ls supabase/migrations/ | tail -3
```

Create a new migration file (number based on the last one):

```sql
-- Fix project_repositories public-read policy for private projects (S6)
DROP POLICY IF EXISTS "Public can view project repositories" ON public.project_repositories;

CREATE POLICY "Public can view project repositories"
  ON public.project_repositories
  FOR SELECT
  USING (
    public.is_project_visible(project_id)
  );

-- Exclude access_token from client queries (S5)
-- Create a view that excludes the token column
CREATE OR REPLACE VIEW public.project_repositories_safe AS
  SELECT id, project_id, provider, repo_url, created_at, updated_at
  FROM public.project_repositories;
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "fix(security): restrict project_repositories RLS, exclude access_token from client view"
```

---

## Batch 5 — P1 UX (5 tasks)

### Task 12: Fix border radius violations (U1, U2)

**Files:**

- Modify: `src/routes/index.tsx`
- Modify: `src/components/tethyr/team/team-page.tsx`

- [ ] **Step 1: Fix CTA radius**

In `src/routes/index.tsx:250`, change:

```
rounded-[2.5rem]
```

To:

```
rounded-xl
```

- [ ] **Step 2: Fix team avatar radius**

In `src/components/tethyr/team/team-page.tsx:281`, change:

```
rounded-2xl
```

To:

```
rounded-full
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx src/components/tethyr/team/team-page.tsx
git commit -m "fix(design): align border radius to design system scale"
```

---

### Task 13: Fix shadow-2xl on overlays (U3)

**Files:**

- Modify: `src/components/tethyr/global-search.tsx`
- Modify: `src/components/tethyr/project-shelf/project-shelf-overlay.tsx`
- Modify: `src/components/tethyr/project/project-join-modal.tsx`

- [ ] **Step 1: Replace shadow-2xl with shadow-lg**

In each file, replace `shadow-2xl` with `shadow-lg`:

```bash
grep -rn "shadow-2xl" src/ --include="*.tsx"
```

Then edit each match.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/global-search.tsx src/components/tethyr/project-shelf/project-shelf-overlay.tsx src/components/tethyr/project/project-join-modal.tsx
git commit -m "fix(design): reduce shadow-2xl to shadow-lg on custom overlays"
```

---

### Task 14: Replace font-title with font-display (U4)

**Files:**

- Modify: 8 files (see grep results)

- [ ] **Step 1: Replace all font-title with font-display**

```bash
grep -rln "font-title" src/ --include="*.tsx" | xargs sed -i 's/font-title/font-display/g'
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(design): replace font-title with font-display for consistency"
```

---

### Task 15: Remove duplicate inline error components (U5)

**Files:**

- Modify: `src/routes/_authenticated/community.tsx`
- Modify: `src/routes/_authenticated/messages.tsx`
- Modify: `src/routes/_authenticated/dashboard.tsx`

- [ ] **Step 1: Replace inline error components with the shared ErrorComponent**

Each of these files has an inline `errorComponent` that duplicates the root `ErrorComponent` in `__root.tsx`. Remove the inline `errorComponent` from each route definition.

The routes will then inherit the root `errorComponent` automatically via TanStack Router's error boundary propagation.

In `community.tsx`, remove lines 48-70 (the `errorComponent` function).
In `messages.tsx`, remove lines 31-56.
In `dashboard.tsx`, remove lines 51-59.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/community.tsx src/routes/_authenticated/messages.tsx src/routes/_authenticated/dashboard.tsx
git commit -m "fix(design): remove duplicate inline error components, inherit from root"
```

---

## Batch 6 — P1 Code Quality (4 tasks)

### Task 16: Consolidate duplicate types (C1)

**Files:**

- Modify: `src/hooks/use-current-user.ts`
- Modify: `src/components/tethyr/profile-sections.tsx`

- [ ] **Step 1: Remove duplicate type definitions from profile-sections.tsx**

The types `SkillVerificationLevel` and `SkillExperienceLevel` are defined in both files. Keep them in `use-current-user.ts` (the canonical source) and import from there in `profile-sections.tsx`.

In `profile-sections.tsx`, remove the local type definitions and add:

```typescript
import type { SkillVerificationLevel, SkillExperienceLevel } from "@/hooks/use-current-user";
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-current-user.ts src/components/tethyr/profile-sections.tsx
git commit -m "fix(code): consolidate duplicate SkillVerificationLevel and SkillExperienceLevel types"
```

---

### Task 17: Remove dead re-export (C2)

**Files:**

- Modify: `src/hooks/use-current-user.ts`

- [ ] **Step 1: Remove unused re-exports**

On lines 7 and 9, remove:

```typescript
import type { ProjectRow, ActivityRow } from "@/components/tethyr/profile-sections";

export type { ProjectRow, ActivityRow };
```

Replace with nothing. Then check if anything imports `ProjectRow` or `ActivityRow` from this file:

```bash
grep -rn "from.*use-current-user" src/ --include="*.tsx" --include="*.ts" | grep -v "use-current-user.ts"
```

If they are imported, keep the re-export. If not, remove it.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-current-user.ts
git commit -m "fix(code): remove dead re-export of ProjectRow and ActivityRow"
```

---

### Task 18: Fix as unknown as casts (C4)

**Files:**

- Modify: `src/hooks/use-current-user.ts`
- Modify: `src/routes/projects.$id.tsx`
- Modify: `src/hooks/use-public-studio-layout.ts`
- Modify: `src/lib/seo.ts`

- [ ] **Step 1: Audit each cast**

Search for all `as unknown as`:

```bash
grep -rn "as unknown as" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test."
```

For each one, evaluate whether the Supabase query can be fixed to return the correct type, or if a Zod schema would be cleaner.

Common pattern — the cast exists because Supabase's `.select("*")` doesn't match the expected type. Fix by selecting specific columns:

```typescript
// Before
const data = (await supabase.from("projects").select("*")) as unknown as ProjectRow;

// After
const data = (await supabase
  .from("projects")
  .select("id, title, description, status, cover_url, created_at")) as ProjectRow;
```

- [ ] **Step 2: Fix the most impactful casts (use-current-user.ts first)**

The `as unknown as Profile | null` on line 104 can be fixed by selecting explicit columns that match the `Profile` type.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(code): replace as unknown as casts with proper column selection"
```

---

### Task 19: Split profile-sections.tsx monolith (C3)

**Files:**

- Modify: `src/components/tethyr/profile-sections.tsx`
- Create: `src/components/tethyr/profile/types.ts`
- Create: `src/components/tethyr/profile/badges.tsx`
- Create: `src/components/tethyr/profile/cards.tsx`
- Create: `src/components/tethyr/profile/dialog.tsx`
- Create: `src/components/tethyr/profile/timeline.tsx`
- Create: `src/components/tethyr/profile/index.ts`

- [ ] **Step 1: Read the full file and identify exports**

```bash
grep -n "^export" src/components/tethyr/profile-sections.tsx
```

- [ ] **Step 2: Create the types module**

Move all type definitions to `src/components/tethyr/profile/types.ts`.

- [ ] **Step 3: Create the badges module**

Move badge-related components to `src/components/tethyr/profile/badges.tsx`.

- [ ] **Step 4: Create the cards module**

Move card-related components to `src/components/tethyr/profile/cards.tsx`.

- [ ] **Step 5: Create the dialog module**

Move the CRUD dialog to `src/components/tethyr/profile/dialog.tsx`.

- [ ] **Step 6: Create the timeline module**

Move timeline-related components to `src/components/tethyr/profile/timeline.tsx`.

- [ ] **Step 7: Create the barrel export**

Create `src/components/tethyr/profile/index.ts` that re-exports everything.

- [ ] **Step 8: Update all imports**

```bash
grep -rn "from.*profile-sections" src/ --include="*.tsx" --include="*.ts"
```

Update each import to use the new path.

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: split profile-sections.tsx monolith into focused modules"
```

---

## Batch 7 — P1 Accessibility (5 tasks)

### Task 20: Fix duplicate h1 on dashboard (A6)

**Files:**

- Modify: `src/routes/_authenticated/dashboard.tsx`

- [ ] **Step 1: Demote second h1 to h2**

On line 391, change:

```tsx
<h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
```

To:

```tsx
<h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
```

And find the closing `</h1>` tag to change to `</h2>`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/dashboard.tsx
git commit -m "fix(a11y): demote duplicate h1 to h2 on dashboard"
```

---

### Task 21: Add role="img" to trophy icon (A7)

**Files:**

- Modify: `src/components/tethyr/project/project-header.tsx`

- [ ] **Step 1: Add role="img"**

On line 175, change:

```tsx
<Trophy className="h-4 w-4 shrink-0 text-primary" aria-label="Featured" />
```

To:

```tsx
<Trophy className="h-4 w-4 shrink-0 text-primary" role="img" aria-label="Featured" />
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/project/project-header.tsx
git commit -m "fix(a11y): add role=\"img\" to trophy icon with aria-label"
```

---

### Task 22: Wrap craft selection in fieldset (A8)

**Files:**

- Modify: `src/routes/signup.tsx`

- [ ] **Step 1: Find the craft selection section**

Read lines 140-180 of `src/routes/signup.tsx` to find the craft selection UI.

- [ ] **Step 2: Wrap in fieldset with legend**

Wrap the craft buttons in a `<fieldset>` with a `<legend>`:

```tsx
<fieldset>
  <legend className="text-sm font-medium text-foreground">Your main craft</legend>
  {/* existing craft buttons */}
</fieldset>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/signup.tsx
git commit -m "fix(a11y): wrap craft selection in fieldset with legend"
```

---

### Task 23: Fix duplicate main landmarks (A9)

**Files:**

- Modify: `src/routes/_authenticated/notifications.tsx`

- [ ] **Step 1: Change nested main to div**

In `notifications.tsx:113`, change:

```tsx
<main className="mt-6 min-w-0">
```

To:

```tsx
<section className="mt-6 min-w-0" aria-label="Notifications content">
```

And update the closing tag.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/notifications.tsx
git commit -m "fix(a11y): replace nested main with section to avoid duplicate landmarks"
```

---

### Task 24: Add aria-label to messages textarea (A10)

**Files:**

- Modify: `src/routes/_authenticated/messages.tsx`

- [ ] **Step 1: Check if already labeled**

The grep shows line 388 already has `aria-label={`Message ${name}`}`. If this is the only textarea, A10 is already fixed. Verify.

- [ ] **Step 2: If not labeled, add aria-label**

```tsx
aria-label={`Message ${name}`}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/messages.tsx
git commit -m "fix(a11y): ensure messages textarea has accessible label"
```

---

## Batch 8 — P1 Performance (5 tasks)

### Task 25: Lazy-load lowlight with selective languages (P4)

**Files:**

- Modify: The file that imports lowlight

- [ ] **Step 1: Find the lowlight import**

```bash
grep -rn "lowlight" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Replace with highlight.js/lib/core + selective languages**

```typescript
import { highlight } from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";

highlight.registerLanguage("typescript", typescript);
highlight.registerLanguage("javascript", javascript);
highlight.registerLanguage("python", python);
highlight.registerLanguage("bash", bash);
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run typecheck`
Expected: PASS, lowlight chunk significantly smaller

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "perf: replace full lowlight with highlight.js/core + 4 languages"
```

---

### Task 26: Lazy-load WorkspaceGrid on dashboard (P6)

**Files:**

- Modify: `src/routes/_authenticated/dashboard.tsx`

- [ ] **Step 1: Find the WorkspaceGrid import**

```bash
grep -n "WorkspaceGrid" src/routes/_authenticated/dashboard.tsx | head -5
```

- [ ] **Step 2: Convert to lazy import**

```typescript
const WorkspaceGrid = lazy(() =>
  import("@/components/tethyr/workspace/workspace-grid").then((m) => ({
    default: m.WorkspaceGrid,
  })),
);
```

Wrap its usage in `<Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/dashboard.tsx
git commit -m "perf: lazy-load WorkspaceGrid on dashboard"
```

---

### Task 27: Lazy-load SectionReveal on landing page (P7)

**Files:**

- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Find the SectionReveal import**

```bash
grep -n "SectionReveal" src/routes/index.tsx | head -3
```

- [ ] **Step 2: Convert to lazy import**

```typescript
const SectionReveal = lazy(() =>
  import("./section-reveal").then((m) => ({ default: m.SectionReveal })),
);
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "perf: lazy-load SectionReveal to defer framer-motion"
```

---

### Task 28: Add .limit() to useFollowers and useFollowing (P9)

**Files:**

- Modify: `src/hooks/use-follow.ts`

- [ ] **Step 1: Add limit to both queries**

On line 46, add `.limit(200)`:

```typescript
const { data, error } = await sb
  .from("follows")
  .select("follower_id, created_at")
  .eq("following_id", userId)
  .order("created_at", { ascending: false })
  .limit(200);
```

On line 69, add `.limit(200)`:

```typescript
const { data, error } = await sb
  .from("follows")
  .select("following_id, created_at")
  .eq("follower_id", userId)
  .order("created_at", { ascending: false })
  .limit(200);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-follow.ts
git commit -m "perf: add .limit(200) to useFollowers and useFollowing"
```

---

### Task 29: Add .limit() to useConnections (P10)

**Files:**

- Modify: `src/hooks/use-connections.ts`

- [ ] **Step 1: Add limit**

On line 47, add `.limit(200)`:

```typescript
    .order("created_at", { ascending: false })
    .limit(200);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-connections.ts
git commit -m "perf: add .limit(200) to useConnections"
```

---

## Batch 9 — P2 Fixes (selected high-value items)

### Task 30: Add .limit(100) to useSessions (P11)

**Files:**

- Modify: `src/hooks/use-sessions.ts`

- [ ] **Step 1: Add limit to fetchSessionsForUser**

On line 150, add `.limit(100)`:

```typescript
    .or(sessionsForUserFilter(userId, participantSessionIds))
    .order("starts_at", { ascending: true })
    .limit(100);
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-sessions.ts
git commit -m "perf: add .limit(100) to fetchSessionsForUser"
```

---

### Task 31: Fix heading hierarchy (A11)

**Files:**

- Check: `src/routes/skills.$slug.tsx`, `src/routes/explore.tsx`

- [ ] **Step 1: Find heading hierarchy violations**

```bash
grep -n "<h[1-6]" src/routes/skills.\$slug.tsx src/routes/explore.tsx
```

- [ ] **Step 2: Fix h1→h3 skips by changing h3 to h2**

- [ ] **Step 3: Commit**

```bash
git add src/routes/skills.\$slug.tsx src/routes/explore.tsx
git commit -m "fix(a11y): fix heading hierarchy skips in skills and explore pages"
```

---

### Task 32: Fix backdrop-blur usage (U6)

**Files:**

- Multiple files

- [ ] **Step 1: Find all backdrop-blur usages**

```bash
grep -rn "backdrop-blur" src/ --include="*.tsx" | grep -v "node_modules"
```

- [ ] **Step 2: Remove backdrop-blur from non-nav/header elements**

Keep it only on:

- `navbar.tsx` (sticky header)
- `authenticated-shell.tsx` (header)

Remove from all other elements (modals, dropdowns, overlays).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(design): limit backdrop-blur to nav/header only"
```

---

## Batch 10 — P3 Fixes (low priority)

### Task 33: Replace relTime with timeAgo (C5)

**Files:**

- Modify: `src/components/tethyr/profile-sections.tsx`

- [ ] **Step 1: Find the duplicate relTime function**

```bash
grep -n "relTime" src/components/tethyr/profile-sections.tsx
```

- [ ] **Step 2: Replace with import from time.ts**

```typescript
import { timeAgo } from "@/lib/time";
```

Replace all `relTime(...)` calls with `timeAgo(...)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/profile-sections.tsx
git commit -m "fix(code): replace duplicate relTime with timeAgo from lib/time"
```

---

### Task 34: Fix heading hierarchy in remaining pages (A17)

- [ ] **Step 1: Add headings to empty state decorative SVGs**

Ensure empty state SVGs have `aria-hidden="true"` (already done per audit).

- [ ] **Step 2: Commit if any changes**

---

### Task 35: Verify Sonner toast ARIA (A19)

- [ ] **Step 1: Check Sonner's built-in aria-live**

Sonner already includes `aria-live` on its toast container. Add a defensive `aria-live="polite"` to the Toaster wrapper if not present.

- [ ] **Step 2: Commit if any changes**

---

## Verification

After all batches are complete:

- [ ] **Run full typecheck:** `npm run typecheck`
- [ ] **Run full test suite:** `npm run test`
- [ ] **Run build:** `npm run build`
- [ ] **Run lint:** `npm run lint`
- [ ] **Verify no regressions:** Check that all 253 tests still pass

---

_Plan generated from the 2026-08-20 full site audit (78 findings). Groups fixes by batch for parallel subagent execution._
