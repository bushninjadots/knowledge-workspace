import { useEffect, useState } from "react";
import { ArrowRight, Check, Compass, FolderPlus, GraduationCap, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CreateProjectButton } from "./create-project-button";
import type { CurrentUserData } from "@/hooks/use-current-user";

const DISMISSED_KEY_PREFIX = "tethyr-first-session-onboarding-dismissed";

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

  const hasStarted =
    data.projects.length > 0 || data.teachIds.length > 0 || data.learnIds.length > 0;
  if (dismissed || hasStarted) return null;

  function dismiss() {
    window.localStorage.setItem(dismissedKey, "1");
    setDismissed(true);
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-primary">
          <Check className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Your first move</p>
        </div>
        <h2 className="mt-2 font-display text-xl font-semibold sm:text-2xl">
          Start with something you want to make.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tethyr works best when your skills and projects give people a real way to help, learn, or
          build with you.
        </p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <CreateProjectButton
          label="Start a project"
          className="h-auto justify-start rounded-lg px-3 py-3 text-left"
          onCreated={dismiss}
        />
        <Link
          to="/explore"
          className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm transition hover:border-primary/40 hover:bg-background"
        >
          <Compass className="h-4 w-4 text-brand-purple" />
          <span className="min-w-0 flex-1">Find work to help with</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/profile"
          className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm transition hover:border-primary/40 hover:bg-background"
        >
          <GraduationCap className="h-4 w-4 text-brand-green" />
          <span className="min-w-0 flex-1">Add skills to your studio</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FolderPlus className="h-3 w-3" /> You can add detail, roles, and milestones whenever you
        are ready.
      </p>
    </section>
  );
}
