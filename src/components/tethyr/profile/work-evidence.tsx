// ── Public Profile Work Evidence ──────────────────────────────────────────────
// The default reading of a person's work on the public profile, for people who
// have not published a Studio yet.
//
// Design intent (AGENTS.md, "work before metadata"): a visitor arriving at
// /u/:handle is asking "what has this person built?" — that is the product's
// entire premise. The previous fallback answered with a bio and a row of links,
// which is the profile-website answer, not the network answer. So the work comes
// first in the hierarchy, above bio and metadata, and metadata becomes the
// footnote it should have been.
//
// This is NOT a second home for a person's work. `blocks/profile/projects-block.tsx`
// remains the owner's chosen arrangement of the same rows. The distinction:
//
//   work is derived (you join a project, you appear on it)
//   arrangement is authored (the Studio block is how you present it)
//
// So this renders a single default arrangement, read-only, and publishing a
// Studio replaces it with the creator's own — it never competes with it. See
// `docs/TETHYR_DESIGN.md` and the "not everything is a card" rule: this is a
// section of rows on a page surface, not a grid of floating cards.

import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { useProfileWork, useProjectOpenWork, hasOpenWork } from "@/hooks/use-profile-work";
import { useProfileRepoSnapshot } from "@/hooks/use-profile-repo-snapshot";
import { contributionRoleVerb } from "@/lib/contribution-role";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/components/tethyr/profile/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonPill } from "@/components/tethyr/person-pill";
import { OpenWorkBadge } from "@/components/tethyr/open-work-badge";
import { CommitGraph } from "@/components/tethyr/project/commit-graph";
import type { ProjectOpenWork } from "@/hooks/use-profile-work";
import type { RepoSnapshot } from "@/hooks/use-profile-repo-snapshot";

/**
 * Renders nothing at all when there is no work. A person with no projects yet
 * should see a clean identity page, not an empty section with a heading over
 * it — an empty "Work" heading tells the visitor nothing and draws attention to
 * the absence, which is the opposite of what a brand-new profile needs.
 */
export function ProfileWorkEvidence({
  profileId,
  isOwner,
}: {
  profileId: string;
  isOwner: boolean;
}) {
  const { data, isLoading, isError } = useProfileWork(profileId);

  // Which of these projects need people right now. Called unconditionally
  // (rules of hooks) with a null id list while loading; rides the same
  // lifecycle as the work read, and a failure just means no badge, never an
  // error state.
  const { data: openWork } = useProjectOpenWork(
    data?.hasWork && data.projects.length > 0 ? data.projects.map((p) => p.id) : null,
  );

  // Cached GitHub snapshots for the visible projects: per-row stats plus the
  // one aggregate contribution graph. All cache, no GitHub calls; a profile
  // whose projects have no linked repos renders exactly as before.
  const { data: repoSnapshot } = useProfileRepoSnapshot(
    data?.hasWork && data.projects.length > 0 ? data.projects.map((p) => p.id) : null,
  );

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label="Work" className="mx-auto w-full max-w-2xl">
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  // A failed evidence read must not blank the identity above it. The person
  // still exists; we just cannot show their work right now.
  if (isError || !data?.hasWork) return null;

  return (
    <section aria-label="Work" className="mx-auto w-full max-w-2xl">
      <div className="flex items-baseline justify-between gap-3">
        {/* section-label: the canonical micro-label treatment — same utility the
            dashboard, landing, and community surfaces use for grouped content. */}
        <h2 className="section-label">Work</h2>
        {isOwner && <ArrangeYourStudioHint />}
      </div>

      {/* The aggregate graph leads only when there is something to show —
          optional signals never reserve layout (same rule as the badges). */}
      {repoSnapshot && repoSnapshot.reposWithHistory > 0 && (
        <div className="mt-3">
          <CommitGraph
            weeks={repoSnapshot.aggregateWeeks}
            ariaLabel={`Contribution graph: ${repoSnapshot.totalCommits} commits across ${repoSnapshot.reposWithHistory} repositor${repoSnapshot.reposWithHistory === 1 ? "y" : "ies"} over the last 52 weeks`}
          />
        </div>
      )}

      {/* Divided rows rather than cards: a stack of related entries is a list,
          and the page surface should stay quiet. Border separates, not shadow. */}
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {data.projects.map((project) => (
          <WorkRow
            key={project.id}
            project={project}
            repo={repoSnapshot?.byProject.get(project.id)}
            openWork={openWork}
            needsPeople={hasOpenWork(openWork, project.id)}
          />
        ))}
      </ul>

      {data.collaborators.length > 0 && (
        <div className="mt-8">
          <h2 className="section-label">Builds with</h2>
          {/* The people you could reach through this person. Each links to their
              own Studio, so "who should I meet" is answerable from a profile. */}
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {data.collaborators.map((c) => (
              <li key={c.profile_id}>
                <PersonPill
                  handle={c.profile?.handle}
                  name={c.profile?.display_name}
                  title={c.profile?.creator_title}
                  avatarSrc={c.profile?.avatar_url}
                />
                {c.sharedProjectCount > 1 && (
                  <span className="sr-only"> on {c.sharedProjectCount} shared projects</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** One project, as a row: what they did, what it is, where it is going. */
function WorkRow({
  project,
  repo,
  openWork,
  needsPeople,
}: {
  project: ProfileWorkProjectRow;
  repo?: RepoSnapshot;
  openWork?: Map<string, ProjectOpenWork>;
  needsPeople?: boolean;
}) {
  const { data: coverSigned } = useSignedStorageUrl("project-media", project.cover_url);
  const src = coverSigned ?? (project.cover_url?.startsWith("http") ? project.cover_url : null);
  const status = PROJECT_STATUS_LABEL[project.status as ProjectStatus] ?? project.status;

  return (
    <li className="group relative">
      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        // The row is one big link whose text content concatenates into an
        // unreadable run-on ("BuiltThreadlineAsync video feedback...Active").
        // Name it after the claim the row actually makes — the verb plus the
        // work — which is the one thing a screen-reader user must not miss.
        // The open-work fact joins the name: the badge sits outside it.
        aria-label={`${contributionRoleVerb(project.role)} ${project.title}${needsPeople ? " — has open roles" : ""}`}
        className="flex items-start gap-4 py-3.5 outline-none transition-colors hover:bg-surface focus-visible:bg-surface"
      >
        {src && (
          <img
            src={src}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            className="mt-0.5 h-14 w-14 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          {/* The verb leads: "Built" / "Contributed to" is the claim being made. */}
          <p className="text-[11px] text-muted-foreground">{contributionRoleVerb(project.role)}</p>
          <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
          {project.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
          {/* The repo's cached fact, when there is one — a quiet inline signal
              of where the code lives and how it is doing, never a GitHub card. */}
          {repo && (repo.stargazersCount !== null || repo.fullName) && (
            <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {repo.fullName && <span className="truncate font-mono">{repo.fullName}</span>}
              {typeof repo.stargazersCount === "number" && repo.stargazersCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                  <Star className="h-3 w-3" />
                  {repo.stargazersCount.toLocaleString()}
                </span>
              )}
              {repo.private === true && <span className="shrink-0">· private</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <OpenWorkBadge openWork={openWork} projectId={project.id} />
          {status && (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] leading-snug text-muted-foreground">
              {status}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

/**
 * Owner-only. The work above is already correct without any input — this exists
 * purely to answer the question the fallback previously left unanswered: "I see
 * my work, so what do I actually control here?" The answer is arrangement, and
 * that lives in the Studio. Rendered for the owner alone so a visitor never sees
 * a call to action on someone else's page.
 */
function ArrangeYourStudioHint() {
  return (
    <Link
      to="/studio"
      className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-[var(--user-accent-border)]"
    >
      Arrange this in your Studio
    </Link>
  );
}

type ProfileWorkProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cover_url: string | null;
  role: string;
};
