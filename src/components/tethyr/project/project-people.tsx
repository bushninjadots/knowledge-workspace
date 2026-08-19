import { Link } from "@tanstack/react-router";
import { Users as UsersIcon, Briefcase, HandHeart, MessageSquare } from "lucide-react";
import type { Contributor } from "./project-main-content";
import type { OpenRoleRow } from "@/hooks/use-projects";
import { OpenRolesSection } from "./project-open-roles";
import { useProjectTeams } from "@/hooks/use-teams";
import { useConnections } from "@/hooks/use-connections";
import { useCurrentUser } from "@/hooks/use-current-user";

const ROLE_LABEL: Record<Contributor["role"], string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

export function ProjectPeopleTab({
  projectId,
  projectTitle,
  contributors,
  avatarSigned,
  openRoles,
  isOwner,
  onJoin: _onJoin,
  onSignIn: _onSignIn,
}: {
  projectId: string;
  projectTitle?: string;
  contributors: Contributor[];
  avatarSigned: Record<string, string>;
  openRoles: OpenRoleRow[];
  isOwner: boolean;
  isContributor: boolean;
  onJoin?: () => void;
  onSignIn?: () => void;
}) {
  const unfilledRoles = openRoles.filter((r) => !r.is_filled);
  const { data: teams = [] } = useProjectTeams(projectId);
  const { data: me } = useCurrentUser();
  const { data: connections } = useConnections();

  // Accepted connection id for each contributor, so the Message action can open
  // the right thread with project context.
  const connectionByProfile = new Map(
    (connections ?? [])
      .filter((c) => c.status === "accepted" && c.other)
      .map((c) => [c.other!.id, c.id]),
  );

  return (
    <div className="space-y-6">
      {/* Built by crew */}
      {teams.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          Built by
          {teams.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>·</span>}
              <Link
                to="/teams/$slug"
                params={{ slug: t.slug }}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {t.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      {/* People */}
      <section className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          Project people
          <span className="text-xs text-muted-foreground">({contributors.length})</span>
        </h2>
        {contributors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No contributors yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contributors.map((c) => (
              <div
                key={c.profile_id}
                className="rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-border/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/u/$handle"
                    params={{ handle: c.profile?.handle ?? "" }}
                    className="flex min-w-0 items-center gap-3 transition hover:opacity-80"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
                      {avatarSigned[c.profile_id] ? (
                        <img
                          src={avatarSigned[c.profile_id]}
                          alt=""
                          width="40"
                          height="40"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-background">
                          {(c.profile?.display_name ?? c.profile?.handle ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.profile?.display_name || c.profile?.handle || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role]}</p>
                    </div>
                  </Link>
                  {(() => {
                    const connectionId = connectionByProfile.get(c.profile_id);
                    if (!connectionId || c.profile_id === me?.userId) return null;
                    return (
                      <Link
                        to="/messages"
                        search={{
                          c: connectionId,
                          project: projectId,
                          projectName: projectTitle,
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
                        aria-label={`Message ${
                          c.profile?.display_name || c.profile?.handle || "member"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    );
                  })()}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {c.contribution_score > 0 && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                      Score: {c.contribution_score}
                    </span>
                  )}
                  {c.skills_used.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                  {c.skills_used.length > 3 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{c.skills_used.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Looking for */}
      <section>
        <div className="mb-3 flex items-center gap-2 px-1">
          <Briefcase className="h-4 w-4 text-brand-purple" />
          <h2 className="text-sm font-medium text-foreground/80">Looking for</h2>
          {unfilledRoles.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({unfilledRoles.length} open role{unfilledRoles.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        <OpenRolesSection roles={openRoles} projectId={projectId} isOwner={isOwner} />
        {openRoles.length === 0 && !isOwner && (
          <div className="rounded-xl bg-surface-elevated/30 p-4 text-center">
            <HandHeart className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No open roles right now — but this project is worth watching.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
