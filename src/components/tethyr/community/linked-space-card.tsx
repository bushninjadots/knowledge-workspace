// A team's, challenge's or project's own space, shown on that page: a way in
// when it exists, and for the person who runs it, a way to start one. People
// in the team / challenge / project are members automatically.
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLinkedSpace, useOpenLinkedSpace, type LinkedKind } from "@/hooks/use-linked-space";
import { friendlyError } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const COPY: Record<LinkedKind, { noun: string; start: string; open: string }> = {
  team: {
    noun: "crew",
    start: "A private room for the crew — questions, updates and decisions in one place.",
    open: "The crew's private room. Everyone on the crew is in it.",
  },
  challenge: {
    noun: "challenge",
    start: "A room for everyone taking part — share progress, ask for help, compare notes.",
    open: "Everyone taking part is in here. Share progress and ask for help.",
  },
  project: {
    noun: "project",
    start: "A room for the project's people and followers — updates, feedback and questions.",
    open: "The project's room for updates, feedback and questions.",
  },
};

export function LinkedSpaceCard({
  kind,
  id,
  canStart,
  className,
}: {
  kind: LinkedKind;
  id: string;
  /** The person who runs it (team lead, challenge creator, project owner). */
  canStart: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const { data: space, isLoading } = useLinkedSpace(kind, id);
  const open = useOpenLinkedSpace();
  const copy = COPY[kind];

  if (isLoading || (!space && !canStart)) return null;

  function start() {
    open.mutate(
      { kind, id },
      {
        onSuccess: ({ slug, created }) => {
          if (created) toast.success(`Your ${copy.noun} has a space — members are already in it`);
          navigate({ to: "/community", search: { space: slug } as Record<string, string> });
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't start the space")),
      },
    );
  }

  return (
    <section
      aria-label={space ? `${space.name} space` : `Start a ${copy.noun} space`}
      className={cn("flex flex-wrap items-center gap-3 surface-card p-4", className)}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--user-accent,var(--primary))_14%,transparent)] text-[var(--user-accent-text,var(--foreground))]">
        <MessagesSquare className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {space ? `${space.name} space` : `Give this ${copy.noun} a space`}
        </p>
        <p className="text-xs text-muted-foreground">{space ? copy.open : copy.start}</p>
      </div>
      {space ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate({ to: "/community", search: { space: space.slug } as Record<string, string> })
          }
        >
          Open space
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : (
        <Button size="sm" onClick={start} busy={open.isPending}>
          Start a space
        </Button>
      )}
    </section>
  );
}
