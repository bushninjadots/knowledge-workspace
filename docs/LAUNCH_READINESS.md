# Tethyr Launch Readiness Checklist

> Created: August 20, 2026

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
- [ ] **Confirm old API keys from commit 784841a are rotated** in Supabase dashboard (Settings → API)

## Already Done

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
- [ ] Delete dead `lovable-error-reporting.ts` file
- [ ] Rate limiting in app layer (Supabase defaults are minimal)
- [ ] Split `profile-sections.tsx` monolith (~1,685 lines)
- [ ] Split `composer-bar.tsx` (~1,058 lines) and `post-card.tsx` (~1,200 lines)

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
