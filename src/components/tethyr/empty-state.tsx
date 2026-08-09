import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

function WorkshopIllustration({
  variant,
}: {
  variant: "projects" | "skills" | "community" | "messages" | "default";
}) {
  const illustrations: Record<string, ReactNode> = {
    projects: (
      <svg
        viewBox="0 0 200 160"
        className="h-32 w-32 text-muted-foreground/30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Desk */}
        <rect x="30" y="90" width="140" height="8" rx="4" fill="currentColor" opacity="0.3" />
        <rect x="45" y="98" width="4" height="40" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="151" y="98" width="4" height="40" rx="2" fill="currentColor" opacity="0.2" />
        {/* Pinboard */}
        <rect
          x="50"
          y="20"
          width="100"
          height="65"
          rx="6"
          fill="currentColor"
          opacity="0.15"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.2"
        />
        {/* Pinned notes */}
        <rect x="60" y="30" width="35" height="25" rx="3" fill="var(--brand-green)" opacity="0.2" />
        <rect
          x="105"
          y="28"
          width="35"
          height="30"
          rx="3"
          fill="var(--brand-purple)"
          opacity="0.2"
        />
        <rect x="75" y="58" width="50" height="22" rx="3" fill="currentColor" opacity="0.1" />
        {/* Pins */}
        <circle cx="77" cy="30" r="2" fill="var(--brand-green)" opacity="0.6" />
        <circle cx="122" cy="28" r="2" fill="var(--brand-purple)" opacity="0.6" />
        <circle cx="100" cy="58" r="2" fill="currentColor" opacity="0.4" />
        {/* Pencil */}
        <rect
          x="60"
          y="102"
          width="2"
          height="25"
          rx="1"
          fill="var(--brand-purple)"
          opacity="0.3"
          transform="rotate(-15 60 102)"
        />
        {/* Note on desk */}
        <rect x="110" y="78" width="30" height="12" rx="2" fill="currentColor" opacity="0.1" />
      </svg>
    ),
    skills: (
      <svg
        viewBox="0 0 200 160"
        className="h-32 w-32 text-muted-foreground/30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Workbench */}
        <rect x="20" y="100" width="160" height="10" rx="5" fill="currentColor" opacity="0.3" />
        {/* Tool rack */}
        <rect x="40" y="30" width="120" height="60" rx="6" fill="currentColor" opacity="0.1" />
        {/* Tools hanging */}
        <rect
          x="55"
          y="35"
          width="3"
          height="40"
          rx="1.5"
          fill="var(--brand-green)"
          opacity="0.3"
        />
        <rect
          x="75"
          y="38"
          width="3"
          height="35"
          rx="1.5"
          fill="var(--brand-purple)"
          opacity="0.3"
        />
        <rect
          x="95"
          y="33"
          width="3"
          height="42"
          rx="1.5"
          fill="var(--brand-green)"
          opacity="0.3"
        />
        <rect
          x="115"
          y="40"
          width="3"
          height="30"
          rx="1.5"
          fill="var(--brand-purple)"
          opacity="0.3"
        />
        <rect x="135" y="36" width="3" height="38" rx="1.5" fill="currentColor" opacity="0.2" />
        {/* Book */}
        <rect
          x="60"
          y="105"
          width="25"
          height="18"
          rx="3"
          fill="var(--brand-green)"
          opacity="0.15"
        />
        <rect
          x="90"
          y="107"
          width="25"
          height="16"
          rx="3"
          fill="var(--brand-purple)"
          opacity="0.15"
        />
      </svg>
    ),
    community: (
      <svg
        viewBox="0 0 200 160"
        className="h-32 w-32 text-muted-foreground/30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shared table */}
        <ellipse cx="100" cy="110" rx="70" ry="20" fill="currentColor" opacity="0.15" />
        {/* People silhouettes */}
        <circle cx="50" cy="75" r="12" fill="var(--brand-green)" opacity="0.2" />
        <circle cx="50" cy="100" r="8" fill="var(--brand-green)" opacity="0.15" />
        <circle cx="100" cy="65" r="12" fill="var(--brand-purple)" opacity="0.2" />
        <circle cx="100" cy="90" r="8" fill="var(--brand-purple)" opacity="0.15" />
        <circle cx="150" cy="75" r="12" fill="currentColor" opacity="0.15" />
        <circle cx="150" cy="100" r="8" fill="currentColor" opacity="0.1" />
        {/* Connection lines */}
        <line
          x1="62"
          y1="75"
          x2="88"
          y2="65"
          stroke="var(--brand-green)"
          strokeWidth="1"
          opacity="0.3"
          strokeDasharray="4 2"
        />
        <line
          x1="112"
          y1="65"
          x2="138"
          y2="75"
          stroke="var(--brand-purple)"
          strokeWidth="1"
          opacity="0.3"
          strokeDasharray="4 2"
        />
        {/* Speech bubbles */}
        <rect x="60" y="40" width="30" height="18" rx="9" fill="currentColor" opacity="0.1" />
        <rect x="110" y="35" width="25" height="16" rx="8" fill="currentColor" opacity="0.1" />
      </svg>
    ),
    messages: (
      <svg
        viewBox="0 0 200 160"
        className="h-32 w-32 text-muted-foreground/30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Meeting table */}
        <rect x="40" y="80" width="120" height="50" rx="12" fill="currentColor" opacity="0.15" />
        {/* Two people */}
        <circle cx="70" cy="60" r="14" fill="var(--brand-green)" opacity="0.2" />
        <circle cx="130" cy="60" r="14" fill="var(--brand-purple)" opacity="0.2" />
        {/* Chat lines */}
        <rect x="55" y="40" width="40" height="4" rx="2" fill="var(--brand-green)" opacity="0.2" />
        <rect
          x="60"
          y="48"
          width="30"
          height="3"
          rx="1.5"
          fill="var(--brand-green)"
          opacity="0.15"
        />
        <rect
          x="105"
          y="38"
          width="35"
          height="4"
          rx="2"
          fill="var(--brand-purple)"
          opacity="0.2"
        />
        <rect
          x="110"
          y="46"
          width="25"
          height="3"
          rx="1.5"
          fill="var(--brand-purple)"
          opacity="0.15"
        />
        {/* Connection */}
        <path
          d="M84 60 Q100 75 116 60"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
          strokeDasharray="4 2"
          fill="none"
        />
      </svg>
    ),
    default: (
      <svg
        viewBox="0 0 200 160"
        className="h-32 w-32 text-muted-foreground/30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Empty workshop */}
        <rect x="30" y="100" width="140" height="8" rx="4" fill="currentColor" opacity="0.3" />
        <rect x="45" y="108" width="4" height="35" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="151" y="108" width="4" height="35" rx="2" fill="currentColor" opacity="0.2" />
        {/* Desk lamp */}
        <path
          d="M100 45 L100 80 M85 45 L115 45"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.2"
          strokeLinecap="round"
        />
        <circle cx="100" cy="42" r="6" fill="var(--brand-green)" opacity="0.15" />
        {/* Note pinned */}
        <rect x="80" y="55" width="40" height="30" rx="4" fill="currentColor" opacity="0.1" />
        <line
          x1="88"
          y1="65"
          x2="112"
          y2="65"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.15"
        />
        <line
          x1="88"
          y1="72"
          x2="105"
          y2="72"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.1"
        />
        <circle cx="100" cy="55" r="2" fill="var(--brand-purple)" opacity="0.4" />
      </svg>
    ),
  };

  return illustrations[variant] ?? illustrations.default;
}

export function EmptyState({
  icon: _icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = "default",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  /** Callback variant of the action — use for in-page actions (dialogs, filters). */
  onAction?: () => void;
  variant?: "projects" | "skills" | "community" | "messages" | "default";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed card-border bg-surface/30 bg-noise px-6 py-12 text-center animate-fade-in">
      <WorkshopIllustration variant={variant} />
      <div className="space-y-2">
        <p className="font-title text-base font-medium text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-1 rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {actionLabel && actionHref && !onAction && (
        <Button asChild size="sm" variant="outline" className="mt-1 rounded-full">
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
