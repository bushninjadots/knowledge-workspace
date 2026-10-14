// ── Journal API + MCP server ──────────────────────────────────────────────────
// How a member's own tools write to their dev journal, with a personal access
// token (journal-tokens.ts) as `Authorization: Bearer tth_…`:
//
//   POST /api/journal        { body, kind?, project?, detail?, url?, source?, public? }
//                            or { entries: [...] } (up to 20), or { commit, url? }
//                            from a git hook (only feat/fix/[log] commits land)
//   GET  /api/journal?days=7 recent entries + today's standup
//   POST /api/mcp            Model Context Protocol (streamable HTTP, JSON
//                            responses, stateless) for AI coding assistants —
//                            Claude Code, Cursor, VS Code, Windsurf, …
//
// Runs on the server with the service role, so every write is pinned to the
// token's owner here and the database trigger still checks projects/dates.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildStandup,
  entryLine,
  isJournalKind,
  JOURNAL_BODY_MAX,
  JOURNAL_DETAIL_MAX,
  JOURNAL_KINDS,
  normalizeSource,
  parseCommitMessage,
  type JournalEntryLite,
  type JournalKind,
} from "./journal";
import { hashToken, looksLikeToken } from "./journal-tokens";

type Admin = SupabaseClient<Database>;

const DAILY_LIMIT = 300;
const BATCH_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

/** The token's owner, or null. Touches last_used_at. */
async function authenticate(db: Admin, request: Request): Promise<string | null> {
  const raw = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!looksLikeToken(raw)) return null;
  const { data } = await db
    .from("journal_tokens")
    .select("id, user_id")
    .eq("token_hash", await hashToken(raw))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  void db
    .from("journal_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);
  return data.user_id;
}

type Project = { id: string; title: string };

/** Projects the member created or contributes to. */
async function memberProjects(db: Admin, userId: string): Promise<Project[]> {
  const [{ data: own }, { data: joined }] = await Promise.all([
    db.from("projects").select("id, title").eq("profile_id", userId).limit(100),
    db
      .from("project_contributors")
      .select("project:projects(id, title)")
      .eq("profile_id", userId)
      .limit(100),
  ]);
  const list = [...(own ?? [])];
  for (const row of joined ?? []) {
    const p = (row as unknown as { project: Project | null }).project;
    if (p && !list.some((x) => x.id === p.id)) list.push(p);
  }
  return list;
}

function matchProject(projects: Project[], ref: unknown): string | null {
  if (typeof ref !== "string" || !ref.trim()) return null;
  const wanted = ref.trim().toLowerCase();
  if (UUID.test(wanted)) return projects.find((p) => p.id === wanted)?.id ?? null;
  return (
    projects.find((p) => p.title.toLowerCase() === wanted)?.id ??
    projects.find((p) => p.title.toLowerCase().includes(wanted))?.id ??
    null
  );
}

type Insert = Database["public"]["Tables"]["journal_entries"]["Insert"];

/** Validate one incoming entry. A string is an error message; null = skip. */
function toInsert(
  input: unknown,
  userId: string,
  projects: Project[],
  defaultSource: string,
): Insert | string | null {
  if (!input || typeof input !== "object") return "Each entry must be an object.";
  const raw = input as Record<string, unknown>;
  let kind: JournalKind = isJournalKind(raw.kind) ? raw.kind : "did";
  let body =
    typeof raw.body === "string" ? raw.body : typeof raw.summary === "string" ? raw.summary : "";
  if (typeof raw.commit === "string") {
    const parsed = parseCommitMessage(raw.commit);
    if (!parsed) return null;
    kind = parsed.kind;
    body = parsed.body;
  }
  body = body.replace(/\s+/g, " ").trim();
  if (!body) return "`body` is required.";
  if (body.length > JOURNAL_BODY_MAX) body = `${body.slice(0, JOURNAL_BODY_MAX - 1)}…`;
  const detail =
    typeof raw.detail === "string" && raw.detail.trim()
      ? raw.detail.trim().slice(0, JOURNAL_DETAIL_MAX)
      : null;
  const url =
    typeof raw.url === "string" && /^https:\/\/\S+$/i.test(raw.url.trim()) && raw.url.length <= 500
      ? raw.url.trim()
      : null;
  const occurred =
    typeof raw.occurred_at === "string" && !Number.isNaN(Date.parse(raw.occurred_at))
      ? new Date(raw.occurred_at).toISOString()
      : undefined;
  return {
    author_id: userId,
    kind,
    body,
    detail,
    source_url: url,
    project_id: matchProject(projects, raw.project),
    source: normalizeSource(raw.source, defaultSource),
    is_public: raw.public === true,
    ...(occurred ? { occurred_at: occurred } : {}),
  };
}

type AddResult =
  { ok: true; ids: string[]; skipped: number } | { ok: false; status: number; error: string };

async function addEntries(
  db: Admin,
  userId: string,
  inputs: unknown[],
  defaultSource: string,
): Promise<AddResult> {
  if (inputs.length === 0) return { ok: false, status: 400, error: "No entries." };
  if (inputs.length > BATCH_LIMIT)
    return { ok: false, status: 400, error: `At most ${BATCH_LIMIT} entries at a time.` };
  const projects = await memberProjects(db, userId);
  const rows: Insert[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const row = toInsert(input, userId, projects, defaultSource);
    if (typeof row === "string") return { ok: false, status: 400, error: row };
    if (row) rows.push(row);
    else skipped += 1;
  }
  if (rows.length === 0) return { ok: true, ids: [], skipped };

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) + rows.length > DAILY_LIMIT)
    return { ok: false, status: 429, error: "Daily journal limit reached. Try again tomorrow." };

  const { data, error } = await db.from("journal_entries").insert(rows).select("id");
  if (error) return { ok: false, status: 400, error: "Couldn't save that entry." };
  return { ok: true, ids: (data ?? []).map((r) => r.id), skipped };
}

type EntryRow = {
  id: string;
  kind: JournalKind;
  body: string;
  detail: string | null;
  occurred_at: string;
  resolved_at: string | null;
  source: string;
  source_url: string | null;
  is_public: boolean;
  project: { title: string } | null;
};

async function recentEntries(db: Admin, userId: string, days: number) {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 30) * 86_400_000).toISOString();
  const { data } = await db
    .from("journal_entries")
    .select(
      "id, kind, body, detail, occurred_at, resolved_at, source, source_url, is_public, project:projects(title)",
    )
    .eq("author_id", userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as EntryRow[]).map((r) => ({
    ...r,
    project_title: r.project?.title ?? null,
  }));
}

const lite = (rows: (EntryRow & { project_title: string | null })[]): JournalEntryLite[] =>
  rows.map((r) => ({
    kind: r.kind,
    body: r.body,
    occurred_at: r.occurred_at,
    project_title: r.project_title,
    resolved_at: r.resolved_at,
    source_url: r.source_url,
  }));

/* ── REST ──────────────────────────────────────────────────────────────── */

export async function handleJournalApi(request: Request): Promise<Response> {
  const db = await admin();
  const userId = await authenticate(db, request);
  if (!userId)
    return json({ error: "Invalid or missing token." }, 401, {
      "www-authenticate": 'Bearer realm="tethyr"',
    });

  if (request.method === "GET") {
    const days = Number(new URL(request.url).searchParams.get("days") ?? 7) || 7;
    const rows = await recentEntries(db, userId, days);
    return json({
      entries: rows.map(({ project: _p, ...r }) => r),
      standup: buildStandup(lite(rows)),
    });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let payload: unknown;
  // A git hook can pipe the commit message straight in as text/plain.
  if ((request.headers.get("content-type") ?? "").startsWith("text/plain")) {
    const message = (await request.text()).slice(0, 10_000);
    const repoUrl = new URL(request.url).searchParams.get("url");
    payload = { commit: message, ...(repoUrl ? { url: repoUrl } : {}) };
  } else {
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Send JSON (or a commit message as text/plain)." }, 400);
    }
  }
  const inputs = Array.isArray((payload as { entries?: unknown })?.entries)
    ? ((payload as { entries: unknown[] }).entries ?? [])
    : [payload];
  const isCommit = inputs.some((i) => typeof (i as { commit?: unknown })?.commit === "string");
  const result = await addEntries(db, userId, inputs, isCommit ? "git" : "api");
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ids: result.ids, skipped: result.skipped }, result.ids.length ? 201 : 200);
}

/* ── MCP ───────────────────────────────────────────────────────────────── */

const MCP_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const MCP_TOOLS = [
  {
    name: "log_progress",
    title: "Log progress to Tethyr",
    description:
      "Record a meaningful piece of progress in the user's Tethyr dev journal. Call it when you and the user finish something worth remembering: a feature working, a bug fixed (and its cause), a design decision and why, something learned, a blocker, or the next step. Not for every edit — a few times per session at most. Write one plain-language sentence a teammate would understand. Never include secrets, keys, credentials, personal or customer data, or proprietary code. Entries are private unless `public` is true; only set it when the user asks.",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One sentence, under 200 characters: what happened.",
          maxLength: JOURNAL_BODY_MAX,
        },
        kind: {
          type: "string",
          enum: JOURNAL_KINDS.map((k) => k.kind),
          description:
            "did = built/shipped, fixed = bug fixed, decided = design decision, learned = new knowledge, stuck = blocker, next = next step.",
        },
        project: {
          type: "string",
          description: "Tethyr project name, if the work belongs to one (see list_projects).",
        },
        detail: {
          type: "string",
          description: "Optional extra context: the why, the cause, trade-offs (a few lines).",
          maxLength: JOURNAL_DETAIL_MAX,
        },
        url: { type: "string", description: "Optional https link (PR, issue, docs)." },
        public: { type: "boolean", description: "Show on the user's profile. Default false." },
      },
      required: ["summary", "kind"],
    },
  },
  {
    name: "get_journal",
    title: "Read recent journal",
    description:
      "Read the user's recent Tethyr journal entries — useful to recall what was done, decided or left unfinished in earlier sessions.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days back (1–30). Default 7." },
      },
    },
  },
  {
    name: "draft_standup",
    title: "Draft standup",
    description:
      "Write the user's standup (Yesterday / Today / Blockers) from their journal, ready to paste.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_projects",
    title: "List Tethyr projects",
    description: "The user's Tethyr projects, to file journal entries under the right one.",
    inputSchema: { type: "object", properties: {} },
  },
];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: unknown };

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});
const text = (value: string, isError = false) => ({
  content: [{ type: "text", text: value }],
  ...(isError ? { isError: true } : {}),
});

async function callTool(
  db: Admin,
  userId: string,
  name: string,
  args: Record<string, unknown>,
  client: string,
) {
  if (name === "log_progress") {
    const result = await addEntries(db, userId, [{ ...args, source: client }], client);
    if (!result.ok) return text(result.error, true);
    const kind = isJournalKind(args.kind) ? args.kind : "did";
    return text(
      `Logged to Tethyr (${kind}): ${String(args.summary ?? "").slice(0, 200)}${args.public === true ? " — shown on profile" : " — private"}`,
    );
  }
  if (name === "get_journal") {
    const rows = await recentEntries(db, userId, Number(args.days) || 7);
    if (!rows.length) return text("No journal entries in that period.");
    return text(
      rows
        .map(
          (r) =>
            `${r.occurred_at.slice(0, 10)} [${r.kind}] ${entryLine({ ...r, project_title: r.project_title }, true)}${r.detail ? `\n    ${r.detail.replace(/\n/g, "\n    ")}` : ""}`,
        )
        .join("\n"),
    );
  }
  if (name === "draft_standup") {
    return text(buildStandup(lite(await recentEntries(db, userId, 10))));
  }
  if (name === "list_projects") {
    const projects = await memberProjects(db, userId);
    return text(
      projects.length ? projects.map((p) => `- ${p.title}`).join("\n") : "No projects yet.",
    );
  }
  return null;
}

async function handleRpc(
  db: Admin,
  userId: string,
  msg: RpcRequest,
  client: string,
): Promise<object | null> {
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case "initialize": {
      const requested = (msg.params as { protocolVersion?: string } | undefined)?.protocolVersion;
      return rpcResult(msg.id, {
        protocolVersion: MCP_VERSIONS.includes(requested ?? "") ? requested : MCP_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "tethyr", title: "Tethyr dev journal", version: "1.0.0" },
        instructions:
          "Tethyr is the user's dev journal. When a meaningful unit of work is done (feature, fix, decision, learning, blocker, next step), call log_progress with one short plain-language sentence. Don't log every edit, and never log secrets or proprietary code. Use get_journal to recall earlier sessions.",
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const result = await callTool(db, userId, params.name ?? "", params.arguments ?? {}, client);
      return result
        ? rpcResult(msg.id, result)
        : rpcError(msg.id, -32602, `Unknown tool: ${params.name}`);
    }
    default:
      if (isNotification) return null; // notifications/initialized, cancelled, …
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "GET" || request.method === "DELETE")
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (request.method !== "POST") return json(rpcError(null, -32600, "POST only"), 405);

  // Browsers must not be able to drive this from another site.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json(rpcError(null, -32600, "Origin not allowed"), 403);

  const db = await admin();
  const userId = await authenticate(db, request);
  if (!userId)
    return json(rpcError(null, -32001, "Invalid or missing Tethyr token"), 401, {
      "www-authenticate": 'Bearer realm="tethyr"',
    });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const client = normalizeSource(new URL(request.url).searchParams.get("client"), "mcp");
  const messages = (Array.isArray(payload) ? payload : [payload]) as RpcRequest[];
  const replies: object[] = [];
  for (const msg of messages.slice(0, 20)) {
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      replies.push(rpcError(msg?.id, -32600, "Invalid request"));
      continue;
    }
    const reply = await handleRpc(db, userId, msg, client);
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return json(Array.isArray(payload) ? replies : replies[0]);
}
