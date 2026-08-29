import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlockEmptyStateProps {
  /** Human-readable label for the block type. */
  label: string;
  /** Optional detail line. */
  detail?: string;
  /** Optional owner action for creating the first item. */
  actionLabel?: string;
  onAction?: () => void;
}

export function BlockEmptyState({ label, detail, actionLabel, onAction }: BlockEmptyStateProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground"
      role="status"
      aria-label={`Empty ${label} block`}
    >
      <span>
        <span className="font-medium text-foreground">{label}</span>
        {detail ? ` — ${detail}` : " is empty — add your first item when ready."}
      </span>
      {actionLabel && onAction && (
        <Button type="button" size="sm" variant="outline" onClick={onAction}>
          <Plus aria-hidden="true" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
