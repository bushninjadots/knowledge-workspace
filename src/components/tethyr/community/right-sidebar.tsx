import { memo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  HandHeart,
  Handshake,
  Trophy,
  Flag,
  Star,
  Target,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useChallenges } from "@/hooks/use-challenges";
import { useTrendingSkills, useCurrentUser } from "@/hooks/use-current-user";
import { useInfinitePosts, flattenPosts } from "@/hooks/use-community";
import type { DiscoverableSkill } from "@/hooks/use-current-user";
import { completenessPercent } from "@/lib/profile-completeness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function RailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3.5">
      <p className="section-label mb-2 flex items-center gap-1.5 px-1">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function DigestRow({
  icon: Icon,
  tint,
  label,
  detail,
  to,
  count,
}: {
  icon: typeof Trophy;
  tint: string;
  label: string;
  detail?: string;
  to: string;
  count?: number;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-elevated/60"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground group-hover:text-primary">
          {label}
        </span>
        {detail && (
          <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
        )}
      </span>
      {count != null && count > 0 && (
        <span className="numeric shrink-0 text-[11px] font-semibold text-muted-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * Memoized so it only re-renders when its own data (challenges, trending
 * skills, posts, the current user) changes — never when feed or nav state
 * updates elsewhere on the page.
 */
export const CommunityRightSidebar = memo(function CommunityRightSidebar({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const { data: challenges = [] } = useChallenges("active");
  const { data: trendingSkills = [], isLoading: isLoadingSkills } = useTrendingSkills();
  const { data } = useInfinitePosts();
  const posts = flattenPosts(data?.pages);
  const { data: me } = useCurrentUser();

  const helpCount = posts.filter((p) => p.type === "help_request").length;
  const collabCount = posts.filter((p) => p.type === "collaboration_request").length;
  const digestEmpty = challenges.length === 0 && helpCount === 0 && collabCount === 0;

  const completeness = me
    ? completenessPercent({
        profile: me.profile,
        teachCount: me.teachIds.length,
        learnCount: me.learnIds.length,
        projectsCount: me.projects.length,
      })
    : null;
  const needsCompletion = completeness != null && completeness < 100;
  const resources = (me?.projects ?? [])
    .flatMap((project) =>
      (project.resources ?? [])
        .slice(0, 2)
        .map((resource) => ({ ...resource, projectId: project.id, projectTitle: project.title })),
    )
    .slice(0, 4);

  return (
    <aside
      className={`${mobile ? "flex flex-col gap-3" : "hidden w-72 shrink-0 flex-col gap-3 xl:flex"}`}
    >
      {/* Today — one digest instead of three separate widgets */}
      <RailCard title="Today" icon={<Target className="h-3.5 w-3.5 text-primary" />}>
        {digestEmpty ? (
          <div className="space-y-2 px-1 text-xs text-muted-foreground">
            <p>Quiet day in the community.</p>
            <Link
              to="/community"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Start the conversation
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {challenges.slice(0, 3).map((challenge, index) => (
              <DigestRow
                key={challenge.id}
                icon={index === 1 ? Flag : index === 2 ? Star : Trophy}
                tint={
                  index === 1
                    ? "bg-brand-purple/10 text-brand-purple"
                    : index === 2
                      ? "bg-primary/10 text-primary"
                      : "bg-brand-green/10 text-brand-green"
                }
                label={challenge.title}
                detail={`${challenge.difficulty} · ${challenge.participant_count ?? 0} joined`}
                to={`/challenges/${challenge.id}`}
              />
            ))}
            {helpCount > 0 && (
              <DigestRow
                icon={HandHeart}
                tint="bg-primary/10 text-primary"
                label="Help requests"
                detail="People who need a hand right now"
                to="/community?nav=help"
                count={helpCount}
              />
            )}
            {collabCount > 0 && (
              <DigestRow
                icon={Handshake}
                tint="bg-brand-purple/10 text-brand-purple"
                label="Collaborations"
                detail="Open calls for teammates"
                to="/community?nav=collab"
                count={collabCount}
              />
            )}
          </div>
        )}
      </RailCard>

      {/* Trending skills — inline chips, not a list */}
      <RailCard
        title="Trending skills"
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand-green" />}
      >
        {isLoadingSkills ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="h-5 w-16 animate-pulse rounded-full bg-surface-elevated" />
            ))}
          </div>
        ) : trendingSkills.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Skills will appear as the network grows.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {trendingSkills.slice(0, 6).map((skill: DiscoverableSkill) => (
              <Link key={skill.id} to="/skills/$slug" params={{ slug: skill.slug }}>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 hover:bg-secondary">
                  #{skill.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </RailCard>

      <RailCard
        title="Useful resources"
        icon={<BookOpen className="h-3.5 w-3.5 text-brand-purple" />}
      >
        {resources.length === 0 ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Project guides, references, and tools shared by builders will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {resources.map((resource, index) => (
              <a
                key={`${resource.projectId}-${index}`}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg px-2 py-2 transition-colors hover:bg-surface-elevated/60"
              >
                <span className="block truncate text-xs font-medium group-hover:text-primary">
                  {resource.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  From {resource.projectTitle}
                </span>
              </a>
            ))}
          </div>
        )}
        <Link
          to="/library"
          className="mt-2 inline-flex items-center gap-1 px-2 text-xs font-medium text-primary hover:underline"
        >
          Open Library <ArrowRight className="h-3 w-3" />
        </Link>
      </RailCard>

      {/* One clear CTA — complete the profile / set learning goals */}
      <RailCard title="Your Tethyr" icon={<Target className="h-3.5 w-3.5 text-primary" />}>
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          {needsCompletion
            ? `Your profile is ${completeness}% complete. Finishing it makes you findable for collabs and mentorships.`
            : "Set your growth goals so people with the right skills can find you."}
        </p>
        <Button size="sm" asChild className="mt-3 w-full rounded-full">
          <Link to="/profile">
            {needsCompletion ? "Complete your profile" : "Set learning goals"}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </RailCard>
    </aside>
  );
});
