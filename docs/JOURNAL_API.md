# Dev journal API & MCP server

Members' own tools write to their dev journal with a personal access token
(`tth_…`, created on `/journal` → Connect your tools; only a SHA-256 hash is
stored). Code: `src/lib/journal-api.ts`, routed in `src/server.ts`. Schema:
`supabase/migrations/20261014160000_dev_journal.sql`.

## REST

```
POST /api/journal            Authorization: Bearer tth_…
{ "body": "…", "kind": "did|fixed|decided|learned|stuck|next",
  "project": "name or id", "detail": "…", "url": "https://…",
  "source": "cli", "public": false }
{ "entries": [ … up to 20 … ] }
{ "commit": "feat(auth): add SSO" }            # or Content-Type: text/plain body
GET  /api/journal?days=7     → { entries, standup }
```

Commits: `feat`/`perf`/`refactor` → did, `fix` → fixed; chores, docs, merges
are skipped unless tagged `[log]`. 300 entries/day per member, 20 per request.
Entries are private unless `public: true`.

## MCP (streamable HTTP, stateless, JSON responses)

`POST /api/mcp?client=<tool>` with the same bearer token. Tools:
`log_progress`, `wrap_up_session` (log a whole session's did / fixed /
decided / learned / stuck / next at once), `get_journal`, `draft_standup`,
`list_projects`. Prompts (slash commands in Claude Code): `wrap_up`,
`standup`. Shared entries filed under a project appear on its timeline. The
`client` query parameter becomes the entry's source ("via Cursor").
Cross-origin browser requests are refused.

Setup snippets for Claude Code, Cursor, VS Code, Windsurf, a git hook, the
terminal and Obsidian live in `src/lib/journal-connect.ts`.
