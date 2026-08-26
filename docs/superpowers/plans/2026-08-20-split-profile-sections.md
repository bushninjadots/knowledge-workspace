# Split profile-sections.tsx into profile/ directory

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1685-line `src/components/tethyr/profile-sections.tsx` monolith into focused modules under `src/components/tethyr/profile/`, preserving the barrel re-export so all 14 consumer files need zero import changes.

**Architecture:** Extract each logical component group into its own file. Create a barrel `index.ts` that re-exports everything currently exported from the original file. Delete the original file after verification.

**Tech Stack:** React 19, TypeScript strict, TanStack Router, Supabase, Tailwind CSS 4, Radix UI, Lucide icons

## Global Constraints

- TypeScript strict mode — no `as any`, no `@ts-ignore`
- Follow existing code style (2-space indent, double quotes, semicolons)
- Preserve ALL current exports — the barrel must match the original public API exactly
- All 253 tests must pass after the split
- No functional changes — pure structural refactor

---

## File Structure

| New File                                 | Components                                       | Lines |
| ---------------------------------------- | ------------------------------------------------ | ----- |
| `profile/types.ts`                       | All type definitions, constants, `PROFILE_ICONS` | ~130  |
| `profile/badges.tsx`                     | `ExperienceBadge`, `VerificationBadge`           | ~35   |
| `profile/section-card.tsx`               | `SectionCard`, `Field`                           | ~40   |
| `profile/banner-strip.tsx`               | `BannerStrip`                                    | ~200  |
| `profile/chip-list-card.tsx`             | `ChipListCard`                                   | ~130  |
| `profile/projects-card.tsx`              | `ProjectsCard`                                   | ~250  |
| `profile/project-library-add-dialog.tsx` | `ProjectLibraryAddDialog`                        | ~150  |
| `profile/project-dialog.tsx`             | `ProjectDialog`, `Toggle`, creation steps        | ~610  |
| `profile/timeline-card.tsx`              | `TimelineCard`                                   | ~100  |
| `profile/index.ts`                       | Barrel re-exports                                | ~20   |

## Consumer Files (no changes needed — barrel handles it)

1. `src/components/tethyr/project/project-main-content.tsx`
2. `src/components/tethyr/project/project-header.tsx`
3. `src/components/tethyr/project/project-workbench.test.tsx`
4. `src/components/tethyr/profile/profile-activity-tab.tsx`
5. `src/components/tethyr/profile/profile-projects-tab.tsx`
6. `src/components/tethyr/profile/profile-skills-tab.tsx`
7. `src/components/tethyr/profile/public-studio-workspace.tsx`
8. `src/components/tethyr/profile/profile-layout.tsx`
9. `src/components/tethyr/create-project-button.tsx`
10. `src/hooks/use-current-user.ts`
11. `src/routes/_authenticated/profile.tsx`
12. `src/routes/_authenticated/dashboard.tsx`
13. `src/routes/skills.$slug.tsx`

## Task 1: Create types.ts

**Files:**

- Create: `src/components/tethyr/profile/types.ts`

Extract from profile-sections.tsx:

- `ProjectStatus` type + `PROJECT_STATUS_LABEL` + `PROJECT_STATUS_STYLE` (lines 68-84)
- `VERIFICATION_LABEL` + `VERIFICATION_STYLE` (lines 86-98)
- `EXPERIENCE_LABEL` (lines 100-105)
- `ProjectSkill` type (line 142)
- `ProjectRow` type (lines 512-536)
- `PROJECT_LINK_KEYS` (lines 538-544)
- `PROJECT_CREATION_STEPS` + `canContinueProjectCreation` (lines 936-942)
- `ActivityRow` type (lines 1586-1591)
- `PROFILE_ICONS` (line 1685)

Imports needed: `Github`, `Globe`, `Sparkles` from lucide-react; `SkillVerificationLevel`, `SkillExperienceLevel` from `@/hooks/use-current-user`; `ProjectPresentationPreset` from `@/lib/project-presentation`

## Task 2: Create badges.tsx

**Files:**

- Create: `src/components/tethyr/profile/badges.tsx`

Extract: `ExperienceBadge` (lines 107-113), `VerificationBadge` (lines 115-140)

Imports: `Trophy`, `Check` from lucide-react; types from `./types`; `safeHref` from `@/lib/validators`; `SkillVerificationLevel`, `SkillExperienceLevel` from `@/hooks/use-current-user`

## Task 3: Create section-card.tsx

**Files:**

- Create: `src/components/tethyr/profile/section-card.tsx`

Extract: `SectionCard` (lines 145-172), `Field` (lines 174-181)

Imports: `Pencil` from lucide-react; `Button` from `@/components/ui/button`; `Label` from `@/components/ui/label`

## Task 4: Create banner-strip.tsx

**Files:**

- Create: `src/components/tethyr/profile/banner-strip.tsx`

Extract: `BannerStrip` (lines 188-382)

Imports: `useRef`, `useState` from react; `Camera`, `Sparkles` from lucide-react; `toast` from sonner; `friendlyError` from `@/lib/error-message`; `supabase` from `@/integrations/supabase/client`; `validateImageFile` from `@/lib/validators`; `useDominantColor` from `@/lib/dominant-color`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `DragDropFileInput` from `@/components/tethyr/drag-drop-file-input`

Internal constants: `QUICK_EMOJI`, `BANNER_CAPTION_MAX`

## Task 5: Create chip-list-card.tsx

**Files:**

- Create: `src/components/tethyr/profile/chip-list-card.tsx`

Extract: `ChipListCard` (lines 385-509)

Imports: `useEffect`, `useState` from react; `Plus`, `X` from lucide-react; `toast` from sonner; `friendlyError` from `@/lib/error-message`; `supabase` from `@/integrations/supabase/client`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` from `@/components/ui/dialog`; `SectionCard` from `./section-card`

## Task 6: Create projects-card.tsx

**Files:**

- Create: `src/components/tethyr/profile/projects-card.tsx`

Extract: `ProjectsCard` (lines 546-788)

Imports: `useState` from react; `Link`, `useNavigate` from `@tanstack/react-router`; `Plus`, `Rocket`, `Trophy`, `Target`, `MessageCircle`, `UserPlus`, `ImageIcon`, `Pencil`, `MoreHorizontal`, `Copy`, `FileText`, `Megaphone` from lucide-react; `toast` from sonner; `friendlyError` from `@/lib/error-message`; `supabase` from `@/integrations/supabase/client`; `useCurrentUser` from `@/hooks/use-current-user`; `DropdownMenu`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuTrigger` from `@/components/ui/dropdown-menu`; `Button` from `@/components/ui/button`; `Progress` from `@/components/ui/progress`; `SectionCard` from `./section-card`; types from `./types`; `ProjectDialog` from `./project-dialog`; `ProjectLibraryAddDialog` from `./project-library-add-dialog`

## Task 7: Create project-library-add-dialog.tsx

**Files:**

- Create: `src/components/tethyr/profile/project-library-add-dialog.tsx`

Extract: `ProjectLibraryAddDialog` (lines 790-934)

Imports: `useRef`, `useState` from react; `UploadCloud` from lucide-react; `toast` from sonner; `friendlyError` from `@/lib/error-message`; `useCreateItem`, `useUploadLibraryFile` from `@/hooks/use-library`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `Textarea` from `@/components/ui/textarea`; `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` from `@/components/ui/dialog`; `Field` from `./section-card`; `ProjectRow` from `./types`

## Task 8: Create project-dialog.tsx

**Files:**

- Create: `src/components/tethyr/profile/project-dialog.tsx`

Extract: `ProjectDialog` (lines 944-1549), `Toggle` (lines 1551-1583)

Imports: `useEffect`, `useMemo`, `useRef`, `useState` from react; `Camera`, `Check`, `Search as SearchIcon`, `X` from lucide-react; `toast` from sonner; `friendlyError` from `@/lib/error-message`; `supabase` from `@/integrations/supabase/client`; `validateImageFile`, `isSafeUrl` from `@/lib/validators`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `Textarea` from `@/components/ui/textarea`; `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` from `@/components/ui/dialog`; `GalleryThumb` from `@/components/tethyr/project/project-resources`; types + constants from `./types`; `Field` from `./section-card`

Internal: `PROJECT_STATUSES` constant

## Task 9: Create timeline-card.tsx

**Files:**

- Create: `src/components/tethyr/profile/timeline-card.tsx`

Extract: `TimelineCard` (lines 1638-1683)

Imports: `Sparkles`, `Camera`, `ImageIcon`, `GraduationCap`, `Rocket`, `Layers`, `UserPlus`, `MessageCircle`, `History` from lucide-react; `timeAgo` from `@/lib/time`; `SectionCard` from `./section-card`; `ActivityRow` from `./types`

Internal: `KIND_META` constant

## Task 10: Create barrel index.ts

**Files:**

- Create: `src/components/tethyr/profile/index.ts`

Re-export everything from all modules:

- `export type { ProjectStatus, ProjectRow, ProjectSkill, ActivityRow } from './types'`
- `export { PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE, VERIFICATION_LABEL, VERIFICATION_STYLE, EXPERIENCE_LABEL, PROJECT_LINK_KEYS, PROJECT_CREATION_STEPS, canContinueProjectCreation, PROFILE_ICONS } from './types'`
- `export { ExperienceBadge, VerificationBadge } from './badges'`
- `export { SectionCard } from './section-card'`
- `export { BannerStrip } from './banner-strip'`
- `export { ChipListCard } from './chip-list-card'`
- `export { ProjectsCard } from './projects-card'`
- `export { ProjectDialog } from './project-dialog'`
- `export { TimelineCard } from './timeline-card'`

Note: `Field` and `Toggle` are NOT re-exported (they were not exported from the original file).

## Task 11: Delete original + update barrel path

**Files:**

- Delete: `src/components/tethyr/profile-sections.tsx`
- Modify: `src/components/tethyr/profile/index.ts` (if needed)

Wait — actually the barrel IS `profile/index.ts`. Consumers currently import from `@/components/tethyr/profile-sections`. We have two options:

**Option A (recommended):** Keep `profile-sections.tsx` as a thin barrel that re-exports from `./profile/`:

```ts
export * from "./profile";
```

This means zero consumer changes.

**Option B:** Update all 14 consumer files to import from `@/components/tethyr/profile`.

Go with **Option A** — rename original to a re-export barrel.

## Task 12: Final verification

- Run `npx tsc --noEmit`
- Run `npx vitest run`
- Run `npx eslint src/components/tethyr/profile/`
- Commit
