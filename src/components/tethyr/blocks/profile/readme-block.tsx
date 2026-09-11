// ── Profile README Block ─────────────────────────────────────────────────────
// The member's long-form home document — the profile analogue of the project
// README. Content lives on `profiles.readme` (markdown) so it follows the
// member across devices and renders on their public Studio.
//
// Reading: react-markdown, with fenced code blocks promoted to the shared
// CodeBlock (highlighting + copy) exactly like the project README.
// Writing: the same rich Tiptap editor the project README uses, code-split so
// visitors never download it. Owners can also import their GitHub profile
// README (`<username>/<username>`) in one click.

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Download, Eye, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { CodeBlock } from "@/components/tethyr/project/code-block";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { fetchRepoReadmeServer, getConnectedGithubUsername } from "@/lib/github-server";
import { absolutizeRelativeLinks } from "@/lib/github";
import { cn } from "@/lib/utils";

// Tiptap + extensions are ~1 MB before gzip; a visitor reading a README should
// never pay for them. Loaded only when the owner opens the editor.
const ReadmeEditor = lazy(() =>
  import("@/components/tethyr/project/readme-editor").then((m) => ({ default: m.ReadmeEditor })),
);

type ProfileReadmeData = {
  readme: string | null;
  social_links: Record<string, string> | null;
};

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

/** Recover the fenced block's text + language from the `<pre>`'s `<code>` node. */
function blockCodeFromPre(node: HastNode | undefined): { code: string; language?: string } | null {
  const codeNode = node?.children?.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (!codeNode?.children?.length) return null;
  const code = codeNode.children
    .map((child) => (child.type === "text" ? (child.value ?? "") : ""))
    .join("");
  const rawClass = codeNode.properties?.className;
  const classes = Array.isArray(rawClass)
    ? rawClass.join(" ")
    : typeof rawClass === "string"
      ? rawClass
      : "";
  return { code: code.replace(/\n$/, ""), language: /language-([\w-]+)/.exec(classes)?.[1] };
}

/** Read-mode renderer: fenced blocks become copyable CodeBlocks, inline code
 *  keeps the theme's chip treatment (it never reaches this component). */
function MarkdownPre(props: React.ComponentProps<"pre">) {
  const node = (props as React.ComponentProps<"pre"> & { node?: HastNode }).node;
  const parsed = blockCodeFromPre(node);
  if (!parsed) return <pre {...props} />;
  return <CodeBlock code={parsed.code} language={parsed.language} />;
}

const MARKDOWN_COMPONENTS: Components = { pre: MarkdownPre };

/** Accept "octocat", "@octocat", "github.com/octocat", or a full profile URL. */
function extractGithubUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^@/, "");
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/github\.com\/([^/?#\s]+)/i);
  if (fromUrl) return fromUrl[1];
  if (/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(trimmed)) return trimmed;
  return null;
}

function ProfileReadmeBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, quickEdit, isOwner, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const canEdit = isOwner === true && (isEditing || quickEdit === true);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profile-readme", profileId],
    queryFn: async (): Promise<ProfileReadmeData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("readme, social_links")
        .eq("id", profileId)
        .maybeSingle();
      return (data as unknown as ProfileReadmeData | null) ?? null;
    },
    enabled: !!profileId,
  });

  const readme = data?.readme?.trim() ?? "";
  const showHeading = config.showHeading !== false;
  const hasReadme = !!readme;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");

  // Report emptiness so the public Studio collapses the band until it's written.
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasReadme);
  }, [blockId, hasReadme, isEditing, isLoading, onBlockEmptyChange]);

  const startEdit = useCallback(() => {
    setDraft(data?.readme ?? "");
    setView("write");
    setEditing(true);
  }, [data?.readme]);

  const save = useCallback(async () => {
    if (!profileId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ readme: draft.trim() || null })
      .eq("id", profileId);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile-readme", profileId] });
    setEditing(false);
    toast.success("README saved");
  }, [draft, profileId, queryClient]);

  const importFromGithub = useCallback(async () => {
    setImporting(true);
    try {
      let username: string | null = null;
      try {
        username = await getConnectedGithubUsername();
      } catch {
        username = null;
      }
      if (!username) username = extractGithubUsername(data?.social_links?.github);
      if (!username) {
        toast.error(
          "Add your GitHub link to your profile (or connect GitHub in Settings) to import",
        );
        return;
      }
      const fullName = `${username}/${username}`;
      const { text, rateLimited, unauthorized } = await fetchRepoReadmeServer({
        data: { fullName },
      });
      if (unauthorized) {
        toast.error("GitHub rejected the saved token — check it and try again");
        return;
      }
      if (rateLimited) {
        toast.error("GitHub is rate-limited right now — try again in a minute");
        return;
      }
      if (!text) {
        toast.error(`No README found at ${fullName} — create that repo on GitHub first`);
        return;
      }
      setDraft(absolutizeRelativeLinks(text, fullName, "HEAD"));
      setView("write");
      setEditing(true);
      toast.success("README imported — review it, then save");
    } catch {
      toast.error("Couldn't reach GitHub — try again");
    } finally {
      setImporting(false);
    }
  }, [data?.social_links]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data) return null;

  const editor = (
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-h-[min(90vh,46rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile README</DialogTitle>
          <DialogDescription>
            Your home document — what you make, how you work, and how people can build with you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-background/40 p-1">
          {(
            [
              { id: "write", label: "Write", icon: Pencil },
              { id: "preview", label: "Preview", icon: Eye },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                view === id
                  ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {view === "write" ? (
          <Suspense
            fallback={
              <div className="min-h-[24rem] animate-gentle-pulse rounded-xl border border-border/60 bg-background/60" />
            }
          >
            <ReadmeEditor content={draft} onChange={setDraft} />
          </Suspense>
        ) : (
          <div className="prose-custom min-h-[24rem] overflow-auto rounded-xl border border-border/40 bg-background/40 px-5 py-5">
            <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {draft || "_Nothing to preview yet._"}
            </Markdown>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={importFromGithub}
            disabled={importing}
            title="Import your GitHub profile README (username/username)"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Import from GitHub
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save README
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!hasReadme) {
    // Empty states belong to the full block editor (same as bio/skills) so the
    // public Studio and quick-edit view collapse the section instead of
    // leaving a prompt where the reader expects content.
    if (!isEditing) return null;
    return (
      <>
        <BlockEmptyState
          label="README"
          detail="the long-form story of what you make — what you're building, how you work, and how to collaborate"
          actionLabel="Write your README"
          onAction={startEdit}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {(showHeading || canEdit) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showHeading ? (
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              README
            </h4>
          ) : (
            <span />
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit README
            </Button>
          )}
        </div>
      )}
      <div className="prose-custom text-sm leading-relaxed text-foreground">
        <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {readme}
        </Markdown>
      </div>
      {editor}
    </div>
  );
}

registerBlock({
  type: "profile-readme",
  category: "people",
  label: "README",
  description: "The long-form introduction to you. Markdown, with GitHub profile README import.",
  icon: "FileText",
  defaults: { showHeading: true },
  fields: [{ key: "showHeading", label: "Show README heading", type: "toggle" }],
  component: ProfileReadmeBlock,
});

export { ProfileReadmeBlock };
