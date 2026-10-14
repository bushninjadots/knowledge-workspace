// The Tether, full size. Yours by default (?member=handle for anyone else,
// ?project=id for a project). "Watch it grow" replays the story in order and
// the pole rises level by level; Sync pulls new GitHub and journal activity.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { Pause, Play, RefreshCw, Share2, Tags } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionShell } from "@/components/tethyr/section-shell";
import { pageContainerClass, PageHeader } from "@/components/tethyr/page-header";
import { TetherPanel } from "@/components/tethyr/tether/tether-panel";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-current-user";
import { TETHER_KEY, useMemberTether, useProjectTether } from "@/hooks/use-tether";
import { syncProjectJournal } from "@/lib/journal-server";
import { syncGithubProfile } from "@/lib/github-server";
import { grownBy, tetherTimeline, type TetherNodeIn } from "@/lib/tether-layout";

const REPLAY_MS = 14_000;

function useMemberByHandle(handle: string | undefined, fallbackId: string | null) {
  return useQuery({
    queryKey: ["tether-member", handle ?? "", fallbackId ?? ""],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, display_name, handle, creator_title");
      // ?member= takes a handle or a member id (Studio blocks link by id).
      const isId = !!handle && /^[0-9a-f-]{36}$/i.test(handle);
      q = handle ? (isId ? q.eq("id", handle) : q.eq("handle", handle)) : q.eq("id", fallbackId!);
      const { data } = await q.maybeSingle();
      return data;
    },
    enabled: !!handle || !!fallbackId,
  });
}

function Replay({
  nodes,
  onFrame,
}: {
  nodes: TetherNodeIn[];
  onFrame: (visible: Set<string> | null, at: number | null) => void;
}) {
  const timeline = tetherTimeline(nodes);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    if (!timeline) return;
    if (pos >= 1 && !playing) {
      onFrame(null, null);
      return;
    }
    const t = timeline.start + (timeline.end - timeline.start) * pos;
    onFrame(new Set(grownBy(nodes, t).map((n) => n.id)), t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, playing, nodes]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const next = (now - last) / REPLAY_MS;
      last = now;
      setPos((p) => {
        const v = Math.min(1, p + next);
        if (v >= 1) setPlaying(false);
        return v;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  if (!timeline) return null;
  const at = new Date(timeline.start + (timeline.end - timeline.start) * pos);
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:basis-72">
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          if (!playing && pos >= 1) setPos(0);
          setPlaying((v) => !v);
        }}
      >
        {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Watch it grow"}
      </Button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(pos * 1000)}
        onChange={(e) => {
          setPlaying(false);
          setPos(Number(e.target.value) / 1000);
        }}
        aria-label="Point in time"
        className="min-w-0 flex-1 accent-[var(--user-accent,var(--primary))]"
      />
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {at.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
      </span>
    </div>
  );
}

export function TetherPage() {
  const search = useSearch({ from: "/tether" });
  const { data: auth } = useAuthUser();
  const me = auth?.id ?? null;
  const qc = useQueryClient();
  const projectMode = !!search.project;
  const { data: member } = useMemberByHandle(
    projectMode ? undefined : search.member,
    projectMode ? null : me,
  );
  const memberTether = useMemberTether(projectMode ? null : member?.id);
  const projectTether = useProjectTether(projectMode ? search.project : null);

  const nodes = (projectMode ? projectTether.nodes : memberTether.data) ?? null;
  const loading = projectMode
    ? projectTether.isLoading
    : memberTether.isLoading || (!member && (!!search.member || !!me));
  const title = projectMode ? projectTether.title : member?.display_name || member?.handle || null;
  const isOwner = !!me && (projectMode ? projectTether.ownerId === me : member?.id === me);

  const [visible, setVisible] = useState<Set<string> | null>(null);
  const [names, setNames] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const stableNodes = useMemo(() => nodes ?? [], [nodes]);

  async function sync() {
    setSyncing(true);
    try {
      await Promise.allSettled([
        syncProjectJournal({ data: { projectId: search.project } }),
        projectMode ? Promise.resolve() : syncGithubProfile(),
      ]);
      await qc.invalidateQueries({ queryKey: TETHER_KEY });
      toast.success("Your Tether is up to date");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SectionShell>
      <div className={pageContainerClass("default")}>
        <PageHeader
          eyebrow="The Tether"
          title={title ? (projectMode ? title : `${title}'s Tether`) : "The Tether"}
          description={
            projectMode
              ? "Everyone and everything this project is tied to, swinging around it. Hover a ball to see its tether, click for details."
              : "Every project, person, skill, crew and repo you're tied to — one tetherball that grows with your work. Hover a ball to see its tether, click for details."
          }
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied");
                  } catch {
                    toast.error("Couldn't copy the link.");
                  }
                }}
              >
                <Share2 /> Share
              </Button>
              {isOwner && (
                <Button size="sm" variant="outline" busy={syncing} onClick={sync}>
                  <RefreshCw /> Sync
                </Button>
              )}
            </>
          }
        />

        {!projectMode && !search.member && !me ? (
          <div className="surface-panel px-6 py-12 text-center">
            <p className="font-medium">Sign in to see your Tether</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Or open someone's from their profile.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        ) : loading || !nodes ? (
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        ) : nodes.length === 0 ? (
          <div className="surface-panel px-6 py-12 text-center">
            <p className="font-medium">Nothing tethered yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a project, add skills, join a crew or a space — each one becomes a ball on the
              rope.
            </p>
          </div>
        ) : (
          <div className="surface-card p-4 sm:p-6">
            <TetherPanel
              nodes={stableNodes}
              centerLabel={title ?? "You"}
              centerSub={projectMode ? "project" : (member?.creator_title ?? undefined)}
              visibleIds={visible}
              showNames={names}
              toolbar={
                <>
                  <Replay nodes={stableNodes} onFrame={(v) => setVisible(v)} />
                  <button
                    type="button"
                    onClick={() => setNames((v) => !v)}
                    aria-pressed={names}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
                  >
                    <Tags className="h-3.5 w-3.5" /> {names ? "Hide names" : "Show names"}
                  </button>
                </>
              }
            />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
