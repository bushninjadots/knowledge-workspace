// Public-facing profile at /u/:handle. Anyone can view — even signed-out —
// because the profiles table has a public SELECT policy. Signed-in visitors
// see a Connect button.
import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, Languages, GraduationCap, Sparkles, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/validators";
import { useDominantColor } from "@/lib/dominant-color";
import { ConnectButton } from "@/components/tethyr/connect-button";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { useState } from "react";

type PublicProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
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
};

type SkillLite = { id: string; name: string; category: string };

export const Route = createFileRoute("/u/$handle")({
  component: PublicProfileRoute,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No creator with that handle.
    </div>
  ),
});

function PublicProfileRoute() {
  const { handle } = useParams({ from: "/u/$handle" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, handle, display_name, creator_title, bio, avatar_url, banner_url, country, timezone, languages, category, years_experience, portfolio_links, social_links, favourite_tools, software_stack, teaching_style, learning_goals",
        )
        .eq("handle", handle)
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw notFound();

      const [teach, learn] = await Promise.all([
        supabase
          .from("profile_skills_teach")
          .select("skill_id, skills(id, name, category)")
          .eq("profile_id", profile.id),
        supabase
          .from("profile_skills_learn")
          .select("skill_id, skills(id, name, category)")
          .eq("profile_id", profile.id),
      ]);

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
        .map((r) => r.skills as unknown as SkillLite | null)
        .filter((s): s is SkillLite => !!s);
      const learnSkills = (learn.data ?? [])
        .map((r) => r.skills as unknown as SkillLite | null)
        .filter((s): s is SkillLite => !!s);

      return {
        profile: profile as PublicProfile,
        teachSkills,
        learnSkills,
        avatarSigned,
        bannerSigned,
      };
    },
  });

  // Called unconditionally (before the loading/error early-returns below) to
  // satisfy the Rules of Hooks — falls back to null until data resolves.
  const bannerAccent = useDominantColor(data?.bannerSigned ?? null);

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
        <div className="p-8 text-sm text-muted-foreground">Creator not found.</div>
      </Shell>
    );
  }

  const { profile, teachSkills, learnSkills, avatarSigned, bannerSigned } = data;
  const initial = (profile.display_name ?? profile.handle ?? "?").charAt(0).toUpperCase();

  return (
    <Shell>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
          <div
            className="relative -m-6 mb-6 h-40 overflow-hidden rounded-t-3xl border-2 transition-colors duration-500 sm:-m-8 sm:mb-8 sm:h-56"
            style={{ borderColor: bannerAccent ?? "transparent" }}
          >
            {bannerSigned ? (
              <img src={bannerSigned} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative shrink-0 -mt-16 sm:-mt-20">
              <div className="h-28 w-28 overflow-hidden rounded-3xl bg-gradient-brand ring-4 ring-surface sm:h-32 sm:w-32">
                {avatarSigned ? (
                  <img src={avatarSigned} alt="" className="h-full w-full object-cover" />
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
                  <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">
                    {profile.display_name || "Untitled creator"}
                  </h1>
                  {profile.creator_title && (
                    <p className="mt-0.5 text-sm text-foreground/80">{profile.creator_title}</p>
                  )}
                  <p className="text-sm text-muted-foreground">@{profile.handle ?? "—"}</p>
                </div>
                <ConnectButton targetId={profile.id} />
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
              </div>
              {profile.bio && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Skills they teach" icon={<GraduationCap className="h-4 w-4" />}>
            {teachSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not sharing any yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {teachSkills.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Currently learning" icon={<Sparkles className="h-4 w-4" />}>
            {learnSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {learnSkills.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

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
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {p.label || p.url}
                </a>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(profile.social_links ?? {}).map(([k, url]) => (
                  <a
                    key={k}
                    href={safeHref(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {k}
                  </a>
                ))}
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </Shell>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-surface p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/80">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6 md:hidden">
          <button
            className="rounded-full p-2 hover:bg-surface"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <span className="block h-0.5 w-5 bg-foreground" />
          </button>
          <span className="font-display font-semibold">Profile</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
