import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Lock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Flag,
  MessageSquareQuote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/tethyr/empty-state";
import {
  useCommunitySpace,
  useSpaceReportHistory,
  useUpdateReportStatus,
  type PostReportRow,
} from "@/hooks/use-community-spaces";

export const Route = createFileRoute("/_authenticated/spaces/$slug/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Tethyr" },
      {
        name: "description",
        content: "Review member reports and moderation history for this community.",
      },
    ],
  }),
  component: SpaceReportsPage,
});

const STATUS_LABEL: Record<PostReportRow["status"], string> = {
  open: "Open",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function SpaceReportsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: space, isLoading } = useCommunitySpace(slug);
  const { data: reports = [], isLoading: reportsLoading } = useSpaceReportHistory(space?.id ?? "");
  const updateReport = useUpdateReportStatus();

  const [dismissTarget, setDismissTarget] = useState<PostReportRow | null>(null);
  const [dismissNote, setDismissNote] = useState("");

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Community not found"
          description="This community doesn't exist or you don't have access to it."
        />
      </div>
    );
  }

  const canManage = space.my_role === "owner" || space.my_role === "moderator";
  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="You don't manage this community"
          description="Only owners and moderators can review reports."
        />
      </div>
    );
  }

  const open = reports.filter((r) => r.status === "open");
  const closed = reports.filter((r) => r.status !== "open");

  const spaceSlug = space.slug;

  function goBack() {
    navigate({ to: "/community", search: { space: spaceSlug } });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-start gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back to the community"
          className="mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reports inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review member reports for {space.name} — resolve or dismiss them, and see the moderation
            history.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/spaces/$slug/settings" params={{ slug: space.slug }}>
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {reportsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          title="No reports yet"
          description="When members flag a post, it shows up here for you to review."
        />
      ) : (
        <div className="space-y-10">
          {/* Open reports */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Flag className="h-4 w-4 text-destructive" />
              Open ({open.length})
            </h2>
            <div className="mt-3 space-y-2">
              {open.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Nothing waiting — nice and quiet.
                </p>
              ) : (
                open.map((rep) => (
                  <ReportCard
                    key={rep.id}
                    rep={rep}
                    busy={updateReport.isPending}
                    onDismiss={() => {
                      setDismissTarget(rep);
                      setDismissNote("");
                    }}
                    onResolve={() =>
                      updateReport.mutate(
                        { reportId: rep.id, status: "resolved" },
                        {
                          onSuccess: () => toast.success("Report resolved"),
                          onError: () => toast.error("Failed to resolve"),
                        },
                      )
                    }
                  />
                ))
              )}
            </div>
          </section>

          {/* History */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              History ({closed.length})
            </h2>
            <div className="mt-3 space-y-2">
              {closed.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No resolved or dismissed reports yet.
                </p>
              ) : (
                closed.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-lg border border-border/60 bg-surface-elevated/30 px-3 py-2.5 opacity-80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-medium">{rep.post?.title || "Post"}</span>{" "}
                        <span className="font-normal text-muted-foreground">— {rep.reason}</span>
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          rep.status === "resolved"
                            ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
                            : "border-border/60 bg-background/40 text-muted-foreground"
                        }`}
                      >
                        {rep.status === "resolved" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {STATUS_LABEL[rep.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reported by {rep.reporter?.display_name || "Member"} ·{" "}
                      {timeAgo(rep.created_at)}
                      {rep.resolved_at
                        ? ` · closed ${new Date(rep.resolved_at).toLocaleDateString()}`
                        : ""}
                    </p>
                    {rep.moderator_note && (
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5 text-xs text-foreground/80">
                        <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        {rep.moderator_note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Dismiss with optional note */}
      <Dialog open={!!dismissTarget} onOpenChange={(open) => !open && setDismissTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dismiss report</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {dismissTarget?.post?.title || "This post"} — leave a note for the reporter and they'll
            be notified with it. Leave it empty to dismiss silently.
          </p>
          <div className="pt-2">
            <Label htmlFor="dismiss-note">Note to the reporter (optional)</Label>
            <Textarea
              id="dismiss-note"
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="e.g. Thanks for flagging this — we reviewed it and it doesn't break the rules."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={updateReport.isPending}
              onClick={() => {
                if (!dismissTarget) return;
                updateReport.mutate(
                  { reportId: dismissTarget.id, status: "dismissed", note: dismissNote },
                  {
                    onSuccess: () => {
                      toast.success(
                        dismissNote.trim()
                          ? "Report dismissed — the reporter was notified"
                          : "Report dismissed",
                      );
                      setDismissTarget(null);
                      setDismissNote("");
                    },
                    onError: () => toast.error("Failed to dismiss"),
                  },
                );
              }}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Dismiss report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({
  rep,
  busy,
  onDismiss,
  onResolve,
}: {
  rep: PostReportRow;
  busy: boolean;
  onDismiss: () => void;
  onResolve: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-surface-elevated/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {rep.post?.title || "Post"}{" "}
          <span className="font-normal text-muted-foreground">— {rep.reason}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reported by {rep.reporter?.display_name || "Member"} · {timeAgo(rep.created_at)}
          {rep.details ? ` — “${rep.details}”` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs text-destructive"
          disabled={busy}
          onClick={onDismiss}
        >
          <XCircle className="mr-1 h-3.5 w-3.5" /> Dismiss
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs" disabled={busy} onClick={onResolve}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve
        </Button>
      </div>
    </div>
  );
}
