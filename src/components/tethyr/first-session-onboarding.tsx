import { useEffect, useState } from "react";
import { ArrowRight, Check, Compass, FolderPlus, GraduationCap, UserRound, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CreateProjectButton } from "./create-project-button";
import type { CurrentUserData } from "@/hooks/use-current-user";

const DISMISSED_KEY_PREFIX = "tethyr-first-session-onboarding-dismissed";

/**
 * First-run guided path.
 *
 * This replaces the old "pick an intent" screen with the cold-start journey
 * that actually feeds the primary loop: set up your Studio (identity), start
 * your first project (work), and share a skill you can teach (signal). Once
 * those three basics exist, the tailored suggestions in "Build and discover"
 * turn themselves on — the guide has done its job and steps out.
 */
export function FirstSessionOnboarding({ data }: { data: CurrentUserData }) {
  const dismissedKey = `${DISMISSED_KEY_PREFIX}:${data.userId}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(dismissedKey) === "1";
  });

  useEffect(() => {
    setDismissed(
      typeof window !== "undefined" && window.localStorage.getItem(dismissedKey) === "1",
    );
  }, [dismissedKey]);

  const studioDone = !!(
    data.profile?.display_name &&
    (data.profile?.creator_title || data.profile?.bio)
  );
  const projectDone = data.projects.length > 0;
  const skillDone = data.teachIds.length > 0;
  const allDone = studioDone && projectDone && skillDone;
  if (dismissed || allDone) return null;

  function dismiss() {
    window.localStorage.setItem(dismissedKey, "1");
    setDismissed(true);
  }

  const steps: {
    id: "studio" | "project" | "skill";
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    caption: string;
    done: boolean;
  }[] = [
    {
      id: "studio",
      icon: UserRound,
      label: "Set up your Studio",
      caption: "Your name and what you make, so people can find you.",
      done: studioDone,
    },
    {
      id: "project",
      icon: FolderPlus,
      label: "Start your first project",
      caption: "Give your work a home — something people can read and join.",
      done: projectDone,
    },
    {
      id: "skill",
      icon: GraduationCap,
      label: "Share a skill you teach",
      caption: "Skills are the signal that switches on matching projects and people.",
      done: skillDone,
    },
  ];

  const activeStep = steps.find((step) => !step.done) ?? steps[0];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section
      aria-labelledby="first-session-heading"
      className="relative overflow-hidden border-y border-primary/20 bg-primary/5 px-5 py-6 sm:px-6"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-lift hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-primary">
          <Compass className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Start here</p>
        </div>
        <h2
          id="first-session-heading"
          className="mt-2 font-display text-xl font-semibold sm:text-2xl"
        >
          Set up your Studio, then start building.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Once your studio, a project, and a skill are in place, discovery turns on — matching
          projects and people show up right here on your dashboard.
        </p>
      </div>

      <ol className="mt-5 space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === activeStep.id;
          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                isActive
                  ? "border-[var(--user-accent-border,var(--primary))] bg-[var(--user-accent-subtle,var(--surface-elevated))]"
                  : "border-transparent bg-background/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done
                    ? "bg-trust text-trust-foreground"
                    : isActive
                      ? "bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--background))]"
                      : "bg-foreground/10 text-muted-foreground"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.done ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.label}
                  {step.done && (
                    <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-trust">
                      done
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {step.caption}
                </p>
              </div>
              {isActive && (
                <div className="shrink-0 self-center">
                  {activeStep.id === "project" ? (
                    <CreateProjectButton label="Start a project" className="rounded-md" />
                  ) : (
                    <Link
                      to="/profile"
                      className="group inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-fade hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {activeStep.id === "skill" ? "Add a skill" : "Open Your Studio"}
                      <ArrowRight className="h-3.5 w-3.5 transition-spatial group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FolderPlus className="h-3 w-3" /> {doneCount} of 3 set up — you can add detail, roles, and
        milestones whenever you are ready.
      </p>
    </section>
  );
}
