// The Studio command palette's commands and how a typed query picks them.
// Pure so the matching can be tested without the editor around it.

export type StudioCommandGroup = "Selection" | "Page" | "Add a block" | "Go to a block";

export interface StudioCommand {
  id: string;
  label: string;
  group: StudioCommandGroup;
  /** Extra words people might type for it ("delete" for Remove). */
  keywords?: string;
  /** The keyboard shortcut that does the same, shown beside it. */
  shortcut?: string;
  run: () => void;
}

const GROUP_ORDER: StudioCommandGroup[] = ["Selection", "Page", "Add a block", "Go to a block"];

/**
 * The commands matching `query`: every word typed must appear in the label,
 * keywords or group. Groups stay together in the palette's order, except that
 * groups holding a label that starts with the query come first. An empty query lists everything except
 * the long "Add a block" and "Go to a block" lists, which need a word typed.
 */
export function filterCommands(commands: StudioCommand[], query: string): StudioCommand[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const byGroup = (a: StudioCommand, b: StudioCommand) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (words.length === 0) {
    return commands
      .filter((command) => command.group === "Selection" || command.group === "Page")
      .sort(byGroup);
  }
  const phrase = words.join(" ");
  const matches = commands
    .filter((command) => {
      const text = `${command.label} ${command.keywords ?? ""} ${command.group}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((command) => ({ command, starts: command.label.toLowerCase().startsWith(phrase) }));
  // Groups stay together (the palette heads each one once); a group with a
  // label starting with the query moves up, and so do those labels within it.
  const leading = new Set(matches.filter((m) => m.starts).map((m) => m.command.group));
  return matches
    .sort(
      (a, b) =>
        Number(leading.has(b.command.group)) - Number(leading.has(a.command.group)) ||
        byGroup(a.command, b.command) ||
        Number(b.starts) - Number(a.starts),
    )
    .map(({ command }) => command);
}
