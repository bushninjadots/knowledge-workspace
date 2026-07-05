// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors and project_skills
// all carry public SELECT policies (mirrors how /u/:handle works for
// profiles). This is Phase 1 of the Projects rebuild: dashboard header,
// creator/contributors, skills involved, and progress. Milestones, journal,
// discussion and resources are later phases and intentionally not here yet.
import { useState } from "react";
import { createFileRoute, notFound, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Target,
  Users as UsersIcon,
  MessageCircle,
  UserPlus,
  ImageIcon,
  Trophy,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/validators";
import { useDominantColor, withAlpha } from "@/lib/dominant-color";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Progress } from "@/components/ui/progress";
import {
  PROJECT_LINK_KEYS,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  type ProjectStatus,
} from "@/components/tethyr/profile-sections";

type ProjectDetail = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  status: ProjectStatus;
  started_at: string;
  progress_percent: number;
  cover_url: string | null;
  links: Record<string, string>;
  tags: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
};

type PersonLite = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  avatar_url: string | null;
};

type Contributor = {
  profile_id: string;
  role: "creator" | "contributor" | "mentor";
  profile: PersonLite | null;
};

type SkillLite = { id: string; name: string; category: string };

const ROLE_ORDER: Record<Contributor["role"], number> = { creator: 0, mentor: 1, contributor: 2 };
const ROLE_LABEL: Record<Contributor["role"], string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

export const Route = createFileRoute("/projects/$id")({
  component: ProjectPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No project with that ID.
    </div>
  ),
});

function ProjectPage() {
  const { id } = useParams({ from: "/projects/$id" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      const { data: project, error } = await supabase
        .from("projects")
        .select(
          "id, profile_id, title, description, goal, status, started_at, progress_percent, cover_url, links, tags, looking_for_feedback, looking_for_collaborators, is_featured",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!project) throw notFound();

      const [contributorsRes, skillsRes] = await Promise.all([
        supabase
          .from("project_contributors")
          .select("profile_id, role, profiles(id, handle, display_name, creator_title, avatar_url)")
          .eq("project_id", id),
        supabase
          .from("project_skills")
          .select("skill_id, skills(id, name, category)")
          .eq("project_id", id),
      ]);

      const contributors = (contributorsRes.data ?? [])
        .map((r) => ({
          profile_id: r.profile_id,
          role: r.role,
          profile: (r.profiles as unknown as PersonLite) ?? null,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) as Contributor[];

      const skills = (skillsRes.data ?? [])
        .map((r) => r.skills as unknown as SkillLite | null)
        .filter((s): s is SkillLite => !!s);

      let coverSigned: string | null = null;
      if (project.cover_url) {
        const { data: s } = await supabase.storage
          .from("project-media")
          .createSignedUrl(project.cover_url, 60 * 60);
        coverSigned = s?.signedUrl ?? null;
      }

      const avatarTargets = contributors.filter((c) => c.profile?.avatar_url);
      const avatarSigned: Record<string, string> = {};
      await Promise.all(
        avatarTargets.map(async (c) => {
          const { data: s } = await supabase.storage
            .from("avatars")
            .createSignedUrl(c.profile!.avatar_url as string, 60 * 60);
          if (s?.signedUrl) avatarSigned[c.profile_id] = s.signedUrl;
        }),
      );

      return {
        project: project as ProjectDetail,
        contributors,
        skills,
        coverSigned,
        avatarSigned,
      };
    },
  });

  const accent = useDominantColor(data?.coverSigned ?? null);

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
        <div className="p-8 text-sm text-muted-foreground">Project not found.</div>
      </Shell>
    );
  }

  const { project, contributors, skills, coverSigned, avatarSigned } = data;
  const creator = contributors.find((c) => c.role === "creator");
  const otherContributors = contributors.filter((c) => c.role !== "creator");
  const timeSinceStart = formatDistanceToNowStrict(new Date(project.started_at), {
    addSuffix: true,
  });
  const links = Object.entries(project.links ?? {}).filter(([, url]) => !!url);

  return (
    <Shell accentColor={accent}>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
        {/* HEADER / DASHBOARD */}
        <div className="card-border relative overflow-hidden rounded-3xl border bg-surface">
          <div
            className="relative aspect-[21/9] w-full overflow-hidden border-b-2 transition-colors duration-500 sm:aspect-[3/1]"
            style={{ borderColor: accent ?? "transparent" }}
          >
            {coverSigned ? (
              <img src={coverSigned} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)] opacity-40">
                <ImageIcon className="h-8 w-8 text-background" />
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                    {project.title}
                  </h1>
                  {project.is_featured && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                {creator?.profile && (
                  <Link
                    to="/u/$handle"
                    params={{ handle: creator.profile.handle ?? "" }}
                    className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Avatar
                      name={creator.profile.display_name ?? creator.profile.handle}
                      src={avatarSigned[creator.profile_id]}
                    />
                    {creator.profile.display_name || creator.profile.handle}
                  </Link>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${PROJECT_STATUS_STYLE[project.status]}`}
              >
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
            </div>

            {project.goal && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground/90">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {project.goal}
              </p>
            )}

            {project.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {project.description}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <Progress value={project.progress_percent} className="h-2" />
              <span className="shrink-0 text-xs text-muted-foreground">
                {project.progress_percent}% complete
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Started {timeSinceStart}
              </span>
              {otherContributors.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="h-3.5 w-3.5" /> {otherContributors.length}{" "}
                  {otherContributors.length === 1 ? "contributor" : "contributors"}
                </span>
              )}
              {project.looking_for_feedback && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-primary">
                  <MessageCircle className="h-3 w-3" /> Looking for feedback
                </span>
              )}
              {project.looking_for_collaborators && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 px-2.5 py-0.5 text-[var(--brand-purple)]">
                  <UserPlus className="h-3 w-3" /> Open to collaborators
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* CONTRIBUTORS */}
          <SectionCard title="Contributors" icon={<UsersIcon className="h-4 w-4" />}>
            {contributors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one listed yet.</p>
            ) : (
              <div className="space-y-3">
                {contributors.map((c) => (
                  <Link
                    key={c.profile_id}
                    to="/u/$handle"
                    params={{ handle: c.profile?.handle ?? "" }}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-background/40"
                  >
                    <Avatar
                      name={c.profile?.display_name ?? c.profile?.handle}
                      src={avatarSigned[c.profile_id]}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.profile?.display_name || c.profile?.handle || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role]}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* SKILLS INVOLVED */}
          <SectionCard title="Skills involved" icon={<Target className="h-4 w-4" />}>
            {skills.length === 0 && project.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills tagged yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {s.name}
                  </span>
                ))}
                {project.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {links.length > 0 && (
          <SectionCard title="Links">
            <div className="flex flex-wrap gap-2">
              {links.map(([key, url]) => {
                const meta = PROJECT_LINK_KEYS.find((l) => l.key === key);
                const Icon = meta?.icon;
                return (
                  <a
                    key={key}
                    href={safeHref(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {meta?.label ?? key}
                  </a>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Placeholder for what's coming next — sets expectations rather than
            silently omitting the rest of the vision. */}
        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Milestones, a development journal, discussion and a resource library are coming to this
          page next.
        </div>
      </div>
    </Shell>
  );
}

function Avatar({ name, src }: { name?: string | null; src?: string }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-brand">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
          {initial}
        </div>
      )}
    </div>
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
    <div className="card-border rounded-3xl border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/80">
        {icon}
        {title}
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
  const [open, setOpen] = useState(false);
  const accentStyle = accentColor
    ? ({ "--accent-border": withAlpha(accentColor, 0.35) } as React.CSSProperties)
    : undefined;
  return (
    <div className="flex min-h-screen bg-background" style={accentStyle}>
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
          <span className="font-display font-semibold">Project</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
