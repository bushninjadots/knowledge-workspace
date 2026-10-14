// "Your week": post this week's ship, drafted from public GitHub activity, or
// see and edit the one already posted. The one place a ship is written, used
// by the Ship log page and the dashboard.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Rocket, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useDeleteShip,
  useMyShip,
  useMyShipKudos,
  useSaveShip,
  useShipDraft,
  useShipStreaks,
} from "@/hooks/use-ships";
import {
  SHIP_BODY_MAX,
  SHIP_BODY_MIN,
  SHIP_NEXT_MAX,
  shipErrorMessage,
  linkedInShareUrl,
  shipShareText,
  shipWeekOf,
  streakLabel,
  xShareUrl,
  type ShipHighlight,
} from "@/lib/ship-log";
import { ShipCard, ShipHighlights } from "./ship-card";
import { toLite, useJournalEntries } from "@/hooks/use-journal";
import { shipLinesFromJournal } from "@/lib/journal";

export function ShipComposer({ compact = false }: { compact?: boolean }) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const { data: mine, isLoading } = useMyShip(userId);
  const { data: streaks } = useShipStreaks(userId ? [userId] : []);
  const { data: myKudos } = useMyShipKudos(userId);
  const save = useSaveShip(userId);
  const remove = useDeleteShip();
  const draft = useShipDraft();
  const [weekStart] = useState(() => `${shipWeekOf()}T00:00:00Z`);
  const { data: weekJournal } = useJournalEntries({ from: weekStart });

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [nextUp, setNextUp] = useState("");
  const [highlights, setHighlights] = useState<ShipHighlight[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [noGithub, setNoGithub] = useState(false);

  // Editing starts from what was posted.
  useEffect(() => {
    if (editing && mine) {
      setBody(mine.body);
      setNextUp(mine.next_up ?? "");
      setHighlights(mine.highlights);
      setProjectId(mine.project_id ?? "");
    }
  }, [editing, mine]);

  const streak = userId ? (streaks?.[userId] ?? 0) : 0;
  const projects = (me?.projects ?? []).filter(
    (p) => p.status !== "completed" || p.id === projectId,
  );

  // The week's draft: your journal first (what and why, in your words),
  // then public GitHub activity when it's connected. Either alone is enough.
  async function draftWeek() {
    const fromJournal = shipLinesFromJournal(toLite(weekJournal ?? []));
    let github: { body: string; highlights: ShipHighlight[] } | null = null;
    let hasGithub = true;
    try {
      const result = await draft.mutateAsync();
      hasGithub = !!result.login;
      if (result.draft?.body) github = result.draft;
    } catch {
      /* GitHub is optional */
    }
    const githubLines = github
      ? github.body
          .split("\n")
          .filter((l) => l.startsWith("- "))
          .map((l) => l.slice(2))
      : [];
    const lines = [...fromJournal.lines, ...githubLines];
    if (lines.length === 0) {
      setNoGithub(!hasGithub);
      toast.message(
        "Nothing logged yet this week — write it in your own words, or log as you go in the Journal.",
      );
      return;
    }
    const text = `This week I:\n${lines.map((l) => `- ${l}`).join("\n")}`;
    setBody((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text));
    if (github) setHighlights(github.highlights);
    if (fromJournal.nextUp) setNextUp((current) => current || fromJournal.nextUp!);
  }

  async function submit() {
    if (body.trim().length < SHIP_BODY_MIN) return;
    try {
      await save.mutateAsync({
        id: editing ? mine?.id : undefined,
        body: body.trim(),
        next_up: nextUp.trim() || null,
        highlights,
        project_id: projectId || null,
      });
      toast.success(editing ? "Ship updated" : "Shipped! See you next week.");
      setEditing(false);
      setBody("");
      setNextUp("");
      setHighlights([]);
    } catch (error) {
      toast.error(shipErrorMessage(error));
    }
  }

  if (!userId || isLoading) {
    return <div className="h-40 animate-gentle-pulse surface-card" aria-hidden />;
  }

  // Posted and not editing: show it, with the streak and owner controls.
  if (mine && !editing) {
    return (
      <section aria-labelledby="your-week" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="your-week" className="text-sm font-semibold">
            Your week{" "}
            <span className="font-normal text-muted-foreground">
              · {streakLabel(streak) ?? "posted"} — nice.
            </span>
          </h2>
        </div>
        <ShipCard
          ship={mine}
          userId={userId}
          kudosGiven={myKudos?.has(mine.id) ?? false}
          showAuthor={false}
          actions={
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit this week's ship"
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete this week's ship"
                onClick={() => {
                  if (window.confirm("Delete this week's ship? Kudos and replies go with it."))
                    remove.mutate(mine.id);
                }}
              >
                <Trash2 />
              </Button>
            </div>
          }
        />
        <ShareShip body={mine.body} nextUp={mine.next_up} handle={me?.profile?.handle ?? null} />
      </section>
    );
  }

  return (
    <section aria-labelledby="your-week" className="surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="your-week" className="flex items-center gap-2 font-semibold">
            <Rocket className="h-4 w-4 text-caution" aria-hidden />
            {editing ? "Edit this week's ship" : "What did you ship this week?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {streak > 0
              ? `You're on a ${streak}-week streak. Post this week to keep it.`
              : "A few lines is enough — code, design, a fix, something you learned."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          busy={draft.isPending}
          onClick={draftWeek}
        >
          <Sparkles /> Draft my week
        </Button>
      </div>

      {noGithub && (
        <p className="mt-3 rounded-lg bg-surface-elevated/60 px-3 py-2 text-xs text-muted-foreground">
          Log as you go in the{" "}
          <Link to="/journal" className="text-foreground underline">
            Journal
          </Link>{" "}
          (or let your AI assistant and git do it), or connect GitHub in{" "}
          <Link to="/settings" className="text-foreground underline">
            Settings
          </Link>{" "}
          — and Tethyr writes the first draft for you every week.
        </p>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, SHIP_BODY_MAX))}
          rows={compact ? 3 : 5}
          placeholder={
            "This week I:\n- shipped dark mode\n- fixed the login bug that's been bugging everyone"
          }
          aria-label="What you shipped"
          className="rounded-xl"
        />
        <ShipHighlights
          highlights={highlights}
          onRemove={(i) => setHighlights((h) => h.filter((_, j) => j !== i))}
        />
        {!compact && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={nextUp}
              onChange={(e) => setNextUp(e.target.value.slice(0, SHIP_NEXT_MAX))}
              placeholder="Next up (optional)"
              aria-label="Next up"
            />
            {projects.length > 0 && (
              <Select
                value={projectId || "none"}
                onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
              >
                <SelectTrigger aria-label="Project">
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
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs tabular-nums text-muted-foreground">
            {body.length}/{SHIP_BODY_MAX}
          </span>
          {editing && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="rounded-full"
            busy={save.isPending}
            disabled={body.trim().length < SHIP_BODY_MIN}
          >
            {editing ? "Save" : "Post ship"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Post this week's ship to LinkedIn or X (their own compose screens), or copy it. */
function ShareShip({
  body,
  nextUp,
  handle,
}: {
  body: string;
  nextUp: string | null;
  handle: string | null;
}) {
  const origin = typeof window === "undefined" ? "https://tethyr.com" : window.location.origin;
  const profileUrl = handle ? `${origin}/u/${handle}` : origin;
  const ship = { body, next_up: nextUp };
  const linkClass =
    "inline-flex items-center rounded-full border border-border/70 px-3 py-1 text-xs font-medium transition-colors hover:bg-surface-elevated";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Share this week:</span>
      <a
        href={linkedInShareUrl(shipShareText(ship, profileUrl, 3000))}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        LinkedIn
      </a>
      <a
        href={xShareUrl(shipShareText(ship, profileUrl, 280))}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        X
      </a>
      <button
        type="button"
        className={linkClass}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shipShareText(ship, profileUrl));
            toast.success("Copied — paste it anywhere");
          } catch {
            toast.error("Couldn't copy.");
          }
        }}
      >
        Copy
      </button>
    </div>
  );
}
