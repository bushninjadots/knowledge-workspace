// Release countdown on the project page. Before: "Launching in 3d 04:12:09",
// with where to get it. After: "Shipped", the links, and — for the owner, the
// first week — a congrats banner with share buttons. When the work is done
// and there's no release yet, the owner gets a "Ready to ship?" prompt.
import { useEffect, useState } from "react";
import { CalendarClock, PartyPopper, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { AppIcon } from "@/components/tethyr/apps/app-icon";
import { AppLinksEditor } from "@/components/tethyr/apps/app-links-editor";
import type { ProjectDetail } from "@/hooks/use-projects";
import { detectApp, getApp, PROJECT_APPS } from "@/lib/app-catalog";
import { friendlyError } from "@/lib/error-message";
import {
  countdownParts,
  readyToRelease,
  recentlyShipped,
  releaseState,
  toLocalInput,
} from "@/lib/release";
import { linkedInShareUrl, xShareUrl } from "@/lib/ship-log";
import { safeHref } from "@/lib/validators";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function ReleaseLinks({ links }: { links: Record<string, string> }) {
  const entries = Object.entries(links).filter(([, url]) => !!url);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, url]) => {
        const app = getApp(key) ?? detectApp(url);
        return (
          <a
            key={key}
            href={safeHref(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface py-1 pr-3 pl-1 text-xs font-medium transition-colors hover:bg-surface-elevated"
          >
            <AppIcon app={app} size="sm" className="rounded-full" />
            {app?.name ?? key}
          </a>
        );
      })}
    </div>
  );
}

export function ProjectRelease({
  project,
  isOwner,
  milestonesTotal,
  milestonesDone,
}: {
  project: ProjectDetail;
  isOwner: boolean;
  milestonesTotal: number;
  milestonesDone: number;
}) {
  const state = releaseState(project.release_at);
  const now = useNow(state === "upcoming");
  // While counting down, the ticking clock decides (it flips to "shipped" at
  // zero); otherwise the real time does — the last tick can be stale after
  // "Ship it now".
  const live = releaseState(project.release_at, state === "upcoming" ? now : Date.now());
  const [editing, setEditing] = useState(false);
  const dismissKey = `tethyr-release-celebrated:${project.id}:${project.release_at ?? ""}`;
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const links = (project.release_links ?? {}) as Record<string, string>;
  const ready = readyToRelease({
    status: project.status,
    progress_percent: project.progress_percent,
    milestonesTotal,
    milestonesDone,
  });

  if (live === "none") {
    if (!isOwner) return null;
    if (!ready)
      return (
        <>
          <p className="text-xs text-muted-foreground">
            Planning a launch?{" "}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Set a release date
            </button>{" "}
            and a countdown shows here.
          </p>
          <ReleaseDialogHost project={project} open={editing} onOpenChange={setEditing} />
        </>
      );
    return (
      <>
        <section className="surface-card flex flex-wrap items-center gap-3 p-4">
          <Rocket className="h-5 w-5 text-caution" aria-hidden />
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-sm font-semibold">Ready to ship?</p>
            <p className="text-xs text-muted-foreground">
              The work's done. Set a release date and where people can get it — a countdown shows
              here until launch.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing(true)}>
            <CalendarClock /> Plan the release
          </Button>
        </section>
        <ReleaseDialogHost project={project} open={editing} onOpenChange={setEditing} />
      </>
    );
  }

  const shippedDate = project.release_at
    ? new Date(project.release_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const celebrate =
    isOwner && live === "shipped" && recentlyShipped(project.release_at) && !dismissed;
  const url = typeof window === "undefined" ? "" : window.location.href;
  const shareText = `${project.title} just shipped! 🚀${project.release_note ? `\n\n${project.release_note.slice(0, 200)}` : ""}\n\n${url}`;

  return (
    <>
      {celebrate && (
        <section className="relative overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--caution)_40%,transparent)] bg-[color-mix(in_oklab,var(--caution)_10%,var(--surface))] p-5">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              try {
                window.localStorage.setItem(dismissKey, "1");
              } catch {
                /* per device */
              }
            }}
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <PartyPopper className="h-5 w-5 text-caution" aria-hidden />
            Your project has shipped — congrats!
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.title} is out. Tell people — and post it on your Ship log this week.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={linkedInShareUrl(shareText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated"
            >
              Share on LinkedIn
            </a>
            <a
              href={xShareUrl(shareText.slice(0, 270))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated"
            >
              Share on X
            </a>
            <a
              href="/ships"
              className="inline-flex items-center rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated"
            >
              Post to the Ship log
            </a>
          </div>
        </section>
      )}

      <section aria-label="Release" className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {live === "upcoming" ? (
            <CalendarClock className="h-5 w-5 text-muted-foreground" aria-hidden />
          ) : (
            <Rocket className="h-5 w-5 text-caution" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {live === "upcoming" ? "Launching in" : "Shipped"}
            </p>
            {live === "upcoming" ? (
              <Countdown releaseAt={project.release_at!} now={now} />
            ) : (
              <p className="font-display text-lg font-semibold">{shippedDate}</p>
            )}
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit release
            </Button>
          )}
        </div>
        {project.release_note && (
          <p className="text-sm whitespace-pre-line text-foreground/90">{project.release_note}</p>
        )}
        <ReleaseLinks links={links} />
        {isOwner && !project.release_public && (
          <p className="text-[11px] text-muted-foreground">Not listed in Explore.</p>
        )}
      </section>
      <ReleaseDialogHost project={project} open={editing} onOpenChange={setEditing} />
    </>
  );
}

function Countdown({ releaseAt, now }: { releaseAt: string; now: number }) {
  const { days, hours, minutes, seconds } = countdownParts(releaseAt, now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = [
    ...(days ? [{ v: String(days), l: days === 1 ? "day" : "days" }] : []),
    { v: pad(hours), l: "hrs" },
    { v: pad(minutes), l: "min" },
    { v: pad(seconds), l: "sec" },
  ];
  return (
    <p className="flex items-baseline gap-3" aria-live="off">
      {parts.map((p) => (
        <span key={p.l} className="inline-flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold tabular-nums">{p.v}</span>
          <span className="text-[11px] text-muted-foreground">{p.l}</span>
        </span>
      ))}
    </p>
  );
}

function ReleaseDialogHost({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return open ? <ReleaseDialog project={project} open={open} onOpenChange={onOpenChange} /> : null;
}

function ReleaseDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [when, setWhen] = useState(toLocalInput(project.release_at));
  const [note, setNote] = useState(project.release_note ?? "");
  const [links, setLinks] = useState<Record<string, string>>(() => {
    const saved = (project.release_links ?? {}) as Record<string, string>;
    if (Object.keys(saved).length) return saved;
    // Start from where the project already lives.
    const fromProject = (project.links ?? {}) as Record<string, string>;
    return Object.fromEntries(Object.entries(fromProject).filter(([, v]) => !!v));
  });
  const [listed, setListed] = useState(project.release_public ?? true);
  const [saving, setSaving] = useState(false);

  async function save(releaseAt: string | null) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) {
      const val = v.trim();
      if (!val) continue;
      if (!/^https:\/\//.test(val))
        return void toast.error(`${getApp(k)?.name ?? k}: use a full https:// link.`);
      clean[k] = val;
    }
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        release_at: releaseAt,
        release_note: note.trim() || null,
        release_links: clean,
        release_public: listed,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) return void toast.error(friendlyError(error, "Couldn't save the release"));
    void qc.invalidateQueries({ queryKey: ["project-detail"] });
    void qc.invalidateQueries({ queryKey: ["explore-releases"] });
    toast.success(
      releaseAt === null
        ? "Release removed"
        : Date.parse(releaseAt) <= Date.now()
          ? "Shipped! 🎉"
          : "Countdown is on",
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Release {project.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            A countdown shows on the project until launch, then it says it's shipped — and tells
            everyone watching.
          </p>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const t = new Date(when);
            if (Number.isNaN(t.getTime())) return void toast.error("Pick a date and time.");
            void save(t.toISOString());
          }}
        >
          <label className="block space-y-1 text-xs font-medium">
            Goes public on
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            Where to get it / how to use it
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 1500))}
              rows={3}
              placeholder="Download it from the App Store, try it at app.example.com, or npm install example."
            />
          </label>
          <div className="space-y-1">
            <p className="text-xs font-medium">Links</p>
            <AppLinksEditor
              value={links}
              onChange={setLinks}
              apps={PROJECT_APPS}
              suggested={[
                "website",
                "app-store",
                "google-play",
                "github",
                "npm",
                "itch",
                "product-hunt",
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
            Show it in Explore under “Launching soon” and “Just shipped”
            {project.visibility !== "public" && (
              <span className="text-muted-foreground">(only while the project is public)</span>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" busy={saving}>
              Start the countdown
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              busy={saving}
              onClick={() => void save(new Date().toISOString())}
            >
              <Rocket /> Ship it now
            </Button>
            {project.release_at && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto"
                busy={saving}
                onClick={() => void save(null)}
              >
                Remove release
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
