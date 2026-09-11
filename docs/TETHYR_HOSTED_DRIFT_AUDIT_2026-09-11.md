# Hosted Database Drift Audit (2026-09-11)

> **Scope:** the hosted Supabase project (`mfeinmphbsnjcchkmldi`, West Europe / London) measured
> against this repository's migration history. Prompted by the three hardening regressions found
> and fixed the same day in
> [`20260911130000_restore_clobbered_hardening.sql`](../supabase/migrations/20260911130000_restore_clobbered_hardening.sql).
> This is a point-in-time finding, not a standing audit. Read alongside
> [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) §3, which recorded an earlier instance of the same
> failure mode and marked it resolved.

## Verdict

**The hosted schema is not what the migration history produces, and `supabase db push` cannot
repair it.** Two migrations are recorded in the hosted history as applied but never took effect
there. Their objects are absent — including a policy that restricts a storage bucket to signed-in
users and the only guard against rewriting a connection's parties. Because the history rows exist,
no future `db push` will re-run them; only a new forward migration can restore the intended state.

The repository's local test suite cannot detect any of this: it runs against the local database,
where these migrations _did_ apply, so the local state is correct and green.

## Method

```bash
# Schema-only dumps of both databases (the local DB is the proxy for "what migrations produce")
npx supabase db dump --linked -s public,storage -f remote_schema.sql
npx supabase db dump --local  -s public,storage -f local_schema.sql
```

Two comparisons were then run over the results:

1. **Statement set diff** — every security-relevant statement (`CREATE POLICY`, `GRANT`, `REVOKE`,
   `CREATE FUNCTION`, `ALTER TABLE ... ROW LEVEL SECURITY`, `CREATE INDEX`) normalized for
   whitespace and diffed between the two dumps. 1 121 remote statements, 1 180 local, 1 113
   identical.
2. **Live-object presence scan** — every migration parsed in timestamp order to build the set of
   objects that _should_ exist (creations minus later drops: 413 objects — policies, functions,
   indexes), then each name checked against the remote dump. **6 of 413 are absent remotely.**

## Findings

### F1 — `skill-proofs` is world-readable on the hosted database (high)

|        | definition on hosted                                                                                                                    | definition per migrations                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Policy | `"Skill proof files are publicly accessible"` — `FOR SELECT USING (bucket_id = 'skill-proofs')`, **no role clause, so `anon` included** | `"Skill proof files readable by authenticated users"` — `FOR SELECT TO authenticated` |

`20260706100000_security_hardening.sql` drops the public policy and replaces it with the
authenticated-only one. On the hosted database the replacement never happened, so skill proof
objects (certificates, PDFs, their storage paths, owners, and sizes) can be listed by anonymous
clients. The same migration also runs
`UPDATE storage.buckets SET public = false WHERE id = 'skill-proofs'` — that is a **row** in
`storage.buckets`, and a schema-only dump cannot show whether it landed. Given the policy above did
not, treat the bucket's public flag as unverified and confirm it in the dashboard.

### F2 — connection integrity guards are missing on the hosted database (medium)

Three objects from `20260705022445` are absent remotely while their migration is recorded as
applied:

- `public.trg_connections_immutable_fields()` — the trigger function enforcing that
  `requester_id`, `addressee_id`, and `created_at` are immutable (0 occurrences in the remote dump,
  6 locally). The `connections_immutable` trigger depends on it. _Trigger DDL is not present in
  these dumps at all — see Limitations — so the function's absence is the evidence here._
- The tightened `"Addressee can respond"` policy. Hosted still carries the earlier unrestricted
  version:

  ```sql
  -- hosted: any status, any transition
  USING      (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id)

  -- per migrations: pending -> accepted/declined only
  USING      (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted','declined'))
  ```

Individually each is survivable. Together, an addressee who can rewrite any of their own connection
rows (`requester_id`, `created_at`, `status` — the `WITH CHECK` on `addressee_id` still holds) can
forge who invited them and force a connection out of `declined`.

Both are behaviourally pinned locally — test 4 of
[`rls_regression.sql`](../supabase/tests/rls_regression.sql) asserts the trigger blocks a
`requester_id` tamper, and tests 5–6 assert the transition rule. The suite passes. **That is the
point of this finding:** the local suite is green while the hosted database lacks the guard it
verifies. Local tests cannot see remote drift.

### F3 — `increment_usage_count` is executable by `anon` on the hosted database (low)

Hosted carries `GRANT ALL ON FUNCTION public.increment_usage_count(uuid) TO anon`.
`20260829110000_security_advisor_function_hardening.sql` revokes it and
`20260901090037` re-grants only to `authenticated`. The function is `SECURITY DEFINER` but
`SET search_path = ''` with a fully-qualified body that only bumps
`layouts.usage_count` for public templates, so this is a counter-inflation nuisance rather than a
privilege boundary — anonymous traffic can inflate template popularity.

### F4 — four indexes are missing on the hosted database (low)

Created by `20260706100000_security_hardening.sql`, absent remotely:
`profile_skills_teach_profile_idx`, `profile_skills_learn_profile_idx`,
`profile_skills_wishlist_profile_idx`, `skill_endorsements_skill_idx`. These back the
profile-skills and endorsements reads; their absence is a query-plan regression, not a correctness
one.

### F5 — remote-only statements with no corresponding migration (informational)

Four of the eight remote-only statements are Supabase platform-managed and expected:
`REVOKE`/`GRANT ALL` on `storage.buckets` and `storage.objects` for `supabase_storage_admin`.

### F6 — `project_contributors` policy differs in the harmless direction (informational)

`"Owner can add contributor"` is `FOR INSERT TO authenticated` on hosted but `FOR INSERT` (all
roles) in the migrations. The migrations are the looser of the two, but the `WITH CHECK` requires
`p.profile_id = auth.uid()`, which is `NULL` for `anon`, so `anon` can never satisfy it. Worth
aligning for hygiene — say `TO authenticated` explicitly — but not exploitable.

## Root cause

The same mechanism as the three regressions fixed earlier today, in a more damaging form.

Migration files with UUID names (`20260705022445_ed8539e8…`, `20260706100000`, and the Sep 4–6
batch) were generated by the v0/Lovable agent and pushed to the hosted database **as it produced
them**, not in the timestamp order the files now encode. Out-of-order application changes the final
state of any migration that guards with `IF NOT EXISTS` / `IF EXISTS`, drops-then-creates a policy,
or grants privileges that a later-dated file revokes.

`20260904132208` even documents the hazard in a comment — _"later security migrations may have
intentionally tightened its predicate"_ — while its own blanket `GRANT` on `connected_accounts` did
exactly the opposite. Two effects are now proven on the hosted database:

- **Recorded but never landed.** `20260705022445` and `20260706100000` each have a history row and
  (nearly) none of their objects. This is precisely the failure documented as resolved in
  `KNOWN_ISSUES.md` §3 — it recurred for a different object set.
- **Landed then overwritten.** `connected_accounts` (fixed today) kept a replay's blanket grant
  after the revoke that should have followed it.

## Limitations

- **Triggers are not in these dumps.** `supabase db dump` emits no trigger DDL for either database
  (verified: the local database has 91 non-internal triggers in `public`/`storage`, the dumps
  contain zero `CREATE TRIGGER` statements). Trigger drift on the hosted database is therefore
  **unmeasured** by this audit. F2 is inferred from the missing trigger function.
- **Row data is out of scope.** `storage.buckets.public`, `file_size_limit`, and the
  `supabase_migrations` history itself are rows, not schema.
- **The local database is a proxy** for "what migrations produce". Where the two disagree, this
  report states the direction of the difference and why the migration text supports the local
  version; it does not assume the local database is authoritative for objects created outside
  migrations.
- **`sandbox_exec` grants appear local-only** (≈40 statements). That role is Base44/Freebuff
  scaffolding that exists locally; the hosted project does not have it, so those statements do not
  reproduce there. Not a finding.

## Recommended follow-up

No fix has been applied. The three security-relevant divergences (F1, F2, F3) need a single forward
migration that re-asserts the intended state — the same shape as today's
`restore_clobbered_hardening` — because the history rows block any replay. It should:

1. Restore the `skill-proofs` policy to `TO authenticated` and confirm the bucket's public flag.
2. Restore `trg_connections_immutable_fields()` and the `connections_immutable` trigger, then the
   `pending → accepted/declined` transition rule.
3. `REVOKE EXECUTE ON FUNCTION public.increment_usage_count(uuid) FROM anon` and re-create the four
   indexes.

Beyond the immediate fix, two things would stop this recurring: a `db push` discipline that never
ships files whose timestamps precede the newest applied migration, and a way to see trigger drift,
which the current dump-based method cannot.
