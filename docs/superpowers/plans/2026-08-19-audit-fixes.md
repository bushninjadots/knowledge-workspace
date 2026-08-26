# Audit Key Findings Implementation Plan

## Context

Implementing the immediate and high-priority fixes from the full site audit (2026-08-19-full-site-audit.md). These are the most impactful items for security, UX, accessibility, and performance.

## Tasks

### Task 1: Verify .env secrets + create .env.example

- Check if .env was ever committed to git history
- Create .env.example with placeholder values
- Effort: 15 min

### Task 2: Fix useUnreadCounts unbounded fetch

- File: src/hooks/use-messages.ts:164-187
- Replace with database-level count query using { count: "exact", head: true }
- Effort: 1 hr

### Task 3: Add retry/home to 6 error component stubs

- Files: login.tsx, signup.tsx, dashboard.tsx, messages.tsx, sessions.tsx, community.tsx
- Pattern: src/routes/__root.tsx:41-77 (retry + go home)
- Effort: 1 hr

### Task 4: Add loading="lazy" decoding="async" to all images + width/height

- 13 files with <img> tags missing lazy loading
- Add explicit width/height attributes for CLS prevention
- Effort: 1 hr

### Task 5: Add aria-label to icon-only buttons + unlabeled inputs

- 7 icon-only buttons missing aria-label
- 6 form inputs missing aria-label/id
- Effort: 1.5 hr

### Task 6: Add aria-current="page" to sidebar links + aria-label to <nav> elements

- dashboard-sidebar.tsx active links
- 5+ <nav> elements missing aria-label
- Effort: 1 hr

### Task 7: Lazy-load project page tabs

- File: src/routes/projects.$id.tsx:34-52
- Convert 20+ eager imports to React.lazy() + Suspense
- Effort: 2-3 hr

### Task 8: Remove unused d3-force dependency

- Remove from package.json
- Effort: 5 min

## Global Constraints

- Follow existing code conventions and patterns
- Don't break existing functionality
- Run lint and typecheck after each task
- Don't add unnecessary comments
- Keep changes minimal and focused
