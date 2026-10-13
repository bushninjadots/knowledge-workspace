# Tethyr Site Audit — 2026-10-13

Scope: full codebase at `main` @ `fce6f4d` (clean tree). Static checks, test suite, security review of server/SSR/DB surface, repo hygiene. Not covered: hosted Supabase state (no credentials), live site (not deployed), browser/e2e runs (need local Supabase + Docker), fresh prod build (see Limitations).

## Verdict

The codebase is in good shape. Typecheck, lint, prettier and migration-order are clean; 1,149 unit tests pass; all 70 tables have RLS; security headers, CSP nonces, CSRF on server functions, constant-time cron secret and SSRF-guarded edge function are all in place. No secrets in git history (every committed JWT decodes to `role: anon`).

The real problems are a red CI gate, one silent data bug, a stale type layer that has quietly turned off type-checking for ~130 database calls, and launch prerequisites that still aren't done.

## Results

| Check                                       | Result                           |
| ------------------------------------------- | -------------------------------- |
| `tsc --noEmit`                              | 0 errors                         |
| `eslint .`                                  | 0 problems                       |
| `prettier --check`                          | clean                            |
| `vitest run`                                | 1,149 / 1,149 passed (143 files) |
| `check:migration-order`                     | 208 migrations, monotonic        |
| `check:bundle` (last `.output`, 2026-10-05) | 616 chunks within budget         |
| `npm audit --omit=dev`                      | **1 high — CI step fails**       |
| RLS coverage                                | 70 / 70 tables                   |

## Findings

### P1 — Fix now

**1. CI is red on `npm audit`.** `source-map-js` 1.2.1 (GHSA-68fv-2mgg-jv7q, high) via `vite → postcss`, `@tailwindcss/node`, `jsdom`. `ci.yml` runs `npm audit --audit-level=moderate`, so every push fails at that step. Build-time only, no runtime exposure. Fix: `npm audit fix` (or an `overrides` pin), commit the lockfile.

**2. GitHub commit sync silently stops once a project has >100 commit events.** `syncGithubProjectActivity` (`src/lib/github-server.ts`) dedupes against `project_activity … .limit(100)` — unordered, and not filtered by repository. Once a project passes 100 `github_commit` rows, an already-stored SHA can be missed by the sample, the batch insert hits the partial unique index from `20260820150000`, the whole batch is rejected, and the error is swallowed (`if (!error) added += …`). Net effect: new commits stop appearing on the timeline with no error surfaced. Fix: look up only the fetched SHAs (`.in("metadata->>external_id", shas)`), and surface or log insert errors instead of discarding them.

**3. `types.ts` is stale; ~130 Supabase calls bypass the type checker.** `src/lib/supabase-pending-schema.ts` casts the client to `SupabaseClient<any>`, and 130 call sites use it — the entire Library boards feature, forks, project visits, page versions, and 12 RPCs (`match_projects`, `match_creators`, `publish_page_version`, `rollback_page_version`, `fork_project`, …). These tables exist in migrations (`library_boards` since `20260925150000`); they're only missing because types weren't regenerated. The file header says the migration role "cannot own or alter those objects" — that doesn't hold for most of the list. A column rename in any of these now ships green. Fix: `supabase gen types typescript --local > src/integrations/supabase/types.ts` (re-apply the client.ts precedence if Lovable regenerates it), then delete `supabasePending` usages until the module is empty.

### P2 — Before launch

**4. Not deployable as-is — launch checklist untouched.** `docs/LAUNCH_READINESS.md` blockers are all still open: no hosting platform, `VITE_PUBLIC_SITE_URL=http://localhost:5173`, edge function `SITE_URL` unset. Unset, `fetch-project-preview` falls back to CORS origin `https://tethyr.com` — a domain you may not own. The "rotate keys from 784841a" item can be closed: that commit only contained publishable/anon keys.

**5. Three lockfiles.** `bun.lock` (Oct 2), `pnpm-lock.yaml` (Oct 3), `package-lock.json` (Oct 5) are all tracked. CI installs with `npm ci`; Lovable deploys from bun. Dependency resolution in CI is not what ships. Pick one (bun, if Lovable is the deploy path) and delete the others.

**6. Markdown block renderer corrupts links and sits one regex away from stored XSS.** `src/lib/block-markdown.ts` runs inline formatting before links, so formatting markup is injected _inside_ `href`/`src`:

- `[a](https://ex.com/*x*/)` → `href="https://ex.com/<em>x</em>/"` (broken link)
- a backtick in a URL injects `<code class="…">`, whose quote closes the `href` attribute early

Not exploitable today (the injected fragments are fixed strings ending in `">`), but output goes straight into `dangerouslySetInnerHTML` on public project/profile pages, and any future pattern that emits attacker text inside a quoted attribute becomes stored XSS. Fix: tokenize links/images first (placeholders), format, then restore; and run the result through `DOMPurify.sanitize` (already a dependency, already used for Library).

**7. No app-level abuse controls.** No rate limits on posts, messages, comments, connection requests, or reports beyond Supabase defaults (only moderation-related throttles exist). Email verification is UX-only, not enforced (tracker #11). With open signup, one script can spam the community. Minimum: per-user insert-rate checks in `BEFORE INSERT` triggers on `posts`, `messages`, `comments`, `connections`; turn on confirm-email in hosted Auth.

**8. Account deletion needs only a valid session.** `deleteAccount` deletes the auth user (cascading 74 FKs) with no re-authentication. A stolen or left-open session can wipe an account irreversibly. Require a recent sign-in (check `claims.iat`/`auth_time` within N minutes) or a password re-prompt.

### P3 — Hygiene / debt

**9. Docs are out of sync with the code.** `KNOWN_ISSUES.md` §3 still says "ACTIVE RISK", but `20260912130000_repair_hosted_drift_findings.sql` restored F1–F4. `LAUNCH_READINESS.md` is dated Aug 20 and lists already-fixed items as nice-to-haves. `roadmap.md` lists typecheck errors that no longer exist. Stale docs feed bad context to every agent that reads `AGENTS.md`.

**10. Agent/tool residue in the repo.** Tracked: `.replit`, `.bolt/`, `.base44/`, `.agents/`, `artifacts/`, `docker-compose.base44.yml`. Untracked but on disk: `.venv/` (155 MB), `.freebuff/`, `.superpowers/`, `.output/`, `dist/`. Keep what's in use (Lovable, Base44 if still used), remove the rest, and gitignore the agent folders.

**11. Monolith files.** 15 files over 950 lines; worst: `creation-studio.tsx` (2,046), `g-studio-surface.tsx` (1,677), `studio-rail.tsx` (1,288), `use-projects.ts` (1,205), `-explore-page.tsx` (1,199). Studio holds three of the five largest files and is also where most recent churn is. Split there first.

**12. Type escape hatches.** 61 `as unknown as`, 34 `as any`, 21 `eslint-disable` in non-test source — most will drop with finding 3.

**13. GitHub tokens unencrypted at rest** (tracker #12, deferred). Mitigation (zero-policy RLS, column grants) is sound. Supabase Vault now makes the encryption cheap; revisit before launch.

**14. Bundle weight.** Largest client chunks: 538 kB / 475 kB / 453 kB raw (~168 / 155 / 140 kB gzip). Within budget, but heavy for a landing page. Confirm the public landing route doesn't pull Tiptap, framer-motion, or the studio into its initial graph.

## Fix order

1. `npm audit fix` → CI green (5 min)
2. GitHub sync dedupe + error surfacing (30 min)
3. Regenerate types, burn down `supabasePending` (half day)
4. Markdown renderer: tokenize + DOMPurify (1 h)
5. One lockfile (15 min)
6. Rate-limit triggers + enforced email confirm (half day)
7. Re-auth on delete (1 h)
8. Docs/residue cleanup (1 h)
9. Hosting + env, then run `build:prod` → `serve:prod` → `qa-audit` / `qa-csp --require-enforced` against it

## Limitations

- Hosted DB not inspected; `check:db-drift` needs hosted credentials. Run the nightly job or trigger it manually before launch.
- Fresh `build:prod` could not run from the audit session (no delete permission on `dist/`); bundle numbers come from the 2026-10-05 `.output`.
- No browser pass. Prior page-level UX audits (Sept–Oct) cover that ground; this one is code and infra.
