<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

---

# Tethyr Design Constitution

> **Do not optimize for "more polished." Optimize for more Tethyr.**

## Canonical Tethyr References

Start with the [`Tethyr documentation index`](docs/README.md) for ownership and precedence. Use these documents together; they are intentionally separated by ownership so they do not become competing constitutions:

- [`docs/TETHYR_PRODUCT.md`](docs/TETHYR_PRODUCT.md) — product identity, primary loop, pillars, and product decisions
- [`docs/TETHYR_DESIGN.md`](docs/TETHYR_DESIGN.md) — design direction, composition intent, and visual anti-patterns
- [`docs/TETHYR_DESIGN_SYSTEM.md`](docs/TETHYR_DESIGN_SYSTEM.md) — implementation guidance for surfaces, typography, spacing, states, and responsive behavior
- [`docs/TETHYR_UX_RULES.md`](docs/TETHYR_UX_RULES.md) — required reasoning, design-review, implementation, and validation workflow
- [`docs/TETHYR_ARCHITECTURE.md`](docs/TETHYR_ARCHITECTURE.md) — route, component, data, server, and documentation ownership
- [`docs/TETHYR_IMPLEMENTATION_STAGES.md`](docs/TETHYR_IMPLEMENTATION_STAGES.md) — current staged execution priorities
- Dated audit files in [`docs/`](docs/) — current or historical findings, not replacements for this constitution

Before a significant UI or product change: inspect the current implementation, identify the user goal and information hierarchy, reuse existing owners, propose the smallest strong change, implement it, and perform a second UX/design review with state, responsive, accessibility, and test validation. Follow [`docs/TETHYR_UX_RULES.md`](docs/TETHYR_UX_RULES.md).

## What Tethyr Is

**A creative collaboration network where people become known through what they build.**

Tethyr is not LinkedIn, Discord, GitHub, Behance, Fiverr, or a generic SaaS dashboard. It draws from all of them and commits to none. It is its own category.

## What Tethyr Is NOT

- A SaaS dashboard
- LinkedIn
- A job board
- A skill marketplace
- Discord
- GitHub
- A generic AI-generated app

## The Primary Loop

```
DISCOVER → Explore work → Find people → Collaborate → Build → Contribute → Become known → DISCOVER
```

Every feature should support this loop. If it doesn't, reconsider it.

## Visual Principles

1. **Work before metadata.** People are represented through what they've built, not self-reported tags.
2. **Projects are first-class citizens.** The project page is Tethyr's flagship experience.
3. **People are represented through their work.** Identity comes from contributions, not claims.
4. **Surfaces are not automatically cards.** Use sections, workspaces, and compositions — not just cards.
5. **Use whitespace intentionally.** Breathing room creates hierarchy. Don't fill every pixel.
6. **Avoid excessive rounded containers.** Not everything needs `rounded-2xl`. Use `rounded-lg` or `rounded-xl` for cards, `rounded-md` for inputs, `rounded-full` for avatars and tags only.
7. **Avoid excessive shadows.** A subtle shadow on one elevated element is enough. Shadow on everything is noise.
8. **Avoid visual noise.** No unnecessary gradients, glows, blur, or glass effects.
9. **Use borders sparingly.** Not every surface needs a border. Use background contrast for hierarchy.
10. **Dynamic user colors should accent, not dominate.** Banner → palette → tiny accents (border tint, active indicator, subtle glow, selection state, hover, progress indicator, avatar ring). The structure stays Tethyr. The accent becomes the user's identity.
11. **Customization is a core identity feature.** "Your Tethyr space belongs to you" — dashboard, profile, and project layouts are user-arrangeable.
12. **Interfaces should feel crafted, not assembled.** Every page should look like someone designed it intentionally.
13. **Every page needs a strong visual hierarchy.** Level 0 (background) → Level 1 (subtle sections) → Level 2 (interactive surfaces) → Level 3 (focused) → Level 4 (modal). Not everything gets the same border treatment.
14. **Never add a UI element merely because other social platforms have one.**
15. **Prefer fewer, stronger components over many small cards.**

## Border Hierarchy

| Level                    | Treatment                                | Example                 |
| ------------------------ | ---------------------------------------- | ----------------------- |
| 0 — Page background      | No border, `bg-background`               | Page body               |
| 1 — Subtle sections      | Background contrast only, no border      | Content sections        |
| 2 — Interactive surfaces | `border card-border` (subtle)            | Cards, panels           |
| 3 — Important/focused    | Accent border via `--user-accent-border` | Active states, featured |
| 4 — Modal/dialog         | `border card-border` + shadow + backdrop | Dialogs, overlays       |

## Border Radius Scale

| Element                          | Radius                       |
| -------------------------------- | ---------------------------- |
| Large containers / page sections | `rounded-xl`                 |
| Cards                            | `rounded-lg` or `rounded-xl` |
| Inputs                           | `rounded-md` or `rounded-lg` |
| Buttons                          | `rounded-md` or `rounded-lg` |
| Tags / badges                    | `rounded-full`               |
| Avatars                          | `rounded-full`               |

## The "Not Everything Is a Card" Rule

Instead of "everything is a card," use:

- **Surfaces** — background-differentiated areas
- **Sections** — visually grouped content
- **Workspaces** — interactive content areas
- **Compositions** — intentionally arranged elements

Cards should exist only when they represent an independent, self-contained object (a project, a person, a challenge).

## Project Page: The Flagship

The project page is Tethyr's most important view. It should feel like a **workspace**, not a collection of 12 cards behind 12 tabs.

Structure: **README → identity → work → people → conversation → evidence**

The README is the project homepage. Deep navigation (files, repos, timeline) comes after. The repository is one piece of the project, not the center.

## Profile = "Your Studio"

The profile is not "profile settings." It's **Your Studio** — where your work, skills, contributions, and identity live together. Projects should visually dominate.

## AI Design Guardrails

When making changes to Tethyr, you MUST follow these rules:

- **Do not redesign existing interfaces unless explicitly instructed.**
- **Do not introduce new card containers to solve spacing problems.**
- **Do not increase border radius without design justification.**
- **Do not add gradients, glows, shadows, blur or glass effects merely to make a UI feel "modern."**
- **Do not convert sections into cards automatically.**
- **Do not duplicate UI patterns from generic SaaS dashboards.**
- **Do not introduce new navigation items without product justification.**
- **Do not change typography hierarchy system-wide for a local issue.**
- **Do not change the existing color system casually.**
- **Do not replace established layouts with generic dashboard layouts.**
- **Preserve intentional asymmetry and whitespace.**
- **Prefer composition and hierarchy over decoration.**
- **Before modifying a page, understand its existing visual language.**
- **Make the smallest change necessary to solve the requested problem.**
- **Audit first. Preserve existing composition. Change only what's requested.**
- **When in doubt, remove — don't add.**

**Most importantly: Do not optimize for "more polished." Optimize for more Tethyr.**

---

## Base44 local setup

The app is a TanStack Start (SSR) + Vite + React frontend backed by **Supabase** (postgres, auth, rest, storage, realtime). There is no separate backend service — the Supabase stack IS the backend.

### Running it

- Start command: `bash scripts/base44-start.sh` (recorded in `.base44/environment.json`).
  It runs `npx supabase start` (brings up the full local Supabase stack and applies all 142 migrations + the demo seed on first init), captures the live API keys from `supabase status`, writes them to the gitignored `.env.supabase-runtime`, then runs `docker compose -f docker-compose.base44.yml up -d --build`.
- The web service (`docker-compose.base44.yml`) runs the cloned source on `node:22` with `npm run dev` (Vite live reload), bind-mounted at `/app` with a named volume for `node_modules`. It maps host port `3000` → container `8080` (the Lovable Vite config forces port 8080 / host `::`).
- No external/user secrets are required — Supabase runs locally and its keys are generated per instance by the CLI.

### Supabase URL split (important)

- **SSR** (runs inside the container) reaches Supabase via `SUPABASE_URL=http://host.docker.internal:54321` (host gateway).
- **Browser** reaches Supabase via `VITE_SUPABASE_URL=https://54321-${BASE44_PUBLIC_HOST_SUFFIX}` (the platform's public per-port proxy). Both are reachable; the public URL hairpins back through the platform proxy.
- The keys (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `VITE_` mirrors) come from `.env.supabase-runtime`, regenerated on every start.

### Quirks / gotchas

- **`vite.config.ts` sets `server.allowedHosts: true`.** The Base44 preview proxy forwards requests with an internal e2b Host header (e.g. `3000-<id>.e2b.app`) that cannot be derived from `BASE44_PUBLIC_HOST_SUFFIX`, so per-host allow-listing is impossible. `allowedHosts: true` is required for the preview to load. Dev-only; no effect on production builds.
- **Migration `20260101000000_ensure_sandbox_exec_role.sql`** creates the `sandbox_exec` role when missing. Later migrations (`20260827154250+`) unconditionally `GRANT ... TO sandbox_exec`, a role that only pre-exists in Lovable's hosted environment; without this guard `supabase start` fails locally. The role is a no-op where it already exists.
- **Migration `20260829100000_security_advisor_hardening.sql`** had its `project_repositories_safe` view column order corrected to `provider, url` (matching the original view) — Postgres rejects `CREATE OR REPLACE VIEW` that reorders/renames columns.
- The Lovable Vite config (`@lovable.dev/vite-tanstack-config`) forces port 8080 and host `::`; do not try to change the port in `vite.config.ts` — map it in compose instead.

### Verifying it works

- `curl -H "Host: <any>" http://localhost:3000/` returns 200 with `<title>Build together, get known for what you make</title>`.
- The SSR HTML contains real seeded data (e.g. `members:10`, featured project "Reverb").
- Seed data: 10 profiles, 9 projects, 154 skills (from `supabase/seed.sql` + `supabase/seed_demo.sql`).
