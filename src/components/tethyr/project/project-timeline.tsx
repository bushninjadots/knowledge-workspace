import { Lightbulb, Hammer, FlaskConical, Rocket, Sprout } from "lucide-react";

export type ProjectStage = "planning" | "building" | "testing" | "launch" | "growing";

const STAGES: { id: ProjectStage; label: string; icon: typeof Lightbulb; color: string }[] = [
  { id: "planning", label: "Planning", icon: Lightbulb, color: "text-muted-foreground" },
  { id: "building", label: "Building", icon: Hammer, color: "text-primary" },
  { id: "testing", label: "Testing", icon: FlaskConical, color: "text-brand-purple" },
  { id: "launch", label: "Launch", icon: Rocket, color: "text-brand-green" },
  { id: "growing", label: "Growing", icon: Sprout, color: "text-brand-green" },
];

export function ProjectTimeline({
  currentStage,
  isOwner,
  onStageChange,
  variant = "horizontal",
}: {
  currentStage: ProjectStage;
  isOwner: boolean;
  onStageChange?: (stage: ProjectStage) => void;
  variant?: "horizontal" | "compact";
}) {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage);

  if (variant === "compact") {
    return (
      <div className="space-y-1">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = idx === currentIdx;
          const isPast = idx < currentIdx;
          return (
            <button
              key={stage.id}
              onClick={() => { if (isOwner && onStageChange) onStageChange(stage.id); }}
              disabled={!isOwner}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                isOwner ? "cursor-pointer" : "cursor-default"
              } ${isActive ? "bg-primary/10" : "hover:bg-surface-elevated"}`}
            >
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                isActive ? "border-primary text-primary" :
                isPast ? "border-brand-green text-brand-green" :
                "border-border/60 text-muted-foreground"
              }`}>
                <Icon className="h-3 w-3" />
              </div>
              <span className={`font-medium ${
                isActive ? "text-foreground" :
                isPast ? "text-brand-green" :
                "text-muted-foreground"
              }`}>
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card-border rounded-3xl border bg-surface p-6">
      <h3 className="mb-4 text-sm font-medium text-foreground/80">Project Timeline</h3>

      <div className="relative flex items-center justify-between">
        {/* Connector line */}
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border/60" />
        <div
          className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-brand transition-all duration-500"
          style={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
        />

        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = idx === currentIdx;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <button
              key={stage.id}
              onClick={() => {
                if (isOwner && onStageChange) {
                  onStageChange(stage.id);
                }
              }}
              disabled={!isOwner}
              className={`relative z-10 flex flex-col items-center gap-1.5 ${
                isOwner ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isPast
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border/60 bg-surface text-muted-foreground"
                } ${isFuture ? "opacity-50" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isActive
                    ? "text-foreground"
                    : isPast
                      ? "text-brand-green"
                      : "text-muted-foreground"
                } ${isFuture ? "opacity-50" : ""}`}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
