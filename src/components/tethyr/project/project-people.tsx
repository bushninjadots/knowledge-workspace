import { Link } from "@tanstack/react-router";
import { Users as UsersIcon, Briefcase, HandHeart, MessageSquare, Zap } from "lucide-react";
import { ProfileLink } from "@/components/tethyr/profile-link";
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
  isContributor,
  openNeedCount,
  onJoin,
  onSignIn,
  onOpenNeeds,
}: {
  projectId: string;
  projectTitle?: string;
  contributors: Contributor[];
  avatarSigned: Record<string, string>;
  openRoles: OpenRoleRow[];
  isOwner: boolean;
  isContributor: boolean;
  /** Open project needs (rendered in their own section below people). */
  openNeedCount: number;
  onJoin?: () => void;
  onSignIn?: () => void;
  onOpenNeeds?: () => void;
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

  const hasOpenWork = unfilledRoles.length > 0 || openNeedCount > 0;
  const joinLabel = unfilledRoles.length > 0 ? "Join this project" : "Offer help";

  return (
    <div className="space-y-6">
      {/* Get involved — surfaced only when the project is actually looking. */}
      {hasOpenWork && (
        <section
          aria-label="Get involved"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] p-4"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--user-accent,var(--trust))]/10 text-[var(--user-accent,var(--trust))]"
            >
              <HandHeart className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-medium">Looking for collaborators</p>
              <p className="text-xs text-muted-foreground">
                {openNeedCount > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={onOpenNeeds}
                      className="inline-flex items-center gap-1 font-medium text-[var(--user-accent,var(--trust))] underline-offset-2 hover:underline"
                    >
                      <Zap className="h-3 w-3" />
                      {openNeedCount} open need{openNeedCount !== 1 ? "s" : ""}
                    </button>
                    {unfilledRoles.length > 0 && (
                      <span>
                        {" "}
                        · {unfilledRoles.length} open role{unfilledRoles.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    {unfilledRoles.length} open role{unfilledRoles.length !== 1 ? "s" : ""} to fill
                  </span>
                )}
              </p>
            </div>
          </div>
          {onJoin ? (
            <button
              type="button"
              onClick={onJoin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--user-accent,var(--trust))] px-3.5 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
            >
              <HandHeart className="h-3.5 w-3.5" />
              {joinLabel}
            </button>
          ) : onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--user-accent,var(--trust))] px-3.5 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
            >
              <HandHeart className="h-3.5 w-3.5" />
              Sign in to join
            </button>
          ) : null}
        </section>
      )}

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

      {/* People roster */}
      <section className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          Project people
          <span className="text-xs text-muted-foreground">({contributors.length})</span>
        </h2>
        {contributors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No contributors yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/50 rounded-xl border border-border/40 bg-background/40">
            {contributors.map((c) => {
              const connectionId = connectionByProfile.get(c.profile_id);
              const canMessage = connectionId && c.profile_id !== me?.userId;
              return (
                <li
                  key={c.profile_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 transition hover:bg-surface-elevated/40 sm:flex-nowrap"
                >
                  <ProfileLink
                    handle={c.profile?.handle}
                    className="flex min-w-0 flex-1 items-center gap-3"
                    title={c.profile?.display_name || c.profile?.handle || undefined}
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-foreground text-background">
                      {avatarSigned[c.profile_id] ? (
                        <img
                          src={avatarSigned[c.profile_id]}
                          alt=""
                          width="36"
                          height="36"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
                          {(c.profile?.display_name ?? c.profile?.handle ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.profile?.display_name || c.profile?.handle || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ROLE_LABEL[c.role]}
                        {c.profile?.creator_title ? ` · ${c.profile.creator_title}` : ""}
                      </p>
                    </div>
                  </ProfileLink>

                  <div className="flex items-center gap-2">
                    {c.contribution_score > 0 && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                        {c.contribution_score} pts
                      </span>
                    )}
                    <div className="hidden min-w-0 flex-wrap items-center gap-1 md:flex">
                      {c.skills_used.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="whitespace-nowrap rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                      {c.skills_used.length > 2 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{c.skills_used.length - 2}
                        </span>
                      )}
                    </div>
                    {canMessage && (
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
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
        {openRoles.length === 0 && !isContributor && (
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
