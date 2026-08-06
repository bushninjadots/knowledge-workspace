import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HandHeart, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return apps.map(
        (a): RoleApplication => ({
          ...a,
          applicant: (profileMap.get(a.profile_id) as unknown as RoleApplication["applicant"]) ?? {
            display_name: "Unknown",
            handle: "unknown",
            avatar_url: null,
          },
        }),
      );
    },
    enabled: !!roleId,
  });
}

export function ApplyToRoleButton({
  roleId,
  projectId: _projectId,
  isOwner,
}: {
  roleId: string;
  projectId: string;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  // Check if already applied
  const { data: myApps = [] } = useQuery({
    queryKey: ["my-role-applications", roleId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb
        .from("project_role_applications")
        .select("id, status")
        .eq("role_id", roleId)
        .eq("profile_id", user.id);
      if (error) throw error;
      return (data ?? []) as { id: string; status: string }[];
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await sb.from("project_role_applications").insert({
        role_id: roleId,
        profile_id: user.id,
        message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-applications", roleId] });
      qc.invalidateQueries({ queryKey: ["my-role-applications", roleId] });
      setShowForm(false);
      setMessage("");
      toast.success("Application submitted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to apply");
    },
  });

  if (isOwner) return null;

  const existingApp = myApps[0];

  if (existingApp) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
          existingApp.status === "accepted"
            ? "text-brand-green"
            : existingApp.status === "declined"
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      >
        {existingApp.status === "accepted" && <CheckCircle2 className="h-3 w-3" />}
        {existingApp.status === "declined" && <XCircle className="h-3 w-3" />}
        {existingApp.status === "pending" && <Clock className="h-3 w-3" />}
        {existingApp.status === "accepted"
          ? "Accepted"
          : existingApp.status === "declined"
            ? "Declined"
            : "Application pending"}
      </span>
    );
  }

  if (showForm) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Why'd you like to join? (optional)"
          rows={2}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs outline-none focus:border-primary resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            {applyMutation.isPending ? "Sending…" : "Submit"}
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="flex items-center gap-1 rounded-full border border-brand-purple/40 bg-brand-purple/10 px-3 py-1.5 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/20"
    >
      <HandHeart className="h-3 w-3" />
      Apply
    </button>
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
                  className="rounded-lg bg-brand-green/10 px-2 py-1 text-[10px] font-medium text-brand-green transition hover:bg-brand-green/20"
                >
                  Accept
                </button>
                <button
                  onClick={() => onDecline?.(app.id)}
                  className="rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive transition hover:bg-destructive/20"
                >
                  Decline
                </button>
              </div>
            )}
            {app.status !== "pending" && (
              <span
                className={`text-[10px] font-medium ${
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
