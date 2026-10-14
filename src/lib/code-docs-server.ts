// ── Code → docs (server) ──────────────────────────────────────────────────────
// • getProjectRepoOverview / getProjectRepoFile — read a project's GitHub repo
//   (tree, README, package.json, one file) for the free outline.
// • AI key (bring your own): save / remove / status. The key lives in
//   user_ai_keys (service role only) and never comes back to the browser.
// • explainWithAi — rewrite the outline (+ the code itself) into plain-language
//   docs with the member's own Anthropic key. Nothing is sent unless the
//   member presses the button.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchRepoFile, fetchRepoReadme, fetchWithTimeout } from "./github";
import { repoOverviewMarkdown, type RepoSnapshot } from "./repo-overview";
import { AI_MODELS, isAiModel as isModel } from "./ai-models";

/** Code sent to the AI is capped so one click can't run up a large bill. */
const MAX_SOURCE_CHARS = 120_000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The project's GitHub repo ("owner/name"), if the member may read it. */
async function projectRepo(userId: string, projectId: string) {
  const db = await admin();
  const { data: project } = await db
    .from("projects")
    .select("id, title, description, visibility, profile_id, links")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  if (project.visibility !== "public" && project.profile_id !== userId) {
    const { data: member } = await db
      .from("project_contributors")
      .select("profile_id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .maybeSingle();
    if (!member) return null;
  }
  const { data: repos } = await db
    .from("project_repositories")
    .select("url, provider")
    .eq("project_id", projectId)
    .eq("provider", "github")
    .limit(1);
  const links = (project.links ?? {}) as Record<string, unknown>;
  const url = repos?.[0]?.url ?? (typeof links.github === "string" ? links.github : null);
  const { repoPath } = await import("./project-journal-sync");
  const fullName = url ? repoPath(url, "github.com") : null;
  if (!fullName) return { project, fullName: null, token: undefined };
  // The owner's own token reads their private repos; anyone else gets the
  // public view only.
  let token: string | undefined;
  if (project.profile_id === userId) {
    const { data } = await db
      .from("user_github_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();
    token = data?.token ?? undefined;
  }
  if (!token) {
    const { publicGithubToken } = await import("./github-refresh");
    token = publicGithubToken();
  }
  return { project, fullName, token };
}

export const getProjectRepoOverview = createServerFn({ method: "POST" })
  .validator((d: { projectId: string }) => ({ projectId: String(d?.projectId ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const found = await projectRepo(context.userId, data.projectId);
    if (!found) return { ok: false as const, error: "Project not found." };
    if (!found.fullName)
      return {
        ok: false as const,
        error: "Link this project's GitHub repo in “Where it lives” first.",
      };
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (found.token) headers.Authorization = `Bearer ${found.token}`;
    const [treeRes, readme, pkg] = await Promise.all([
      fetchWithTimeout(
        `https://api.github.com/repos/${found.fullName}/git/trees/HEAD?recursive=1`,
        { headers },
      ),
      fetchRepoReadme(found.fullName, found.token),
      fetchRepoFile(found.fullName, "package.json", undefined, found.token),
    ]);
    if (!treeRes?.ok)
      return {
        ok: false as const,
        error:
          treeRes?.status === 404
            ? "Couldn't find that repo — is it private? Connect GitHub with a token in Settings."
            : "GitHub didn't answer — try again in a minute.",
      };
    const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
    let packageJson: RepoSnapshot["packageJson"] = null;
    try {
      packageJson = pkg.text ? JSON.parse(pkg.text) : null;
    } catch {
      packageJson = null;
    }
    const snapshot: RepoSnapshot = {
      name: found.project.title,
      description: found.project.description,
      readme: readme.text,
      packageJson,
      paths: (tree.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path),
      url: `https://github.com/${found.fullName}`,
    };
    return {
      ok: true as const,
      markdown: repoOverviewMarkdown(snapshot),
      repo: found.fullName,
      // What the AI pass gets as context (trimmed, never the whole repo).
      context: {
        readme: (readme.text ?? "").slice(0, 20_000),
        paths: snapshot.paths.slice(0, 600),
        packageJson: pkg.text?.slice(0, 8_000) ?? null,
      },
    };
  });

export const getProjectRepoFile = createServerFn({ method: "POST" })
  .validator((d: { projectId: string; path: string }) => ({
    projectId: String(d?.projectId ?? ""),
    path: String(d?.path ?? "")
      .trim()
      .replace(/^\/+/, "")
      .slice(0, 400),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    if (!data.path || data.path.includes(".."))
      return { ok: false as const, error: "Give a file path like src/lib/money.ts." };
    const found = await projectRepo(context.userId, data.projectId);
    if (!found?.fullName)
      return { ok: false as const, error: "This project has no GitHub repo linked yet." };
    const file = await fetchRepoFile(found.fullName, data.path, undefined, found.token);
    if (file.notFound) return { ok: false as const, error: `No file at ${data.path}.` };
    if (file.rateLimited)
      return { ok: false as const, error: "GitHub is rate limiting — try again soon." };
    if (!file.text)
      return { ok: false as const, error: "That file couldn't be read (binary or too big)." };
    return { ok: true as const, text: file.text, path: data.path, repo: found.fullName };
  });

/* ── Bring your own key ────────────────────────────────────────────────── */

export const getAiKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data } = await db
      .from("user_ai_keys")
      .select("api_key, model, provider")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data
      ? { hasKey: true, model: data.model, provider: data.provider, last4: data.api_key.slice(-4) }
      : { hasKey: false, model: AI_MODELS[0].id as string, provider: "anthropic", last4: null };
  });

export const saveAiKey = createServerFn({ method: "POST" })
  .validator((d: { apiKey?: string; model: string }) => ({
    apiKey: typeof d?.apiKey === "string" ? d.apiKey.trim() : "",
    model: isModel(d?.model) ? d.model : AI_MODELS[0].id,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const db = await admin();
    // Changing only the model keeps the saved key.
    let apiKey = data.apiKey;
    if (!apiKey) {
      const { data: existing } = await db
        .from("user_ai_keys")
        .select("api_key")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!existing) return { ok: false as const, error: "Paste your Anthropic API key." };
      apiKey = existing.api_key;
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    try {
      // A free call that proves the key works and can use the chosen model.
      await new Anthropic({ apiKey, maxRetries: 1 }).models.retrieve(data.model);
    } catch (error) {
      return { ok: false as const, error: aiErrorMessage(error, Anthropic) };
    }
    const { error } = await db.from("user_ai_keys").upsert({
      user_id: context.userId,
      provider: "anthropic",
      api_key: apiKey,
      model: data.model,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: "Couldn't save the key." };
    return { ok: true as const, last4: apiKey.slice(-4), model: data.model };
  });

export const removeAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await db.from("user_ai_keys").delete().eq("user_id", context.userId);
    return { ok: true as const };
  });

type AnthropicModule = typeof import("@anthropic-ai/sdk").default;

function aiErrorMessage(error: unknown, Anthropic: AnthropicModule): string {
  if (error instanceof Anthropic.AuthenticationError)
    return "Anthropic didn't accept that key — check it and paste it again.";
  if (error instanceof Anthropic.NotFoundError)
    return "Your key can't use that model — pick another one.";
  if (error instanceof Anthropic.PermissionDeniedError)
    return "Your Anthropic account can't make this request (check billing and limits).";
  if (error instanceof Anthropic.RateLimitError)
    return "Your Anthropic account is rate limited right now — try again in a minute.";
  if (error instanceof Anthropic.BadRequestError)
    return "Anthropic couldn't take that request — the code may be too long.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic — try again.";
  if (error instanceof Anthropic.APIError) return "Anthropic had a problem — try again shortly.";
  return "Something went wrong — try again.";
}

const SYSTEM = `You write developer documentation for Tethyr, where developers share what they build.
Write for a capable developer who is new to this code. Use plain, friendly language and short paragraphs.
Base everything strictly on the material provided. If something isn't shown, say it isn't clear from the code rather than guessing.
Never repeat secrets, keys or credentials if any appear — refer to them generically.
Reply with GitHub-flavoured Markdown only: no preamble, no closing remarks.`;

function filePrompt(filename: string, source: string, outline: string) {
  return `Document this file so someone new can understand and use it.

Structure:
# ${filename}
One short paragraph: what this file is for and where it fits.
## How it works — the flow, step by step.
## Key parts — each important function / class / type: what it does, what goes in, what comes out.
## How to use it — a short example based only on this file's own API (skip if it isn't meant to be used directly).
## Watch out for — side effects, edge cases, TODOs, anything surprising.

A pattern-based outline of the file (for reference):
<outline>
${outline}
</outline>

The file:
<file name="${filename}">
${source}
</file>`;
}

function projectPrompt(
  overview: string,
  ctx: { readme: string; paths: string[]; packageJson: string | null },
) {
  return `Write the "How this project works" page for new contributors.

Structure:
# How <project name> works
## What it is — two or three sentences.
## How it's put together — the main pieces and how they talk to each other, based on the folders and files.
## Run it locally — exact steps from the manifests/README.
## Where to start reading — the 3–6 files a newcomer should open first, and why.
## How to contribute — tests, conventions, anything the README or files say.

A pattern-based overview (for reference — improve on it):
<overview>
${overview}
</overview>

README:
<readme>
${ctx.readme || "(none)"}
</readme>

package.json:
<package_json>
${ctx.packageJson ?? "(none)"}
</package_json>

Files in the repository:
<paths>
${ctx.paths.join("\n")}
</paths>`;
}

export const explainWithAi = createServerFn({ method: "POST" })
  .validator(
    (d: {
      mode: "file" | "project";
      filename?: string;
      source?: string;
      outline?: string;
      overview?: string;
      context?: { readme: string; paths: string[]; packageJson: string | null };
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: key } = await db
      .from("user_ai_keys")
      .select("api_key, model")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!key) return { ok: false as const, error: "Add your own Anthropic key in Settings first." };

    let prompt: string;
    if (data.mode === "file") {
      const source = String(data.source ?? "");
      if (!source.trim()) return { ok: false as const, error: "There's no code to explain." };
      if (source.length > MAX_SOURCE_CHARS)
        return {
          ok: false as const,
          error: `That file is ${Math.round(source.length / 1000)}k characters — the AI step takes up to ${MAX_SOURCE_CHARS / 1000}k. Split it, or use the free outline.`,
        };
      prompt = filePrompt(
        String(data.filename ?? "file").slice(0, 200),
        source,
        String(data.outline ?? "").slice(0, 20_000),
      );
    } else {
      const ctx = data.context ?? { readme: "", paths: [], packageJson: null };
      prompt = projectPrompt(String(data.overview ?? "").slice(0, 20_000), {
        readme: String(ctx.readme ?? "").slice(0, 20_000),
        paths: (Array.isArray(ctx.paths) ? ctx.paths : []).slice(0, 600).map(String),
        packageJson: ctx.packageJson ? String(ctx.packageJson).slice(0, 8_000) : null,
      });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key.api_key, maxRetries: 1 });
    const model = isModel(key.model) ? key.model : AI_MODELS[0].id;
    try {
      // Streamed so a long answer can't hit the HTTP timeout.
      const message = await client.messages
        .stream({
          model,
          max_tokens: 16000,
          // Haiku 4.5 predates adaptive thinking; the others think as needed.
          ...(model === "claude-haiku-4-5" ? {} : { thinking: { type: "adaptive" as const } }),
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        })
        .finalMessage();
      if (message.stop_reason === "refusal")
        return { ok: false as const, error: "The AI declined to document this content." };
      const markdown = message.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("\n")
        .trim();
      if (!markdown) return { ok: false as const, error: "The AI returned nothing — try again." };
      return {
        ok: true as const,
        markdown,
        model,
        truncated: message.stop_reason === "max_tokens",
      };
    } catch (error) {
      return { ok: false as const, error: aiErrorMessage(error, Anthropic) };
    }
  });
