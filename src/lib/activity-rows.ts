// The project timeline can hold hundreds of commits. Runs of consecutive
// commits from the same day fold into one row ("12 commits"), so updates,
// milestones and people stay visible between them.

export type ActivityRow<T> =
  { type: "item"; item: T } | { type: "commits"; items: T[]; day: string };

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function groupCommitRuns<T extends { kind: string; at: string }>(
  items: T[],
  isCommit: (item: T) => boolean = (item) => item.kind === "github",
): ActivityRow<T>[] {
  const rows: ActivityRow<T>[] = [];
  for (const item of items) {
    const last = rows[rows.length - 1];
    if (isCommit(item)) {
      const day = localDay(item.at);
      if (last?.type === "commits" && last.day === day) last.items.push(item);
      else rows.push({ type: "commits", items: [item], day });
    } else {
      rows.push({ type: "item", item });
    }
  }
  // A lone commit reads better as itself.
  return rows.map((row) =>
    row.type === "commits" && row.items.length === 1 ? { type: "item", item: row.items[0] } : row,
  );
}
