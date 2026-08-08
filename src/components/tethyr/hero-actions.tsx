import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CalendarClock, FolderKanban, Trophy } from "lucide-react";

// What you can actually do on Tethyr today — build projects, take on challenges,
// book sessions with other builders, and earn reputation through real work.
const ACTIONS = [
  {
    icon: FolderKanban,
    title: "Start a project",
    desc: "Structured workspaces with milestones, open roles, and progress tracking.",
    to: "/explore",
    cta: "Explore projects",
  },
  {
    icon: Trophy,
    title: "Join a challenge",
    desc: "Level up a skill through structured builds with reputation on the line.",
    to: "/community",
    cta: "See challenges",
  },
  {
    icon: CalendarClock,
    title: "Book a session",
    desc: "Mentor, pair up, or brainstorm one-on-one with another builder.",
    to: "/sessions",
    cta: "Schedule a session",
  },
  {
    icon: BadgeCheck,
    title: "Grow your reputation",
    desc: "Earn recognition through contributions, endorsements, and completed work.",
    to: "/dashboard",
    cta: "Track your progress",
  },
];

export function HeroActions() {
  return (
    <div className="card-border relative mt-12 rounded-2xl border bg-surface/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="flex items-center gap-2">
        <FolderKanban className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          What you can do here
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map((action) => (
          <Link
            key={action.title}
            to={action.to}
            className="card-border group flex flex-col rounded-xl border bg-surface-elevated/40 p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface transition-colors group-hover:border-primary/40">
              <action.icon className="h-4 w-4 text-foreground" />
            </div>
            <h3 className="mt-3 font-display text-sm font-semibold group-hover:text-primary">
              {action.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.desc}</p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-medium text-primary transition-all group-hover:gap-2.5">
              {action.cta} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
