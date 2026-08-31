import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HandHeart, CheckCircle2, Clock, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const sb = supabase;

export type RoleApplication = {
  id: string;
  role_id: string;
  profile_id: string;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  applicant?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

export function useRoleApplications(roleId: string) {
  return useQuery({
    queryKey: ["role-applications", roleId],
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("project_role_applications")
        .select("*")
        .eq("role_id", roleId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const apps = (raw ?? []) as Omit<RoleApplication, "applicant">[];

      const profileIds = [...new Set(apps.map((a) => a.profile_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", profileIds);

      const profileMap = new Map<string, NonNullable<RoleApplication["applicant"]>>(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      return apps.map((a): RoleApplication => ({
        ...a,
        applicant: profileMap.get(a.profile_id) ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    enabled: !!roleId,
  });
}

export function ApplyToRoleButton({
  roleId,
  projectId: _projectId,
  isOwner,
  meId,
  myStatus,
}: {
  roleId: string;
  projectId: string;
  isOwner: boolean;
  /** Signed-in user id — skips the internal auth round-trip when provided. */
  meId?: string | null;
  /**
   * Known application status for this role, fed from a batched query so many
   * cards don't each fire their own query. `undefined` falls back to an
   * internal per-role query; `null` means "definitely no application yet".
   */
  myStatus?: string | null;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  // Optimistic flip after submitting so the button doesn't flicker while caches refetch.
  const [localStatus, setLocalStatus] = useState<string | null | undefined>(undefined);

  // Check if already applied — newest row first so a re-apply surfaces ahead of a stale decline.
  // Also resolves sign-in state so signed-out visitors see a login prompt instead of a dead Apply.
  const { data: myApps, isLoading: myAppsLoading } = useQuery({
    queryKey: ["my-role-applications", roleId],
    queryFn: async (): Promise<{ signedIn: boolean; apps: { id: string; status: string }[] }> => {
      const id = meId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!id) return { signedIn: false, apps: [] };
      const { data, error } = await sb
        .from("project_role_applications")
        .select("id, status")
        .eq("role_id", roleId)
        .eq("profile_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { signedIn: true, apps: (data ?? []) as { id: string; status: string }[] };
    },
    enabled: myStatus === undefined,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const id = meId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!id) throw new Error("Not authenticated");

      // Idempotent apply: re-open a declined row (newest first), skip when a
      // pending/accepted row already exists (prevents double-submit duplicates).
      const { data: prior } = await sb
        .from("project_role_applications")
        .select("id, status")
        .eq("role_id", roleId)
        .eq("profile_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      const priorApp = prior?.[0];
      if (priorApp && priorApp.status !== "declined") {
        // Already pending/accepted — the cache refetch will surface the chip.
        return;
      }

      if (priorApp) {
        const { error } = await sb
          .from("project_role_applications")
          .update({
            status: "pending",
            message: message.trim() || null,
            // Bump so it surfaces at the top of the dashboard's "Your applications" again.
            created_at: new Date().toISOString(),
          })
          .eq("id", priorApp.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("project_role_applications").insert({
          role_id: roleId,
          profile_id: id,
          message: message.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-applications", roleId] });
      // Prefix matches both the per-role check and the explore batch query.
      qc.invalidateQueries({ queryKey: ["my-role-applications"] });
      // The dashboard "Your applications" section reads this key.
      qc.invalidateQueries({ queryKey: ["my-applications"] });
      setLocalStatus("pending");
      setShowForm(false);
      setMessage("");
      setShowGuidance(false);
      toast.success("Application submitted");
    },
    onError: (err: Error) => {
      toast.error(friendlyError(err, "Failed to apply"));
    },
  });

  if (isOwner) return null;

  // Resolve the current status: optimistic → batched prop → internal query.
  const resolvedStatus =
    localStatus !== undefined
      ? localStatus
      : myStatus !== undefined
        ? myStatus
        : myApps?.apps[0]?.status;

  // Avoid flashing the apply button while the internal check is in flight.
  if (myStatus === undefined && myAppsLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        Checking…
      </span>
    );
  }

  // Signed-out visitor — send them to the login page instead of a dead Apply button.
  // (When myStatus is fed from a batched query the tab is authenticated, so this only
  // triggers on the public project page where the internal query resolves sign-in.)
  if (myStatus === undefined && myApps && !myAppsLoading && !myApps.signedIn) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-brand-purple/40 hover:text-brand-purple"
      >
        <HandHeart className="h-3 w-3" />
        Sign in to apply
      </Link>
    );
  }

  const wasDeclined = resolvedStatus === "declined";

  // Accepted / pending rows are terminal states — show a quiet chip.
  if (resolvedStatus && !wasDeclined) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
          resolvedStatus === "accepted" ? "text-brand-green" : "text-muted-foreground"
        }`}
      >
        {resolvedStatus === "accepted" ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {resolvedStatus === "accepted" ? "Accepted" : "Application pending"}
      </span>
    );
  }

  if (showForm) {
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-border/40 bg-surface/20 p-3">
        <div>
          <p className="text-xs font-medium text-foreground">Join this project</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Share what you would bring, what you want to learn, and any work that helps the owner
            understand your contribution.
          </p>
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setShowGuidance(!showGuidance)}
          className="h-auto justify-start p-0 text-[11px]"
        >
          {showGuidance ? "Hide application guidance" : "What makes a useful application?"}
        </Button>
        {showGuidance && (
          <ul className="list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">
            <li>Name the part of the project you want to help with.</li>
            <li>Link to relevant work from your Studio if useful.</li>
            <li>Be clear about your availability and expectations.</li>
          </ul>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would you contribute, and why is this project a good fit?"
          rows={4}
          aria-label="Application message"
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs outline-none focus:border-primary resize-none"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => applyMutation.mutate()}
            busy={applyMutation.isPending}
          >
            <Send className="h-3 w-3" />
            Submit application
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setShowForm(true)}
      className={`rounded-full ${
        wasDeclined
          ? "border-border/60 bg-background/40 text-muted-foreground hover:border-brand-purple/40 hover:text-brand-purple"
          : "border-brand-purple/40 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20"
      }`}
    >
      {wasDeclined ? <RotateCcw className="h-3 w-3" /> : <HandHeart className="h-3 w-3" />}
      {wasDeclined ? "Apply again" : "Apply"}
    </Button>
  );
}

export function RoleApplicationsList({
  roleId,
  isOwner,
  onAccept,
  onDecline,
}: {
  roleId: string;
  isOwner: boolean;
  onAccept?: (applicationId: string, profileId: string) => void;
  onDecline?: (applicationId: string) => void;
}) {
  const { data: applications = [] } = useRoleApplications(roleId);

  if (!isOwner || applications.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        {applications.length} application{applications.length !== 1 ? "s" : ""}
      </p>
      {applications.map((app) => {
        const name = app.applicant?.display_name || app.applicant?.handle || "Unknown";
        return (
          <div key={app.id} className="flex items-center gap-2 rounded-xl bg-background/40 p-2">
            <div className="min-w-0 flex-1">
              <Link
                to="/u/$handle"
                params={{ handle: app.applicant?.handle ?? "unknown" }}
                className="text-xs font-medium hover:underline"
              >
                {name}
              </Link>
              {app.message && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {app.message}
                </p>
              )}
            </div>
            {app.status === "pending" && (
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => onAccept?.(app.id, app.profile_id)}
                  className="rounded-lg bg-brand-green/10 px-2 py-1 text-[11px] font-medium text-brand-green transition hover:bg-brand-green/20"
                >
                  Accept
                </button>
                <button
                  onClick={() => onDecline?.(app.id)}
                  className="rounded-lg bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/20"
                >
                  Decline
                </button>
              </div>
            )}
            {app.status !== "pending" && (
              <span
                className={`text-[11px] font-medium ${
                  app.status === "accepted" ? "text-brand-green" : "text-destructive"
                }`}
              >
                {app.status}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
