import { Bookmark, Share2, UserPlus } from "lucide-react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import type { ProjectDetail } from "@/hooks/use-projects";
import type { Contributor } from "@/routes/projects.$id";

interface ProjectHeroProps {
  project: ProjectDetail;
  coverSigned: string | null;
  creator: Contributor | undefined;
  avatarSigned: Record<string, string>;
  accent?: string | null;
}

function InlineLink({
  to,
  handle,
  className,
  children,
}: {
  to: string | undefined;
  handle: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (!to) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link to={to} params={{ handle: handle ?? "" }} className={className}>
      {children}
    </Link>
  );
}

export function ProjectHero({
  project,
  coverSigned,
  creator,
  avatarSigned,
  accent,
}: ProjectHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const coverScale = useTransform(scrollY, [0, 500], [1, 1.1]);
  const coverY = useTransform(scrollY, [0, 500], [0, -40]);

  return (
    <section className="relative h-[100vh] min-h-[480px] max-h-[800px] overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={prefersReducedMotion ? {} : { scale: coverScale, y: coverY }}
      >
        {coverSigned ? (
          <img
            src={coverSigned}
            alt={`${project.title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(120deg,oklch(0.65_0.26_305)_0%,oklch(0.92_0.23_142)_100%)] opacity-40" />
        )}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
        <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-semibold text-white drop-shadow-lg sm:text-5xl">
              {project.title}
            </h1>
            {creator?.profile && (
              <InlineLink
                to={creator.profile.handle ? "/u/$handle" : undefined}
                handle={creator.profile.handle}
                className="mt-3 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
              >
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gradient-brand ring-2 ring-white/20">
                  {avatarSigned[creator.profile_id] ? (
                    <img
                      src={avatarSigned[creator.profile_id]}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-background">
                      {(creator.profile?.display_name ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                {creator.profile.display_name || creator.profile.handle}
              </InlineLink>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Status pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    project.status === "active"
                      ? "bg-[var(--user-accent,var(--trust))]"
                      : project.status === "planning"
                        ? "bg-teaching"
                        : project.status === "paused"
                          ? "bg-muted-foreground/40"
                          : "bg-primary"
                  }`}
                />
                {project.status}
              </span>
              {project.looking_for_collaborators && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-3 py-1 text-[11px] font-medium text-brand-purple backdrop-blur-sm">
                  <UserPlus className="h-3 w-3" /> Open to collaborators
                </span>
              )}
            </div>
            {project.goal && (
              <p className="mt-4 text-sm text-white/70 drop-shadow max-w-xl line-clamp-2">
                {project.goal}
              </p>
            )}
          </div>

          <div className="hidden shrink-0 flex-col gap-2 sm:flex">
            <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--user-accent,var(--trust))] px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
              Join Project
            </button>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/80 backdrop-blur-sm transition hover:bg-white/20"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/80 backdrop-blur-sm transition hover:bg-white/20"
                aria-label="Bookmark"
              >
                <Bookmark className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1">
        <div
          className="h-full bg-gradient-brand transition-all duration-500"
          style={{ width: `${project.progress_percent}%` }}
        />
      </div>
      <span className="absolute bottom-2 right-4 text-[10px] font-medium uppercase tracking-wider text-white/50">
        {project.stage ?? "planning"}
      </span>
    </section>
  );
}
