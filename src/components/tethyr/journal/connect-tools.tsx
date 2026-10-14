// "Connect your tools": personal access tokens and copy-paste setup for AI
// coding assistants (MCP), git hooks, the terminal and Obsidian. Lives on the
// journal page.
import { useState } from "react";
import { Check, Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateJournalToken,
  useJournalTokens,
  useRevokeJournalToken,
} from "@/hooks/use-journal";
import { CONNECT_TARGETS, TOKEN_PLACEHOLDER } from "@/lib/journal-connect";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text instead.");
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function ConnectTools() {
  const { data: tokens } = useJournalTokens();
  const create = useCreateJournalToken();
  const revoke = useRevokeJournalToken();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [target, setTarget] = useState(CONNECT_TARGETS[0].id);
  const origin = typeof window === "undefined" ? "https://tethyr.com" : window.location.origin;
  const active = CONNECT_TARGETS.find((t) => t.id === target) ?? CONNECT_TARGETS[0];
  const snippet = active.snippet(origin, fresh ?? TOKEN_PLACEHOLDER);

  async function makeToken() {
    const result = await create.mutateAsync(name.trim() || active.label).catch(() => null);
    if (!result?.ok) {
      toast.error(result && !result.ok ? result.error : "Couldn't create the token.");
      return;
    }
    setFresh(result.token);
    setName("");
  }

  return (
    <section aria-labelledby="connect-tools" className="surface-card space-y-5 p-4 sm:p-5">
      <div>
        <h2 id="connect-tools" className="flex items-center gap-2 font-semibold">
          <Plug className="h-4 w-4 text-muted-foreground" aria-hidden />
          Connect your tools
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Let the tools you build with write your journal for you — your AI coding assistant logs
          the important parts of a session, git logs your features and fixes, wherever your code
          lives. Entries stay private until you share them.
        </p>
      </div>

      {/* Token */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> 1. Create an access token
        </h3>
        {fresh ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface-elevated/50 p-3">
            <p className="text-xs font-medium">
              Your new token — copy it now, it won't be shown again. It's already filled into the
              setup below.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2 py-1.5 font-mono text-xs">
                {fresh}
              </code>
              <CopyButton value={fresh} />
            </div>
          </div>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void makeToken();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder={`Name it (e.g. "${active.label} on my laptop")`}
              aria-label="Token name"
              className="min-w-0 flex-1 basis-56"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="rounded-full"
              busy={create.isPending}
            >
              Create token
            </Button>
          </form>
        )}
        {(tokens?.length ?? 0) > 0 && (
          <ul className="divide-y divide-border/50 text-sm">
            {tokens!.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    <code className="font-mono">{t.prefix}</code> ·{" "}
                    {t.last_used_at ? `used ${timeAgo(t.last_used_at)}` : "never used"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Revoke “${t.name}”? Tools using it stop working.`))
                      revoke.mutate(t.id);
                  }}
                  aria-label={`Revoke ${t.name}`}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Setup */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">2. Add it to your tool</h3>
        <div role="tablist" aria-label="Tool" className="flex flex-wrap gap-1.5">
          {CONNECT_TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={target === t.id}
              onClick={() => setTarget(t.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                target === t.id
                  ? "border-border-strong bg-surface-elevated font-medium text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-surface-elevated/50 px-3 py-1.5">
            <span className="truncate text-xs text-muted-foreground">{active.where}</span>
            <CopyButton value={snippet} />
          </div>
          <pre className="overflow-x-auto bg-background/60 p-3 font-mono text-xs leading-relaxed">
            {snippet}
          </pre>
        </div>
        {active.note && <p className="text-xs text-muted-foreground">{active.note}</p>}
        <p className="text-xs text-muted-foreground">
          Using Notion? Copy the brag doc as Markdown and paste it into a page — Notion keeps the
          formatting. Want to share a week on LinkedIn or X? Post it from the Ship log.
        </p>
      </div>
    </section>
  );
}
