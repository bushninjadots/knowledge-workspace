import { BarChart3, Plus, X } from "lucide-react";

export function ComposerPoll({
  question,
  options,
  endsAt,
  onQuestionChange,
  onOptionsChange,
  onEndsAtChange,
}: {
  question: string;
  options: string[];
  endsAt: string;
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  onEndsAtChange: (value: string) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))]/60 bg-[var(--user-accent-subtle,var(--surface-elevated))] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-brand-purple" />
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple">
          Poll
        </span>
      </div>
      <input
        value={question}
        onChange={(e) => onQuestionChange(e.target.value.slice(0, 200))}
        placeholder="Ask a question…"
        aria-label="Poll question"
        className="mb-3 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
      />
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-[11px] tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <input
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value.slice(0, 100);
                onOptionsChange(next);
              }}
              placeholder={`Option ${i + 1}…`}
              aria-label={`Poll option ${i + 1}`}
              className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
            {options.length > 2 && (
              <button
                onClick={() => onOptionsChange(options.filter((_, j) => j !== i))}
                aria-label="Remove poll option"
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Ends</span>
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndsAtChange(e.target.value)}
          aria-label="Poll end date"
          className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
        />
        {endsAt && (
          <button
            onClick={() => onEndsAtChange("")}
            aria-label="Clear end date"
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <span className="text-[11px] text-muted-foreground">optional</span>
      </div>

      {options.length < 10 && (
        <button
          onClick={() => onOptionsChange([...options, ""])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add option
        </button>
      )}
    </div>
  );
}
