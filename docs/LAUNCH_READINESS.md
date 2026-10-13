# Tethyr Launch Readiness Checklist

> Created: August 20, 2026 · Reviewed: October 13, 2026 (see `TETHYR_SITE_AUDIT_2026-10-13.md`)

## Pre-Launch Blockers

- [ ] **Choose hosting platform** (Vercel, Netlify, Cloudflare Pages, etc.)
- [ ] **Set `VITE_SENTRY_DSN` in production env:**
  ```
  VITE_SENTRY_DSN=https://e4fac3a97165c75c056bc2efd6b6b725@o4511944457453568.ingest.de.sentry.io/4511944471150672
  ```
- [ ] **Set `SITE_URL` in Supabase edge function secrets:**
  ```bash
  npx supabase secrets set SITE_URL=https://your-production-domain.com
  ```
- [x] ~~Confirm old API keys from commit 784841a are rotated~~ — not needed: that commit only held publishable/anon keys (2026-10-13 audit)
- [ ] **Set `VITE_PUBLIC_SITE_URL`** to the production origin (currently `http://localhost:5173`). Until `SITE_URL` is set, `fetch-project-preview` falls back to CORS origin `https://tethyr.com`
- [ ] **App-level rate limits** on posts, messages, comments, connections (`BEFORE INSERT` triggers) and **enforce confirm-email** in hosted Auth
- [ ] **Encrypt GitHub tokens at rest** with Supabase Vault (tracker #12)
- [ ] Run `check:db-drift` against hosted, then `build:prod` → `serve:prod` → `qa-audit` / `qa-csp --require-enforced`

## Already Done

- [x] Account deletion requires a sign-in from the last 10 minutes (password re-entry or fresh OAuth)
- [x] Markdown block renderer tokenizes code/URLs before formatting

- [x] Sentry error tracking integrated
- [x] Privacy policy page (`/privacy`)
- [x] Terms of service page (`/terms`)
- [x] Legal links in footer + signup page
- [x] Skill terminology standardized (share/grow)
- [x] Post-signup welcome modal
- [x] Edge function SSRF protection + CORS lockdown
- [x] RLS fix for project_repositories
- [x] Query limits added (useCurrentUser, useMyProjects, useCommunitySpaces, useFollowers, useFollowing, useConnections, useSessions)
- [x] Skip navigation link
- [x] ARIA attributes (aria-pressed, aria-label, role)
- [x] Border radius scale aligned
- [x] Shadow scale aligned
- [x] font-title → font-display
- [x] Backdrop-blur removed from non-header elements
- [x] Lazy-loaded WorkspaceGrid and SectionReveal
- [x] Duplicate types consolidated
- [x] Dead re-export removed

## Nice-to-Have (Not Blocking)

- [ ] Add `Sentry.withProfiler` to root route (optional performance tracing)
- [ ] Fix terminology in `activity-timeline.tsx` and `suggested-creators.tsx`
- [x] Delete dead `lovable-error-reporting.ts` file
- [x] Split `profile-sections.tsx` monolith
- [ ] Split `composer-bar.tsx` (~1,000 lines) and `post-card.tsx` (~960 lines); Studio files are larger still (`creation-studio.tsx` 2,046, `g-studio-surface.tsx` 1,677)

## Sentry Source Maps (Optional, Recommended)

After deploying, upload source maps for readable stack traces:

```bash
npx sentry-cli sourcemaps inject .output/public
npx sentry-cli sourcemaps upload .output/public --org your-org --project tethyr
```

## Environment Variables Needed in Production

| Variable                        | Where                          | Value                                                                                             |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`               | Hosting platform               | `https://e4fac3a97165c75c056bc2efd6b6b725@o4511944457453568.ingest.de.sentry.io/4511944471150672` |
| `SITE_URL`                      | Supabase edge function secrets | `https://your-production-domain.com`                                                              |
| `VITE_SUPABASE_URL`             | Hosting platform               | Your Supabase project URL                                                                         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Hosting platform               | Your Supabase publishable key                                                                     |
