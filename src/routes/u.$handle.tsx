// Public-facing profile at /u/:handle. Anyone can view — even signed-out —
// because the profiles table has a public SELECT policy. Signed-in visitors
// see a Connect button.
import { createFileRoute, notFound, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Clock,
  Languages,
  GraduationCap,
  Sparkles,
  Link as LinkIcon,
  ThumbsUp,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/validators";
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { ConnectButton } from "@/components/tethyr/connect-button";
import { FollowButton } from "@/components/tethyr/follow-button";
import {
  VerificationBadge,
  ExperienceBadge,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  type SkillVerificationLevel,
  type SkillExperienceLevel,
} from "@/components/tethyr/profile-sections";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useEndorseSkill } from "@/hooks/use-skill-endorsements";
import { toast } from "sonner";

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
  component: PublicProfileRoute,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      {error.message}
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: async () => {
      const { data: profile, error } = await (supabase as any)
        .from("profiles")
        .select(
          "id, handle, display_name, creator_title, bio, avatar_url, banner_url, banner_caption, country, timezone, languages, category, years_experience, portfolio_links, social_links, favourite_tools, software_stack, teaching_style, learning_goals, reputation_score",
        )
        .eq("handle", handle)
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw notFound();

      const [teach, learn] = await Promise.all([
        supabase
          .from("profile_skills_teach")
          .select(
            "skill_id, verification_level, experience_level, proof_url, skills(id, slug, name, category)",
          )
          .eq("profile_id", profile.id),
        supabase
          .from("profile_skills_learn")
          .select("skill_id, skills(id, slug, name, category)")
          .eq("profile_id", profile.id),
      ]);

      const teachSkillIds = (teach.data ?? []).map((r) => r.skill_id);
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
        const { data: s } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_url, 60 * 60);
        avatarSigned = s?.signedUrl ?? null;
      }
      if (profile.banner_url) {
        const { data: s } = await supabase.storage
          .from("banners")
          .createSignedUrl(profile.banner_url, 60 * 60);
        bannerSigned = s?.signedUrl ?? null;
      }

      const teachSkills = (teach.data ?? [])
        .map((r) => {
          const s = r.skills as unknown as SkillLite | null;
          if (!s) return null;
          const rowsForSkill = endorsementRows.filter((e) => e.skill_id === r.skill_id);
          return {
            ...s,
            verification_level: r.verification_level as SkillVerificationLevel,
            experience_level: r.experience_level as SkillExperienceLevel,
            proof_url: r.proof_url as string | null,
            endorsementCount: rowsForSkill.length,
            endorsedByIds: rowsForSkill.map((e) => e.endorsed_by),
          };
        })
        .filter((s): s is TeachSkillLite => !!s);
      const learnSkills = (learn.data ?? [])
        .map((r) => r.skills as unknown as SkillLite | null)
        .filter((s): s is SkillLite => !!s);

      // Fetch projects this user has contributed to
      let contributedProjects: ProjectLite[] = [];
      try {
        const { data: contribRows } = await (supabase as any)
          .from("project_contributors")
          .select(
            "project_id, role, projects(id, title, description, status, stage, progress_percent, cover_url, tags)",
          )
          .eq("profile_id", profile.id)
          .limit(6);
        if (contribRows) {
          contributedProjects = contribRows
            .map((r: any) => {
              const p = r.projects;
              if (!p) return null;
              return {
                id: p.id,
                title: p.title,
                description: p.description,
                status: p.status,
                stage: p.stage ?? null,
                progress_percent: p.progress_percent ?? null,
                cover_url: p.cover_url ?? null,
                tags: p.tags ?? [],
                role: r.role,
              };
            })
            .filter((p: ProjectLite | null): p is ProjectLite => !!p);
        }
      } catch {
        // project_contributors may not exist yet — safe to ignore
      }

      return {
        profile: profile as PublicProfile,
        teachSkills,
        learnSkills,
        contributedProjects,
        avatarSigned,
        bannerSigned,
      };
    },
  });

  // Called unconditionally (before the loading/error early-returns below) to
  // satisfy the Rules of Hooks — falls back to null until data resolves.
  const bannerAccent = useDominantColor(data?.bannerSigned ?? null);
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const endorse = useEndorseSkill();

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
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
  const initial = (profile.display_name ?? profile.handle ?? "?").charAt(0).toUpperCase();

  return (
    <Shell accentColor={bannerAccent}>
      <div className="animate-room-enter mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
        {/* ── Hero: Studio Backdrop ── */}
        <div className="card-border relative overflow-hidden rounded-3xl border bg-surface p-6 sm:p-8">
          <div
            className="relative -m-6 mb-6 h-48 overflow-hidden rounded-t-3xl border border-b-0 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-72"
            style={{ borderColor: bannerAccent ?? "transparent" }}
          >
            {bannerSigned ? (
              <img
                src={bannerSigned}
                alt={`${profile.display_name ?? "Member"} banner`}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
            )}
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-surface" />
            <div className="absolute inset-0 bg-linear-to-r from-black/10 via-transparent to-transparent" />
            {profile.banner_caption && (
              <span className="absolute bottom-4 right-4 z-20 max-w-[11rem] truncate rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur sm:max-w-xs">
                {profile.banner_caption}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar — Creator Portrait */}
            <div className="relative shrink-0 -mt-16 sm:-mt-20">
              <div className="h-28 w-28 overflow-hidden rounded-3xl bg-gradient-brand ring-4 ring-surface ring-offset-2 ring-offset-surface/50 sm:h-32 sm:w-32">
                {avatarSigned ? (
                  <img
                    src={avatarSigned}
                    alt={`${profile.display_name ?? "Member"} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
                    {initial}
                  </div>
                )}
              </div>
            </div>

            {/* Name, Title, Meta — Secondary to Work */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">
                    {profile.display_name || "Untitled member"}
                  </h1>
                  {profile.creator_title && (
                    <p className="mt-0.5 text-sm text-foreground/80">{profile.creator_title}</p>
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
                {profile.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" /> {profile.languages.join(", ")}
                  </span>
                )}
                {profile.reputation_score != null && profile.reputation_score > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2.5 py-0.5 text-brand-green">
                    <Sparkles className="h-3 w-3" /> {profile.reputation_score} rep
                  </span>
                )}
              </div>

              {/* Start a Conversation CTA */}
              {meId && meId !== profile.id && (
                <Link
                  to="/messages"
                  className="transition-lift mt-4 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  <MessageCircle className="h-4 w-4" />
                  Start a conversation
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 1: Skills They Teach (with endorsements) ── */}
        <SectionCard
          title="Studios"
          subtitle="Skills they share and can help you with"
          icon={<GraduationCap className="h-4 w-4" />}
        >
          {teachSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not sharing any studios yet.</p>
          ) : (
            <div className="space-y-3">
              {teachSkills.map((s) => {
                const alreadyEndorsed = !!meId && s.endorsedByIds.includes(meId);
                const canEndorse = !!meId && meId !== profile.id && !alreadyEndorsed;
                return (
                  <div
                    key={s.id}
                    className="transition-lift group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 hover:border-primary/40 hover:bg-primary/8"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        to="/skills/$slug"
                        params={{ slug: s.slug ?? s.name.toLowerCase().replace(/\s+/g, "-") }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <VerificationBadge level={s.verification_level} proofUrl={s.proof_url} />
                        <ExperienceBadge level={s.experience_level} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.endorsementCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          <ThumbsUp className="h-3 w-3" />
                          {s.endorsementCount}
                        </span>
                      )}
                      {canEndorse && (
                        <button
                          type="button"
                          disabled={endorse.isPending}
                          onClick={() =>
                            endorse.mutate(
                              {
                                profileId: profile.id,
                                skillId: s.id,
                                endorsedBy: meId as string,
                              },
                              {
                                onSuccess: () => toast.success(`Endorsed ${s.name}`),
                                onError: (e: Error) => toast.error(e.message),
                              },
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          <ThumbsUp className="h-3 w-3" /> Endorse
                        </button>
                      )}
                      {alreadyEndorsed && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                          <ThumbsUp className="h-3 w-3" /> Endorsed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Section 2: Project Contributions ── */}
        <SectionCard
          title="Contributions"
          subtitle="Projects this person has worked on"
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          }
        >
          {contributedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No project contributions visible yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contributedProjects.map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="transition-lift group rounded-2xl border border-border/60 bg-background/40 p-4 hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground group-hover:text-primary">
                      {p.title}
                    </h3>
                    {p.status && (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${PROJECT_STATUS_STYLE[p.status as keyof typeof PROJECT_STATUS_STYLE] ?? "border-border/60 text-muted-foreground"}`}
                      >
                        {PROJECT_STATUS_LABEL[p.status as keyof typeof PROJECT_STATUS_LABEL] ??
                          p.status}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {p.role}
                    </span>
                    {p.progress_percent != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {p.progress_percent}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Section 3: Currently Learning ── */}
          <SectionCard title="Currently learning" icon={<Sparkles className="h-4 w-4" />}>
            {learnSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {learnSkills.map((s) => (
                  <Link
                    key={s.id}
                    to="/skills/$slug"
                    params={{ slug: s.slug ?? s.name.toLowerCase().replace(/\s+/g, "-") }}
                    className="transition-lift rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Section 4: Links and Social ── */}
          {(profile.portfolio_links.length > 0 ||
            Object.keys(profile.social_links ?? {}).length > 0) && (
            <SectionCard title="Links" icon={<LinkIcon className="h-4 w-4" />}>
              <div className="space-y-2">
                {profile.portfolio_links.map((p, i) => (
                  <a
                    key={i}
                    href={safeHref(p.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-lift flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-foreground hover:bg-primary/5 hover:text-primary"
                  >
                    <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.label || p.url}</span>
                  </a>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  {Object.entries(profile.social_links ?? {}).map(([k, url]) => (
                    <a
                      key={k}
                      href={safeHref(url)}
                      target="_blank"
                      rel="noreferrer"
                      className="transition-lift rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    >
                      {k}
                    </a>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Section 5: About (bio is secondary) ── */}
        {profile.bio && (
          <SectionCard
            title="About"
            icon={
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            }
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
              {profile.bio}
            </p>
            {(profile.favourite_tools.length > 0 || profile.software_stack.length > 0) && (
              <div className="mt-4 space-y-2">
                {profile.favourite_tools.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Tools
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {profile.favourite_tools.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.software_stack.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Stack
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {profile.software_stack.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </Shell>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-border bg-noise relative rounded-3xl border bg-surface p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          {icon}
          {title}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Shell({
  children,
  accentColor,
}: {
  children: React.ReactNode;
  accentColor?: string | null;
}) {
  const accentStyle = accentColor
    ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
    : undefined;
  return (
    <div className="min-h-screen bg-background" style={accentStyle}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          Tethyr
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Profile</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
