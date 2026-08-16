import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, Link2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAttachProjectToTeam,
  useInviteToTeam,
  useMyTeamInvites,
  useRemoveMember,
  useRespondToTeamInvite,
  useSetMemberRole,
  type TeamMemberRow,
  type TeamProjectRow,
  type TeamRole,
  type TeamRow,
} from "@/hooks/use-teams";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMyProjects } from "@/hooks/use-projects";
import { useTeamCredits } from "@/hooks/use-credits";
import { CreditsRoll } from "@/components/tethyr/project/project-credits";

const ROLE_LABEL: Record<TeamRole, string> = {
  lead: "Leads",
  core: "Core",
  contributor: "Contributors",
};

const ROLE_ORDER: TeamRole[] = ["lead", "core", "contributor"];

export function TeamPage({
  team,
  members,
  projects,
}: {
  team: TeamRow;
  members: TeamMemberRow[];
  projects: TeamProjectRow[];
}) {
  const { data: me } = useCurrentUser();
  const isLead = members.some((m) => m.profile_id === me?.userId && m.role === "lead");

  const setRole = useSetMemberRole(team.id);
  const removeMember = useRemoveMember(team.id);
  const respond = useRespondToTeamInvite();
  const { data: invites = [] } = useMyTeamInvites();
  const pendingInvite = invites.find((i) => i.team_id === team.id);
  const creditsQuery = useTeamCredits(team.id);

  const shipped = projects.filter((p) => p.project).map((p) => p.project!);

  return (
    <div className="animate-room-enter mx-auto max-w-5xl bg-noise px-4 pb-16 pt-6 sm:px-8">
      {pendingInvite && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-4 py-3">
          <p className="text-sm text-foreground">You've been invited to join this crew.</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                respond.mutate({ inviteId: pendingInvite.id, teamId: team.id, accept: true })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
            >
              Accept
            </button>
            <button
              onClick={() =>
                respond.mutate({ inviteId: pendingInvite.id, teamId: team.id, accept: false })
              }
              className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Identity */}
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Crew</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">/{team.slug}</p>
      </header>

      {/* Shipped work — the flagship */}
      <section aria-labelledby="shipped-work" className="mb-10">
        <h2 id="shipped-work" className="mb-4 text-sm font-semibold text-foreground/80">
          Shipped work
          <span className="ml-1 font-normal text-muted-foreground">({shipped.length})</span>
        </h2>
        {shipped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shipped work yet — attach a project.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shipped.map((p) => (
              <li key={p.id}>
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="block rounded-xl border card-border bg-surface p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
                >
                  <span className="block truncate font-medium text-foreground">{p.title}</span>
                  <span className="mt-1 block text-xs capitalize text-muted-foreground">
                    {p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Roster */}
      <section aria-labelledby="roster" className="mb-10">
        <h2 id="roster" className="mb-4 text-sm font-semibold text-foreground/80">
          Roster
          <span className="ml-1 font-normal text-muted-foreground">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members yet — invite your first collaborator.
          </p>
        ) : (
          <div className="space-y-5">
            {ROLE_ORDER.map((role) => {
              const rows = members.filter((m) => m.role === role);
              if (rows.length === 0) return null;
              return (
                <div key={role}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {ROLE_LABEL[role]}
                  </h3>
                  <ul className="space-y-2 border-l border-border/60 pl-4">
                    {rows.map((m) => (
                      <li
                        key={m.profile_id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        {m.profile?.handle ? (
                          <Link
                            to="/u/$handle"
                            params={{ handle: m.profile.handle }}
                            className="font-medium text-foreground underline-offset-2 hover:underline"
                          >
                            {m.profile.display_name || m.profile.handle}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">
                            {m.profile?.display_name || "Unknown"}
                          </span>
                        )}
                        {isLead && m.role !== "lead" && (
                          <span className="flex items-center gap-1">
                            {m.role !== "core" && (
                              <button
                                onClick={() =>
                                  setRole.mutate({ profileId: m.profile_id, role: "core" })
                                }
                                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
                              >
                                Make core
                              </button>
                            )}
                            <button
                              onClick={() => removeMember.mutate(m.profile_id)}
                              className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove member"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Credits across all of the crew's projects */}
      <CreditsRoll
        credits={creditsQuery.data}
        isLoading={creditsQuery.isLoading}
        isError={creditsQuery.isError}
        onRetry={creditsQuery.refetch}
      />

      {/* Management (lead only) */}
      {isLead && <Management team={team} />}
    </div>
  );
}

function Management({ team }: { team: TeamRow }) {
  const [handle, setHandle] = useState("");
  const [inviting, setInviting] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const invite = useInviteToTeam(team.id);
  const attach = useAttachProjectToTeam(team.id);
  const { data: myProjects = [] } = useMyProjects();

  async function handleInvite() {
    if (!handle.trim()) return;
    setInviting(true);
    try {
      await invite.mutateAsync(handle.trim());
      setHandle("");
      toast.success("Invite sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function handleAttach(projectId: string) {
    setAttaching(projectId);
    try {
      await attach.mutateAsync(projectId);
      toast.success("Project attached");
    } catch {
      toast.error("Couldn't attach project");
    } finally {
      setAttaching(null);
    }
  }

  return (
    <section aria-labelledby="manage-crew" className="rounded-xl bg-surface-elevated/30 p-5">
      <h2 id="manage-crew" className="mb-4 text-sm font-semibold text-foreground/80">
        Manage crew
      </h2>

      <div className="mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" />
          Invite by handle
        </label>
        <div className="flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. maya"
            className="w-full max-w-xs rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleInvite}
            disabled={!handle.trim() || inviting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
          >
            {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Invite
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Attach a project
        </label>
        {myProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't own any projects yet — create one to attach it here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {myProjects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => handleAttach(p.id)}
                  disabled={attaching === p.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  <span className="truncate">{p.title}</span>
                  {attaching === p.id && (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
