/**
 * One vocabulary for where a project is in its life.
 *
 * The schema has two overlapping fields — `status` (active/planning/paused/
 * completed) and `stage` (planning/building/testing/launch/growing) — which
 * used to render as two separate chips and forced users to reconcile them.
 * The canonical line leads with the lifecycle stage (the more specific word)
 * and folds status in only when it adds information: paused and completed
 * override the stage; active adds nothing (a growing project is obviously
 * active); planning overrides the stage (you can't be "building" while
 * planning).
 *
 * Everything renders as one line: `Growing · 68% · Started 3 months ago`.
 */

export const CANONICAL_STAGES = [
  "planning",
  "prototyping",
  "building",
  "testing",
  "launching",
  "growing",
] as const;

export type CanonicalStage = (typeof CANONICAL_STAGES)[number];

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning",
  prototyping: "Prototyping",
  building: "Building",
  testing: "Testing",
  launch: "Launching",
  launching: "Launching",
  growing: "Growing",
};

const OVERRIDE_LABEL: Partial<Record<string, string>> = {
  paused: "Paused",
  completed: "Completed",
  planning: "Planning",
};

/** `planning` and `prototyping` read as intent, not momentum. */
const LIVE_STATUSES = new Set(["building", "testing", "launch", "launching", "growing"]);

/**
 * The single word for where the project is. Returns null only when both
 * fields are empty — callers then render just the progress/age facts.
 */
export function canonicalProjectStatus(
  status?: string | null,
  stage?: string | null,
): string | null {
  const override = OVERRIDE_LABEL[status ?? ""];
  if (override) return override;
  if (status === "planning") return "Planning";
  const stageWord = stage ? (STAGE_LABEL[stage] ?? null) : null;
  if (stageWord) return stageWord;
  if (status === "active") return null;
  return null;
}

/** Statuses where the dot should breathe (see animate-status-breathe). */
export function isLiveStatus(status?: string | null, stage?: string | null): boolean {
  if (status === "paused" || status === "completed") return false;
  return LIVE_STATUSES.has(stage ?? "") || status === "active";
}

/** Attributes for the canonical status dot. */
export function statusDotClass(status?: string | null): string {
  switch (status) {
    case "paused":
      return "bg-muted-foreground/40";
    case "completed":
      return "bg-primary";
    case "planning":
      return "bg-teaching";
    default:
      return "bg-trust";
  }
}
