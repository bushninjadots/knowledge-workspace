// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.
import { useEffect, useMemo } from "react";
import { createFileRoute, notFound, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Languages, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { canonicalLinks } from "@/lib/seo";
import {
  appearanceStyle,
  backgroundImagePublicUrl,
  type ProfileBackground,
} from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { ConnectButton } from "@/components/tethyr/connect-button";
import { FollowButton } from "@/components/tethyr/follow-button";
import { FavoriteBadge } from "@/components/tethyr/achievements";
import { PublicStudioWorkspace } from "@/components/tethyr/profile/public-studio-workspace";
import { StudioDirection } from "@/components/tethyr/profile/studio-direction";
import {
  type SkillExperienceLevel,
  type SkillVerificationLevel,
} from "@/components/tethyr/profile-sections";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections } from "@/hooks/use-connections";
import { useEndorseSkill } from "@/hooks/use-skill-endorsements";
import { usePublicStudioLayout } from "@/hooks/use-public-studio-layout";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type { EvidenceShelfItem } from "@/hooks/use-project-loop";

type PublicProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_caption: string | null;
  country: string | null;
  timezone: string | null;
  languages: string[];
  category: string | null;
  years_experience: number | null;
  portfolio_links: { label: string; url: string }[];
  social_links: Record<string, string>;
  favourite_tools: string[];
  software_stack: string[];
  teaching_style: string | null;
  learning_goals: string | null;
  reputation_score: number | null;
  favorite_achievement: string | null;
  availability: string | null;
  background?: ProfileBackground | null;
  public_background?: ProfileBackground | null;
  evidence_shelf: EvidenceShelfItem[];
};

type SkillLite = { id: string; slug: string; name: string; category: string };
type TeachSkillLite = SkillLite & {
  verification_level: SkillVerificationLevel;
  experience_level: SkillExperienceLevel;
  proof_url: string | null;
  endorsementCount: number;
  endorsedByIds: string[];
};

type ProjectLite = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stage: string | null;
  progress_percent: number | null;
  cover_url: string | null;
  tags: string[];
  role: string;
};

export const Route = createFileRoute("/u/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — Tethyr` },
      {
        name: "description",
        content: `Explore @${params.handle}'s work, skills, and projects on Tethyr.`,
      },
    ],
    links: canonicalLinks(`/u/${encodeURIComponent(params.handle)}`),
  }),
  component: PublicProfileRoute,
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This person's studio couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No person with that handle.
    </div>
  ),
});

function PublicProfileRoute() {
  const { handle } = useParams({ from: "/u/$handle" });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, handle, display_name, creator_title, bio, avatar_url, banner_url, banner_caption, country, timezone, languages, category, years_experience, portfolio_links, social_links, favourite_tools, software_stack, teaching_style, learning_goals, reputation_score, favorite_achievement, availability, background, public_background, evidence_shelf",
        )
        .eq("handle", handle)
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw notFound();

      type TeachSkillRow = {
        skill_id: string;
        verification_level: SkillVerificationLevel;
        experience_level: SkillExperienceLevel;
        proof_url: string | null;
        skills: SkillLite | null;
      };
      type LearnSkillRow = { skill_id: string; skills: SkillLite | null };
      const TEACH_SELECT =
        "skill_id, verification_level, experience_level, proof_url, skills(id, slug, name, category)" as const;
      const LEARN_SELECT = "skill_id, skills(id, slug, name, category)" as const;
      const [teach, learn] = await Promise.all([
        supabase
          .from("profile_skills_teach")
          .select<typeof TEACH_SELECT, TeachSkillRow>(TEACH_SELECT)
          .eq("profile_id", profile.id),
        supabase
          .from("profile_skills_learn")
          .select<typeof LEARN_SELECT, LearnSkillRow>(LEARN_SELECT)
          .eq("profile_id", profile.id),
      ]);

      const teachSkillIds = (teach.data ?? []).map((row) => row.skill_id);
      let endorsementRows: { skill_id: string; endorsed_by: string }[] = [];
      if (teachSkillIds.length > 0) {
        const { data } = await supabase
          .from("skill_endorsements")
          .select("skill_id, endorsed_by")
          .eq("profile_id", profile.id)
          .in("skill_id", teachSkillIds);
        endorsementRows = data ?? [];
      }

      let avatarSigned: string | null = null;
      let bannerSigned: string | null = null;
      if (profile.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_url, 60 * 60);
        avatarSigned = signed?.signedUrl ?? null;
      }
      if (profile.banner_url) {
        const { data: signed } = await supabase.storage
          .from("banners")
          .createSignedUrl(profile.banner_url, 60 * 60);
        bannerSigned = signed?.signedUrl ?? null;
      }

      const teachSkills = (teach.data ?? [])
        .map((row) => {
          const skill = row.skills;
          if (!skill) return null;
          const rowsForSkill = endorsementRows.filter(
            (endorsement) => endorsement.skill_id === row.skill_id,
          );
          return {
            ...skill,
            verification_level: row.verification_level as SkillVerificationLevel,
            experience_level: row.experience_level as SkillExperienceLevel,
            proof_url: row.proof_url as string | null,
            endorsementCount: rowsForSkill.length,
            endorsedByIds: rowsForSkill.map((endorsement) => endorsement.endorsed_by),
          };
        })
        .filter((skill): skill is TeachSkillLite => !!skill);
      const learnSkills = (learn.data ?? [])
        .map((row) => row.skills)
        .filter((skill): skill is SkillLite => !!skill);

      let contributedProjects: ProjectLite[] = [];
      try {
        const { data: contributorRows } = await supabase
          .from("project_contributors")
          .select(
            "project_id, role, projects(id, title, description, status, stage, progress_percent, cover_url, tags)",
          )
          .eq("profile_id", profile.id)
          .limit(6);
        if (contributorRows) {
          contributedProjects = contributorRows
            .map((row): ProjectLite | null => {
              const project = row.projects;
              if (!project) return null;
              return {
                id: project.id,
                title: project.title,
                description: project.description,
                status: project.status,
                stage: project.stage ?? null,
                progress_percent: project.progress_percent ?? null,
                cover_url: project.cover_url ?? null,
                tags: project.tags ?? [],
                role: row.role,
              };
            })
            .filter((project): project is ProjectLite => !!project);
        }
      } catch {
        // Keep the public Studio useful if contribution data is unavailable.
      }

      const profileRow = {
        ...(profile as PublicProfile),
        evidence_shelf: Array.isArray((profile as { evidence_shelf?: unknown }).evidence_shelf)
          ? (
              (profile as unknown as { evidence_shelf: EvidenceShelfItem[] }).evidence_shelf ?? []
            ).slice(0, 6)
          : [],
      } as PublicProfile;
      // The public Studio prefers its own backdrop and falls back to the app one.
      const publicBg = (profileRow.public_background ?? profileRow.background) as
        ProfileBackground | null | undefined;
      return {
        profile: profileRow,
        teachSkills,
        learnSkills,
        contributedProjects,
        avatarSigned,
        bannerSigned,
        publicBackground: publicBg ?? null,
        backgroundImageUrl: backgroundImagePublicUrl(
          publicBg?.mode === "image" ? publicBg.image_url : null,
        ),
      };
    },
  });

  const bannerAccent = useDominantColor(data?.bannerSigned ?? null);
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const { data: connections = [] } = useConnections();
  const endorse = useEndorseSkill();

  // Only people I'm already connected with can start a conversation — Messages
  // lists accepted connections, so a bare "Start a conversation" link would be
  // a dead end for everyone else (they'd land on an empty thread list).
  const connectionId = useMemo(() => {
    if (!meId || !data?.profile?.id) return null;
    return (
      connections.find(
        (c) =>
          c.status === "accepted" &&
          (c.requester_id === meId || c.addressee_id === meId) &&
          (c.requester_id === data.profile.id || c.addressee_id === data.profile.id),
      )?.id ?? null
    );
  }, [connections, meId, data?.profile?.id]);
  const publicLayout = usePublicStudioLayout(data?.profile.id ?? null);

  // Live updates: when the member changes their backdrop, banner, or name,
  // viewers of the public Studio see it appear without refreshing. The channel
  // is keyed by the profile id so it refetches only this page's data.
  useEffect(() => {
    const profileId = data?.profile?.id;
    if (!profileId) return;
    const channel = supabase
      .channel(`public-profile-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profileId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public-profile", handle] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.profile?.id, handle, queryClient]);

  if (isLoading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-6 p-8" aria-hidden="true">
          <div className="h-48 rounded-xl bg-surface" />
          <div className="flex items-center gap-4">
            <div className="h-28 w-28 rounded-full bg-surface" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-1/3 rounded bg-surface" />
              <div className="h-4 w-1/4 rounded bg-surface" />
            </div>
          </div>
          <div className="h-24 rounded-xl bg-surface" />
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="p-8 text-sm text-muted-foreground">Person not found.</div>
      </Shell>
    );
  }

  const { profile, teachSkills, learnSkills, contributedProjects, avatarSigned, bannerSigned } =
    data;
  const publicBackground = data.publicBackground;
  const backgroundImageUrl = data.backgroundImageUrl;
  const initial = (profile.display_name ?? profile.handle ?? "?").charAt(0).toUpperCase();
  const languages = profile.languages ?? [];
  return (
    <Shell
      accentColor={bannerAccent}
      background={publicBackground}
      backgroundImageUrl={backgroundImageUrl}
    >
      <div className="animate-room-enter mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
        <div className="relative overflow-hidden rounded-xl border card-border bg-surface p-5 sm:p-6">
          <div
            className="relative -m-6 mb-6 h-48 overflow-hidden rounded-t-xl border border-b-0 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-72"
            style={{ borderColor: bannerAccent ?? "transparent" }}
          >
            {bannerSigned ? (
              <img
                src={bannerSigned}
                alt={`${profile.display_name ?? "Member"} banner`}
                width="1280"
                height="288"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
            )}
            {profile.banner_caption && (
              <span className="absolute bottom-4 right-4 z-20 max-w-[11rem] truncate rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur sm:max-w-xs">
                {profile.banner_caption}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative shrink-0 -mt-16 sm:-mt-20">
              <div className="h-28 w-28 overflow-hidden rounded-full bg-gradient-brand ring-4 ring-surface ring-offset-2 ring-offset-surface/50 sm:h-32 sm:w-32">
                {avatarSigned ? (
                  <img
                    src={avatarSigned}
                    alt={`${profile.display_name ?? "Member"} avatar`}
                    width="128"
                    height="128"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
                    {initial}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="break-words font-display text-2xl font-semibold sm:text-3xl">
                      {profile.display_name || "Untitled member"}
                    </h1>
                    <FavoriteBadge type={profile.favorite_achievement} />
                  </div>
                  {profile.creator_title && (
                    <p className="mt-0.5 break-words text-sm text-foreground/80">
                      {profile.creator_title}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">@{profile.handle ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <FollowButton targetUserId={profile.id} />
                  <ConnectButton
                    targetId={profile.id}
                    targetName={profile.display_name ?? profile.handle}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {profile.category && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
                    {profile.category}
                  </span>
                )}
                {profile.country && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {profile.country}
                  </span>
                )}
                {profile.timezone && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {profile.timezone}
                  </span>
                )}
                {languages.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" /> {languages.join(", ")}
                  </span>
                )}
                {profile.reputation_score != null && profile.reputation_score > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2.5 py-0.5 text-brand-green">
                    <Sparkles className="h-3 w-3" /> {profile.reputation_score} rep
                  </span>
                )}
              </div>

              {meId && meId !== profile.id && connectionId && (
                <Link
                  to="/messages"
                  search={{ c: connectionId }}
                  className="transition-lift mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--user-accent-border,var(--primary))] bg-[var(--user-accent-subtle,var(--learning-subtle))] px-4 py-2 text-sm text-primary hover:bg-[var(--user-accent-subtle,var(--learning-subtle))]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Start a conversation
                </Link>
              )}
            </div>
          </div>
        </div>

        <StudioDirection
          projects={contributedProjects.map((project) => ({
            id: project.id,
            title: project.title,
            status: project.status,
          }))}
          learningGoals={profile.learning_goals}
          availability={profile.availability}
        />

        <PublicStudioWorkspace
          profile={profile}
          profileId={profile.id}
          meId={meId}
          teachSkills={teachSkills}
          learnSkills={learnSkills}
          contributedProjects={contributedProjects}
          layoutStorage={publicLayout}
          canCustomize={meId === profile.id}
          endorsePending={endorse.isPending}
          onEndorse={(skill) => {
            if (!meId) return;
            endorse.mutate(
              { profileId: profile.id, skillId: skill.id, endorsedBy: meId },
              {
                onSuccess: () => toast.success(`Endorsed ${skill.name}`),
                onError: (e: Error) => toast.error(friendlyError(e)),
              },
            );
          }}
        />
      </div>
    </Shell>
  );
}

function Shell({
  children,
  accentColor,
  background,
  backgroundImageUrl,
}: {
  children: React.ReactNode;
  accentColor?: string | null;
  background?: ProfileBackground | null;
  backgroundImageUrl?: string | null;
}) {
  const navigate = useNavigate();
  const accentStyle = {
    ...(accentColor
      ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
      : {}),
    ...appearanceStyle(background),
  };

  return (
    <div
      className={`relative isolate min-h-screen ${background?.density === "compact" ? "tethyr-density-compact" : ""}`}
      style={accentStyle}
    >
      <BackgroundLayer background={background} imageUrl={backgroundImageUrl} />
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          Tethyr
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Studio</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
