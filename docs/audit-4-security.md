# Security & RLS Audit — Audit 4

**Date:** 2026-08-20
**Scope:** Full end-to-end security review of auth flows, RLS policies, server function safety, input validation, data exposure, CSRF, storage permissions, secret handling, and privilege escalation paths.

---

## Summary Table

| ID | Severity | Title | File(s) |
|----|----------|-------|---------|
| 1 | **P0** | Edge function SSRF — fetches arbitrary user-supplied URLs server-side | `supabase/functions/fetch-project-preview/index.ts:48,71,94,114` |
| 2 | **P0** | `.env` with publishable keys committed to git history | Git history (commit `784841a`) |
| 3 | **P1** | Edge function CORS allows all origins | `supabase/functions/fetch-project-preview/index.ts:5` |
| 4 | **P1** | Edge function leaks internal error messages | `supabase/functions/fetch-project-preview/index.ts:150` |
| 5 | **P1** | `connected_accounts.access_token` exposed to client via RLS | `supabase/migrations/20260807000000_project_repositories.sql:70-72` |
| 6 | **P1** | `project_repositories` public-read policy ignores private projects | `supabase/migrations/20260807000000_project_repositories.sql:20-22` |
| 7 | **P2** | CSP allows `unsafe-inline` for scripts | `src/lib/security-headers.ts:14` |
| 8 | **P2** | Authenticated route guard is client-side only (`ssr: false`) | `src/routes/_authenticated/route.tsx:7,11-13` |
| 9 | **P2** | No server-side password complexity enforcement | `src/routes/signup.tsx:77-78` |
| 10 | **P3** | `console.error` in auth middleware logs env var names | `src/integrations/supabase/auth-middleware.ts:46` |

---

## P0 — Critical

### [P0] Edge function SSRF — fetches arbitrary user-supplied URLs server-side

**File(s):** `supabase/functions/fetch-project-preview/index.ts:48,71,94,114`

**Issue:** The `fetch-project-preview` edge function takes a user-supplied `url` parameter and fetches it directly from the Deno server with no URL validation or allowlist. The GitHub/GitLab/Codeberg paths extract `owner/repo` from the URL and call external APIs, but the Open Graph fallback path (`index.ts:114`) does `await fetch(url, ...)` on the raw user input.

**Risk:** An attacker can supply internal network URLs (e.g., `http://169.254.169.254/latest/meta-data/`, `http://localhost:54321/`, internal service endpoints) and read the response. This is a classic Server-Side Request Forgery (SSRF) that can:
- Probe internal services and ports
- Access cloud metadata endpoints (AWS, GCP, etc.)
- Read Supabase Studio or other local services
- Bypass firewalls and network ACLs

**Evidence:**
```typescript
// index.ts:114 — no URL validation before fetch
const pageRes = await fetch(url, {
  headers: { "User-Agent": "Tethyr/1.0" },
  signal: AbortSignal.timeout(10_000),
});
```

**Recommendation:** Implement a URL allowlist before fetching. At minimum:
1. Only allow `http:` and `https:` protocols
2. Block private/internal IP ranges (`10.*`, `172.16-31.*`, `192.168.*`, `127.*`, `169.254.*`, `localhost`, `*.local`)
3. Only allow fetching from known hosting platforms (github.com, gitlab.com, codeberg.org, etc.) in the OG fallback path, or remove the OG fallback entirely
4. Consider using a dedicated link-preview service instead of raw server-side fetching

---

### [P0] `.env` with publishable keys committed to git history

**File(s):** Git history (commit `784841a`)

**Issue:** The initial commit included a `.env` file containing `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_URL` for a production Supabase project. The file was later removed (commit `6a52337`) and `.env` is now in `.gitignore`, but the credentials remain in git history.

**Risk:** Anyone with access to the repository (collaborators, forks, leaked history) can extract the publishable key and project URL. While the publishable (anon) key is designed to be public-facing, having it in git history:
- Exposes the exact Supabase project ID and URL
- Combined with any RLS bypass, gives full data access
- The `SUPABASE_SERVICE_ROLE_KEY` was **not** committed (good), so admin-level compromise is not at risk from this finding alone

**Evidence:**
```
# Initial commit (784841a) contained:
SUPABASE_PUBLISHABLE_KEY="sb_publishable_Va6sj3RfHruP5qjIxVJNTQ_ln9vtjHU"
SUPABASE_URL="https://fxgemyzwpjhxfgacitaz.supabase.co"
```

**Recommendation:** If the Supabase project in the initial commit is still active, rotate the publishable key via the Supabase dashboard. The current `.env` uses different keys (`sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`), suggesting this was already addressed, but confirm the old project/key pair is deactivated.

---

## P1 — High

### [P1] Edge function CORS allows all origins

**File(s):** `supabase/functions/fetch-project-preview/index.ts:5`

**Issue:** The edge function sets `Access-Control-Allow-Origin: *`, allowing any website to invoke it.

**Risk:** Any malicious website can make authenticated requests to this endpoint (if the user has a Supabase session). Combined with the SSRF finding above, this expands the attack surface: a malicious page could use the victim's browser to call the edge function and proxy internal network requests through it.

**Evidence:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

**Recommendation:** Restrict CORS to the application origin(s):
```typescript
"Access-Control-Allow-Origin": "https://tethyr.app"
```
Or use Supabase's built-in CORS configuration.

---

### [P1] Edge function leaks internal error messages

**File(s):** `supabase/functions/fetch-project-preview/index.ts:149-153`

**Issue:** The catch block returns `err.message` directly to the client, which can leak internal implementation details (Deno runtime errors, network errors, file paths).

**Risk:** Error messages can reveal internal infrastructure details (hostnames, ports, library versions) that aid further attacks.

**Evidence:**
```typescript
} catch (err) {
  return new Response(JSON.stringify({ error: err.message }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

**Recommendation:** Return a generic error message and log the details server-side:
```typescript
} catch {
  return new Response(JSON.stringify({ error: "Failed to fetch preview" }), {
    status: 500,
    ...
  });
}
```

---

### [P1] `connected_accounts.access_token` exposed to client via RLS

**File(s):** `supabase/migrations/20260807000000_project_repositories.sql:61,70-72`

**Issue:** The `connected_accounts` table stores OAuth access tokens in the `access_token` column. The RLS policy allows authenticated users to `SELECT` their own rows, meaning the token is returned to the browser client. The column comment says "encrypted by Supabase Vault or stored as plaintext" but no Vault encryption is configured.

**Risk:** If an XSS vulnerability exists anywhere in the application, the attacker can read the user's OAuth tokens (GitHub, etc.) from `connected_accounts`. These tokens provide access to the user's GitHub repositories and can be used to perform actions on their behalf.

**Evidence:**
```sql
-- migration 20260807000000, line 61
access_token  text,  -- encrypted by Supabase Vault or stored as plaintext

-- RLS policy (line 70-72)
CREATE POLICY "Users can read own connected accounts"
  ON connected_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

**Recommendation:** The `access_token` column should never be readable by the client. Options:
1. Remove the column from client-visible queries (use `supabaseAdmin` for token access only, like `user_github_tokens`)
2. Encrypt the token at rest using pgcrypto or Supabase Vault
3. At minimum, ensure the column is excluded from client queries (e.g., `.select('id, provider, provider_id, username')` never includes `access_token`)

Note: `user_github_tokens` (the Personal Access Token table) correctly has no client RLS policies — `connected_accounts` should follow the same pattern for its token column.

---

### [P1] `project_repositories` public-read policy ignores private projects

**File(s):** `supabase/migrations/20260807000000_project_repositories.sql:20-22`

**Issue:** The `project_repositories` table has a blanket `FOR SELECT USING (true)` policy. The private project visibility fix (`20260808170000`) did not include `project_repositories` in its sweep, so repository URLs and metadata for private projects are publicly readable.

**Risk:** An attacker can query `project_repositories` to discover private project repository URLs, which may contain sensitive code or internal naming conventions.

**Evidence:**
```sql
-- 20260807000000, line 20-22
CREATE POLICY "Project repositories are publicly readable"
  ON project_repositories FOR SELECT
  USING (true);
```

The `20260808170000` migration's sweep only covered: `project_milestones`, `project_updates`, `project_discussions`, `discussion_replies`, `project_open_roles`, `project_activity`.

**Recommendation:** Replace the blanket SELECT policy with:
```sql
CREATE POLICY "Project repositories viewable by project visibility"
  ON project_repositories FOR SELECT
  USING (public.is_project_visible(project_id));
```

---

## P2 — Medium

### [P2] CSP allows `unsafe-inline` for scripts

**File(s):** `src/lib/security-headers.ts:14`

**Issue:** The Content Security Policy includes `'unsafe-inline'` for `script-src`, which weakens XSS protection.

**Risk:** If an XSS vulnerability exists, the attacker can inject inline scripts that bypass CSP. This is partially mitigated by:
- TanStack Start/React's JSX escaping
- The `'unsafe-eval'` is development-only
- Supabase's own script tags may require it

**Evidence:**
```typescript
`script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
```

**Recommendation:** Migrate to nonce-based CSP or hash-based CSP. React 19 supports CSP nonce propagation. This is a known limitation of SSR frameworks but should be addressed before production hardening.

---

### [P2] Authenticated route guard is client-side only

**File(s):** `src/routes/_authenticated/route.tsx:7,11-13`

**Issue:** The `_authenticated` layout route has `ssr: false` and checks auth via `supabase.auth.getUser()` in `beforeLoad`, which runs client-side. While this prevents casual browsing of authenticated pages, it does not protect server-side data access.

**Risk:** An unauthenticated user can view the HTML shell of authenticated routes (the route tree is public). The actual data protection comes from RLS on Supabase queries, not from this route guard. If any server function or data loader skips RLS, the client-side guard provides no protection.

**Evidence:**
```typescript
export const Route = createFileRoute("/_authenticated")({
  ssr: false,  // Client-side only
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
});
```

**Recommendation:** This is acceptable for the current architecture (TanStack Start with RLS-first design). The server functions use `requireSupabaseAuth` middleware which validates tokens server-side. The client-side guard is a UX convenience, not a security boundary. Document this clearly.

---

### [P2] No server-side password complexity enforcement

**File(s):** `src/routes/signup.tsx:77-78`, `src/routes/reset-password.tsx:83-84`

**Issue:** The password minimum length is 8 characters with no complexity requirements (uppercase, lowercase, numbers, symbols). This is client-side only; Supabase's password policy is not configured in `config.toml`.

**Risk:** Weak passwords are vulnerable to brute-force and credential-stuffing attacks. While Supabase has rate limiting on auth endpoints, weak passwords significantly reduce the time needed for successful attacks.

**Evidence:**
```typescript
// signup.tsx:77
if (password.length < 8) {
  errors.password = "Password must be at least 8 characters";
}
```

**Recommendation:** Add server-side password validation via Supabase's `auth.settings` or a custom signup trigger. Consider requiring at least one uppercase, one lowercase, and one number for passwords over 8 characters.

---

## P3 — Low

### [P3] `console.error` in auth middleware logs env var names

**File(s):** `src/integrations/supabase/auth-middleware.ts:46`

**Issue:** When environment variables are missing, the error message includes the variable names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`). This is logged to the server console.

**Risk:** Low. The variable names are not secrets, but in shared logging environments, this could reveal infrastructure configuration. The actual values are never logged.

**Evidence:**
```typescript
console.error(`[Supabase] ${message}`);
// message = "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY..."
```

**Recommendation:** Acceptable as-is for server-side logging. No action needed.

---

## Positives — What's Done Well

1. **RLS is comprehensive.** Nearly every table has RLS enabled with appropriate policies. The codebase shows systematic attention to RLS across 115 migration files.

2. **Private project visibility is enforced at the DB level.** The `is_project_visible()` SECURITY INVOKER function correctly gates access for private projects across milestones, updates, discussions, replies, open roles, and activity.

3. **Private community spaces are enforced.** The `20260818060000` migration correctly hides private space posts from non-members using `is_space_member()`.

4. **GitHub tokens are server-only.** The `user_github_tokens` table has no client RLS policies — only `service_role` access. The token never reaches the browser. This is the correct pattern for sensitive credentials.

5. **Membership privilege guards prevent self-elevation.** The `20260818070000` migration correctly blocks users from self-granting owner/moderator roles, team lead status, or accepted application status.

6. **Challenge review flow is enforced via SECURITY DEFINER trigger.** The `enforce_challenge_review_transition()` function prevents participants from reviewing their own submissions or awarding themselves badges.

7. **CSRF protection is in place.** The `createCsrfMiddleware` in `src/start.ts` blocks cross-site requests to server functions.

8. **Auth middleware properly validates JWT tokens.** The `requireSupabaseAuth` middleware extracts Bearer tokens, validates JWT structure (3 parts), calls `getClaims()`, and passes the verified user ID to downstream handlers.

9. **Open redirect protection is solid.** The `safeRedirectPath()` function in `validators.ts` blocks `//evil.com`, `\\evil.com`, and protocol-relative URLs. Used consistently in signup, login, and reset-password flows.

10. **Storage upload hardening is thorough.** The `20260820180000` migration adds server-side file type + size validation via `is_allowed_storage_upload()`, bucket-level `file_size_limit`, and `allowed_mime_types`. This closes the gap where client-side validation was the only defense.

11. **Post body/title/link constraints are enforced at the DB level.** CHECK constraints on `posts` prevent oversized content and `javascript:` / `data:` link injection.

12. **SECURITY DEFINER functions are used correctly to break RLS recursion.** The `is_session_organizer()`, `is_space_member()`, and `is_space_owner()` functions prevent circular RLS references while maintaining access control.

13. **Service-role client is properly isolated.** The `client.server.ts` module uses dynamic imports (`await import(...)`) to keep the service-role key out of client bundles. The comment warning is clear.

14. **No hardcoded secrets in source code.** The grep for hardcoded API keys, tokens, and passwords found zero matches in application code (only test fixtures and `.env`).

15. **No `console.log` leaks in server code.** All `console.error`/`console.warn` calls in `src/lib/` and `src/integrations/` log only non-sensitive information (env var names, error messages).

16. **`.env` is properly gitignored.** The `.gitignore` correctly excludes `.env` and `.env.*` while allowing `.env.example`.

17. **`as any` is only in auto-generated code.** The 25 instances of `as any` are all in `routeTree.gen.ts`, which is auto-generated by TanStack Router and gitignored.
