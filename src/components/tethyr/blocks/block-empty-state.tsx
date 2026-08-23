// ── Block Empty State ────────────────────────────────────────────────────────
// Shared placeholder shown in edit mode when a block has no data yet.
// Makes it visible (and removable) rather than disappearing entirely.

interface BlockEmptyStateProps {
  /** Human-readable label for the block type. */
  label: string;
  /** Optional detail line. */
  detail?: string;
}

export function BlockEmptyState({ label, detail }: BlockEmptyStateProps) {
  return (
    <div
      className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground"
      role="status"
      aria-label={`Empty ${label} block`}
    >
      <span className="font-medium">{label}</span> block
      {detail && <> — {detail}</>}
    </div>
  );
}