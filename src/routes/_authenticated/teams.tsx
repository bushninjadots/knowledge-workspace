import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Users, Clock, Check, X, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreateTeam,
  useMyTeamInvites,
  useMyTeams,
  useRespondToTeamInvite,
} from "@/hooks/use-teams";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Tethyr" },
      { name: "description", content: "Crews building together on Tethyr." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { data: me } = useCurrentUser();
  const { data: teams = [], isLoading: teamsLoading, isError } = useMyTeams();
  const { data: invites = [], isLoading: invitesLoading } = useMyTeamInvites();
  const createTeam = useCreateTeam();
  const respond = useRespondToTeamInvite();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || createTeam.isPending) return;
    try {
      const team = await createTeam.mutateAsync({ name: trimmed });
      setName("");
      setCreating(false);
      toast.success("Crew created");
      // The query invalidation updates the list; the link remains available on
      // this page even when the user wants to keep forming another crew.
      void team;
    } catch (error) {
      toast.error(friendlyError(error, "Could not create crew"));
    }
  }

  async function handleInvite(inviteId: string, teamId: string, accept: boolean) {
    try {
      await respond.mutateAsync({ inviteId, teamId, accept });
      toast.success(accept ? "Joined crew" : "Invite declined");
    } catch (error) {
      toast.error(
        friendlyError(error, accept ? "Could not join crew" : "Could not decline invite"),
      );
    }
  }

  return (
    <div className="animate-room-enter min-h-screen bg-noise px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="section-label">Build together</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Your teams</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Crews make the people behind the work visible. Keep projects, roles, and credit in one
              place.
            </p>
          </div>
          <Button
            onClick={() => setCreating((open) => !open)}
            variant="outline"
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Form a crew
          </Button>
        </header>

        {creating && (
          <section className="mb-8 border-y border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-4 py-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
            >
              <label className="min-w-[min(100%,20rem)] flex-1">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                  Crew name
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 80))}
                  placeholder="e.g. The Night Shift"
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <Button
                type="submit"
                disabled={!name.trim() || createTeam.isPending}
                className="gap-1.5"
              >
                {createTeam.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create crew
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </form>
          </section>
        )}

        {invites.length > 0 && (
          <section aria-labelledby="team-invites" className="mb-10">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--user-accent,var(--primary))]" />
              <h2 id="team-invites" className="text-sm font-semibold">
                Crew invitations
              </h2>
              <span className="text-xs text-muted-foreground">({invites.length})</span>
            </div>
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-y border-border/60 bg-surface/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      Join{" "}
                      <Link
                        to="/teams/$slug"
                        params={{ slug: invite.team?.slug ?? "" }}
                        className="font-medium hover:underline"
                      >
                        {invite.team?.name ?? "a crew"}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      You were invited to build together.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleInvite(invite.id, invite.team_id, true)}
                      disabled={respond.isPending}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleInvite(invite.id, invite.team_id, false)}
                      disabled={respond.isPending}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="your-crews">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 id="your-crews" className="text-sm font-semibold">
              Crews you build with
            </h2>
          </div>
          {teamsLoading || invitesLoading ? (
            <div className="space-y-3" aria-label="Loading teams">
              <div className="h-20 animate-pulse bg-surface" />
              <div className="h-20 animate-pulse bg-surface" />
            </div>
          ) : isError ? (
            <p
              className="border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive"
              role="alert"
            >
              Couldn&apos;t load your teams. Please try again.
            </p>
          ) : teams.length === 0 ? (
            <div className="border-y border-border/60 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">You&apos;re not in a crew yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Form one or accept an invitation to make your collaborators visible.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {teams.map(({ team, role }) => (
                <li key={team.id}>
                  <Link
                    to="/teams/$slug"
                    params={{ slug: team.slug }}
                    className="group flex items-center gap-4 px-2 py-4 transition hover:bg-surface/50 sm:px-3"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-lg font-semibold text-foreground">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{team.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {role} · /{team.slug}
                      </p>
                      {team.description && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {team.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {me?.profile?.handle && (
          <p className="mt-8 text-xs text-muted-foreground">
            Your crews appear on the work you attach to them.
          </p>
        )}
      </div>
    </div>
  );
}
