// "Your week": post this week's ship, drafted from public GitHub activity, or
// see and edit the one already posted. The one place a ship is written, used
// by the Ship log page and the dashboard.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Github, Pencil, Rocket, Trash2 } from "lucide-react";
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
  streakLabel,
  type ShipHighlight,
} from "@/lib/ship-log";
import { ShipCard, ShipHighlights } from "./ship-card";

export function ShipComposer({ compact = false }: { compact?: boolean }) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const { data: mine, isLoading } = useMyShip(userId);
  const { data: streaks } = useShipStreaks(userId ? [userId] : []);
  const { data: myKudos } = useMyShipKudos(userId);
  const save = useSaveShip(userId);
  const remove = useDeleteShip();
  const draft = useShipDraft();

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

  async function fillFromGithub() {
    try {
      const result = await draft.mutateAsync();
      if (!result.login) {
        setNoGithub(true);
        return;
      }
      if (!result.draft || !result.draft.body) {
        toast.message("No public GitHub activity yet this week — write it in your own words.");
        return;
      }
      setBody((current) =>
        current.trim() ? `${current.trim()}\n\n${result.draft!.body}` : result.draft!.body,
      );
      setHighlights(result.draft.highlights);
    } catch {
      toast.error("Couldn't reach GitHub just now. Try again in a minute.");
    }
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
          onClick={fillFromGithub}
        >
          <Github /> Draft from GitHub
        </Button>
      </div>

      {noGithub && (
        <p className="mt-3 rounded-lg bg-surface-elevated/60 px-3 py-2 text-xs text-muted-foreground">
          Connect GitHub in{" "}
          <Link to="/settings" className="text-foreground underline">
            Settings
          </Link>{" "}
          and Tethyr writes the first draft for you every week.
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
