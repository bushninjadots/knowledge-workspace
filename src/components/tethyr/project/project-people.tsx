import { Link } from "@tanstack/react-router";
import { Users as UsersIcon, UserPlus, Briefcase, HandHeart } from "lucide-react";
import type { Contributor } from "./project-main-content";
import type { OpenRoleRow } from "@/hooks/use-projects";
import { OpenRolesSection } from "./project-open-roles";

const ROLE_LABEL: Record<Contributor["role"], string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

export function ProjectPeopleTab({
  projectId,
  contributors,
  avatarSigned,
  openRoles,
  isOwner,
  isContributor,
  onJoin,
  onSignIn,
}: {
  projectId: string;
  contributors: Contributor[];
  avatarSigned: Record<string, string>;
  openRoles: OpenRoleRow[];
  isOwner: boolean;
  isContributor: boolean;
  onJoin?: () => void;
  onSignIn?: () => void;
}) {
  const canJoin = !!onJoin;
  const unfilledRoles = openRoles.filter((r) => !r.is_filled);

  return (
    <div className="space-y-6">
      {/* Join CTA banner */}
      {canJoin && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Want to work on this project?</p>
              <p className="text-xs text-muted-foreground">
                Join as a collaborator, or apply to a specific open role below.
              </p>
            </div>
          </div>
          <button
            onClick={onJoin}
            className="rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Join Project
          </button>
        </section>
      )}
      {onSignIn && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Want to work on this project?</p>
              <p className="text-xs text-muted-foreground">Sign in to join as a collaborator.</p>
            </div>
          </div>
          <button
            onClick={onSignIn}
            className="rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Sign in to join
          </button>
        </section>
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
                <Link
                  to="/u/$handle"
                  params={{ handle: c.profile?.handle ?? "" }}
                  className="flex items-center gap-3 transition hover:opacity-80"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
                    {avatarSigned[c.profile_id] ? (
                      <img
                        src={avatarSigned[c.profile_id]}
                        alt=""
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
