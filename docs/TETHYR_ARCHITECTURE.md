# Tethyr Architecture Guide

> Implementation map for AI-assisted work. This is a navigation guide, not a replacement for source code or migration history.
> For the redesign architecture (block/page/template system), see [`TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md).

## Runtime Shape

Tethyr is a React + TypeScript application using:

- Vite and TanStack Start
- TanStack Router
- TanStack Query
- Supabase for auth, database, storage, and realtime
- Tailwind CSS and shared UI primitives
- Framer Motion for selected interaction and transition work

Check `package.json` before introducing a library. Reuse the established stack and conventions.

## Route Ownership

- `src/routes/__root.tsx` — document shell, global head defaults, theme/provider wiring, root error and not-found states
- `src/routes/index.tsx` — public landing page
- `src/routes/login.tsx`, `signup.tsx`, `reset-password.tsx` — auth entry flows
- `src/routes/dashboard.tsx` — authenticated dashboard/workspace entry
- `src/routes/_authenticated/route.tsx` — authenticated route boundary and shell
- `src/routes/_authenticated/*` — authenticated product destinations
- `src/routes/projects.$id.tsx` — public project workspace
- `src/routes/u.$handle.tsx` — public person/studio page
- `src/routes/skills.$slug.tsx` — public skill hub

Use the route that owns the user-visible behavior. Do not duplicate a page in a new route to avoid understanding the existing one.

## Component Ownership

- `src/components/ui/` — generic accessible primitives and established variants
- `src/components/tethyr/` — Tethyr product concepts and compositions
- `src/components/tethyr/workspace/` — customizable workspace layout behavior
- `src/components/tethyr/project/` — project workspace sections
- `src/components/tethyr/profile/` and profile-related components — studio/profile concepts
- `src/hooks/` — query, mutation, and reusable state behavior
- `src/lib/` — domain utilities, validation, formatting, security, and shared logic
- `src/integrations/supabase/` — Supabase clients, generated types, and auth integration
- `supabase/migrations/` — database schema, policies, triggers, and security changes

Before adding a component, search these areas for an existing owner of the same concept.

## Data and State Rules

1. Keep server/database access in the established Supabase integration patterns.
2. Use React Query conventions already present in the relevant feature.
3. Respect RLS and authenticated boundaries; do not bypass them from client code.
4. Treat loading, empty, error, and stale states as explicit UI states.
5. Invalidate the relevant query keys after mutations rather than introducing ad hoc refresh logic.
6. Do not change schema or RLS as a workaround for a local presentation problem.
7. When adding a database field or policy, add a migration and consider regression coverage.

## Public vs Authenticated Surface

Public surfaces include the landing page and public project, profile, and skill routes. Authenticated surfaces live beneath the authenticated route boundary or use explicit auth-aware entry behavior.

When changing a route, verify:

- Authenticated users and signed-out users see deliberate states.
- Private content is not exposed through public queries or metadata.
- Public pages have appropriate title, description, canonical, and indexing behavior.
- Navigation points to real routes and preserves context.

## Dashboard Ownership

The dashboard has two deliberate layers:

- **Priority flow:** welcome context, first-session onboarding, next steps, and today's focus remain in page flow so the dashboard answers "what's next?" before presenting secondary tools.
- **Workspace tools:** projects, applications, challenges, connections, suggestions, trending skills, reputation, and activity live in the persistent customizable `WorkspaceGrid`.

The priority surfaces are intentionally not draggable or hideable. Saved layouts from the previous registry are migrated for the retired `welcome`, `today`, and `next-steps` module IDs only; unrelated unknown module IDs must not shift layout coordinates.

Prefer one canonical owner for each piece of page chrome:

- Page title and page-level context belong to the route/page shell.
- Section headings belong to the section owner.
- Workspace customization controls belong to the workspace owner.
- Project identity belongs to the project header/identity area.
- Actions should have one clear owner and should not be repeated by wrapper and child components without justification.

If duplicate controls or headings appear, fix ownership before adjusting spacing.

## Studio Experience Ownership

A person has a private Studio and a public Studio; they share concepts but not storage or rendering ownership:

- `src/routes/_authenticated/profile.tsx` owns private identity, skills, project, community, and activity management.
- `src/routes/u.$handle.tsx` owns the public Studio route and fixed identity header.
- `src/components/tethyr/profile/public-studio-workspace.tsx` owns the public work/contribution section composition.
- `src/hooks/use-public-studio-layout.ts` owns public Studio layout persistence.
- `profiles.public_studio_layout` stores the owner-controlled public arrangement and is distinct from private `user_layout_preferences`.

The public identity header remains fixed. Public work sections may be reordered, resized, pinned, or hidden by the owner. The profile table is already public-readable and owner-updatable, so the public layout can be rendered anonymously while writes remain protected by the existing profile RLS policy.

## Server and Security Ownership

- `src/server.ts` owns server response wrapping, security headers, special document endpoints, and catastrophic SSR response normalization.
- `src/start.ts` owns TanStack Start middleware configuration and CSRF/error middleware.
- `src/lib/security-headers.ts` owns shared response security headers.
- `src/lib/error-capture.ts` and `src/lib/error-page.ts` own server error reporting and safe error rendering.

Do not add security headers in individual page components. Do not expose service-role Supabase credentials to client bundles.

## Documentation Ownership

- `AGENTS.md` — binding design constitution and agent guardrails
- `docs/TETHYR_PRODUCT.md` — product identity and product decisions
- `docs/TETHYR_DESIGN.md` — design direction and composition intent
- `docs/TETHYR_DESIGN_SYSTEM.md` — implementation-level visual guidance
- `docs/TETHYR_UX_RULES.md` — required reasoning, review, and validation workflow
- This file — architecture ownership and implementation map
- [`docs/TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md) — major redesign specification (block system, templates, fork/remix, community layouts)
- [`docs/TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md) — redesign data model, component ownership, and migration strategy
- Dated audit documents — historical/current-state findings; they do not silently override the constitution
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — feature-specific proposals and execution records

When documents disagree, prefer the binding constitution and current source, then record the decision rather than creating a third interpretation.

## Change-Scope Rule

Make the smallest change that improves coherence, trust, accessibility, maintainability, or the core collaboration loop. A local request is not permission to redesign unrelated routes or normalize the entire application.

## Redesign Architecture (Implemented)

The block/page/template system is implemented and is now part of the active architecture. The redesign architecture document remains the detailed data-model reference; current source and tests are authoritative for behavior.

- `src/components/tethyr/page/` — page shell, layout, section, block renderer, editor context, and editor controls
- `src/components/tethyr/blocks/` — registered content, profile, project, people, media, and community blocks
- `src/components/tethyr/studio/` — private Creativity Studio canvas, inspector, sidebar, and section composition controls
- `src/components/tethyr/templates/` — template attribution and library presentation
- `src/hooks/` — page, page-editor, theme, templates, fork, and profile/project page state
- `src/lib/` — block registry, page/layout types, layout normalization, theme application, validation, and migration helpers
- `supabase/migrations/20260823000000_page_system_foundation.sql` and subsequent migrations — page, layout, theme, template, fork, and override persistence

Top-level section composition currently supports one, two, or three sequential sections per row. Blocks can be assigned to columns within multi-column sections, and all multi-column compositions stack on narrow viewports.
