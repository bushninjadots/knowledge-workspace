# 3D Horizontal Project Shelf — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the explore page CSS masonry grid with an interactive 3D horizontal project shelf with spring-animated perspective transforms, spine-style non-active cards, and a fullscreen frosted-glass overlay on click.

**Architecture:** Six new components in `src/components/tethyr/project-shelf/` plus a category utility module. The explore page imports `ProjectShelf` which composes `ProjectShelfHeader` (search/filter), `ProjectShelfCover` (individual card with perspective), and `ProjectShelfOverlay` (fullscreen layoutId morph). No new backend queries - extend the existing Supabase query to include `profile_id` and contributor data.

**Tech Stack:** framer-motion 12 (spring animations, layoutId, AnimatePresence), Tailwind CSS 4, React 19, Supabase, Lucide icons.

## Global Constraints

- No third-party animation libraries other than framer-motion
- Use existing `cn()` utility from `@/lib/utils` for class merging
- Follow existing `STATUS_STYLES` record pattern for status badge colors
- Use existing Lucide icon conventions (h-3.5 w-3.5 for inline icons)
- All new components go in `src/components/tethyr/project-shelf/`
- No changes to existing component APIs
- Respect `prefers-reduced-motion` via framer-motion's `useReducedMotion`
- TypeScript strict, no `any` in new code

---

**Note:** `project_shelf_styles.css` may need to be looked up explicitly during implementation and its import added in the explore route, depending on the final implementation path.

### Task 1: Install framer-motion & create file structure

**Files:**

- Modify: `package.json`
- Create: `src/components/tethyr/project-shelf/`
- Create: `src/components/tethyr/project-shelf/project-shelf.tsx`
- Create: `src/components/tethyr/project-shelf/project-shelf-header.tsx`
- Create: `src/components/tethyr/project-shelf/project-shelf-cover.tsx`
- Create: `src/components/tethyr/project-shelf/project-shelf-overlay.tsx`
- Create: `src/lib/category-colors.ts`

**Interfaces:**

- Consumes: (nothing yet)
- Produces: Empty component shells, category utility

- [x] **Step 1: Install framer-motion**

```bash
bun add framer-motion
```

- [x] **Step 2: Create directory structure**

```bash
mkdir -p src/components/tethyr/project-shelf
```

- [x] **Step 3: Create category utility**

Write `src/lib/category-colors.ts`:

```typescript
import { Palette, Code, Video, Camera, Music, Pen, Megaphone, type LucideIcon } from "lucide-react";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Design: Palette,
  Development: Code,
  Video: Video,
  Photography: Camera,
  Music: Music,
  Writing: Pen,
  Marketing: Megaphone,
};

export const CATEGORY_COLORS: Record<string, { hue: number; sat: number }> = {
  Design: { hue: 270, sat: 60 },
  Development: { hue: 142, sat: 80 },
  Video: { hue: 0, sat: 70 },
  Photography: { hue: 40, sat: 70 },
  Music: { hue: 300, sat: 60 },
  Writing: { hue: 200, sat: 50 },
  Marketing: { hue: 20, sat: 70 },
};

export function inferCategory(tags: string[]): string {
  const known = Object.keys(CATEGORY_ICON);
  return tags.find((t) => known.includes(t)) ?? "Design";
}
```

- [x] **Step 4: Create empty component shells**

Each shell file exports a named function component. `project-shelf.tsx`:

```typescript
import { type ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfProps {
  projects: ProjectRow[];
  meId: string | null;
  contributorIds: Set<string>;
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}

export function ProjectShelf({
  projects,
  meId,
  contributorIds,
  q,
  setQ,
  category,
  setCategory,
}: ProjectShelfProps) {
  return null; // placeholder
}
```

`project-shelf-header.tsx`:

```typescript
export function ProjectShelfHeader({
  q,
  setQ,
  category,
  setCategory,
  count,
}: {
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  count: number;
}) {
  return null;
}
```

`project-shelf-cover.tsx`:

```typescript
export function ProjectShelfCover({
  project,
  index,
  activeIndex,
  meId,
  isContributor,
}: {
  project: ProjectRow;
  index: number;
  activeIndex: number;
  meId: string | null;
  isContributor: boolean;
}) {
  return null;
}
```

`project-shelf-overlay.tsx`:

```typescript
export function ProjectShelfOverlay({
  project,
  onClose,
}: {
  project: ProjectRow | null;
  onClose: () => void;
}) {
  return null;
}
```

- [x] **Step 5: Commit**

```bash
git add package.json src/lib/category-colors.ts src/components/tethyr/project-shelf/
git commit -m "feat: install framer-motion, scaffold project-shelf components"
```

---

### Task 2: Build category cover gradient generation

**Files:**

- Create: `src/components/tethyr/project-shelf/cover-gradient.tsx`

**Interfaces:**

- Consumes: `inferCategory`, `CATEGORY_COLORS` from `src/lib/category-colors.ts`
- Produces: `<AnimatedCoverGradient category={string} />` component

- [x] **Step 1: Create the animated gradient component**

`cover-gradient.tsx`:

```typescript
import { motion } from "framer-motion";
import { CATEGORY_COLORS, inferCategory } from "@/lib/category-colors";

interface CoverGradientProps {
  tags: string[];
  coverUrl?: string | null;
  progress: number;
}

export function CoverGradient({ tags, coverUrl, progress }: CoverGradientProps) {
  const cat = inferCategory(tags);
  const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Design;

  if (coverUrl) {
    return (
      <div className="absolute inset-0">
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        background: [
          `linear-gradient(135deg, oklch(0.4 ${c.sat / 100} ${c.hue}), oklch(0.25 ${c.sat / 100} ${c.hue + 30}))`,
          `linear-gradient(135deg, oklch(0.35 ${c.sat / 100} ${c.hue + 60}), oklch(0.4 ${c.sat / 100} ${c.hue}))`,
          `linear-gradient(135deg, oklch(0.4 ${c.sat / 100} ${c.hue}), oklch(0.25 ${c.sat / 100} ${c.hue + 30}))`,
        ],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
      <motion.div
        className="h-full bg-white/60"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/project-shelf/cover-gradient.tsx
git commit -m "feat: add animated cover gradient component"
```

---

### Task 3: Build ProjectShelfCover

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf-cover.tsx`

**Interfaces:**

- Consumes: `ProjectRow` (from explore route), `meId`, `isContributor`, `activeIndex`, `index`
- Consumes: `CoverGradient`, `ProgressBar` from `./cover-gradient`
- Consumes: `CATEGORY_ICON`, `inferCategory` from `@/lib/category-colors`
- Produces: Interactive card with perspective transforms, spine view, status indicators

- [x] **Step 1: Write the cover component**

```typescript
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CATEGORY_ICON, inferCategory } from "@/lib/category-colors";
import { CoverGradient, ProgressBar } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-brand-green" },
  planning: { label: "Planning", dot: "bg-amber-400" },
  paused: { label: "Paused", dot: "bg-muted-foreground/40" },
  completed: { label: "Completed", dot: "bg-primary" },
};

interface ProjectShelfCoverProps {
  project: ProjectRow;
  index: number;
  activeIndex: number;
  meId: string | null;
  isContributor: boolean;
  onClick: () => void;
}

export function ProjectShelfCover({ project, index, activeIndex, meId, isContributor, onClick }: ProjectShelfCoverProps) {
  const distance = Math.abs(index - activeIndex);
  const isActive = index === activeIndex;
  const isOwn = project.profile_id === meId;
  const category = inferCategory(project.tags);
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.Design;
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;

  const rotateY = isActive ? 0 : index < activeIndex ? -18 : 18;
  const scale = isActive ? 1 : 0.85;
  const zIndex = isActive ? 10 : 10 - distance;
  const blur = distance <= 1 ? 0 : distance === 2 ? 2 : 4;
  const width = isActive ? "min-w-[65%]" : "min-w-[180px]";

  return (
    <motion.button
      layout
      onClick={onClick}
      className={cn(
        "relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border text-left outline-none",
        "border-border/60 bg-surface",
        isActive && "z-10",
      )}
      animate={{
        rotateY,
        scale,
        zIndex,
        filter: blur > 0 ? `blur(${blur}px)` : "blur(0px)",
        width: isActive ? "65%" : "180px",
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      whileHover={!isActive ? { scale: 0.9, rotateY: rotateY * 0.5, transition: { type: "spring", stiffness: 400, damping: 25 } } : undefined}
      aria-selected={isActive}
      role="option"
    >
      {/* Cover / Spine face */}
      <div className={cn("relative", isActive ? "aspect-video" : "flex h-full flex-col items-center justify-center gap-2 p-3")}>
        {isActive ? (
          <>
            <CoverGradient tags={project.tags} coverUrl={project.cover_url} progress={project.progress_percent} />
            <ProgressBar progress={project.progress_percent} />
          </>
        ) : (
          /* Spine view for non-active cards */
          <div className="flex flex-col items-center gap-2">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", `bg-${category.toLowerCase()}/10`)}>
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-foreground leading-tight text-center line-clamp-2 [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 max-h-24">
              {project.title}
            </span>
            <div className="h-1 w-12 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-white/40 rounded-full" style={{ width: `${project.progress_percent}%` }} />
            </div>
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          </div>
        )}
      </div>

      {/* Status badges (active view only) */}
      {isActive && (
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {isOwn && (
            <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-[10px] font-medium text-brand-green backdrop-blur-sm">
              You
            </span>
          )}
          {isContributor && (
            <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-medium text-brand-purple backdrop-blur-sm">
              Contributing
            </span>
          )}
        </div>
      )}

      {/* Title overlay (active view) */}
      {isActive && (
        <div className="absolute bottom-6 left-3 right-3">
          <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
            {project.title}
          </p>
          {project.profiles && (
            <p className="text-xs text-white/70 drop-shadow">
              {project.profiles.display_name || project.profiles.handle || "Member"}
            </p>
          )}
        </div>
      )}
    </motion.button>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/project-shelf/project-shelf-cover.tsx
git commit -m "feat: build ProjectShelfCover with perspective transforms"
```

---

### Task 4: Build ProjectShelfHeader

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf-header.tsx`

**Interfaces:**

- Consumes: `q`, `setQ`, `category`, `setCategory`, `count`
- Produces: Search bar + filter chips with AnimatePresence on result count

- [x] **Step 1: Write the header component**

```typescript
import { AnimatePresence, motion } from "framer-motion";
import { Search, Folder, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "All", "Projects", "Design", "Development", "Video",
  "Photography", "Music", "Writing", "Marketing",
] as const;

interface ProjectShelfHeaderProps {
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  count: number;
}

export function ProjectShelfHeader({ q, setQ, category, setCategory, count }: ProjectShelfHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <p className="text-xs uppercase tracking-wider text-primary/70">Explore</p>
        <h1 className="font-display text-2xl font-semibold">What's being built right now</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Browse active projects, find people to collaborate with, and discover what the community is working on.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects, tags, or people…"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              category === c
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Result count with animation */}
      <AnimatePresence mode="wait">
        <motion.p
          key={count}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="text-xs text-muted-foreground"
        >
          {count} {count === 1 ? "project" : "projects"}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/project-shelf/project-shelf-header.tsx
git commit -m "feat: build ProjectShelfHeader with search/filter"
```

---

### Task 5: Build ProjectShelf container

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf.tsx`

**Interfaces:**

- Consumes: `ProjectShelfCover`, `ProjectShelfHeader`, `ProjectShelfOverlay`
- Consumes: `ProjectRow[]`, `meId`, `contributorIds`
- Produces: Shelf with `perspective(1200px)`, active index tracking, keyboard navigation, AnimatePresence exit/enter

- [x] **Step 1: Write the shelf container**

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProjectShelfHeader } from "./project-shelf-header";
import { ProjectShelfCover } from "./project-shelf-cover";
import { ProjectShelfOverlay } from "./project-shelf-overlay";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfProps {
  projects: ProjectRow[];
  meId: string | null;
  contributorIds: Set<string>;
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}

export function ProjectShelf({ projects, meId, contributorIds, q, setQ, category, setCategory }: ProjectShelfProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [overlayProject, setOverlayProject] = useState<ProjectRow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProject = projects[activeIndex];

  const scrollToActive = useCallback((idx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLElement>("[role=option]");
    const card = cards[idx];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, []);

  const navigate = useCallback((dir: -1 | 1) => {
    setActiveIndex((prev) => {
      const next = Math.max(0, Math.min(projects.length - 1, prev + dir));
      scrollToActive(next);
      return next;
    });
  }, [projects.length, scrollToActive]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlayProject) {
        if (e.key === "Escape") setOverlayProject(null);
        return;
      }
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Enter" && activeProject) setOverlayProject(activeProject);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, activeProject, overlayProject]);

  return (
    <div className="space-y-6">
      <ProjectShelfHeader
        q={q}
        setQ={setQ}
        category={category}
        setCategory={setCategory}
        count={projects.length}
      />

      {/* Shelf */}
      <div
        ref={containerRef}
        className="overflow-x-auto scrollbar-none"
        style={{ perspective: "1200px" }}
        role="listbox"
        aria-label="Projects"
        aria-activedescendant={activeProject ? `shelf-card-${activeProject.id}` : undefined}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${q}-${category}`}
            className="flex items-center gap-4 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {projects.map((project, i) => (
              <ProjectShelfCover
                key={project.id}
                project={project}
                index={i}
                activeIndex={activeIndex}
                meId={meId}
                isContributor={contributorIds.has(project.id)}
                onClick={() => {
                  setActiveIndex(i);
                  scrollToActive(i);
                  setOverlayProject(project);
                }}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Overlay */}
      <ProjectShelfOverlay
        project={overlayProject}
        onClose={() => setOverlayProject(null)}
      />
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/project-shelf/project-shelf.tsx
git commit -m "feat: build ProjectShelf container with navigation"
```

---

### Task 6: Build ProjectShelfOverlay

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf-overlay.tsx`

**Interfaces:**

- Consumes: `ProjectRow | null`, `onClose`
- Consumes: `CoverGradient` from `./cover-gradient`
- Consumes: `CATEGORY_ICON`, `inferCategory` from `@/lib/category-colors`
- Produces: Fullscreen frosted-glass overlay with layoutId morph

- [x] **Step 1: Write the overlay component**

```typescript
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORY_ICON, inferCategory } from "@/lib/category-colors";
import { CoverGradient } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfOverlayProps {
  project: ProjectRow | null;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "Active", dot: "bg-brand-green", badge: "bg-brand-green/15 text-brand-green" },
  planning: { label: "Planning", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400" },
  paused: { label: "Paused", dot: "bg-muted-foreground/40", badge: "bg-muted-foreground/10 text-muted-foreground" },
  completed: { label: "Completed", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
};

export function ProjectShelfOverlay({ project, onClose }: ProjectShelfOverlayProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-2xl"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            layoutId={`shelf-card-${project.id}`}
            className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Cover */}
            <div className="relative aspect-video">
              <CoverGradient tags={project.tags} coverUrl={project.cover_url} progress={project.progress_percent} />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition hover:bg-background/80"
                aria-label="Close overlay"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Status badges */}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm",
                  STATUS_STYLES[project.status]?.badge ?? STATUS_STYLES.active.badge,
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLES[project.status]?.dot ?? STATUS_STYLES.active.dot)} />
                  {STATUS_STYLES[project.status]?.label ?? "Active"}
                </span>
                {project.looking_for_collaborators && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-medium text-brand-purple backdrop-blur-sm">
                    <Users className="h-2.5 w-2.5" />
                    Open
                  </span>
                )}
              </div>

              {/* Title overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-lg font-semibold text-white drop-shadow-lg">
                  {project.title}
                </p>
                {project.profiles && (
                  <p className="text-sm text-white/80 drop-shadow">
                    by {project.profiles.display_name || project.profiles.handle || "Member"}
                  </p>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4 p-6">
              {project.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              )}

              {/* Tags */}
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    navigate({ to: "/projects/$id", params: { id: project.id } });
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Project
                </button>
                {project.looking_for_feedback && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Wants feedback
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add src/components/tethyr/project-shelf/project-shelf-overlay.tsx
git commit -m "feat: build ProjectShelfOverlay with layoutId morph"
```

---

### Task 7: Wire the explore page

**Files:**

- Modify: `src/routes/_authenticated/explore.tsx`

**Interfaces:**

- Consumes: `ProjectShelf` from `@/components/tethyr/project-shelf/project-shelf`
- Consumes: `useCurrentUser` (existing)
- Consumes: `supabase` (existing)
- Produces: Working explore page with shelf replacing masonry grid

- [x] **Step 1: Add `profile_id` to the explore query and fetch contributor data**

Add `profile_id` to the Supabase select in the existing query:

Old line 91:

```
"id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, created_at, profiles(id, handle, display_name, creator_title, avatar_url)",
```

New:

```
"id, profile_id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, looking_for_feedback, created_at, profiles(id, handle, display_name, creator_title, avatar_url)",
```

- [x] **Step 2: Add contributor check query after the projects query**

```typescript
const { data: contributors } = await supabase
  .from("project_contributors")
  .select("project_id")
  .in(
    "project_id",
    (data ?? []).map((p) => p.id),
  )
  .eq("profile_id", meId ?? "");
```

Wrap this behind a guard: `if (meId) { ... }`

Then create the `contributorIds` set:

```typescript
const contributorIds = useMemo(() => {
  if (!meId) return new Set<string>();
  return new Set((contributors ?? []).map((c: { project_id: string }) => c.project_id));
}, [contributors, meId]);
```

- [x] **Step 3: Replace masonry grid with ProjectShelf**

Replace the masonry grid section (currently lines 246-314 in explore.tsx) with:

```typescript
<ProjectShelf
  projects={filteredProjects}
  meId={meId}
  contributorIds={contributorIds}
  q={q}
  setQ={setQ}
  category={category}
  setCategory={setCategory}
/>
```

Remove unused imports: `ArrowRight`, `Link` (if no longer used for the creator cards).

- [x] **Step 4: Update the loading state**

Replace the masonry skeleton with simpler shelf skeletons:

```typescript
<div className="flex items-center gap-4 px-4 py-6" style={{ perspective: "1200px" }}>
  {Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="h-48 w-64 shrink-0 animate-pulse rounded-2xl bg-surface"
    />
  ))}
</div>
```

- [x] **Step 5: Commit**

```bash
git add src/routes/_authenticated/explore.tsx
git commit -m "feat: wire ProjectShelf into explore page"
```

---

### Task 8: A11y pass & reduced-motion support

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf-cover.tsx`
- Modify: `src/components/tethyr/project-shelf/project-shelf.tsx`
- Modify: `src/components/tethyr/project-shelf/project-shelf-overlay.tsx`

- [x] **Step 1: Add reduced-motion hook to shelf container**

In `project-shelf.tsx`, import and use framer-motion's `useReducedMotion`:

```typescript
import { useReducedMotion } from "framer-motion";
```

Pass `prefersReducedMotion` value to child components or disable spring animations conditionally. In the container, wrap the transition objects:

```typescript
const prefersReducedMotion = useReducedMotion();
```

Use a `transition` variable:

```typescript
const transition = prefersReducedMotion
  ? { duration: 0 }
  : { type: "spring" as const, stiffness: 300, damping: 30 };
```

- [x] **Step 2: Apply reduced-motion to cover component**

In `project-shelf-cover.tsx`, accept a `prefersReducedMotion` prop and use `{ duration: 0 }` transitions when true.

- [x] **Step 3: Add focus management**

In `project-shelf.tsx`:

- When overlay opens, save the currently focused element
- When overlay closes, restore focus to the triggering card
- Add `aria-activedescendant` pointing to the active card

- [x] **Step 4: Verify keyboard nav**

Ensure `ArrowLeft`/`ArrowRight` navigate, `Enter` opens overlay, `Escape` closes overlay. In the overlay, trap focus (call `focus()` on the close button on mount).

- [x] **Step 5: Commit**

```bash
git add src/components/tethyr/project-shelf/
git commit -m "fix: a11y pass - reduced motion, focus management, keyboard nav"
```

---

### Task 9: Responsive / mobile adaptation

**Files:**

- Modify: `src/components/tethyr/project-shelf/project-shelf.tsx`
- Modify: `src/components/tethyr/project-shelf/project-shelf-cover.tsx`

- [x] **Step 1: Add responsive detection**

Use a `useMediaQuery` or CSS-based approach. Since the project doesn't have a `useMediaQuery` hook, use `window.matchMedia` in a `useEffect`:

```typescript
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const mq = window.matchMedia("(max-width: 768px)");
  setIsMobile(mq.matches);
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);
```

- [x] **Step 2: Mobile layout switch**

When `isMobile`:

- Shelf becomes a vertical scrollable stack (not horizontal)
- No perspective/rotateY transforms - full face cards
- Cards are stacked vertically with gap
- Overlay becomes a bottom sheet (use existing `<Dialog>` with `DialogContent`)

On mobile, render cards as a flat vertical list:

```typescript
{isMobile ? (
  <div className="space-y-3 px-4">
    {projects.map((project, i) => (
      <ProjectShelfCover
        key={project.id}
        project={project}
        index={i}
        activeIndex={activeIndex}
        meId={meId}
        isContributor={contributorIds.has(project.id)}
        onClick={() => setOverlayProject(project)}
      />
    ))}
  </div>
) : (
  /* existing horizontal shelf */
)}
```

- [x] **Step 3: Mobile overlay as bottom sheet**

In `project-shelf-overlay.tsx`, detect mobile and render via `Dialog` from `@/components/ui/dialog` instead of framer-motion overlay.

- [x] **Step 4: Commit**

```bash
git add src/components/tethyr/project-shelf/
git commit -m "feat: responsive mobile layout for project shelf"
```
