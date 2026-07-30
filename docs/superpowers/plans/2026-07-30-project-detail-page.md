# Project Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing project detail page (`/projects/$id`) from a functional tabbed layout into a premium single-scroll experience with full-bleed hero, sticky sidebar, and scroll-spy navigation.

**Architecture:** Full-viewport hero → two-column grid (sticky sidebar + scrollable main content). No tabs — anchored sections with IntersectionObserver scroll-spy. Existing sub-components (ProjectTimeline, MilestonesTimeline, ProjectUpdatesJournal, ProjectDiscussions, OpenRolesSection, GallerySection, ResourcesSection) reused as-is. Join CTA dialog as a shell.

**Tech Stack:** React 19 / TypeScript / TanStack Router / TanStack Query / Tailwind CSS 4 / framer-motion (useScroll + useTransform for parallax) / Lucide icons

## Global Constraints

- No new third-party animation libraries beyond framer-motion (already installed)
- Existing sub-components reused without modification where possible
- Tailwind CSS 4 design tokens: `font-display`, `card-border`, `bg-surface`, `bg-surface-elevated`, `text-muted-foreground`, `text-primary`, `border-border/60`, shadow/lift utilities
- All copy: sentence case, plain verbs, no filler
- `cn()` utility (`src/lib/utils.ts`) for class merging
- TypeScript strict, no `any`
- No dynamic Tailwind class interpolation
- `prefers-reduced-motion` respected on all animations
- Typecheck verification: `npx tsc --noEmit`
- Commits on main branch

---

### Task 1: `useProjectScrollSpy` hook

**Files:**
- Create: `src/hooks/use-project-scroll-spy.ts`

**Interfaces:**
- Produces: `useProjectScrollSpy(sectionIds: string[]): { activeSection: string | null; scrollTo: (id: string) => void }`

- [ ] **Step 1: Create the hook file**

```typescript
// src/hooks/use-project-scroll-spy.ts
import { useState, useEffect, useCallback } from "react";

const OBSERVER_OPTIONS = { rootMargin: "-40% 0px -55% 0px", threshold: 0 };

export function useProjectScrollSpy(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setActiveSection(visible[0].target.id);
    }, OBSERVER_OPTIONS);

    elements.forEach((el) => observer.observe(el));
    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [sectionIds]);

  const scrollTo = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return { activeSection, scrollTo };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no output)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-project-scroll-spy.ts
git commit -m "feat: add useProjectScrollSpy hook"
```

---

### Task 2: `ProjectHero` component

**Files:**
- Create: `src/components/tethyr/project/project-hero.tsx`

**Interfaces:**
- Consumes: `ProjectDetail` type from `@/hooks/use-projects` (fields used: `title`, `progress_percent`, `stage`, `status`, `looking_for_collaborators`, `looking_for_feedback`, `is_featured`, `goal`), `Contributor` type from `projects.$id.tsx`
- Produces: `<ProjectHero project coverSigned creator avatarSigned accent />`

- [ ] **Step 1: Create the component**

```tsx
// src/components/tethyr/project/project-hero.tsx
import { Bookmark, Share2, UserPlus } from "lucide-react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import type { ProjectDetail, ProjectStage } from "@/hooks/use-projects";
import type { Contributor } from "@/routes/_authenticated/explore";

interface ProjectHeroProps {
  project: ProjectDetail;
  coverSigned: string | null;
  creator: { profile_id: string; role: "creator" | "contributor" | "mentor"; profile: { id: string; handle: string | null; display_name: string | null; avatar_url: string | null } | null } | undefined;
  avatarSigned: Record<string, string>;
  accent?: string | null;
}

export function ProjectHero({ project, coverSigned, creator, avatarSigned, accent }: ProjectHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const coverScale = useTransform(scrollY, [0, 500], [1, 1.1]);
  const coverY = useTransform(scrollY, [0, 500], [0, -40]);

  return (
    <section className="relative h-[100vh] min-h-[480px] max-h-[800px] overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={prefersReducedMotion ? {} : { scale: coverScale, y: coverY }}
      >
        {coverSigned ? (
          <img
            src={coverSigned}
            alt={`${project.title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(120deg,oklch(0.65_0.26_305)_0%,oklch(0.92_0.23_142)_100%)] opacity-40" />
        )}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-semibold text-white drop-shadow-lg sm:text-5xl">
              {project.title}
            </h1>
            {creator?.profile && (
              <Link
                to="/u/$handle"
                params={{ handle: creator.profile.handle ?? "" }}
                className="mt-3 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
              >
                <img
                  src={avatarSigned[creator.profile_id] ?? ""}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-white/20"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.textContent =
                      (creator.profile?.display_name ?? "?")[0].toUpperCase();
                  }}
                />
                {creator.profile.display_name || creator.profile.handle}
              </Link>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Status pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  project.status === "active" ? "bg-brand-green" :
                  project.status === "planning" ? "bg-amber-400" :
                  project.status === "paused" ? "bg-muted-foreground/40" :
                  "bg-primary"
                }`} />
                {project.status}
              </span>
              {project.looking_for_collaborators && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-3 py-1 text-[11px] font-medium text-brand-purple backdrop-blur-sm">
                  <UserPlus className="h-3 w-3" /> Open to collaborators
                </span>
              )}
            </div>
            {project.goal && (
              <p className="mt-4 text-sm text-white/70 drop-shadow max-w-xl line-clamp-2">
                {project.goal}
              </p>
            )}
          </div>

          <div className="hidden shrink-0 flex-col gap-2 sm:flex">
            <button className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-green/90">
              Join Project
            </button>
            <div className="flex gap-2">
              <button className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/80 backdrop-blur-sm transition hover:bg-white/20" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/80 backdrop-blur-sm transition hover:bg-white/20" aria-label="Bookmark">
                <Bookmark className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1">
        <div
          className="h-full bg-gradient-brand transition-all duration-500"
          style={{ width: `${project.progress_percent}%` }}
        />
      </div>
      <span className="absolute bottom-2 right-4 text-[10px] font-medium uppercase tracking-wider text-white/50">
        {project.stage ?? "planning"}
      </span>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/project/project-hero.tsx
git commit -m "feat: add ProjectHero component"
```

---

### Task 3: `ProjectScrollSpy` component

**Files:**
- Create: `src/components/tethyr/project/project-scroll-spy.tsx`

**Interfaces:**
- Consumes: `{ sections: { id: string; label: string }[]; activeSection: string | null; onSectionClick: (id: string) => void }`
- Produces: visual dot/line nav component

- [ ] **Step 1: Create the component**

```tsx
// src/components/tethyr/project/project-scroll-spy.tsx
interface ProjectScrollSpyProps {
  sections: { id: string; label: string }[];
  activeSection: string | null;
  onSectionClick: (id: string) => void;
}

export function ProjectScrollSpy({ sections, activeSection, onSectionClick }: ProjectScrollSpyProps) {
  return (
    <nav className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 flex-col items-center gap-3 z-40" aria-label="Section navigation">
      <div className="absolute top-0 bottom-0 w-px bg-border/60" />
      {sections.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
            className="group relative flex items-center gap-3"
            aria-current={isActive ? "location" : undefined}
            aria-label={s.label}
          >
            <div
              className={`relative z-10 h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                isActive
                  ? "border-primary bg-primary scale-125"
                  : "border-border/60 bg-surface hover:border-primary/40"
              }`}
            />
            <span
              className={`absolute left-4 whitespace-nowrap text-[11px] font-medium transition-all duration-200 ${
                isActive
                  ? "text-foreground opacity-100 translate-x-0"
                  : "text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
              }`}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/project/project-scroll-spy.tsx
git commit -m "feat: add ProjectScrollSpy component"
```

---

### Task 4: `ProjectSidebar` component

**Files:**
- Create: `src/components/tethyr/project/project-sidebar.tsx`
- Modify: `src/components/tethyr/project/project-timeline.tsx` (add `compact` variant)

**Interfaces:**
- Consumes: `ProjectDetail`, `SkillLite`, `openRoles`, links, `isOwner`, `isContributor`
- Produces: `<ProjectSidebar project, skills, links, openRoles, milestones, isOwner, isContributor />`

- [ ] **Step 1: Add compact variant to `ProjectTimeline`**

Add a `variant` prop that lets the timeline render vertically as stacked steps:

In `project-timeline.tsx`, add to the props interface:

```typescript
export function ProjectTimeline({
  currentStage,
  isOwner,
  onStageChange,
  variant = "horizontal",
}: {
  currentStage: ProjectStage;
  isOwner: boolean;
  onStageChange?: (stage: ProjectStage) => void;
  variant?: "horizontal" | "compact";
}) {
```

Add the compact render branch before the return — when `variant === "compact"`, render vertical step list:

```tsx
if (variant === "compact") {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage);
  return (
    <div className="space-y-1">
      {STAGES.map((stage, idx) => {
        const Icon = stage.icon;
        const isActive = idx === currentIdx;
        const isPast = idx < currentIdx;
        return (
          <button
            key={stage.id}
            onClick={() => { if (isOwner && onStageChange) onStageChange(stage.id); }}
            disabled={!isOwner}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition ${
              isOwner ? "cursor-pointer" : "cursor-default"
            } ${isActive ? "bg-primary/10" : "hover:bg-surface-elevated"}`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              isActive ? "border-primary text-primary" :
              isPast ? "border-brand-green text-brand-green" :
              "border-border/60 text-muted-foreground"
            }`}>
              <Icon className="h-3 w-3" />
            </div>
            <span className={`font-medium ${
              isActive ? "text-foreground" :
              isPast ? "text-brand-green" :
              "text-muted-foreground"
            }`}>
              {stage.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `ProjectSidebar`**

```tsx
// src/components/tethyr/project/project-sidebar.tsx
import { Link } from "@tanstack/react-router";
import { Target, Users, ExternalLink, Briefcase } from "lucide-react";
import { ProjectTimeline, type ProjectStage } from "./project-timeline";
import type { ProjectDetail } from "@/hooks/use-projects";
import type { OpenRole } from "@/hooks/use-projects";

interface PersonLite {
  id: string; handle: string | null; display_name: string | null;
  creator_title: string | null; avatar_url: string | null;
}
type SkillLite = { id: string; slug: string; name: string; category: string };
type LinkEntry = [string, string];

interface ProjectSidebarProps {
  project: ProjectDetail;
  skills: SkillLite[];
  links: LinkEntry[];
  openRoles: OpenRole[];
  milestones: { length: number };
  contributors: { length: number };
  isOwner: boolean;
  isContributor: boolean;
  onOpenRoleApply?: (roleId: string) => void;
}

export function ProjectSidebar({
  project, skills, links, openRoles, milestones, contributors,
  isOwner, isContributor, onOpenRoleApply,
}: ProjectSidebarProps) {
  return (
    <aside className="sticky top-24 self-start space-y-4">
      {/* Join CTA */}
      {!isOwner && !isContributor && (
        <button className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-green/90">
          Join this Project
        </button>
      )}

      {/* Stage */}
      <div className="rounded-2xl border border-border/60 bg-surface p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage</h4>
        <ProjectTimeline
          currentStage={(project.stage ?? "planning") as ProjectStage}
          isOwner={isOwner}
          variant="compact"
        />
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                to="/skills/$slug"
                params={{ slug: s.slug }}
                className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary transition hover:opacity-80"
              >
                {s.name}
              </Link>
            ))}
            {skills.length > 6 && (
              <span className="text-[11px] text-muted-foreground">+{skills.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</h4>
          <div className="space-y-1.5">
            {links.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{key}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Open Roles */}
      {openRoles.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3 w-3" /> Open Roles
          </h4>
          <div className="space-y-2">
            {openRoles.slice(0, 3).map((role) => (
              <div key={role.id} className="rounded-lg bg-background/40 p-2.5">
                <p className="text-xs font-medium">{role.title}</p>
                {role.description && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{role.description}</p>
                )}
                <button
                  onClick={() => onOpenRoleApply?.(role.id)}
                  className="mt-1.5 text-[10px] font-medium text-primary hover:underline"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="rounded-2xl border border-border/60 bg-surface p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Info</h4>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{milestones.length} milestone{milestones.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex justify-between">
            <span>{contributors.length} contributor{contributors.length !== 1 ? "s" : ""}</span>
          </div>
          {project.progress_percent > 0 && (
            <div className="flex justify-between">
              <span>{project.progress_percent}% complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Join CTA at bottom */}
      {!isOwner && !isContributor && (
        <div className="sticky bottom-4 pt-2">
          <button className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-green/90">
            Request to Join
          </button>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/tethyr/project/project-sidebar.tsx src/components/tethyr/project/project-timeline.tsx
git commit -m "feat: add ProjectSidebar + compact ProjectTimeline variant"
```

---

### Task 5: `ProjectMainContent` component

**Files:**
- Create: `src/components/tethyr/project/project-main-content.tsx`

**Interfaces:**
- Consumes: All project data + existing sub-components
- Produces: `<ProjectMainContent project contributors skills milestones updates discussions openRoles avatarSigned isOwner isContributor />`

- [ ] **Step 1: Create the component**

```tsx
// src/components/tethyr/project/project-main-content.tsx
import { Link } from "@tanstack/react-router";
import { Target, Users, BookOpen, MessageCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectDetail, MilestoneRow, ProjectUpdate, Discussion, OpenRole } from "@/hooks/use-projects";
import { MilestonesTimeline } from "./project-milestones";
import { ProjectUpdatesJournal } from "./project-updates";
import { ProjectDiscussions } from "./project-discussions";
import { OpenRolesSection } from "./project-open-roles";
import { GallerySection, ResourcesSection } from "./project-resources";
import { ProjectCommunityPosts } from "./project-community-posts";

type SkillLite = { id: string; slug: string; name: string; category: string };

const SECTIONS = [
  { id: "vision", label: "Vision" },
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  { id: "contributors", label: "Contributors" },
  { id: "gallery", label: "Gallery" },
  { id: "resources", label: "Resources" },
  { id: "activity", label: "Activity" },
  { id: "discussions", label: "Discussions" },
] as const;

type ProjectContributor = { profile_id: string; role: "creator" | "contributor" | "mentor"; contribution_score: number; skills_used: string[]; profile: { id: string; handle: string | null; display_name: string | null; avatar_url: string | null } | null };

interface ProjectMainContentProps {
  project: ProjectDetail;
  contributors: ProjectContributor[];
  skills: SkillLite[];
  milestones: MilestoneRow[];
  updates: ProjectUpdate[];
  discussions: Discussion[];
  openRoles: OpenRole[];
  avatarSigned: Record<string, string>;
  isOwner: boolean;
  isContributor: boolean;
}

export { SECTIONS };
export type { ProjectMainContentProps };

export function ProjectMainContent({
  project, contributors, skills, milestones, updates, discussions, openRoles,
  avatarSigned, isOwner, isContributor,
}: ProjectMainContentProps) {
  const creator = contributors.find((c) => c.role === "creator");
  const others = contributors.filter((c) => c.role !== "creator");

  return (
    <div className="space-y-20">
      {/* Vision */}
      {project.vision && (
        <section id="vision" tabIndex={-1}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">01 — Vision</p>
          <h2 className="mb-4 font-display text-xl font-semibold">Vision</h2>
          <div className="border-l-2 border-primary pl-5">
            <div className="prose-custom text-sm leading-relaxed text-foreground/90">
              <Markdown remarkPlugins={[remarkGfm]}>{project.vision}</Markdown>
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {project.description && (
        <section id="about" tabIndex={-1}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">02 — About</p>
          <h2 className="mb-4 font-display text-xl font-semibold">About</h2>
          <div className="prose-custom text-sm leading-relaxed text-foreground/90">
            <Markdown remarkPlugins={[remarkGfm]}>{project.description}</Markdown>
          </div>
        </section>
      )}

      {/* Goals */}
      <section id="goals" tabIndex={-1}>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">03 — Goals</p>
        <h2 className="mb-4 font-display text-xl font-semibold">Goals</h2>
        {project.goal ? (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground/90">{project.goal}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No goals set yet.</p>
        )}
      </section>

      {/* Contributors */}
      <section id="contributors" tabIndex={-1}>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">04 — Contributors</p>
        <h2 className="mb-4 font-display text-xl font-semibold">Contributors</h2>
        {contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one listed yet.</p>
        ) : (
          <div className="space-y-3">
            {contributors.map((c) => (
              <div key={c.profile_id} className="flex items-center gap-3 rounded-xl bg-surface-elevated/40 p-3">
                <Link
                  to="/u/$handle"
                  params={{ handle: c.profile?.handle ?? "" }}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
                    {avatarSigned[c.profile_id] ? (
                      <img src={avatarSigned[c.profile_id]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
                        {(c.profile?.display_name ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.profile?.display_name || c.profile?.handle || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{c.role === "creator" ? "Creator" : c.role === "mentor" ? "Mentor" : "Contributor"}</p>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.skills_used?.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gallery */}
      {((project.gallery ?? []) as { url: string; caption?: string; type: "image" | "video" }[]).length > 0 && (
        <section id="gallery" tabIndex={-1}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">05 — Gallery</p>
          <h2 className="mb-4 font-display text-xl font-semibold">Gallery</h2>
          <GallerySection
            gallery={(project.gallery ?? []) as { url: string; caption?: string; type: "image" | "video" }[]}
            onUpdate={() => {}}
            isOwner={isOwner}
          />
        </section>
      )}

      {/* Resources */}
      {((project.resources ?? []) as { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" }[]).length > 0 && (
        <section id="resources" tabIndex={-1}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">06 — Resources</p>
          <h2 className="mb-4 font-display text-xl font-semibold">Resources</h2>
          <ResourcesSection
            resources={(project.resources ?? []) as { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" }[]}
            onUpdate={() => {}}
            isOwner={isOwner}
          />
        </section>
      )}

      {/* Activity / Journal */}
      <section id="activity" tabIndex={-1}>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">07 — Activity</p>
        <h2 className="mb-4 font-display text-xl font-semibold">Activity</h2>
        <ProjectUpdatesJournal updates={updates} projectId={project.id} isContributor={isContributor} />
      </section>

      {/* Discussions */}
      <section id="discussions" tabIndex={-1}>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">08 — Discussions</p>
        <h2 className="mb-4 font-display text-xl font-semibold">Discussions</h2>
        <ProjectDiscussions
          discussions={discussions}
          projectId={project.id}
          isContributor={isContributor}
          isOwner={isOwner}
        />
      </section>

      {/* Community Posts */}
      <section id="community" tabIndex={-1}>
        <ProjectCommunityPosts projectId={project.id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/project/project-main-content.tsx
git commit -m "feat: add ProjectMainContent component"
```

---

### Task 6: `ProjectJoinModal` shell

**Files:**
- Create: `src/components/tethyr/project/project-join-modal.tsx`

**Interfaces:**
- Produces: `<ProjectJoinModal open projectId openRoles onClose />`

- [ ] **Step 1: Create the modal shell**

```tsx
// src/components/tethyr/project/project-join-modal.tsx
import { X } from "lucide-react";
import type { OpenRole } from "@/hooks/use-projects";

interface ProjectJoinModalProps {
  open: boolean;
  projectId: string;
  openRoles: OpenRole[];
  onClose: () => void;
}

export function ProjectJoinModal({ open, projectId, openRoles, onClose }: ProjectJoinModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join project"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border/60 bg-surface p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-display text-lg font-semibold">Join this Project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interested in contributing? Let the creator know.
        </p>

        {openRoles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Select a role:</p>
            {openRoles.map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input type="radio" name="role" value={role.id} className="accent-primary" />
                <div>
                  <p className="text-sm font-medium">{role.title}</p>
                  {role.description && (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4">
          <textarea
            placeholder="Add a message to the creator..."
            className="w-full rounded-xl border border-border/60 bg-background/40 p-3 text-sm outline-none transition focus:border-primary/40 resize-none"
            rows={3}
          />
        </div>

        <button className="mt-4 w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-green/90">
          Send Request
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tethyr/project/project-join-modal.tsx
git commit -m "feat: add ProjectJoinModal shell component"
```

---

### Task 7: Wire the route

**Files:**
- Modify: `src/routes/projects.$id.tsx`

**Interfaces:**
- Consumes: All components from Tasks 1–6
- Wires everything together: replace tab-based layout with hero + scroll-spy + sidebar + main content + join modal

- [ ] **Step 1: Export shared types + preserve loading/error states**

Add `export` to the existing `Contributor` and `PersonLite` type definitions so new components can import them. Keep the loading state (lines 227-233) and error state (lines 234-240) from the existing route — they remain unchanged.

- [ ] **Step 2: Rewrite the route component layout**

Replace the return block and state management. Key changes:

1. **Imports** — remove tab state imports, add imports for new components (`ProjectHero`, `ProjectScrollSpy`, `ProjectMainContent`, `ProjectSidebar`, `ProjectJoinModal`, `useProjectScrollSpy`)
2. **State** — `activeTab` replaced by scroll-spy + `joinModalOpen` state. Remove unused `setActiveTab`.
3. **Layout** — replace the shell structure:

```tsx
// Inside ProjectPage, after data is loaded:
const [joinModalOpen, setJoinModalOpen] = useState(false);
const SECTIONS_DATA = [
  { id: "vision", label: "Vision" },
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  { id: "contributors", label: "Contributors" },
  { id: "gallery", label: "Gallery" },
  { id: "resources", label: "Resources" },
  { id: "activity", label: "Activity" },
  { id: "discussions", label: "Discussions" },
];
const { activeSection, scrollTo } = useProjectScrollSpy(SECTIONS_DATA.map((s) => s.id));
```

```tsx
// Inside the return, replace the old layout:
<Shell accentColor={accent}>
  <ProjectHero project={project} coverSigned={coverSigned} creator={creator} avatarSigned={avatarSigned} accent={accent} />

  <ProjectScrollSpy sections={SECTIONS_DATA} activeSection={activeSection} onSectionClick={scrollTo} />

  <div className="mx-auto max-w-6xl px-4 sm:px-8 -mt-8 relative z-10">
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <ProjectMainContent
        project={project}
        contributors={contributors}
        skills={skills}
        milestones={milestones}
        updates={updates}
        discussions={discussions}
        openRoles={openRoles}
        avatarSigned={avatarSigned}
        isOwner={isOwner}
        isContributor={isContributor}
      />

      <ProjectSidebar
        project={project}
        skills={skills}
        links={
          Object.entries(project.links ?? {}).filter(([, url]) => !!url)
        }
        openRoles={openRoles}
        milestones={milestones}
        contributors={contributors}
        isOwner={isOwner}
        isContributor={isContributor}
        onOpenRoleApply={(roleId) => setJoinModalOpen(true)}
      />
    </div>
  </div>

  <ProjectJoinModal
    open={joinModalOpen}
    projectId={id}
    openRoles={openRoles}
    onClose={() => setJoinModalOpen(false)}
  />
</Shell>
```

- [ ] **Step 3: Remove now-unused imports**

Remove these imports from the route file (they've moved into `ProjectMainContent`):
- `Markdown`, `remarkGfm`
- `MilestonesTimeline`
- `ProjectUpdatesJournal`
- `ProjectDiscussions`
- `OpenRolesSection`
- `GallerySection`, `ResourcesSection`
- `ProjectCommunityPosts`
- `useProjectCommunityPostCount`
- `Target`, `BookOpen`, `Sparkles`, `UsersIcon`, `MessageCircle`, `PenSquare`, `ImageIcon`, `Trophy`, `Clock`, `UserPlus` (check which are no longer in the route JSX)

KEEP using: `Link`, `useParams`, `createFileRoute`, `notFound`, `useQuery`, `formatDistanceToNowStrict`, `supabase`, `sb`, `useCurrentUser`, `useMilestones`, `useProjectUpdates`, `useDiscussions`, `useOpenRoles`, `useUpdateProjectStage`, `useDominantColor`, `withAlpha`, `Progress`, `PROJECT_LINK_KEYS`, `PROJECT_STATUS_LABEL`, `PROJECT_STATUS_STYLE`, `safeHref`, `cn`

Keep `Contributor` and `PersonLite` type definitions (they're now `export`ed) — new components import them from the route.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/projects.\$id.tsx
git commit -m "feat: wire project page with hero, sidebar, scroll-spy, join modal"
```
