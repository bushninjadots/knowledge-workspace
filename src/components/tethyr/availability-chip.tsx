// Shared availability readout — a small colored-dot chip used on project and
// creator cards to surface "Open to collaboration" without onboarding noise.
import { cn } from "@/lib/utils";

export const AVAIL_META: Record<string, { label: string; dot: string }> = {
  available: { label: "Open to collaboration", dot: "bg-trust" },
  busy: { label: "Focused on current work", dot: "bg-teaching" },
  away: { label: "Taking a step back", dot: "bg-muted-foreground" },
};

export function AvailabilityChip({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  const meta = status ? AVAIL_META[status] : undefined;
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      title={meta.label}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}