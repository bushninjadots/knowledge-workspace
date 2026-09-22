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

## Route Code-Splitting (Lazy Pages)

Every route is code-split so the entry chunk stays small (loaders/head/validateSearch are eager; components load on navigation):

1. **Route files keep only the eager surface** — the `createFileRoute(...)` definition with `loader`, `head`, and `validateSearch`, plus a `component: lazyRouteComponent(() => import("./-<name>-page"), "<ExportName>")` wire-up. No page JSX in the route file.
2. **Page components live in dash-prefixed sibling modules** — `-<name>-page.tsx` next to the route file (Vite excludes dash-prefixed files from the generated route tree). A shared data plane used by both the eager loader and the lazy page goes in its own dash-prefixed module (e.g. `-u.$handle-data.ts`); the route file must never statically import the page module or the split is undone.
3. **Split modules resolve route data with typed hooks** — `useSearch({ from: "/_authenticated/x" })` / `useParams({ from: ... })` with slash-form route ids (dots in filenames are slashes in ids: `spaces.$slug.settings` → `/_authenticated/spaces/$slug/settings`).
4. **Regenerate the route tree with a build** — `npm run build` regenerates `routeTree.gen.ts`; there is no standalone generator binary.

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
8. Aggregate in Postgres, not over the wire. Do not pull rows into the client to count or bucket them. A single total uses the supported header-count form (`.select("id", { count: "exact", head: true })`); grouped counts use a small SQL function. PostgREST's aggregate-select endpoint is stack-dependent and rejected locally with `PGRST123` — see `AGENTS.md`.
9. RLS policies reference `auth.uid()` through a scalar subquery — `(select auth.uid())` — so it is evaluated once per statement rather than per row. Keep that form when adding or editing a policy; `20260922101000_auth_rls_initplan.sql` is the `public`-schema sweep that converted every existing one.
10. Searchable text is indexed for leading-wildcard `ILIKE` with pg_trgm GIN indexes (`20260922100000_search_trgm_indexes.sql`). Add an index alongside any new `%term%` search column, and require at least two characters before searching.
11. Grant EXECUTE explicitly. A new function in `public` is not executable by `anon` by default (`20260922105000_least_privilege_anon_execute.sql` revoked that default privilege), so a public-facing RPC needs a deliberate `GRANT ... TO anon` — and the allowlist in `supabase/tests/anon_execute_grants.sql` has to be updated in the same change, which is the point. Never grant `anon` a `SECURITY DEFINER` function that is not an RLS predicate: it runs with RLS bypassed, so the grant is a grant on everything it touches.

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

- `src/routes/_authenticated/profile.tsx` owns the private Studio route; `src/components/tethyr/studio/studio-view.tsx` renders the owner's saved layout.
- `src/routes/u.$handle.tsx` owns the public Studio route; `src/routes/-u.$handle-page.tsx` composes identity and renders the published layout through `PageShell` + `PageLayoutRenderer` (`src/components/tethyr/page/`), published-only so drafts stay private.
- `src/lib/studio-config.ts` owns the shared studio surface style (`studioSurfaceStyle`) consumed by the owner view, the editor, and the public canvas, so the three cannot drift.
- The published layout lives on the `pages` row (`ownerType: "profile"`) fetched via `src/hooks/use-profile-page.ts`. (The legacy `profiles.public_studio_layout` column is not consumed by source code.)

Parity between the two surfaces is pinned by `src/components/tethyr/page/page-layout.test.tsx` (structural contracts) and `scripts/qa-studio-parity.mjs` (nightly browser click-through, light and dark schemes).

## Server and Security Ownership

- `src/server.ts` owns server response wrapping, security headers, special document endpoints, and catastrophic SSR response normalization.
- `src/start.ts` owns TanStack Start middleware configuration, CSRF/error middleware, and the per-request CSP nonce (it generates the nonce, sets the policy, and passes the nonce into the request context).
- `src/lib/security-headers.ts` owns shared response security headers, and adds the nonce-less fallback CSP only when a response has none.
- `src/lib/csp.ts` owns the policy itself (`buildContentSecurityPolicy`, `generateNonce`) and the reason the dev and production policies differ.
- `src/lib/error-capture.ts` and `src/lib/error-page.ts` own server error reporting and safe error rendering.

Do not add security headers in individual page components. Do not expose service-role Supabase credentials to client bundles.

Scripts the router renders (`Scripts`, `ScriptOnce`, the SSR stream barrier) get the nonce from `router.options.ssr.nonce`; the one inline script the app renders itself — the theme bootstrap in `src/routes/__root.tsx` — is stamped by hand. Pages served outside the middleware (the static error page, `/sitemap.xml`, `/robots.txt`) get the nonce-less fallback policy, so they must not contain inline scripts or inline event handlers. `scripts/qa-csp.mjs` runs in the nightly QA job and fails if the nonce stops reaching an inline script, if any inline handler appears, or if the browser reports a violation for something that should have been allowed.

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

## Dead Code Policy

`npm run check:unused` (part of `npm run verify`) fails on any new unused export; the baseline is **zero** and must stay there.

- When a change orphans code, delete it (or de-export it if it is genuinely used in-file) **in the same change** — do not re-record the baseline to make the check pass.
- Prefer deleting over keeping "might need later" exports; git history is the archive.
- Re-recording the baseline is allowed only with an explicit reason noted in the commit.

## Change-Scope Rule

Make the smallest change that improves coherence, trust, accessibility, maintainability, or the core collaboration loop. A local request is not permission to redesign unrelated routes or normalize the entire application.

## Redesign Architecture (Proposed)

The block/page/template system introduces new conceptual owners. These are documented in [`TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md) and will be integrated into this architecture guide after Phase 1 audit is complete and the architecture is approved. Key proposed additions:

- `src/components/tethyr/page/` — page shell, layout, section, block renderer, block registry
- `src/components/tethyr/blocks/` — registered block components (content, media, project, people, community)
- `src/components/tethyr/editor/` — customize bar, block picker, config panel, drag handle, publish controls
- `src/components/tethyr/templates/` — template card, library, preview, fork button, lineage view
- `src/hooks/` — use-page, use-page-editor, use-block-registry, use-templates, use-fork, use-theme
- `src/lib/` — block-validation, layout-serializer, theme-applier, fork-lineage, page-migration

**Do not create these files during Phase 1 (audit).** They are documented here for architectural review only.
