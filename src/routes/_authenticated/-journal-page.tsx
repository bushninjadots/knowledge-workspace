// The dev journal, full size: log, the month's entries by day, today's
// standup, the monthly brag doc (copy / download as Markdown) and connecting
// the tools that write to it.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/tethyr/page-header";
import { ConnectTools } from "@/components/tethyr/journal/connect-tools";
import {
  CopyStandupButton,
  JournalComposer,
  JournalEntryRow,
  KIND_TONE,
  useStandup,
} from "@/components/tethyr/journal/journal-parts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toLite, useJournalEntries } from "@/hooks/use-journal";
import {
  bragDocMarkdown,
  dayLabel,
  groupByDay,
  JOURNAL_KINDS,
  monthLabel,
  monthRange,
  type JournalKind,
} from "@/lib/journal";
import { cn } from "@/lib/utils";

export function JournalPage() {
  const { data: me } = useCurrentUser();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [kind, setKind] = useState<JournalKind | "all">("all");
  const [from, to] = monthRange(cursor.year, cursor.month);
  const { data: entries, isLoading } = useJournalEntries({ from, to });
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const label = monthLabel(cursor.year, cursor.month);

  const shown = useMemo(
    () => (entries ?? []).filter((e) => kind === "all" || e.kind === kind),
    [entries, kind],
  );
  const days = groupByDay(shown);
  const name = me?.profile?.display_name || me?.profile?.handle || null;
  const brag = bragDocMarkdown(toLite(entries ?? []), `Brag doc — ${label}`, name);
  const counts = useMemo(() => {
    const c: Partial<Record<JournalKind, number>> = {};
    for (const e of entries ?? []) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries]);

  function step(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function download() {
    const blob = new Blob([brag], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brag-doc-${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dev journal"
        description="Log a line as you work — what you did, fixed, decided, learned, where you're stuck. Tethyr turns it into your standup, your weekly ship and your monthly brag doc, and your tools can log for you. Private unless you share an entry."
        actions={<CopyStandupButton />}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Log" className="surface-card p-4 sm:p-5">
            <JournalComposer />
          </section>

          <section aria-labelledby="journal-month" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Previous month"
                  onClick={() => step(-1)}
                >
                  <ChevronLeft />
                </Button>
                <h2 id="journal-month" className="min-w-36 text-center text-sm font-semibold">
                  {label}
                </h2>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Next month"
                  disabled={isCurrentMonth}
                  onClick={() => step(1)}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Show">
                {[{ kind: "all" as const, label: "All" }, ...JOURNAL_KINDS].map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    role="radio"
                    aria-checked={kind === k.kind}
                    onClick={() => setKind(k.kind)}
                    className={cn(
                      "h-6 rounded-full px-2.5 text-xs transition-colors",
                      kind === k.kind
                        ? k.kind === "all"
                          ? "bg-surface-elevated font-medium text-foreground"
                          : cn("font-medium", KIND_TONE[k.kind])
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {k.label}
                    {k.kind !== "all" && counts[k.kind] ? (
                      <span className="ml-1 tabular-nums opacity-70">{counts[k.kind]}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : days.length === 0 ? (
              <div className="surface-panel px-6 py-12 text-center">
                <p className="font-medium">
                  {kind === "all" ? `Nothing logged in ${label}` : "Nothing of that kind"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {isCurrentMonth
                    ? "Start with one line above — or connect your AI assistant or git below and let them log the important parts for you."
                    : "Try another month."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {days.map((d) => (
                  <section key={d.day} className="surface-card px-4 py-2 sm:px-5">
                    <h3 className="pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {dayLabel(d.day)}
                    </h3>
                    <ul className="divide-y divide-border/40">
                      {d.entries.map((entry) => (
                        <JournalEntryRow key={entry.id} entry={entry} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <StandupCard />

          <section aria-labelledby="brag-doc" className="surface-card space-y-3 p-4">
            <div>
              <h2 id="brag-doc" className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                Brag doc · {label}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Everything you shipped, fixed, decided and learned this month — for reviews, 1:1s,
                your CV, or your Obsidian vault and Notion (both take Markdown as-is).
              </p>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {brag}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(brag);
                    toast.success("Brag doc copied as Markdown");
                  } catch {
                    toast.error("Couldn't copy — select the text instead.");
                  }
                }}
              >
                Copy Markdown
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={download}>
                <Download /> Download .md
              </Button>
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-8">
        <ConnectTools />
      </div>
    </PageContainer>
  );
}

function StandupCard() {
  const { text, isLoading } = useStandup();
  return (
    <section aria-labelledby="standup" className="surface-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="standup" className="font-semibold">
          Today's standup
        </h2>
        <CopyStandupButton />
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <pre className="rounded-lg bg-background/60 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </section>
  );
}
