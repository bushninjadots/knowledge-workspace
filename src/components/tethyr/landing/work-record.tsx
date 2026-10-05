import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkRecord, type WorkRecordMilestone } from "./data";

// The hero's evidence: one real project, typeset as a record of where it is,
// what has shipped, and who made it. The page's claim is "get known for what
// you make", so the hero shows the making rather than describing it.

const LIFECYCLE = [
  { key: "planning", label: "Plan" },
  { key: "building", label: "Build" },
  { key: "testing", label: "Test" },
  { key: "launch", label: "Launch" },
  { key: "growing", label: "Grow" },
] as const;

const CREDIT_LABEL: Record<string, string> = {
  creator: "Created by",
  mentor: "Mentored by",
  contributor: "With",
};

function Lifecycle({ stage }: { stage: string | null }) {
  const current = LIFECYCLE.findIndex((step) => step.key === stage);
  return (
    <ol aria-label="Project lifecycle" className="grid grid-cols-5 gap-1.5">
      {LIFECYCLE.map((step, index) => {
        const reached = current >= 0 && index <= current;
        const isCurrent = index === current;
        return (
          <li key={step.key} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
            <span
              className={cn(
                "block h-1 rounded-full",
                reached ? "bg-[var(--user-accent,var(--primary))]" : "bg-border",
              )}
            />
            <span
              className={cn(
                "mt-2 block truncate font-mono text-[10px] uppercase tracking-[0.14em]",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MilestoneMark({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
      </span>
    );
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border border-border" />;
}

const MILESTONE_STATE: Record<string, string> = {
  done: "Shipped",
  in_progress: "In progress",
};

function Milestones({ items }: { items: WorkRecordMilestone[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Milestones
      </p>
      <ul className="mt-3 space-y-2.5">
        {items.map((milestone) => (
          <li key={milestone.id} className="flex items-center gap-3 text-sm">
            <MilestoneMark status={milestone.status} />
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                milestone.status === "done" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {milestone.title}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {MILESTONE_STATE[milestone.status] ?? "Next"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkRecordSkeleton() {
  return (
    <div
      className="h-[26rem] animate-gentle-pulse rounded-xl border border-border/60 bg-surface"
      aria-hidden="true"
    />
  );
}

export function WorkRecord() {
  const { data: record, isLoading } = useWorkRecord();
  if (isLoading) return <WorkRecordSkeleton />;
  if (!record) return null;
  const { project, credits, milestones } = record;

  return (
    <article
      aria-labelledby="work-record-title"
      className="rounded-xl border border-border/60 bg-surface p-6 text-left sm:p-8"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Being built on Tethyr
      </p>
      <h2
        id="work-record-title"
        className="mt-3 font-display text-3xl font-semibold tracking-tight"
      >
        {project.title}
      </h2>
      {project.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      <div className="mt-7">
        <Lifecycle stage={project.stage} />
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-[1.2fr_1fr]">
        <Milestones items={milestones} />
        {credits.length > 0 ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Credits
            </p>
            <dl className="mt-3 space-y-2.5">
              {credits.map((credit) => (
                <div
                  key={`${credit.role}-${credit.handle ?? credit.name}`}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <dt className="shrink-0 text-muted-foreground">
                    {CREDIT_LABEL[credit.role] ?? credit.role}
                  </dt>
                  <span
                    aria-hidden="true"
                    className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-border"
                  />
                  <dd className="min-w-0 truncate font-medium">
                    {credit.handle ? (
                      <Link
                        to="/u/$handle"
                        params={{ handle: credit.handle }}
                        className="hover:text-[var(--user-accent,var(--primary))]"
                      >
                        {credit.name}
                      </Link>
                    ) : (
                      credit.name
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--user-accent,var(--primary))]"
      >
        Open {project.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
