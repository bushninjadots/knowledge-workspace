// ── Community help ────────────────────────────────────────────────────────────
// Proof that someone helps: replies the asker marked as the solution, thanks
// with the reason in the thanker's own words, how many people that reached and
// which skills it was for. Read from community_help_summary(), which counts
// public posts only. Used by the default public profile and by the Studio's
// "Community help" block, so the two can't drift.

import { Link } from "@tanstack/react-router";
import { CheckCircle2, Heart, HeartHandshake } from "lucide-react";
import { hasHelped, useHelpSummary, type HelpSummary } from "@/hooks/use-community-help";

/** "3 solutions · 5 thanks · helped 4 people" as separate stats. */
function HelpStats({ summary }: { summary: HelpSummary }) {
  const stats = [
    { label: summary.solutions === 1 ? "Solution" : "Solutions", value: summary.solutions },
    { label: "Thanks", value: summary.thanks },
    {
      label: summary.people_helped === 1 ? "Person helped" : "People helped",
      value: summary.people_helped,
    },
  ];
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-muted-foreground">{stat.label}</dt>
          <dd className="font-medium tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CommunityHelpBody({
  summary,
  showSkills = true,
  showThanks = true,
}: {
  summary: HelpSummary;
  showSkills?: boolean;
  showThanks?: boolean;
}) {
  return (
    <div className="space-y-4">
      <HelpStats summary={summary} />
      {showSkills && summary.skills.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Helped with</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.skills.map((skill) => (
              <li key={skill.slug}>
                <Link
                  to="/skills/$slug"
                  params={{ slug: skill.slug }}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-0.5 text-xs transition-colors hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  {skill.name}
                  {skill.count > 1 && (
                    <span className="tabular-nums text-muted-foreground">×{skill.count}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showThanks && summary.recent.length > 0 && (
        <ul className="space-y-2.5">
          {summary.recent.map((thanks) => (
            <li
              key={`${thanks.post_id}-${thanks.created_at}`}
              className="border-l-2 border-[color-mix(in_oklab,var(--caution)_45%,transparent)] pl-3"
            >
              <p className="text-sm">
                <Heart
                  className="mr-1.5 inline h-3 w-3 -translate-y-px fill-current text-caution"
                  aria-hidden
                />
                &ldquo;{thanks.reason}&rdquo;
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {thanks.from_handle ? (
                  <Link
                    to="/u/$handle"
                    params={{ handle: thanks.from_handle }}
                    className="font-medium text-foreground/80 hover:underline"
                  >
                    {thanks.from_name ?? thanks.from_handle}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground/80">
                    {thanks.from_name ?? "Someone"}
                  </span>
                )}{" "}
                on{" "}
                <Link
                  to="/community"
                  search={{ post: thanks.post_id } as Record<string, string>}
                  className="hover:underline"
                >
                  {thanks.post_title}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The public profile's "Community help" section. Renders nothing until the
 * person has helped someone in public — an empty section says nothing.
 */
export function ProfileCommunityHelp({ profileId, name }: { profileId: string; name: string }) {
  const { data: summary } = useHelpSummary(profileId);
  if (!summary || !hasHelped(summary)) return null;
  return (
    <section aria-labelledby="profile-help-heading" className="mt-12 border-t border-border pt-8">
      <div className="mb-4 flex items-start gap-3">
        <HeartHandshake
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h2
            id="profile-help-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Community help
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Questions {name} answered and the thanks that came back
            {summary.solutions > 0 && (
              <>
                {" "}
                — <CheckCircle2 className="inline h-3.5 w-3.5 text-trust" aria-hidden /> marked as
                the solution {summary.solutions} time{summary.solutions === 1 ? "" : "s"}
              </>
            )}
            .
          </p>
        </div>
      </div>
      <CommunityHelpBody summary={summary} />
    </section>
  );
}
