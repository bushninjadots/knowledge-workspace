import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  FolderPlus,
  GraduationCap,
  HandHeart,
  Search,
  Users,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CreateProjectButton } from "./create-project-button";
import type { CurrentUserData } from "@/hooks/use-current-user";

const DISMISSED_KEY_PREFIX = "tethyr-first-session-onboarding-dismissed";

export function FirstSessionOnboarding({ data }: { data: CurrentUserData }) {
  const dismissedKey = `${DISMISSED_KEY_PREFIX}:${data.userId}`;
  const [intent, setIntent] = useState<"build" | "join" | "connect" | "learn" | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(dismissedKey) === "1";
  });

  useEffect(() => {
    setDismissed(
      typeof window !== "undefined" && window.localStorage.getItem(dismissedKey) === "1",
    );
  }, [dismissedKey]);

  const hasStarted =
    data.projects.length > 0 || data.teachIds.length > 0 || data.learnIds.length > 0;
  if (dismissed || hasStarted) return null;

  function dismiss() {
    window.localStorage.setItem(dismissedKey, "1");
    setDismissed(true);
  }

  const intentOptions: {
    id: "build" | "join" | "connect" | "learn";
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[] = [
    { id: "build" as const, label: "Build something", icon: FolderPlus },
    { id: "join" as const, label: "Find a project", icon: Compass },
    { id: "connect" as const, label: "Find collaborators", icon: Users },
    { id: "learn" as const, label: "Learn through real work", icon: GraduationCap },
  ];

  const intentCopy = {
    build: {
      title: "Give your idea a place to grow.",
      description: "Start a project, then add the people and milestones that make it real.",
      primary: "Start a project",
    },
    join: {
      title: "Find work worth joining.",
      description: "Explore projects with open roles and see where your skills can help.",
      primary: "Explore projects",
    },
    connect: {
      title: "Meet people through what they make.",
      description: "Find builders with complementary skills and start with their work.",
      primary: "Find collaborators",
    },
    learn: {
      title: "Learn by contributing to real work.",
      description:
        "Choose a project or challenge where you can practice and leave visible evidence.",
      primary: "Find a project",
    },
  } as const;

  return (
    <section
      aria-labelledby="first-session-heading"
      className="relative overflow-hidden border-y border-primary/20 bg-primary/5 px-5 py-6 sm:px-6"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-primary">
          <Check className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Start here</p>
        </div>
        <h2
          id="first-session-heading"
          className="mt-2 font-display text-xl font-semibold sm:text-2xl"
        >
          What brings you to Tethyr?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tethyr is a place to build with people. Pick the direction that feels most useful today.
        </p>
      </div>

      <div
        className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        aria-label="Choose your starting point"
      >
        {intentOptions.map((option) => {
          const Icon = option.icon;
          const selected = intent === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setIntent(option.id)}
              className={`flex min-h-16 items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "border-primary bg-background text-foreground"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-background hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {intent && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary/50 pl-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{intentCopy[intent].title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {intentCopy[intent].description}
            </p>
          </div>
          {intent === "build" ? (
            <CreateProjectButton
              label={intentCopy[intent].primary}
              className="shrink-0 rounded-md"
              onCreated={dismiss}
            />
          ) : (
            <Link
              to={
                intent === "connect" ? "/explore" : intent === "learn" ? "/challenges" : "/explore"
              }
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={dismiss}
            >
              {intent === "connect" ? (
                <HandHeart className="h-3.5 w-3.5" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {intentCopy[intent].primary}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}

      {!intent && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FolderPlus className="h-3 w-3" /> You can add detail, roles, and milestones whenever you
          are ready.
        </p>
      )}
    </section>
  );
}
