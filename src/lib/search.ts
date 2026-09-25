/**
 * PostgREST `.or()` search-term escaping — the single source of truth for
 * turning raw user input into a safe `ilike` filter value.
 *
 * PostgREST's `or` filter syntax gives five characters structural meaning
 * (`,` separates conditions, `(` `)` group them, `|` is the or-operator, and
 * `\` escapes). A raw term containing any of them can break the filter or
 * silently change its meaning — e.g. searching `react, hooks` is parsed as
 * two conditions against a nonexistent column. Percent signs would also
 * widen the match (SQL LIKE wildcards) rather than matching a literal `%`.
 *
 * GlobalSearch learned this the hard way; every `.or()` search site should go
 * through this helper (the `%` wrapping itself stays at the call site).
 */
export function escapeForOr(value: string): string {
  return value.replace(/[,%()\\|]/g, (c) => `\\${c}`);
}

/**
 * Minimum term length before a search query is allowed to hit the database.
 * Single-character terms fan out to ilike queries whose leading-wildcard
 * patterns match huge fractions of a table — the extra keystroke is
 * imperceptible; the query load drop is not (pg_trgm indexes back this
 * server-side).
 */
export const SEARCH_MIN_LENGTH = 2;
