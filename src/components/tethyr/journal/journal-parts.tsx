// The dev journal's building blocks, shared by the Notes dock's Log tab and
// the /journal page: write a line, show a line, copy the standup.
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ClipboardCopy, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  toLite,
  useAddJournalEntry,
  syncedRecently,
  useDeleteJournalEntry,
  useJournalEntries,
  useSyncProjectJournal,
  useUpdateJournalEntry,
  type JournalEntry,
} from "@/hooks/use-journal";
import { friendlyError } from "@/lib/error-message";
import {
  buildStandup,
  JOURNAL_BODY_MAX,
  JOURNAL_KINDS,
  kindLabel,
  sourceLabel,
  type JournalKind,
} from "@/lib/journal";
import { cn } from "@/lib/utils";

export const KIND_TONE: Record<JournalKind, string> = {
  did: "bg-[color-mix(in_oklab,var(--trust)_14%,transparent)] text-[color-mix(in_oklab,var(--trust)_70%,var(--foreground))]",
  fixed:
    "bg-[color-mix(in_oklab,var(--learning)_14%,transparent)] text-[color-mix(in_oklab,var(--learning)_70%,var(--foreground))]",
  decided:
    "bg-[color-mix(in_oklab,var(--ai)_14%,transparent)] text-[color-mix(in_oklab,var(--ai)_70%,var(--foreground))]",
  learned:
    "bg-[color-mix(in_oklab,var(--teaching)_14%,transparent)] text-[color-mix(in_oklab,var(--teaching)_70%,var(--foreground))]",
  stuck:
    "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-[color-mix(in_oklab,var(--destructive)_70%,var(--foreground))]",
  next: "bg-surface-elevated text-muted-foreground",
};

export function KindBadge({ kind }: { kind: JournalKind }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium",
        KIND_TONE[kind],
      )}
    >
      {kindLabel(kind)}
    </span>
  );
}

/** Pick a kind, write one line, Enter to log. */
export function JournalComposer({ compact = false }: { compact?: boolean }) {
  const { data: me } = useCurrentUser();
  const add = useAddJournalEntry();
  const [kind, setKind] = useState<JournalKind>("did");
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState("");
  const projects = (me?.projects ?? []).filter((p) => p.status !== "completed");
  const meta = JOURNAL_KINDS.find((k) => k.kind === kind)!;

  async function submit() {
    const text = body.trim();
    if (!text) return;
    try {
      await add.mutateAsync({ kind, body: text, project_id: projectId || null });
      setBody("");
    } catch (error) {
      toast.error(friendlyError(error, "Couldn't log that"));
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div role="radiogroup" aria-label="Kind" className="flex gap-1 overflow-x-auto pb-0.5">
        {JOURNAL_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cn(
              "h-6 shrink-0 rounded-full px-2.5 text-xs transition-colors",
              kind === k.kind
                ? cn("font-medium", KIND_TONE[k.kind])
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, JOURNAL_BODY_MAX))}
          placeholder={meta.placeholder}
          aria-label={`${meta.label} — one line`}
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <button
          type="submit"
          disabled={!body.trim() || add.isPending}
          className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Log
        </button>
      </div>
      {projects.length > 0 && (
        <Select
          value={projectId || "none"}
          onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Project"
            className={cn("h-8 text-xs", compact ? "w-full" : "w-full sm:w-64")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </form>
  );
}

/** One journal line with its kind, project, source and owner controls. */
export function JournalEntryRow({ entry }: { entry: JournalEntry }) {
  const update = useUpdateJournalEntry();
  const remove = useDeleteJournalEntry();
  const [open, setOpen] = useState(false);
  const via = sourceLabel(entry.source);
  const time = new Date(entry.occurred_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const resolved = entry.kind === "stuck" && !!entry.resolved_at;

  return (
    <li className="group flex items-start gap-2.5 py-2">
      <KindBadge kind={entry.kind} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm break-words", resolved && "text-muted-foreground line-through")}>
          {entry.source_url ? (
            <a
              href={entry.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="hover:underline"
            >
              {entry.body}
            </a>
          ) : (
            entry.body
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          <span>{time}</span>
          {entry.project && (
            <>
              <span aria-hidden>·</span>
              <Link
                to="/projects/$id"
                params={{ id: entry.project.id }}
                className="hover:text-foreground hover:underline"
              >
                {entry.project.title}
              </Link>
            </>
          )}
          {via && (
            <>
              <span aria-hidden>·</span>
              <span>via {via}</span>
            </>
          )}
          {entry.is_public && (
            <>
              <span aria-hidden>·</span>
              <span>on your profile</span>
            </>
          )}
          {entry.detail && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {open ? "hide detail" : "detail"}
            </button>
          )}
        </p>
        {open && entry.detail && (
          <p className="mt-1.5 rounded-md bg-surface-elevated/60 px-2.5 py-2 text-xs whitespace-pre-line">
            {entry.detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {entry.kind === "stuck" && (
          <button
            type="button"
            onClick={() =>
              update.mutate({
                id: entry.id,
                resolved_at: entry.resolved_at ? null : new Date().toISOString(),
              })
            }
            aria-label={entry.resolved_at ? "Mark as still stuck" : "Mark as unblocked"}
            title={entry.resolved_at ? "Still stuck" : "Unblocked"}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => update.mutate({ id: entry.id, is_public: !entry.is_public })}
          aria-pressed={entry.is_public}
          aria-label={entry.is_public ? "Hide from your profile" : "Show on your profile"}
          title={entry.is_public ? "Hide from your profile" : "Show on your profile"}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        >
          {entry.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this journal entry?")) remove.mutate(entry.id);
          }}
          aria-label="Delete entry"
          title="Delete"
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

const TEN_DAYS_AGO = () => new Date(Date.now() - 10 * 86_400_000).toISOString();

/** The standup text from the last ten days, and a button that copies it. */
export function useStandup() {
  const [from] = useState(TEN_DAYS_AGO);
  const { data: entries, isLoading } = useJournalEntries({ from });
  return { text: buildStandup(toLite(entries ?? [])), isLoading };
}

export function CopyStandupButton({ className }: { className?: string }) {
  const { text, isLoading } = useStandup();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Standup copied — paste it into Slack or Teams");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Couldn't copy — select the text instead.");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated disabled:opacity-50",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
      )}
      Copy my standup
    </button>
  );
}

/**
 * Pull feat/fix commits from your projects' repos into the journal. Runs on
 * its own when the journal opens (at most every 10 minutes on this device).
 */
export function ProjectSyncButton({ auto = false }: { auto?: boolean }) {
  const sync = useSyncProjectJournal();
  const [label, setLabel] = useState<string | null>(null);
  const run = useCallback(
    (quiet: boolean) =>
      sync.mutate(undefined, {
        onSuccess: (r) => {
          const text =
            r.repos === 0
              ? "No GitHub or GitLab repo linked to your projects yet"
              : r.added > 0
                ? `${r.added} new from your projects`
                : "Up to date with your projects";
          setLabel(text);
          if (!quiet && r.added > 0) toast.success(text);
        },
        onError: () => setLabel("Couldn't reach your repos just now"),
      }),
    [sync],
  );
  useEffect(() => {
    if (auto && !syncedRecently()) run(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => run(false)}
        disabled={sync.isPending}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} aria-hidden />
        Sync from projects
      </button>
      {label && <span>{label}</span>}
    </span>
  );
}
